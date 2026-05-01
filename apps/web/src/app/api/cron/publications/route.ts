// POST /api/cron/publications — monitor forum/Reddit/HN posts for new replies.
// Auth: header x-cron-secret matches MOS2_CRON_SECRET.
// Trigger: systemd timer — soft-throttle via cron_jobs.next_run_at.

import { NextResponse } from 'next/server';
import { runPublicationMonitor } from '@/lib/publications/monitor';
import { startRun, finishRun } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET not set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { runId, skipped } = await startRun('publications');
  if (skipped) return NextResponse.json({ ok: true, skipped: true });

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const report = await runPublicationMonitor(limit);
    const hasError = (report as unknown as Record<string, unknown>).errors != null
      && Number((report as unknown as Record<string, unknown>).errors) > 0;
    await finishRun(runId, hasError ? 'error' : 'ok', report as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    await finishRun(runId, 'error', {}, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Allow GET for manual health check (no auth required, just stats)
  const dbUrl = process.env.DATABASE_URL;
  return NextResponse.json({ ok: !!dbUrl, hint: 'POST with x-cron-secret to run monitor' });
}
