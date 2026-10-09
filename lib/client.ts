export async function api<T>(path: string, input?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: input ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {}),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '요청을 완료하지 못했습니다.');
  return data;
}
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
}
export function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date(value));
}
