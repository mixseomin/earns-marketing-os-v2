import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API = process.env.MAILWIZZ_API_URL || 'https://mail.on.tc/api/index.php';
const KEY = process.env.MAILWIZZ_API_KEY || '';

// GET ?list=<uid> — a sample of real subscribers with their field values, so a campaign can be
// previewed "as" a specific contact (merge tags filled). Also returns the list's CAN-SPAM address
// for [COMPANY_FULL_ADDRESS]. Admin-only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!KEY) return NextResponse.json({ error: 'MailWizz API not configured' }, { status: 503 });

  const list = (req.nextUrl.searchParams.get('list') || '').trim();
  if (!list) return NextResponse.json({ error: 'Missing list uid' }, { status: 400 });

  const [subsR, detailR] = await Promise.all([
    fetch(`${API}/lists/${list}/subscribers?per_page=25`, { headers: { 'X-API-KEY': KEY }, cache: 'no-store' }),
    fetch(`${API}/lists/${list}`, { headers: { 'X-API-KEY': KEY }, cache: 'no-store' }),
  ]);
  const subsJ = await subsR.json().catch(() => null);
  const detailJ = await detailR.json().catch(() => null);
  if (subsJ?.status !== 'success') return NextResponse.json({ error: 'Mailwizz error' }, { status: 502 });

  const SYS = new Set(['subscriber_uid', 'status', 'source', 'ip_address', 'date_added']);
  const contacts = (subsJ.data?.records || []).map((r: any) => {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) if (!SYS.has(k) && k === k.toUpperCase()) fields[k] = String(v ?? '');
    return { uid: r.subscriber_uid, email: r.EMAIL, status: r.status, fields };
  });
  const company = detailJ?.data?.record?.company?.address_format || null;
  return NextResponse.json({ contacts, company }, { headers: { 'Cache-Control': 'no-store' } });
}
