// ĐIỂM NHÌN QUA CÚ CẮT (eye trace — Murch: mắt khán giả đang ở đâu trên màn lúc cắt thì chủ thể shot sau phải hiện ở gần đó; anh 25/10/2026 phim #353:
// "tao cần sự liền mạch về hướng chú ý của khán giả"). Đo trên KHUNG THẬT của đoạn clip đã dùng (cuối shot trước ↔ đầu shot sau, scripts/diem-nhin.mts),
// lệch quá ngưỡng thì DỰNG LẠI KHUNG trong bản dựng (phóng + dịch, xuat.ts › khung_lai) — cách phòng dựng làm khi không quay lại được (reframe in post),
// 0đ, không sinh lại clip. Thuần, có tự kiểm: diem-nhin.test.mts.

/** Toạ độ trên khung, 0…1 (trái→phải, trên→dưới). */
export type Diem = { x: number; y: number };
/** Khung dựng lại của một shot: phóng s (≥1) quanh tâm cửa sổ (cx, cy) trên khung gốc. s = 1 = giữ nguyên. */
export type KhungLai = { s: number; cx: number; cy: number };
/** Lệch tối đa (theo phần khung) mà mắt chấp nhận không phải "tìm" — Murch / thực hành phòng dựng: chủ thể mới trong ~1/8 khung quanh chỗ mắt đang nhìn. */
export const NGUONG_LECH = 0.12;
/** Phóng tối đa: clip 720p phóng quá ~1,35 lần thì vỡ nét thấy rõ trên điện thoại. */
export const PHONG_TOI_DA = 1.35;

const kep = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Điểm gốc p hiện ở đâu trên màn sau khung dựng lại k. */
export const lenMan = (p: Diem, k: KhungLai): Diem => ({ x: (p.x - k.cx) * k.s + 0.5, y: (p.y - k.cy) * k.s + 0.5 });
const lech = (a: Diem, b: Diem) => Math.hypot(a.x - b.x, a.y - b.y);

/** Khung dựng lại để điểm gốc `a` hiện ngay ở `muc` trên màn, với phóng nhỏ nhất đủ đạt ngưỡng (cửa sổ luôn nằm trong khung gốc). */
export function khungDuaVe(a: Diem, muc: Diem, o: { nguong?: number; sMax?: number } = {}): { k: KhungLai; lech: number } {
  const nguong = o.nguong ?? NGUONG_LECH, sMax = o.sMax ?? PHONG_TOI_DA;
  let tot: { k: KhungLai; lech: number } | null = null;
  for (let s = 1; s <= sMax + 1e-9; s = +(s + 0.05).toFixed(2)) {
    const h = 0.5 / s;
    const k = { s, cx: +kep(a.x - (muc.x - 0.5) / s, h, 1 - h).toFixed(3), cy: +kep(a.y - (muc.y - 0.5) / s, h, 1 - h).toFixed(3) };
    const l = lech(lenMan(a, k), muc);
    if (!tot || l < tot.lech - 1e-6) tot = { k, lech: l };
    if (l <= nguong) return { k, lech: +l.toFixed(3) };
  }
  return { k: tot!.k, lech: +tot!.lech.toFixed(3) };
}

export type DiemShot = { thu_tu: number; dau: Diem | null; cuoi: Diem | null };
export type KetKhung = { thu_tu: number; k: KhungLai; lech_truoc: number | null; lech_goc: number | null };
/** Đi xuôi cả cảnh: shot đầu giữ nguyên; mỗi shot sau dựng lại khung để chủ thể mở shot nằm chỗ mắt vừa rời shot trước (đã tính khung dựng lại của nó).
 *  Lệch gốc ≤ ngưỡng → giữ nguyên (không phóng vô cớ). Không đo được chủ thể (cận đồ vật, không thấy mặt) → giữ nguyên, mắt đặt lại theo điểm cuối của shot. */
export function khungCanh(ds: readonly DiemShot[], o: { nguong?: number; sMax?: number } = {}): KetKhung[] {
  const nguong = o.nguong ?? NGUONG_LECH; const GIU: KhungLai = { s: 1, cx: 0.5, cy: 0.5 };
  const kq: KetKhung[] = []; let mat: Diem | null = null;
  for (const d of ds) {
    let k = GIU; let lt: number | null = null; const lg = mat && d.dau ? +lech(d.dau, mat).toFixed(3) : null;
    if (mat && d.dau && lg! > nguong) { const r = khungDuaVe(d.dau, mat, o); k = r.k; lt = r.lech; } else if (lg != null) lt = lg;
    kq.push({ thu_tu: d.thu_tu, k, lech_truoc: lt, lech_goc: lg });
    const cuoi = d.cuoi ?? d.dau; mat = cuoi ? lenMan(cuoi, k) : null;
  }
  return kq;
}

/** Bộ lọc ffmpeg cắt cửa sổ của khung dựng lại (đặt TRƯỚC scale/crop về khổ ra). s ≈ 1 → rỗng. */
export function locKhungLai(k: KhungLai | null | undefined): string {
  if (!k || !(k.s > 1.001)) return '';
  const w = 1 / k.s; const fx = (k.cx - w / 2) / (1 - w), fy = (k.cy - w / 2) / (1 - w);
  return `crop=iw*${w.toFixed(4)}:ih*${w.toFixed(4)}:(iw-iw*${w.toFixed(4)})*${kep(fx, 0, 1).toFixed(4)}:(ih-ih*${w.toFixed(4)})*${kep(fy, 0, 1).toFixed(4)},`;
}
