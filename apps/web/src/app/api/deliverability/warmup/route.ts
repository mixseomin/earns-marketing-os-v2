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

  const { domain, action, campaign, config } = (await req.json().catch(() => ({}))) as { domain?: string; action?: string; campaign?: string; config?: { channel?: string; mjListId?: string; fromEmail?: string } };
  const d = (domain || '').trim().toLowerCase();
  const list = await readDomains();
  const row = list.find((x) => x.domain === d);
  if (!row) return NextResponse.json({ error: 'Unknown domain' }, { status: 400 });

  if (action === 'select') {
    // Choose (or clear) which MailWizz campaign is the warm-up email for this domain.
    if (campaign) row.warmupCampaign = campaign; else delete row.warmupCampaign;
  } else if (action === 'stop') {
    delete row.warmupStart;
  } else if (action === 'auto-on') {
    // Hand the ramp to the box worker: it advances the schedule, engages seeds, graduates.
    row.autoWarm = true;
    delete row.graduatedAt;
    if (!row.warmupStart) row.warmupStart = new Date().toISOString().slice(0, 10);
  } else if (action === 'auto-off') {
    row.autoWarm = false;
  } else if (action === 'config') {
    if (config?.channel === 'mailjet' || config?.channel === 'mailwizz') row.channel = config.channel;
    if (config?.mjListId !== undefined) { const v = config.mjListId.trim(); if (v) row.mjListId = v; else delete row.mjListId; }
    if (config?.fromEmail !== undefined) { const v = config.fromEmail.trim(); if (v) row.fromEmail = v; else delete row.fromEmail; }
  } else {
    // start — refuse unless a campaign (the content) is chosen. No content = nothing to send.
    if (!row.warmupCampaign) return NextResponse.json({ error: 'Pick a warm-up campaign first — there is no email content to send' }, { status: 409 });
    row.warmupStart = new Date().toISOString().slice(0, 10);
  }

  await writeDomains(list);
  return NextResponse.json({ ok: true, warmupStart: row.warmupStart || null, warmupCampaign: row.warmupCampaign || null, autoWarm: !!row.autoWarm, graduatedAt: row.graduatedAt || null });
}
