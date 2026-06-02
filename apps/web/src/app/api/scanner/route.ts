import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getScannerData } from '@/lib/arb-scanner';

export const dynamic = 'force-dynamic';

// GET /api/scanner — live cross-exchange arbitrage opportunities (session-gated).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await getScannerData();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'scanner_failed' }, { status: 502 });
  }
}
