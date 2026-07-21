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

  const { domain, action, campaign } = (await req.json().catch(() => ({}))) as { domain?: string; action?: string; campaign?: string };
  const d = (domain || '').trim().toLowerCase();
  const list = await readDomains();
  const row = list.find((x) => x.domain === d);
  if (!row) return NextResponse.json({ error: 'Unknown domain' }, { status: 400 });

  if (action === 'select') {
    // Choose (or clear) which MailWizz campaign is the warm-up email for this domain.
    if (campaign) row.warmupCampaign = campaign; else delete row.warmupCampaign;
  } else if (action === 'stop') {
    delete row.warmupStart;
  } else {
    // start — refuse unless a campaign (the content) is chosen. No content = nothing to send.
    if (!row.warmupCampaign) return NextResponse.json({ error: 'Pick a warm-up campaign first — there is no email content to send' }, { status: 409 });
    row.warmupStart = new Date().toISOString().slice(0, 10);
  }

  await writeDomains(list);
  return NextResponse.json({ ok: true, warmupStart: row.warmupStart || null, warmupCampaign: row.warmupCampaign || null });
}
