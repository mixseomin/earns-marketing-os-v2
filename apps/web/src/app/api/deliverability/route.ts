import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveTxt } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Sending domains + DKIM selector. Add a row per domain (or subdomain) that sends.
const DOMAINS: Array<{ domain: string; dkimSelector: string }> = [
  { domain: 'militarycalc.com', dkimSelector: 'mailer._domainkey' },
];
const SPAMTEST_FILE = process.env.SPAMTEST_FILE || '/opt/earns-marketing-os-v2/.spamtest.json';

type Auth = { spf: boolean; dkim: boolean; dmarc: string | null };

async function txt(name: string): Promise<string[]> {
  try { return (await resolveTxt(name)).map((r) => r.join('')); } catch { return []; }
}
async function authOf(domain: string, selector: string): Promise<Auth> {
  const [root, dkim, dmarc] = await Promise.all([txt(domain), txt(`${selector}.${domain}`), txt(`_dmarc.${domain}`)]);
  const dmarcRec = dmarc.find((r) => r.toLowerCase().startsWith('v=dmarc1')) || null;
  return {
    spf: root.some((r) => r.toLowerCase().startsWith('v=spf1')),
    dkim: dkim.some((r) => /v=DKIM1/i.test(r) && /p=/i.test(r)),
    dmarc: dmarcRec ? (/(p=[a-z]+)/i.exec(dmarcRec)?.[1]?.replace('p=', '') ?? 'set') : null,
  };
}

// Google Postmaster trafficStats time-series (warm-up curve: reputation + spam rate over days).
let pmAccess: { token: string; exp: number } | null = null;
async function pmToken(): Promise<string | null> {
  const id = process.env.POSTMASTER_CLIENT_ID, secret = process.env.POSTMASTER_CLIENT_SECRET, rt = process.env.POSTMASTER_REFRESH_TOKEN;
  if (!id || !secret || !rt) return null;
  if (pmAccess && pmAccess.exp > Date.now() + 60_000) return pmAccess.token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: 'refresh_token' }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  pmAccess = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return pmAccess.token;
}
type PmPoint = { date: string; reputation: string | null; spam: number | null; dkim: number | null; spf: number | null; dmarc: number | null };
async function postmasterOf(domain: string): Promise<PmPoint[] | null> {
  const token = await pmToken();
  if (!token) return null;
  const r = await fetch(`https://gmailpostmastertools.googleapis.com/v1/domains/${domain}/trafficStats?pageSize=30`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!r.ok) return []; // registered but no data yet (needs volume) => empty series
  const j = await r.json();
  return ((j.trafficStats as Array<Record<string, unknown>>) || []).map((s) => ({
    date: String(s.name || '').split('/').pop() || '',
    reputation: (s.domainReputation as string) ?? null,
    spam: (s.userReportedSpamRatio as number) ?? null,
    dkim: (s.dkimSuccessRatio as number) ?? null,
    spf: (s.spfSuccessRatio as number) ?? null,
    dmarc: (s.dmarcSuccessRatio as number) ?? null,
  }));
}

async function spamTestOf(domain: string): Promise<Array<Record<string, unknown>> | null> {
  try {
    const store = JSON.parse(await readFile(SPAMTEST_FILE, 'utf8'));
    return Array.isArray(store[domain]) ? store[domain] : null;
  } catch { return null; }
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await Promise.all(
    DOMAINS.map(async (d) => ({
      domain: d.domain,
      auth: await authOf(d.domain, d.dkimSelector),
      postmaster: await postmasterOf(d.domain),
      spamTest: await spamTestOf(d.domain),
    })),
  );
  return NextResponse.json(
    { rows, postmasterConfigured: !!process.env.POSTMASTER_REFRESH_TOKEN },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
