import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readDomains } from '@/lib/domains-store';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCRIPT = process.env.MAILTESTER_SCRIPT || '/opt/cgg-report/mailtester-check.mjs';

// POST /api/deliverability/test { domain } — kick off an on-demand mail-tester run for one
// send-capable domain (detached; result lands in .spamtest.json ~90s later). Admin-only.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domain } = (await req.json().catch(() => ({}))) as { domain?: string };
  const d = (domain || '').trim().toLowerCase();

  const known = (await readDomains()).find((x) => x.domain === d);
  if (!known) return NextResponse.json({ error: 'Unknown domain' }, { status: 400 });
  if (!(known.send && known.listUid)) {
    return NextResponse.json({ error: 'Not set up for sending — spam-test needs a send path from this domain' }, { status: 409 });
  }

  try {
    const child = spawn('/usr/bin/node', [SCRIPT, `--only=${d}`], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 140) }, { status: 500 });
  }
  return NextResponse.json({ started: true, etaSeconds: 95 });
}
