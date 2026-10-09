import { failure, json } from '../../../../lib/security';
import { listRooms } from '../../../../lib/store';
import { today } from '../../../../lib/domain';

export const maxDuration = 60;
let completedDate = '';
let running: Promise<unknown> | undefined;
// An idempotent retention-only task: callers cannot choose dates, rooms or data.
// It never deletes today's content and returns no room or participant information.
export async function GET() {
  try {
    const date = today();
    if (completedDate !== date) {
      running ??= listRooms();
      try { await running; completedDate = date; } finally { running = undefined; }
    }
    return json({ ok: true });
  }
  catch (error) { return failure(error); }
}
