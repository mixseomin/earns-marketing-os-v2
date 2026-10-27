// MẪU MÁY DỰNG "Cái nào giả?" (dạng spot-the-fake trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 27/10/2026). MẪU CHUNG mọi ngách có lừa đảo /
// hàng nhái: HAI MẪU (tin nhắn, tin rao, đánh giá, email, trang thanh toán…) dựng lại bằng chữ trong hai thẻ A / B trên một cảnh thật làm mờ, một thật một
// giả → đếm 7s → lộ: dấu FAKE đỏ trên thẻ giả + REAL xanh trên thẻ thật, khoanh các dòng có dấu hiệu (đánh số) + lý do bên dưới → kết. THUẦN: đề → ASS +
// lệnh ffmpeg, 0đ. Tên người gửi / thương hiệu trong đề là tên BỊA, không dùng thương hiệu thật. Nhịp theo luật đọc (giayDoc): mở đủ đọc hai thẻ,
// lý do đứng đủ đọc. Khác mẫu Scam or Real (một mẫu, khung tin nhắn theo kênh): ở đây hai mẫu đối nhau nên người xem SO sánh, không chỉ đoán.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-gia.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, nhipDem, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
import { chuoiAnh, locAmChuoi } from './may-dung-chuoi';
import type { LoaiAm } from './am-nen';

export interface MauGia { gui: string; dong: { t: string; co?: number }[] }   // gui = đầu thẻ (người gửi / tên shop / tiêu đề); dong = các dòng, co = số dấu hiệu khoanh lúc lộ (chỉ ở thẻ giả)
export interface DeGia {
  tieu_de: string;         // "Two hotel confirmation emails. One is fake."
  loai: string;            // nhãn loại mẫu hiện trên hai thẻ: "Email", "Listing", "Review", "Text message", "Checkout page"
  a: MauGia; b: MauGia;
  gia: 'a' | 'b';          // thẻ nào giả
  ly_do: string[];         // 1–3 lý do theo số dấu hiệu (co = 1, 2, 3)
  truy: string;            // ảnh thật nền (làm tối, mờ nhẹ)
  ket?: string[];
  am?: LoaiAm;
  nhan?: string;
}
export const FPS = 30, DEM = 7, T_MO_MIN = 3, SO_DONG_MAX = 5;
const W = 1080, H = 1920, TRANG = '#F4F6F8', NHAN = '#FCA311', DO = '#EF4444', XANH = '#22C55E', THE = '#FFFFFF', CHU = '#111111';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;
const KHUNG = { x: 60, w: 960, cao: 620, yA: 300, yB: 1000 } as const;   // hai thẻ cao bằng nhau, cách 80

/** Mốc: mở (tiêu đề + hai thẻ, đủ đọc cả hai) → đếm 7s → lộ (dấu + khoanh + lý do, đủ đọc) → kết. */
export function nhipGia(de: DeGia) {
  const docThe = (m: MauGia) => m.dong.slice(0, SO_DONG_MAX).map((d) => d.t).join(' ');
  const T_DEM = Math.max(T_MO_MIN, giayDoc(de.tieu_de, docThe(de.a), docThe(de.b)) - 1), T_LO = T_DEM + DEM;
  const lyDo = de.ly_do.filter((x) => x.trim()).slice(0, 3), T_KET = T_LO + Math.max(3, giayDoc('FAKE', ...lyDo));
  const ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2), DAI = T_KET + (ket.length ? Math.max(2.5, giayDoc(...ket) - 1) : 0.8);
  return { T_DEM, T_LO, T_KET, DAI, lyDo, ket };
}
/** Ảnh tĩnh: câu đố (hai thẻ, chưa lộ) và đáp án (đã lộ). */
export const anhGia = (de: DeGia): { t: number; cat: [number, number, number, number] }[] => { const N = nhipGia(de); return [{ t: N.T_DEM + 1, cat: [0, 200, 1080, 1440] }, { t: N.T_LO + (N.T_KET - N.T_LO) * 0.7, cat: [0, 200, 1080, 1440] }]; };
export const truyVanGia = (de: DeGia) => de.truy;

function the(d: DongAss[], m: MauGia, y: number, nhan: string, loai: string, tu: number, den: number, lo: { gia: boolean; T_LO: number; T_END: number } | null) {
  const dong = m.dong.slice(0, SO_DONG_MAX), tuDong = (KHUNG.cao - 150) / SO_DONG_MAX;
  d.push([2, tu, den, 'Ve', `{\\an7\\pos(${KHUNG.x},${y})\\1c${mauAss(THE)}\\fad(200,0)\\p1}${bo(KHUNG.w, KHUNG.cao, 26)}`]);
  d.push([3, tu, den, 'Ve', `{\\an7\\pos(${KHUNG.x},${y})\\1c&H222222&\\fad(200,0)\\p1}${bo(KHUNG.w, 92, 26)}`]);
  d.push([4, tu, den, 'Den', `{\\an4\\pos(${KHUNG.x + 30},${y + 46})${fs(44)}\\1c&HFFFFFF&\\fad(200,0)}${nhan}`]);
  d.push([4, tu, den, 'Chu', `{\\an6\\pos(${KHUNG.x + KHUNG.w - 30},${y + 46})\\b1${fs(28)}\\1c${mauAss(NHAN)}\\fad(200,0)}${chu(loai)}`]);
  d.push([4, tu, den, 'Chu', `{\\an7\\pos(${KHUNG.x + 30},${y + 112})\\b1${fs(32)}\\1c&H555555&\\fad(200,0)}${chu(m.gui)}`]);
  dong.forEach((x, i) => {
    const yD = y + 165 + i * tuDong, dongChu = ngat(x.t, 44).slice(0, 2);
    d.push([4, tu, den, 'Chu', `{\\an7\\pos(${KHUNG.x + 30},${yD})\\b1${fs(30)}\\1c${mauAss(CHU)}\\fad(200,0)}${dongChu.map(chu).join('\\N')}`]);
    if (lo && lo.gia && x.co) {
      d.push([6, lo.T_LO + 0.15 * x.co, lo.T_END, 'Ve', `{\\an7\\pos(${KHUNG.x + 14},${yD - 10})\\1c${mauAss(DO)}\\3c${mauAss(DO)}\\bord4\\1a&HFF&\\fad(150,0)\\p1}${bo(KHUNG.w - 28, 42 * dongChu.length + 16, 12)}`]);
      d.push([7, lo.T_LO + 0.15 * x.co, lo.T_END, 'Den', `{\\an5\\pos(${KHUNG.x + KHUNG.w - 36},${yD + 12})${fs(30)}\\1c&HFFFFFF&\\3c${mauAss(DO)}\\bord10\\fad(150,0)}${x.co}`]);
    }
  });
  if (lo) {
    const mau = lo.gia ? DO : XANH, text = lo.gia ? 'FAKE' : 'REAL';
    d.push([8, lo.T_LO, lo.T_END, 'Ve', `{\\an5\\pos(${KHUNG.x + KHUNG.w - 170},${y + KHUNG.cao - 70})\\1c${mauAss(mau)}\\frz-8\\fad(100,0)\\p1}${bo(260, 90, 16)}`]);
    d.push([9, lo.T_LO, lo.T_END, 'Den', `{\\an5\\pos(${KHUNG.x + KHUNG.w - 170},${y + KHUNG.cao - 66})${fs(56)}\\1c&HFFFFFF&\\frz-8\\fad(100,0)}${text}`]);
  }
}
export function assGia(de: DeGia): string {
  const N = nhipGia(de), d: DongAss[] = [];
  d.push([1, 0, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.55)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([5, 0, N.T_LO, 'Den', `{\\an5\\pos(540,170)${fs(52)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(200,0)}${ngat(de.tieu_de, 30).slice(0, 2).map(chu).join('\\N')}`]);
  d.push([5, N.T_LO, N.DAI, 'Den', `{\\an5\\pos(540,170)${fs(52)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord3\\fad(150,0)}${de.gia === 'a' ? 'A is the fake' : 'B is the fake'}`]);
  the(d, de.a, KHUNG.yA, 'A', de.loai, 0, N.DAI, { gia: de.gia === 'a', T_LO: N.T_LO, T_END: N.DAI });
  the(d, de.b, KHUNG.yB, 'B', de.loai, 0, N.DAI, { gia: de.gia === 'b', T_LO: N.T_LO, T_END: N.DAI });
  // đếm 7 → 1 ở đáy
  d.push([5, N.T_DEM, N.T_LO, 'Chu', `{\\an5\\pos(540,1690)\\b1${fs(34)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2}Which one is fake?`]);
  for (let k = 0; k < DEM; k++) d.push([5, N.T_DEM + k, N.T_DEM + k + 1, 'Den', `{\\an5\\pos(540,1800)${fs(110)}\\1c&HFFFFFF&\\3c&H000000&\\bord4${nhipDem(1)}}${DEM - k}`]);
  // lý do dưới hai thẻ sau khi lộ
  const yLy = 1660, caoLy = 50 + 46 * N.lyDo.length;
  if (N.lyDo.length) {
    d.push([6, N.T_LO + 0.2, N.DAI, 'Ve', `{\\an8\\pos(540,${yLy})\\1c&H000000&\\1a${alpha(0.65)}\\fad(200,0)\\p1}${bo(1000, caoLy, 20)}`]);
    N.lyDo.forEach((l, i) => d.push([7, N.T_LO + 0.2 + 0.15 * i, N.DAI, 'Chu', `{\\an7\\pos(70,${yLy + 22 + 46 * i})\\b1${fs(Math.min(30, Math.floor(30 * 50 / Math.max(1, l.length + 3))))}\\1c${mauAss(TRANG)}\\fad(200,0)}${i + 1}. ${chu(l)}`]));
  }
  if (N.ket.length) {
    d.push([10, N.T_KET, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.72)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([11, N.T_KET, N.DAI, 'Den', `{\\an5\\pos(540,900)${fs(60)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(300,0)}${chu(N.ket[0]!)}`]);
    if (N.ket[1]) d.push([11, N.T_KET, N.DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&\\fad(300,0)}${chu(N.ket[1])}`]);
  }
  if (de.nhan) d.push([5, 0, N.DAI, 'Chu', `{\\an7\\pos(40,40)\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  return rapAss(W, H, d);
}
/** Lệnh ffmpeg: một ảnh thật lia chậm + làm mờ nhẹ (hai thẻ chữ là nhân vật chính), ass, tiếng thật. */
export function lenhGia(o: { de: DeGia; ass: string; nen?: string | null; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const N = nhipGia(o.de), dai = Number(N.DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu cái nào giả cần ảnh nền thật (nen_url)');
  const c = chuoiAnh([{ anh: o.nen, tu: 0, den: dai }], { W, H, dai, fps: FPS }), f = [...c.loc, `[vx]gblur=sigma=6,ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`];
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, '-filter_complex', f.join(';'), '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const amVao = o.am ? ['-stream_loop', '-1', '-i', o.am] : ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, ...amVao, '-filter_complex', `${f.join(';')};${locAmChuoi(dai).replace('[A]', `[${c.soVao}:a]`)}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}
export function kichBanGia(de: DeGia) {
  const N = nhipGia(de);
  return { tom_tat: `Cái nào giả · ${de.tieu_de}`, shots: [{ tu: 0, den: N.T_DEM, canh: 'Hai thẻ', hanh_dong: `"${de.tieu_de}" — thẻ A "${de.a.gui}", thẻ B "${de.b.gui}" (${de.loai}) trên ảnh thật "${de.truy}" làm mờ` },
    { tu: N.T_DEM, den: N.T_LO, canh: 'Đếm', hanh_dong: '7 → 1' }, { tu: N.T_LO, den: N.T_KET, canh: 'Lộ', hanh_dong: `${de.gia.toUpperCase()} giả: ${N.lyDo.join(' · ')}` },
    ...(N.ket.length ? [{ tu: N.T_KET, den: N.DAI, canh: 'Kết', hanh_dong: N.ket.join(' / ') }] : [])] };
}
