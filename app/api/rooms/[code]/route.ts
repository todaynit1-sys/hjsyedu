import { AppError, ensureDay, mutate, snapshot, today } from '../../../../lib/domain';
import { body, failure, guestId, isHost, joinGuest, json } from '../../../../lib/security';
import { getRoom, mode, updateRoom } from '../../../../lib/store';
type Context = { params: Promise<{ code: string }> };
function valid(code: string): string {
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new AppError('6자리 참여 코드를 확인해주세요.');
  return code;
}
export async function GET(request: Request, context: Context) {
  try {
    const code = valid((await context.params).code);
    const date = new URL(request.url).searchParams.get('date') ?? today();
    const { state } = await getRoom(code);
    return json(snapshot(state, date, await guestId(), mode()));
  } catch (e) { return failure(e); }
}
export async function POST(request: Request, context: Context) {
  try {
    const code = valid((await context.params).code);
    const input = await body(request);
    let guest = await guestId();
    let state;
    if (input.type === 'join') {
      await getRoom(code);
      guest = await joinGuest();
      state = await updateRoom(code, room => { ensureDay(room); mutate(room, { type: 'heartbeat' }, guest, false); });
    } else if (input.type === 'start-day') {
      if (!await isHost()) throw new AppError('강사 로그인이 필요합니다.', 401);
      state = await updateRoom(code, room => { ensureDay(room); });
    } else {
      const host = await isHost();
      state = await updateRoom(code, room => mutate(room, input, guest, host));
    }
    return json(snapshot(state, today(), guest, mode()));
  } catch (e) { return failure(e); }
}
