import { body, failure, isHost, json, login, logout } from '../../../lib/security';
import { mode } from '../../../lib/store';
const attempts = new Map<string, { count: number; since: number }>();
export async function GET() { try { return json({ host: await isHost(), mode: mode() }); } catch (e) { return failure(e); } }
export async function POST(request: Request) {
  try {
    const data = await body(request);
    if (data.type === 'logout') { await logout(); return json({ host: false }); }
    const key = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
    const previous = attempts.get(key);
    const entry = previous && Date.now() - previous.since < 300_000 ? previous : { count: 0, since: Date.now() };
    if (entry.count >= 8) return Response.json({ error: '로그인 시도가 많습니다. 5분 후 다시 시도해주세요.' }, { status: 429 });
    entry.count++; attempts.set(key, entry);
    if (attempts.size > 5000) for (const [ip, value] of attempts) if (Date.now() - value.since > 300_000) attempts.delete(ip);
    await login(data.password); attempts.delete(key);
    return json({ host: true, mode: mode() });
  } catch (e) { return failure(e); }
}
