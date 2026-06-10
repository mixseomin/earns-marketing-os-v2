import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/news-copilot/stats — proxies the News Co-pilot usage metrics.
// The upstream URL + token live in server env (NC_STATS_URL / NC_STATS_TOKEN)
// and never reach the browser. Admin-only.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const base = process.env.NC_STATS_URL;
  const tok = process.env.NC_STATS_TOKEN;
  if (!base || !tok) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  try {
    const r = await fetch(`${base.replace(/\/+$/, '')}/stats?t=${encodeURIComponent(tok)}`, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'upstream', status: r.status }, { status: 502 });
    return NextResponse.json(await r.json(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 });
  }
}
