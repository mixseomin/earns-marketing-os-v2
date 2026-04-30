// POST /api/cron/warmup — batch auto-check warmup metrics.
// Auth: header `x-cron-secret` matches MOS2_CRON_SECRET.
// Trigger via systemd timer hoặc external cron.
//
// Curl example:
//   curl -X POST https://mos2.on.tc/api/cron/warmup -H "x-cron-secret: $SECRET"

import { NextResponse } from 'next/server';
import { runAllPendingAutoChecks } from '@/lib/actions/warmup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  const supplied = req.headers.get('x-cron-secret');
  if (supplied !== expected) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const result = await runAllPendingAutoChecks();
  return NextResponse.json(result);
}
