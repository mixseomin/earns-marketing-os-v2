// MẪU MÁY DỰNG "Câu nói theo tình huống" (dạng cau-noi-theo-nuoc trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 27/10/2026). MẪU CHUNG cho mọi
// ngách có ngôn ngữ khác (du lịch, học): đề = một tình huống (check-in, hỏi đường, gọi món) × 3–5 câu, mỗi câu = chữ bản ngữ + cách đọc + nghĩa, trên
// MỘT cảnh thật (ảnh Pexels của tình huống) lia chậm, tiếng nền thu thật. THUẦN: đề → ASS + lệnh ffmpeg. Nhịp theo luật đọc (giayDoc): mỗi thẻ câu đứng đủ
// đọc ba dòng + 1s nhìn chữ lạ. Chữ bản ngữ (Nhật / Hàn / Thái / Trung…) cần font trong máy dựng: container Cloudflare cài fonts-noto-cjk + fonts-noto-core
// (cloudflare/dung-video/container/Dockerfile); libass tự rơi về font có ký tự đó qua fontconfig.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-cau-noi.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
import { chuoiAnh, locAmChuoi } from './may-dung-chuoi';
import type { LoaiAm } from './am-nen';

export interface CauNoi { ban_ngu: string; doc: string; nghia: string }
export interface DeCauNoi {
  tinh_huong: string;      // "At hotel check-in" — tiêu đề màn mở
  ngon_ngu: string;        // "Japanese"
  cau: CauNoi[];           // 3–5 câu
  truy: string;            // từ khoá ảnh cảnh thật của tình huống
  ket?: string[];          // 1–2 dòng kết (thương hiệu, site)
  am?: LoaiAm;
  nhan?: string;
}
export const FPS = 30, T_MO_MIN = 2.2, DEM_LA = 1, SO_CAU_MAX = 5;
const W = 1080, H = 1920, TRANG = '#F4F6F8', NHAN = '#FCA311';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Mốc: mở (tình huống + ngôn ngữ) → từng thẻ câu (đủ đọc ba dòng + DEM_LA) → kết. */
export function nhipCauNoi(de: DeCauNoi) {
  const cau = de.cau.slice(0, SO_CAU_MAX), T_MO = Math.max(T_MO_MIN, giayDoc(de.tinh_huong, de.ngon_ngu));
  const tu: number[] = []; let t = T_MO;
  for (const c of cau) { tu.push(t); t += Math.max(3, giayDoc(c.ban_ngu, c.doc, c.nghia) + DEM_LA); }
  const T_KET = t, ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2), DAI = T_KET + (ket.length ? Math.max(2.5, giayDoc(...ket) - 1) : 0.8);
  return { T_MO, tu, T_KET, DAI, cau, ket, n: cau.length };
}
export const anhCauNoi = (de: DeCauNoi): { t: number; cat: [number, number, number, number] }[] => [{ t: nhipCauNoi(de).tu[0]! + 1, cat: [0, 240, 1080, 1440] }];
export const truyVanCauNoi = (de: DeCauNoi) => de.truy;

export function assCauNoi(de: DeCauNoi): string {
  const N = nhipCauNoi(de), d: DongAss[] = [];
  // màn mở
  d.push([1, 0, N.T_MO, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.45)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([2, 0, N.T_MO, 'Chu', `{\\an5\\pos(540,760)\\b1${fs(40)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2\\fad(200,250)}Say this in ${chu(de.ngon_ngu)}`]);
  d.push([2, 0, N.T_MO, 'Den', `{\\an5\\pos(540,900)${fs(76)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(200,250)}${ngat(de.tinh_huong, 20).slice(0, 3).map(chu).join('\\N')}`]);
  // từng thẻ: dải tối giữa màn, bản ngữ to, cách đọc màu nhấn, nghĩa trắng; số thứ tự nhỏ góc
  N.cau.forEach((c, i) => {
    const t0 = N.tu[i]!, t1 = i + 1 < N.n ? N.tu[i + 1]! : N.T_KET, bn = ngat(c.ban_ngu, 14).slice(0, 2), doc = ngat(c.doc, 30).slice(0, 2), ng = ngat(c.nghia, 32).slice(0, 2);
    const coBn = bn.some((x) => x.length > 10) ? 72 : 88, cao = 80 + Math.round(coBn * 1.5) * bn.length + 58 * doc.length + 50 * ng.length;
    d.push([3, t0, t1, 'Ve', `{\\an5\\pos(540,960)\\1c&H000000&\\1a${alpha(0.58)}\\fad(250,250)\\p1}${bo(1000, cao, 28)}`]);
    let y = 960 - cao / 2 + 40;
    d.push([4, t0, t1, 'Den', `{\\an8\\pos(540,${y})${fs(coBn)}\\1c&HFFFFFF&\\fad(250,250)}${bn.map(chu).join('\\N')}`]); y += Math.round(coBn * 1.5) * bn.length + 8;
    d.push([4, t0, t1, 'Chu', `{\\an8\\pos(540,${y})\\b1${fs(42)}\\1c${mauAss(NHAN)}\\fad(250,250)}${doc.map(chu).join('\\N')}`]); y += 58 * doc.length + 6;
    d.push([4, t0, t1, 'Chu', `{\\an8\\pos(540,${y})\\b1${fs(36)}\\1c${mauAss(TRANG)}\\1a&H30&\\fad(250,250)}${ng.map(chu).join('\\N')}`]);
    d.push([4, t0, t1, 'Chu', `{\\an9\\pos(1040,40)\\b1${fs(30)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2}${i + 1}/${N.n}`]);
  });
  if (N.ket.length) {
    d.push([6, N.T_KET, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.6)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([7, N.T_KET, N.DAI, 'Den', `{\\an5\\pos(540,900)${fs(60)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(300,0)}${chu(N.ket[0]!)}`]);
    if (N.ket[1]) d.push([7, N.T_KET, N.DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&\\fad(300,0)}${chu(N.ket[1])}`]);
  }
  if (de.nhan) d.push([2, 0, N.DAI, 'Chu', `{\\an7\\pos(40,40)\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  return rapAss(W, H, d);
}
/** Lệnh ffmpeg: một ảnh thật lia chậm cả video (chuỗi một đoạn), ass, tiếng thật. */
export function lenhCauNoi(o: { de: DeCauNoi; ass: string; nen?: string | null; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const N = nhipCauNoi(o.de), dai = Number(N.DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu câu nói cần ảnh nền thật (nen_url)');
  const c = chuoiAnh([{ anh: o.nen, tu: 0, den: dai }], { W, H, dai, fps: FPS }), f = [...c.loc, `[vx]ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`];
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, '-filter_complex', f.join(';'), '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const amVao = o.am ? ['-stream_loop', '-1', '-i', o.am] : ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, ...amVao, '-filter_complex', `${f.join(';')};${locAmChuoi(dai).replace('[A]', `[${c.soVao}:a]`)}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}
export function kichBanCauNoi(de: DeCauNoi) {
  const N = nhipCauNoi(de);
  return { tom_tat: `${de.ngon_ngu} · ${de.tinh_huong}`, shots: [{ tu: 0, den: N.T_MO, canh: 'Mở', hanh_dong: `"${de.tinh_huong}" — Say this in ${de.ngon_ngu}, ảnh thật "${de.truy}"` },
    ...N.cau.map((c, i) => ({ tu: N.tu[i]!, den: i + 1 < N.n ? N.tu[i + 1]! : N.T_KET, canh: `Câu ${i + 1}`, hanh_dong: `${c.ban_ngu} · ${c.doc} · ${c.nghia}` })),
    ...(N.ket.length ? [{ tu: N.T_KET, den: N.DAI, canh: 'Kết', hanh_dong: N.ket.join(' / ') }] : [])] };
}
