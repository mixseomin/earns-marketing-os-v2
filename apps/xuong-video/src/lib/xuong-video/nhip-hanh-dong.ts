// Gói "impact" + nhịp hành động cả tập (12/10/2026): thay vì đặt tay từng lớp rung / chớp / zoom và chọn tiếng cho mỗi điểm cắt.
//   lopImpact(tCat)   = 3 lớp hiệu ứng khung CÙNG NHÓM (một đối tượng trên timeline): chớp trắng 0,3s · rung 0,4s · zoom nhịp 0,3s.
//   nhipHanhDong(...) = đi qua mọi điểm cắt, theo kiểu chuyển cảnh của shot trước:
//       cắt sốc (hoặc shot sau đã có tiếng va: đập, vỡ kính, sấm, chập điện) → gói impact + tiếng đập ở shot sau (nếu chưa có tiếng va)
//       quất / phóng vào / gió cuốn → tiếng vút ở shot sau · loé trắng → âm doạ (sting) ở shot sau
//     Điểm cắt đã có lớp hiệu ứng (±0,1s) thì để nguyên; mỗi shot tối đa 3 tiếng (giới hạn của nhóm âm thanh). Thuần — nút trên timeline gọi.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nhip-hanh-dong.test.mts
import { lopMoi, idLop } from './lop';
import type { KyThuatShot } from './dien-anh';
import type { Lop } from './kieu';

const VA = ['dap', 'vo_kinh', 'sam', 'chop_dien'];
const VUT = ['quat_chuyen', 'phong_vao', 'gio_cuon'];
const r2 = (x: number) => Math.round(x * 100) / 100;

export function lopImpact(tCat: number): Lop[] {
  const nhom = `imp-${idLop()}`;
  return [
    lopMoi('hieu_ung', Math.max(0, tCat - 0.03), { hu: 'chop', cuong: 0.7, den: r2(tCat + 0.3), ten: 'Impact · chớp', nhom }),
    lopMoi('hieu_ung', tCat, { hu: 'rung', cuong: 0.75, den: r2(tCat + 0.4), ten: 'Impact · rung', nhom }),
    lopMoi('hieu_ung', tCat, { hu: 'zoom', cuong: 0.5, den: r2(tCat + 0.3), ten: 'Impact · zoom', nhom }),
  ];
}
/** Thêm một tiếng vào nhóm âm thanh của shot (không trùng, tối đa 3). */
export function themTieng(kt: KyThuatShot | undefined, key: string): KyThuatShot {
  const am = kt?.am_thanh ?? [];
  return am.includes(key) || am.length >= 3 ? { ...kt } : { ...kt, am_thanh: [...am, key] };
}

type ShotNhip = { id: number; ky_thuat?: KyThuatShot };
/** batDau[i] = giây bắt đầu của shot i trong phim. Trả lớp mới cần thêm + kỹ thuật mới của những shot cần đổi. */
export function nhipHanhDong(canh: ShotNhip[], batDau: number[], lop: Lop[]): { lop: Lop[]; kt: { id: number; ky_thuat: KyThuatShot }[] } {
  const lopMoiDs: Lop[] = []; const doi = new Map<number, KyThuatShot>();
  const daCo = (t: number) => lop.some((l) => l.loai === 'hieu_ung' && Math.abs(l.tu - t) < 0.1);
  for (let i = 0; i + 1 < canh.length; i++) {
    const cc = canh[i]!.ky_thuat?.chuyen_canh; const sau = canh[i + 1]!; const tCat = batDau[i + 1]!;
    const ktSau = doi.get(sau.id) ?? sau.ky_thuat ?? {};
    const coVa = (ktSau.am_thanh ?? []).some((k) => VA.includes(k));
    if (cc === 'cat_soc' || (!cc && coVa)) {
      if (!daCo(tCat)) lopMoiDs.push(...lopImpact(tCat));
      if (!coVa) doi.set(sau.id, themTieng(ktSau, 'dap'));
    } else if (cc && VUT.includes(cc)) doi.set(sau.id, themTieng(ktSau, 'vut'));
    else if (cc === 'loe_trang') doi.set(sau.id, themTieng(ktSau, 'dap_doa'));
  }
  const kt = [...doi].filter(([id, k]) => JSON.stringify(k) !== JSON.stringify(canh.find((c) => c.id === id)?.ky_thuat ?? {})).map(([id, ky_thuat]) => ({ id, ky_thuat }));
  return { lop: lopMoiDs, kt };
}
