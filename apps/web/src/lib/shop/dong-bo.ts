// SHOP — máy chạy: kéo đơn/sản phẩm từ Woo về sổ, đặt đơn sang nhà cung cấp (CJ), kéo vận đơn, báo khách, ghi sổ PHỦ.
// Gọi từ: webhook Woo (/api/shop/woo/<khoa>, một đơn), nhịp /api/shop/cron (mỗi 10 phút, mọi cửa hàng), nút trong /shop.
// Thay luồng CJ của mu-plugin mellowstep-cj.php (từ 01/10/2026 plugin tắt các bước 1/3/4 bằng MS_QUA_MOS2).
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { cj, linkVanDon, meta, ngayToiDa, woo, wooHet, type WooBt, type WooDon, type WooSp } from './nguon';
import { sidPrefix } from '@/lib/phu-shared';

export type CuaHang = { id: number; khoa: string; project_id: string; ten: string; domain: string; ncc: string;
  cau_hinh: { ngay_ship_max?: number; tu_sang_ncc?: boolean; tu_tra_ncc?: boolean; quoc_gia_kho?: string }; trang_thai: string; dong_bo_luc: string | null };

type Row = Record<string, unknown>;
const db = () => { const d = getDb(); if (!d) throw new Error('chưa nối DB'); return d; };
const q = async <T = Row>(s: ReturnType<typeof sql>) => (await db().execute(s)) as unknown as T[];

export async function dsCuaHang(chiBat = true): Promise<CuaHang[]> {
  return q<CuaHang>(sql`SELECT id, khoa, project_id, ten, domain, ncc, cau_hinh, trang_thai, dong_bo_luc::text FROM shop_cua_hang
                        ${chiBat ? sql`WHERE trang_thai = 'bat'` : sql``} ORDER BY id`);
}
export async function cuaHangTheoKhoa(khoa: string) { return (await dsCuaHang(false)).find((c) => c.khoa === khoa) ?? null; }

export async function ghiSuKien(donId: number, nguon: string, noiDung: string, loi = false) {
  await q(sql`INSERT INTO shop_su_kien (don_id, nguon, noi_dung, loi) VALUES (${donId}, ${nguon}, ${noiDung}, ${loi})`);
}

/* ── SẢN PHẨM ─────────────────────────────────────────────────────────────── */
/** Kéo sản phẩm + biến thể. Mã NCC / giá vốn: Woo (meta _cj_*) chỉ GIEO khi sổ còn trống — sửa ở /shop thì sổ là gốc
 *  (và được ghi ngược về Woo, xem suaBienThe). */
export async function dongBoSanPham(ch: CuaHang) {
  const sps = await wooHet<WooSp>(ch, 'products?status=any');
  let soBt = 0;
  for (const p of sps) {
    const sp = (await q<{ id: number }>(sql`
      INSERT INTO shop_san_pham (cua_hang_id, ma_ngoai, ten, anh, link, trang_thai, ncc, ma_ncc, updated_at)
      VALUES (${ch.id}, ${String(p.id)}, ${p.name}, ${p.images?.[0]?.src ?? null}, ${p.permalink}, ${p.status}, ${ch.ncc}, ${meta(p.meta_data, '_cj_pid')}, now())
      ON CONFLICT (cua_hang_id, ma_ngoai) DO UPDATE SET ten = EXCLUDED.ten, anh = EXCLUDED.anh, link = EXCLUDED.link,
        trang_thai = EXCLUDED.trang_thai, ma_ncc = COALESCE(shop_san_pham.ma_ncc, EXCLUDED.ma_ncc), updated_at = now()
      RETURNING id`))[0]!;
    const bts: { id: number; sku: string; ten: string; gia: string; meta: WooBt['meta_data'] }[] = p.type === 'variable'
      ? (await wooHet<WooBt>(ch, `products/${p.id}/variations`)).map((v) => ({ id: v.id, sku: v.sku, ten: v.attributes.map((a) => a.option).join(' / ') || `#${v.id}`, gia: v.price, meta: v.meta_data }))
      : [{ id: p.id, sku: p.sku, ten: p.name, gia: p.price, meta: p.meta_data }];
    for (const v of bts) {
      soBt++;
      const gv = meta(v.meta, '_cj_gia_von');
      await q(sql`
        INSERT INTO shop_bien_the (san_pham_id, ma_ngoai, sku, ten, gia_ban, ma_ncc, gia_von, updated_at)
        VALUES (${sp.id}, ${String(v.id)}, ${v.sku || null}, ${v.ten}, ${v.gia ? Number(v.gia) : null}, ${meta(v.meta, '_cj_vid')}, ${gv ? Number(gv) : null}, now())
        ON CONFLICT (san_pham_id, ma_ngoai) DO UPDATE SET sku = EXCLUDED.sku, ten = EXCLUDED.ten, gia_ban = EXCLUDED.gia_ban,
          ma_ncc = COALESCE(shop_bien_the.ma_ncc, EXCLUDED.ma_ncc), gia_von = COALESCE(shop_bien_the.gia_von, EXCLUDED.gia_von), updated_at = now()`);
    }
  }
  return { sanPham: sps.length, bienThe: soBt };
}

/* ── ĐƠN ──────────────────────────────────────────────────────────────────── */
function sidCua(o: WooDon) {
  const sach = (v: string | null) => (v ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const src = sach(meta(o.meta_data, '_wc_order_attribution_utm_source')), camp = sach(meta(o.meta_data, '_wc_order_attribution_utm_campaign'));
  if (src || camp) return `${src || 'utm'}_${camp || 'none'}`;
  return sach(meta(o.meta_data, '_wc_order_attribution_source_type'));
}
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
    INSERT INTO shop_don (cua_hang_id, ma_ngoai, so_don, trang_thai_shop, khach, dia_chi, tong, tien_te, ship_khach, hoan, phi_cong, sid, cong_tt, tao_luc, tra_luc, raw, updated_at)
    VALUES (${ch.id}, ${String(o.id)}, ${o.number}, ${o.status}, ${JSON.stringify(khach)}::jsonb, ${JSON.stringify(diaChi)}::jsonb, ${Number(o.total)}, ${o.currency},
            ${Number(o.shipping_total) || 0}, ${hoan}, ${phi ? Number(phi) : null}, ${sidCua(o) || null}, ${o.payment_method_title || null},
            ${gmt(o.date_created_gmt)}::timestamptz, ${gmt(o.date_paid_gmt)}::timestamptz, ${JSON.stringify({ meta: o.meta_data.filter((m) => !m.key.startsWith('_stripe_source')) })}::jsonb, now())
    ON CONFLICT (cua_hang_id, ma_ngoai) DO UPDATE SET trang_thai_shop = EXCLUDED.trang_thai_shop, khach = EXCLUDED.khach, dia_chi = EXCLUDED.dia_chi,
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

/** Sổ PHỦ (report2 MOS2): đơn đã trả → phu_su_kien loai=don (cùng khoá nguon_du_lieu/ma_don với plugin cũ, upsert không nhân đôi);
 *  mỗi lần hoàn → loai=hoan. Giá vốn + ship NCC lấy từ sổ shop. */
async function ghiSoPhu(ch: CuaHang, donId: number, o: WooDon) {
  if (!o.date_paid_gmt) return;
  const nguon = `woo:${ch.khoa}`, sid = sidCua(o) || null;
  const x = (await q<{ gv: string | null; ship: string | null; ma: string | null; mon: string | null }>(sql`
    SELECT (SELECT SUM(b.gia_von * m.sl) FROM shop_don_mon m JOIN shop_bien_the b ON b.id = m.bien_the_id WHERE m.don_id = ${donId})::text AS gv,
           (SELECT phi_ship::text FROM shop_don_ncc WHERE don_id = ${donId} AND trang_thai NOT IN ('CANCELLED', 'LOI') LIMIT 1) AS ship,
           (SELECT ma_ncc FROM shop_don_ncc WHERE don_id = ${donId} AND trang_thai NOT IN ('CANCELLED', 'LOI') LIMIT 1) AS ma,
           (SELECT ten FROM shop_don_mon WHERE don_id = ${donId} ORDER BY id LIMIT 1) AS mon`))[0]!;
  const phi = Number(meta(o.meta_data, '_stripe_fee')) || Math.round((Number(o.total) * 0.029 + 0.3) * 100) / 100;
  const raw = { gia_von: Math.round(Number(x.gv ?? 0) * 100) / 100, ship: Number(x.ship ?? 0), phi, so_mon: o.line_items.reduce((t, i) => t + i.quantity, 0), cj: x.ma ?? '' };
  const huy = ['cancelled', 'failed'].includes(o.status);   // đơn huỷ sau khi trả (không qua hoàn) → không tính doanh thu
  const ev = [{ ts: gmt(o.date_paid_gmt)!, loai: 'don', amount: huy ? 0 : Number(o.total), ma_don: String(o.id), raw: huy ? { ...raw, huy: true } : raw }]
    .concat(o.refunds.map((r) => ({ ts: new Date().toISOString(), loai: 'hoan', amount: Math.abs(Number(r.total)), ma_don: `hoan-${r.id}`, raw: { don: o.id, ly_do: r.reason } as never })));
  for (const e of ev) await q(sql`
    INSERT INTO phu_su_kien (project_id, ts, loai, sid, sid_prefix, platform_slug, amount, ma_don, nguon_du_lieu, raw)
    VALUES (${ch.project_id}, ${e.ts}::timestamptz, ${e.loai}, ${sid}, ${sidPrefix(sid ?? undefined)}, ${x.mon}, ${e.amount}, ${e.ma_don}, ${nguon}, ${JSON.stringify(e.raw)}::jsonb)
    ON CONFLICT (nguon_du_lieu, ma_don) DO UPDATE SET amount = EXCLUDED.amount, raw = EXCLUDED.raw`);
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
  const mon = await q<{ ten: string; sl: number; ma_ncc: string | null; ma_ngoai: string }>(sql`
    SELECT m.ten, m.sl, b.ma_ncc, m.ma_ngoai FROM shop_don_mon m LEFT JOIN shop_bien_the b ON b.id = m.bien_the_id WHERE m.don_id = ${donId} ORDER BY m.id`);
  const thieu = mon.filter((m) => !m.ma_ncc).map((m) => m.ten);
  if (!mon.length || thieu.length) return hong(`thiếu mã biến thể NCC: ${thieu.join(', ') || '(đơn không có món)'} — điền ở tab Sản phẩm`);
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
  await ghiSuKien(donId, nguoi === 'mos2' ? 'ncc' : 'nguoi', `Đã đặt CJ ${r.data.orderId} · ${t.logisticName} ${t.logisticAging} ngày · ship $${t.logisticPrice}${nguoi !== 'mos2' ? ` (${nguoi} bấm)` : ''}`);
  // Woo giữ dấu để cột "CJ" cũ trong admin WP vẫn đọc được.
  await woo(ch, 'PUT', `orders/${d.ma_ngoai}`, { meta_data: [{ key: '_cj_order_id', value: r.data.orderId }, { key: '_cj_trang_thai', value: 'CREATED' },
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

export async function soDuCj(): Promise<number | null> {
  const r = await cj<{ amount: number }>('shopping/pay/getBalance');
  return r.result && r.data ? Number(r.data.amount) : null;
}

type NccSong = { id: number; don_id: number; ma_ncc: string; trang_thai: string; da_tra: boolean; ma_van_don: string | null; bao_khach: boolean;
  so_don: string; ma_ngoai: string; cua_hang_id: number };

/** Theo dõi mọi đơn NCC chưa xong: trạng thái CJ, mã vận đơn (→ báo khách qua ghi chú Woo + completed), hành trình vận đơn. */
export async function theoDoiNcc(ch: CuaHang) {
  const ds = await q<NccSong>(sql`
    SELECT n.id, n.don_id, n.ma_ncc, n.trang_thai, n.da_tra, n.ma_van_don, n.bao_khach, d.so_don, d.ma_ngoai, d.cua_hang_id
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
    if (ma && !n.bao_khach) {
      const note = `Good news, your order is on its way!\n\nTracking number: ${ma}\nTrack it here: ${linkVanDon(ma)}\n\nTracking can take 2-3 days to show movement. Questions? Just reply to this email.`;
      try {
        await woo(ch, 'POST', `orders/${n.ma_ngoai}/notes`, { note, customer_note: true });
        await woo(ch, 'PUT', `orders/${n.ma_ngoai}`, { status: 'completed', meta_data: [{ key: '_ms_tracking', value: ma }, { key: '_cj_trang_thai', value: tt }] });
        await q(sql`UPDATE shop_don_ncc SET bao_khach = true WHERE id = ${n.id}`);
        await ghiSuKien(n.don_id, 'woo', 'Đã gửi mã vận đơn cho khách (email Woo) · đơn → completed');
      } catch (e) { await ghiSuKien(n.don_id, 'woo', `Báo khách lỗi: ${(e as Error).message}`, true); }
    }
    if (ma) await keoVanDon(n.id, n.don_id, ma);
  }
  return { theoDoi: ds.length, doi };
}

/** Hành trình vận đơn từ CJ (getTrackInfo). Hãng báo đã giao → giao_luc + DELIVERED. Mỗi đơn tối đa 1 lần / 3 giờ. */
async function keoVanDon(nccId: number, donId: number, ma: string) {
  const [c] = await q<{ cu: boolean }>(sql`SELECT (van_don_luc IS NULL OR van_don_luc < now() - interval '3 hours') AS cu FROM shop_don_ncc WHERE id = ${nccId}`);
  if (!c?.cu) return;
  const r = await cj<{ trackingStatus?: string; deliveryTime?: string; lastMileCarrier?: string; lastTrackNumber?: string; trackingFrom?: string; trackingTo?: string; deliveryDay?: string; trackingEvents?: unknown }[]>(
    `logistic/getTrackInfo?trackNumber=${encodeURIComponent(ma)}`);
  const v = r.data?.[0];
  await q(sql`UPDATE shop_don_ncc SET van_don_luc = now(), van_don = ${v ? JSON.stringify(v) : null}::jsonb WHERE id = ${nccId}`);
  if (v && /deliver/i.test(String(v.trackingStatus ?? ''))) {
    const daGiao = await q(sql`UPDATE shop_don_ncc SET giao_luc = COALESCE(${v.deliveryTime ?? null}::timestamptz, now()), trang_thai = 'DELIVERED'
                                 WHERE id = ${nccId} AND giao_luc IS NULL RETURNING id`);
    if (daGiao.length) await ghiSuKien(donId, 'ncc', `Hãng báo đã giao${v.lastMileCarrier ? ` (${v.lastMileCarrier})` : ''}`);
  }
}

/* ── MỘT NHỊP ─────────────────────────────────────────────────────────────── */
/** Một lượt cho một cửa hàng: (sản phẩm nếu yêu cầu) → đơn đổi → tự sang NCC đơn đủ điều kiện → theo dõi NCC/vận đơn. */
export async function nhip(ch: CuaHang, opt: { sanPham?: boolean } = {}) {
  const kq: Record<string, unknown> = { cua_hang: ch.khoa };
  try {
    if (opt.sanPham) kq.san_pham = await dongBoSanPham(ch);
    const batDau = new Date().toISOString();
    kq.don = (await dongBoDon(ch)).length;
    if (ch.cau_hinh.tu_sang_ncc) {
      const cho = await q<{ id: number }>(sql`
        SELECT d.id FROM shop_don d WHERE d.cua_hang_id = ${ch.id} AND d.trang_thai_shop = 'processing'
           AND NOT EXISTS (SELECT 1 FROM shop_don_ncc n WHERE n.don_id = d.id AND n.trang_thai <> 'CANCELLED')`);
      kq.sang_ncc = (await Promise.all(cho.map((x) => sangNcc(ch, x.id)))).filter((x) => x.ok).length;
    }
    kq.ncc = await theoDoiNcc(ch);
    await q(sql`UPDATE shop_cua_hang SET dong_bo_luc = ${batDau}::timestamptz, dong_bo_loi = NULL WHERE id = ${ch.id}`);
  } catch (e) {
    kq.loi = (e as Error).message;
    await q(sql`UPDATE shop_cua_hang SET dong_bo_loi = ${kq.loi as string} WHERE id = ${ch.id}`);
  }
  return kq;
}
