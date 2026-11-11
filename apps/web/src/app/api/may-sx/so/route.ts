import { NextResponse } from 'next/server';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// TAB MÁY SX (anh 11/11/2026 "máy sx đã cho lên mos2 chưa") — sổ lượt dựng may_sx_luot (apps/xuong-video/scripts/sx-may.mjs tự tạo bảng
// và ghi mỗi bài một dòng) + HÀNG CHỜ: bài đã có ngày đăng mà chưa có tệp = đúng tập máy sẽ dựng ở lượt kế. Chỉ admin.
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const eff = await getEffectiveUser(); if (eff?.role !== 'admin') return NextResponse.json({ error: 'chỉ admin' }, { status: 403 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const ngay = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get('ngay') ?? 7)));
  const loi: string[] = [];
  const luot = (await d.execute(sql`SELECT id, luc::text AS luc, may, slug, kieu, ngay_dang, ok, vnd, ghi, loi, tep FROM may_sx_luot
    WHERE luc > now() - make_interval(days => ${ngay}) ORDER BY luc DESC LIMIT 500`).catch((e: Error) => { loi.push(`sổ lượt: ${e.message.slice(0, 120)}`); return []; })) as unknown as Record<string, unknown>[];
  const cho = (await d.execute(sql`SELECT m.ma AS may, v.slug, v.dang->>'dang_bai' AS nen, v.dang->>'dang_tu' AS ngay_dang, v.dang->>'kieu_sx' AS kieu, v.dang->>'y' AS huong
    FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
    WHERE v.da_dang = '{}'::jsonb AND NOT coalesce(v.luu_tru, false) AND v.video_url IS NULL
      AND jsonb_array_length(coalesce(v.anh, '[]'::jsonb)) = 0 AND coalesce(v.dang->>'dang_tu', '') <> ''
      AND (v.dang->>'dang_tu') >= to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD')
    ORDER BY v.dang->>'dang_tu', m.ma LIMIT 300`).catch((e: Error) => { loi.push(`hàng chờ: ${e.message.slice(0, 120)}`); return []; })) as unknown as Record<string, unknown>[];
  return NextResponse.json({ luot, cho, loi, luc: new Date().toISOString() });
}
