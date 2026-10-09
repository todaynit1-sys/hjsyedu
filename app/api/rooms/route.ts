import { newRoom, text } from '../../../lib/domain';
import { body, failure, json, requireHost } from '../../../lib/security';
import { ensureMainRoom, insertRoom, listRooms } from '../../../lib/store';
import { MAIN_ROOM_CODE } from '../../../lib/types';
export async function GET() {
  try { await requireHost(); await ensureMainRoom(); const rooms = await listRooms(); rooms.sort((a, b) => Number(b.code === MAIN_ROOM_CODE) - Number(a.code === MAIN_ROOM_CODE)); return json(rooms.map(r => ({ code: r.code, title: r.title, demo: r.demo }))); }
  catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    await requireHost(); const input = await body(request);
    const room = newRoom(text(input.title, '강의 이름', 80));
    await insertRoom(room); return json({ code: room.code });
  } catch (e) { return failure(e); }
}
