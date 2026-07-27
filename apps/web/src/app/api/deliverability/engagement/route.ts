import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readEngagement } from '@/lib/engagement-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/deliverability/engagement — militarycalc list engagement summary (tiers + live drip
// stats), read from the box-written .engagement-summary.json. Admin-only.
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await readEngagement();
  return NextResponse.json(data || {}, { headers: { 'Cache-Control': 'no-store' } });
}
