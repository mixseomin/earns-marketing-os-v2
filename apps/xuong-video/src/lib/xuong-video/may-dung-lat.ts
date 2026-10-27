// MẪU MÁY DỰNG "Lật đáp án" — một mẫu, HAI dạng trong kho dạng bài (bước 3 Dạng × Góc × Sản phẩm, 27/10/2026):
//   lam-tuong  = 1 câu khẳng định to → đếm 3s → lật MYTH / FACT + 1 lý do, cảnh thật nền
//   dung-sai   = 3 câu liên tiếp, mỗi câu lật TRUE / FALSE + lý do ngắn, màn cuối "Bạn được mấy / 3?"
// MẪU CHUNG mọi ngách: đề = 1–3 câu (khẳng định · đúng/sai · lý do · từ khoá ảnh riêng). Mỗi câu một ẢNH THẬT (nen_url + nen_them qua may-dung-chuoi),
// tiếng nền thu thật. THUẦN: đề → ASS + lệnh ffmpeg. Nhịp theo luật đọc (giayDoc): câu đứng đủ đọc, đếm 3s, đáp án + lý do đứng đủ đọc.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-lat.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, nhipDem, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
import { anhTheoMuc, chuoiAnh, locAmChuoi, type DoanAnh } from './may-dung-chuoi';
import type { LoaiAm } from './am-nen';

export type KieuLat = 'lam-tuong' | 'dung-sai';
export interface CauLat { khang_dinh: string; dung: boolean; ly_do: string; truy: string }
export interface DeLat {
  kieu: KieuLat;
  cau: CauLat[];           // lam-tuong: 1 câu (lấy câu đầu); dung-sai: 2–3 câu
  tieu_de?: string;        // dung-sai: màn mở ngắn ("3 hotel booking facts. True or false?"); lam-tuong: không có màn mở
  ket?: string[];          // 1–2 dòng kết (thương hiệu, site)
  am?: LoaiAm;
  nhan?: string;
}
export const FPS = 30, T_DEM = 3, T_MO_MIN = 2.2;
const W = 1080, H = 1920, TRANG = '#F4F6F8', NHAN = '#FCA311', DUNG = '#22C55E', SAI = '#EF4444', SAU = '#0B1D33';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;
/** Nhãn lật theo dạng: lầm tưởng = MYTH/FACT (khẳng định sai = lầm tưởng), đúng-sai = TRUE/FALSE. */
export const nhanLat = (kieu: KieuLat, dung: boolean) => (kieu === 'lam-tuong' ? (dung ? 'FACT' : 'MYTH') : dung ? 'TRUE' : 'FALSE');
export const soCau = (de: DeLat) => (de.kieu === 'lam-tuong' ? 1 : Math.min(3, Math.max(1, de.cau.length)));

/** Mốc: [mở nếu có tiêu đề] → mỗi câu: đọc câu (giayDoc) → đếm 3s → lật (giayDoc nhãn + lý do) → [kết: điểm (dung-sai ≥ 2 câu) / dòng kết]. */
export function nhipLat(de: DeLat) {
  const cau = de.cau.slice(0, soCau(de)), coMo = !!de.tieu_de?.trim() && de.kieu === 'dung-sai';
  const T_MO = coMo ? Math.max(T_MO_MIN, giayDoc(de.tieu_de!)) : 0;
  let t = T_MO; const moc = cau.map((c) => { const doc = t, dem = doc + Math.max(2, giayDoc(c.khang_dinh) - 0.5), lat = dem + T_DEM, het = lat + Math.max(2.5, giayDoc(c.ly_do)); t = het; return { doc, dem, lat, het }; });
  const T_KET = t, ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2), diem = de.kieu === 'dung-sai' && cau.length >= 2;
  const DAI = T_KET + (diem ? 3 : 0) + (ket.length ? Math.max(2.5, giayDoc(...ket) - 1) : diem ? 0 : 0.8);
  return { T_MO, moc, T_KET, T_DIEM: diem ? T_KET + 3 : T_KET, DAI, cau, ket, diem, n: cau.length };
}
export const anhLat = (de: DeLat): { t: number; cat: [number, number, number, number] }[] => { const N = nhipLat(de); return [{ t: N.moc[0]!.doc + 0.6, cat: [0, 240, 1080, 1440] }]; };
export const truyVanLat = (de: DeLat) => de.cau[0]?.truy ?? '';
export const truyVanThemLat = (de: DeLat) => de.cau.slice(1, soCau(de)).map((c) => c.truy);

export function assLat(de: DeLat): string {
  const N = nhipLat(de), d: DongAss[] = [], tong = N.n;
  if (N.T_MO > 0) {
    d.push([1, 0, N.T_MO, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.45)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([2, 0, N.T_MO, 'Den', `{\\an5\\pos(540,900)${fs(78)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(200,250)}${ngat(de.tieu_de!, 20).slice(0, 3).map(chu).join('\\N')}`]);
  }
  N.cau.forEach((c, i) => {
    const m = N.moc[i]!, dongK = ngat(c.khang_dinh, 22).slice(0, 4), co = dongK.length >= 4 ? 60 : dongK.length === 3 ? 68 : 76;
    // khẳng định to giữa màn, đứng suốt câu (đọc + đếm + lật); nhãn "1/3" ở góc khi nhiều câu
    d.push([1, m.doc, m.het, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.4)}\\fad(250,250)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([2, m.doc, m.het, 'Den', `{\\an5\\pos(540,760)${fs(co)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(250,250)}${dongK.map(chu).join('\\N')}`]);
    if (tong > 1) d.push([2, m.doc, m.het, 'Chu', `{\\an9\\pos(1040,40)\\b1${fs(30)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2}${i + 1}/${tong}`]);
    if (de.kieu === 'lam-tuong') d.push([2, m.doc, m.dem + T_DEM, 'Chu', `{\\an5\\pos(540,1120)\\b1${fs(40)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2\\fad(250,0)}Myth or fact?`]);
    else d.push([2, m.doc, m.dem + T_DEM, 'Chu', `{\\an5\\pos(540,1120)\\b1${fs(40)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2\\fad(250,0)}True or false?`]);
    // đếm 3 · 2 · 1 (mỗi số 1s, nảy ở cuối)
    for (let k = 0; k < T_DEM; k++) d.push([3, m.dem + k, m.dem + k + 1, 'Den', `{\\an5\\pos(540,1320)${fs(120)}\\1c&HFFFFFF&\\3c&H000000&\\bord4${nhipDem(1)}}${T_DEM - k}`]);
    // lật: thẻ màu + nhãn + lý do
    const nhan = nhanLat(de.kieu, c.dung), mau = c.dung ? DUNG : SAI, dongL = ngat(c.ly_do, 34).slice(0, 3), cao = 150 + 52 * dongL.length;
    d.push([4, m.lat, m.het, 'Ve', `{\\an5\\pos(540,${1320})\\1c${mauAss(mau)}\\fad(150,250)\\p1}${bo(560, 120, 60)}`]);
    d.push([5, m.lat, m.het, 'Den', `{\\an5\\pos(540,${1320 + 4})${fs(64)}\\1c&HFFFFFF&\\fad(150,250)}${nhan}`]);
    d.push([4, m.lat + 0.2, m.het, 'Ve', `{\\an8\\pos(540,${1420})\\1c&H000000&\\1a${alpha(0.55)}\\fad(200,250)\\p1}${bo(1000, cao - 110, 24)}`]);
    d.push([5, m.lat + 0.2, m.het, 'Chu', `{\\an8\\pos(540,${1450})\\b1${fs(38)}\\1c${mauAss(TRANG)}\\q2\\fad(200,250)}${dongL.map(chu).join('\\N')}`]);
  });
  if (N.diem) {
    d.push([6, N.T_KET, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.5)}\\fad(300,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([7, N.T_KET, N.T_DIEM + (N.ket.length ? 0 : 0), 'Den', `{\\an5\\pos(540,820)${fs(72)}\\1c&HFFFFFF&\\q2\\fad(300,200)}How many did you get?`]);
    d.push([7, N.T_KET, N.T_DIEM, 'Chu', `{\\an5\\pos(540,980)\\b1${fs(44)}\\1c${mauAss(NHAN)}\\fad(300,200)}Tell us in the comments: 0, 1, 2 or ${tong}`]);
  }
  if (N.ket.length) {
    const t0 = N.T_DIEM;
    if (!N.diem) d.push([6, t0, N.DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.5)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([7, t0, N.DAI, 'Den', `{\\an5\\pos(540,900)${fs(64)}\\1c&HFFFFFF&\\q2\\fad(300,0)}${chu(N.ket[0]!)}`]);
    if (N.ket[1]) d.push([7, t0, N.DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\1a&H30&\\fad(300,0)}${chu(N.ket[1])}`]);
  }
  if (de.nhan) d.push([2, 0, N.DAI, 'Chu', `{\\an7\\pos(40,40)\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  return rapAss(W, H, d);
}
/** Lệnh ffmpeg: mỗi câu một ảnh thật (màn mở + kết dùng ảnh câu đầu / cuối), chồng mờ, ass, tiếng thật. `khung` = một khung JPG. */
export function lenhLat(o: { de: DeLat; ass: string; nen?: string | null; nenThem?: string[]; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const N = nhipLat(o.de), dai = Number(N.DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu lật đáp án cần ảnh nền thật (nen_url)');
  const anh = anhTheoMuc(N.n, o.nen, o.nenThem);
  const doan: DoanAnh[] = [...(N.T_MO > 0 ? [{ anh: anh[0]!, tu: 0, den: N.T_MO }] : []), ...N.cau.map((_, i) => ({ anh: anh[i]!, tu: N.moc[i]!.doc, den: N.moc[i]!.het })), ...(N.DAI > N.T_KET + 1 ? [{ anh: anh[N.n - 1]!, tu: N.T_KET, den: N.DAI }] : [])];
  const c = chuoiAnh(doan, { W, H, dai, fps: FPS }), f = [...c.loc, `[vx]ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`];
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, '-filter_complex', f.join(';'), '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const amVao = o.am ? ['-stream_loop', '-1', '-i', o.am] : ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...c.vao, ...amVao, '-filter_complex', `${f.join(';')};${locAmChuoi(dai).replace('[A]', `[${c.soVao}:a]`)}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}
export function kichBanLat(de: DeLat) {
  const N = nhipLat(de);
  return { tom_tat: `${de.kieu === 'lam-tuong' ? 'Lầm tưởng' : 'Đúng/Sai'} · ${N.cau.map((c) => c.khang_dinh).join(' | ').slice(0, 80)}`, shots: [
    ...(N.T_MO > 0 ? [{ tu: 0, den: N.T_MO, canh: 'Mở', hanh_dong: `Tiêu đề "${de.tieu_de}"` }] : []),
    ...N.cau.flatMap((c, i) => { const m = N.moc[i]!; return [{ tu: m.doc, den: m.dem, canh: `Câu ${i + 1}`, hanh_dong: `Ảnh thật "${c.truy}", khẳng định "${c.khang_dinh}"` }, { tu: m.dem, den: m.lat, canh: `Đếm ${i + 1}`, hanh_dong: '3 · 2 · 1' }, { tu: m.lat, den: m.het, canh: `Lật ${i + 1}`, hanh_dong: `${nhanLat(de.kieu, c.dung)} — ${c.ly_do}` }]; }),
    ...(N.diem ? [{ tu: N.T_KET, den: N.T_DIEM, canh: 'Điểm', hanh_dong: `Bạn được mấy / ${N.n}?` }] : []),
    ...(N.ket.length ? [{ tu: N.T_DIEM, den: N.DAI, canh: 'Kết', hanh_dong: N.ket.join(' / ') }] : [])] };
}
