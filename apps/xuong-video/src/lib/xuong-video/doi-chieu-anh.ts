// ⚖️ MỌI ẢNH SINH RA ĐỀU ĐƯỢC SO VỚI YÊU CẦU (anh 01/11/2026: "ảnh sinh ra luôn có bước bóc tách để so với yêu cầu đúng ko?" — trước đó KHÔNG: chỉ khi
// bấm chọn keyframe trên giao diện; ảnh từ job / script / vòng tự-sửa không được bóc, tập 1 phim #353 có 0/17 shot đối chiếu đúng ảnh đang dùng).
// MỘT lõi: bóc tách ảnh (boc-tach-khung.ts) → đối chiếu với danh mục dự kiến (doi-chieu-khung.ts › thanhPhanDuKien = cùng nguồn phiếu shot + prompt)
// → máy so bằng các lá enum → lưu xv_canh.doi_chieu_uv[url]; ảnh là ảnh đang chọn thì ghi luôn boc_tach. Có kết quả cho url rồi thì dùng lại (0đ).
// Gọi từ: hoan-tat (job keyframe xong), soi-mat (ảnh sửa mặt), nút / action bóc tách, vòng tự-sửa. ~0,6¢ / ảnh (Gemini rẻ).
import 'server-only';
import { sql } from 'drizzle-orm';
import { kemBienThe, mapCanh, mapNhanVat, type Db, type Row } from './doc-db';
import { bocTachKhung } from './boc-tach-khung';
import { doiChieuKhung, thanhPhanDuKien, apDungSoBang } from './doi-chieu-khung';
import { kgCua } from './khong-gian';
import { lookMang } from './bo-set-3d';
import type { BocTachCanh, BocTachKhung, DongDoiChieu, PhanCanh } from './kieu';

export type DoiChieuAnh = { luc: 'dau' | 'cuoi'; luc_boc: string; boc: BocTachKhung; chieu: DongDoiChieu[] };
/** số lá lệch / thiếu / thừa của một lần đối chiếu (khớp + gần không tính) */
export const soLech = (ch: DongDoiChieu[] | null | undefined) => (ch ?? []).filter((r) => r.muc !== 'khớp' && r.muc !== 'gần').length;

/** Đối chiếu MỘT ảnh của shot với yêu cầu. ep = làm lại dù đã có. null = bóc hỏng (cổng ảnh không trả). */
/** NGỮ CẢNH ĐỐI CHIẾU của một shot (shot + nhân vật + look + không gian) — MỘT chỗ nạp cho đối chiếu keyframe (doiChieuAnh) và hoàn công clip (hoan-cong.ts). */
export async function nguCanhDoiChieu(db: Db, canhId: number) {
  const row = ((await db.execute(sql`SELECT c.*, t.phim_id, t.khong_gian, t.so AS tap_so, t.phan_canh AS tap_pc FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[])[0];
  if (!row) return null;
  const c = mapCanh(row); const phimId = Number(row.phim_id);
  const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const ds = ((await db.execute(sql`SELECT id, canh, nhan_vat, bien_the FROM xv_canh WHERE tap_id = ${c.tap_id} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[])
    .map((r) => ({ id: Number(r.id), canh: String(r.canh ?? ''), nhan_vat: ((r.nhan_vat ?? []) as unknown[]).map(Number), bien_the: ((r.bien_the ?? []) as unknown[]).map(Number) }));
  const look = lookMang(ds, nhanVat, (row.tap_pc ?? []) as PhanCanh[], row.tap_so == null ? undefined : Number(row.tap_so)).get(canhId);
  return { row, c, phimId, nhanVat, look, kg: kgCua(row.khong_gian as never, c) };
}
/** LÕI: bóc tách MỘT ảnh (url hoặc tệp) rồi đối chiếu với yêu cầu shot lúc đầu / cuối. Không ghi DB. */
export async function bocVaDoiChieu(db: Db, nc: NonNullable<Awaited<ReturnType<typeof nguCanhDoiChieu>>>, anh: string, luc: 'dau' | 'cuoi'): Promise<{ boc: BocTachKhung; chieu: DongDoiChieu[] } | null> {
  const { c, phimId, nhanVat, look, kg } = nc;
  const boc = await bocTachKhung(db, phimId, anh, nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
  if (!boc) return null;
  const ch = await doiChieuKhung(db, phimId, thanhPhanDuKien(c, nhanVat, kg, luc, look), boc);
  return ch ? { boc, chieu: apDungSoBang(ch, c, nhanVat, kg, luc, boc) } : null;
}

export async function doiChieuAnh(db: Db, canhId: number, url: string, luc: 'dau' | 'cuoi' = 'dau', o: { ep?: boolean } = {}): Promise<DoiChieuAnh | null> {
  const nc = await nguCanhDoiChieu(db, canhId); if (!nc) return null;
  const cu = ((nc.row.doi_chieu_uv ?? {}) as Record<string, DoiChieuAnh>)[url];
  if (cu && cu.luc === luc && !o.ep) return cu;
  const { c } = nc;
  const r = await bocVaDoiChieu(db, nc, url, luc); if (!r) return null;
  const kq: DoiChieuAnh = { luc, luc_boc: new Date().toISOString(), boc: r.boc, chieu: r.chieu };
  await db.execute(sql`UPDATE xv_canh SET doi_chieu_uv = coalesce(doi_chieu_uv, '{}'::jsonb) || ${JSON.stringify({ [url]: kq })}::jsonb WHERE id = ${canhId}`);
  // ảnh ĐANG CHỌN (đầu / cuối) → bản đối chiếu chính của shot (boc_tach) theo đúng ảnh này
  const dangChon = luc === 'dau' ? c.keyframe_url : c.keyframe_ket;
  if (dangChon === url) {
    const bt: BocTachCanh = { ...(c.boc_tach ?? {}), [luc]: r.boc, doi_chieu: { ...(c.boc_tach?.doi_chieu ?? {}), [luc]: kq.chieu }, luc_boc: kq.luc_boc,
      tren: { dau: luc === 'dau' ? url : c.boc_tach?.tren?.dau ?? null, cuoi: luc === 'cuoi' ? url : c.boc_tach?.tren?.cuoi ?? null } };
    await db.execute(sql`UPDATE xv_canh SET boc_tach = ${JSON.stringify(bt)}::jsonb WHERE id = ${canhId}`);
  }
  return kq;
}

/** Chạy NỀN sau khi một ảnh mới về (không giữ lượt của job / người bấm); lỗi chỉ ghi log — ảnh vẫn dùng được, phiếu shot hiện "chưa đối chiếu". */
export function doiChieuAnhNen(db: Db, canhId: number, url: string, luc: 'dau' | 'cuoi' = 'dau'): void {
  void doiChieuAnh(db, canhId, url, luc).catch((e: unknown) => console.error(`[đối chiếu ảnh] shot ${canhId}`, e instanceof Error ? e.message : e));
}

/** Đối chiếu lại ảnh ĐANG CHỌN (đầu + cuối) của shot — nút 🧩 / action bóc tách. */
export async function bocTachCanhDb(db: Db, canhId: number): Promise<{ ok: true; boc_tach: BocTachCanh } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT keyframe_url, keyframe_ket FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[])[0];
  if (!r) return { ok: false, loi: 'không thấy cảnh' };
  if (!r.keyframe_url && !r.keyframe_ket) return { ok: false, loi: 'chưa có keyframe để bóc tách' };
  let co = false;
  for (const [luc, url] of [['dau', r.keyframe_url], ['cuoi', r.keyframe_ket]] as const) if (url && (await doiChieuAnh(db, canhId, String(url), luc, { ep: true }))) co = true;
  if (!co) return { ok: false, loi: 'bóc tách hỏng (cổng ảnh không trả kết quả)' };
  const bt = ((await db.execute(sql`SELECT boc_tach FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[])[0]?.boc_tach as BocTachCanh;
  return { ok: true, boc_tach: bt };
}
