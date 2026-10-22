import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { moHinhMoi } from '@/lib/thanh-pho-ban-luu';

export const dynamic = 'force-dynamic';

// GET /api/social/thanh-pho → { luc, mh } — tab Social › 🏙 Thành phố gọi lại mỗi phút để số trong cảnh là số đang diễn ra (anh 22/10/2026 "các chỉ số cũng là thời gian thực").
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await moHinhMoi());
}
