// POST /api/cron/worker — execute 1 batch của agent runtime cycle.
// Auth: header x-cron-secret matches MOS2_CRON_SECRET.
// Trigger: systemd timer (every 5 min suggested) hoặc external cron.

import { NextResponse } from 'next/server';
import { runWorkerCycle } from '@/lib/worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;  // 5 min cap

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const maxCards = Number(url.searchParams.get('limit') ?? '5');
  const report = await runWorkerCycle(maxCards);
  return NextResponse.json({ ok: true, ...report });
}
