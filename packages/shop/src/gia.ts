// Tính tiền giỏ — MỘT chỗ cho cả trình duyệt (giỏ ngăn kéo, trang checkout) và máy chủ (số tiền PaymentIntent). Máy chủ luôn tính
// lại từ giá trong sổ; số trình duyệt hiện chỉ để xem.
import type { BacGiam } from './mat-tien';

export type DongGio = { gia: number; gia_goc?: number | null; sl: number };
export type TongGio = {
  so_mon: number; tam_tinh: number; goc: number; pt: number; giam: number; ship: number; tong: number;
  tiet_kiem: number;                         // (giá gốc − giá bán) + giảm theo bậc
  bac_tiep: { can: number; pt: number } | null; // thêm `can` món nữa thì được pt% (bậc kế)
};

const c = (n: number) => Math.round(n * 100) / 100;

export function bacDat(bac: BacGiam[], soMon: number): number {
  return bac.reduce((pt, b) => (soMon >= b.sl ? Math.max(pt, b.pt) : pt), 0);
}

export function tinhGio(dong: DongGio[], bac: BacGiam[], ship: { phi: number; mien_phi_tu?: number | null }): TongGio {
  const soMon = dong.reduce((t, d) => t + d.sl, 0);
  const tamTinh = c(dong.reduce((t, d) => t + d.gia * d.sl, 0));
  const goc = c(dong.reduce((t, d) => t + Math.max(d.gia_goc ?? d.gia, d.gia) * d.sl, 0));
  const pt = bacDat(bac, soMon);
  const giam = c(tamTinh * pt / 100);
  const sauGiam = c(tamTinh - giam);
  const phiShip = soMon === 0 || (ship.mien_phi_tu != null && sauGiam >= ship.mien_phi_tu) ? 0 : c(ship.phi);
  const tiep = [...bac].sort((a, b) => a.sl - b.sl).find((b) => b.sl > soMon && b.pt > pt) ?? null;
  return {
    so_mon: soMon, tam_tinh: tamTinh, goc, pt, giam, ship: phiShip, tong: c(sauGiam + phiShip),
    tiet_kiem: c(goc - tamTinh + giam),
    bac_tiep: tiep ? { can: tiep.sl - soMon, pt: tiep.pt } : null,
  };
}

export const usd = (n: number) => `$${n.toFixed(2)}`;
