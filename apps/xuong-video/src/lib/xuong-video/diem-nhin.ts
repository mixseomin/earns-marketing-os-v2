// ĐIỂM NHÌN QUA CÚ CẮT (eye trace — Murch: mắt khán giả đang ở đâu trên màn lúc cắt thì chủ thể shot sau phải hiện ở gần đó; anh 25/10/2026 phim #353:
// "tao cần sự liền mạch về hướng chú ý của khán giả"). Đo trên KHUNG THẬT của đoạn clip đã dùng (cuối shot trước ↔ đầu shot sau, scripts/diem-nhin.mts),
// lệch quá ngưỡng thì DỰNG LẠI KHUNG trong bản dựng (phóng + dịch, xuat.ts › khung_lai) — cách phòng dựng làm khi không quay lại được (reframe in post),
// 0đ, không sinh lại clip. Thuần, có tự kiểm: diem-nhin.test.mts.

/** Toạ độ trên khung, 0…1 (trái→phải, trên→dưới). */
export type Diem = { x: number; y: number };
/** ĐIỂM NEO MẮT của phim ngắn dọc (đo 14 phim AI ReelShort + Trung Quốc, 811 điểm mặt, 26/10/2026 — tham-khao/reelshort.md): mắt chủ thể ở giữa
 *  ngang, trên đường 1/3 trên. Mọi shot cận / trung cận đặt mắt ở đây thì cắt kiểu gì mắt khán giả cũng rơi đúng chỗ cũ. Dùng ở: câu khung của phiếu
 *  shot (phieu-shot.ts), đích khung dựng lại (khungCanh › neo), sơ đồ shot (so-do-shot.ts). */
export const NEO_MAT: Diem = { x: 0.5, y: 0.31 };
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
/** Hộp phải GIỮ trọn trong khung dựng lại (người trong khung — mặt nới ra vai / tóc), 0…1. */
export type Hop = { x0: number; y0: number; x1: number; y1: number };
const chua = (k: KhungLai, h: Hop) => { const r = 0.5 / k.s; return h.x0 >= k.cx - r - 1e-6 && h.x1 <= k.cx + r + 1e-6 && h.y0 >= k.cy - r - 1e-6 && h.y1 <= k.cy + r + 1e-6; };
export function khungDuaVe(a: Diem, muc: Diem, o: { nguong?: number; sMax?: number; giu?: readonly Hop[] } = {}): { k: KhungLai; lech: number } {
  const nguong = o.nguong ?? NGUONG_LECH, sMax = o.sMax ?? PHONG_TOI_DA;
  let tot: { k: KhungLai; lech: number } | null = null;
  for (let s = 1; s <= sMax + 1e-9; s = +(s + 0.05).toFixed(2)) {
    const h = 0.5 / s;
    const k = { s, cx: +kep(a.x - (muc.x - 0.5) / s, h, 1 - h).toFixed(3), cy: +kep(a.y - (muc.y - 0.5) / s, h, 1 - h).toFixed(3) };
    // KHÔNG cắt người ra khỏi khung (phim #353 #11: phóng 1,35 để dời mặt Thần, cắt mất Vivian đang cầm thẻ) — khung nào cắt vào ai thì bỏ
    if (s > 1 && (o.giu ?? []).some((h) => !chua(k, h))) continue;
    const l = lech(lenMan(a, k), muc);
    if (!tot || l < tot.lech - 1e-6) tot = { k, lech: l };
    if (l <= nguong) return { k, lech: +l.toFixed(3) };
  }
  return tot ? { k: tot.k, lech: +tot.lech.toFixed(3) } : { k: { s: 1, cx: 0.5, cy: 0.5 }, lech: +lech(a, muc).toFixed(3) };
}

/** tat = người dựng tắt khung dựng lại ở shot này (giữ khung gốc) — vẫn đo lệch để hiện trên timeline. */
/** giu = hộp mọi người đo được trong khung mở / đóng (không được cắt ra). khoa = có người sơ đồ nói phải trong khung mà KHÔNG đo được chỗ (quay lưng, mặt nhỏ)
 *  → không dám phóng (giữ khung gốc) vì không biết phóng có cắt mất họ không. */
export type DiemShot = { thu_tu: number; dau: Diem | null; cuoi: Diem | null; tat?: boolean; giu?: Hop[]; khoa?: boolean };
export type KetKhung = { thu_tu: number; k: KhungLai; lech_truoc: number | null; lech_goc: number | null };
/** Đi xuôi cả cảnh: shot đầu giữ nguyên; mỗi shot sau dựng lại khung để chủ thể mở shot nằm chỗ mắt vừa rời shot trước (đã tính khung dựng lại của nó).
 *  Lệch gốc ≤ ngưỡng → giữ nguyên (không phóng vô cớ). Không đo được chủ thể (cận đồ vật, không thấy mặt) → giữ nguyên, mắt đặt lại theo điểm cuối của shot. */
export function khungCanh(ds: readonly DiemShot[], o: { nguong?: number; sMax?: number; /** ĐIỂM NEO cố định (phim ngắn dọc: NEO_MAT) — mọi shot kéo chủ thể về đây
   *  thay vì về chỗ mắt rời shot trước: liền mạch bằng quy ước khung, không trôi dần theo chuỗi; lech_truoc vẫn đo so shot trước để hiện timeline. */ neo?: Diem } = {}): KetKhung[] {
  const nguong = o.nguong ?? NGUONG_LECH; const GIU: KhungLai = { s: 1, cx: 0.5, cy: 0.5 };
  const kq: KetKhung[] = []; let mat: Diem | null = null;
  for (const d of ds) {
    let k = GIU; const muc = o.neo ?? mat; const lg = mat && d.dau ? +lech(d.dau, mat).toFixed(3) : null;
    if (muc && d.dau && lech(d.dau, muc) > nguong && !d.tat && !d.khoa) k = khungDuaVe(d.dau, muc, { ...o, giu: d.giu }).k;
    const lt = mat && d.dau ? +lech(lenMan(d.dau, k), mat).toFixed(3) : null;
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
