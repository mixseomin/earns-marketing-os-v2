// ĐƯỜNG MÁY của một shot (anh 16/10/2026: làm phim hoàn toàn bằng Blender — bước 1 "chuyển động máy"). Máy lúc MỞ = may_3d (dat / nhin / ống kính);
// máy lúc KẾT tính từ mã chuyển động của shot (ky_thuat.chuyen_dong) theo SỐ NGHỀ đã có ở dien-anh-nganh.ts › may_di (đẩy vào: chủ thể ×1,6 ·
// lùi ra ×0,5 · lia 30° · quay vòng 60° · zoom gắt ×2,5…) — một nguồn số cho cả thư viện kỹ thuật lẫn bản diễn Blender. Toạ độ dữ liệu: cm,
// x phải, y sâu vào bàn, z lên. Blender (dung-set.py › dien_shot) nội suy mở → kết theo `toc`, cộng rung tay khi `rung`.
import { NGANH, type MayDi } from './dien-anh-nganh';
import type { May3d } from './kieu';

export type DuongMay = { kieu: MayDi['kieu']; dat: number[]; nhin: number[]; ong_kinh: number; toc: MayDi['toc']; rung?: boolean };

type V3 = [number, number, number];
const v = (p: number[]): V3 => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
const cong = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const tru = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nhan = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dai = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const tron = (a: V3): number[] => a.map((x) => Math.round(x * 100) / 100);
/** Xoay quanh trục đứng z (độ, dương = ngược chiều kim đồng hồ nhìn từ trên). */
const xoayZ = (a: V3, g: number): V3 => { const r = (g * Math.PI) / 180; return [a[0] * Math.cos(r) - a[1] * Math.sin(r), a[0] * Math.sin(r) + a[1] * Math.cos(r), a[2]]; };

/** Máy lúc kết của shot; null = máy đứng yên (không có mã, mã tĩnh, hoặc kiểu bay tự do chưa dựng được — FPV / hyperlapse). */
export function duongMay(m: Pick<May3d, 'dat' | 'nhin' | 'ong_kinh' | 'vi_tri' | 'khung' | 'nham'>, chuyenDong: string | undefined | null): DuongMay | null {
  const md = chuyenDong ? NGANH[`chuyen_dong.${chuyenDong}`]?.may_di : undefined;
  if (!md) return null;
  const rung = chuyenDong === 'cam_tay';
  if (md.kieu === 'dung' || md.kieu === 'tu_do') return rung ? { kieu: md.kieu, dat: m.dat, nhin: m.nhin, ong_kinh: m.ong_kinh, toc: md.toc, rung } : null;
  const dat = v(m.dat), nhin = v(m.nhin); const D = tru(dat, nhin); const kc = dai(D) || 1;
  // Chủ thể đầu tiên (khung / hai vị trí đầu không ẩn) và quãng nó đi trong shot — máy theo / trượt / lia bám theo nó.
  const ten = m.nham ?? m.khung?.[0] ?? m.vi_tri.find((x) => !x.an)?.ten;
  const ct = m.vi_tri.find((x) => x.ten === ten);
  const di: V3 = ct?.den ? tru(v(ct.den), v(ct.tam)) : [0, 0, 0];
  // Trục ngang của khung (phải màn hình) = hướng nhìn × trục đứng.
  const huong = nhan(tru(nhin, dat), 1 / kc); const phai = ((): V3 => { const p: V3 = [huong[1], -huong[0], 0]; const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l, 0]; })();
  const ngangDi = di[0] * phai[0] + di[1] * phai[1];
  const chieu = ngangDi < 0 ? -1 : 1;   // lia / trượt / vòng về phía chủ thể đi; đứng yên thì sang phải
  let datK = dat, nhinK = nhin, ok = m.ong_kinh;
  switch (md.kieu) {
    case 'tien': case 'lui': datK = cong(nhin, nhan(D, 1 / (md.ti_le ?? (md.kieu === 'tien' ? 1.6 : 0.5)))); break;   // chủ thể ×ti_le ⇔ khoảng cách ÷ti_le
    case 'len': case 'xuong': { const k = 1 / (md.ti_le ?? 1); datK = cong(dat, [0, 0, kc * (k - 1)]); break; }   // cẩu: nâng (ti_le < 1) / hạ (> 1) máy, giữ điểm nhìn
    case 'zoom': {   // zoom VÀO chủ thể: ống kính dài ra + đầu máy quay về chỗ chủ thể (lúc kết), không zoom vào điểm nhìn giữa khung
      ok = m.ong_kinh * (md.ti_le ?? 1.4);
      if (ct) { const p = v(ct.den ?? ct.tam); nhinK = [p[0], p[1], Math.max(nhin[2], p[2] + 1)]; }
      break;
    }
    case 'lia': nhinK = cong(dat, xoayZ(tru(nhin, dat), -chieu * (md.goc ?? 30))); break;   // lia: máy đứng, đầu máy xoay
    case 'nghieng': nhinK = cong(nhin, [0, 0, Math.tan(((md.goc ?? 25) * Math.PI) / 180) * kc]); break;   // nghiêng lên
    case 'vong': datK = cong(nhin, xoayZ(D, chieu * (md.goc ?? 60))); break;   // quay vòng quanh điểm nhìn
    case 'ngang': { const s = Math.abs(ngangDi) > 0.3 ? ngangDi : 0.2 * kc; const dv = nhan(phai, s); datK = cong(dat, dv); nhinK = cong(nhin, dv); break; }   // trượt cùng chủ thể
    case 'theo': datK = cong(dat, di); nhinK = cong(nhin, di); break;   // bám theo: máy dời đúng quãng chủ thể đi
  }
  return { kieu: md.kieu, dat: tron(datK), nhin: tron(nhinK), ong_kinh: Math.round(ok * 10) / 10, toc: md.toc, ...(rung ? { rung } : {}) };
}
