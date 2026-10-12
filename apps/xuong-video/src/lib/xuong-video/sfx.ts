// Tiếng hiệu ứng THẬT (12/10/2026): key nhóm "Âm thanh" của shot (ky_thuat.am_thanh, dien-anh.ts) có tệp trong public/sfx/<key>.mp3
// (dựng bằng scripts/dung-sfx.mjs) thì bản xuất trộn tệp đó vào đúng giờ, timeline xem trước phát cùng lịch. Key không có tệp (âm phố,
// tiếng động cận…) vẫn chỉ là chữ gửi model video như cũ. Thuần — MỘT lịch cho bản xuất (xuat.ts) và xem trước (timeline.tsx).
//   neo 'dau'  = vào đầu shot (điểm cắt), lech âm = bắt đầu trước điểm cắt (tiếng vút đạt đỉnh ngay lúc cắt)
//   neo 'cuoi' = kết thúc đúng cuối shot (tiếng dâng dồn tới điểm cắt sau)
//   neo 'ca'   = lặp suốt shot (mưa, nhịp tim)
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/sfx.test.mts
export type NeoSfx = 'dau' | 'cuoi' | 'ca';
export type Sfx = { dai: number; neo: NeoSfx; lech: number; db: number };
/** db = mức trộn so với tệp (tệp chuẩn đỉnh ~ -1 dB) — dưới giọng đọc, trên nhạc nền ở đúng khoảnh khắc. */
export const SFX: Record<string, Sfx> = {
  dap: { dai: 1.6, neo: 'dau', lech: 0, db: -6 },
  vut: { dai: 0.7, neo: 'dau', lech: -0.42, db: -8 },
  cuon_len: { dai: 2.2, neo: 'cuoi', lech: 0, db: -12 },
  dap_doa: { dai: 1.6, neo: 'dau', lech: 0, db: -9 },
  tim_dap: { dai: 3.4, neo: 'ca', lech: 0, db: -10 },
  mua: { dai: 6, neo: 'ca', lech: 0, db: -18 },
  vo_kinh: { dai: 1.2, neo: 'dau', lech: 0, db: -9 },
  chop_dien: { dai: 0.8, neo: 'dau', lech: 0, db: -10 },
  sam: { dai: 3.2, neo: 'dau', lech: 0, db: -7 },
};
export const coSfx = (key: string) => key in SFX;
export const urlSfx = (key: string) => `/sfx/${key}.mp3`;

/** tu = giây bắt đầu trong phim · bo = giây bỏ ở đầu tệp · dai = giây phát. */
export type MucSfx = { key: string; tu: number; bo: number; dai: number; lap: boolean; db: number };
/** Lịch tiếng hiệu ứng cả tập: mỗi shot { am: key âm thanh, tu: giây bắt đầu trong phim, phat: giây phát }. */
export function lichSfx(ds: { am?: string[]; tu: number; phat: number }[]): MucSfx[] {
  const out: MucSfx[] = [];
  for (const s of ds) for (const key of s.am ?? []) {
    const x = SFX[key]; if (!x) continue;
    if (x.neo === 'ca') { out.push({ key, tu: s.tu, bo: 0, dai: s.phat, lap: true, db: x.db }); continue; }
    const tu = x.neo === 'cuoi' ? s.tu + s.phat - x.dai : s.tu + x.lech;
    const bo = Math.max(0, -tu);   // tiếng vút ở shot đầu không có chỗ "trước điểm cắt" → cắt phần đầu
    out.push({ key, tu: Math.round(Math.max(0, tu) * 1000) / 1000, bo: Math.round(bo * 1000) / 1000, dai: Math.round((x.dai - bo) * 1000) / 1000, lap: false, db: x.db });
  }
  return out.sort((a, b) => a.tu - b.tu);
}
