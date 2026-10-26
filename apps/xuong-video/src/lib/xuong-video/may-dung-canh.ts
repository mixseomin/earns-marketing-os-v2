// MẪU MÁY DỰNG "Cảnh động thả hồn" (dạng canh-dong trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 26/10/2026; ví dụ anh gửi:
// reel 8 giây hiên nhà mưa, không chữ, chỉ cảnh + tiếng mưa). MẪU CHUNG cho mọi ngách: đề = từ khoá cảnh (từ góc) + một câu móc nhỏ + loại tiếng nền.
// THUẦN: đề → ASS + lệnh ffmpeg. Nền = VIDEO THẬT Pexels (anh-nen.ts › timVideoNen, mẫu khai nenVideo), tiếng nền sinh bằng ffmpeg (anoisesrc), 0đ.
// Không màn kết nặng: câu móc hiện nhỏ ở đáy sau 1,2s; dòng kết (nếu có) nằm 3 giây cuối — cảnh là nhân vật chính, chữ chỉ là lời thì thầm.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-canh.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export type AmCanh = 'mua' | 'gio' | 'song' | 'pho' | 'lua' | 'im';
export interface DeCanh {
  truy: string;            // từ khoá tìm VIDEO nền Pexels (tiếng Anh, theo góc: "rain porch night", "kyoto station morning")
  moc?: string;            // câu móc của góc — một dòng nhỏ ở đáy (≤ 60 ký tự; dài hơn thì ngắt 2 dòng)
  am?: AmCanh;             // tiếng nền sinh ffmpeg; mặc định theo từ khoá (mưa / gió / sóng / phố / lửa), 'im' = không tiếng
  dai?: number;            // giây cảnh (6–15, mặc định 10)
  ket?: string[];          // 1–2 dòng kết nhỏ (tên nơi, "Save this for your trip"…) — tuỳ chọn
}
export const FPS = 30, DAI_MIN = 6, DAI_MAX = 15, T_MOC = 1.2;
const W = 1080, H = 1920, TRANG = '#F4F6F8';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Tiếng nền theo từ khoá khi đề không khai. */
export function amTheoTruy(truy: string): AmCanh {
  const t = truy.toLowerCase();
  if (/rain|storm|drizzle|monsoon/.test(t)) return 'mua';
  if (/wave|sea|ocean|beach|shore|island|lake/.test(t)) return 'song';
  if (/fire|campfire|fireplace|candle/.test(t)) return 'lua';
  if (/street|city|market|station|airport|cafe|traffic|train/.test(t)) return 'pho';
  if (/wind|mountain|field|desert|snow|forest|meadow/.test(t)) return 'gio';
  return 'gio';
}
/** Mốc theo đề: cảnh DAI giây; có dòng kết thì kéo thêm đủ thời gian đọc (luật đọc may-dung-ass › giayDoc). */
export function nhipCanh(de: DeCanh) {
  const CANH = Math.min(DAI_MAX, Math.max(DAI_MIN, de.dai ?? 10));
  const ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2);
  const T_KET = ket.length ? CANH : CANH, DAI = ket.length ? CANH + Math.max(2.5, giayDoc(...ket) - 1) : CANH;
  return { CANH, T_KET, DAI, ket };
}
/** Ảnh tĩnh cho bài ảnh (fb_anh / x_anh): một khung giữa cảnh, cắt 3:4 phần giữa. */
export const anhCanh = (de: DeCanh): { t: number; cat: [number, number, number, number] }[] => [{ t: nhipCanh(de).CANH * 0.5, cat: [0, 240, 1080, 1440] }];

export function assCanh(de: DeCanh): string {
  const { CANH, DAI, ket } = nhipCanh(de), d: DongAss[] = [];
  // dải tối mỏng ở đáy cho chữ đọc được trên cảnh sáng (không phủ cả khung — cảnh phải nhìn rõ, luật ảnh thật 18/10/2026)
  if (de.moc?.trim()) {
    const dong = ngat(de.moc.trim(), 30).slice(0, 2);
    d.push([1, T_MOC, CANH, 'Ve', `{\\an2\\pos(540,1700)\\1c&H000000&\\1a${alpha(0.42)}\\fad(400,400)\\p1}${bo(1000, 70 + 64 * dong.length, 24)}`]);
    d.push([2, T_MOC, CANH, 'Chu', `{\\an2\\pos(540,${1700 - 35})\\b1${fs(42)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\q2\\fad(400,400)}${dong.map(chu).join('\\N')}`]);
  }
  if (ket.length) {
    d.push([3, CANH, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.45)}\\fad(500,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([4, CANH, DAI, 'Den', `{\\an5\\pos(540,900)${fs(64)}\\1c&HFFFFFF&\\q2\\fad(500,0)}${chu(ket[0]!)}`]);
    if (ket[1]) d.push([4, CANH, DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\1a&H30&\\fad(500,0)}${chu(ket[1])}`]);
  }
  return rapAss(W, H, d);
}

/** Tiếng nền: nhiễu màu lọc + rung chậm — mưa (trắng, lọc dải, rung 6Hz), gió (nâu, rung 0,25Hz), sóng (nâu, rung 0,12Hz), phố (hồng, êm), lửa (nâu, lách tách 9Hz). */
export function amCanh(am: AmCanh, dai: number): string {
  const f = { mua: 'anoisesrc=color=white:r=44100:a=0.30,highpass=f=500,lowpass=f=6500,tremolo=f=6:d=0.2', gio: 'anoisesrc=color=brown:r=44100:a=0.55,lowpass=f=700,tremolo=f=0.25:d=0.6',
    song: 'anoisesrc=color=brown:r=44100:a=0.5,lowpass=f=1000,tremolo=f=0.12:d=0.85', pho: 'anoisesrc=color=pink:r=44100:a=0.22,lowpass=f=3200,highpass=f=120',
    lua: 'anoisesrc=color=brown:r=44100:a=0.45,lowpass=f=1800,tremolo=f=9:d=0.5', im: 'anullsrc=r=44100:cl=mono' }[am];
  return `${f},atrim=0:${dai.toFixed(2)},afade=t=in:d=1,afade=t=out:st=${Math.max(0, dai - 1.2).toFixed(2)}:d=1.2`;
}

/** Lệnh ffmpeg: VIDEO nền thật (nen, mp4 Pexels) lặp cho đủ dài, phủ kín 1080×1920, tối nhẹ → ass → H.264 + AAC. Không có video nền thì DỪNG. `khung` = một khung JPG. */
export function lenhCanh(o: { de: DeCanh; ass: string; nen?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const { DAI } = nhipCanh(o.de), dai = Number(DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu canh-dong cần VIDEO nền thật (nen_url Pexels video) — anh-nen.ts › timVideoNen');
  const nen = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},eq=brightness=-0.03:saturation=1.05,trim=0:${dai},setpts=PTS-STARTPTS`;
  const loc = `${nen},ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', o.nen, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  return ['-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', o.nen, '-f', 'lavfi', '-i', amCanh(o.de.am ?? amTheoTruy(o.de.truy), dai),
    '-filter_complex', loc, '-map', '[v]', '-map', '1:a', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}

/** Kịch bản shot (tab Mẫu / ngăn video). */
export function kichBanCanh(de: DeCanh) {
  const { CANH, DAI, ket } = nhipCanh(de), am = de.am ?? amTheoTruy(de.truy);
  const shots = [{ tu: 0, den: CANH, canh: 'Cảnh thật + câu móc', hanh_dong: `Video thật "${de.truy}" chạy liền ${CANH}s, tiếng ${am}; ${de.moc ? `câu móc "${de.moc}" hiện nhỏ ở đáy từ ${T_MOC}s` : 'không chữ'}.` }];
  if (ket.length) shots.push({ tu: CANH, den: DAI, canh: 'Dòng kết', hanh_dong: `Phủ tối nhẹ, ${ket.join(' / ')}.` });
  return { tom_tat: `Cảnh động thả hồn · ${de.truy}`, shots };
}
/** Truy vấn video nền = chính từ khoá đề. */
export const truyVanCanh = (de: DeCanh) => de.truy;
