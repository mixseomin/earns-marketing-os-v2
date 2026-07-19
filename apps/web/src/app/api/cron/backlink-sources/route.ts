// POST /api/cron/backlink-sources — weekly catalog freshness check. Re-resolves every active
// backlink_sources.canonical_url; a clear 404/410 demotes to 'broken', a resurrected URL self-heals.
// Auth: header `x-cron-secret` == MOS2_CRON_SECRET. Trigger via a weekly systemd timer.
//
//   curl -X POST https://mos2.on.tc/api/cron/backlink-sources -H "x-cron-secret: $SECRET"

import { NextResponse } from 'next/server';
import { verifyBacklinkSources } from '@/lib/actions/backlink-catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected)
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const r = await verifyBacklinkSources();
  return NextResponse.json(r);
}
