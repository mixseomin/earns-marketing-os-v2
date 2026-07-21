import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/coldmail/stats — proxies MailWizz (Email OS) stats for the coldmail
// project dashboard. Base URL + api key live in server env and never reach the
// browser. Admin-only. MailWizz API auth = X-API-KEY header (no HMAC in v2).
// See reference-mailwizz + master-plan §23 (Làn A).
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const base = process.env.MAILWIZZ_API_URL; // https://mail.on.tc/api/index.php
  const key = process.env.MAILWIZZ_API_KEY;
  const consoleUrl = process.env.MAILWIZZ_CONSOLE_URL || 'https://mail.on.tc/customer';
  if (!base || !key) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const root = base.replace(/\/+$/, '');
  const get = async (path: string) => {
    const r = await fetch(`${root}${path}`, { headers: { 'X-API-KEY': key }, cache: 'no-store' });
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    return (await r.json()).data || {};
  };
  const countOf = async (uid: string, status?: string) => {
    const q = `?page=1&per_page=1${status ? `&status=${status}` : ''}`;
    const d = await get(`/lists/${uid}/subscribers${q}`);
    return Number(d.count) || 0;
  };

  try {
    const listsData = await get('/lists?page=1&per_page=50');
    const records: Array<Record<string, unknown>> = (listsData.records as Array<Record<string, unknown>>) || [];
    const lists = await Promise.all(
      records.map(async (rec) => {
        const g = (rec.general || {}) as Record<string, string>;
        const uid = g.list_uid ?? '';
        const [total, confirmed, unsubscribed] = await Promise.all([
          countOf(uid),
          countOf(uid, 'confirmed'),
          countOf(uid, 'unsubscribed'),
        ]);
        return { id: uid, name: g.name, type: 'list', optin: '', total, confirmed, unconfirmed: total - confirmed - unsubscribed, unsubscribed };
      }),
    );

    let campaigns: Array<Record<string, unknown>> = [];
    try {
      const cd = await get('/campaigns?page=1&per_page=5');
      campaigns = ((cd.records as Array<Record<string, unknown>>) || []).map((c) => ({
        id: c.campaign_uid, name: c.name, status: c.status,
        sent: 0, toSend: 0, views: 0, clicks: 0, bounces: 0, startedAt: c.send_at || null,
      }));
    } catch { /* no campaigns yet */ }

    const totalSubs = lists.reduce((a, l) => a + l.total, 0);
    return NextResponse.json(
      {
        counts: {
          subscribers: { total: totalSubs, blocklisted: 0, orphans: 0 },
          lists: { total: lists.length },
          campaigns: { total: campaigns.length },
          messages: 0,
        },
        lists,
        campaigns,
        consoleUrl,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
