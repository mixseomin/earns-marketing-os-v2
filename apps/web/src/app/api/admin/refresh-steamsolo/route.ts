import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';

// Bust just the SteamSolo dashboard feed cache (its own tag) so the panel re-pulls fresh
// engagement/demand from steamsolo.com. No services to run — the data is live in steamsolo's DB.
export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  revalidateTag('steamsolo-stats');
  return NextResponse.json({ ok: true });
}
