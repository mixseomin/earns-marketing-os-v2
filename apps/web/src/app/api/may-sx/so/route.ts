import { NextResponse } from 'next/server';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docViecSx } from '@/lib/may-sx/gom';
import { docSoKieu } from '@/lib/may-sx/so-kieu';

export const dynamic = 'force-dynamic';

// TAB MÁY SX (anh 11/11/2026 "máy sx đã cho lên mos2 chưa") — sổ lượt dựng may_sx_luot (apps/xuong-video/scripts/sx-may.mjs tự tạo bảng
// và ghi mỗi bài một dòng: 'dang' lúc bắt đầu, 'xong'/'hong' lúc kết thúc) + việc sản xuất GOM từ mọi nguồn (lib/may-sx/gom.ts). Chỉ admin.
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const eff = await getEffectiveUser(); if (eff?.role !== 'admin') return NextResponse.json({ error: 'chỉ admin' }, { status: 403 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const ngay = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get('ngay') ?? 7)));
  const loi: string[] = [];
  const luot = (await d.execute(sql`SELECT id, luc::text AS luc, may, slug, kieu, ngay_dang, ok, coalesce(trang_thai, CASE WHEN ok THEN 'xong' ELSE 'hong' END) AS trang_thai, vnd, ghi, loi, tep FROM may_sx_luot
    WHERE luc > now() - make_interval(days => ${ngay}) ORDER BY luc DESC LIMIT 500`).catch((e: Error) => { loi.push(`sổ lượt: ${e.message.slice(0, 120)}`); return []; })) as unknown as Record<string, unknown>[];
  // GOM mọi nguồn sản xuất (anh 11/11/2026) — nguồn hỏng ghi vào loi, không làm hỏng cả tab
  const gom = await docViecSx().catch((e: Error) => ({ viec: [], loi: [`gom sản xuất: ${e.message.slice(0, 120)}`] }));
  // tên dạng bài lấy từ SỔ (kieu-sx.json) — trang không tự gõ nhãn
  let so: ReturnType<typeof docSoKieu> = {}; try { so = docSoKieu(); } catch (e) { loi.push(`sổ dạng bài: ${(e as Error).message}`); }
  return NextResponse.json({ luot: luot.map((x) => ({ ...x, kieu_ten: x.kieu ? so[String(x.kieu)]?.ten ?? String(x.kieu) : null })), viec: gom.viec, loi: [...loi, ...gom.loi], luc: new Date().toISOString() });
}
