// SHOP — HÀNH TRÌNH một đơn: chuỗi chặng từ lúc nhận tiền tới lúc trao tận tay, mỗi chặng có mốc giờ THẬT (sổ đơn, CJ, 17TRACK) hoặc
// chưa tới. Một hàm cho mọi chỗ: dải luồng + cột hành trình + drawer đơn ở /shop (mos2), và 5 bước trên trang theo dõi của khách
// (khach.ts lấy tập con). Phần trăm quãng đường là mốc QUY ƯỚC theo chặng (rời nước gửi ~35%, tới nước khách ~70%…), không phải
// đo khoảng cách — chặng chỉ được đánh dấu khi có mốc thật, không suy theo ngày.
import type { Moc } from './track17';

export type KhoaChang = 'nhan_don' | 'sang_ncc' | 'tra_ncc' | 'gui_hang' | 'hang_nhan' | 'roi_nuoc' | 'den_nuoc' | 'di_giao' | 'da_giao';
export const CHANG: { key: KhoaChang; nhan: string; pct: number; chuThich: string }[] = [
  { key: 'nhan_don', nhan: 'Nhận đơn', pct: 0, chuThich: 'Khách đã trả tiền.' },
  { key: 'sang_ncc', nhan: 'Chuyển NCC', pct: 5, chuThich: 'Đã tạo đơn bên nhà cung cấp (CJ).' },
  { key: 'tra_ncc', nhan: 'Đã trả NCC', pct: 10, chuThich: 'Đã thanh toán CJ — CJ bắt đầu đóng gói.' },
  { key: 'gui_hang', nhan: 'NCC gửi hàng', pct: 15, chuThich: 'CJ cấp mã vận đơn, hàng rời kho NCC.' },
  { key: 'hang_nhan', nhan: 'Hãng nhận hàng', pct: 20, chuThich: 'Hãng vận chuyển quét nhận kiện (17TRACK PickedUp / mốc đầu tiên của hãng).' },
  { key: 'roi_nuoc', nhan: 'Rời nước gửi', pct: 35, chuThich: 'Kiện rời nước gửi, đang bay/chạy quốc tế (17TRACK Departure). ~35% quãng đường.' },
  { key: 'den_nuoc', nhan: 'Tới nước khách', pct: 70, chuThich: 'Mốc đầu tiên ở nước khách (kho/hải quan Mỹ…) hoặc 17TRACK Arrival. ~70% quãng đường.' },
  { key: 'di_giao', nhan: 'Đang phát', pct: 90, chuThich: 'Bưu tá đang mang đi phát (OutForDelivery).' },
  { key: 'da_giao', nhan: 'Trao tận nơi', pct: 100, chuThich: 'Hãng báo đã giao.' },
];

export type VaoHanhTrinh = {
  nhanLuc: string;                 // lúc khách trả tiền (tra_luc ?? tao_luc)
  nccTaoLuc: string | null;        // shop_don_ncc.created_at (đơn NCC đang sống)
  nccTt: string | null; daTra: boolean; traNccLuc: string | null;
  guiLuc: string | null; giaoLuc: string | null;
  moc: Moc[] | null; ttVd: string | null; nuocKhach: string;
};
export type ChangDon = { key: KhoaChang; nhan: string; pct: number; xong: boolean; luc: string | null; chiTiet: string | null };
export type HanhTrinh = { chang: ChangDon[]; hienTai: number; pct: number };

const iso = (s: string) => new Date((s.includes('T') ? s : s.replace(' ', 'T')).replace(/([+-]\d\d)$/, '$1:00')).toISOString();

export function hanhTrinh(v: VaoHanhTrinh): HanhTrinh {
  const tang = [...(v.moc ?? [])].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const giai = (g: string) => tang.find((m) => m.giai_doan === g) ?? null;
  const moiNhat = tang[tang.length - 1] ?? null;
  const trongNuoc = tang.find((m) => m.nuoc === v.nuocKhach) ?? null;

  const giao = v.giaoLuc ? { ts: iso(v.giaoLuc), m: giai('Delivered') } : v.ttVd === 'Delivered' ? { ts: (giai('Delivered') ?? moiNhat)?.ts ?? null, m: giai('Delivered') ?? moiNhat } : null;
  const diGiao = giai('OutForDelivery') ?? (v.ttVd === 'OutForDelivery' ? moiNhat : null);
  const den = giai('Arrival') ?? trongNuoc;
  const roi = giai('Departure');
  const nhan = giai('PickedUp') ?? tang[0] ?? null;
  const daTra = v.daTra || ['UNSHIPPED', 'SHIPPED', 'DELIVERED'].includes(v.nccTt ?? '');
  const noi = (m: Moc | null) => (m ? [m.noi, m.nuoc].filter(Boolean).join(' · ') || m.mo_ta || null : null);

  const tho: Record<KhoaChang, { xong: boolean; luc: string | null; chiTiet: string | null }> = {
    nhan_don: { xong: true, luc: iso(v.nhanLuc), chiTiet: null },
    sang_ncc: { xong: !!v.nccTaoLuc, luc: v.nccTaoLuc ? iso(v.nccTaoLuc) : null, chiTiet: null },
    tra_ncc: { xong: daTra, luc: v.traNccLuc ? iso(v.traNccLuc) : null, chiTiet: null },
    gui_hang: { xong: !!v.guiLuc, luc: v.guiLuc ? iso(v.guiLuc) : null, chiTiet: null },
    hang_nhan: { xong: !!nhan, luc: nhan?.ts ?? null, chiTiet: noi(nhan) },
    roi_nuoc: { xong: !!roi, luc: roi?.ts ?? null, chiTiet: noi(roi) },
    den_nuoc: { xong: !!den, luc: den?.ts ?? null, chiTiet: noi(den) },
    di_giao: { xong: !!diGiao, luc: diGiao?.ts ?? null, chiTiet: noi(diGiao) },
    da_giao: { xong: !!giao, luc: giao?.ts ?? null, chiTiet: noi(giao?.m ?? null) },
  };
  // Chặng sau đã có mốc thật thì các chặng trước chắc chắn đã qua (hãng hay bỏ quét Departure/PickedUp) — đánh xong, giờ để trống.
  let sau = false;
  for (let i = CHANG.length - 1; i >= 0; i--) { const t = tho[CHANG[i]!.key]; if (t.xong) sau = true; else if (sau) t.xong = true; }
  const chang = CHANG.map((c) => ({ key: c.key, nhan: c.nhan, pct: c.pct, ...tho[c.key] }));
  const hienTai = chang.reduce((i, c, j) => (c.xong ? j : i), 0);
  return { chang, hienTai, pct: chang[hienTai]!.pct };
}

// Tự kiểm: node_modules/.bin/tsx packages/shop/src/hanh-trinh.ts
if (process.argv[1]?.endsWith('hanh-trinh.ts')) {
  const goc: VaoHanhTrinh = { nhanLuc: '2026-10-01 10:00:00+07', nccTaoLuc: null, nccTt: null, daTra: false, traNccLuc: null, guiLuc: null, giaoLuc: null, moc: null, ttVd: null, nuocKhach: 'US' };
  const a = hanhTrinh(goc);
  if (a.hienTai !== 0 || a.pct !== 0) throw new Error('đơn mới phải ở Nhận đơn');
  const b = hanhTrinh({ ...goc, nccTaoLuc: '2026-10-01 10:05:00+07', daTra: true, guiLuc: '2026-10-03 08:00:00+07',
    moc: [{ ts: '2026-10-06T02:00:00Z', mo_ta: 'Arrived at facility', noi: 'Los Angeles, CA', nuoc: 'US', giai_doan: null },
      { ts: '2026-10-04T02:00:00Z', mo_ta: 'Accepted', noi: 'Shenzhen', nuoc: 'CN', giai_doan: 'PickedUp' }], ttVd: 'InTransit' });
  if (b.chang[b.hienTai]!.key !== 'den_nuoc' || b.pct !== 70) throw new Error(`mốc ở US phải là Tới nước khách, ra ${b.chang[b.hienTai]!.key}`);
  if (!b.chang.find((c) => c.key === 'roi_nuoc')!.xong) throw new Error('đã tới nước khách thì Rời nước gửi phải xong');
  const c = hanhTrinh({ ...goc, nccTaoLuc: '2026-10-01 10:05:00+07', giaoLuc: '2026-10-12 09:00:00+07' });
  if (c.pct !== 100 || !c.chang.every((x) => x.xong)) throw new Error('đã giao thì mọi chặng xong');
  console.log('hanh-trinh: 3/3 ok');
}
