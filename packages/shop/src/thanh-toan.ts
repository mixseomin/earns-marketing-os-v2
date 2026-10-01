// Thanh toán của mặt tiền mos: giỏ → phiên (shop_thanh_toan) + Stripe PaymentIntent → trả xong → MỘT đơn shop_don ('processing'),
// rồi máy vận hành sẵn có (apps/web dong-bo: sang CJ, vận đơn, thư "đã gửi") lo tiếp như đơn Woo.
// Chốt đơn chạy được từ 3 cửa, cửa nào tới trước thắng, các cửa sau không làm gì: webhook Stripe · trang cảm ơn · nhịp đối soát cron.
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { q, ghiSuKien, linkTheoDoi } from './su-kien';
import { tinhGio, type TongGio } from './gia';
import { matTien, type MatTien } from './mat-tien';
import { stripe, type Pi } from './stripe';
import { ghiSoPhuDon } from './so-phu';
import { guiThu, thuXacNhan } from './thu';

export type ShopTT = { id: number; khoa: string; project_id: string; ten: string; domain: string; nen_tang: string; mat_tien: MatTien };
export type MonTT = { bien_the_id: number; san_pham_id: number; slug: string; ten: string; tuy_chon: string; anh: string | null; sl: number; gia: number; gia_goc: number | null };
export type KhachTT = { ten: string; email: string; sdt: string };
export type DiaChiTT = { ten: string; dong1: string; dong2: string; thanh_pho: string; bang: string; zip: string; nuoc: string };

/** Giá lấy từ SỔ (không tin số trình duyệt gửi). Biến thể không thuộc shop / ẩn / hết hàng thì bỏ. */
export async function monTuSo(ch: { id: number }, yeuCau: { b: number; sl: number }[]): Promise<MonTT[]> {
  const ids = [...new Set(yeuCau.map((x) => Math.trunc(Number(x.b))).filter((x) => x > 0))];
  if (!ids.length) return [];
  const rows = await q<{ id: number; san_pham_id: number; slug: string; ten_sp: string; ten: string; tuy_chon: Record<string, string>; anh: string | null;
    anh_sp: string | null; gia_ban: string; gia_goc: string | null; gia_goc_sp: string | null; tc_sp: { ten: string }[] }>(sql`
    SELECT b.id, b.san_pham_id, p.slug, p.ten AS ten_sp, b.ten, b.tuy_chon, b.anh, p.anh AS anh_sp, p.tuy_chon AS tc_sp, b.gia_ban::text, b.gia_goc::text, p.gia_goc::text AS gia_goc_sp
      FROM shop_bien_the b JOIN shop_san_pham p ON p.id = b.san_pham_id
     WHERE p.cua_hang_id = ${ch.id} AND p.hien AND NOT b.het_hang AND b.gia_ban IS NOT NULL
       AND b.id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const theoId = new Map(rows.map((r) => [r.id, r]));
  const ra: MonTT[] = [];
  for (const y of yeuCau) {
    const r = theoId.get(Math.trunc(Number(y.b)));
    const sl = Math.min(20, Math.max(1, Math.trunc(Number(y.sl) || 1)));
    if (!r) continue;
    const goc = r.gia_goc ?? r.gia_goc_sp;
    ra.push({ bien_the_id: r.id, san_pham_id: r.san_pham_id, slug: r.slug, ten: r.ten_sp, // jsonb tự xếp lại khoá → đọc theo thứ tự tuỳ chọn của sản phẩm (Color rồi Size), không theo object biến thể
      tuy_chon: (r.tc_sp ?? []).map((t) => r.tuy_chon?.[t.ten]).filter(Boolean).join(' / ') || r.ten,
      anh: r.anh ?? r.anh_sp, sl, gia: Number(r.gia_ban), gia_goc: goc ? Number(goc) : null });
  }
  return ra;
}

export const tongCua = (ch: ShopTT, mon: MonTT[]): TongGio => {
  const m = matTien(ch.mat_tien);
  return tinhGio(mon, m.bac_giam, m.ship);
};

/** Tạo/cập nhật phiên + PaymentIntent cho giỏ hiện tại. Trả client_secret để trình duyệt xác nhận thẻ / Apple Pay. */
export async function moThanhToan(ch: ShopTT, ttId: string | null, yeuCau: { b: number; sl: number }[], utm: Record<string, string>) {
  const mon = await monTuSo(ch, yeuCau);
  if (!mon.length) throw new Error('giỏ trống');
  const t = tongCua(ch, mon);
  const cents = Math.round(t.tong * 100);
  const cu = ttId ? (await q<{ id: string; pi: string | null; trang_thai: string }>(sql`
    SELECT id, pi, trang_thai FROM shop_thanh_toan WHERE id = ${ttId}::uuid AND cua_hang_id = ${ch.id}`).catch(() => []))[0] : undefined;
  if (cu && cu.trang_thai === 'cho' && cu.pi) {
    const pi = await stripe<Pi>(ch.khoa, 'POST', `payment_intents/${cu.pi}`, { amount: cents });
    await q(sql`UPDATE shop_thanh_toan SET mon = ${JSON.stringify(mon)}::jsonb, tam_tinh = ${t.tam_tinh}, giam = ${t.giam}, ship = ${t.ship}, tong = ${t.tong}, cap_nhat = now() WHERE id = ${cu.id}::uuid`);
    return { id: cu.id, client_secret: pi.client_secret, mon, tong: t };
  }
  const [r] = await q<{ id: string }>(sql`
    INSERT INTO shop_thanh_toan (cua_hang_id, mon, tam_tinh, giam, ship, tong, utm)
    VALUES (${ch.id}, ${JSON.stringify(mon)}::jsonb, ${t.tam_tinh}, ${t.giam}, ${t.ship}, ${t.tong}, ${JSON.stringify(utm)}::jsonb) RETURNING id`);
  const pi = await stripe<Pi>(ch.khoa, 'POST', 'payment_intents', {
    amount: cents, currency: 'usd', payment_method_types: ['card'], description: `${ch.ten} order`,
    statement_descriptor_suffix: ch.ten.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 22),
    metadata: { tt: r!.id, shop: ch.khoa },
  }, `tt-${r!.id}`);
  await q(sql`UPDATE shop_thanh_toan SET pi = ${pi.id} WHERE id = ${r!.id}::uuid`);
  return { id: r!.id, client_secret: pi.client_secret, mon, tong: t };
}

/** Ghi thông tin khách ngay trước khi xác nhận thanh toán (form hoặc ví Apple Pay). */
export async function ghiKhach(ch: ShopTT, ttId: string, khach: KhachTT, diaChi: DiaChiTT) {
  const [r] = await q<{ pi: string | null }>(sql`
    UPDATE shop_thanh_toan SET khach = ${JSON.stringify(khach)}::jsonb, dia_chi = ${JSON.stringify(diaChi)}::jsonb, cap_nhat = now()
     WHERE id = ${ttId}::uuid AND cua_hang_id = ${ch.id} AND trang_thai = 'cho' RETURNING pi`);
  if (!r?.pi) throw new Error('phiên thanh toán không còn');
  await stripe(ch.khoa, 'POST', `payment_intents/${r.pi}`, {
    receipt_email: khach.email || undefined,
    shipping: { name: diaChi.ten || khach.ten, phone: khach.sdt || undefined,
      address: { line1: diaChi.dong1, line2: diaChi.dong2 || undefined, city: diaChi.thanh_pho, state: diaChi.bang, postal_code: diaChi.zip, country: diaChi.nuoc || 'US' } },
  });
}

type TTRow = { id: string; cua_hang_id: number; mon: MonTT[]; tam_tinh: string; giam: string; ship: string; tong: string; khach: KhachTT; dia_chi: DiaChiTT;
  utm: Record<string, string>; pi: string | null; trang_thai: string; don_id: number | null };

/** Trả xong → đơn. Idempotent: phiên 'da_tra' trả luôn đơn cũ; giành phiên bằng UPDATE … WHERE trang_thai='cho' nên hai cửa cùng lúc
 *  chỉ một cửa tạo đơn. Trả { don_id, so_don, khoa_don } hoặc null nếu Stripe chưa báo thành công. */
export async function chotThanhToan(ch: ShopTT, ttId: string): Promise<{ don_id: number; so_don: string; khoa_don: string } | null> {
  const [tt] = await q<TTRow>(sql`SELECT * FROM shop_thanh_toan WHERE id = ${ttId}::uuid AND cua_hang_id = ${ch.id}`);
  if (!tt?.pi) return null;
  const daCo = async (donId: number) => (await q<{ so_don: string; khoa_don: string }>(sql`SELECT so_don, khoa_don FROM shop_don WHERE id = ${donId}`))
    .map((d) => ({ don_id: donId, ...d }))[0] ?? null;
  if (tt.don_id) return daCo(tt.don_id);
  const pi = await stripe<Pi & { shipping?: { name?: string; phone?: string; address?: Record<string, string> } | null; receipt_email?: string | null }>(
    ch.khoa, 'GET', `payment_intents/${tt.pi}?expand[]=latest_charge.balance_transaction`);
  if (pi.status !== 'succeeded') return null;
  const giu = await q(sql`UPDATE shop_thanh_toan SET trang_thai = 'dang_chot', cap_nhat = now()
                           WHERE id = ${ttId}::uuid AND (trang_thai = 'cho' OR (trang_thai = 'dang_chot' AND cap_nhat < now() - interval '5 minutes')) RETURNING id`);
  if (!giu.length) return null;   // cửa khác đang chốt
  try {
    const sh = pi.shipping, a = sh?.address ?? {};
    const charge = (pi as unknown as { latest_charge?: { billing_details?: { email?: string; name?: string; phone?: string }; balance_transaction?: { fee?: number } } }).latest_charge;
    const khach: KhachTT = { ten: tt.khach.ten || sh?.name || charge?.billing_details?.name || '', email: tt.khach.email || pi.receipt_email || charge?.billing_details?.email || '',
      sdt: tt.khach.sdt || sh?.phone || charge?.billing_details?.phone || '' };
    const diaChi: DiaChiTT = tt.dia_chi?.dong1 ? tt.dia_chi : { ten: sh?.name ?? khach.ten, dong1: a.line1 ?? '', dong2: a.line2 ?? '', thanh_pho: a.city ?? '',
      bang: a.state ?? '', zip: a.postal_code ?? '', nuoc: a.country ?? 'US' };
    const phi = charge?.balance_transaction?.fee != null ? charge.balance_transaction.fee / 100 : null;
    const tong = pi.amount_received / 100;
    const [so] = await q<{ so: number }>(sql`UPDATE shop_cua_hang SET so_don_tiep = so_don_tiep + 1 WHERE id = ${ch.id} RETURNING so_don_tiep - 1 AS so`);
    const khoaDon = randomBytes(12).toString('hex');
    const sid = tt.utm?.sid || null;
    const [d] = await q<{ id: number; so_don: string; khoa_don: string }>(sql`
      INSERT INTO shop_don (cua_hang_id, ma_ngoai, so_don, khoa_don, trang_thai_shop, khach, dia_chi, tong, tien_te, ship_khach, phi_cong, sid, cong_tt, tao_luc, tra_luc, raw)
      VALUES (${ch.id}, ${`tt-${tt.id}`}, ${String(so!.so)}, ${khoaDon}, 'processing', ${JSON.stringify(khach)}::jsonb, ${JSON.stringify(diaChi)}::jsonb, ${tong}, 'USD',
              ${Number(tt.ship)}, ${phi}, ${sid}, 'Stripe', now(), now(), ${JSON.stringify({ pi: pi.id, utm: tt.utm, giam: Number(tt.giam) })}::jsonb)
      ON CONFLICT (cua_hang_id, ma_ngoai) DO UPDATE SET updated_at = now()
      RETURNING id, so_don, khoa_don`);
    const donId = d!.id;
    // Thành tiền từng dòng đã trừ phần giảm theo bậc (chia đều theo tỉ lệ) — cột "gia" của sổ là tiền khách thật trả cho dòng đó.
    const heSo = Number(tt.tam_tinh) ? (Number(tt.tam_tinh) - Number(tt.giam)) / Number(tt.tam_tinh) : 1;
    for (const [i, m] of tt.mon.entries()) await q(sql`
      INSERT INTO shop_don_mon (don_id, ma_ngoai, bien_the_id, ten, sl, gia)
      VALUES (${donId}, ${String(i + 1)}, ${m.bien_the_id}, ${`${m.ten} - ${m.tuy_chon}`}, ${m.sl}, ${Math.round(m.gia * m.sl * heSo * 100) / 100})
      ON CONFLICT (don_id, ma_ngoai) DO NOTHING`);
    await ghiSuKien(donId, 'shop', `Đơn #${d!.so_don} vào sổ — Stripe $${tong.toFixed(2)}${sid ? ` · nguồn ${sid}` : ''}`);
    await q(sql`UPDATE shop_thanh_toan SET trang_thai = 'da_tra', don_id = ${donId}, khach = ${JSON.stringify(khach)}::jsonb, dia_chi = ${JSON.stringify(diaChi)}::jsonb, cap_nhat = now() WHERE id = ${ttId}::uuid`);
    await ghiSoPhuDon(donId, { projectId: ch.project_id, nguon: `shop:${ch.khoa}`, maDon: d!.so_don, traLuc: new Date().toISOString(), tong, huy: false, sid, phi,
      soMon: tt.mon.reduce((t, m) => t + m.sl, 0), hoan: [] }).catch((e) => ghiSuKien(donId, 'shop', `Ghi sổ PHỦ lỗi: ${(e as Error).message}`, true));
    if (khach.email) {
      const m = matTien(ch.mat_tien);
      const shopThu = { khoa: ch.khoa, ten: ch.ten, domain: ch.domain, email: m.email ?? `support@${ch.domain}` };
      const thu = thuXacNhan(shopThu, { so_don: d!.so_don, ten: khach.ten.split(' ')[0] || 'there', mon: tt.mon.map((x) => ({ ten: x.ten, tuy_chon: x.tuy_chon, sl: x.sl, gia: x.gia })),
        tam_tinh: Number(tt.tam_tinh), giam: Number(tt.giam), ship: Number(tt.ship), tong,
        dia_chi: [diaChi.ten, diaChi.dong1, diaChi.dong2, `${diaChi.thanh_pho}, ${diaChi.bang} ${diaChi.zip}`, diaChi.nuoc].filter(Boolean).join(', '),
        link: linkTheoDoi(ch, d!.so_don, d!.khoa_don) });
      await guiThu(shopThu, khach.email, thu.tieuDe, thu.html, thu.chu)
        .then(() => ghiSuKien(donId, 'shop', `Đã gửi thư xác nhận tới ${khach.email}`))
        .catch((e) => ghiSuKien(donId, 'shop', `Gửi thư xác nhận lỗi: ${(e as Error).message}`, true));
    }
    return { don_id: donId, so_don: d!.so_don, khoa_don: d!.khoa_don };
  } catch (e) {
    await q(sql`UPDATE shop_thanh_toan SET trang_thai = 'cho', loi = ${(e as Error).message}, cap_nhat = now() WHERE id = ${ttId}::uuid AND trang_thai = 'dang_chot'`);
    throw e;
  }
}

/** Lưới đỡ: phiên đã có PaymentIntent trong 2 ngày mà chưa thành đơn → hỏi Stripe, trả rồi thì chốt (khách đóng tab trước trang cảm ơn
 *  + webhook trượt). Gọi từ nhịp cron của cửa hàng mos. */
export async function doiSoat(ch: ShopTT) {
  const ds = await q<{ id: string }>(sql`
    SELECT id FROM shop_thanh_toan WHERE cua_hang_id = ${ch.id} AND pi IS NOT NULL AND don_id IS NULL
       AND trang_thai IN ('cho', 'dang_chot') AND tao_luc > now() - interval '2 days' AND cap_nhat < now() - interval '2 minutes'`);
  let chot = 0;
  for (const x of ds) if (await chotThanhToan(ch, x.id).catch(() => null)) chot++;
  return { phien: ds.length, chot };
}
