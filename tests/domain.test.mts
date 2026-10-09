import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureDay, mutate, newRoom, safeUrl, snapshot, today } from '../lib/domain.ts';
test('Seoul midnight creates an independent daily record', () => {
  assert.equal(today(new Date('2026-10-08T14:59:59Z')), '2026-10-08');
  assert.equal(today(new Date('2026-10-08T15:00:00Z')), '2026-10-09');
  const room = newRoom('수업');
  const before = ensureDay(room, '2026-10-08');
  before.polls[0].votes.guest = 2;
  const after = ensureDay(room, '2026-10-09');
  assert.deepEqual(after.polls[0].votes, {});
  assert.equal(before.polls[0].votes.guest, 2);
});
test('changing the same browser vote preserves one response and hides identities', () => {
  const room = newRoom('수업'); const day = ensureDay(room); const id = day.polls[0].id;
  mutate(room, { type: 'vote', pollId: id, option: 0 }, 'guest-1', false);
  mutate(room, { type: 'vote', pollId: id, option: 2 }, 'guest-1', false);
  mutate(room, { type: 'vote', pollId: id, option: 1 }, 'guest-2', false);
  const value = snapshot(room, today(), 'guest-1', 'local');
  assert.equal(value.polls[0].total, 2); assert.deepEqual(value.polls[0].counts, [0, 1, 1]); assert.equal(value.polls[0].myVote, 2);
  assert.equal(JSON.stringify(value).includes('guest-1'), false);
  assert.equal('votes' in value.polls[0], false); assert.equal('presence' in value, false);
});
test('students cannot publish, pin or delete; closed and historical votes reject', () => {
  const room = newRoom('수업'); const day = ensureDay(room);
  for (const type of ['message', 'pin', 'delete', 'active', 'poll-create']) assert.throws(() => mutate(room, { type, text: 'hello' }, 'student', false), /강사 로그인/);
  mutate(room, { type: 'poll-toggle', id: day.polls[0].id }, null, true);
  assert.throws(() => mutate(room, { type: 'vote', pollId: day.polls[0].id, option: 0 }, 'student', false), /마감/);
  assert.throws(() => mutate(room, { type: 'message', text: 'hi', date: '2020-01-01' }, null, true), /지난 강의/);
});
test('a fresh poll archives its results instead of deleting them', () => {
  const room = newRoom('수업'); const day = ensureDay(room); const old = day.polls[0];
  mutate(room, { type: 'vote', pollId: old.id, option: 0 }, 'guest', false);
  mutate(room, { type: 'poll-reset', id: old.id }, null, true);
  assert.equal(old.archived, true); assert.equal(old.open, false); assert.equal(old.votes.guest, 0);
  assert.equal(day.polls.length, 3); assert.deepEqual(day.polls.find(p => p.kind === 'mood' && !p.archived)?.votes, {});
});
test('only safe link protocols are accepted and text remains text', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', 'not a url']) assert.throws(() => safeUrl(url));
  assert.equal(safeUrl('https://example.com/path'), 'https://example.com/path');
  const room = newRoom('수업'); mutate(room, { type: 'message', text: '<script>test</script>' }, null, true);
  assert.equal(ensureDay(room).messages[0].text, '<script>test</script>');
});
test('presence deduplicates browser tabs and expires after 45 seconds', () => {
  const room = newRoom('수업'); const day = ensureDay(room);
  mutate(room, { type: 'heartbeat' }, 'guest', false); mutate(room, { type: 'heartbeat' }, 'guest', false);
  day.presence.old = Date.now() - 46_000;
  assert.equal(snapshot(room, today(), null, 'local').online, 1);
});
