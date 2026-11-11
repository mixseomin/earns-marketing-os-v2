import { NextResponse } from 'next/server';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docViecSx } from '@/lib/may-sx/gom';
import { docSoKieu, dangCua } from '@/lib/may-sx/so-kieu';

export const dynamic = 'force-dynamic';

// NGĂN CHI TIẾT tab Máy SX (anh 12/11/2026: "mọi thứ ở tab Máy SX phải khi bấm vào phải dùng drawer") — một nguồn cho ngăn may-sx (?ed=may-sx~<mã>).
//   l-<id>  = một lượt dựng (may_sx_luot) → kèm bài của lượt đó
//   s-<id>  = bài social chờ dựng (xv_may_video.id) → bài + mọi lượt dựng của bài
//   k-… / p-… = việc Kênh nội dung / Puzzle — dòng gom (lib/may-sx/gom.ts), cùng khoá với bảng
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const eff = await getEffectiveUser(); if (eff?.role !== 'admin') return NextResponse.json({ error: 'chỉ admin' }, { status: 403 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const ma = String(new URL(req.url).searchParams.get('ma') ?? '');
  let so: ReturnType<typeof docSoKieu> = {}; try { so = docSoKieu(); } catch { /* tên dạng thiếu thì hiện mã */ }
  const tenKieu = (k: unknown) => (k ? so[String(k)]?.ten ?? String(k) : null);
  // bài không khai kieu_sx = dạng MẶC ĐỊNH của nền trong sổ (cùng luật máy dùng) — không ghi "chưa rõ dạng" cho bài máy vẫn dựng bình thường
  const kieuBai = (b: Record<string, unknown> | null) => { const dg = (b?.dang ?? {}) as Record<string, unknown>; return tenKieu(dangCua((dg.kieu_sx as string) ?? null, (dg.dang_bai as string) ?? null, so)); };
  const luotCua = async (slug: string) => ((await d.execute(sql`SELECT id, luc::text AS luc, xong_luc::text AS xong_luc, kieu, ngay_dang,
      coalesce(trang_thai, CASE WHEN ok THEN 'xong' ELSE 'hong' END) AS trang_thai, vnd, ghi, loi, tep FROM may_sx_luot WHERE slug = ${slug} ORDER BY luc DESC LIMIT 30`)) as unknown as Record<string, unknown>[])
    .map((x) => ({ ...x, kieu_ten: tenKieu(x.kieu) }));
  const baiCua = async (dk: ReturnType<typeof sql>) => ((await d.execute(sql`SELECT v.id, v.slug, v.may_id, m.ma AS may, m.ten AS may_ten, v.dang, v.video_url, v.anh, v.cham, v.da_dang,
      v.updated_at::text AS luc FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE ${dk} LIMIT 1`)) as unknown as Record<string, unknown>[])[0] ?? null;
  try {
    if (/^l-\d+$/.test(ma)) {
      const l = ((await d.execute(sql`SELECT id, may, slug FROM may_sx_luot WHERE id = ${Number(ma.slice(2))}`)) as unknown as { id: number; may: string; slug: string }[])[0];
      if (!l) return NextResponse.json({ error: `không có lượt ${ma.slice(2)}` }, { status: 404 });
      const bai = await baiCua(sql`v.slug = ${l.slug}`);
      return NextResponse.json({ loai: 'bai', luot_mo: l.id, bai, kieu_ten: kieuBai(bai), luot: await luotCua(l.slug), slug: l.slug, may: l.may });
    }
    if (/^s-\d+$/.test(ma)) {
      const bai = await baiCua(sql`v.id = ${Number(ma.slice(2))}`);
      if (!bai) return NextResponse.json({ error: `không có bài ${ma.slice(2)}` }, { status: 404 });
      return NextResponse.json({ loai: 'bai', bai, kieu_ten: kieuBai(bai), luot: await luotCua(String(bai.slug)), slug: bai.slug, may: bai.may });
    }
    const v = (await docViecSx()).viec.find((x) => x.khoa === ma);
    if (!v) return NextResponse.json({ error: `việc ${ma} không còn trong danh sách đang sản xuất (có thể đã xong)` }, { status: 404 });
    return NextResponse.json({ loai: 'viec', viec: v });
  } catch (e) { return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 }); }
}
