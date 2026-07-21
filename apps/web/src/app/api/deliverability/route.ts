import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveTxt } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import { readDomains } from '@/lib/domains-store';
import { trafficStats } from '@/lib/postmaster';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SPAMTEST_FILE = process.env.SPAMTEST_FILE || '/opt/earns-marketing-os-v2/.spamtest.json';

async function txt(name: string): Promise<string[]> {
  try { return (await resolveTxt(name)).map((r) => r.join('')); } catch { return []; }
}
async function authOf(domain: string, selector: string) {
  const [root, dkim, dmarc] = await Promise.all([txt(domain), txt(`${selector}.${domain}`), txt(`_dmarc.${domain}`)]);
  const dmarcRec = dmarc.find((r) => r.toLowerCase().startsWith('v=dmarc1')) || null;
  return {
    spf: root.some((r) => r.toLowerCase().startsWith('v=spf1')),
    dkim: dkim.some((r) => /v=DKIM1/i.test(r) && /p=/i.test(r)),
    dmarc: dmarcRec ? (/(p=[a-z]+)/i.exec(dmarcRec)?.[1]?.replace('p=', '') ?? 'set') : null,
  };
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

  const domains = await readDomains();
  const rows = await Promise.all(
    domains.map(async (d) => ({
      domain: d.domain,
      send: d.send === true,
      warmupStart: d.warmupStart || null,
      auth: await authOf(d.domain, d.dkimSelector || 'mailer._domainkey'),
      postmaster: await trafficStats(d.domain),
      spamTest: await spamTestOf(d.domain),
    })),
  );
  return NextResponse.json(
    { rows, postmasterConfigured: !!process.env.POSTMASTER_REFRESH_TOKEN },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
