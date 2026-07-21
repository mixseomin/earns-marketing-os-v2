import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDomains } from '@/lib/domains-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API = process.env.MAILWIZZ_API_URL || 'https://mail.on.tc/api/index.php';
const KEY = process.env.MAILWIZZ_API_KEY || '';

async function mw(path: string): Promise<any> {
  const r = await fetch(`${API}${path}`, { headers: { 'X-API-KEY': KEY }, cache: 'no-store' });
  const j = await r.json().catch(() => null);
  return j?.status === 'success' ? j.data : null;
}

// GET /api/deliverability/mailwizz?domain= — read-only view of the MailWizz list behind a
// sending domain: params/defaults, merge tags (fields), segments, campaigns. Admin-only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!KEY) return NextResponse.json({ error: 'MailWizz API not configured' }, { status: 503 });

  const d = (req.nextUrl.searchParams.get('domain') || '').trim().toLowerCase();
  const row = (await readDomains()).find((x) => x.domain === d);
  if (!row?.listUid) return NextResponse.json({ error: 'No MailWizz list mapped to this domain' }, { status: 400 });
  const L = row.listUid;

  const [detail, fieldsD, segsD, campsD] = await Promise.all([
    mw(`/lists/${L}`), mw(`/lists/${L}/fields`), mw(`/lists/${L}/segments`), mw(`/campaigns?per_page=50`),
  ]);

  const g = detail?.record?.general || {};
  const def = detail?.record?.defaults || {};
  const co = detail?.record?.company || {};
  const list = {
    uid: L, name: g.display_name || g.name || d, description: g.description || '',
    fromName: def.from_name || null, fromEmail: def.from_email || null,
    replyTo: def.reply_to || null, subject: def.subject || null,
    company: co.address_format || null,
    subscribers: detail?.record?.subscribers_count ?? null,
  };
  const fields = (fieldsD?.records || []).map((f: any) => ({ label: f.label, tag: f.tag, type: f.type?.name || f.type?.identifier || '', required: f.required === 'yes' }));
  const segments = (segsD?.records || []).map((s: any) => ({ uid: s.segment_uid, name: s.name, count: Number(s.subscribers_count) || 0 }));
  const campaigns = (campsD?.records || [])
    .filter((c: any) => !c.list?.list_uid || c.list.list_uid === L)
    .map((c: any) => ({ uid: c.campaign_uid, name: c.name, subject: c.subject, status: c.status, type: c.type, sendAt: c.send_at || null }));

  return NextResponse.json({ list, fields, segments, campaigns }, { headers: { 'Cache-Control': 'no-store' } });
}
