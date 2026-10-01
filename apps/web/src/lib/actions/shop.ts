'use server';
// SHOP — thao tác từ màn /shop. Chỉ admin. Trả {ok, loi?} để màn hiện lỗi tại chỗ, không ném.
import { dsVideo } from '@mos2/shop/video';
import { CUA_SO, type CuaSo } from '@mos2/shop/phien';
import { docPhien, docSuKienPhien } from '@/lib/shop/phien';
import { ga4ThoiGianThuc } from '@/lib/shop/ga4-tt';
import { docHoSo, docTinHoSo, docTuVan } from '@/lib/shop/ho-so-doc';
import { guiTraLoi, soanTraLoi } from '@mos2/shop/tu-van';
import { LOAI_HO_SO, TRANG_THAI_HO_SO, type Ben } from '@mos2/shop/ho-so';
import { moHoSo, themTin } from '@mos2/shop/ho-so-ghi';
import { guiThu, matTien, thuDaGui, thuXacNhan } from '@mos2/shop';
import { thuChang, thuCoHang } from '@mos2/shop/thu';
import { CHANG_BAO_THU, cauHinhGiao, duKienGiao } from '@mos2/shop/giao';
import { envShop, tenEnv } from '@mos2/shop/mat-tien';
import { stripe } from '@mos2/shop/stripe';
import { existsSync } from 'node:fs';
import { docShop } from '@/lib/shop/doc';
import { KENH_NCC } from '@/lib/shop/buoc';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { apDungNcc, apNguon, cuaHangTheoKhoa, docDanhMucNcc, docSpCj, dongBoNccChung, dsCuaHang, ganNguon, ghiSuKien, nhip, sangNcc, soDuCj, tienDonCj, traNcc, type CuaHang } from '@/lib/shop/dong-bo';
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
  await dongBoNccChung();
  const kq = [];
  for (const ch of ds) kq.push(await nhip(ch, { sanPham }));
  revalidatePath('/shop');
  const loi = kq.map((k) => k.loi).filter(Boolean).join(' · ');
  return loi ? { ok: false, loi, kq } : { ok: true, kq };
}

/** Giá vốn GÕ TAY cho biến thể — chỉ có tác dụng khi nguồn đang dùng chưa có giá (NCC đặt tay). Có giá NCC thì apNguon lấy giá NCC.
 *  Mã NCC không sửa ở đây nữa: nguồn hàng là sổ riêng (shopThemNguon / shopSuaNguon / shopDoiUuTien). */
export async function shopSuaBienThe(id: number, v: { giaVon: number | null }) {
  await admin();
  const r = (await db().execute(sql`
    UPDATE shop_bien_the b SET gia_von = ${v.giaVon}, updated_at = now() FROM shop_san_pham p, shop_cua_hang c
     WHERE b.id = ${id} AND p.id = b.san_pham_id AND c.id = p.cua_hang_id
     RETURNING b.ma_ngoai, p.ma_ngoai AS sp, c.khoa, (b.ma_ngoai = p.ma_ngoai) AS don_le`)) as unknown as { ma_ngoai: string; sp: string; khoa: string; don_le: boolean }[];
  if (!r[0]) return { ok: false, loi: 'không có biến thể' };
  const ch = await cuaHangTheoKhoa(r[0].khoa);
  try {
    if (ch?.nen_tang === 'woo') await woo(ch, 'PUT', r[0].don_le ? `products/${r[0].sp}` : `products/${r[0].sp}/variations/${r[0].ma_ngoai}`,
      { meta_data: [{ key: '_cj_gia_von', value: v.giaVon ?? '' }] });
  } catch (e) { revalidatePath('/shop'); return { ok: true, loi: `đã lưu sổ, ghi ngược Woo lỗi: ${(e as Error).message}` }; }
  revalidatePath('/shop');
  return { ok: true };
}

/* ── Nguồn hàng của biến thể (nhiều-nhiều, migration 0205) ── */
async function cuaHangCuaBt(btId: number): Promise<CuaHang | null> {
  const r = (await db().execute(sql`SELECT c.khoa FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id WHERE b.id = ${btId}`)) as unknown as { khoa: string }[];
  return r[0] ? cuaHangTheoKhoa(r[0].khoa) : null;
}
/** Sau mọi thay đổi nguồn: chọn lại nguồn + áp lên mặt tiền NGAY (không chờ nhịp 10 phút). */
async function apLai(btId: number) {
  const ch = await cuaHangCuaBt(btId);
  if (ch) { await apNguon(ch); await apDungNcc(ch); }
  revalidatePath('/shop');
}

/** Đọc / tạo một sản phẩm NCC trong danh mục. NCC có API (CJ): đọc thẳng từ CJ theo mã (pid) — có đủ biến thể để chọn. NCC đặt tay: tạo dòng theo mã + tên. */
export async function shopDocSpNcc(ncc: string, ma: string, ten?: string) {
  await admin();
  const m = ma.trim().slice(0, 120);
  if (!m) return { ok: false as const, loi: 'thiếu mã sản phẩm' };
  const [n] = (await db().execute(sql`SELECT khoa, co_api FROM shop_ncc WHERE khoa = ${ncc}`)) as unknown as { khoa: string; co_api: boolean }[];
  if (!n) return { ok: false as const, loi: 'không có NCC này' };
  if (n.co_api && n.khoa === 'cj') {
    const r = await docSpCj(m);
    if (r.loi) return { ok: false as const, loi: `CJ: ${r.loi}` };
  } else {
    await db().execute(sql`INSERT INTO shop_ncc_sp (ncc, ma, ten) VALUES (${ncc}, ${m}, ${ten?.trim().slice(0, 300) || null})
      ON CONFLICT (ncc, ma) DO UPDATE SET ten = COALESCE(EXCLUDED.ten, shop_ncc_sp.ten)`);
  }
  revalidatePath('/shop');
  return { ok: true as const };
}

/** Thêm nguồn cho biến thể shop: NCC · mã sản phẩm · mã biến thể (đã có trong danh mục, hoặc biến thể mới của NCC đặt tay kèm tên + giá).
 *  Nguồn đầu tiên = chính; thêm sau = dự phòng cuối hàng, CHƯA kiểm mẫu (máy không tự chuyển sang tới khi đánh dấu đã kiểm). */
export async function shopThemNguon(btId: number, v: { ncc: string; maSp: string; maBt: string; tenBt?: string; gia?: number | null }) {
  await admin();
  if (!v.ncc || !v.maSp.trim() || !v.maBt.trim()) return { ok: false, loi: 'thiếu NCC / mã sản phẩm / mã biến thể' };
  const [n] = (await db().execute(sql`SELECT co_api FROM shop_ncc WHERE khoa = ${v.ncc}`)) as unknown as { co_api: boolean }[];
  if (!n) return { ok: false, loi: 'không có NCC này' };
  if (n.co_api) {
    const co = (await db().execute(sql`SELECT 1 FROM shop_ncc_bt t JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id WHERE s.ncc = ${v.ncc} AND s.ma = ${v.maSp.trim()} AND t.ma = ${v.maBt.trim()}`)) as unknown as unknown[];
    if (!co.length) return { ok: false, loi: 'mã biến thể không có trong sản phẩm NCC đã đọc — đọc sản phẩm trước rồi chọn biến thể' };
  }
  await ganNguon(btId, v.ncc, v.maSp.trim(), v.maBt.trim(), { tenBt: v.tenBt?.trim() || null, gia: v.gia ?? null });
  await apLai(btId);
  return { ok: true };
}

/** Đánh dấu đã kiểm mẫu / bật-tắt một nguồn (tắt thay cho xoá — giữ lịch sử). */
export async function shopSuaNguon(id: number, v: { kiemMau?: boolean; bat?: boolean; ghiChu?: string | null }) {
  await admin();
  const r = (await db().execute(sql`UPDATE shop_nguon SET kiem_mau = COALESCE(${v.kiemMau ?? null}, kiem_mau), bat = COALESCE(${v.bat ?? null}, bat),
    ghi_chu = CASE WHEN ${v.ghiChu === undefined} THEN ghi_chu ELSE ${v.ghiChu ?? null} END WHERE id = ${id} RETURNING bien_the_id`)) as unknown as { bien_the_id: number }[];
  if (!r[0]) return { ok: false, loi: 'không có nguồn' };
  await apLai(r[0].bien_the_id);
  return { ok: true };
}

/** Đổi thứ tự ưu tiên: đổi chỗ với nguồn bật liền trên (-1) / liền dưới (+1), rồi đánh số lại 1..n (1 = chính). */
export async function shopDoiUuTien(id: number, huong: -1 | 1) {
  await admin();
  const [x] = (await db().execute(sql`SELECT bien_the_id FROM shop_nguon WHERE id = ${id}`)) as unknown as { bien_the_id: number }[];
  if (!x) return { ok: false, loi: 'không có nguồn' };
  const ds = (await db().execute(sql`SELECT id FROM shop_nguon WHERE bien_the_id = ${x.bien_the_id} AND bat ORDER BY uu_tien, id`)) as unknown as { id: number }[];
  const ids = ds.map((d) => d.id), i = ids.indexOf(id), j = i + huong;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: false, loi: 'không đổi được' };
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  for (const [k, nid] of ids.entries()) await db().execute(sql`UPDATE shop_nguon SET uu_tien = ${k + 1} WHERE id = ${nid}`);
  await apLai(x.bien_the_id);
  return { ok: true };
}

export async function shopSuaCauHinh(khoa: string, c: { ngay_ship_max: number; tu_sang_ncc: boolean; tu_tra_ncc: boolean; trang_thai: 'bat' | 'tat'; ga4_property?: string; tu_an_het?: boolean; bien_toi_thieu?: number; ton_thap?: number }) {
  await admin();
  const ngay = Math.max(3, Math.min(30, Math.round(Number(c.ngay_ship_max) || 11)));
  const ga4 = String(c.ga4_property ?? '').replace(/\D/g, '').slice(0, 15);
  await db().execute(sql`
    UPDATE shop_cua_hang SET trang_thai = ${c.trang_thai},
      cau_hinh = cau_hinh || ${JSON.stringify({ ngay_ship_max: ngay, tu_sang_ncc: !!c.tu_sang_ncc, tu_tra_ncc: !!c.tu_tra_ncc, ga4_property: ga4 || null, tu_an_het: c.tu_an_het !== false, bien_toi_thieu: Math.max(0, Math.min(95, Math.round(Number(c.bien_toi_thieu ?? 60) || 60))), ton_thap: Math.max(0, Math.round(Number(c.ton_thap ?? 50) || 0)) })}::jsonb
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

/** Cấu hình mặt tiền (@mos2/shop/mat-tien MatTien) — trộn vào bản đang có, khoá không gửi thì giữ nguyên. Mọi khoá có máy đọc đều
 *  sửa được ở đây (anh chốt 01/10/2026: mọi cơ chế/điều khiển nằm trong mos2) — khoá lạ bị bỏ, khoá có cấu trúc thì làm sạch trước khi ghi. */
export async function shopSuaMatTien(khoa: string, v: Record<string, unknown>) {
  await admin();
  const cho = ['thanh_tren', 'dong_sale', 'sale_het', 'bac_giam', 'cam_ket', 'mau_nhan', 'do', 'logo', 'email', 'dia_chi', 'ship', 'giao', 'thu', 'faq', 'ma_giam', 'dang_ky', 'trang', 'tu_van'];
  const sach: Record<string, unknown> = {};
  const so = (x: unknown, tu: number, den: number) => Math.max(tu, Math.min(den, Math.round(Number(x) || 0)));
  const chu = (x: unknown, n: number) => String(x ?? '').slice(0, n);
  for (const [k, x] of Object.entries(v)) {
    if (!cho.includes(k)) continue;
    if (k === 'giao') {
      const g = (x ?? {}) as { xu_ly?: number[]; van_chuyen?: number[]; ngay_lam_viec?: boolean; dam_bao_ngay?: number };
      const cap = (a: number[] | undefined, tu: number, den: number) => { const [p, q] = [so(a?.[0], tu, den), so(a?.[1], tu, den)]; return [Math.min(p, q), Math.max(p, q)]; };
      sach.giao = { xu_ly: cap(g.xu_ly, 0, 15), van_chuyen: cap(g.van_chuyen, 1, 60), ngay_lam_viec: g.ngay_lam_viec !== false, dam_bao_ngay: so(g.dam_bao_ngay, 7, 120) };
    } else if (k === 'thu') {
      const t = (x ?? {}) as { xac_nhan?: boolean; da_gui?: boolean; chang?: string[] };
      sach.thu = { xac_nhan: t.xac_nhan !== false, da_gui: t.da_gui !== false, co_hang: (t as { co_hang?: boolean }).co_hang !== false, chang: (t.chang ?? []).filter((c) => (CHANG_BAO_THU as string[]).includes(c)) };
    } else if (k === 'tu_van') {
      const t = (x ?? {}) as { bat?: boolean; tu_gui?: boolean; chao?: string; model?: string; khi_truc?: boolean };
      sach.tu_van = { bat: t.bat !== false, tu_gui: t.tu_gui !== false, khi_truc: !!t.khi_truc, chao: chu(t.chao, 300).trim(), model: /^[a-z0-9.\-]{3,40}$/i.test(t.model ?? '') ? t.model : '' };
    } else if (k === 'faq') {
      sach.faq = ((x ?? []) as { hoi?: string; dap?: string }[]).filter((f) => f.hoi?.trim() && f.dap?.trim()).slice(0, 30).map((f) => ({ hoi: chu(f.hoi, 200).trim(), dap: chu(f.dap, 3000).trim() }));
    } else if (k === 'ma_giam') {
      sach.ma_giam = ((x ?? []) as { ma?: string; pt?: number }[]).filter((m) => /^[A-Z0-9]{3,20}$/i.test(m.ma ?? '') && Number(m.pt) > 0 && Number(m.pt) < 90)
        .slice(0, 20).map((m) => ({ ma: m.ma!.toUpperCase(), pt: Number(m.pt) }));
    } else if (k === 'dang_ky') {
      const d = x as { tieu_de?: string; chu?: string; ma?: string } | null;
      sach.dang_ky = d && d.tieu_de?.trim() ? { tieu_de: chu(d.tieu_de, 80), chu: chu(d.chu, 300), ma: chu(d.ma, 20).toUpperCase() } : null;
    } else if (k === 'trang') {
      const t = (x ?? {}) as Record<string, { tieu_de?: string; html?: string }>;
      sach.trang = Object.fromEntries(Object.entries(t).filter(([kk]) => /^[a-z0-9-]{2,40}$/.test(kk))
        .map(([kk, p]) => [kk, { tieu_de: chu(p?.tieu_de, 120), html: chu(p?.html, 60000) }]));
    } else if (k === 'ship') {
      const sh = (x ?? {}) as { phi?: number; mien_phi_tu?: number | null; ten?: string };
      sach.ship = { phi: Math.max(0, Number(sh.phi) || 0), mien_phi_tu: sh.mien_phi_tu == null || sh.mien_phi_tu === ('' as unknown) ? null : Math.max(0, Number(sh.mien_phi_tu)), ten: chu(sh.ten, 60) || 'Shipping' };
    } else sach[k] = x;
  }
  if (sach.email !== undefined && sach.email !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(sach.email))) return { ok: false, loi: 'email hỗ trợ không hợp lệ' };
  await db().execute(sql`UPDATE shop_cua_hang SET mat_tien = mat_tien || ${JSON.stringify(sach)}::jsonb WHERE khoa = ${khoa}`);
  revalidatePath('/shop');
  return { ok: true };
}

/** Xem trước một thư khách bằng cấu hình THẬT của shop + đơn mẫu (không gửi). loai: xac_nhan | da_gui | khoá chặng. */
export async function shopXemThu(khoa: string, loai: string) {
  await admin();
  const ch = await cuaHangTheoKhoa(khoa);
  if (!ch) return null;
  const m = matTien(ch.mat_tien), g = cauHinhGiao(m.giao);
  const s = { khoa: ch.khoa, ten: ch.ten, domain: ch.domain, email: m.email ?? `support@${ch.domain}` };
  const link = `https://${ch.domain}/trackings/search?order=5003`;
  if (loai === 'xac_nhan') return thuXacNhan(s, { so_don: '5003', ten: 'Linda', mon: [{ ten: 'Sample product', tuy_chon: 'Black / US 8', sl: 1, gia: 49.99 }],
    tam_tinh: 49.99, giam: 0, ship: 0, tong: 49.99, dia_chi: 'Linda R., 1 Main St, Austin, TX 78701, US', link, giao: g });
  if (loai === 'da_gui') return thuDaGui(s, '5003', 'Linda', link);
  if (loai === 'co_hang') return thuCoHang(s, 'Sample product', `https://${ch.domain}/`);
  if ((CHANG_BAO_THU as string[]).includes(loai)) return thuChang(s, '5003', 'Linda', loai as (typeof CHANG_BAO_THU)[number], link, g, duKienGiao(g, new Date(Date.now() - 4 * 86_400_000), true));
  return null;
}

/** Tình trạng kết nối của một shop — CHỈ báo có/không + chỗ cấu hình, không bao giờ trả giá trị khoá. */
export async function shopKetNoi(khoa: string) {
  await admin();
  const ch = await cuaHangTheoKhoa(khoa);
  if (!ch) return [];
  const co = (duoi: string) => !!envShop(khoa, duoi);
  const ra: { ten: string; ok: boolean | null; chi_tiet: string }[] = [
    { ten: 'Stripe khoá (PK/SK)', ok: co('STRIPE_PK') && co('STRIPE_SK'), chi_tiet: `${tenEnv(khoa, 'STRIPE_PK')} · ${tenEnv(khoa, 'STRIPE_SK')} trong .env.production` },
    { ten: 'Stripe webhook (bí mật ký)', ok: co('STRIPE_WH'), chi_tiet: tenEnv(khoa, 'STRIPE_WH') },
    { ten: 'Gửi thư (SMTP)', ok: co('SMTP_HOST') && co('SMTP_USER'), chi_tiet: `${tenEnv(khoa, 'SMTP_HOST')} = ${envShop(khoa, 'SMTP_HOST') || '—'}` },
    { ten: 'Ký DKIM', ok: co('DKIM_FILE') ? fsTonTai(envShop(khoa, 'DKIM_FILE')) : false, chi_tiet: co('DKIM_FILE') ? `selector ${envShop(khoa, 'DKIM_SELECTOR') || 'mailer'}` : 'chưa đặt' },
    { ten: 'CJ (nhà cung cấp)', ok: !!process.env.SHOP_CJ_TOKEN, chi_tiet: 'SHOP_CJ_TOKEN' },
    { ten: '17TRACK (mốc vận đơn)', ok: !!process.env.SHOP_17TRACK_KEY, chi_tiet: 'SHOP_17TRACK_KEY' },
    { ten: 'GA4 thời gian thực', ok: !!ch.cau_hinh.ga4_property && fsTonTai(process.env.GA4_OAUTH || '/etc/adfond/ga4-oauth.json'), chi_tiet: ch.cau_hinh.ga4_property ? `property ${ch.cau_hinh.ga4_property}` : 'chưa gắn property' },
    { ten: 'Xem trước trang theo dõi', ok: !!process.env.STORE_PREVIEW_KEY, chi_tiet: 'STORE_PREVIEW_KEY' },
  ];
  if (ch.nen_tang === 'mos' && co('STRIPE_SK')) {
    try {
      const w = await stripe<{ data: { url: string; status: string }[] }>(khoa, 'GET', 'webhook_endpoints?limit=50');
      const dung = w.data.find((x) => x.url === `https://${ch.domain}/api/stripe/webhook`);
      ra.push({ ten: 'Stripe gửi webhook về shop', ok: dung?.status === 'enabled', chi_tiet: dung ? `${dung.url} · ${dung.status}` : `chưa có endpoint https://${ch.domain}/api/stripe/webhook` });
    } catch (e) { ra.push({ ten: 'Stripe gửi webhook về shop', ok: null, chi_tiet: `không đọc được: ${(e as Error).message.slice(0, 120)}` }); }
  }
  return ra;
}

/** Link xem trước: trang chủ + trang sản phẩm của shop, và trang theo dõi của vài đơn (mỗi chặng một đơn) — shop chưa có tên miền
 *  (vd DEMO) thì mượn khung của shop mos đang chạy + khoá STORE_PREVIEW_KEY (khoá nằm trong link, chỉ admin thấy). */
export async function shopLinkXemTruoc(khoa: string) {
  await admin();
  const ds = await dsCuaHang(false);
  const ch = ds.find((c) => c.khoa === khoa);
  if (!ch) return null;
  const khung = ch.trang_thai === 'bat' && ch.nen_tang === 'mos' ? ch : ds.find((c) => c.trang_thai === 'bat' && c.nen_tang === 'mos');
  if (!khung) return null;
  const [sp] = await db().execute(sql`SELECT slug FROM shop_san_pham WHERE cua_hang_id = ${ch.id} AND hien AND slug IS NOT NULL ORDER BY thu_tu, id LIMIT 1`) as unknown as { slug: string }[];
  const don = (await docShop()).don.filter((d) => d.cuaHang === khoa && d.ht).sort((a, b) => (b.ht!.pct - a.ht!.pct));
  const khoaDon = new Map(((await db().execute(sql`SELECT so_don, khoa_don FROM shop_don WHERE cua_hang_id = ${ch.id} AND khoa_don IS NOT NULL`)) as unknown as { so_don: string; khoa_don: string }[]).map((r) => [r.so_don, r.khoa_don]));
  const xem = khung.khoa !== ch.khoa ? `&xem=${encodeURIComponent(process.env.STORE_PREVIEW_KEY ?? '')}&shop=${encodeURIComponent(ch.khoa)}` : '';
  const daCo = new Set<string>();
  const theoDoi = don.filter((d) => khoaDon.has(d.soDon) && !daCo.has(d.ht!.chang[d.ht!.hienTai]!.key) && daCo.add(d.ht!.chang[d.ht!.hienTai]!.key))
    .map((d) => ({ so: d.soDon, chang: d.ht!.chang[d.ht!.hienTai]!.nhan, tre: d.buoc === 'tre',
      url: `https://${khung.domain}/trackings/search?order=${encodeURIComponent(d.soDon)}&key=${encodeURIComponent(khoaDon.get(d.soDon)!)}${xem}` }));
  return { khung: khung.domain, muon: khung.khoa !== ch.khoa, trangChu: khung.khoa === ch.khoa ? `https://${ch.domain}/` : null,
    sanPham: khung.khoa === ch.khoa && sp ? `https://${ch.domain}/${sp.slug}` : null, theoDoi };
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

/* ── Hồ sơ trao đổi (khách / NCC) ── */
const fsTonTai = (p: string) => { try { return existsSync(p); } catch { return false; } };

export async function shopHoSo() { await admin(); return docHoSo(); }
export async function shopTinHoSo(id: number) { await admin(); return docTinHoSo(Number(id)); }

/** Mở hồ sơ tay (hoặc từ drawer đơn). soDon tra ra đơn của đúng cửa hàng; noiDung = tin đầu tiên (ai nói gì). */
export async function shopMoHoSo(v: { khoa: string; ben: Ben; loai: string; tieuDe: string; soDon?: string; ten?: string; email?: string; noiDung?: string; nguoi?: string }) {
  await admin();
  const ch = await cuaHangTheoKhoa(v.khoa);
  if (!ch) return { ok: false, loi: 'không thấy cửa hàng' };
  if (!LOAI_HO_SO[v.ben]?.some((l) => l.key === v.loai)) return { ok: false, loi: 'loại không hợp lệ' };
  if (!v.tieuDe?.trim()) return { ok: false, loi: 'thiếu tiêu đề' };
  const so = (v.soDon ?? '').replace(/^#/, '').trim();
  const [d] = so ? ((await db().execute(sql`SELECT id, khach->>'email' AS email, khach->>'ten' AS ten FROM shop_don WHERE cua_hang_id = ${ch.id} AND so_don = ${so} LIMIT 1`)) as unknown as { id: number; email: string; ten: string }[]) : [];
  if (so && !d) return { ok: false, loi: `không thấy đơn #${so}` };
  const h = await moHoSo({ cuaHangId: ch.id, ben: v.ben, loai: v.loai, tieuDe: v.tieuDe.trim(), donId: d?.id ?? null, nguon: 'tay', trangThai: 'dang_xu_ly',
    ten: v.ten?.trim() || (v.ben === 'ncc' ? 'CJ Dropshipping' : d?.ten) || null, email: v.email?.trim() || (v.ben === 'khach' ? d?.email : null) || null });
  if (v.noiDung?.trim()) await themTin(h.id, ['khach', 'ncc', 'minh'].includes(v.nguoi ?? '') ? v.nguoi! : 'minh', 'ghi_chu', v.noiDung.trim());
  if (d) await ghiSuKien(d.id, 'nguoi', `Mở hồ sơ ${v.ben === 'ncc' ? 'NCC' : 'khách'} #${h.id}: ${v.tieuDe.trim()}`);
  revalidatePath('/shop');
  return { ok: true, id: h.id };
}

export async function shopSuaHoSo(id: number, v: { trangThai?: string; loai?: string; ketQua?: string | null }) {
  await admin();
  if (v.trangThai && !TRANG_THAI_HO_SO.some((t) => t.key === v.trangThai)) return { ok: false, loi: 'trạng thái không hợp lệ' };
  await db().execute(sql`UPDATE shop_ho_so SET trang_thai = COALESCE(${v.trangThai ?? null}, trang_thai), loai = COALESCE(${v.loai ?? null}, loai),
    ket_qua = CASE WHEN ${v.ketQua !== undefined} THEN ${v.ketQua ?? null} ELSE ket_qua END, cap_nhat = now() WHERE id = ${id}`);
  if (v.trangThai) await themTin(id, 'may', 'ghi_chu', `Trạng thái → ${TRANG_THAI_HO_SO.find((t) => t.key === v.trangThai)!.nhan}${v.ketQua ? ` · ${v.ketQua}` : ''}`);
  revalidatePath('/shop');
  return { ok: true };
}

/** Ghi một tin vào luồng: ghi chú nội bộ, hoặc chép lại lời khách/NCC nói ở kênh khác (chat CJ, điện thoại…). Không gửi gì ra ngoài. */
export async function shopGhiTin(id: number, v: { nguoi: 'minh' | 'khach' | 'ncc'; noiDung: string }) {
  await admin();
  if (!v.noiDung.trim()) return { ok: false, loi: 'trống' };
  await themTin(id, ['minh', 'khach', 'ncc'].includes(v.nguoi) ? v.nguoi : 'minh', v.nguoi === 'minh' ? 'ghi_chu' : 'chep', v.noiDung.trim());
  if (v.nguoi !== 'minh') await db().execute(sql`UPDATE shop_ho_so SET trang_thai = CASE WHEN trang_thai IN ('cho_ho', 'moi') THEN 'dang_xu_ly' ELSE trang_thai END WHERE id = ${id}`);
  revalidatePath('/shop');
  return { ok: true };
}

/** Gửi thư trả lời khách (từ hộp support của shop, reply-to = hộp support) → tin "mình · email" + hồ sơ sang "Chờ bên kia". */
export async function shopTraLoiKhach(id: number, noiDung: string) {
  await admin();
  const nd = noiDung.trim();
  if (nd.length < 2) return { ok: false, loi: 'trống' };
  const [h] = (await db().execute(sql`SELECT h.email, h.ten, h.ben, d.so_don, c.khoa FROM shop_ho_so h JOIN shop_cua_hang c ON c.id = h.cua_hang_id
    LEFT JOIN shop_don d ON d.id = h.don_id WHERE h.id = ${id}`)) as unknown as { email: string | null; ten: string | null; ben: string; so_don: string | null; khoa: string }[];
  if (!h || h.ben !== 'khach') return { ok: false, loi: 'không phải hồ sơ khách' };
  if (!h.email) return { ok: false, loi: 'hồ sơ chưa có email khách' };
  const ch = (await cuaHangTheoKhoa(h.khoa))!;
  const m = matTien(ch.mat_tien), hop = m.email ?? `support@${ch.domain}`;
  const e = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  try {
    await guiThu({ khoa: ch.khoa, ten: ch.ten, domain: ch.domain, email: hop }, h.email, `Re: your message to ${ch.ten}${h.so_don ? ` · order #${h.so_don}` : ''}`,
      `<div style="white-space:pre-wrap;font-family:sans-serif;font-size:15px;line-height:1.5">${e(nd)}</div>`, nd, hop);
  } catch (x) {
    await themTin(id, 'minh', 'email', `GỬI LỖI (${(x as Error).message}):\n${nd}`, true);
    return { ok: false, loi: (x as Error).message };
  }
  await themTin(id, 'minh', 'email', nd);
  await db().execute(sql`UPDATE shop_ho_so SET trang_thai = 'cho_ho' WHERE id = ${id} AND trang_thai <> 'xong'`);
  revalidatePath('/shop');
  return { ok: true };
}

/* ── Tư vấn (chat mặt tiền) ── */
export async function shopTuVan() {
  await admin();
  // bảng đang mở = có người trực → ô chat mặt tiền báo "team online" (ghi tối đa 30 giây/lần)
  await db().execute(sql`UPDATE shop_cua_hang SET truc_luc = now() WHERE truc_luc IS NULL OR truc_luc < now() - interval '30 seconds'`);
  return docTuVan();
}
/** Anh duyệt (có thể đã sửa) → gửi vào chat (+ thư nếu khách đã rời trang và có email). */
export async function shopGuiChat(id: number, noiDung: string) {
  await admin();
  if (!noiDung.trim()) return { ok: false, loi: 'trống' };
  await guiTraLoi(Number(id), noiDung, 'minh');
  revalidatePath('/shop');
  return { ok: true };
}
export async function shopSoanLai(id: number) { await admin(); await soanTraLoi(Number(id), { epSoan: true }); return { ok: true }; }
export async function shopBoNhap(id: number) {
  await admin();
  await db().execute(sql`UPDATE shop_ho_so SET nhap = NULL WHERE id = ${Number(id)} AND loai = 'tu_van'`);
  await themTin(Number(id), 'minh', 'ghi_chu', 'Bỏ nháp máy soạn — không trả lời tin này');
  return { ok: true };
}

/* ── Sổ nhà cung cấp ── */
/** Sửa NCC; khoa rỗng = thêm NCC mới (khoá sinh từ tên). Kết nối API (co_api) không sửa ở đây — chỉ có khi đã viết bộ kết nối cho NCC đó. */
export async function shopSuaNcc(khoa: string, v: { ten: string; kenh?: string; website: string; taiKhoan: string; links: { nhan: string; url: string }[]; lienHe: { kenh: string; gia_tri: string; ten?: string }[]; ghiChu: string }) {
  await admin();
  if (!khoa) {
    const goc = v.ten.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'ncc';
    const co = (await db().execute(sql`SELECT khoa FROM shop_ncc WHERE khoa LIKE ${goc + '%'}`)) as unknown as { khoa: string }[];
    khoa = co.some((x) => x.khoa === goc) ? `${goc}_${co.length + 1}` : goc;
  }
  const kenh = v.kenh && v.kenh in KENH_NCC ? v.kenh : null;   // CJ là MỘT NCC; Alibaba/1688/AliExpress: mỗi nhà bán một NCC
  const url = (x: string) => (/^https?:\/\/\S+$/.test(x.trim()) ? x.trim().slice(0, 500) : null);
  if (!v.ten.trim()) return { ok: false, loi: 'thiếu tên NCC' };
  if (/mật khẩu|password|passwd/i.test(v.taiKhoan)) return { ok: false, loi: 'không lưu mật khẩu ở đây — chỉ mã/email tài khoản' };
  const links = v.links.map((l) => ({ nhan: l.nhan.trim().slice(0, 60), url: url(l.url) })).filter((l) => l.nhan && l.url).slice(0, 20);
  const lienHe = v.lienHe.map((l) => ({ kenh: ['email', 'whatsapp', 'skype', 'telegram', 'wechat', 'chat', 'phone', 'khac'].includes(l.kenh) ? l.kenh : 'khac',
    gia_tri: l.gia_tri.trim().slice(0, 300), ten: (l.ten ?? '').trim().slice(0, 80) })).filter((l) => l.gia_tri).slice(0, 20);
  await db().execute(sql`INSERT INTO shop_ncc (khoa, ten, kenh, website, tai_khoan, links, lien_he, ghi_chu, cap_nhat)
    VALUES (${khoa.slice(0, 40)}, ${v.ten.trim().slice(0, 120)}, ${kenh ?? 'khac'}, ${url(v.website ?? '')}, ${v.taiKhoan.trim().slice(0, 200) || null}, ${JSON.stringify(links)}::jsonb,
            ${JSON.stringify(lienHe)}::jsonb, ${v.ghiChu.trim().slice(0, 2000) || null}, now())
    ON CONFLICT (khoa) DO UPDATE SET ten = EXCLUDED.ten, kenh = COALESCE(${kenh}, shop_ncc.kenh), website = EXCLUDED.website, tai_khoan = EXCLUDED.tai_khoan, links = EXCLUDED.links,
      lien_he = EXCLUDED.lien_he, ghi_chu = EXCLUDED.ghi_chu, cap_nhat = now()`);
  revalidatePath('/shop');
  return { ok: true, khoa };
}

/** Số tiền đơn NCC đọc lại ngay lúc bấm trả (CJ getOrderDetail). */
export async function shopTienNcc(donId: number) { await admin(); return tienDonCj(Number(donId)); }

/** "Đọc lại NCC ngay": đọc lại ngay mọi sản phẩm NCC đang làm nguồn cho shop này (giá, biến thể, ngừng bán), đánh dấu tồn cũ để các nhịp kế
 *  đọc lại tồn từng biến thể, rồi chọn lại nguồn + áp lên mặt tiền. */
export async function shopDocLaiNcc(khoa: string) {
  await admin();
  const ch = await cuaHangTheoKhoa(khoa);
  if (!ch) return { ok: false, loi: 'không thấy cửa hàng' };
  const dung = sql`SELECT t.ncc_sp_id FROM shop_nguon g JOIN shop_ncc_bt t ON t.id = g.ncc_bt_id JOIN shop_bien_the b ON b.id = g.bien_the_id
    JOIN shop_san_pham p ON p.id = b.san_pham_id WHERE p.cua_hang_id = ${ch.id} AND g.bat`;
  await db().execute(sql`UPDATE shop_ncc_sp SET luc = NULL WHERE id IN (${dung})`);
  await db().execute(sql`UPDATE shop_ncc_bt SET ton_luc = NULL WHERE ncc_sp_id IN (${dung})`);
  const doc = await docDanhMucNcc(50);
  const nguon = await apNguon(ch);
  const ap = await apDungNcc(ch);
  revalidatePath('/shop');
  return { ok: true, doc, nguon, ap };
}
