import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { registerDomain } from '@/lib/postmaster';
import { readDomains, writeDomains } from '@/lib/domains-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/deliverability/add { domain } — register a domain in Postmaster (v2 create+verify
// via Cloudflare TXT) and add it to the tracked deliverability table. Admin-only.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domain } = (await req.json().catch(() => ({}))) as { domain?: string };
  const d = (domain || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });

  let state = 'UNVERIFIED';
  try {
    ({ state } = await registerDomain(d));
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 160) }, { status: 502 });
  }

  const list = await readDomains();
  if (!list.some((x) => x.domain === d)) {
    list.push({ domain: d, dkimSelector: 'mailer._domainkey', send: false });
    await writeDomains(list);
  }
  return NextResponse.json({ ok: true, domain: d, state });
}
