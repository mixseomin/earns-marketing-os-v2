// SHOP — bản theo dõi đơn CHO KHÁCH (trang mellowstep.com/track-order + khung trong My Account, mu-plugin mellowstep-track.php gọi qua
// /api/shop/khach/<khoa>). Luật anh chốt 01/10/2026: chặng ngoài nước khách KHÔNG lộ nơi thật / tên hãng TQ — hiện "<Tên shop> Center"
// và câu trung tính theo giai đoạn; từ lúc hàng vào nước khách thì hiện nguyên mốc của hãng (thành phố, mô tả). Không bịa mốc nào:
// mỗi dòng là một mốc có thật (của 17TRACK hoặc của sổ đơn), chỉ đổi cách gọi tên chặng ngoài.
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import type { Moc } from './track17';
import { hanhTrinh, type ChangDon, type KhoaChang } from './hanh-trinh';
import { CHANG_KHACH, camKetGiao, cauHinhGiao, duKienGiao, loiImLang } from './giao';

export type BuocKhach = { nhan: string; xong: boolean; luc: string | null };
export type MocKhach = { ts: string; mo_ta: string; noi: string };
export type BanKhach = {
  so_don: string; ngay_dat: string; buoc: BuocKhach[]; hien_tai: number;
  du_kien: { tu: string; den: string } | null;
  moc: MocKhach[];
  mon: { ten: string; sl: number; anh: string | null }[];
  chang_cuoi: { ma: string; hang: string; link: string | null } | null;
  ghi_chu: string | null;
  /** Thanh tiến độ: chặng đang đứng (tên + lời giải thích cho khách, @mos2/shop/giao CHANG_KHACH) + % quy ước của chặng. */
  tien_do: { pct: number; nhan: string; giai_thich: string } | null;
  /** Vận đơn im lâu → một câu trấn an nói thật về chặng đang đi (null = không cần). */
  im_lang: string | null;
  cam_ket: string;
};

const LINK_HANG: Record<string, (m: string) => string> = {
  usps: (m) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(m)}`,
  ups: (m) => `https://www.ups.com/track?tracknum=${encodeURIComponent(m)}`,
  fedex: (m) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(m)}`,
};

/** Đổi mốc chặng ngoài thành tên trung tính "<shop> Center". Chặng ngoài = mốc ở nước khác nước khách, hoặc chưa rõ nước mà
 *  xảy ra TRƯỚC mốc đầu tiên trong nước khách. */
export function moCuaKhach(moc: Moc[], nuocKhach: string, tenShop: string): MocKhach[] {
  const center = `${tenShop} Center`;
  const tangDan = [...moc].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const vaoNuoc = tangDan.find((m) => m.nuoc === nuocKhach)?.ts ?? null;
  const ngoai = (m: Moc) => (m.nuoc ? m.nuoc !== nuocKhach : !vaoNuoc || m.ts < vaoNuoc);
  const CAU: Record<string, string> = {
    InfoReceived: `Order processed at ${center}`, PickedUp: `Package picked up at ${center}`,
    Departure: `Departed ${center}`, Arrival: 'In transit to your country',
  };
  const ra: MocKhach[] = [];
  for (const m of tangDan) {
    const x = ngoai(m)
      ? { ts: m.ts, mo_ta: CAU[m.giai_doan ?? ''] ?? 'In transit', noi: center }
      : { ts: m.ts, mo_ta: m.mo_ta, noi: m.noi };
    const truoc = ra[ra.length - 1];
    // nhiều mốc chặng ngoài liền nhau cùng một câu (hãng TQ báo lắt nhắt) → giữ một, mốc sớm nhất
    if (truoc && truoc.noi === center && x.noi === center && truoc.mo_ta === x.mo_ta) continue;
    ra.push(x);
  }
  return ra.reverse();
}

type Dong = { id: number; so_don: string; trang_thai_shop: string; tao_luc: string; dia_chi: { nuoc?: string }; khach: { email?: string }; ten: string;
  ncc_tt: string | null; da_tra: boolean | null; ma_van_don: string | null; gui_luc: string | null; giao_luc: string | null; so_ngay: string | null;
  moc: Moc[] | null; tt_vd: string | null; du_kien: { tu: string | null; den: string | null } | null; ma_chang_cuoi: string | null; hang_chang_cuoi: string | null;
  mat_tien: { giao?: unknown } | null; ncc_tao: string | null; tra_ncc: string | null };

/** Tìm đơn theo (số đơn + order_key) hoặc (số đơn + email) — một trong hai phải khớp, không thì trả null (không lộ đơn người khác). */
export async function banKhach(khoa: string, soDon: string, chia: { key?: string; email?: string }): Promise<BanKhach | null> {
  const db = getDb();
  if (!db || !soDon || (!chia.key && !chia.email)) return null;
  const r = (await db.execute(sql`
    SELECT d.id, d.so_don, d.trang_thai_shop, d.tao_luc::text AS tao_luc, d.dia_chi, d.khach, c.ten, c.mat_tien, n.created_at::text AS ncc_tao, n.tra_luc::text AS tra_ncc,
           n.trang_thai AS ncc_tt, n.da_tra, n.ma_van_don, n.gui_luc::text AS gui_luc, n.giao_luc::text AS giao_luc, n.so_ngay,
           n.moc, n.tt_vd, n.du_kien, n.ma_chang_cuoi, n.hang_chang_cuoi
      FROM shop_don d JOIN shop_cua_hang c ON c.id = d.cua_hang_id
      LEFT JOIN LATERAL (SELECT * FROM shop_don_ncc x WHERE x.don_id = d.id AND x.trang_thai NOT IN ('CANCELLED', 'LOI', 'TRASH') ORDER BY x.id DESC LIMIT 1) n ON true
     WHERE c.khoa = ${khoa} AND d.so_don = ${soDon} AND d.trang_thai_shop NOT IN ('pending', 'failed', 'checkout-draft')
       AND (${chia.key ?? ''} <> '' AND d.khoa_don = ${chia.key ?? ''} OR ${(chia.email ?? '').trim().toLowerCase()} <> '' AND lower(d.khach->>'email') = ${(chia.email ?? '').trim().toLowerCase()})
     LIMIT 1`)) as unknown as Dong[];
  const d = r[0];
  if (!d) return null;
  const mon = (await db.execute(sql`
    SELECT m.ten, m.sl, p.anh FROM shop_don_mon m LEFT JOIN shop_bien_the b ON b.id = m.bien_the_id LEFT JOIN shop_san_pham p ON p.id = b.san_pham_id
     WHERE m.don_id = ${d.id} ORDER BY m.id`)) as unknown as { ten: string; sl: number; anh: string | null }[];

  const iso = (s: string) => new Date((s.includes('T') ? s : s.replace(' ', 'T')).replace(/([+-]\d\d)$/, '$1:00')).toISOString();
  const moc = moCuaKhach(d.moc ?? [], d.dia_chi?.nuoc || 'US', d.ten);
  // Năm bước của khách = tập con của hành trình nội bộ (một hàm, một luật đánh dấu chặng)
  const ht = hanhTrinh({ nhanLuc: d.tao_luc, nccTaoLuc: d.ncc_tao, nccTt: d.ncc_tt, daTra: !!d.da_tra, traNccLuc: d.tra_ncc, guiLuc: d.gui_luc,
    giaoLuc: d.giao_luc, moc: d.moc, ttVd: d.tt_vd, nuocKhach: d.dia_chi?.nuoc || 'US' });
  const c = Object.fromEntries(ht.chang.map((x) => [x.key, x])) as Record<KhoaChang, ChangDon>;
  const giao = c.da_giao.xong ? c.da_giao.luc ?? moc[0]?.ts ?? null : null;
  const gui = c.gui_hang.luc;
  const buoc: BuocKhach[] = [
    { nhan: 'Ordered', xong: true, luc: c.nhan_don.luc },
    { nhan: 'Packed', xong: c.tra_ncc.xong, luc: null },
    { nhan: 'Shipped', xong: c.gui_hang.xong, luc: gui },
    { nhan: 'Out for delivery', xong: c.di_giao.xong, luc: c.di_giao.luc },
    { nhan: 'Delivered', xong: c.da_giao.xong, luc: giao },
  ];
  // Ngày dự kiến: hãng báo thì theo hãng; không thì ngày gửi + số ngày của tuyến ("5-11")
  let duKien: BanKhach['du_kien'] = null;
  const g = cauHinhGiao(d.mat_tien?.giao);
  if (!giao && d.du_kien?.tu && d.du_kien?.den) duKien = { tu: d.du_kien.tu, den: d.du_kien.den };
  else if (!giao && !gui) { const k = duKienGiao(g, new Date(iso(d.tao_luc))); duKien = { tu: k.tu.toISOString(), den: k.den.toISOString() }; }
  else if (!giao && gui && d.so_ngay) {
    const so = (d.so_ngay.match(/\d+/g) ?? []).map(Number);
    if (so.length) {
      const cong = (n: number) => new Date(Date.parse(gui) + n * 86_400_000).toISOString();
      duKien = { tu: cong(Math.min(...so)), den: cong(Math.max(...so) + 2) };
    }
  }
  // Mốc của sổ đơn khi hãng chưa có gì (hoặc chưa bật 17TRACK): vẫn là mốc thật — đặt hàng, đóng gói, gửi đi.
  const mocSo: MocKhach[] = [
    ...(gui ? [{ ts: gui, mo_ta: `Shipped from ${d.ten} Center`, noi: `${d.ten} Center` }] : []),
    { ts: iso(d.tao_luc), mo_ta: 'Order placed', noi: '' },
  ];
  const tatCa = [...moc, ...mocSo.filter((m) => !moc.some((x) => Math.abs(Date.parse(x.ts) - Date.parse(m.ts)) < 3600_000))]
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const hang = (d.hang_chang_cuoi ?? '').toLowerCase();
  const kh = Object.keys(LINK_HANG).find((k) => hang.includes(k));
  const huy = ['cancelled', 'refunded'].includes(d.trang_thai_shop);
  return {
    so_don: d.so_don, ngay_dat: iso(d.tao_luc), buoc, hien_tai: buoc.reduce((i, b, j) => (b.xong ? j : i), 0),
    du_kien: duKien, moc: tatCa, mon,
    chang_cuoi: d.ma_chang_cuoi && kh ? { ma: d.ma_chang_cuoi, hang: kh.toUpperCase(), link: LINK_HANG[kh]!(d.ma_chang_cuoi) } : null,
    ghi_chu: ['cancelled', 'refunded'].includes(d.trang_thai_shop) ? 'This order has been cancelled.'
      : gui && !moc.some((m) => m.noi && !m.noi.endsWith('Center')) ? 'Tracking usually updates within 2-3 days after shipping.' : null,
    tien_do: huy ? null : { pct: ht.pct, ...CHANG_KHACH[ht.chang[ht.hienTai]!.key] },
    im_lang: huy ? null : loiImLang(ht.chang[ht.hienTai]!.key, (d.moc ?? []).map((m) => m.ts).sort().pop() ?? gui),
    cam_ket: camKetGiao(g),
  };
}
