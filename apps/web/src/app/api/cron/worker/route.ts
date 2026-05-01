// POST /api/cron/worker — execute 1 batch của agent runtime cycle.
// Auth: header x-cron-secret matches MOS2_CRON_SECRET.
// Trigger: systemd timer (every 1-5 min) — soft-throttle via cron_jobs.next_run_at.

import { NextResponse } from 'next/server';
import { runWorkerCycle } from '@/lib/worker';
import { startRun, finishRun } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;  // 5 min cap

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { runId, skipped } = await startRun('worker');
  if (skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const url = new URL(req.url);
    const maxCards = Number(url.searchParams.get('limit') ?? '5');
    const report = await runWorkerCycle(maxCards);
    await finishRun(runId, report.failed > 0 ? 'error' : 'ok', report as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    await finishRun(runId, 'error', {}, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
