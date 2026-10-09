// Runs the real Blob SDK against an in-process protocol mock; never contacts Vercel.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';

mkdirSync('.local/blob-verification', { recursive: true });
for (const name of ['types', 'domain', 'store']) {
  const source = readFileSync(`lib/${name}.ts`, 'utf8').replace("import 'server-only';", '')
    .replaceAll("'./domain'", "'./domain.mjs'").replaceAll("'./types'", "'./types.mjs'").replaceAll("'./types.ts'", "'./types.mjs'");
  writeFileSync(`.local/blob-verification/${name}.mjs`, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText);
}
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teststore_this_is_a_fake_test_token_only';
process.env.LOCAL_PREVIEW = 'false';
const files = new Map(); let revision = 0; let writes = 0; let reads = 0; let conflicts = 0;
const nativeDispatcher = getGlobalDispatcher(); const mock = new MockAgent(); mock.disableNetConnect(); setGlobalDispatcher(mock);
function reply(options) {
  const url = new URL(options.path, options.origin);
  const headers = new Headers(options.headers);
  assert.equal(headers.get('authorization'), `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`);
  if (url.hostname === 'teststore.private.blob.vercel-storage.com') {
    assert.equal(url.searchParams.get('cache'), '0'); reads++;
    const file = files.get(url.pathname.slice(1));
    return file ? { statusCode: 200, data: file.body, responseOptions: { headers: { etag: file.etag, 'content-type': 'application/json' } } } : { statusCode: 404 };
  }
  assert.equal(url.origin, 'https://vercel.com');
  assert.equal(options.method, 'PUT'); assert.equal(headers.get('x-vercel-blob-access'), 'private');
  const pathname = url.searchParams.get('pathname'); const previous = files.get(pathname);
  if (previous && headers.get('x-allow-overwrite') === '0') return { statusCode: 400, data: { error: { code: 'bad_request', message: 'already exists' } } };
  if (previous && headers.get('x-if-match') !== previous.etag) {
    conflicts++; return { statusCode: 412, data: { error: { code: 'precondition_failed' } } };
  }
  const etag = `revision-${++revision}`; const body = options.body;
  assert.equal(typeof body, 'string');
  files.set(pathname, { body, etag }); writes++;
  const blobUrl = `https://teststore.private.blob.vercel-storage.com/${pathname}`;
  return { statusCode: 200, data: { url: blobUrl, downloadUrl: blobUrl, pathname, contentType: 'application/json', contentDisposition: '', etag } };
}
for (const origin of ['https://vercel.com', 'https://teststore.private.blob.vercel-storage.com']) {
  mock.get(origin).intercept({ path: /./, method: /GET|PUT/ }).reply(reply).delay(2).persist();
}
try {
  const store = await import(pathToFileURL(path.resolve('.local/blob-verification/store.mjs')).href);
  const { mutate, newRoom, today } = await import(pathToFileURL(path.resolve('.local/blob-verification/domain.mjs')).href);
  const initialized = await Promise.all([store.ensureMainRoom(), store.ensureMainRoom()]);
  assert(initialized.every(room => room.code === 'HJSYAI')); assert.equal(files.size, 1);
  const room = newRoom('Blob 검증'); await store.insertRoom(room); const pollId = room.days[today()].polls[0].id;
  await Promise.all(Array.from({ length: 16 }, (_, i) => store.updateRoom(room.code, state => mutate(state, { type: 'vote', pollId, option: i % 3 }, `guest-${i}`, false))));
  const voted = (await store.getRoom(room.code)).state; assert.equal(Object.keys(voted.days[today()].polls[0].votes).length, 16); assert(conflicts > 0);
  const readsBefore = reads; await Promise.all(Array.from({ length: 40 }, () => store.getRoom(room.code))); assert.equal(reads, readsBefore, 'shared reads must use the bounded cache');
  const writesBefore = writes;
  await Promise.all(Array.from({ length: 40 }, (_, i) => store.heartbeat(room.code, `visitor-${i}`)));
  assert.equal(writes - writesBefore, 1, 'simultaneous presence must share one flush');
  assert.equal(Object.keys((await store.getRoom(room.code)).state.days[today()].presence).filter(id => id.startsWith('visitor-')).length, 40);
  const expired = newRoom('어제 방'); expired.days = { '2020-01-01': { ...Object.values(expired.days)[0], date: '2020-01-01', messages: [{ text: 'EXPIRED_CONTENT' }] } };
  await store.insertRoom(expired); const reset = (await store.getRoom(expired.code)).state;
  assert.deepEqual(Object.keys(reset.days), [today()]); assert.equal(files.get(`hjsy-classrooms/${expired.code}.json`).body.includes('EXPIRED_CONTENT'), false);
  console.log(`PASS: real Blob SDK, private access, consistent reads, initial collision, 16 concurrent votes (${conflicts} CAS conflicts), shared reads, batched presence, persisted daily cleanup.`);
} finally { setGlobalDispatcher(nativeDispatcher); await mock.close(); }
