// SHOP — máy chạy: kéo đơn/sản phẩm từ Woo về sổ, đặt đơn sang nhà cung cấp (CJ), kéo vận đơn, báo khách, ghi sổ PHỦ.
// Gọi từ: webhook Woo (/api/shop/woo/<khoa>, một đơn), nhịp /api/shop/cron (mỗi 10 phút, mọi cửa hàng), nút trong /shop.
// Thay luồng CJ của mu-plugin mellowstep-cj.php (từ 01/10/2026 plugin tắt các bước 1/3/4 bằng MS_QUA_MOS2).
// Hai loại mặt tiền (shop_cua_hang.nen_tang): 'woo' — đơn/sản phẩm kéo từ WordPress, báo khách qua ghi chú Woo; 'mos' — mặt tiền
// apps/store, đơn ghi thẳng vào sổ lúc trả tiền (@mos2/shop/thanh-toan), báo khách bằng thư của chính máy này.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { cj, linkVanDon, meta, ngayToiDa, woo, wooHet, type WooBt, type WooDon, type WooSp } from './nguon';
import { co17, dangKy17, tin17 } from './track17';
import { dsVideo } from '@mos2/shop/video';
import { moHoSo, themTin } from '@mos2/shop/ho-so-ghi';
import { coStripe, stripe } from '@mos2/shop/stripe';
import { CHANG, hanhTrinh } from '@mos2/shop/hanh-trinh';
import { CHANG_BAO_THU, CHANG_KHACH, cauHinhGiao, duKienGiao } from '@mos2/shop/giao';
import { thuChang, thuCoHang } from '@mos2/shop/thu';
import { isoCua } from './buoc';
import type { Moc } from './track17';
import { doiSoat, ghiSoPhuDon, ghiSuKien, guiThu, linkTheoDoi, matTien, sidTuUtm, thuDaGui, type MatTien } from '@mos2/shop';
import { batThu } from '@mos2/shop/mat-tien';

export type CuaHang = { id: number; khoa: string; project_id: string; ten: string; domain: string; ncc: string; nen_tang: string; mat_tien: MatTien;
  cau_hinh: { ngay_ship_max?: number; tu_sang_ncc?: boolean; tu_tra_ncc?: boolean; quoc_gia_kho?: string; ga4_property?: string; tu_an_het?: boolean; bien_toi_thieu?: number; ton_thap?: number }; trang_thai: string; dong_bo_luc: string | null };

type Row = Record<string, unknown>;
const db = () => { const d = getDb(); if (!d) throw new Error('chưa nối DB'); return d; };
const q = async <T = Row>(s: ReturnType<typeof sql>) => (await db().execute(s)) as unknown as T[];

export async function dsCuaHang(chiBat = true): Promise<CuaHang[]> {
  return q<CuaHang>(sql`SELECT id, khoa, project_id, ten, domain, ncc, nen_tang, mat_tien, cau_hinh, trang_thai, dong_bo_luc::text FROM shop_cua_hang
                        ${chiBat ? sql`WHERE trang_thai = 'bat'` : sql``} ORDER BY id`);
}
export async function cuaHangTheoKhoa(khoa: string) { return (await dsCuaHang(false)).find((c) => c.khoa === khoa) ?? null; }

export { ghiSuKien, linkTheoDoi };

/* ── SẢN PHẨM ─────────────────────────────────────────────────────────────── */
/** Kéo sản phẩm + biến thể (cửa hàng woo). Mã NCC / giá vốn: Woo (meta _cj_*) chỉ GIEO khi sổ còn trống — sửa ở /shop thì sổ là gốc
 *  (và được ghi ngược về Woo, xem suaBienThe). Nội dung mặt tiền (slug, ảnh, mô tả, tuỳ chọn, giá gạch) Woo là gốc — tới lúc chuyển sang
 *  mặt tiền mos (nen_tang='mos') thì hàm này thôi chạy và sổ thành gốc. tieu_de (H1 bán hàng) không có ở Woo nên không đụng. */
export async function dongBoSanPham(ch: CuaHang) {
  const sps = await wooHet<WooSp>(ch, 'products?status=any');
  const giaGoc = (thuong: string, ban: string) => (thuong && Number(thuong) > Number(ban || thuong) ? Number(thuong) : null);
  let soBt = 0;
  for (const p of sps) {
    const tuyChon = (p.attributes ?? []).filter((a) => a.variation || p.type !== 'variable').map((a) => ({ ten: a.name, gia_tri: a.options }));
    const sp = (await q<{ id: number }>(sql`
      INSERT INTO shop_san_pham (cua_hang_id, ma_ngoai, ten, anh, link, trang_thai, ncc, slug, mo_ta, anh_ds, tuy_chon, gia_goc, hien, thu_tu, updated_at)
      VALUES (${ch.id}, ${String(p.id)}, ${p.name}, ${p.images?.[0]?.src ?? null}, ${p.permalink}, ${p.status}, ${ch.ncc},
              ${p.slug}, ${p.description || null}, ${JSON.stringify((p.images ?? []).map((i) => i.src))}::jsonb, ${JSON.stringify(tuyChon)}::jsonb,
              ${giaGoc(p.regular_price, p.sale_price)}, ${p.status === 'publish'}, ${p.menu_order ?? 0}, now())
      ON CONFLICT (cua_hang_id, ma_ngoai) DO UPDATE SET ten = EXCLUDED.ten, anh = EXCLUDED.anh, link = EXCLUDED.link,
        trang_thai = EXCLUDED.trang_thai, slug = EXCLUDED.slug, mo_ta = EXCLUDED.mo_ta,
        anh_ds = EXCLUDED.anh_ds, tuy_chon = EXCLUDED.tuy_chon, gia_goc = EXCLUDED.gia_goc, hien = EXCLUDED.hien, thu_tu = EXCLUDED.thu_tu, updated_at = now()
      RETURNING id`))[0]!;
    const bts = p.type === 'variable'
      ? (await wooHet<WooBt>(ch, `products/${p.id}/variations`)).map((v) => ({ id: v.id, sku: v.sku, ten: v.attributes.map((a) => a.option).join(' / ') || `#${v.id}`,
          gia: v.price, goc: giaGoc(v.regular_price, v.sale_price), anh: v.image?.src ?? null, het: v.stock_status === 'outofstock',
          tc: Object.fromEntries(v.attributes.map((a) => [a.name, a.option])), meta: v.meta_data }))
      : [{ id: p.id, sku: p.sku, ten: p.name, gia: p.price, goc: giaGoc(p.regular_price, p.sale_price), anh: null, het: p.stock_status === 'outofstock', tc: {}, meta: p.meta_data }];
    for (const v of bts) {
      soBt++;
      const gv = meta(v.meta, '_cj_gia_von');
      const [bt] = await q<{ id: number; co_nguon: boolean }>(sql`
        INSERT INTO shop_bien_the (san_pham_id, ma_ngoai, sku, ten, gia_ban, gia_von, tuy_chon, anh, gia_goc, het_hang, updated_at)
        VALUES (${sp.id}, ${String(v.id)}, ${v.sku || null}, ${v.ten}, ${v.gia ? Number(v.gia) : null}, ${gv ? Number(gv) : null},
                ${JSON.stringify(v.tc)}::jsonb, ${v.anh}, ${v.goc}, ${v.het}, now())
        ON CONFLICT (san_pham_id, ma_ngoai) DO UPDATE SET sku = EXCLUDED.sku, ten = EXCLUDED.ten, gia_ban = EXCLUDED.gia_ban,
          gia_von = COALESCE(shop_bien_the.gia_von, EXCLUDED.gia_von),
          tuy_chon = EXCLUDED.tuy_chon, anh = EXCLUDED.anh, gia_goc = EXCLUDED.gia_goc, het_hang = EXCLUDED.het_hang, updated_at = now()
        RETURNING id, EXISTS (SELECT 1 FROM shop_nguon n WHERE n.bien_the_id = shop_bien_the.id) AS co_nguon`);
      // meta _cj_pid/_cj_vid của Woo chỉ GIEO nguồn chính khi biến thể chưa có nguồn nào — sửa ở /shop thì sổ nguồn là gốc
      const pid = meta(p.meta_data, '_cj_pid'), vid = meta(v.meta, '_cj_vid');
      if (bt && !bt.co_nguon && pid && vid) await ganNguon(bt.id, ch.ncc, pid, vid, { gia: gv ? Number(gv) : null, kiemMau: true });
    }
  }
  return { sanPham: sps.length, bienThe: soBt };
}

/* ── DANH MỤC NCC — DÙNG CHUNG MỌI SHOP (migration 0205) ─────────────────────
 * Cây: kênh (shop_ncc.kenh) → NCC (shop_ncc) → sản phẩm NCC (shop_ncc_sp) → biến thể NCC (shop_ncc_bt) ⇄ biến thể shop (shop_nguon, nhiều-nhiều).
 * Mỗi pid đọc MỘT lần / ngày dù bao nhiêu shop bán; biến động phía NCC ghi MỘT lần (không gắn shop). Chỉ NCC co_api (hiện: CJ) đọc tự động. */
type CjSp = { pid?: string; productNameEn?: string; productSku?: string; productVideo?: unknown; listedNum?: number; supplierId?: string | null; status?: string | number;
  sellPrice?: string; categoryName?: string; productWeight?: string; packingWeight?: string; materialNameEn?: unknown; packingNameEn?: unknown; entryNameEn?: string;
  suggestSellPrice?: string | number; createrTime?: string; productImageSet?: string[]; description?: string;
  variants?: { vid: string; variantSellPrice?: number; variantNameEn?: string; variantKey?: string; variantSku?: string; variantImage?: string;
    variantWeight?: number; variantLength?: number; variantWidth?: number; variantHeight?: number; variantSugSellPrice?: number }[] };

/** CJ trả mảng tên dạng chuỗi JSON '["Cloth","Others"]' hoặc mảng thật — gộp thành 'Cloth, Others'. */
function chuoiDs(x: unknown): string | null {
  let a: unknown = x;
  if (typeof x === 'string') { try { a = JSON.parse(x); } catch { return x || null; } }
  return Array.isArray(a) ? a.map(String).join(', ') || null : null;
}

/** Một dòng biến động. Phía NCC (giá, gỡ/về lại, ngừng/bán lại, tồn thấp): nccSp/nccBt, không shop. Phía shop (tự ẩn, mở lại, đổi nguồn): ch + bt. */
const ghiBienDong = (x: { ch?: number; sp?: number; bt?: number; nccSp?: number; nccBt?: number; loai: string; cu: string | null; moi: string | null }) =>
  q(sql`INSERT INTO shop_ncc_bien_dong (cua_hang_id, san_pham_id, bien_the_id, ncc_sp_id, ncc_bt_id, loai, cu, moi)
        VALUES (${x.ch ?? null}, ${x.sp ?? null}, ${x.bt ?? null}, ${x.nccSp ?? null}, ${x.nccBt ?? null}, ${x.loai}, ${x.cu}, ${x.moi})`);

/** Đọc MỘT sản phẩm CJ (product/query) vào danh mục: sản phẩm + mọi biến thể (giá, tên, SKU, ảnh, cân/kích thước); ghi biến động khi đổi.
 *  Gọi từ nhịp (sản phẩm đang có nguồn bật, cũ hơn 1 ngày) và khi người thêm nguồn mới bằng mã CJ. */
export async function docSpCj(ma: string): Promise<{ id: number | null; loi?: string }> {
  const [cu] = await q<{ id: number; dang_ban: boolean | null }>(sql`SELECT id, dang_ban FROM shop_ncc_sp WHERE ncc = 'cj' AND ma = ${ma}`);
  const r = await cj<CjSp>(`product/query?pid=${encodeURIComponent(ma)}`);
  if (!r.result || !r.data) {
    const loi = r.message ?? 'CJ không trả';
    if (cu) await q(sql`UPDATE shop_ncc_sp SET loi = ${loi}, luc = now() WHERE id = ${cu.id}`);
    return { id: cu?.id ?? null, loi };
  }
  const d = r.data, dangBan = String(d.status) === '3';
  const info = { sku: d.productSku ?? '', listed: d.listedNum ?? null, supplier_id: d.supplierId ?? null, video: dsVideo(d.productVideo),
    chi_tiet: { danh_muc: d.categoryName ?? null, loai: d.entryNameEn ?? null, can_nang: d.productWeight ?? null, can_dong_goi: d.packingWeight ?? null,
      chat_lieu: chuoiDs(d.materialNameEn), dong_goi: chuoiDs(d.packingNameEn), gia_goi_y: Number(d.suggestSellPrice) || null, tao_luc: d.createrTime ?? null,
      anh: (d.productImageSet ?? []).slice(0, 12), mo_ta: String(d.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500) } };
  const [sp] = await q<{ id: number }>(sql`
    INSERT INTO shop_ncc_sp (ncc, ma, ten, info, dang_ban, luc, loi) VALUES ('cj', ${ma}, ${d.productNameEn ?? null}, ${JSON.stringify(info)}::jsonb, ${dangBan}, now(), NULL)
    ON CONFLICT (ncc, ma) DO UPDATE SET ten = EXCLUDED.ten, info = EXCLUDED.info, dang_ban = EXCLUDED.dang_ban, luc = now(), loi = NULL RETURNING id`);
  const spId = sp!.id;
  if (cu && cu.dang_ban !== null && cu.dang_ban !== dangBan)
    await ghiBienDong({ nccSp: spId, loai: dangBan ? 'ban_lai' : 'ngung', cu: cu.dang_ban ? 'NCC đang bán' : 'NCC ngừng bán', moi: dangBan ? 'NCC bán lại' : 'NCC ngừng bán' });
  const coSan = new Map((await q<{ id: number; ma: string; gia: string | null; mat: boolean }>(sql`SELECT id, ma, gia::text, mat FROM shop_ncc_bt WHERE ncc_sp_id = ${spId}`)).map((x) => [x.ma, x]));
  const thay = new Set<string>();
  for (const v of d.variants ?? []) {
    thay.add(v.vid);
    const gia = Number(v.variantSellPrice) || null, c = coSan.get(v.vid);
    const vi = { anh: v.variantImage ?? null, can: Number(v.variantWeight) || null, kich: v.variantLength ? `${v.variantLength}×${v.variantWidth}×${v.variantHeight} mm` : null,
      gia_goi_y: Number(v.variantSugSellPrice) || null };
    const [bt] = await q<{ id: number }>(sql`
      INSERT INTO shop_ncc_bt (ncc_sp_id, ma, ten, sku, gia, info, mat) VALUES (${spId}, ${v.vid}, ${v.variantKey || v.variantNameEn || v.vid}, ${v.variantSku ?? null}, ${gia}, ${JSON.stringify(vi)}::jsonb, false)
      ON CONFLICT (ncc_sp_id, ma) DO UPDATE SET ten = EXCLUDED.ten, sku = EXCLUDED.sku, gia = EXCLUDED.gia, info = EXCLUDED.info, mat = false RETURNING id`);
    if (c?.mat) await ghiBienDong({ nccSp: spId, nccBt: bt!.id, loai: 've_lai', cu: 'không còn trên NCC', moi: 'có lại trên NCC' });
    if (c && c.gia !== null && gia && Math.abs(Number(c.gia) - gia) > 0.009) await ghiBienDong({ nccSp: spId, nccBt: bt!.id, loai: 'gia', cu: `$${Number(c.gia).toFixed(2)}`, moi: `$${gia.toFixed(2)}` });
  }
  for (const [ma2, c] of coSan) if (!thay.has(ma2) && !c.mat) {
    await q(sql`UPDATE shop_ncc_bt SET mat = true WHERE id = ${c.id}`);
    await ghiBienDong({ nccSp: spId, nccBt: c.id, loai: 'go', cu: 'có trên NCC', moi: 'không còn trên NCC' });
  }
  return { id: spId };
}

/** Nhịp danh mục: ≤ 20 sản phẩm CJ đang có nguồn bật (hoặc chưa đọc lần nào), cũ hơn 1 ngày. CJ ~1 lượt/giây → tuần tự, nghỉ 1,1 giây. */
export async function docDanhMucNcc(gioiHan = 20) {
  const ds = await q<{ ma: string }>(sql`
    SELECT s.ma FROM shop_ncc_sp s JOIN shop_ncc n ON n.khoa = s.ncc
     WHERE n.kenh = 'cj' AND n.co_api AND s.ncc = 'cj' AND (s.luc IS NULL OR s.luc < now() - interval '1 day')
       AND (s.luc IS NULL OR EXISTS (SELECT 1 FROM shop_ncc_bt t JOIN shop_nguon g ON g.ncc_bt_id = t.id WHERE t.ncc_sp_id = s.id AND g.bat))
     ORDER BY s.luc NULLS FIRST LIMIT ${gioiHan}`);
  let loi = 0;
  for (const s of ds) { if ((await docSpCj(s.ma)).loi) loi++; await new Promise((ok) => setTimeout(ok, 1100)); }
  return { doc: ds.length, loi };
}

/** Tồn CJ từng biến thể NCC đang làm nguồn (product/stock/queryByVid, ~1/giây): ≤ 50 / nhịp, mỗi biến thể ~1 lần/ngày.
 *  Ngưỡng tồn thấp = ngưỡng CAO nhất trong các shop đang dùng biến thể đó (shop nào khó tính nhất thì báo theo shop đó). */
export async function docTonNcc(gioiHan = 50) {
  const ds = await q<{ id: number; ma: string; ncc_sp_id: number; ton: number | null; nguong: number }>(sql`
    SELECT t.id, t.ma, t.ncc_sp_id, t.ton,
           (SELECT MAX(COALESCE((c.cau_hinh->>'ton_thap')::int, 50)) FROM shop_nguon g JOIN shop_bien_the b ON b.id = g.bien_the_id
              JOIN shop_san_pham p ON p.id = b.san_pham_id JOIN shop_cua_hang c ON c.id = p.cua_hang_id WHERE g.ncc_bt_id = t.id AND g.bat) AS nguong
      FROM shop_ncc_bt t JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id JOIN shop_ncc n ON n.khoa = s.ncc
     WHERE n.kenh = 'cj' AND n.co_api AND NOT t.mat AND (t.ton_luc IS NULL OR t.ton_luc < now() - interval '20 hours')
       AND EXISTS (SELECT 1 FROM shop_nguon g WHERE g.ncc_bt_id = t.id AND g.bat)
     ORDER BY t.ton_luc NULLS FIRST LIMIT ${gioiHan}`);
  for (const t of ds) {
    const r = await cj<{ totalInventoryNum?: number; areaEn?: string; countryCode?: string }[]>(`product/stock/queryByVid?vid=${encodeURIComponent(t.ma)}`);
    if (r.result) {
      const kho = (r.data ?? []).map((x) => ({ kho: x.areaEn ?? '', nuoc: x.countryCode ?? '', so: Number(x.totalInventoryNum) || 0 }));
      const ton = kho.reduce((s, x) => s + x.so, 0);
      await q(sql`UPDATE shop_ncc_bt SET ton = ${ton}, ton_kho = ${JSON.stringify(kho)}::jsonb, ton_luc = now() WHERE id = ${t.id}`);
      if (ton > 0 && ton < t.nguong && (t.ton == null || t.ton >= t.nguong))
        await ghiBienDong({ nccSp: t.ncc_sp_id, nccBt: t.id, loai: 'ton_thap', cu: t.ton == null ? '—' : String(t.ton), moi: `${ton} (< ${t.nguong})` });
      if (ton === 0 && t.ton !== 0) await ghiBienDong({ nccSp: t.ncc_sp_id, nccBt: t.id, loai: 'het_ncc', cu: t.ton == null ? '—' : String(t.ton), moi: '0' });
    }
    await new Promise((ok) => setTimeout(ok, 1100));
  }
  return { doc: ds.length };
}

/** Phần NCC của một nhịp — chạy MỘT lần cho mọi shop (cron gọi trước vòng từng shop). */
export async function dongBoNccChung() {
  const sp = await docDanhMucNcc().catch((e) => ({ loi: (e as Error).message }));
  const ton = await docTonNcc().catch((e) => ({ loi: (e as Error).message }));
  return { sp, ton };
}

/** Gắn một nguồn cho biến thể shop: (NCC · mã sản phẩm · mã biến thể) — tạo dòng danh mục nếu chưa có. Nguồn đầu tiên = chính (ưu tiên 1),
 *  sau đó xếp cuối hàng dự phòng. Đã có mà đang tắt thì bật lại. */
export async function ganNguon(btId: number, ncc: string, maSp: string, maBt: string, o: { tenSp?: string | null; tenBt?: string | null; gia?: number | null; kiemMau?: boolean } = {}) {
  const [s] = await q<{ id: number }>(sql`INSERT INTO shop_ncc_sp (ncc, ma, ten) VALUES (${ncc}, ${maSp}, ${o.tenSp ?? null})
    ON CONFLICT (ncc, ma) DO UPDATE SET ten = COALESCE(shop_ncc_sp.ten, EXCLUDED.ten) RETURNING id`);
  const [t] = await q<{ id: number }>(sql`INSERT INTO shop_ncc_bt (ncc_sp_id, ma, ten, gia) VALUES (${s!.id}, ${maBt}, ${o.tenBt ?? null}, ${o.gia ?? null})
    ON CONFLICT (ncc_sp_id, ma) DO UPDATE SET ten = COALESCE(shop_ncc_bt.ten, EXCLUDED.ten), gia = COALESCE(EXCLUDED.gia, shop_ncc_bt.gia) RETURNING id`);
  const [n] = await q<{ id: number }>(sql`
    INSERT INTO shop_nguon (bien_the_id, ncc_bt_id, uu_tien, kiem_mau)
    VALUES (${btId}, ${t!.id}, (SELECT COALESCE(MAX(uu_tien), 0) + 1 FROM shop_nguon WHERE bien_the_id = ${btId} AND bat), ${o.kiemMau ?? false})
    ON CONFLICT (bien_the_id, ncc_bt_id) DO UPDATE SET bat = true RETURNING id`);
  return n!.id;
}

/** CHỌN NGUỒN — chỗ DUY NHẤT ghi ảnh nguồn lên biến thể shop (nguon_id, nguon_ok, ma_ncc, gia_ncc, gia_von, ton_*, ncc_mat).
 *  Luật: trong các nguồn đang bật, lấy nguồn ưu tiên cao nhất BÁN ĐƯỢC (còn trên NCC, tồn > 0 hoặc chưa đọc, NCC đang bán sản phẩm) và ĐƯỢC PHÉP
 *  (nguồn chính luôn được; dự phòng phải đã kiểm mẫu VÀ biên ≥ biên tối thiểu của shop). Không nguồn nào bán được → giữ nguồn chính, nguon_ok = false
 *  (apDungNcc tự ẩn). Đổi nguồn đang dùng → ghi biến động 'doi_nguon'. Gieo video từ sản phẩm NCC của nguồn đang dùng nếu shop chưa có. */
export async function apNguon(ch: CuaHang) {
  const bienMin = ch.cau_hinh.bien_toi_thieu ?? 0;
  const doi = await q<{ id: number; san_pham_id: number; cu: number | null; moi: number }>(sql`
    WITH ds AS (
      SELECT n.id, n.bien_the_id, n.uu_tien, n.kiem_mau, t.ma AS vid, t.gia, t.ton, t.ton_kho, t.ton_luc, t.mat, s.dang_ban, b.gia_ban,
             n.uu_tien = MIN(n.uu_tien) OVER (PARTITION BY n.bien_the_id) AS chinh
        FROM shop_nguon n JOIN shop_ncc_bt t ON t.id = n.ncc_bt_id JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id
        JOIN shop_bien_the b ON b.id = n.bien_the_id JOIN shop_san_pham p ON p.id = b.san_pham_id
       WHERE p.cua_hang_id = ${ch.id} AND n.bat
    ), x AS (
      SELECT *, (NOT mat AND COALESCE(ton, 1) > 0 AND dang_ban IS NOT FALSE) AS con,
             (chinh OR (kiem_mau AND (gia IS NULL OR COALESCE(gia_ban, 0) <= 0 OR (gia_ban - gia) / gia_ban * 100 >= ${bienMin}))) AS duoc
        FROM ds
    ), chon AS (
      SELECT DISTINCT ON (bien_the_id) * FROM x ORDER BY bien_the_id, (con AND duoc) DESC, uu_tien, id
    ), truoc AS (
      SELECT b.id, b.nguon_id FROM shop_bien_the b JOIN chon c ON c.bien_the_id = b.id
    )
    UPDATE shop_bien_the b SET nguon_id = c.id, nguon_ok = (c.con AND c.duoc), ma_ncc = c.vid, gia_ncc = c.gia, gia_von = COALESCE(c.gia, b.gia_von),
           ton_ncc = c.ton, ton_kho = c.ton_kho, ton_luc = c.ton_luc, ncc_mat = c.mat
      FROM chon c, truoc t WHERE b.id = c.bien_the_id AND t.id = b.id
    RETURNING b.id, b.san_pham_id, t.nguon_id AS cu, c.id AS moi`);
  for (const d of doi) if (d.cu !== null && d.cu !== d.moi) {
    const [ten] = await q<{ cu: string | null; moi: string | null }>(sql`
      SELECT (SELECT n.uu_tien || ' · ' || s.ncc || ' ' || COALESCE(t.ten, t.ma) FROM shop_nguon n JOIN shop_ncc_bt t ON t.id = n.ncc_bt_id JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id WHERE n.id = ${d.cu}) AS cu,
             (SELECT n.uu_tien || ' · ' || s.ncc || ' ' || COALESCE(t.ten, t.ma) FROM shop_nguon n JOIN shop_ncc_bt t ON t.id = n.ncc_bt_id JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id WHERE n.id = ${d.moi}) AS moi`);
    await ghiBienDong({ ch: ch.id, sp: d.san_pham_id, bt: d.id, loai: 'doi_nguon', cu: ten?.cu ? `nguồn ${ten.cu}` : null, moi: ten?.moi ? `nguồn ${ten.moi}` : null });
  }
  // biến thể không còn nguồn nào bật → xoá ảnh nguồn (thành "thiếu nguồn"; đơn có món này không sang được NCC)
  await q(sql`UPDATE shop_bien_the b SET nguon_id = NULL, nguon_ok = NULL, ma_ncc = NULL, gia_ncc = NULL, ton_ncc = NULL, ton_kho = NULL, ton_luc = NULL, ncc_mat = false
    FROM shop_san_pham p WHERE p.id = b.san_pham_id AND p.cua_hang_id = ${ch.id} AND b.nguon_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM shop_nguon n WHERE n.bien_the_id = b.id AND n.bat)`);
  const video = await q(sql`
    UPDATE shop_san_pham p SET video = v.video, video_luc = now()
      FROM (SELECT DISTINCT ON (b.san_pham_id) b.san_pham_id, s.info->'video' AS video
              FROM shop_bien_the b JOIN shop_nguon n ON n.id = b.nguon_id JOIN shop_ncc_bt t ON t.id = n.ncc_bt_id JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id
             WHERE jsonb_array_length(COALESCE(s.info->'video', '[]'::jsonb)) > 0 ORDER BY b.san_pham_id, n.uu_tien) v
     WHERE p.id = v.san_pham_id AND p.cua_hang_id = ${ch.id} AND p.video_luc IS NULL AND p.video = '[]'::jsonb RETURNING p.id`);
  return { chon: doi.length, doi: doi.filter((d) => d.cu !== null && d.cu !== d.moi).length, video: video.length };
}

/** Áp nguồn lên mặt tiền: biến thể có nguồn mà KHÔNG nguồn nào bán được (nguon_ok = false) → het_hang (cờ het_tu_dong); bán được lại → mở + thư
 *  "Back in stock" cho người đã đăng ký. Có dự phòng đã kiểm mẫu thì nguồn chính hết KHÔNG làm ẩn (apNguon đã chuyển sang dự phòng).
 *  Tắt được ở Cài đặt › Vận hành (cau_hinh.tu_an_het). Ẩn TAY (het_hang không cờ) không bao giờ bị mở. */
export async function apDungNcc(ch: CuaHang) {
  if (ch.cau_hinh.tu_an_het === false) return { an: 0, mo: 0, bao: 0 };
  const an = await q<{ id: number; san_pham_id: number }>(sql`
    UPDATE shop_bien_the b SET het_hang = true, het_tu_dong = true, updated_at = now() FROM shop_san_pham p
     WHERE p.id = b.san_pham_id AND p.cua_hang_id = ${ch.id} AND b.nguon_id IS NOT NULL AND b.nguon_ok = false AND NOT b.het_hang RETURNING b.id, b.san_pham_id`);
  for (const b of an) await ghiBienDong({ ch: ch.id, sp: b.san_pham_id, bt: b.id, loai: 'het', cu: 'đang bán', moi: 'tự ẩn — hết mọi nguồn' });
  const mo = await q<{ id: number; san_pham_id: number }>(sql`
    UPDATE shop_bien_the b SET het_hang = false, het_tu_dong = false, updated_at = now() FROM shop_san_pham p
     WHERE p.id = b.san_pham_id AND p.cua_hang_id = ${ch.id} AND b.het_tu_dong AND b.nguon_ok RETURNING b.id, b.san_pham_id`);
  for (const b of mo) await ghiBienDong({ ch: ch.id, sp: b.san_pham_id, bt: b.id, loai: 'co_lai', cu: 'tự ẩn', moi: 'mở bán lại — có nguồn bán được' });
  // Thư "có hàng lại": người đăng ký theo biến thể vừa mở, hoặc theo cả sản phẩm khi sản phẩm có ít nhất một biến thể bán được
  let bao = 0;
  const m = matTien(ch.mat_tien);
  if (batThu(m, 'co_hang') && ch.trang_thai === 'bat') {   // shop demo: không gửi thư thật
    const cho = await q<{ id: number; email: string; ten: string; slug: string | null }>(sql`
      SELECT k.id, k.email, p.ten, p.slug FROM shop_bao_co_hang k JOIN shop_san_pham p ON p.id = k.san_pham_id
       WHERE k.cua_hang_id = ${ch.id} AND k.da_bao IS NULL AND p.hien
         AND ((k.bien_the_id IS NOT NULL AND EXISTS (SELECT 1 FROM shop_bien_the b WHERE b.id = k.bien_the_id AND NOT b.het_hang))
           OR (k.bien_the_id IS NULL AND EXISTS (SELECT 1 FROM shop_bien_the b WHERE b.san_pham_id = p.id AND NOT b.het_hang))) LIMIT 50`);
    const s = { khoa: ch.khoa, ten: ch.ten, domain: ch.domain, email: m.email ?? `support@${ch.domain}` };
    for (const k of cho) {
      const thu = thuCoHang(s, k.ten, `https://${ch.domain}/${k.slug ?? ''}`);
      try { await guiThu(s, k.email, thu.tieuDe, thu.html, thu.chu); await q(sql`UPDATE shop_bao_co_hang SET da_bao = now() WHERE id = ${k.id}`); bao++; } catch { /* nhịp sau thử lại */ }
    }
  }
  return { an: an.length, mo: mo.length, bao };
}

/* ── HỒ SƠ TỰ ĐỔ: dispute Stripe (phía khách) + dispute CJ (phía NCC) ──────────── */
type DisputeStripe = { id: string; amount: number; status: string; reason: string; payment_intent: string | null; evidence_details?: { due_by?: number | null } };
const XONG_STRIPE: Record<string, string> = { won: 'Thắng dispute', lost: 'Thua dispute — tiền đã bị trừ', warning_closed: 'Ngân hàng đóng cảnh báo', charge_refunded: 'Đã hoàn tiền' };

/** Đọc (không ghi gì sang Stripe/CJ). Tài khoản Stripe dùng chung nhiều site → chỉ nhận dispute có PaymentIntent thuộc sổ của shop này. */
export async function dongBoHoSo(ch: CuaHang) {
  const kq = { stripe: 0, cj: 0, moi: 0 };
  if (ch.nen_tang === 'mos' && coStripe(ch.khoa)) {
    const tu = Math.floor(Date.now() / 1000) - 120 * 86400;
    const r = await stripe<{ data: DisputeStripe[] }>(ch.khoa, 'GET', `disputes?limit=100&created[gte]=${tu}`);
    for (const x of r.data) {
      if (!x.payment_intent) continue;
      const [tt] = await q<{ don_id: number | null; email: string | null; ten: string | null }>(sql`
        SELECT don_id, khach->>'email' AS email, khach->>'ten' AS ten FROM shop_thanh_toan WHERE pi = ${x.payment_intent} AND cua_hang_id = ${ch.id}`);
      if (!tt) continue;
      kq.stripe++;
      const han = x.evidence_details?.due_by ? new Date(x.evidence_details.due_by * 1000).toISOString() : null;
      const h = await moHoSo({ cuaHangId: ch.id, ben: 'khach', loai: 'dispute', tieuDe: `Dispute Stripe · ${x.reason}`, donId: tt.don_id, ten: tt.ten, email: tt.email,
        nguon: 'stripe', maNgoai: x.id, soTien: x.amount / 100, han });
      if (h.moi) {
        kq.moi++;
        await themTin(h.id, 'may', 'stripe', `Stripe báo dispute ${x.id}: lý do "${x.reason}", $${(x.amount / 100).toFixed(2)}, trạng thái ${x.status}${han ? `, hạn nộp bằng chứng ${han.slice(0, 10)}` : ''}. Nộp bằng chứng trong Stripe Dashboard.`);
        if (tt.don_id) await ghiSuKien(tt.don_id, 'shop', `Khách mở dispute qua ngân hàng (${x.reason}) — hồ sơ #${h.id}`, true);
      }
      const xong = XONG_STRIPE[x.status];
      if (xong) {
        const doi = await q(sql`UPDATE shop_ho_so SET trang_thai = 'xong', ket_qua = ${xong}, cap_nhat = now() WHERE id = ${h.id} AND trang_thai <> 'xong' RETURNING id`);
        if (doi.length) await themTin(h.id, 'may', 'stripe', `Stripe: ${xong} (${x.status}).`);
      } else if (x.status === 'under_review') {
        const doi = await q(sql`UPDATE shop_ho_so SET trang_thai = 'cho_ho', cap_nhat = now() WHERE id = ${h.id} AND trang_thai IN ('moi', 'dang_xu_ly') RETURNING id`);
        if (doi.length) await themTin(h.id, 'may', 'stripe', 'Stripe: bằng chứng đã nộp, ngân hàng đang xem xét.');
      }
    }
  }
  if (ch.ncc === 'cj') {
    const r = await cj<{ list?: Record<string, unknown>[] }>('disputes/getDisputeList?pageNum=1&pageSize=50');
    for (const x of r.data?.list ?? []) {
      const ma = String(x.id ?? x.disputeId ?? ''), orderId = String(x.orderId ?? x.cjOrderId ?? '');
      if (!ma || !orderId) continue;
      const [n] = await q<{ don_id: number }>(sql`SELECT n.don_id FROM shop_don_ncc n JOIN shop_don d ON d.id = n.don_id WHERE n.ma_ncc = ${orderId} AND d.cua_hang_id = ${ch.id} LIMIT 1`);
      if (!n) continue;
      kq.cj++;
      const lyDo = String(x.disputeReason ?? x.reason ?? x.disputeReasonName ?? 'khiếu nại');
      const tien = Number(x.money ?? x.refundAmount ?? x.amount ?? 0) || null;
      const h = await moHoSo({ cuaHangId: ch.id, ben: 'ncc', loai: 'khieu_nai', tieuDe: `Dispute CJ · ${lyDo}`, donId: n.don_id, ten: 'CJ Dropshipping',
        nguon: 'cj', maNgoai: ma, soTien: tien });
      if (h.moi) { kq.moi++; await themTin(h.id, 'may', 'cj', `CJ có dispute ${ma} cho đơn CJ ${orderId}: ${JSON.stringify(x).slice(0, 1500)}`); }
    }
  }
  return kq;
}

/* ── ĐƠN ──────────────────────────────────────────────────────────────────── */
const sidCua = (o: WooDon) => sidTuUtm(meta(o.meta_data, '_wc_order_attribution_utm_source'), meta(o.meta_data, '_wc_order_attribution_utm_campaign'),
  meta(o.meta_data, '_wc_order_attribution_source_type'));
const gmt = (s: string | null | undefined) => (s ? `${s}Z` : null);

/** Ghi một đơn Woo vào sổ (tạo hoặc cập nhật) + nhật ký đổi trạng thái + sổ PHỦ. Trả id đơn trong sổ. */
export async function ghiDon(ch: CuaHang, o: WooDon): Promise<number> {
  const s = o.shipping?.address_1 ? o.shipping : o.billing;
  const khach = { ten: `${o.billing.first_name ?? ''} ${o.billing.last_name ?? ''}`.trim(), email: o.billing.email ?? '', sdt: o.billing.phone || o.shipping?.phone || '' };
  const diaChi = { ten: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(), dong1: s.address_1 ?? '', dong2: s.address_2 ?? '', thanh_pho: s.city ?? '', bang: s.state ?? '', zip: s.postcode ?? '', nuoc: s.country || 'US' };
  const hoan = o.refunds.reduce((t, r) => t + Math.abs(Number(r.total) || 0), 0);
  const phi = meta(o.meta_data, '_stripe_fee');
  const cu = (await q<{ id: number; trang_thai_shop: string }>(sql`SELECT id, trang_thai_shop FROM shop_don WHERE cua_hang_id = ${ch.id} AND ma_ngoai = ${String(o.id)}`))[0];
  const d = (await q<{ id: number }>(sql`
    INSERT INTO shop_don (cua_hang_id, ma_ngoai, so_don, khoa_don, trang_thai_shop, khach, dia_chi, tong, tien_te, ship_khach, hoan, phi_cong, sid, cong_tt, tao_luc, tra_luc, raw, updated_at)
    VALUES (${ch.id}, ${String(o.id)}, ${o.number}, ${o.order_key ?? null}, ${o.status}, ${JSON.stringify(khach)}::jsonb, ${JSON.stringify(diaChi)}::jsonb, ${Number(o.total)}, ${o.currency},
            ${Number(o.shipping_total) || 0}, ${hoan}, ${phi ? Number(phi) : null}, ${sidCua(o) || null}, ${o.payment_method_title || null},
            ${gmt(o.date_created_gmt)}::timestamptz, ${gmt(o.date_paid_gmt)}::timestamptz, ${JSON.stringify({ meta: o.meta_data.filter((m) => !m.key.startsWith('_stripe_source')) })}::jsonb, now())
    ON CONFLICT (cua_hang_id, ma_ngoai) DO UPDATE SET trang_thai_shop = EXCLUDED.trang_thai_shop, khoa_don = COALESCE(EXCLUDED.khoa_don, shop_don.khoa_don), khach = EXCLUDED.khach, dia_chi = EXCLUDED.dia_chi,
      tong = EXCLUDED.tong, ship_khach = EXCLUDED.ship_khach, hoan = EXCLUDED.hoan, phi_cong = COALESCE(EXCLUDED.phi_cong, shop_don.phi_cong),
      sid = COALESCE(EXCLUDED.sid, shop_don.sid), tra_luc = COALESCE(EXCLUDED.tra_luc, shop_don.tra_luc), raw = EXCLUDED.raw, updated_at = now()
    RETURNING id`))[0]!;
  for (const it of o.line_items) {
    const vid = String(it.variation_id || it.product_id);
    await q(sql`
      INSERT INTO shop_don_mon (don_id, ma_ngoai, bien_the_id, ten, sl, gia)
      VALUES (${d.id}, ${String(it.id)}, (SELECT b.id FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id WHERE p.cua_hang_id = ${ch.id} AND b.ma_ngoai = ${vid} LIMIT 1),
              ${it.name}, ${it.quantity}, ${Number(it.total) || 0})
      ON CONFLICT (don_id, ma_ngoai) DO UPDATE SET bien_the_id = COALESCE(EXCLUDED.bien_the_id, shop_don_mon.bien_the_id), ten = EXCLUDED.ten, sl = EXCLUDED.sl, gia = EXCLUDED.gia`);
  }
  if (!cu) await ghiSuKien(d.id, 'woo', `Đơn #${o.number} vào sổ — ${o.status}, $${o.total}`);
  else if (cu.trang_thai_shop !== o.status) await ghiSuKien(d.id, 'woo', `Woo: ${cu.trang_thai_shop} → ${o.status}`);
  // Đơn CJ dựng từ thời plugin (meta _cj_order_id) → nhận vào sổ, không đặt lại lần hai.
  const cjCu = meta(o.meta_data, '_cj_order_id');
  if (cjCu) await q(sql`
    INSERT INTO shop_don_ncc (don_id, ncc, ma_ncc, trang_thai, tuyen, phi_ship, ma_van_don, bao_khach)
    SELECT ${d.id}, 'cj', ${cjCu}, ${meta(o.meta_data, '_cj_trang_thai') ?? 'UNPAID'}, ${meta(o.meta_data, '_cj_tuyen')}, ${Number(meta(o.meta_data, '_cj_ship')) || null},
           ${meta(o.meta_data, '_ms_tracking')}, ${!!meta(o.meta_data, '_ms_tracking')}
    WHERE NOT EXISTS (SELECT 1 FROM shop_don_ncc WHERE ncc = 'cj' AND ma_ncc = ${cjCu})
    ON CONFLICT DO NOTHING`);
  await ghiSoPhu(ch, d.id, o);
  return d.id;
}

/** Sổ PHỦ (report2 MOS2) cho đơn Woo — cùng khoá nguon_du_lieu/ma_don với plugin cũ (upsert không nhân đôi). */
async function ghiSoPhu(ch: CuaHang, donId: number, o: WooDon) {
  if (!o.date_paid_gmt) return;
  await ghiSoPhuDon(donId, { projectId: ch.project_id, nguon: `woo:${ch.khoa}`, maDon: String(o.id), traLuc: gmt(o.date_paid_gmt)!, tong: Number(o.total),
    huy: ['cancelled', 'failed'].includes(o.status),   // đơn huỷ sau khi trả (không qua hoàn) → không tính doanh thu
    sid: sidCua(o) || null, phi: Number(meta(o.meta_data, '_stripe_fee')) || null, soMon: o.line_items.reduce((t, i) => t + i.quantity, 0),
    hoan: o.refunds.map((r) => ({ ma: String(r.id), tien: Math.abs(Number(r.total)), lyDo: r.reason })) });
}

/** Kéo đơn đổi từ lần trước (lùi 1 giờ cho chắc) — lần đầu lấy 60 ngày. */
export async function dongBoDon(ch: CuaHang) {
  const tu = ch.dong_bo_luc ? new Date(Date.parse(ch.dong_bo_luc) - 3600_000) : new Date(Date.now() - 60 * 86_400_000);
  const ds = await wooHet<WooDon>(ch, `orders?status=any&dates_are_gmt=true&modified_after=${encodeURIComponent(tu.toISOString().slice(0, 19))}&orderby=modified&order=asc`);
  const ids: number[] = [];
  for (const o of ds) ids.push(await ghiDon(ch, o));
  return ids;
}

/* ── NHÀ CUNG CẤP ─────────────────────────────────────────────────────────── */
type DonDu = { id: number; ma_ngoai: string; so_don: string; trang_thai_shop: string; khach: { ten: string; email: string; sdt: string };
  dia_chi: { ten: string; dong1: string; dong2: string; thanh_pho: string; bang: string; zip: string; nuoc: string } };

/** Đặt đơn sang CJ (payType 3 = CHỈ TẠO, CHƯA TRẢ). Tuyến = rẻ nhất trong các tuyến giao ≤ ngay_ship_max ngày.
 *  Khoá chống trùng: chèn dòng DANG_TAO trước (index một dòng sống mỗi đơn) — lượt thứ hai cùng lúc chèn hụt thì thôi. */
export async function sangNcc(ch: CuaHang, donId: number, nguoi = 'mos2'): Promise<{ ok: boolean; loi?: string }> {
  let nccId: number | null = null;
  try { return await sangNccLoi(ch, donId, nguoi, (id) => { nccId = id; }); }
  catch (e) {
    const loi = (e as Error).message;
    if (nccId) await q(sql`UPDATE shop_don_ncc SET trang_thai = 'LOI', loi = ${loi}, updated_at = now() WHERE id = ${nccId} AND trang_thai = 'DANG_TAO'`);
    await ghiSuKien(donId, 'ncc', `Sang NCC lỗi: ${loi}`, true);
    return { ok: false, loi };
  }
}

async function sangNccLoi(ch: CuaHang, donId: number, nguoi: string, giuCho: (id: number) => void): Promise<{ ok: boolean; loi?: string }> {
  const [d] = await q<DonDu>(sql`SELECT id, ma_ngoai, so_don, trang_thai_shop, khach, dia_chi FROM shop_don WHERE id = ${donId}`);
  if (!d) return { ok: false, loi: 'không có đơn' };
  if (d.trang_thai_shop !== 'processing') return { ok: false, loi: `đơn đang ${d.trang_thai_shop}, chỉ đặt NCC khi processing (đã trả tiền)` };
  const giu = await q<{ id: number }>(sql`INSERT INTO shop_don_ncc (don_id, ncc, trang_thai) VALUES (${donId}, ${ch.ncc}, 'DANG_TAO') ON CONFLICT DO NOTHING RETURNING id`);
  if (!giu.length) return { ok: false, loi: 'đơn đã có đơn NCC đang sống' };
  const nccId = giu[0]!.id;
  giuCho(nccId);
  const hong = async (loi: string) => {
    await q(sql`UPDATE shop_don_ncc SET trang_thai = 'LOI', loi = ${loi}, updated_at = now() WHERE id = ${nccId}`);
    await ghiSuKien(donId, 'ncc', `Sang ${ch.ncc.toUpperCase()} lỗi: ${loi}`, true);
    return { ok: false, loi };
  };
  // mã biến thể = NGUỒN ĐANG DÙNG của biến thể shop (apNguon chọn: chính, hoặc dự phòng đã kiểm mẫu khi chính hết)
  const mon = await q<{ id: number; ten: string; sl: number; ma_ncc: string | null; ma_ngoai: string; ncc: string | null; ncc_bt_id: number | null }>(sql`
    SELECT m.id, m.ten, m.sl, b.ma_ncc, m.ma_ngoai, s.ncc, n.ncc_bt_id FROM shop_don_mon m LEFT JOIN shop_bien_the b ON b.id = m.bien_the_id
      LEFT JOIN shop_nguon n ON n.id = b.nguon_id LEFT JOIN shop_ncc_bt t ON t.id = n.ncc_bt_id LEFT JOIN shop_ncc_sp s ON s.id = t.ncc_sp_id
     WHERE m.don_id = ${donId} ORDER BY m.id`);
  const thieu = mon.filter((m) => !m.ma_ncc).map((m) => m.ten);
  if (!mon.length || thieu.length) return hong(`thiếu nguồn NCC: ${thieu.join(', ') || '(đơn không có món)'} — gắn nguồn ở tab Sản phẩm`);
  const khac = mon.filter((m) => m.ncc && m.ncc !== 'cj');
  if (khac.length) return hong(`nguồn đang dùng không phải CJ (${[...new Set(khac.map((m) => m.ncc))].join(', ')}: ${khac.map((m) => m.ten).join(', ')}) — NCC này chưa có kết nối đặt đơn, đặt tay rồi ghi mã đơn`);
  const sp = mon.map((m) => ({ vid: m.ma_ncc!, quantity: m.sl, storeLineItemId: m.ma_ngoai }));
  const nuoc = d.dia_chi.nuoc || 'US';
  const f = await cj<{ logisticName: string; logisticAging: string; logisticPrice: number }[]>('logistic/freightCalculate',
    { startCountryCode: ch.cau_hinh.quoc_gia_kho ?? 'CN', endCountryCode: nuoc, products: sp.map((p) => ({ vid: p.vid, quantity: p.quantity })) });
  const max = ch.cau_hinh.ngay_ship_max ?? 11;
  const tuyen = (f.data ?? []).filter((t) => ngayToiDa(t.logisticAging) <= max).sort((a, b) => a.logisticPrice - b.logisticPrice);
  if (!tuyen.length) return hong(`không có tuyến ship ≤ ${max} ngày${f.message && !f.result ? ` (${f.message})` : ''}`);
  const t = tuyen[0]!;
  const r = await cj<{ orderId: string; productAmount?: number }>('shopping/order/createOrderV2', {
    orderNumber: `${ch.khoa.slice(0, 2).toUpperCase()}${d.so_don}`,
    shippingCountryCode: nuoc, shippingCountry: new Intl.DisplayNames(['en'], { type: 'region' }).of(nuoc) ?? nuoc, shippingProvince: d.dia_chi.bang, shippingCity: d.dia_chi.thanh_pho,
    shippingAddress: `${d.dia_chi.dong1} ${d.dia_chi.dong2}`.trim(), shippingZip: d.dia_chi.zip,
    shippingCustomerName: d.dia_chi.ten || d.khach.ten, shippingPhone: d.khach.sdt, email: d.khach.email,
    logisticName: t.logisticName, fromCountryCode: ch.cau_hinh.quoc_gia_kho ?? 'CN', payType: 3, products: sp,
  });
  if (!r.data?.orderId) return hong(`CJ từ chối: ${r.message ?? 'không rõ'}`);
  await q(sql`UPDATE shop_don_ncc SET ma_ncc = ${r.data.orderId}, trang_thai = 'CREATED', tuyen = ${t.logisticName}, so_ngay = ${t.logisticAging},
                phi_ship = ${t.logisticPrice}, tien_hang = ${r.data.productAmount ?? null}, updated_at = now() WHERE id = ${nccId}`);
  for (const m of mon) await q(sql`UPDATE shop_don_mon SET ncc_bt_id = ${m.ncc_bt_id} WHERE id = ${m.id}`);
  await ghiSuKien(donId, nguoi === 'mos2' ? 'ncc' : 'nguoi', `Đã đặt CJ ${r.data.orderId} · ${t.logisticName} ${t.logisticAging} ngày · ship $${t.logisticPrice}${nguoi !== 'mos2' ? ` (${nguoi} bấm)` : ''}`);
  // Woo giữ dấu để cột "CJ" cũ trong admin WP vẫn đọc được.
  if (ch.nen_tang === 'woo') await woo(ch, 'PUT', `orders/${d.ma_ngoai}`, { meta_data: [{ key: '_cj_order_id', value: r.data.orderId }, { key: '_cj_trang_thai', value: 'CREATED' },
    { key: '_cj_tuyen', value: `${t.logisticName} (${t.logisticAging} ngày)` }, { key: '_cj_ship', value: t.logisticPrice }] }).catch(() => null);
  if (ch.cau_hinh.tu_tra_ncc) await traNcc(donId, 'mos2');
  return { ok: true };
}

/** Thanh toán đơn CJ từ ví CJ (TIÊU TIỀN — chỉ chạy khi người bấm, hoặc cửa hàng bật tu_tra_ncc). */
export async function traNcc(donId: number, nguoi: string): Promise<{ ok: boolean; loi?: string }> {
  const [n] = await q<{ id: number; ma_ncc: string | null; da_tra: boolean }>(sql`
    SELECT id, ma_ncc, da_tra FROM shop_don_ncc WHERE don_id = ${donId} AND trang_thai NOT IN ('CANCELLED', 'LOI') LIMIT 1`);
  if (!n?.ma_ncc) return { ok: false, loi: 'đơn chưa có đơn CJ' };
  if (n.da_tra) return { ok: false, loi: 'đã trả rồi' };
  const r = await cj('shopping/pay/payBalance', { orderId: n.ma_ncc });
  if (!r.result) { await ghiSuKien(donId, 'ncc', `Trả CJ lỗi: ${r.message ?? 'không rõ'} (${nguoi})`, true); return { ok: false, loi: r.message ?? 'CJ từ chối' }; }
  await q(sql`UPDATE shop_don_ncc SET da_tra = true, tra_luc = now(), trang_thai = 'UNSHIPPED', updated_at = now() WHERE id = ${n.id}`);
  await ghiSuKien(donId, nguoi === 'mos2' ? 'ncc' : 'nguoi', `Đã trả CJ từ ví (${nguoi})`);
  return { ok: true };
}

/** Đọc lại số tiền đơn CJ NGAY LÚC NÀY (getOrderDetail) — gọi khi anh bấm "Trả CJ", để không trả theo số đã cũ.
 *  Cập nhật tien_hang trong sổ; trả {tong, cu, doi} — doi=true khi khác số đã lưu. Đọc không được (đơn giả, CJ lỗi) → null. */
export async function tienDonCj(donId: number): Promise<{ tong: number; hang: number | null; ship: number | null; cu: number | null; doi: boolean } | null> {
  const [n] = await q<{ id: number; ma_ncc: string | null; tien_hang: string | null; phi_ship: string | null }>(sql`
    SELECT id, ma_ncc, tien_hang::text, phi_ship::text FROM shop_don_ncc WHERE don_id = ${donId} AND trang_thai NOT IN ('CANCELLED', 'LOI') ORDER BY id DESC LIMIT 1`);
  if (!n?.ma_ncc) return null;
  const r = await cj<{ orderAmount?: number; productAmount?: number; postageAmount?: number }>(`shopping/order/getOrderDetail?orderId=${encodeURIComponent(n.ma_ncc)}`);
  if (!r.result || !r.data) return null;
  const hang = r.data.productAmount ?? null, ship = r.data.postageAmount ?? (n.phi_ship != null ? Number(n.phi_ship) : null);
  const tong = r.data.orderAmount ?? (hang ?? 0) + (ship ?? 0);
  const cu = n.tien_hang != null ? Number(n.tien_hang) + Number(n.phi_ship ?? 0) : null;
  if (hang != null) await q(sql`UPDATE shop_don_ncc SET tien_hang = ${hang}, updated_at = now() WHERE id = ${n.id}`);
  return { tong, hang, ship, cu, doi: cu != null && Math.abs(cu - tong) > 0.009 };
}

export async function soDuCj(): Promise<number | null> {
  const r = await cj<{ amount: number }>('shopping/pay/getBalance');
  return r.result && r.data ? Number(r.data.amount) : null;
}

type NccSong = { id: number; don_id: number; ma_ncc: string; trang_thai: string; da_tra: boolean; ma_van_don: string | null; bao_khach: boolean;
  so_don: string; ma_ngoai: string; cua_hang_id: number; khoa_don: string | null; khach: { ten?: string; email?: string } | null };

/** Theo dõi mọi đơn NCC chưa xong: trạng thái CJ, mã vận đơn (→ báo khách qua ghi chú Woo + completed), hành trình vận đơn. */
export async function theoDoiNcc(ch: CuaHang) {
  const ds = await q<NccSong>(sql`
    SELECT n.id, n.don_id, n.ma_ncc, n.trang_thai, n.da_tra, n.ma_van_don, n.bao_khach, d.so_don, d.ma_ngoai, d.cua_hang_id, d.khoa_don, d.khach
      FROM shop_don_ncc n JOIN shop_don d ON d.id = n.don_id
     WHERE d.cua_hang_id = ${ch.id} AND n.ma_ncc IS NOT NULL AND n.trang_thai NOT IN ('CANCELLED', 'LOI', 'DELIVERED', 'TRASH')
       AND n.created_at > now() - interval '90 days'`);
  let doi = 0;
  for (const n of ds) {
    const r = await cj<{ orderStatus?: string; trackNumber?: string; logisticName?: string; trackingProvider?: string; orderAmount?: number; productAmount?: number }>(
      `shopping/order/getOrderDetail?orderId=${encodeURIComponent(n.ma_ncc)}`);
    const d = r.data;
    if (!d) continue;
    const tt = d.orderStatus ?? n.trang_thai;
    if (tt !== n.trang_thai) {
      doi++;
      await q(sql`UPDATE shop_don_ncc SET trang_thai = ${tt}, da_tra = da_tra OR ${!['CREATED', 'IN_CART', 'UNPAID', 'TRASH', 'CANCELLED'].includes(tt)},
                    tien_hang = COALESCE(${d.productAmount ?? null}, tien_hang), updated_at = now() WHERE id = ${n.id}`);
      await ghiSuKien(n.don_id, 'ncc', `CJ: ${n.trang_thai} → ${tt}`, tt === 'CANCELLED' || tt === 'TRASH');
    }
    const ma = d.trackNumber || n.ma_van_don;
    if (ma && !n.ma_van_don) {
      await q(sql`UPDATE shop_don_ncc SET ma_van_don = ${ma}, hang_van_chuyen = ${d.trackingProvider ?? d.logisticName ?? null}, gui_luc = now(), updated_at = now() WHERE id = ${n.id}`);
      await ghiSuKien(n.don_id, 'ncc', `Có mã vận đơn ${ma}`);
    }
    if (ma && !n.bao_khach && ch.nen_tang === 'mos') {
      // MỘT email duy nhất (anh chốt 01/10/2026), link về trang theo dõi của chính shop — không sang 17track.net
      const link = n.khoa_don ? linkTheoDoi(ch, n.so_don, n.khoa_don) : linkVanDon(ma);
      try {
        const m = matTien(ch.mat_tien), shopThu = { khoa: ch.khoa, ten: ch.ten, domain: ch.domain, email: m.email ?? `support@${ch.domain}` };
        const thu = thuDaGui(shopThu, n.so_don, (n.khach?.ten ?? '').split(' ')[0] || 'there', link);
        if (n.khach?.email && batThu(m, 'da_gui')) await guiThu(shopThu, n.khach.email, thu.tieuDe, thu.html, thu.chu);
        await q(sql`UPDATE shop_don SET trang_thai_shop = 'completed', updated_at = now() WHERE id = ${n.don_id}`);
        await q(sql`UPDATE shop_don_ncc SET bao_khach = true WHERE id = ${n.id}`);
        await ghiSuKien(n.don_id, 'shop', `Đã gửi thư "đã gửi hàng" tới ${n.khach?.email || '(không có email)'} · đơn → completed`);
      } catch (e) { await ghiSuKien(n.don_id, 'shop', `Báo khách lỗi: ${(e as Error).message}`, true); }
    }
    if (ma && !n.bao_khach && ch.nen_tang === 'woo') {
      // MỘT email duy nhất (anh chốt 01/10/2026), link về trang theo dõi của chính shop (mellowstep.com/track) — không sang 17track.net
      const link = n.khoa_don ? linkTheoDoi(ch, n.so_don, n.khoa_don) : linkVanDon(ma);
      const note = `Good news, your order is on its way!\n\nTrack your order: ${link}\n\nTracking can take 2-3 days to show movement. Questions? Just reply to this email.`;
      try {
        await woo(ch, 'POST', `orders/${n.ma_ngoai}/notes`, { note, customer_note: true });
        await woo(ch, 'PUT', `orders/${n.ma_ngoai}`, { status: 'completed', meta_data: [{ key: '_ms_tracking', value: ma }, { key: '_cj_trang_thai', value: tt }] });
        await q(sql`UPDATE shop_don_ncc SET bao_khach = true WHERE id = ${n.id}`);
        await ghiSuKien(n.don_id, 'woo', 'Đã gửi mã vận đơn cho khách (email Woo) · đơn → completed');
      } catch (e) { await ghiSuKien(n.don_id, 'woo', `Báo khách lỗi: ${(e as Error).message}`, true); }
    }
    if (ma) await keoVanDon(n.id, n.don_id, ma);
    if (ma && ch.nen_tang === 'mos') await baoChangKhach(ch, n).catch((e) => ghiSuKien(n.don_id, 'shop', `Thư theo chặng lỗi: ${(e as Error).message}`, true));
  }
  return { theoDoi: ds.length, doi };
}

/** Thư theo chặng cho khách (mặt tiền mos): đơn vừa sang roi_nuoc / den_nuoc / di_giao / da_giao mà chưa báo chặng đó → một thư,
 *  ghi bao_chang. Chặng tính bằng cùng hàm với /shop và trang theo dõi (@mos2/shop/hanh-trinh) — không ai tự đoán chặng kiểu khác. */
async function baoChangKhach(ch: CuaHang, n: NccSong) {
  const [r] = await q<{ tao_luc: string; tra_luc: string | null; dia_chi: { nuoc?: string }; ncc_tao: string; trang_thai: string; da_tra: boolean; tra_ncc: string | null;
    gui_luc: string | null; giao_luc: string | null; moc: Moc[] | null; tt_vd: string | null; bao_chang: string | null }>(sql`
    SELECT d.tao_luc::text AS tao_luc, d.tra_luc::text AS tra_luc, d.dia_chi, x.created_at::text AS ncc_tao, x.trang_thai, x.da_tra, x.tra_luc::text AS tra_ncc,
           x.gui_luc::text AS gui_luc, x.giao_luc::text AS giao_luc, x.moc, x.tt_vd, x.bao_chang
      FROM shop_don_ncc x JOIN shop_don d ON d.id = x.don_id WHERE x.id = ${n.id}`);
  if (!r || !n.khach?.email) return;
  const ht = hanhTrinh({ nhanLuc: r.tra_luc ?? r.tao_luc, nccTaoLuc: r.ncc_tao, nccTt: r.trang_thai, daTra: r.da_tra, traNccLuc: r.tra_ncc, guiLuc: r.gui_luc,
    giaoLuc: r.giao_luc, moc: r.moc, ttVd: r.tt_vd, nuocKhach: r.dia_chi?.nuoc || 'US' });
  const hien = ht.chang[ht.hienTai]!.key;
  const thuTu = (k: string | null) => CHANG.findIndex((c) => c.key === k);
  if (!CHANG_BAO_THU.includes(hien) || thuTu(r.bao_chang) >= thuTu(hien)) return;
  const m = matTien(ch.mat_tien), g = cauHinhGiao(m.giao);
  if (!batThu(m, { chang: hien })) return;   // tắt ở /shop › Cửa hàng › Thư khách
  const shopThu = { khoa: ch.khoa, ten: ch.ten, domain: ch.domain, email: m.email ?? `support@${ch.domain}` };
  const link = n.khoa_don ? linkTheoDoi(ch, n.so_don, n.khoa_don) : linkVanDon(n.ma_van_don ?? '');
  const thu = thuChang(shopThu, n.so_don, (n.khach.ten ?? '').split(' ')[0] || 'there', hien, link, g, r.gui_luc ? duKienGiao(g, new Date(isoCua(r.gui_luc)), true) : null);
  await guiThu(shopThu, n.khach.email, thu.tieuDe, thu.html, thu.chu);
  await q(sql`UPDATE shop_don_ncc SET bao_chang = ${hien} WHERE id = ${n.id}`);
  await ghiSuKien(n.don_id, 'shop', `Đã gửi thư chặng "${CHANG_KHACH[hien].nhan}" tới ${n.khach.email}`);
}

/** Hành trình vận đơn từ CJ (getTrackInfo). Hãng báo đã giao → giao_luc + DELIVERED. Mỗi đơn tối đa 1 lần / 3 giờ. */
async function keoVanDon(nccId: number, donId: number, ma: string) {
  const [c] = await q<{ cu: boolean; dang_ky_17: boolean }>(sql`SELECT (van_don_luc IS NULL OR van_don_luc < now() - interval '3 hours') AS cu, dang_ky_17 FROM shop_don_ncc WHERE id = ${nccId}`);
  if (!c?.cu) return;
  // CJ: trạng thái tóm tắt + mã/hãng CHẶNG CUỐI ở nước khách (USPS…)
  const r = await cj<{ trackingStatus?: string; deliveryTime?: string; lastMileCarrier?: string; lastTrackNumber?: string }[]>(
    `logistic/getTrackInfo?trackNumber=${encodeURIComponent(ma)}`);
  const v = r.data?.[0];
  await q(sql`UPDATE shop_don_ncc SET van_don_luc = now(), van_don = ${v ? JSON.stringify(v) : null}::jsonb,
                ma_chang_cuoi = COALESCE(${v?.lastTrackNumber || null}, ma_chang_cuoi), hang_chang_cuoi = COALESCE(${v?.lastMileCarrier || null}, hang_chang_cuoi)
              WHERE id = ${nccId}`);
  // 17TRACK: mốc chi tiết (đăng ký một lần — tốn một lượt — rồi đọc lại miễn phí)
  let giao = !!v && /deliver/i.test(String(v.trackingStatus ?? ''));
  let giaoLuc = v?.deliveryTime ?? null;
  if (co17()) {
    if (!c.dang_ky_17) {
      const dk = await dangKy17(ma);
      if (dk?.ok) await q(sql`UPDATE shop_don_ncc SET dang_ky_17 = true WHERE id = ${nccId}`);
      else if (dk) await ghiSuKien(donId, 'ncc', `17TRACK không nhận mã ${ma}: ${dk.loi}`, true);
    }
    const t = await tin17(ma);
    if (t) {
      await q(sql`UPDATE shop_don_ncc SET moc = ${JSON.stringify(t.moc)}::jsonb, tt_vd = ${t.tt}, du_kien = ${t.duKien ? JSON.stringify(t.duKien) : null}::jsonb WHERE id = ${nccId}`);
      giao = giao || t.tt === 'Delivered';
      if (t.tt === 'Delivered' && !giaoLuc) giaoLuc = t.moc[0]?.ts ?? null;
    }
  }
  if (giao) {
    const daGiao = await q(sql`UPDATE shop_don_ncc SET giao_luc = COALESCE(${giaoLuc}::timestamptz, now()), trang_thai = 'DELIVERED'
                                 WHERE id = ${nccId} AND giao_luc IS NULL RETURNING id`);
    if (daGiao.length) await ghiSuKien(donId, 'ncc', `Hãng báo đã giao${v?.lastMileCarrier ? ` (${v.lastMileCarrier})` : ''}`);
  }
}

/* ── MỘT NHỊP ─────────────────────────────────────────────────────────────── */
/** Shop DEMO (trang_thai 'demo'): chỉ chạy phần thuần sổ — chọn nguồn + tự ẩn/mở — để màn demo phản ánh đúng luật. Không gọi NCC, không gửi thư. */
export async function nhipDemo(ch: CuaHang) {
  return { cua_hang: ch.khoa, nguon: await apNguon(ch), mat_tien_ncc: await apDungNcc(ch) };
}

/** Một lượt cho một cửa hàng: (sản phẩm nếu yêu cầu) → đơn đổi → tự sang NCC đơn đủ điều kiện → theo dõi NCC/vận đơn. */
export async function nhip(ch: CuaHang, opt: { sanPham?: boolean } = {}) {
  const kq: Record<string, unknown> = { cua_hang: ch.khoa };
  try {
    const batDau = new Date().toISOString();
    if (ch.nen_tang === 'woo') {
      if (opt.sanPham) kq.san_pham = await dongBoSanPham(ch);
      kq.don = (await dongBoDon(ch)).length;
    } else kq.doi_soat = await doiSoat(ch);   // mặt tiền mos: đơn đã trả mà chưa vào sổ (khách đóng tab + webhook trượt)
    if (ch.cau_hinh.tu_sang_ncc) {
      const cho = await q<{ id: number }>(sql`
        SELECT d.id FROM shop_don d WHERE d.cua_hang_id = ${ch.id} AND d.trang_thai_shop = 'processing'
           AND NOT EXISTS (SELECT 1 FROM shop_don_ncc n WHERE n.don_id = d.id AND n.trang_thai <> 'CANCELLED')`);
      kq.sang_ncc = (await Promise.all(cho.map((x) => sangNcc(ch, x.id)))).filter((x) => x.ok).length;
    }
    kq.ncc = await theoDoiNcc(ch);
    // danh mục + tồn NCC đọc MỘT lần cho mọi shop (dongBoNccChung, cron gọi trước vòng này); ở đây chỉ chọn nguồn + áp lên mặt tiền
    kq.nguon = await apNguon(ch).catch((e) => ({ loi: (e as Error).message }));
    kq.mat_tien_ncc = await apDungNcc(ch).catch((e) => ({ loi: (e as Error).message }));
    kq.ho_so = await dongBoHoSo(ch).catch((e) => ({ loi: (e as Error).message }));
    await q(sql`UPDATE shop_cua_hang SET dong_bo_luc = ${batDau}::timestamptz, dong_bo_loi = NULL WHERE id = ${ch.id}`);
  } catch (e) {
    kq.loi = (e as Error).message;
    await q(sql`UPDATE shop_cua_hang SET dong_bo_loi = ${kq.loi as string} WHERE id = ${ch.id}`);
  }
  return kq;
}
