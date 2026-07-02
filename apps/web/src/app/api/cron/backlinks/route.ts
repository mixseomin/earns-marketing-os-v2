// POST /api/cron/backlinks — weekly link-rot re-check. Re-verifies every placed backlink
// across all projects; a link whose page still loads but no longer contains our link is
// demoted to 'broken' (see persistVerify), so the backlink count stops silently lying.
// Auth: header `x-cron-secret` == MOS2_CRON_SECRET. Trigger via a weekly systemd timer.
//
//   curl -X POST https://mos2.on.tc/api/cron/backlinks -H "x-cron-secret: $SECRET"

import { NextResponse } from 'next/server';
import { listProjects } from '@mos2/db';
import { verifyAllBacklinks } from '@/lib/actions/architecture';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// ponytail: checks run sequentially with a 20s per-link timeout. Fine for a solo portfolio's
// dozens of links; if it ever exceeds this, batch or parallelize verifyAllBacklinks.
export const maxDuration = 300;

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected)
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const projects = (await listProjects()) ?? [];
  let checked = 0, broken = 0;
  const per: Record<string, { checked: number; broken: number }> = {};
  for (const p of projects) {
    const host = (p.website || '').trim();
    // need a target host to look for, and a slug-safe site key (the jsonb per-site key = project id)
    if (!host || !/^[a-z0-9_-]+$/.test(p.id)) continue;
    const r = await verifyAllBacklinks(p.id, host);
    if (r.ok && (r.checked ?? 0) > 0) {
      checked += r.checked ?? 0;
      broken += r.broken ?? 0;
      per[p.id] = { checked: r.checked ?? 0, broken: r.broken ?? 0 };
    }
  }
  return NextResponse.json({ ok: true, checked, broken, per });
}
