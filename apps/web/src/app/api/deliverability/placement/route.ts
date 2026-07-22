import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { spawn } from 'node:child_process';
import { readPlacement } from '@/lib/placement-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCRIPT = process.env.PLACEMENT_SCRIPT || '/opt/cgg-report/placement-measure.mjs';

async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin'; }

// GET → saved placement per domain.
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ placement: await readPlacement() });
}

// POST → kick off a fresh measurement across all sending domains (detached; ~2 min, then
// .placement.json updates). Not run on page load — this is the manual/occasional re-check.
export async function POST() {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const child = spawn('/usr/bin/node', [SCRIPT], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 140) }, { status: 500 });
  }
  return NextResponse.json({ started: true, etaSeconds: 130 });
}
