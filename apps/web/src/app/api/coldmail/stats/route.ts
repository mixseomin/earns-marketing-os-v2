import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/coldmail/stats — proxies Listmonk (Email OS) stats for the coldmail
// project dashboard. Base URL + api creds live in server env and never reach
// the browser. Admin-only. See reference-listmonk + master-plan §23 (Làn A).
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const base = process.env.LISTMONK_API_URL;
  const user = process.env.LISTMONK_API_USER;
  const tok = process.env.LISTMONK_API_TOKEN;
  if (!base || !user || !tok) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const root = base.replace(/\/+$/, '');
  const auth = 'Basic ' + Buffer.from(`${user}:${tok}`).toString('base64');
  const get = async (path: string) => {
    const r = await fetch(`${root}${path}`, { headers: { Authorization: auth }, cache: 'no-store' });
    if (!r.ok) throw new Error(`${path} ${r.status}`);
    return (await r.json()).data;
  };

  try {
    const [counts, lists, campaigns] = await Promise.all([
      get('/api/dashboard/counts'),
      get('/api/lists?per_page=100'),
      get('/api/campaigns?per_page=5'),
    ]);
    return NextResponse.json(
      {
        counts,
        lists: (lists.results || []).map((l: Record<string, unknown>) => {
          const st = (l.subscriber_statuses || {}) as Record<string, number>;
          return {
            id: l.id, name: l.name, type: l.type, optin: l.optin,
            total: l.subscriber_count,
            confirmed: st.confirmed || 0,
            unconfirmed: st.unconfirmed || 0,
            unsubscribed: st.unsubscribed || 0,
          };
        }),
        campaigns: (campaigns.results || []).map((c: Record<string, unknown>) => ({
          id: c.id, name: c.name, status: c.status,
          sent: c.sent, toSend: c.to_send, views: c.views, clicks: c.clicks, bounces: c.bounces,
          startedAt: c.started_at,
        })),
        listmonkUrl: root,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
