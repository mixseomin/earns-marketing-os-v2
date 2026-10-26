// MẪU MÁY DỰNG "Đố chữ · Only ONE is spelled right" (Front Porch Puzzles, chuyển từ puzzle-books/scripts/shorts.mjs --kieu an, 16/10/2026).
// THUẦN: đề bài → tệp ASS (libass vẽ chữ + hình) + lệnh ffmpeg. Không AI, không trình duyệt (máy chủ cấm chạy trình duyệt — bản cũ
// chụp từng khung bằng Chrome trên iMac). Nhịp + bố cục giữ y bản cũ: tiêu đề + bảng "đập" vào khung 0,5s, thanh thời gian + đồng hồ
// đếm 7 giây (3 giây cuối đỏ, nảy mỗi giây), 7,3s lộ đúng một ô (ô sai mờ đi), 9,1s màn kết rủ comment + link pickjot.
// Nền: ảnh (AI theo chủ đề, may-dung.ts › sinhNenMayDung) phủ màu bìa cho chữ đọc rõ, hoặc dải màu bìa khi chưa có ảnh.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-do-chu.test.mts

export interface MauBia { sau: string; truoc: string; nhan: string }
export interface DeMotDung { dich: string; o: string[]; cho: number; goi: string; mau: MauBia; moc?: string }   // moc: câu móc theo GÓC spy (26/10/2026), hiện giữa bảng và đồng hồ

export const FPS = 30, T_DEM = 0.3, DEM = 7, T_LO = T_DEM + DEM, LO = 0.6, T_KET = T_LO + LO + 1.2, DAI = T_KET + 2.7;
const W = 1080, H = 1920, DO = '#E5484D';
/** Cỡ chữ ASS (\\fs) tính theo chiều cao dòng, cỡ CSS của bản cũ tính theo em → nhân hệ số này để chữ ra cùng cỡ (đo 16/10/2026 trên khung so). */
import { alpha, bo, chu, mauAss, ms, nayVao, nhipDem, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
export { mauAss };

const EM = 1.25;
const fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Trộn hai màu hex theo tỉ lệ t (0 = a, 1 = b) — dải nền sáng/tối từ màu bìa như color-mix của bản cũ. */
export function tron(a: string, b: string, t: number): string {
  const p = (x: string) => [1, 3, 5].map((i) => parseInt(x.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Bố cục ô chữ: 4 cột x 9 hàng cho từ ≤ 6 chữ, 3 x 12 cho từ dài hơn; cỡ chữ theo bề rộng ô (Archivo Black ~0,8 em/chữ) — y bản cũ. */
export function luoi(de: DeMotDung) {
  const cot = de.dich.length > 6 ? 3 : 4, hang = 36 / cot, cw = 960 / cot, ch = 1040 / hang;
  const co = Math.min(64, Math.floor((cw - 24) / (de.dich.length * 0.8)));
  return { cot, hang, cw, ch, co, o: de.o.map((w, i) => ({ w, x: 60 + ((i % cot) + 0.5) * cw, y: 470 + (Math.floor(i / cot) + 0.5) * ch })) };
}

/** Cỡ chữ câu móc: 36 vừa 40 ký tự trên một dòng (bề ngang dải 1000px), dài hơn thì thu theo tỉ lệ. */
export const coMoc = (m: string) => Math.min(36, Math.floor(36 * 40 / Math.max(1, m.length)));

export function assMotDung(de: DeMotDung): string {
  const M = de.mau, L = luoi(de), d: DongAss[] = [];
  // nền chưa có ảnh: vết sáng giữa trên (dải radial lo ở ffmpeg) — có ảnh thì phủ một lớp màu bìa mỏng ở ffmpeg, ở đây không vẽ gì
  // khối tiêu đề
  d.push([5, 0, T_KET, 'Chu', `{\\an5\\pos(540,140)\\fnAtkinson Hyperlegible\\b1${fs(52)}\\1c${mauAss(M.truoc)}\\1a&H14&${nayVao(135)}}Only ONE is spelled`]);
  d.push([5, 0, T_KET, 'Den', `{\\an5\\pos(540,250)${fs(118)}\\fsp2\\1c${mauAss(M.nhan)}\\4c&H000000&\\4a&H90&\\shad7${nayVao(135)}}${chu(de.dich)}`]);
  d.push([5, 0, T_KET, 'Chu', `{\\an5\\pos(540,350)\\fnAtkinson Hyperlegible\\b1${fs(44)}\\1c${mauAss(M.truoc)}${nayVao(135)}}Find it in 7 seconds`]);
  // thanh thời gian: rãnh trắng mờ + vạch màu nhấn co dần từ phải sang trái trong 7 giây đếm
  d.push([2, 0, T_LO, 'Ve', `{\\an7\\pos(60,400)\\1c&HFFFFFF&\\1a${alpha(0.18)}\\p1}${bo(960, 22, 11)}`]);
  d.push([3, 0, T_LO, 'Ve', `{\\an7\\pos(60,400)\\1c${mauAss(M.nhan)}\\clip(60,400,1020,422)\\t(${ms(T_DEM)},${ms(T_LO)},\\clip(60,400,60,422))\\p1}${bo(960, 22, 11)}`]);
  // bảng trắng + bóng, "đập" vào 0,88 → 1
  d.push([1, 0, T_KET, 'Ve', `{\\an5\\pos(540,1008)\\1c&H000000&\\1a${alpha(0.22)}${nayVao(88)}\\p1}${bo(980, 1080, 28)}`]);
  d.push([2, 0, T_KET, 'Ve', `{\\an5\\pos(540,990)\\1c&HFFFFFF&${nayVao(88)}\\p1}${bo(980, 1080, 28)}`]);
  // 36 ô: ô sai mờ còn 25% lúc lộ; ô đúng có khung màu nhấn viền đỏ, chữ phóng 1,25
  for (const [i, c] of L.o.entries()) {
    const dung = i === de.cho;
    const x0 = Math.round(540 + (c.x - 540) * 0.88), y0 = Math.round(990 + (c.y - 990) * 0.88);
    d.push([6, 0, T_KET, 'Den', `{\\an5\\move(${x0},${y0},${Math.round(c.x)},${Math.round(c.y)},0,500)${fs(L.co)}\\fsp1\\1c&H1B1B1B&${nayVao(88)}${dung ? `\\t(${ms(T_LO)},${ms(T_LO + 0.3)},\\fscx125\\fscy125)` : `\\t(${ms(T_LO)},${ms(T_LO + 0.3)},\\1a${alpha(0.25)})`}}${chu(c.w)}`]);
    if (dung) {
      const w = Math.round(L.cw - 12), h = Math.round(L.ch - 8);
      d.push([4, T_LO, T_KET, 'Ve', `{\\an5\\pos(${Math.round(c.x)},${Math.round(c.y)})\\1c${mauAss(DO)}\\fscx80\\fscy80\\t(0,300,0.5,\\fscx125\\fscy125)\\p1}${bo(w, h, 14)}`]);
      d.push([5, T_LO, T_KET, 'Ve', `{\\an5\\pos(${Math.round(c.x)},${Math.round(c.y)})\\1c${mauAss(M.nhan)}\\fscx80\\fscy80\\t(0,300,0.5,\\fscx125\\fscy125)\\p1}${bo(w - 16, h - 16, 10)}`]);
    }
  }
  // câu móc của góc (nếu đề có): một dòng trên dải tối trong khoảng trống giữa đáy bảng (1530) và đỉnh đồng hồ (1600); dài thì thu chữ cho vừa 1 dòng
  if (de.moc?.trim()) {
    const m = de.moc.trim(), co = coMoc(m);
    d.push([3, 0, T_LO, 'Ve', `{\\an5\\pos(540,1566)\\1c&H000000&\\1a${alpha(0.45)}${nayVao(88)}\\p1}${bo(Math.min(1000, Math.round(m.length * co * EM * 0.52) + 60), 58, 29)}`]);
    d.push([4, 0, T_LO, 'Chu', `{\\an5\\pos(540,1566)\\fnAtkinson Hyperlegible\\b1${fs(co)}\\1c${mauAss(M.truoc)}${nayVao(88)}}${chu(m)}`]);
  }
  // đồng hồ đếm 7 → 1 (3 giây cuối nền đỏ chữ trắng), mỗi số nảy 1,12 ở 0,2s cuối giây của nó
  for (let s = DEM; s >= 1; s--) {
    const tu = s === DEM ? 0 : T_LO - s, den = T_LO - s + 1, gap = s <= 3;
    const nayGiay = nhipDem(den - tu);
    d.push([7, tu, den, 'Ve', `{\\an5\\pos(540,1710)\\1c${gap ? mauAss(DO) : mauAss(M.truoc)}\\4c&H000000&\\4a&H40&\\shad0${nayGiay}\\p1}${bo(220, 220, 110)}`]);
    d.push([8, tu, den, 'Den', `{\\an5\\pos(540,1712)${fs(120)}\\1c${gap ? '&HFFFFFF&' : '&H111111&'}${nayGiay}}${s}`]);
  }
  // màn kết
  const fad = '\\fad(300,0)';
  d.push([10, T_KET, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c${mauAss(M.sau)}${fad}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([11, T_KET, DAI, 'Ve', `{\\an5\\pos(540,700)\\1c${mauAss(tron(M.sau, '#ffffff', 0.3))}\\1a${alpha(0.55)}${fad}\\blur40\\p1}${bo(1000, 1000, 500)}`]);
  d.push([12, T_KET, DAI, 'Den', `{\\an5\\pos(540,780)${fs(100)}\\1c${mauAss(M.truoc)}\\q2${fad}}Did you spot\\Nit in time?`]);
  d.push([12, T_KET, DAI, 'Ve', `{\\an5\\pos(540,1000)\\1c${mauAss(M.nhan)}${fad}\\p1}${bo(620, 110, 18)}`]);
  d.push([13, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1000)\\fnAtkinson Hyperlegible\\b1${fs(60)}\\1c&H111111&${fad}}Comment YES or NO`]);
  d.push([12, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1180)\\fnAtkinson Hyperlegible\\b1${fs(52)}\\1c${mauAss(M.truoc)}${fad}}Free large print puzzles to print:`]);
  d.push([12, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1250)\\fnAtkinson Hyperlegible\\b1${fs(54)}\\1c${mauAss(M.nhan)}${fad}}pickjot.com/printables`]);
  return rapAss(W, H, d, { chuDam: true });
}

/** Tiếng: tích mỗi giây lúc đếm, tích dồn 3 giây cuối, "ting" lúc lộ — sinh bằng ffmpeg, không file nhạc (khỏi bản quyền). Y bản cũ (SO_LO = 1). */
export const AM = `0.3*sin(2*PI*660*t)*exp(-9*t)`
  + `+0.25*sin(2*PI*1400*t)*lt(mod(t-${T_DEM},1),0.04)*gte(t,${T_DEM})*lt(t,${T_LO})`
  + `+0.2*sin(2*PI*1700*t)*lt(mod(t-${T_DEM}+0.5,1),0.03)*gte(t,${T_LO - 3})*lt(t,${T_LO})`
  + `+0.35*sin(2*PI*880*t)*exp(-6*(t-${T_LO}))*gte(t,${T_LO})`;

/** Lệnh ffmpeg: nền (ảnh có chuyển động máy chậm + phủ màu bìa, hoặc dải radial màu bìa) → ass → H.264 30 hình/giây + AAC. */
/** Lệnh ffmpeg dựng video. `khung` (giây) = chỉ xuất MỘT khung JPG tại giây đó qua đúng bộ lọc của bản dựng — keyframe xem trước của shot. */
export function lenhMotDung(o: { de: DeMotDung; ass: string; nen: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const M = o.de.mau, khung = Math.round(DAI * FPS);
  const vao = o.nen
    ? ['-loop', '1', '-framerate', String(FPS), '-t', String(DAI), '-i', o.nen]
    : ['-f', 'lavfi', '-i', `gradients=s=${W}x${H}:type=radial:x0=540:y0=730:x1=540:y1=2050:c0=${tron(M.sau, '#ffffff', 0.3).replace('#', '0x')}:c1=${M.sau.replace('#', '0x')}:c2=${tron(M.sau, '#000000', 0.3).replace('#', '0x')}:nb_colors=3:speed=0:r=${FPS}:d=${DAI}`];
  const nen = o.nen
    ? `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},zoompan=z='1+0.06*on/${khung}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},lutyuv=y=val*0.7,vignette=angle=PI/4`   // tối đi bằng ĐỘ SÁNG (kênh Y), giữ màu: drawbox có alpha trên YUV trộn cả kênh màu về xám — lớp đen 30% đã làm ảnh gần như đơn sắc (đo 16/10/2026)
    : '[0:v]null';
  const loc = `${nen},ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-f', 'lavfi', '-i', `aevalsrc='${AM}':s=44100:d=${DAI}`,
    '-filter_complex', loc,
    '-map', '[v]', '-map', '1:a', '-r', String(FPS), '-t', String(DAI), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', o.ra];
}

/** PHIM của khuôn (thể loại 'may_dung' trong danh sách Phim, anh 16/10/2026: "nó luôn phải nằm trong danh sách Phim, chỉ là thể loại khác"):
 *  kịch bản tập + 3 SHOT theo nhịp khuôn — đề + đếm · lộ đáp án · màn kết. Viết sẵn từ đề, không AI. Keyframe / clip của shot = khung cắt từ
 *  bản dựng (may-dung.ts › xuatMayDungTap), nên storyboard, thẻ shot, xuất đi đúng đường như mọi phim. */
export const SHOT_MOT_DUNG = [
  { tu: 0, den: T_LO, canh: 'Đề + đếm 7 giây' },
  { tu: T_LO, den: T_KET, canh: 'Lộ đáp án' },
  { tu: T_KET, den: DAI, canh: 'Màn kết' },
] as const;
export function kichBanMotDung(de: DeMotDung) {
  const L = luoi(de), sai = de.o.filter((_, i) => i !== de.cho).length;
  const shots = [
    { ...SHOT_MOT_DUNG[0], goc_may: 'Khung dọc cố định 9:16, toàn màn', chu_man: `Only ONE is spelled\n${de.dich}\nFind it in 7 seconds${de.moc ? `\n${de.moc}` : ''}`,
      hanh_dong: `Tiêu đề và bảng trắng "đập" vào khung (0,5s). Bảng ${L.cot}×${L.hang} = 36 ô: ${sai} bản viết sai một chữ của ${de.dich}, đúng một ô viết đúng. Thanh thời gian co dần, đồng hồ đếm 7 → 1 (3 giây cuối nền đỏ, nảy mỗi giây), tích tắc mỗi giây.` },
    { ...SHOT_MOT_DUNG[1], goc_may: 'Khung dọc cố định 9:16, toàn màn', chu_man: de.dich,
      hanh_dong: `Lộ đáp án: ô ${de.cho + 1} (hàng ${Math.floor(de.cho / L.cot) + 1}, cột ${(de.cho % L.cot) + 1}) bật khung màu nhấn viền đỏ, phóng 1,25; 35 ô sai mờ còn 25%. Tiếng "ting".` },
    { ...SHOT_MOT_DUNG[2], goc_may: 'Khung dọc cố định 9:16, toàn màn', chu_man: 'Did you spot it in time?\nComment YES or NO\nFree large print puzzles to print:\npickjot.com/printables',
      hanh_dong: 'Màn kết hiện dần (0,3s) trên nền màu bìa: câu hỏi, nút "Comment YES or NO", link pickjot.com/printables.' },
  ].map((s) => ({ ...s, giay: Math.round((s.den - s.tu) * 100) / 100 }));
  const kich_ban = shots.map((s, i) => `#${i + 1} ${s.canh} (${s.tu.toFixed(1)}–${s.den.toFixed(1)}s)\n${s.hanh_dong}\nChữ màn: ${s.chu_man.replace(/\n/g, ' / ')}`).join('\n\n');
  return { tom_tat: `Đố chữ "Only ONE is spelled right" — ${de.goi}: tìm ${de.dich} đúng chính tả giữa 36 ô trong 7 giây.`, kich_ban, shots };
}
