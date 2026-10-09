import 'server-only';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { AppError } from './domain';
function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AppError('강사 인증 설정이 필요합니다.', 503);
  return value;
}
function sign(value: string): string { return createHmac('sha256', secret()).update(value).digest('base64url'); }
function token(purpose: string, id: string, seconds: number): string {
  const value = Buffer.from(JSON.stringify({ purpose, id, exp: Date.now() + seconds * 1000 })).toString('base64url');
  return `${value}.${sign(value)}`;
}
function verify(value: string | undefined, purpose: string): string | null {
  if (!value) return null;
  try {
    const [body, signature] = value.split('.');
    const a = Buffer.from(signature ?? ''); const b = Buffer.from(sign(body));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString());
    return decoded.purpose === purpose && decoded.exp > Date.now() && typeof decoded.id === 'string' ? decoded.id : null;
  } catch { return null; }
}
export async function isHost(): Promise<boolean> { return Boolean(verify((await cookies()).get('cb_host')?.value, 'host')); }
export async function requireHost(): Promise<void> { if (!await isHost()) throw new AppError('강사 로그인이 필요합니다.', 401); }
export async function guestId(): Promise<string | null> { return verify((await cookies()).get('cb_guest')?.value, 'guest'); }
export async function joinGuest(): Promise<string> {
  const existing = await guestId();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set('cb_guest', token('guest', id, 30 * 86400), { httpOnly: true, secure: Boolean(process.env.VERCEL), sameSite: 'strict', path: '/', maxAge: 30 * 86400 });
  return id;
}
export async function login(password: unknown): Promise<void> {
  const expected = process.env.HOST_PASSWORD;
  if (!expected || expected.length < 12) throw new AppError('12자 이상의 강사 비밀번호를 설정해주세요.', 503);
  if (typeof password !== 'string' || !timingSafeEqual(createHash('sha256').update(password).digest(), createHash('sha256').update(expected).digest())) throw new AppError('비밀번호가 맞지 않습니다.', 401);
  (await cookies()).set('cb_host', token('host', 'teacher', 12 * 3600), { httpOnly: true, secure: Boolean(process.env.VERCEL), sameSite: 'strict', path: '/', maxAge: 12 * 3600 });
}
export async function logout(): Promise<void> { (await cookies()).delete('cb_host'); }
export async function body(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin) {
    const source = new URL(origin);
    const host = request.headers.get('host') ?? new URL(request.url).host;
    if (source.host !== host || !['http:', 'https:'].includes(source.protocol)) throw new AppError('허용되지 않은 요청입니다.', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('허용되지 않은 요청입니다.', 403);
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AppError('JSON 요청이 필요합니다.', 415);
  const raw = await request.text();
  if (raw.length > 20_000) throw new AppError('입력 내용이 너무 깁니다.', 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new AppError('입력 내용을 확인해주세요.'); }
}
export function failure(error: unknown): Response {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('Class Board request failed:', error instanceof Error ? error.name : 'unknown');
  return Response.json({ error: '연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
}
export function json(value: unknown): Response { return Response.json(value, { headers: { 'Cache-Control': 'no-store' } }); }
