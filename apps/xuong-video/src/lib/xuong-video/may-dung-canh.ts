// MẪU MÁY DỰNG "Cảnh động thả hồn" (dạng canh-dong trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 26/10/2026; ví dụ anh gửi:
// reel 8 giây hiên nhà mưa, không chữ, chỉ cảnh + tiếng mưa). MẪU CHUNG cho mọi ngách: đề = từ khoá cảnh (từ góc) + một câu móc nhỏ + loại tiếng nền.
// THUẦN: đề → ASS + lệnh ffmpeg. Nền = VIDEO THẬT Pexels có chuyển động (mẫu khai nenVideo), tiếng = bản thu thật Mixkit (am-nen.json), 0đ.
// Không màn kết nặng: câu móc hiện nhỏ ở đáy sau 1,2s; dòng kết (nếu có) nằm 3 giây cuối — cảnh là nhân vật chính, chữ chỉ là lời thì thầm.
// Nền video PHẢI có chuyển động thật (may-dung.ts › timVideoNenDong đo độ lệch khung, bỏ clip tĩnh) và tiếng PHẢI là bản thu thật (am-nen.ts) — 26/10/2026 anh chê
// bản đầu "có mỗi cái ảnh kèm tiếng ồn": clip Pexels đứng yên + nhiễu tổng hợp.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-canh.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

import { amTheoTruy, type LoaiAm } from './am-nen';
export { amTheoTruy };
export type AmCanh = LoaiAm;
export interface DeCanh {
  truy: string;            // từ khoá tìm VIDEO nền Pexels (tiếng Anh, theo góc: "rain porch night", "kyoto station morning")
  moc?: string;            // câu móc của góc — chữ nhỏ ở đáy, ngắt tối đa 3 dòng × 36 ký tự (dài hơn thì thu cỡ chữ, không bao giờ cắt chữ)
  am?: AmCanh;             // loại tiếng nền THU THẬT (am-nen.json: mưa / sóng / gió / rừng / đêm / phố / lửa); mặc định theo từ khoá; 'im' = không tiếng
  dai?: number;            // giây cảnh (6–15, mặc định 10)
  ket?: string[];          // 1–2 dòng kết nhỏ (tên nơi, "Save this for your trip"…) — tuỳ chọn
}
export const FPS = 30, DAI_MIN = 6, DAI_MAX = 15, T_MOC = 1.2;
const W = 1080, H = 1920, TRANG = '#F4F6F8';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Mốc theo đề: cảnh DAI giây; có dòng kết thì kéo thêm đủ thời gian đọc (luật đọc may-dung-ass › giayDoc). */
export function nhipCanh(de: DeCanh) {
  const CANH = Math.min(DAI_MAX, Math.max(DAI_MIN, de.dai ?? 10));
  const ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2);
  const T_KET = ket.length ? CANH : CANH, DAI = ket.length ? CANH + Math.max(2.5, giayDoc(...ket) - 1) : CANH;
  return { CANH, T_KET, DAI, ket };
}
/** Ảnh tĩnh cho bài ảnh (fb_anh / x_anh): một khung giữa cảnh, cắt 3:4 phần giữa. */
export const anhCanh = (de: DeCanh): { t: number; cat: [number, number, number, number] }[] => [{ t: nhipCanh(de).CANH * 0.5, cat: [0, 240, 1080, 1440] }];

/** Câu móc lên khung ĐỦ CHỮ: ngắt 36 ký tự / dòng, tối đa 3 dòng; dài hơn 3 dòng thì ngắt rộng hơn và thu cỡ chữ theo tỉ lệ (26/10/2026: bản đầu cắt còn 2 dòng, mất đuôi câu). */
export function dongMoc(moc: string): { dong: string[]; co: number } {
  const t = moc.trim();
  for (const [rong, co] of [[36, 42], [44, 36], [54, 30], [70, 24]] as const) { const dong = ngat(t, rong); if (dong.length <= 3) return { dong, co }; }
  return { dong: ngat(t, 70).slice(0, 3), co: 24 };
}
export function assCanh(de: DeCanh): string {
  const { CANH, DAI, ket } = nhipCanh(de), d: DongAss[] = [];
  // dải tối mỏng ở đáy cho chữ đọc được trên cảnh sáng (không phủ cả khung — cảnh phải nhìn rõ, luật ảnh thật 18/10/2026)
  if (de.moc?.trim()) {
    const { dong, co } = dongMoc(de.moc);
    d.push([1, T_MOC, CANH, 'Ve', `{\\an2\\pos(540,1700)\\1c&H000000&\\1a${alpha(0.42)}\\fad(400,400)\\p1}${bo(1000, 70 + Math.round(co * 1.55) * dong.length, 24)}`]);
    d.push([2, T_MOC, CANH, 'Chu', `{\\an2\\pos(540,${1700 - 35})\\b1${fs(co)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\q2\\fad(400,400)}${dong.map(chu).join('\\N')}`]);
  }
  if (ket.length) {
    d.push([3, CANH, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.45)}\\fad(500,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([4, CANH, DAI, 'Den', `{\\an5\\pos(540,900)${fs(64)}\\1c&HFFFFFF&\\q2\\fad(500,0)}${chu(ket[0]!)}`]);
    if (ket[1]) d.push([4, CANH, DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\1a&H30&\\fad(500,0)}${chu(ket[1])}`]);
  }
  return rapAss(W, H, d);
}

/** Dải tiếng: tệp thu thật `am` lặp cho đủ dài, vào/ra êm; không có tệp (am 'im') → im lặng. KHÔNG tổng hợp nhiễu (26/10/2026). */
export const locAm = (dai: number) => `[1:a]atrim=0:${dai.toFixed(2)},asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=1,afade=t=out:st=${Math.max(0, dai - 1.5).toFixed(2)}:d=1.5[a]`;   // loudnorm: bản thu Mixkit to nhỏ khác nhau (đo 26/10: −33 vs −23 dB) → đưa về cùng mức
/** Lệnh ffmpeg: VIDEO nền thật (nen, mp4 Pexels) lặp cho đủ dài, phủ kín 1080×1920, tối nhẹ → ass → H.264 + AAC. Không có video nền thì DỪNG. `khung` = một khung JPG. */
export function lenhCanh(o: { de: DeCanh; ass: string; nen?: string | null; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const { DAI } = nhipCanh(o.de), dai = Number(DAI.toFixed(2)), imLang = (o.de.am ?? amTheoTruy(o.de.truy)) === 'im';
  if (!o.nen) throw new Error('mẫu canh-dong cần VIDEO nền thật (nen_url Pexels video) — anh-nen.ts › timVideoNen');
  if (!o.am && !imLang) throw new Error('mẫu canh-dong cần TỆP TIẾNG NỀN thu thật (am-nen.ts › chonAm) — không tổng hợp nhiễu');
  const nen = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},eq=brightness=-0.03:saturation=1.05,trim=0:${dai},setpts=PTS-STARTPTS`;
  const loc = `${nen},ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', o.nen, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const vaoAm = imLang ? ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`] : ['-stream_loop', '-1', '-i', o.am!];
  return ['-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', o.nen, ...vaoAm,
    '-filter_complex', `${loc};${locAm(dai)}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}

/** Kịch bản shot (tab Mẫu / ngăn video). */
export function kichBanCanh(de: DeCanh) {
  const { CANH, DAI, ket } = nhipCanh(de), am = de.am ?? amTheoTruy(de.truy);
  const shots = [{ tu: 0, den: CANH, canh: 'Cảnh thật + câu móc', hanh_dong: `Video thật "${de.truy}" chạy liền ${CANH}s, tiếng thu thật (${am}); ${de.moc ? `câu móc "${de.moc}" hiện nhỏ ở đáy từ ${T_MOC}s` : 'không chữ'}.` }];
  if (ket.length) shots.push({ tu: CANH, den: DAI, canh: 'Dòng kết', hanh_dong: `Phủ tối nhẹ, ${ket.join(' / ')}.` });
  return { tom_tat: `Cảnh động thả hồn · ${de.truy}`, shots };
}
/** Truy vấn video nền = chính từ khoá đề. */
export const truyVanCanh = (de: DeCanh) => de.truy;
