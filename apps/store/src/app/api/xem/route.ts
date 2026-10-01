// POST /api/xem {sp, p} — nhịp "đang xem" (đếm thật, lib/xem.ts).
import { NextResponse } from 'next/server';
import { nhipXem } from '@/lib/xem';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { sp?: number; p?: string };
  if (!b.sp || !b.p) return NextResponse.json({ so: 0 });
  return NextResponse.json({ so: nhipXem(Number(b.sp), String(b.p)) });
}
