import { newRoom, text } from '../../../lib/domain';
import { body, failure, json, requireHost } from '../../../lib/security';
import { insertRoom, listRooms } from '../../../lib/store';
export async function GET() {
  try { await requireHost(); return json((await listRooms()).map(r => ({ code: r.code, title: r.title, demo: r.demo }))); }
  catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    await requireHost(); const input = await body(request);
    const room = newRoom(text(input.title, '강의 이름', 80));
    await insertRoom(room); return json({ code: room.code });
  } catch (e) { return failure(e); }
}
