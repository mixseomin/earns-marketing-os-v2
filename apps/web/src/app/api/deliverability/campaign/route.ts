import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDomains } from '@/lib/domains-store';
import { saveCampaign } from '@/lib/campaigns-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API = process.env.MAILWIZZ_API_URL || 'https://mail.on.tc/api/index.php';
const KEY = process.env.MAILWIZZ_API_KEY || '';

// A genuine, low-key warm-up email so early sends don't trigger unsubscribes. English only
// (public content). Required MailWizz tags [UNSUBSCRIBE_URL] + [COMPANY_FULL_ADDRESS] included.
function defaultBody(brand: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:560px;margin:0 auto">
<p>Hi there,</p>
<p>Thanks for subscribing to <strong>${brand}</strong>. You'll get occasional, useful updates — new tools, pay and benefit changes, and the odd tip worth your time. No spam, and never more than you signed up for.</p>
<p>Glad to have you here.</p>
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

  const html = (body && body.trim()) || defaultBody(brand);
  const name = `Warm-up — ${d}`;
  const subj = (subject && subject.trim()) || `Welcome to ${brand}`;
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
