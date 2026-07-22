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
  // Check the configured selector plus the two common ones — a domain may sign via Mailjet
  // (mailjet._domainkey) or MailWizz (mailer._domainkey) regardless of what's stored.
  const selectors = Array.from(new Set([selector || 'mailer._domainkey', 'mailjet._domainkey', 'mailer._domainkey']));
  const [root, dmarc, ...dkimSets] = await Promise.all([txt(domain), txt(`_dmarc.${domain}`), ...selectors.map((s) => txt(`${s}.${domain}`))]);
  const dmarcRec = dmarc.find((r) => r.toLowerCase().startsWith('v=dmarc1')) || null;
  return {
    spf: root.some((r) => r.toLowerCase().startsWith('v=spf1')),
    // A published DKIM key = any selector carrying a non-empty p= (Mailjet omits the optional v=DKIM1 tag).
    dkim: dkimSets.flat().some((r) => /(^|;|\s)p=[A-Za-z0-9+/]/i.test(r)),
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
      warmupCampaign: d.warmupCampaign || null,
      listUid: d.listUid || null,
      autoWarm: d.autoWarm === true,
      graduatedAt: d.graduatedAt || null,
      channel: d.channel || 'mailjet',
      mjListId: d.mjListId || null,
      fromEmail: d.fromEmail || null,
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
