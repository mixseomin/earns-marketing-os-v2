import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDomains, writeDomains } from '@/lib/domains-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/deliverability/warmup { domain, action:'start'|'stop' } — stamp/clear the warm-up
// start date (UTC) for a sending domain. The calendar strip is computed from it client-side.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domain, action } = (await req.json().catch(() => ({}))) as { domain?: string; action?: string };
  const d = (domain || '').trim().toLowerCase();
  const list = await readDomains();
  const row = list.find((x) => x.domain === d);
  if (!row) return NextResponse.json({ error: 'Unknown domain' }, { status: 400 });

  if (action === 'stop') delete row.warmupStart;
  else row.warmupStart = new Date().toISOString().slice(0, 10);

  await writeDomains(list);
  return NextResponse.json({ ok: true, warmupStart: row.warmupStart || null });
}
