import 'server-only';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { AppError, demoRoom } from './domain';
import type { Room } from './types';
type RecordRow = { code: string; state: Room; revision: number };
let sqlite: DatabaseSync | undefined;
export function mode(): 'local' | 'cloud' {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return 'cloud';
  if (process.env.LOCAL_PREVIEW === 'true' && !process.env.VERCEL) return 'local';
  throw new AppError('강의 저장소가 아직 연결되지 않았습니다. 강사에게 문의해주세요.', 503);
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
async function cloud(query: string, init?: RequestInit): Promise<RecordRow[]> {
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${process.env.SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/class_board_rooms${query}`, {
    ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000),
    headers: { apikey: secret, ...(secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${secret}` }), 'Content-Type': 'application/json', Prefer: 'return=representation', ...init?.headers }
  });
  if (!response.ok) {
    if (response.status === 409) throw new AppError('같은 강의실 코드가 있습니다. 다시 시도해주세요.', 409);
    console.error('Class Board database request failed:', response.status);
    throw new AppError('저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 503);
  }
  return await response.json();
}
export async function getRoom(code: string): Promise<RecordRow> {
  let row: RecordRow | undefined;
  if (mode() === 'local') {
    const raw = db().prepare('SELECT code,state,revision FROM rooms WHERE code=?').get(code) as { code: string; state: string; revision: number } | undefined;
    row = raw ? { ...raw, state: JSON.parse(raw.state) } : undefined;
  } else [row] = await cloud(`?code=eq.${encodeURIComponent(code)}&select=code,state,revision`);
  if (!row) throw new AppError('강의실을 찾을 수 없습니다. 참여 코드를 확인해주세요.', 404);
  return row;
}
export async function listRooms(): Promise<Room[]> {
  if (mode() === 'local') return (db().prepare('SELECT state FROM rooms ORDER BY rowid DESC').all() as { state: string }[]).map(r => JSON.parse(r.state));
  return (await cloud('?select=code,state,revision&order=updated_at.desc&limit=100')).map(r => r.state);
}
export async function insertRoom(room: Room): Promise<void> {
  if (mode() === 'local') {
    try { db().prepare('INSERT INTO rooms(code,state,revision) VALUES (?,?,0)').run(room.code, JSON.stringify(room)); }
    catch { throw new AppError('강의실 생성에 실패했습니다. 다시 시도해주세요.', 409); }
  } else await cloud('', { method: 'POST', body: JSON.stringify({ code: room.code, state: room, revision: 0 }) });
}
export async function updateRoom(code: string, change: (room: Room) => void): Promise<Room> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const row = await getRoom(code);
    change(row.state);
    if (mode() === 'local') {
      const result = db().prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').run(JSON.stringify(row.state), code, row.revision);
      if (result.changes === 1) return row.state;
    } else {
      const result = await cloud(`?code=eq.${encodeURIComponent(code)}&revision=eq.${row.revision}`, {
        method: 'PATCH', body: JSON.stringify({ state: row.state, revision: row.revision + 1, updated_at: new Date().toISOString() })
      });
      if (result.length === 1) return row.state;
    }
    await new Promise(resolve => setTimeout(resolve, 15 + attempt * 10));
  }
  throw new AppError('응답이 몰리고 있습니다. 다시 눌러주세요.', 409);
}
