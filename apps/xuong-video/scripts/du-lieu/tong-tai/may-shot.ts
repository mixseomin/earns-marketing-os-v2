// MÁY TỰ ĐẶT cho shot tập mẫu tổng tài (anh 17/10/2026, khung 3D đầu tiên: máy gõ tay nằm trong người phụ, dí sát mặt, cắt mất nhân vật):
// shot.json chỉ khai PHÍA máy (giữ hướng / trục đã chấm) — khoảng cách, cao, ống kính do bo-set-3d.ts › datMayTuDong tính theo cỡ cảnh / góc /
// ống kính của thẻ shot; bộ giải trong Blender (dung-set.py › giai_may) còn xoay / nâng / lùi khi chủ thể bị che. CÙNG khoá `vao` với
// scripts/bo-set.mts: đầu vào không đổi thì GIỮ máy đã giải (nạp lại không làm hỏng khung đã dựng). Dùng chung cho nap.mts + kiem.mts.
import { datMayTuDong, BAN_MAY, type DatMay } from '../../../src/lib/xuong-video/bo-set-3d';
import type { May3d } from '../../../src/lib/xuong-video/kieu';

type Khai = DatMay & Partial<May3d> & Record<string, unknown>;
export function mayShot(may: Khai, kt: Record<string, string | undefined>, khoi: (ten: string) => { co: number[] } | null, cu?: (May3d & { tu_dong?: { vao?: string } }) | null): May3d {
  if (may.dat) return may as unknown as May3d;   // khai tay đủ máy → giữ nguyên
  const viTriMay = may.vi_tri.map(({ dien: _d, ...v }) => v);
  const vao = JSON.stringify([BAN_MAY, { ...may, vi_tri: viTriMay }, kt.co_canh, kt.goc, kt.ong_kinh, may.vi_tri.map((v) => khoi(v.ten))]);
  if (cu?.tu_dong?.vao === vao) return { ...cu, vi_tri: may.vi_tri };
  const t = datMayTuDong(may, kt, khoi);
  const { phia: _p, ...khai } = may;
  return { ...(khai as object), ...t, tu_dong: { ...t.tu_dong, vao } } as May3d;
}
