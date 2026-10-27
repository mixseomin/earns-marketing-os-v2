// MẪU MÁY DỰNG "So sánh X vs Y" (dạng so-sanh trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 27/10/2026). MẪU CHUNG mọi ngách:
// chia đôi màn dọc (trên = X, dưới = Y), mỗi bên một ẢNH THẬT riêng (nen_url = X, nen_them[0] = Y) lia chậm, tên bên + 2–4 dòng đối nhau hiện từng cặp,
// kết luận một dòng, tiếng nền thu thật. THUẦN: đề → ASS + lệnh ffmpeg. Nhịp theo luật đọc (giayDoc): mỗi cặp dòng đứng đủ đọc cả hai vế.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-so-sanh.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
import { locAmChuoi } from './may-dung-chuoi';
import type { LoaiAm } from './am-nen';

export interface BenSoSanh { ten: string; dong: string[]; truy: string }
export interface DeSoSanh {
  tieu_de: string;         // "Hotel site vs calling the desk" — có chữ "vs" hoặc hai vế
  trai: BenSoSanh;         // X (nửa trên)
  phai: BenSoSanh;         // Y (nửa dưới)
  ket_luan?: string;       // một dòng chốt ("Call first, book second")
  ket?: string[];          // 1–2 dòng kết (thương hiệu, site)
  am?: LoaiAm;
  nhan?: string;
}
export const FPS = 30, T_MO_MIN = 2.2, SO_DONG_MAX = 4;
const W = 1080, H = 1920, NUA = 960, TRANG = '#F4F6F8', NHAN = '#FCA311', XANH = '#3B82F6', CAM = '#F97316';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Mốc: mở (tiêu đề + tên hai bên) → từng cặp dòng (đứng đủ đọc hai vế, cộng dồn, dòng cũ giữ nguyên) → kết luận → kết. */
export function nhipSoSanh(de: DeSoSanh) {
  const n = Math.min(SO_DONG_MAX, Math.max(1, Math.min(de.trai.dong.length, de.phai.dong.length)));
  const T_MO = Math.max(T_MO_MIN, giayDoc(de.tieu_de, de.trai.ten, de.phai.ten));
  const tu: number[] = []; let t = T_MO;
  for (let i = 0; i < n; i++) { tu.push(t); t += Math.max(2.5, giayDoc(de.trai.dong[i]!, de.phai.dong[i]!)); }
  const T_KL = t, kl = de.ket_luan?.trim() ?? '', T_KET = kl ? T_KL + Math.max(2.5, giayDoc(kl)) : T_KL;
  const ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2), DAI = T_KET + (ket.length ? Math.max(2.5, giayDoc(...ket) - 1) : 0.8);
  return { T_MO, tu, n, T_KL, kl, T_KET, DAI, ket };
}
export const anhSoSanh = (de: DeSoSanh): { t: number; cat: [number, number, number, number] }[] => { const N = nhipSoSanh(de); return [{ t: N.tu[N.n - 1]! + 1, cat: [0, 240, 1080, 1440] }]; };
export const truyVanSoSanh = (de: DeSoSanh) => de.trai.truy;
export const truyVanThemSoSanh = (de: DeSoSanh) => [de.phai.truy];

export function assSoSanh(de: DeSoSanh): string {
  const N = nhipSoSanh(de), d: DongAss[] = [];
  // vạch chia giữa + nhãn tên hai bên đứng suốt video
  d.push([1, 0, N.DAI, 'Ve', `{\\an7\\pos(0,${NUA - 4})\\1c&HFFFFFF&\\p1}m 0 0 l ${W} 0 l ${W} 8 l 0 8`]);
  d.push([2, 0, N.DAI, 'Ve', `{\\an4\\pos(40,120)\\1c${mauAss(XANH)}\\p1}${bo(Math.min(900, 60 + 30 * de.trai.ten.length), 90, 20)}`]);
  d.push([3, 0, N.DAI, 'Den', `{\\an4\\pos(70,${120 + 4})${fs(44)}\\1c&HFFFFFF&}${chu(de.trai.ten)}`]);
  d.push([2, 0, N.DAI, 'Ve', `{\\an4\\pos(40,${NUA + 120})\\1c${mauAss(CAM)}\\p1}${bo(Math.min(900, 60 + 30 * de.phai.ten.length), 90, 20)}`]);
  d.push([3, 0, N.DAI, 'Den', `{\\an4\\pos(70,${NUA + 120 + 4})${fs(44)}\\1c&HFFFFFF&}${chu(de.phai.ten)}`]);
  // màn mở: tiêu đề giữa vạch chia
  const dongT = ngat(de.tieu_de, 22).slice(0, 3);
  d.push([4, 0, N.T_MO, 'Ve', `{\\an5\\pos(540,${NUA - 240})\\1c&H000000&\\1a${alpha(0.55)}\\fad(200,250)\\p1}${bo(1000, 110 + 90 * dongT.length, 28)}`]);
  d.push([5, 0, N.T_MO, 'Den', `{\\an5\\pos(540,${NUA - 240})${fs(68)}\\1c&HFFFFFF&\\3c&H000000&\\bord2\\q2\\fad(200,250)}${dongT.map(chu).join('\\N')}`]);
  // từng cặp dòng: mỗi bên một dải tối ở phần dưới nửa mình, dòng mới thêm vào dưới dòng cũ, giữ tới hết
  for (let i = 0; i < N.n; i++) {
    const t0 = N.tu[i]!, den = N.DAI;
    for (const [ben, goc] of [[de.trai, 0], [de.phai, NUA]] as const) {
      const dong = ngat(ben.dong[i]!, 34).slice(0, 2), y = goc + 280 + i * 140;
      d.push([6, t0, den, 'Ve', `{\\an7\\pos(40,${y})\\1c&H000000&\\1a${alpha(0.55)}\\fad(200,0)\\p1}${bo(1000, 44 + 60 * dong.length, 18)}`]);
      d.push([7, t0, den, 'Chu', `{\\an7\\pos(70,${y + 20})\\b1${fs(42)}\\1c${mauAss(TRANG)}\\fad(200,0)}${dong.map(chu).join('\\N')}`]);
    }
  }
  if (N.kl) {
    const dongK = ngat(N.kl, 30).slice(0, 2);
    d.push([8, N.T_KL, N.DAI, 'Ve', `{\\an5\\pos(540,1790)\\1c${mauAss(NHAN)}\\fad(200,0)\\p1}${bo(1000, 90 + 70 * dongK.length, 28)}`]);
    d.push([9, N.T_KL, N.DAI, 'Den', `{\\an5\\pos(540,1794)${fs(52)}\\1c&H111111&\\q2\\fad(200,0)}${dongK.map(chu).join('\\N')}`]);
  }
  if (N.ket.length) {
    d.push([10, N.T_KET, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.62)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([11, N.T_KET, N.DAI, 'Den', `{\\an5\\pos(540,900)${fs(60)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(300,0)}${chu(N.ket[0]!)}`]);
    if (N.ket[1]) d.push([11, N.T_KET, N.DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&\\fad(300,0)}${chu(N.ket[1])}`]);
  }
  if (de.nhan) d.push([3, 0, N.DAI, 'Chu', `{\\an9\\pos(1040,40)\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  return rapAss(W, H, d);
}
/** Lệnh ffmpeg: hai ảnh thật, mỗi ảnh cắt 1080×960 lia chậm, xếp trên/dưới, ass, tiếng thật. Thiếu ảnh Y thì dùng lại ảnh X (không bao giờ trống). */
export function lenhSoSanh(o: { de: DeSoSanh; ass: string; nen?: string | null; nenThem?: string[]; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const N = nhipSoSanh(o.de), dai = Number(N.DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu so sánh cần ảnh nền thật (nen_url)');
  const anh = [o.nen, o.nenThem?.[0] ?? o.nen], vao: string[] = [], f: string[] = [];
  anh.forEach((a, i) => { vao.push('-loop', '1', '-framerate', String(FPS), '-t', String(dai), '-i', a);
    f.push(`[${i}:v]scale=${Math.round(W * 1.12)}:${Math.round(NUA * 1.12)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.12)}:${Math.round(NUA * 1.12)},zoompan=z='1+0.08*on/${Math.round(dai * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${NUA}:fps=${FPS},eq=brightness=-0.03,setsar=1[v${i}]`); });
  f.push(`[v0][v1]vstack=inputs=2,trim=0:${dai},setpts=PTS-STARTPTS,ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`);
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', f.join(';'), '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const amVao = o.am ? ['-stream_loop', '-1', '-i', o.am] : ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, ...amVao, '-filter_complex', `${f.join(';')};${locAmChuoi(dai).replace('[A]', '[2:a]')}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}
export function kichBanSoSanh(de: DeSoSanh) {
  const N = nhipSoSanh(de);
  return { tom_tat: `So sánh · ${de.tieu_de}`, shots: [{ tu: 0, den: N.T_MO, canh: 'Mở', hanh_dong: `Chia đôi màn: "${de.trai.ten}" (ảnh "${de.trai.truy}") trên, "${de.phai.ten}" (ảnh "${de.phai.truy}") dưới; tiêu đề "${de.tieu_de}"` },
    ...Array.from({ length: N.n }, (_, i) => ({ tu: N.tu[i]!, den: i + 1 < N.n ? N.tu[i + 1]! : N.T_KL, canh: `Cặp ${i + 1}`, hanh_dong: `${de.trai.dong[i]} ↔ ${de.phai.dong[i]}` })),
    ...(N.kl ? [{ tu: N.T_KL, den: N.T_KET, canh: 'Kết luận', hanh_dong: N.kl }] : []), ...(N.ket.length ? [{ tu: N.T_KET, den: N.DAI, canh: 'Kết', hanh_dong: N.ket.join(' / ') }] : [])] };
}
