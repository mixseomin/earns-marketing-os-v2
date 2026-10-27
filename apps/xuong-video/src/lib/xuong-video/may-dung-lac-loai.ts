// MẪU MÁY DỰNG "Vật lạc loài" (dạng vat-lac-loai trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 27/10/2026). MẪU CHUNG mọi ngách: lưới
// 3×3 → 5×5 ô chữ / ký hiệu giống nhau (chữ, số, từ ngắn, ký tự Unicode có trong font), MỘT ô khác (O/Q, 6/9, CALM/CLAM…), đếm 7s, khoanh ô khác, câu móc
// theo góc, trên cảnh thật làm tối + tiếng nền thu thật. THUẦN: đề → ASS + lệnh ffmpeg. Vị trí ô khác do đề quyết (máy sinh đề chọn ngẫu nhiên, kiểm trùng).
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-lac-loai.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, nhipDem, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
import { chuoiAnh, locAmChuoi } from './may-dung-chuoi';
import type { LoaiAm } from './am-nen';

export interface DeLacLoai {
  giong: string;           // ô thường: "O", "6", "CALM" (≤ 5 ký tự)
  khac: string;            // ô lạc loài: "Q", "9", "CLAM"
  hang: number; cot: number;   // 3–5 × 3–5
  vi_tri: number;          // chỉ số ô khác, 0 → hang×cot−1
  moc?: string;            // câu móc theo góc ("Eyes still sharp after 70?")
  truy: string;            // ảnh thật nền (làm tối)
  ket?: string[];
  am?: LoaiAm;
  nhan?: string;
}
export const FPS = 30, DEM = 7, T_MO = 1.5, HANG_MAX = 5, HANG_MIN = 3;
const W = 1080, H = 1920, TRANG = '#F4F6F8', NHAN = '#FCA311', XANH = '#22C55E', O = '#FFFFFF', CHU = '#111111';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;
const kep = (n: number) => Math.min(HANG_MAX, Math.max(HANG_MIN, Math.round(n || HANG_MIN)));

/** Lưới chuẩn: cạnh ô theo số cột (lưới vuông 960 px), vị trí ô khác kẹp trong lưới. */
export function luoiLacLoai(de: DeLacLoai) {
  const hang = kep(de.hang), cot = kep(de.cot), canh = Math.floor((960 - 16 * (cot - 1)) / cot), rong = canh * cot + 16 * (cot - 1), cao = canh * hang + 16 * (hang - 1);
  const x0 = Math.round((W - rong) / 2), y0 = Math.round(980 - cao / 2), vi = Math.min(hang * cot - 1, Math.max(0, Math.round(de.vi_tri)));
  const o = (i: number) => ({ x: x0 + (i % cot) * (canh + 16), y: y0 + Math.floor(i / cot) * (canh + 16) });
  return { hang, cot, canh, x0, y0, rong, cao, vi, o, coChu: Math.max(36, Math.floor(canh * (de.giong.length > 4 ? 0.22 : de.giong.length > 2 ? 0.27 : 0.55))) };   // bản thử 27/10: 4 chữ ở 0,32 chạm mép ô
}
export function nhipLacLoai(de: DeLacLoai) {
  const T_DEM = Math.max(T_MO, giayDoc(de.moc ?? '') - 1), T_LO = T_DEM + DEM, T_KET = T_LO + 2.5;
  const ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2), DAI = T_KET + (ket.length ? Math.max(2.5, giayDoc(...ket) - 1) : 0.8);
  return { T_DEM, T_LO, T_KET, DAI, ket };
}
export const anhLacLoai = (de: DeLacLoai): { t: number; cat: [number, number, number, number] }[] => { const N = nhipLacLoai(de); return [{ t: N.T_DEM + 1, cat: [0, 240, 1080, 1440] }, { t: N.T_LO + 1.2, cat: [0, 240, 1080, 1440] }]; };
export const truyVanLacLoai = (de: DeLacLoai) => de.truy;

export function assLacLoai(de: DeLacLoai): string {
  const N = nhipLacLoai(de), L = luoiLacLoai(de), d: DongAss[] = [];
  d.push([1, 0, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.5)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([2, 0, N.T_LO, 'Den', `{\\an5\\pos(540,300)${fs(60)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(200,0)}Find the odd one out`]);
  if (de.moc) d.push([2, 0.3, N.DAI, 'Chu', `{\\an5\\pos(540,400)\\b1${fs(36)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2\\fad(200,0)}${ngat(de.moc, 34).slice(0, 2).map(chu).join('\\N')}`]);
  for (let i = 0; i < L.hang * L.cot; i++) {
    const p = L.o(i), khac = i === L.vi;
    d.push([3, 0, N.DAI, 'Ve', `{\\an7\\pos(${p.x},${p.y})\\1c${mauAss(O)}\\fad(150,0)\\p1}${bo(L.canh, L.canh, 18)}`]);
    d.push([4, 0, N.DAI, 'Den', `{\\an5\\pos(${p.x + L.canh / 2},${p.y + L.canh / 2 + 3})${fs(L.coChu)}\\1c${mauAss(CHU)}\\fad(150,0)}${chu(khac ? de.khac : de.giong)}`]);
    if (khac) {
      d.push([5, N.T_LO, N.DAI, 'Ve', `{\\an7\\pos(${p.x - 8},${p.y - 8})\\1c${mauAss(XANH)}\\3c${mauAss(XANH)}\\bord6\\1a&HFF&\\fad(150,0)\\p1}${bo(L.canh + 16, L.canh + 16, 22)}`]);
      d.push([5, N.T_LO, N.DAI, 'Ve', `{\\an7\\pos(${p.x},${p.y})\\1c${mauAss(XANH)}\\1a${alpha(0.25)}\\fad(150,0)\\p1}${bo(L.canh, L.canh, 18)}`]);
    }
  }
  d.push([2, N.T_DEM, N.T_LO, 'Chu', `{\\an5\\pos(540,1640)\\b1${fs(34)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2}One of them is different`]);
  for (let k = 0; k < DEM; k++) d.push([2, N.T_DEM + k, N.T_DEM + k + 1, 'Den', `{\\an5\\pos(540,1760)${fs(110)}\\1c&HFFFFFF&\\3c&H000000&\\bord4${nhipDem(1)}}${DEM - k}`]);
  d.push([2, N.T_LO, N.DAI, 'Den', `{\\an5\\pos(540,300)${fs(60)}\\1c${mauAss(XANH)}\\3c&H000000&\\bord3\\fad(150,0)}Row ${Math.floor(L.vi / L.cot) + 1}, column ${(L.vi % L.cot) + 1}`]);
  d.push([2, N.T_LO, N.DAI, 'Chu', `{\\an5\\pos(540,1700)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\fad(150,0)}${chu(de.giong)} → ${chu(de.khac)}`]);
  if (N.ket.length) {
    d.push([6, N.T_KET, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.72)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([7, N.T_KET, N.DAI, 'Den', `{\\an5\\pos(540,900)${fs(60)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(300,0)}${chu(N.ket[0]!)}`]);
    if (N.ket[1]) d.push([7, N.T_KET, N.DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&\\fad(300,0)}${chu(N.ket[1])}`]);
  }
  if (de.nhan) d.push([2, 0, N.DAI, 'Chu', `{\\an7\\pos(40,40)\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  return rapAss(W, H, d);
}
export function lenhLacLoai(o: { de: DeLacLoai; ass: string; nen?: string | null; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const N = nhipLacLoai(o.de), dai = Number(N.DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu vật lạc loài cần ảnh nền thật (nen_url)');
  const c = chuoiAnh([{ anh: o.nen, tu: 0, den: dai }], { W, H, dai, fps: FPS }), f = [...c.loc, `[vx]gblur=sigma=4,ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`];
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, '-filter_complex', f.join(';'), '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const amVao = o.am ? ['-stream_loop', '-1', '-i', o.am] : ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, ...amVao, '-filter_complex', `${f.join(';')};${locAmChuoi(dai).replace('[A]', `[${c.soVao}:a]`)}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}
export function kichBanLacLoai(de: DeLacLoai) {
  const N = nhipLacLoai(de), L = luoiLacLoai(de);
  return { tom_tat: `Lạc loài · ${de.giong} / ${de.khac} · ${L.hang}×${L.cot}`, shots: [{ tu: 0, den: N.T_DEM, canh: 'Lưới', hanh_dong: `Lưới ${L.hang}×${L.cot} ô "${de.giong}", một ô "${de.khac}" ở hàng ${Math.floor(L.vi / L.cot) + 1} cột ${(L.vi % L.cot) + 1}; móc "${de.moc ?? ''}"` },
    { tu: N.T_DEM, den: N.T_LO, canh: 'Đếm', hanh_dong: '7 → 1' }, { tu: N.T_LO, den: N.T_KET, canh: 'Lộ', hanh_dong: 'Khoanh xanh ô khác' }, ...(N.ket.length ? [{ tu: N.T_KET, den: N.DAI, canh: 'Kết', hanh_dong: N.ket.join(' / ') }] : [])] };
}
