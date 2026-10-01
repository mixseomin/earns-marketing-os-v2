'use server';
// SHOP — thao tác từ màn /shop. Chỉ admin. Trả {ok, loi?} để màn hiện lỗi tại chỗ, không ném.
import { dsVideo } from '@mos2/shop/video';
import { CUA_SO, type CuaSo } from '@mos2/shop/phien';
import { docPhien, docSuKienPhien } from '@/lib/shop/phien';
import { ga4ThoiGianThuc } from '@/lib/shop/ga4-tt';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { cuaHangTheoKhoa, dsCuaHang, ghiSuKien, nhip, sangNcc, soDuCj, traNcc, type CuaHang } from '@/lib/shop/dong-bo';
import { docChiTietDon } from '@/lib/shop/doc';
import { woo } from '@/lib/shop/nguon';

async function admin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('chỉ admin');
  return me;
}
const db = () => { const d = getDb(); if (!d) throw new Error('chưa nối DB'); return d; };
async function cuaHangCuaDon(donId: number): Promise<CuaHang | null> {
  const r = (await db().execute(sql`SELECT c.khoa FROM shop_don d JOIN shop_cua_hang c ON c.id = d.cua_hang_id WHERE d.id = ${donId}`)) as unknown as { khoa: string }[];
  return r[0] ? cuaHangTheoKhoa(r[0].khoa) : null;
}

export async function shopChiTietDon(id: number) { await admin(); return docChiTietDon(id); }

export async function shopSoDuNcc() { await admin(); return soDuCj(); }

/** Đặt đơn sang NCC bằng tay (đơn lỗi / cửa hàng tắt tự sang). Không tiêu tiền — CJ chỉ tạo đơn chưa trả. */
export async function shopSangNcc(donId: number) {
  const me = await admin();
  const ch = await cuaHangCuaDon(donId);
  if (!ch) return { ok: false, loi: 'không thấy cửa hàng' };
  const r = await sangNcc(ch, donId, me.displayName || me.email);
  revalidatePath('/shop');
  return r;
}

/** Trả đơn CJ từ ví CJ — TIÊU TIỀN, chỉ khi anh bấm. */
export async function shopTraNcc(donId: number) {
  const me = await admin();
  const r = await traNcc(donId, me.displayName || me.email);
  revalidatePath('/shop');
  return r;
}

export async function shopDongBo(khoa?: string, sanPham = false) {
  await admin();
  const ds = (await dsCuaHang(false)).filter((c) => !khoa || c.khoa === khoa);
  const kq = [];
  for (const ch of ds) kq.push(await nhip(ch, { sanPham }));
  revalidatePath('/shop');
  const loi = kq.map((k) => k.loi).filter(Boolean).join(' · ');
  return loi ? { ok: false, loi, kq } : { ok: true, kq };
}

/** Sửa mã NCC / giá vốn một biến thể. Sổ là gốc; ghi ngược meta _cj_vid / _cj_gia_von về Woo để admin WP cũng thấy đúng. */
export async function shopSuaBienThe(id: number, v: { maNcc: string | null; giaVon: number | null }) {
  await admin();
  const r = (await db().execute(sql`
    UPDATE shop_bien_the b SET ma_ncc = ${v.maNcc || null}, gia_von = ${v.giaVon}, updated_at = now() FROM shop_san_pham p, shop_cua_hang c
     WHERE b.id = ${id} AND p.id = b.san_pham_id AND c.id = p.cua_hang_id
     RETURNING b.ma_ngoai, p.ma_ngoai AS sp, c.khoa, (b.ma_ngoai = p.ma_ngoai) AS don_le`)) as unknown as { ma_ngoai: string; sp: string; khoa: string; don_le: boolean }[];
  if (!r[0]) return { ok: false, loi: 'không có biến thể' };
  const ch = await cuaHangTheoKhoa(r[0].khoa);
  try {
    if (ch?.nen_tang === 'woo') await woo(ch, 'PUT', r[0].don_le ? `products/${r[0].sp}` : `products/${r[0].sp}/variations/${r[0].ma_ngoai}`,
      { meta_data: [{ key: '_cj_vid', value: v.maNcc ?? '' }, { key: '_cj_gia_von', value: v.giaVon ?? '' }] });
  } catch (e) { revalidatePath('/shop'); return { ok: true, loi: `đã lưu sổ, ghi ngược Woo lỗi: ${(e as Error).message}` }; }
  revalidatePath('/shop');
  return { ok: true };
}

export async function shopSuaCauHinh(khoa: string, c: { ngay_ship_max: number; tu_sang_ncc: boolean; tu_tra_ncc: boolean; trang_thai: 'bat' | 'tat'; ga4_property?: string }) {
  await admin();
  const ngay = Math.max(3, Math.min(30, Math.round(Number(c.ngay_ship_max) || 11)));
  const ga4 = String(c.ga4_property ?? '').replace(/\D/g, '').slice(0, 15);
  await db().execute(sql`
    UPDATE shop_cua_hang SET trang_thai = ${c.trang_thai},
      cau_hinh = cau_hinh || ${JSON.stringify({ ngay_ship_max: ngay, tu_sang_ncc: !!c.tu_sang_ncc, tu_tra_ncc: !!c.tu_tra_ncc, ga4_property: ga4 || null })}::jsonb
     WHERE khoa = ${khoa}`);
  revalidatePath('/shop');
  return { ok: true };
}

export async function shopGhiChu(donId: number, noiDung: string) {
  const me = await admin();
  const t = noiDung.trim();
  if (!t) return { ok: false, loi: 'trống' };
  await ghiSuKien(donId, 'nguoi', `${me.displayName || me.email}: ${t}`);
  return { ok: true };
}

/* ── Mặt tiền (apps/store) ───────────────────────────────────────────────── */
/** Duyệt đánh giá khách gửi: 'hien' lên trang sản phẩm, 'an' giấu (không xoá). */
export async function shopDuyetDanhGia(id: number, trangThai: 'hien' | 'an' | 'cho') {
  await admin();
  await db().execute(sql`UPDATE shop_danh_gia SET trang_thai = ${trangThai} WHERE id = ${id}`);
  revalidatePath('/shop');
  return { ok: true };
}

/** Nội dung bán của một sản phẩm: tiêu đề H1, giá gạch (giá trước giảm CÓ THẬT), hiện/ẩn trên mặt tiền. */
export async function shopSuaSanPham(id: number, v: { tieuDe: string | null; giaGoc: number | null; hien: boolean; video: string[] }) {
  await admin();
  if (v.giaGoc !== null && !(v.giaGoc > 0)) return { ok: false, loi: 'giá gạch phải > 0 hoặc để trống' };
  // video_luc = lúc sửa → nhịp đồng bộ NCC không gieo đè lên bản anh đã sửa
  await db().execute(sql`UPDATE shop_san_pham SET tieu_de = ${v.tieuDe?.trim() || null}, gia_goc = ${v.giaGoc}, hien = ${v.hien},
    video = ${JSON.stringify(dsVideo(v.video))}::jsonb, video_luc = now(), updated_at = now() WHERE id = ${id}`);
  revalidatePath('/shop');
  return { ok: true };
}

/** Cấu hình mặt tiền (@mos2/shop/mat-tien MatTien) — trộn vào bản đang có, khoá không gửi thì giữ nguyên. */
export async function shopSuaMatTien(khoa: string, v: Record<string, unknown>) {
  await admin();
  const cho = ['thanh_tren', 'dong_sale', 'sale_het', 'bac_giam', 'cam_ket', 'mau_nhan', 'do', 'logo', 'email', 'dia_chi', 'ship'];
  const sach = Object.fromEntries(Object.entries(v).filter(([k]) => cho.includes(k)));
  await db().execute(sql`UPDATE shop_cua_hang SET mat_tien = mat_tien || ${JSON.stringify(sach)}::jsonb WHERE khoa = ${khoa}`);
  revalidatePath('/shop');
  return { ok: true };
}

/** Ghi lại danh sách "Tham khảo" của một sản phẩm (trang ngoài bán cùng/gần mẫu) — thay cả mảng, drawer gửi bản đầy đủ. */
export async function shopSuaThamKhao(id: number, ds: { url: string | null; nguon: string; ghi_chu: string; khop: string; luc: string }[]) {
  await admin();
  const sach = ds.slice(0, 50).map((x) => ({ url: x.url && /^https?:\/\//.test(x.url) ? x.url.slice(0, 500) : null, nguon: String(x.nguon ?? '').slice(0, 40),
    ghi_chu: String(x.ghi_chu ?? '').slice(0, 500), khop: ['chua_xac_nhan', 'dung_mau', 'khac'].includes(x.khop) ? x.khop : 'chua_xac_nhan', luc: x.luc || new Date().toISOString() }));
  await db().execute(sql`UPDATE shop_san_pham SET tham_khao = ${JSON.stringify(sach)}::jsonb WHERE id = ${id}`);
  revalidatePath('/shop');
  return { ok: true };
}


/** Khách trực tiếp — phiên trong cửa sổ (màn tự gọi lại mỗi 5 giây khi tab đang mở). */
export async function shopPhien(cuaSo: CuaSo) {
  await admin();
  return docPhien(CUA_SO.some((c) => c.value === cuaSo) ? cuaSo : '30p');
}
export async function shopSuKienPhien(id: string) {
  await admin();
  return docSuKienPhien(String(id).slice(0, 60));
}

/** GA4 thời gian thực của các cửa hàng có cau_hinh.ga4_property (màn gọi lại 20 giây/lần; máy chủ nhớ 20 giây). */
export async function shopGa4TT(ch: string) {
  await admin();
  const ds = (await dsCuaHang(false)).filter((c) => (ch === 'all' || c.khoa === ch) && c.cau_hinh.ga4_property);
  return Promise.all(ds.map(async (c) => ({ cuaHang: c.ten, ...(await ga4ThoiGianThuc(c.cau_hinh.ga4_property!)) })));
}
