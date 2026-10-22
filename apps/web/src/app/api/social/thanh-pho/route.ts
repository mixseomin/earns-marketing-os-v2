import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSocialLive } from '@/lib/social-traffic';
import { tinhThanhPho } from '@/lib/social-thanh-pho';

export const dynamic = 'force-dynamic';

// GET /api/social/thanh-pho → { luc, mh } — tab Social › 🏙 Thành phố gọi lại mỗi phút để số trong cảnh là số đang diễn ra (anh 22/10/2026 "các chỉ số cũng là thời gian thực").
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const live = await getSocialLive();
  return NextResponse.json({ luc: live.luc, mh: tinhThanhPho(live) });
}
