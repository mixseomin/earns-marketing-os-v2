import { NextResponse } from 'next/server';
import { runPublicationMonitor } from '@/lib/publications/monitor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET not set' }, { status: 503 });
  if (req.headers.get('x-cron-secret') !== expected) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? '20');
  const report = await runPublicationMonitor(limit);
  return NextResponse.json({ ok: true, ...report });
}

export async function GET(req: Request) {
  // Allow GET for manual health check (no auth required, just stats)
  const dbUrl = process.env.DATABASE_URL;
  return NextResponse.json({ ok: !!dbUrl, hint: 'POST with x-cron-secret to run monitor' });
}
