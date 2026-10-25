// MẪU MÁY DỰNG "Câu hỏi luyện thi" (ExamWeight: PTCB · NREMT · ATI TEAS → examweight.com/<kỳ thi>/practice-test — S04 bước 3, anh duyệt 22/10/2026).
// THUẦN: đề (một câu hỏi thật của ngân hàng đề ExamWeight, đã được duyệt lại) → tệp ASS + lệnh ffmpeg. Không AI, 0đ.
// Nhịp: tiêu đề + thẻ câu hỏi 4 lựa chọn "đập" vào 0,5s, thanh thời gian + đồng hồ 10 giây → lộ: lựa chọn đúng tô xanh + dấu ✓, các lựa chọn khác mờ,
// lời giải bên dưới (đứng đủ thời gian đọc — may-dung-ass.ts › giayDoc) → màn kết: bài thi thử miễn phí chấm theo tỉ trọng đề thật.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-thi.test.mts

export type KyThi = 'PTCB' | 'NREMT' | 'TEAS';
export interface DeThi {
  ky: KyThi;
  hoi: string;                                   // đề câu hỏi (≤ 230 ký tự — nguồn lọc sẵn)
  lua: Record<'A' | 'B' | 'C' | 'D', string>;    // 4 lựa chọn (mỗi cái ≤ 70 ký tự)
  dung: 'A' | 'B' | 'C' | 'D';
  giai: string;                                  // lời giải ngắn (1–2 câu đầu của explanation)
  mang: string;                                  // mảng kiến thức (vd "Medications") — chữ nhỏ trên thẻ
}

import { alpha, bo, chu, giayDoc, mauAss, ms, nayVao, ngat, nhipDem, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export const FPS = 30, T_DEM = 0.3, DEM = 10, T_LO = T_DEM + DEM;
export const TEN_KY: Record<KyThi, string> = { PTCB: 'PTCB', NREMT: 'NREMT EMT', TEAS: 'ATI TEAS 7' };
export const LINK_THI = (ky: KyThi) => `https://examweight.com/${ky.toLowerCase()}/practice-test`;
const chuKet = (ky: KyThi) => [`Free ${TEN_KY[ky]} practice test`, 'Weighted like the real exam, with an explanation for every answer', `examweight.com/${ky.toLowerCase()}`];
/** Mốc theo đề (luật đọc): đếm 10 giây → lộ đáp án + lời giải đứng đủ thời gian đọc → màn kết đứng đủ thời gian đọc. */
export function nhipThi(de: DeThi) {
  const T_KET = T_LO + giayDoc(de.lua[de.dung], de.giai);
  return { T_LO, T_KET, DAI: T_KET + giayDoc(...chuKet(de.ky)) };
}
const W = 1080, H = 1920, XANH = '#2EBD85', NHAN = '#FCA311', SAU = '#10233F', TRANG = '#F4F6F8', MO = '#9AA3AD';
const EM = 1.15, fs = (px: number) => `\\fs${Math.round(px * EM)}`;
const CHU_CAI = ['A', 'B', 'C', 'D'] as const;

/** Bố cục thẻ: dòng câu hỏi + 4 ô lựa chọn (mỗi ô: các dòng đã ngắt, toạ độ trên/dưới), y cuối thẻ. */
export function boCucThi(de: DeThi) {
  const DONG = 58, y0 = 470;
  const hoi = ngat(de.hoi, 34), yHoi = hoi.map((_, i) => y0 + i * DONG);
  let y = y0 + hoi.length * DONG + 40;
  const o = CHU_CAI.map((c) => {
    const ds = ngat(de.lua[c], 30), cao = Math.max(96, ds.length * 52 + 40), tren = y;
    y += cao + 22;
    return { c, ds, tren, duoi: tren + cao, tam: tren + cao / 2 };
  });
  // lời giải hiện SAU khi đồng hồ (đỉnh y≈1655, chỉ hiện lúc đếm) đã tắt → được xuống tới đáy an toàn 1880; quá dài thì cắt bớt dòng
  const yG = y + 30, giai = ngat(de.giai, 40).slice(0, Math.max(1, Math.floor((1880 - yG - 70) / 50)));
  return { hoi, yHoi, o, cuoi: y, yG, giai, cuoiG: yG + giai.length * 50 + 70 };
}

export function assThi(de: DeThi): string {
  const { T_KET, DAI } = nhipThi(de);
  const d: DongAss[] = [], L = boCucThi(de);
  // lớp phủ đen 40% trên ẢNH THẬT (luật ảnh minh hoạ thật, nhìn rõ)
  d.push([0, 0, T_KET, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.4)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([5, 0, T_KET, 'Den', `{\\an5\\pos(540,150)${fs(76)}\\4c&H000000&\\4a&H80&\\shad6${nayVao(125)}\\1c${mauAss(NHAN)}}${chu(TEN_KY[de.ky])}{\\1c&HFFFFFF&} QUESTION`]);
  d.push([5, 0, T_KET, 'Chu', `{\\an5\\pos(540,250)\\b1${fs(44)}\\1c&HFFFFFF&${nayVao(125)}}Can you answer it in 10 seconds?`]);
  // thanh thời gian
  d.push([2, 0, T_LO, 'Ve', `{\\an7\\pos(60,300)\\1c&HFFFFFF&\\1a${alpha(0.18)}\\p1}${bo(960, 20, 10)}`]);
  d.push([3, 0, T_LO, 'Ve', `{\\an7\\pos(60,300)\\1c${mauAss(NHAN)}\\clip(60,300,1020,320)\\t(${ms(T_DEM)},${ms(T_LO)},\\clip(60,300,60,320))\\p1}${bo(960, 20, 10)}`]);
  // thẻ trắng
  const cao = L.cuoi - 360 + 20, tamY = 360 + cao / 2;
  d.push([1, 0, T_KET, 'Ve', `{\\an5\\pos(540,${Math.round(tamY + 14)})\\1c&H000000&\\1a${alpha(0.3)}${nayVao(92)}\\p1}${bo(960, cao, 34)}`]);
  d.push([2, 0, T_KET, 'Ve', `{\\an5\\pos(540,${Math.round(tamY)})\\1c${mauAss(TRANG)}${nayVao(92)}\\p1}${bo(960, cao, 34)}`]);
  d.push([5, 0, T_KET, 'Chu', `{\\an4\\pos(110,405)\\b1${fs(30)}\\1c${mauAss(MO)}${nayVao(92)}}${chu(de.mang.toUpperCase())}`]);
  for (const [i, s] of L.hoi.entries()) d.push([6, 0, T_KET, 'Chu', `{\\an4\\pos(110,${L.yHoi[i]})\\b1${fs(42)}\\1c&H1B1B1B&${nayVao(92)}}${chu(s)}`]);
  for (const o of L.o) {
    const dung = o.c === de.dung, h = o.duoi - o.tren;
    // ô lựa chọn (viền xám) → lúc lộ: ô đúng xanh, ô sai mờ
    d.push([3, 0, T_LO, 'Ve', `{\\an5\\pos(540,${Math.round(o.tam)})\\1c&HFFFFFF&\\3c${mauAss('#D5DAE0')}\\bord3${nayVao(92)}\\p1}${bo(880, h, 18)}`]);
    d.push([3, T_LO, T_KET, 'Ve', dung
      ? `{\\an5\\pos(540,${Math.round(o.tam)})\\1c${mauAss(XANH)}\\1a${alpha(0.18)}\\3c${mauAss(XANH)}\\bord6${nayVao(97, 0, 0.25)}\\p1}${bo(880, h, 18)}`
      : `{\\an5\\pos(540,${Math.round(o.tam)})\\1c&HFFFFFF&\\1a${alpha(0.55)}\\3c${mauAss('#D5DAE0')}\\bord3\\p1}${bo(880, h, 18)}`]);
    d.push([4, 0, T_KET, 'Ve', `{\\an5\\pos(160,${Math.round(o.tam)})\\1c${mauAss(SAU)}${nayVao(92)}\\p1}${bo(64, 64, 32)}`]);
    d.push([5, 0, T_KET, 'Den', `{\\an5\\pos(160,${Math.round(o.tam) + 2})${fs(32)}\\1c&HFFFFFF&${nayVao(92)}}${o.c}`]);
    const y1 = o.tam - ((o.ds.length - 1) * 52) / 2;
    for (const [i, s] of o.ds.entries()) {
      d.push([6, 0, T_LO, 'Chu', `{\\an4\\pos(215,${Math.round(y1 + i * 52)})\\b0${fs(38)}\\1c&H222222&${nayVao(92)}}${chu(s)}`]);
      d.push([6, T_LO, T_KET, 'Chu', `{\\an4\\pos(215,${Math.round(y1 + i * 52)})\\b${dung ? 1 : 0}${fs(38)}\\1c${dung ? '&H1B1B1B&' : mauAss(MO)}}${chu(s)}`]);
    }
    if (dung) {
      d.push([7, T_LO, T_KET, 'Ve', `{\\an5\\pos(930,${Math.round(o.tam)})\\1c${mauAss(XANH)}${nayVao(40, 0, 0.22)}\\p1}${bo(76, 76, 38)}`]);
      // dấu tích VẼ bằng hình (font chữ có thể thiếu ký tự ✓ → ô trống)
      d.push([8, T_LO, T_KET, 'Ve', `{\\an5\\pos(930,${Math.round(o.tam)})\\1c&HFFFFFF&${nayVao(40, 0, 0.22)}\\p1}m 0 22 l 10 12 l 18 20 l 36 2 l 46 12 l 18 40`]);
    }
  }
  // đồng hồ 10 → 1 (3 giây cuối đỏ) — ở đáy, dưới thẻ
  for (let s = DEM; s >= 1; s--) {
    const tu = s === DEM ? 0 : T_LO - s, den = T_LO - s + 1, gap = s <= 3, nayGiay = nhipDem(den - tu);
    d.push([7, tu, den, 'Ve', `{\\an5\\pos(540,1745)\\1c${gap ? mauAss('#E5484D') : mauAss(NHAN)}${nayGiay}\\p1}${bo(180, 180, 90)}`]);
    d.push([8, tu, den, 'Den', `{\\an5\\pos(540,1747)${fs(96)}\\1c${gap ? '&HFFFFFF&' : '&H111111&'}${nayGiay}}${s}`]);
  }
  // lời giải: khung tối dưới thẻ
  const { giai, yG } = L, caoG = giai.length * 50 + 70;
  d.push([9, T_LO, T_KET, 'Ve', `{\\an7\\pos(60,${yG})\\1c&H000000&\\1a${alpha(0.62)}\\fad(150,0)\\p1}${bo(960, caoG, 22)}`]);
  for (const [i, s] of giai.entries()) d.push([10, T_LO, T_KET, 'Chu', `{\\an4\\pos(95,${yG + 50 + i * 50})\\b0${fs(36)}\\1c&HFFFFFF&\\fad(150,0)}${i === 0 ? `{\\b1\\1c${mauAss(XANH)}}${de.dung} is correct.{\\b0\\1c&HFFFFFF&} ` : ''}${chu(s)}`]);
  // màn kết
  const fad = '\\fad(300,0)', [k1, k2, k3] = chuKet(de.ky);
  d.push([20, T_KET, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c${mauAss(SAU)}\\1a${alpha(0.82)}${fad}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([21, T_KET, DAI, 'Den', `{\\an5\\pos(540,700)${fs(70)}\\1c&HFFFFFF&\\q2${fad}}${chu(k1!)}`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,900)\\b1${fs(44)}\\1c&HFFFFFF&\\1a&H30&\\q2${fad}}${ngat(k2!, 30).map(chu).join('\\N')}`]);
  d.push([21, T_KET, DAI, 'Ve', `{\\an5\\pos(540,1120)\\1c${mauAss(NHAN)}${fad}\\p1}${bo(720, 120, 20)}`]);
  d.push([22, T_KET, DAI, 'Den', `{\\an5\\pos(540,1122)${fs(54)}\\1c&H111111&${fad}}${chu(k3!)}`]);
  return rapAss(W, H, d);
}

/** Tiếng: tích mỗi giây lúc đếm, dồn 3 giây cuối; lộ đáp án = "ting". Sinh bằng ffmpeg, không nhạc ngoài. */
export const amThi = () => `0.3*sin(2*PI*660*t)*exp(-9*t)`
  + `+0.25*sin(2*PI*1400*t)*lt(mod(t-${T_DEM},1),0.04)*gte(t,${T_DEM})*lt(t,${T_LO})`
  + `+0.2*sin(2*PI*1700*t)*lt(mod(t-${T_DEM}+0.5,1),0.03)*gte(t,${T_LO - 3})*lt(t,${T_LO})`
  + `+0.35*sin(2*PI*880*t)*exp(-6*(t-${T_LO}))*gte(t,${T_LO})`;

/** Lệnh ffmpeg: nền = ẢNH THẬT (nen_url Pexels) lia chậm → ass → H.264 + AAC. Không có ảnh thì DỪNG (luật cấm chữ trên nền màu phẳng). */
export function lenhThi(o: { de: DeThi; ass: string; nen?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const DAI = Number(nhipThi(o.de).DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu cau-hoi-thi cần ảnh nền thật (nen_url) — studio tự chọn Pexels khi xuất');
  const vao = ['-i', o.nen];
  const nen = `[0:v]scale=${Math.round(W * 1.08)}:${Math.round(H * 1.08)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.08)}:${Math.round(H * 1.08)},eq=brightness=-0.04:saturation=0.95,loop=loop=-1:size=1:start=0,fps=${FPS},crop=${W}:${H}:x='(iw-ow)/2':y='(ih-oh)*t/${DAI}'`;
  const loc = `${nen},ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-f', 'lavfi', '-i', `aevalsrc='${amThi()}':s=44100:d=${DAI}`,
    '-filter_complex', loc, '-map', '[v]', '-map', '1:a', '-r', String(FPS), '-t', String(DAI), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', o.ra];
}

/** ẢNH TĨNH cho bài ảnh (x_anh / fb_anh): câu hỏi (chưa lộ, giữa lúc đếm) + đáp án (đã lộ, lời giải hiện đủ). Khung cắt 3:4. */
export function anhThi(de: DeThi): { t: number; cat: [number, number, number, number] }[] {
  const { T_KET } = nhipThi(de);
  return [{ t: T_DEM + DEM * 0.5, cat: [0, 60, 1080, 1440] }, { t: T_LO + (T_KET - T_LO) * 0.7, cat: [0, 300, 1080, 1440] }];
}

/** Từ khoá ảnh nền theo kỳ thi — xoay theo băm slug cho các video khác cảnh (studio vẫn chặn ảnh trùng trong máy). */
const TRUY: Record<KyThi, string[]> = {
  PTCB: ['pharmacy technician', 'pharmacist counting pills', 'pharmacy shelves medicine', 'prescription bottles', 'student studying pharmacy'],
  NREMT: ['paramedic ambulance', 'emergency medical technician', 'ambulance at night', 'first aid training', 'emt student studying'],
  TEAS: ['nursing student studying', 'nurse student classroom', 'student exam desk', 'nursing school library', 'young woman studying notes'],
};
export const truyVanThi = (de: DeThi) => { const ds = TRUY[de.ky]; return ds[[...de.hoi].reduce((a, c) => a + c.charCodeAt(0), 0) % ds.length]!; };

/** Câu hỏi rút gọn làm móc tiêu đề (≤ 60 ký tự theo từ, không lộ đáp án). */
export function mocThi(de: DeThi): string {
  const t = de.hoi.replace(/\s+/g, ' ').trim();
  if (t.length <= 60) return t;
  let r = ''; for (const w of t.split(' ')) { if (`${r} ${w}`.trim().length > 57) break; r = `${r} ${w}`.trim(); }
  return `${r}...`;
}
/** Một dòng nguồn (mau/may/cau-hoi-thi.json) → dòng nạp máy: đề + chữ đăng tiếng Anh. Tiêu đề mỗi video một khác (câu hỏi của chính video). */
export function tuNguonThi(x: DeThi & { slug: string; nhom?: string }) {
  const { slug, nhom, ...de } = x, link = LINK_THI(de.ky), k = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
  const title = [`${TEN_KY[de.ky]} practice question: ${mocThi(de)}`, `Can you answer this ${TEN_KY[de.ky]} question? ${mocThi(de)}`, `${TEN_KY[de.ky]} quiz: ${mocThi(de)}`][k]!;
  return { slug, chu_de: `${de.ky} · ${de.mang}`, de, dang: {
    title: title.slice(0, 110),
    description: `Answer: ${de.dung}. ${de.lua[de.dung]}. ${de.giai} Free ${TEN_KY[de.ky]} practice test, weighted like the real exam: ${link}`,
    link, nhom: nhom ?? `${de.ky} · ${de.mang}`,
  }, nen_url: null };
}

/** Kịch bản 3 shot (tab Mẫu / ngăn video của máy). */
export function kichBanThi(de: DeThi) {
  const { T_KET, DAI } = nhipThi(de);
  return { tom_tat: `${TEN_KY[de.ky]} · ${de.mang}`, shots: [
    { tu: 0, den: T_LO, canh: 'Câu hỏi + đếm 10 giây', hanh_dong: `Thẻ câu hỏi ${TEN_KY[de.ky]} với 4 lựa chọn; người xem có 10 giây chọn, đồng hồ đếm 10 → 1.` },
    { tu: T_LO, den: T_KET, canh: 'Lộ đáp án + lời giải', hanh_dong: `Lựa chọn ${de.dung} tô xanh + dấu ✓, các lựa chọn khác mờ; lời giải hiện bên dưới.` },
    { tu: T_KET, den: DAI, canh: 'Màn kết', hanh_dong: `Bài thi thử ${TEN_KY[de.ky]} miễn phí, chấm theo tỉ trọng đề thật — examweight.com/${de.ky.toLowerCase()}.` },
  ] };
}
