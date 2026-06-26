// POST /api/cron/outreach — send due follow-ups + a paced batch of fresh cold pitches.
// Auth: header `x-cron-secret` matches MOS2_CRON_SECRET. Trigger via systemd timer.
//
//   curl -X POST https://mos2.on.tc/api/cron/outreach -H "x-cron-secret: $SECRET"

import { NextResponse } from 'next/server';
import { runOutreachCron } from '@/lib/actions/outreach-cron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected)
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const result = await runOutreachCron();
  return NextResponse.json(result);
}
