import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readEvents } from '@/lib/warmup-events-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET [?domain=] → warm-up metric events written by the box worker (placement trend, graduation).
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const domain = new URL(req.url).searchParams.get('domain');
  const events = await readEvents();
  return NextResponse.json({ events: domain ? events.filter((e) => e.domain === domain) : events });
}
