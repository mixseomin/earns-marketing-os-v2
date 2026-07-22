import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Which Mailjet contact list backs each site's Subs count (mirrors /opt/cgg-report/subs-pull.mjs).
// Add a domain here when it starts collecting emails into a Mailjet list.
const MJ_LISTS: Record<string, number> = {
  'militarycalc.com': 10625921,
  'govcalcs.com': 10626752,
  'visagps.com': 10626531,
  'mintalmanac.com': 10626754,
};

const PAGE = 50;

// GET ?domain=&offset= — the actual contacts behind a site's Subs number (Mailjet list). Admin-only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = process.env.MAILJET_API_KEY, secret = process.env.MAILJET_SECRET;
  if (!key || !secret) return NextResponse.json({ error: 'Mailjet not configured' }, { status: 503 });

  const domain = (req.nextUrl.searchParams.get('domain') || '').trim().toLowerCase();
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') || 0));
  const listId = MJ_LISTS[domain];
  if (!listId) return NextResponse.json({ error: `No contact list mapped for ${domain}` }, { status: 400 });

  const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
  const [countR, listR] = await Promise.all([
    fetch(`https://api.mailjet.com/v3/REST/contactslist/${listId}`, { headers: { Authorization: auth }, cache: 'no-store' }),
    fetch(`https://api.mailjet.com/v3/REST/contact?ContactsList=${listId}&Limit=${PAGE}&Offset=${offset}&Sort=CreatedAt+DESC`, { headers: { Authorization: auth }, cache: 'no-store' }),
  ]);
  const countJ = await countR.json().catch(() => null);
  const listJ = await listR.json().catch(() => null);
  if (!listR.ok) return NextResponse.json({ error: listJ?.ErrorMessage || 'Mailjet error' }, { status: 502 });

  const total = countJ?.Data?.[0]?.SubscriberCount ?? null;
  const contacts = (listJ?.Data || []).map((c: any) => ({
    email: c.Email, name: c.Name || '', createdAt: c.CreatedAt || null,
    excluded: c.IsExcludedFromCampaigns === true, unsubbed: c.IsUnsubscribed === true,
  }));
  return NextResponse.json({ total, offset, pageSize: PAGE, contacts, source: 'mailjet', listId }, { headers: { 'Cache-Control': 'no-store' } });
}
