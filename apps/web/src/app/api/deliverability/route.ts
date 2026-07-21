import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveTxt } from 'node:dns/promises';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Domains we send from + their DKIM selector. Add a row per sending domain.
const DOMAINS: Array<{ domain: string; dkimSelector: string }> = [
  { domain: 'militarycalc.com', dkimSelector: 'mailer._domainkey' },
];

type Auth = { spf: boolean; spfMailbaby: boolean; dkim: boolean; dmarc: string | null };

async function txt(name: string): Promise<string[]> {
  try {
    return (await resolveTxt(name)).map((r) => r.join(''));
  } catch {
    return [];
  }
}

async function authOf(domain: string, selector: string): Promise<Auth> {
  const [root, dkim, dmarc] = await Promise.all([
    txt(domain),
    txt(`${selector}.${domain}`),
    txt(`_dmarc.${domain}`),
  ]);
  const spfRec = root.find((r) => r.toLowerCase().startsWith('v=spf1')) || '';
  const dmarcRec = dmarc.find((r) => r.toLowerCase().startsWith('v=dmarc1')) || null;
  return {
    spf: !!spfRec,
    spfMailbaby: /spf-c\.mailbaby\.net/i.test(spfRec),
    dkim: dkim.some((r) => /v=DKIM1/i.test(r) && /p=/i.test(r)),
    dmarc: dmarcRec ? (/(p=[a-z]+)/i.exec(dmarcRec)?.[1] ?? 'set') : null,
  };
}

// Google Postmaster Tools trafficStats (domain reputation, spam rate, auth ratios).
// Optional: only runs when a postmaster.readonly refresh token is configured.
type Pm = {
  date: string;
  domainReputation: string | null;
  spamRatio: number | null;
  dkimRatio: number | null;
  spfRatio: number | null;
  dmarcRatio: number | null;
} | null;

let pmAccess: { token: string; exp: number } | null = null;
async function pmToken(): Promise<string | null> {
  const id = process.env.POSTMASTER_CLIENT_ID, secret = process.env.POSTMASTER_CLIENT_SECRET, rt = process.env.POSTMASTER_REFRESH_TOKEN;
  if (!id || !secret || !rt) return null;
  if (pmAccess && pmAccess.exp > Date.now() + 60_000) return pmAccess.token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: 'refresh_token' }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  pmAccess = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return pmAccess.token;
}

async function postmasterOf(domain: string): Promise<Pm> {
  const token = await pmToken();
  if (!token) return null;
  // Latest trafficStats row (list is date-ordered; take the most recent with data).
  const r = await fetch(
    `https://gmailpostmastertools.googleapis.com/v1/domains/${domain}/trafficStats?pageSize=7`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!r.ok) return null;
  const j = await r.json();
  const rows: Array<Record<string, unknown>> = j.trafficStats || [];
  const latest = rows[rows.length - 1];
  if (!latest) return { date: '', domainReputation: null, spamRatio: null, dkimRatio: null, spfRatio: null, dmarcRatio: null };
  const name = String(latest.name || ''); // domains/x/trafficStats/YYYYMMDD
  return {
    date: name.split('/').pop() || '',
    domainReputation: (latest.domainReputation as string) ?? null,
    spamRatio: (latest.userReportedSpamRatio as number) ?? null,
    dkimRatio: (latest.dkimSuccessRatio as number) ?? null,
    spfRatio: (latest.spfSuccessRatio as number) ?? null,
    dmarcRatio: (latest.dmarcSuccessRatio as number) ?? null,
  };
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await Promise.all(
    DOMAINS.map(async (d) => ({
      domain: d.domain,
      auth: await authOf(d.domain, d.dkimSelector),
      postmaster: await postmasterOf(d.domain),
    })),
  );
  const postmasterConfigured = !!(process.env.POSTMASTER_REFRESH_TOKEN);
  return NextResponse.json({ rows, postmasterConfigured }, { headers: { 'Cache-Control': 'no-store' } });
}
