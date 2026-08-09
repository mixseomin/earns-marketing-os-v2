import { NextResponse } from 'next/server';
import { mailwizzListStats } from '@/lib/mailwizz';

// Số người trong list của MỘT sản phẩm. Đọc live từ MailWizz thay vì chép số vào MOS2: hai nơi giữ
// hai con số thì sớm muộn lệch, và lúc đó không biết tin cái nào.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const uid = new URL(req.url).searchParams.get('uid') || '';
  if (!/^[a-z0-9]{6,32}$/i.test(uid)) return NextResponse.json({ ok: false, error: 'uid sai' }, { status: 400 });
  return NextResponse.json(await mailwizzListStats(uid));
}
