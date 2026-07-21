import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDomains, writeDomains } from '@/lib/domains-store';
import { saveCampaign, deleteCampaign } from '@/lib/campaigns-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API = process.env.MAILWIZZ_API_URL || 'https://mail.on.tc/api/index.php';
const KEY = process.env.MAILWIZZ_API_KEY || '';

// A value-first warm-up email (NOT a "welcome" — subscribers already know the brand from an
// earlier send). One genuine CTA link so clicks — the strongest warm-up signal — are measurable
// via MailWizz tracking. English only (public content). Required MailWizz tags included.
function defaultBody(brand: string, site: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:560px;margin:0 auto">
<p>Hi there,</p>
<p>Quick reminder while you're thinking about your military pay and benefits: every calculator on <strong>${brand}</strong> is free, takes under a minute, and needs no sign-up.</p>
<p>Checking BAH, base pay, or planning a PCS move — it's all in one place, kept current.</p>
<p style="margin:22px 0"><a href="${site}" style="background:#1D1F27;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;display:inline-block">Open the calculators →</a></p>
<p>We only email when there's something genuinely worth your time. Thanks for reading.</p>
<p>— The ${brand} team</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#888">You're receiving this because you subscribed at ${brand}. <a href="[UNSUBSCRIBE_URL]" style="color:#888">Unsubscribe</a>.<br>[COMPANY_FULL_ADDRESS]</p>
</div>`;
}

// POST /api/deliverability/campaign { domain, subject?, body? } — create a DRAFT MailWizz
// campaign (the warm-up email) for the domain's list. Never sends. Admin-only.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!KEY) return NextResponse.json({ error: 'MailWizz API not configured' }, { status: 503 });

  const { domain, subject, body } = (await req.json().catch(() => ({}))) as { domain?: string; subject?: string; body?: string };
  const d = (domain || '').trim().toLowerCase();
  const row = (await readDomains()).find((x) => x.domain === d);
  if (!row?.listUid) return NextResponse.json({ error: 'No MailWizz list mapped to this domain' }, { status: 400 });

  // Pull the list's sending defaults so the campaign inherits the right aligned From/Reply-To.
  const listR = await fetch(`${API}/lists/${row.listUid}`, { headers: { 'X-API-KEY': KEY }, cache: 'no-store' });
  const listJ = await listR.json().catch(() => null);
  const def = listJ?.data?.record?.defaults || {};
  const brand = listJ?.data?.record?.general?.display_name || listJ?.data?.record?.general?.name || d;
  const fromEmail = def.from_email;
  if (!fromEmail) return NextResponse.json({ error: 'List has no default from-email set in MailWizz' }, { status: 400 });

  const site = `https://${d.split('.').slice(-2).join('.')}`; // root site, e.g. news.x.com → https://x.com
  const html = (body && body.trim()) || defaultBody(brand, site);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' '); // so multiple drafts differ
  const name = `Warm-up ${stamp} — ${d}`;
  const subj = (subject && subject.trim()) || `A quick tip from ${brand}`;
  const fromName = def.from_name || brand;
  const form = new URLSearchParams();
  form.set('campaign[name]', name);
  form.set('campaign[type]', 'regular');
  form.set('campaign[from_name]', fromName);
  form.set('campaign[from_email]', fromEmail);
  form.set('campaign[reply_to]', def.reply_to || fromEmail);
  form.set('campaign[subject]', subj);
  form.set('campaign[send_at]', '2030-01-01 00:00:00'); // far future → never auto-sends; you send deliberately
  form.set('campaign[list_uid]', row.listUid);
  form.set('campaign[template][content]', Buffer.from(html, 'utf8').toString('base64')); // MailWizz expects base64

  const r = await fetch(`${API}/campaigns`, { method: 'POST', headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  const j = await r.json().catch(() => null);
  if (j?.status !== 'success') {
    return NextResponse.json({ error: j?.error?.content || j?.error || 'MailWizz rejected the campaign' }, { status: 502 });
  }
  const uid = j.data?.campaign_uid || j.campaign_uid || null;
  if (uid) await saveCampaign(uid, { name, subject: subj, fromName, fromEmail, html });
  return NextResponse.json({ ok: true, uid });
}

// DELETE /api/deliverability/campaign?uid= — remove a draft from MailWizz (source of truth),
// then mirror the removal locally. Admin-only.
export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!KEY) return NextResponse.json({ error: 'MailWizz API not configured' }, { status: 503 });

  const uid = (req.nextUrl.searchParams.get('uid') || '').trim();
  if (!uid) return NextResponse.json({ error: 'Missing campaign uid' }, { status: 400 });

  const r = await fetch(`${API}/campaigns/${uid}`, { method: 'DELETE', headers: { 'X-API-KEY': KEY } });
  const j = await r.json().catch(() => null);
  if (j?.status !== 'success') return NextResponse.json({ error: j?.error || 'MailWizz refused to delete' }, { status: 502 });

  await deleteCampaign(uid);
  const list = await readDomains();
  let touched = false;
  for (const row of list) if (row.warmupCampaign === uid) { delete row.warmupCampaign; delete row.warmupStart; touched = true; }
  if (touched) await writeDomains(list);
  return NextResponse.json({ ok: true });
}
