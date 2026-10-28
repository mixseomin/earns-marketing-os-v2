// MẪU MÁY DỰNG "Carousel mỗi trang một ý" (dạng carousel trong kho dạng bài — bước 4 Dạng × Góc × Sản phẩm, 28/10/2026). MẪU CHUNG mọi ngách, CHỈ ẢNH 4:5:
// trang 1 = câu móc to trên ảnh thật; trang 2…N−1 = mỗi trang một ý (số trang, tiêu đề ý, 1–2 dòng); trang cuối = chốt + thương hiệu/site. Mỗi trang một ảnh thật
// riêng (nen_url = trang 1, nen_them = các trang sau — may.ts lấy Pexels theo `truy` từng trang). Đăng được ở IG carousel / FB album / TikTok bài ảnh / X (≤ 4 ảnh).
// THUẦN: đề → ASS (mỗi trang một mốc giây t = i + 0,5) + lệnh ffmpeg cắt MỘT khung ở trang `khung`.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-carousel.test.mts
import { alpha, bo, chu, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export interface TrangCarousel { tieu_de: string; chu?: string; truy: string }
export interface DeCarousel {
  moc: string;                 // câu móc trang 1 ("5 things the hotel desk won't tell you")
  truy: string;                // ảnh trang 1
  trang: TrangCarousel[];      // 3–5 trang ý
  ket: string;                 // chốt trang cuối ("Save this before your next booking")
  nhan?: string;               // thương hiệu / site trang cuối + góc mỗi trang
}
export const W = 1080, H = 1350, TRANG_Y_MIN = 3, TRANG_Y_MAX = 5;
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`, TRANG = '#F4F6F8', NHAN = '#FCA311', SAU = '#0B1D33';

/** Danh sách trang đủ: [móc, ...ý (3–5), kết] — số trang 5–7. */
export function trangCarousel(de: DeCarousel) {
  const y = de.trang.slice(0, TRANG_Y_MAX);
  return { y, n: y.length + 2 };
}
const khungTrang = (i: number) => i + 0.5;
/** Ảnh xuất: một JPG mỗi trang (máy chiAnh dựng lần lượt). */
export const anhCarousel = (de: DeCarousel): { t: number; cat: [number, number, number, number] }[] => Array.from({ length: trangCarousel(de).n }, (_, i) => ({ t: khungTrang(i), cat: [0, 0, W, H] }));
export const truyVanCarousel = (de: DeCarousel) => de.truy;
/** Ảnh trang sau: mỗi trang ý một ảnh; trang cuối dùng lại ảnh trang 1 (không tìm thêm). */
export const truyVanThemCarousel = (de: DeCarousel) => trangCarousel(de).y.map((t) => t.truy);

export function assCarousel(de: DeCarousel): string {
  const { y, n } = trangCarousel(de), d: DongAss[] = [];
  const goc = (i: number) => { if (de.nhan) d.push([5, i, i + 1, 'Chu', `{\\an7\\pos(40,36)\\b1${fs(24)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
    d.push([5, i, i + 1, 'Chu', `{\\an9\\pos(1040,36)\\b1${fs(24)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2}${i + 1}/${n}`]); };
  // trang 1: phủ tối, móc to giữa, mũi tên vuốt
  d.push([1, 0, 1, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.5)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  const dongM = ngat(de.moc, 18).slice(0, 4), coM = dongM.length >= 4 ? 70 : 84;
  d.push([2, 0, 1, 'Den', `{\\an5\\pos(540,620)${fs(coM)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2}${dongM.map(chu).join('\\N')}`]);
  d.push([2, 0, 1, 'Chu', `{\\an5\\pos(540,1200)\\b1${fs(36)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2}Swipe →`]); goc(0);
  // trang ý: dải tối đáy, số lớn tròn, tiêu đề + dòng
  y.forEach((t, k) => {
    const i = k + 1, ten = ngat(t.tieu_de, 26).slice(0, 2), dong = t.chu ? ngat(t.chu, 40).slice(0, 3) : [], cao = 150 + 76 * ten.length + 50 * dong.length;
    d.push([1, i, i + 1, 'Ve', `{\\an2\\pos(540,1310)\\1c&H000000&\\1a${alpha(0.6)}\\p1}${bo(1000, cao, 28)}`]);
    d.push([2, i, i + 1, 'Ve', `{\\an5\\pos(130,${1310 - cao + 80})\\1c${mauAss(NHAN)}\\p1}${bo(110, 110, 55)}`]);
    d.push([3, i, i + 1, 'Den', `{\\an5\\pos(130,${1310 - cao + 84})${fs(64)}\\1c${mauAss(SAU)}}${k + 1}`]);
    let yy = 1310 - cao + 40;
    d.push([3, i, i + 1, 'Den', `{\\an7\\pos(210,${yy})${fs(50)}\\1c&HFFFFFF&}${ten.map(chu).join('\\N')}`]); yy += 76 * ten.length + 14;
    if (dong.length) d.push([3, i, i + 1, 'Chu', `{\\an7\\pos(80,${Math.max(yy, 1310 - cao + 150)})\\b1${fs(32)}\\1c${mauAss(TRANG)}\\1a&H20&}${dong.map(chu).join('\\N')}`]);
    goc(i);
  });
  // trang cuối: phủ tối đậm, chốt + thương hiệu
  const c = n - 1;
  d.push([1, c, c + 1, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.66)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([2, c, c + 1, 'Den', `{\\an5\\pos(540,600)${fs(70)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2}${ngat(de.ket, 22).slice(0, 3).map(chu).join('\\N')}`]);
  if (de.nhan) d.push([2, c, c + 1, 'Chu', `{\\an5\\pos(540,820)\\b1${fs(44)}\\1c${mauAss(NHAN)}}${chu(de.nhan)}`]);
  d.push([5, c, c + 1, 'Chu', `{\\an9\\pos(1040,36)\\b1${fs(24)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2}${n}/${n}`]);
  return rapAss(W, H, d);
}
/** Lệnh ffmpeg: ảnh của trang (khung → chỉ số trang) phủ kín 4:5, ass, MỘT khung JPG. Trang cuối dùng ảnh trang 1; thiếu ảnh thêm thì dùng ảnh trang 1. */
export function lenhCarousel(o: { de: DeCarousel; ass: string; nen?: string | null; nenThem?: string[]; fontsDir: string; ra: string; khung?: number }): string[] {
  if (!o.nen) throw new Error('mẫu carousel cần ảnh nền thật (nen_url)');
  const { n } = trangCarousel(o.de), i = Math.min(n - 1, Math.max(0, Math.floor(o.khung ?? 0.5)));
  const anh = i === 0 || i === n - 1 ? o.nen : o.nenThem?.[i - 1] ?? o.nen;
  const loc = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},eq=brightness=-0.03,setpts=PTS+${i}/TB,ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  return ['-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '2', '-t', '1', '-i', anh, '-filter_complex', loc, '-map', '[v]', '-frames:v', '1', '-q:v', '2', o.ra];
}
export const kichBanCarousel = (de: DeCarousel) => {
  const { y, n } = trangCarousel(de);
  return { tom_tat: `Carousel ${n} trang · ${de.moc}`, shots: [{ tu: 0, den: 1, canh: 'Trang 1', hanh_dong: `Móc "${de.moc}" trên ảnh "${de.truy}"` }, ...y.map((t, k) => ({ tu: k + 1, den: k + 2, canh: `Trang ${k + 2}`, hanh_dong: `${k + 1}. ${t.tieu_de} — ${t.chu ?? ''} (ảnh "${t.truy}")` })), { tu: n - 1, den: n, canh: `Trang ${n}`, hanh_dong: `Chốt "${de.ket}"` }] };
};
