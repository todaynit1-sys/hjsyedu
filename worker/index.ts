import { DurableObject } from 'cloudflare:workers';
import { AppError, ensureDay, mutate, newRoom, snapshot, text, today } from '../lib/domain';
import { MAIN_ROOM_CODE, type Room } from '../lib/types';

interface Env { CLASS_BOARD: DurableObjectNamespace<ClassBoard>; ASSETS: Fetcher; HOST_PASSWORD?: string }
type Session = { purpose: 'host' | 'guest'; id: string; exp: number };
type Connection = { code: string; guest: string | null; exp: number; refreshed?: number };
const encoder = new TextEncoder();
const defaultPasswordHash = 'ed73aa5fbb8f0e9f11bd3d931b066c008c9e92d21531b9de73f5f75b1ac91608';
function base64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decode(value: string): Uint8Array { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
function json(value: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' });
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(JSON.stringify(value), { status, headers });
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('다른 사이트에서 보낸 요청은 허용되지 않습니다.', 403);
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('JSON 요청이 필요합니다.', 415);
  // Stream the bounded body so a forged/missing Content-Length cannot bypass the limit.
  const reader = request.body?.getReader(); if (!reader) throw new AppError('요청 내용을 확인해주세요.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 20_000) { await reader.cancel(); throw new AppError('요청 내용이 너무 큽니다.', 413); } chunks.push(part.value); }
  sameOrigin(request);
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; }
  catch { throw new AppError('요청 내용을 확인해주세요.'); }
}
function cookie(request: Request, purpose: Session['purpose'], token: string, age: number): string {
  return `cb_${purpose}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export function nextMidnight(now = new Date()): number { return Date.parse(`${today(now)}T00:00:00+09:00`) + 86_400_000; }

export class ClassBoard extends DurableObject<Env> {
  private signingKey!: CryptoKey;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      let key = await ctx.storage.get<Uint8Array>('auth-key');
      if (!key) { key = crypto.getRandomValues(new Uint8Array(32)); await ctx.storage.put('auth-key', key); }
      this.signingKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      // getAlarm() is null inside an executing alarm, including its cold constructor.
      // A persisted marker prevents cold starts from postponing that alarm.
      if (!await ctx.storage.get('alarm-initialized')) {
        await ctx.storage.setAlarm(nextMidnight()); await ctx.storage.put('alarm-initialized', true);
      }
    });
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> { const result = this.queue.then(action); this.queue = result.catch(() => {}); return result; }
  private async token(session: Session): Promise<string> { const value = base64(encoder.encode(JSON.stringify(session))); return `${value}.${base64(new Uint8Array(await crypto.subtle.sign('HMAC', this.signingKey, encoder.encode(value))))}`; }
  private async session(request: Request, purpose: Session['purpose']): Promise<Session | null> {
    const value = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`cb_${purpose}=`))?.slice(purpose.length + 4);
    if (!value || value.length > 1000) return null;
    try {
      const [payload, signature, extra] = value.split('.'); if (extra || !signature || !await crypto.subtle.verify('HMAC', this.signingKey, decode(signature), encoder.encode(payload))) return null;
      const result = JSON.parse(new TextDecoder().decode(decode(payload))) as Session;
      return result.purpose === purpose && typeof result.id === 'string' && typeof result.exp === 'number' && result.exp > Date.now() ? result : null;
    } catch { return null; }
  }
  private async room(code: string): Promise<Room> {
    let room = await this.ctx.storage.get<Room>(`room:${code}`);
    if (!room && code === MAIN_ROOM_CODE) { room = newRoom('현준선영 AI 교육'); room.code = MAIN_ROOM_CODE; await this.ctx.storage.put(`room:${code}`, room); }
    if (!room) throw new AppError('강의실을 찾을 수 없습니다. 참여 코드를 확인해주세요.', 404);
    if (!room.days[today()] || Object.keys(room.days).length !== 1) { ensureDay(room); await this.ctx.storage.put(`room:${code}`, room); }
    return room;
  }
  private view(room: Room, guest: string | null, excluding?: WebSocket) {
    const presence = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excluding || ws.readyState !== 1) continue;
      const peer = ws.deserializeAttachment() as Connection;
      if (peer.code === room.code && peer.guest && peer.exp > Date.now()) presence.add(peer.guest);
    }
    return { ...snapshot(room, today(), guest, 'cloud'), online: presence.size };
  }
  private broadcast(room: Room, excluding?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excluding || ws.readyState !== 1) continue;
      const peer = ws.deserializeAttachment() as Connection;
      if (peer.exp <= Date.now()) { ws.close(1008, '다시 참여해주세요.'); continue; }
      if (peer.code !== room.code) continue;
      try { ws.send(JSON.stringify({ type: 'snapshot', data: this.view(room, peer.guest, excluding) })); } catch { /* Closing clients reconnect themselves. */ }
    }
  }
  async fetch(request: Request): Promise<Response> {
    let input: Record<string, unknown> = {};
    try { if (request.method === 'POST') input = await body(request); }
    catch (error) { return json({ error: error instanceof AppError ? error.message : '요청 내용을 확인해주세요.' }, error instanceof AppError ? error.status : 400); }
    return this.exclusive(async () => {
      try {
        const path = new URL(request.url).pathname;
        const host = await this.session(request, 'host'); const guestSession = await this.session(request, 'guest'); let guest = guestSession?.id ?? null;
        if (path === '/api/auth') {
          if (request.method === 'GET') return json({ host: Boolean(host), mode: 'cloud' });
          if (request.method !== 'POST') throw new AppError('지원하지 않는 요청입니다.', 405);
          if (input.type === 'logout') return json({ host: false }, 200, cookie(request, 'host', '', 0));
          const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
          const ip = await digest(request.headers.get('cf-connecting-ip') ?? 'local'); const key = `attempt:${ip}`;
          let attempt = await this.ctx.storage.get<{ count: number; since: number }>(key);
          if (!attempt || Date.now() - attempt.since >= 300_000) attempt = { count: 0, since: Date.now() };
          if (attempt.count >= 8) throw new AppError('로그인 시도가 많습니다. 5분 후 다시 시도해주세요.', 429);
          attempt.count++; await this.ctx.storage.put(key, attempt);
          const expected = this.env.HOST_PASSWORD ? await digest(this.env.HOST_PASSWORD) : defaultPasswordHash;
          if (typeof input.password !== 'string' || await digest(input.password) !== expected) throw new AppError('강사 접속 코드를 확인해주세요.', 401);
          await this.ctx.storage.delete(key);
          return json({ host: true, mode: 'cloud' }, 200, cookie(request, 'host', await this.token({ purpose: 'host', id: crypto.randomUUID(), exp: Date.now() + 43_200_000 }), 43_200));
        }
        if (path === '/api/rooms') {
          if (!host) throw new AppError('강사 로그인이 필요합니다.', 401);
          if (request.method === 'GET') {
            await this.room(MAIN_ROOM_CODE);
            const rooms = [...(await this.ctx.storage.list<Room>({ prefix: 'room:' })).values()];
            rooms.sort((a, b) => Number(b.code === MAIN_ROOM_CODE) - Number(a.code === MAIN_ROOM_CODE));
            return json(rooms.map(r => ({ code: r.code, title: r.title, demo: r.demo })));
          }
          if (request.method !== 'POST') throw new AppError('지원하지 않는 요청입니다.', 405);
          if ((await this.ctx.storage.list({ prefix: 'room:', limit: 100 })).size >= 100) throw new AppError('강의실은 최대 100개까지 만들 수 있습니다.');
          let room = newRoom(text(input.title, '강의 이름', 80));
          while (await this.ctx.storage.get(`room:${room.code}`)) room = newRoom(room.title);
          await this.ctx.storage.put(`room:${room.code}`, room); return json({ code: room.code });
        }
        const match = /^\/api\/rooms\/([A-Z0-9]{6})(\/live)?$/.exec(path);
        if (!match) throw new AppError('요청 주소를 확인해주세요.', 404);
        const code = match[1]; let room = await this.room(code);
        if (match[2]) {
          sameOrigin(request);
          if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') throw new AppError('실시간 연결이 필요합니다.', 426);
          if (!host && !guestSession) throw new AppError('먼저 강의실에 참여해주세요.', 401);
          if (this.ctx.getWebSockets().length >= 256) throw new AppError('접속자가 많습니다. 잠시 후 다시 연결해주세요.', 429);
          const [client, server] = Object.values(new WebSocketPair());
          const auth = host ?? guestSession!;
          server.serializeAttachment({ code, guest: host ? null : guest, exp: auth.exp } satisfies Connection);
          this.ctx.acceptWebSocket(server); this.broadcast(room);
          return new Response(null, { status: 101, webSocket: client });
        }
        if (request.method === 'GET') return json(this.view(room, guest));
        if (request.method !== 'POST') throw new AppError('지원하지 않는 요청입니다.', 405);
        let setCookie: string | undefined;
        if (input.type === 'join') {
          guest ??= crypto.randomUUID();
          setCookie = cookie(request, 'guest', await this.token({ purpose: 'guest', id: guest, exp: Date.now() + 2_592_000_000 }), 2_592_000);
        } else if (input.type === 'start-day') {
          if (!host) throw new AppError('강사 로그인이 필요합니다.', 401);
        } else if (input.type === 'heartbeat') {
          if (!guest) throw new AppError('먼저 강의실에 참여해주세요.', 401);
        } else {
          room = structuredClone(room); mutate(room, input, guest, Boolean(host));
          if (encoder.encode(JSON.stringify(room)).byteLength > 900_000) throw new AppError('오늘 강의실의 저장 한도에 도달했습니다. 메시지를 일부 삭제해주세요.', 409);
          await this.ctx.storage.put(`room:${code}`, room); this.broadcast(room);
        }
        return json(this.view(room, guest), 200, setCookie);
      } catch (error) {
        if (!(error instanceof AppError)) console.error('Classroom request failed', error);
        return json({ error: error instanceof AppError ? error.message : '연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.' }, error instanceof AppError ? error.status : 500);
      }
    });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message !== 'refresh') return;
    await this.exclusive(async () => {
      const peer = ws.deserializeAttachment() as Connection;
      if (peer.exp <= Date.now()) { ws.close(1008, '다시 참여해주세요.'); return; }
      if (peer.refreshed && Date.now() - peer.refreshed < 1000) return;
      peer.refreshed = Date.now(); ws.serializeAttachment(peer);
      this.broadcast(await this.room(peer.code));
    });
  }
  async webSocketClose(ws: WebSocket, code: number) { await this.exclusive(async () => { const peer = ws.deserializeAttachment() as Connection; ws.close(code === 1005 ? 1000 : code); this.broadcast(await this.room(peer.code), ws); }); }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws, 1011); }
  async alarm() {
    await this.exclusive(async () => {
      const rooms = await this.ctx.storage.list<Room>({ prefix: 'room:' });
      for (const [key, room] of rooms) { ensureDay(room); await this.ctx.storage.put(key, room); this.broadcast(room); }
      const attempts = await this.ctx.storage.list<{ since: number }>({ prefix: 'attempt:' });
      for (const [key, value] of attempts) if (Date.now() - value.since >= 300_000) await this.ctx.storage.delete(key);
      await this.ctx.storage.setAlarm(nextMidnight());
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) return env.CLASS_BOARD.getByName('hjsy-class-board').fetch(request);
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
