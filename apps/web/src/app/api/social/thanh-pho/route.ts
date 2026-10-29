import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readFileSync } from 'node:fs';
import { moHinhNhanh } from '@/lib/thanh-pho-ban-luu';

const BAN_DUNG = (() => { try { return readFileSync(`${process.cwd()}/.next/BUILD_ID`, 'utf8').trim(); } catch { return ''; } })();

export const dynamic = 'force-dynamic';

// GET /api/social/thanh-pho → { luc, mh } — tab Social › 🏙 Thành phố gọi lại mỗi phút để số trong cảnh là số đang diễn ra (anh 22/10/2026 "các chỉ số cũng là thời gian thực").
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // x-ban-dung = mã bản build đang chạy: city thấy đổi thì tự tải lại lúc anh không thao tác (tab cũ sau deploy gọi server action là chết — góp ý #1454)
  return NextResponse.json(await moHinhNhanh(), { headers: { 'x-ban-dung': BAN_DUNG } });
}
