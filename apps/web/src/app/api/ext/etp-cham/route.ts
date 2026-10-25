import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveExtUser } from '../_auth';

// CỬA CHO WORKER CHẤM CREATIVE (Cloudflare Worker etp-cham, tài khoản Eimagini — anh 25/10/2026: "chấm điểm sao lại cài trên iMac" → chọn CF worker).
// Khoá: Bearer MOS2_EXT_KEY (chỉ quyền admin). CHỈ CHẤM — không đụng camp / luật.
//   GET  ?so=N  → nhận tối đa N creative trong hàng etp.cham_hang (nút "Chấm" trên trang ưu tiên, rồi creative mới) + tiêu chí (etp.tieu_chi)
//               + luật từ cấm / CTA (xv_khoa_ngoai ethopex_mau_cam — dong-bo.py xuất từ kiem-thoai.py / cta_qc.py, một nguồn)
//   POST {creative_id, buoc}                                           → báo bước đang làm (bảng chấm trực tiếp trên etp.on.tc)
//   POST {creative_id, loi?, lop, diem, ly_do, khung, meta, afs, ket} → ghi etp.cham + đánh dấu hàng xong / lỗi
type ViecCham = { creative_id: number; video: string; dur: number; doan: string | null; phim: string | null };

async function quyen(req: Request) {
  const u = await resolveExtUser(req);
  return u?.mode === 'admin';
}

export async function GET(req: Request) {
  if (!(await quyen(req))) return NextResponse.json({ loi: 'cấm' }, { status: 403 });
  const db = getDb()!;
  const so = Math.min(Math.max(Number(new URL(req.url).searchParams.get('so') ?? 2) || 2, 1), 10);
  // 'dang' quá 30 phút = lượt trước chết giữa chừng → trả về hàng; creative chưa vào kho sau 2 giờ (đồng bộ 10 phút) → lỗi
  await db.execute(sql`update etp.cham_hang set trang_thai = 'cho', bat_dau = null where trang_thai = 'dang' and bat_dau < now() - interval '30 minutes'`);
  await db.execute(sql`update etp.cham_hang h set trang_thai = 'loi', xong = now(), loi = 'creative không có trong kho / không có video sau 2 giờ'
    where trang_thai = 'cho' and luc < now() - interval '2 hours'
      and not exists (select 1 from etp.creative c where c.creative_id = h.creative_id and c.video is not null)`);
  const viec = (await db.execute(sql`with nhan as (
      update etp.cham_hang set trang_thai = 'dang', bat_dau = now(), buoc = 'Cloudflare nhận việc', nhat_ky = jsonb_build_array(jsonb_build_object('b', 'Cloudflare nhận việc', 'luc', now())) where creative_id in (
        select h.creative_id from etp.cham_hang h join etp.creative c on c.creative_id = h.creative_id and c.video is not null
        where h.trang_thai = 'cho' order by (h.nguon = 'nut') desc, h.luc limit ${so} for update of h skip locked)
      returning creative_id)
    select c.creative_id, c.video, coalesce(c.den - c.tu, 85) + 4 dur, c.doan, p.ten phim
    from nhan join etp.creative c using (creative_id) left join etp.phim p on p.content_id = c.content_id`)) as unknown as ViecCham[];
  if (!viec.length) return NextResponse.json({ viec: [] });
  const [tieuChi, mau] = await Promise.all([
    db.execute(sql`select nhom, ma, ten, mo_ta from etp.tieu_chi order by nhom desc, thu_tu`),
    db.execute(sql`select gia_tri from xv_khoa_ngoai where ten = 'ethopex_mau_cam'`),
  ]);
  return NextResponse.json({ viec: viec.map((v) => ({ ...v, dur: Number(v.dur) })), tieu_chi: tieuChi, mau: (mau as unknown as { gia_tri: unknown }[])[0]?.gia_tri ?? null });
}

export async function POST(req: Request) {
  if (!(await quyen(req))) return NextResponse.json({ loi: 'cấm' }, { status: 403 });
  const b = (await req.json()) as { buoc?: string; creative_id: number; loi?: string | null; lop?: unknown; diem?: unknown; ly_do?: unknown; khung?: unknown; meta?: number | null; afs?: number | null; ket?: string | null };
  const id = Number(b.creative_id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ loi: 'creative_id sai' }, { status: 400 });
  const db = getDb()!;
  if (b.buoc && !b.lop) {
    await db.execute(sql`update etp.cham_hang set buoc = ${b.buoc.slice(0, 200)}, nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', ${b.buoc.slice(0, 200)}::text, 'luc', now()))
      where creative_id = ${id} and trang_thai = 'dang'`);
    return NextResponse.json({ ok: true });
  }
  if (b.lop && b.diem) {
    await db.execute(sql`insert into etp.cham (creative_id, doan, may, lop, diem, ly_do, khung, meta, afs, ket, loi)
      select ${id}, (select doan from etp.creative where creative_id = ${id}), 'cloudflare', ${JSON.stringify(b.lop)}::jsonb, ${JSON.stringify(b.diem)}::jsonb,
        ${JSON.stringify(b.ly_do ?? {})}::jsonb, ${JSON.stringify(b.khung ?? {})}::jsonb, ${b.meta ?? null}, ${b.afs ?? null}, ${b.ket ?? null}, ${b.loi ?? null}
      on conflict (creative_id) do update set doan = excluded.doan, luc = now(), may = excluded.may, lop = excluded.lop, diem = excluded.diem,
        ly_do = excluded.ly_do, khung = excluded.khung, meta = excluded.meta, afs = excluded.afs, ket = excluded.ket, loi = excluded.loi`);
  }
  const xong = !!(b.lop && b.diem);   // một lớp lỗi (vd giọng) vẫn có bản chấm — lỗi ghi kèm, cột lớp đó hiện "–"
  await db.execute(sql`update etp.cham_hang set trang_thai = ${xong ? 'xong' : 'loi'}, xong = now(), loi = ${b.loi ?? null}, buoc = ${xong ? 'xong' : 'lỗi'},
    nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', ${xong ? `xong · ${b.ket ?? ''} · Meta ${b.meta ?? '–'} · AFS ${b.afs ?? '–'}` : `lỗi: ${(b.loi ?? '').slice(0, 150)}`}::text, 'luc', now())) where creative_id = ${id}`);
  return NextResponse.json({ ok: true });
}
