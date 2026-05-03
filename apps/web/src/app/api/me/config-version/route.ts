import { NextResponse } from 'next/server';
import { getMyConfigVersion } from '@/lib/actions/visibility';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = await getMyConfigVersion();
  return NextResponse.json({ version });
}
