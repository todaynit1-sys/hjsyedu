import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BlobPreconditionFailedError, get, list, put } from '@vercel/blob';
import { AppError, demoRoom, ensureDay, newRoom, today } from './domain';
import { MAIN_ROOM_CODE } from './types';
import type { Room } from './types';
type RecordRow = { code: string; state: Room; revision: number; etag?: string };
let sqlite: DatabaseSync | undefined;
const prefix = 'hjsy-classrooms/';
const reads = new Map<string, { at: number; row: RecordRow }>();
const loading = new Map<string, Promise<RecordRow>>();
type PresenceBuffer = { date: string; presence: Record<string, number>; lastFlush: number; flushing?: Promise<Room> };
const presenceBuffers = new Map<string, PresenceBuffer>();
function remember(row: RecordRow): void {
  if (reads.size >= 100 && !reads.has(row.code)) reads.delete(reads.keys().next().value!);
  reads.set(row.code, { at: Date.now(), row: structuredClone(row) });
}
function mergePresence(room: Room): void {
  const buffer = presenceBuffers.get(room.code); const day = room.days[today()];
  if (buffer?.date === today() && day?.active) {
    day.presence = Object.fromEntries(Object.entries({ ...day.presence, ...buffer.presence }).filter(([, at]) => Date.now() - at < 45_000));
  }
}
function pathname(code: string): string { return `${prefix}${code}.json`; }
export function mode(): 'local' | 'cloud' {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'cloud';
  if (process.env.LOCAL_PREVIEW === 'true' && !process.env.VERCEL) return 'local';
  throw new AppError('강의 저장소 연결이 필요합니다. 강사가 Vercel의 Storage에서 비공개 Blob을 연결해주세요.', 503);
}
function db(): DatabaseSync {
  if (!sqlite) {
    const directory = path.join(process.cwd(), '.local');
    mkdirSync(directory, { recursive: true });
    sqlite = new DatabaseSync(path.join(directory, 'class-board.sqlite'));
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)');
    const demo = demoRoom();
    sqlite.prepare('INSERT OR IGNORE INTO rooms(code,state,revision) VALUES (?,?,0)').run(demo.code, JSON.stringify(demo));
  }
  return sqlite;
}
async function readRoom(code: string): Promise<RecordRow> {
  let row: RecordRow | undefined;
  if (mode() === 'local') {
    const raw = db().prepare('SELECT code,state,revision FROM rooms WHERE code=?').get(code) as { code: string; state: string; revision: number } | undefined;
    row = raw ? { ...raw, state: JSON.parse(raw.state) } : undefined;
  } else {
    // Consistent origin reads and conditional writes protect simultaneous responses.
    const result = await get(pathname(code), { access: 'private', useCache: false, abortSignal: AbortSignal.timeout(10_000) });
    if (result?.statusCode === 200) row = { ...await new Response(result.stream).json(), etag: result.blob.etag };
  }
  if (!row) throw new AppError('강의실을 찾을 수 없습니다. 참여 코드를 확인해주세요.', 404);
  return row;
}
export async function getRoom(code: string): Promise<RecordRow> {
  let row: RecordRow;
  const cached = reads.get(code);
  if (mode() === 'cloud' && cached && Date.now() - cached.at < 2000 && cached.row.state.days[today()]) row = structuredClone(cached.row);
  else {
    let pending = loading.get(code);
    if (!pending) {
      pending = readRoom(code); loading.set(code, pending);
      pending.finally(() => loading.delete(code)).catch(() => {});
    }
    row = structuredClone(await pending); remember(row);
  }
  if (Object.keys(row.state.days).length !== 1 || !row.state.days[today()]) row.state = await updateRoom(code, room => { ensureDay(room); });
  mergePresence(row.state);
  return row;
}
export async function heartbeat(code: string, guest: string): Promise<Room> {
  const row = await getRoom(code);
  if (!row.state.days[today()].active) return row.state;
  let buffer = presenceBuffers.get(code);
  if (!buffer || buffer.date !== today()) {
    if (presenceBuffers.size >= 100 && !presenceBuffers.has(code)) presenceBuffers.delete(presenceBuffers.keys().next().value!);
    buffer = { date: today(), presence: {}, lastFlush: 0 }; presenceBuffers.set(code, buffer);
  }
  buffer.presence = Object.fromEntries(Object.entries(buffer.presence).filter(([, at]) => Date.now() - at < 45_000));
  buffer.presence[guest] = Date.now();
  if (Date.now() - buffer.lastFlush >= 30_000) {
    buffer.flushing ??= updateRoom(code, () => {});
    try { const state = await buffer.flushing; buffer.lastFlush = Date.now(); return state; }
    finally { buffer.flushing = undefined; }
  }
  mergePresence(row.state); return row.state;
}
export async function listRooms(): Promise<Room[]> {
  let codes: string[];
  if (mode() === 'local') codes = (db().prepare('SELECT code FROM rooms ORDER BY rowid DESC').all() as { code: string }[]).map(r => r.code);
  else {
    codes = []; let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, cursor });
      codes.push(...page.blobs.map(blob => blob.pathname.slice(prefix.length, -5)).filter(code => /^[A-Z0-9]{6}$/.test(code)));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
  const rooms: Room[] = [];
  for (const code of codes) rooms.push((await getRoom(code)).state);
  return rooms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function insertRoom(room: Room): Promise<void> {
  if (mode() === 'local') {
    try { db().prepare('INSERT INTO rooms(code,state,revision) VALUES (?,?,0)').run(room.code, JSON.stringify(room)); }
    catch { throw new AppError('강의실 생성에 실패했습니다. 다시 시도해주세요.', 409); }
  } else {
    try {
      const result = await put(pathname(room.code), JSON.stringify({ code: room.code, state: room, revision: 0 }), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', abortSignal: AbortSignal.timeout(10_000) });
      remember({ code: room.code, state: room, revision: 0, etag: result.etag });
    }
    catch (error) {
      // Only a confirmed collision becomes 409; connectivity failures stay failures.
      try { await readRoom(room.code); } catch { throw error; }
      throw new AppError('같은 강의실 코드가 있습니다. 다시 시도해주세요.', 409);
    }
  }
}
export async function ensureMainRoom(): Promise<Room> {
  try { return (await getRoom(MAIN_ROOM_CODE)).state; }
  catch (error) { if (!(error instanceof AppError) || error.status !== 404) throw error; }
  const room = newRoom('실시간 강의실'); room.code = MAIN_ROOM_CODE;
  try { await insertRoom(room); return room; }
  catch (error) {
    if (error instanceof AppError && error.status === 409) return (await getRoom(MAIN_ROOM_CODE)).state;
    throw error;
  }
}
export async function updateRoom(code: string, change: (room: Room) => void): Promise<Room> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const row = await readRoom(code); ensureDay(row.state); mergePresence(row.state); change(row.state);
    if (mode() === 'local') {
      const result = db().prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').run(JSON.stringify(row.state), code, row.revision);
      if (result.changes === 1) return row.state;
    } else {
      try {
        const result = await put(pathname(code), JSON.stringify({ code, state: row.state, revision: row.revision + 1 }), { access: 'private', addRandomSuffix: false, allowOverwrite: true, ifMatch: row.etag, contentType: 'application/json', abortSignal: AbortSignal.timeout(10_000) });
        remember({ code, state: row.state, revision: row.revision + 1, etag: result.etag });
        return row.state;
      } catch (error) { if (!(error instanceof BlobPreconditionFailedError)) throw error; }
    }
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * Math.min(500, 40 * (attempt + 1))));
  }
  throw new AppError('응답이 몰리고 있습니다. 다시 눌러주세요.', 409);
}
