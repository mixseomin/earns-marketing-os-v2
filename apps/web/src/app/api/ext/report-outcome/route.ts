import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { reportSourceOutcome, type OutcomeInput } from '@/lib/actions/backlink-catalog';

export const dynamic = 'force-dynamic';

// POST /api/ext/report-outcome — the self-learning loop's write path (see reportSourceOutcome).
// After running a backlink task, the agent reports the outcome; knowledge lands on the SOURCE (root)
// so every project's task learns it. Called by ~/bin/play outcome and by in-chat automation.
interface Body {
  taskId?: number;
  status?: OutcomeInput['status'];
  automation?: OutcomeInput['automation'];
  obstacle?: OutcomeInput['obstacle'];
  runbookPatch?: string;
  note?: string;
}

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const body = (await req.json().catch(() => ({}))) as Body;
  const taskId = Number(body.taskId);
  if (!taskId || !body.status) return errorResponse('taskId + status required', 400);
  const r = await reportSourceOutcome(taskId, {
    status: body.status,
    automation: body.automation,
    obstacle: body.obstacle,
    runbookPatch: body.runbookPatch,
    note: body.note,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
