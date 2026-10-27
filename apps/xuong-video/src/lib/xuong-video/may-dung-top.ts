// MẪU MÁY DỰNG "Top 3/5 đếm ngược" (dạng top-n trong kho dạng bài — bước 3 Dạng × Góc × Sản phẩm, 27/10/2026). MẪU CHUNG mọi ngách:
// đề = tiêu đề danh sách + 3–5 mục (tên, một dòng, từ khoá ảnh riêng). Mỗi mục một ẢNH THẬT (nen_url cho mục đầu tiên trong đề, nen_them cho các
// mục sau — may.ts tự lấy Pexels theo `truy` của từng mục), lia máy chậm, chồng mờ giữa các mục, số lớn đếm ngược N → 1, mục 1 giữ lâu nhất,
// tiếng nền thu thật (am-nen.ts). THUẦN: đề → ASS + lệnh ffmpeg. Nhịp theo luật đọc (giayDoc): mỗi mục đứng đủ thời gian đọc tên + dòng.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-top.test.mts
import { alpha, bo, chu, giayDoc, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';
import type { LoaiAm } from './am-nen';

export interface MucTop { ten: string; chu?: string; truy: string }
export interface DeTop {
  tieu_de: string;         // "5 countries where $50 a day feels rich" — có con số N
  muc: MucTop[];           // 3–5 mục, THỨ TỰ TRONG ĐỀ = N → 1 (mục cuối mảng là #1)
  moc?: string;            // câu móc nhỏ ở màn mở (dưới tiêu đề), tuỳ chọn
  ket?: string[];          // 1–2 dòng kết (thương hiệu, site)
  am?: LoaiAm;             // tiếng nền (am-nen.json); mặc định 'pho'
  nhan?: string;           // nhãn nhỏ góc trên
}
export const FPS = 30, T_MO_MIN = 2.2, XF = 0.5, GIU_1 = 1.2;
const W = 1080, H = 1920, TRANG = '#F4F6F8', NHAN = '#FCA311', SAU = '#0B1D33';
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`;

/** Mốc theo đề: mở (tiêu đề + móc) → từng mục đứng đủ giayDoc(tên, dòng) (+ GIU_1 ở mục #1) → kết. Trả mốc từng mục để ASS và ffmpeg cùng đọc. */
export function nhipTop(de: DeTop) {
  const muc = de.muc.slice(0, 5), T_MO = Math.max(T_MO_MIN, giayDoc(de.tieu_de, de.moc ?? ''));
  const tu: number[] = []; let t = T_MO;
  for (const [i, m] of muc.entries()) { tu.push(t); t += Math.max(2.5, giayDoc(m.ten, m.chu ?? '')) + (i === muc.length - 1 ? GIU_1 : 0); }
  const T_KET = t, ket = (de.ket ?? []).filter((x) => x.trim()).slice(0, 2), DAI = T_KET + (ket.length ? Math.max(2.5, giayDoc(...ket) - 1) : 0.8);
  return { T_MO, tu, T_KET, DAI, muc, ket, n: muc.length };
}
/** Ảnh tĩnh cho bài ảnh: khung mục #1 (đẹp nhất, có số 1 + tên), cắt 3:4 giữa khung. */
export const anhTop = (de: DeTop): { t: number; cat: [number, number, number, number] }[] => { const N = nhipTop(de); const t1 = N.tu[N.n - 1] ?? 0; return [{ t: t1 + 1, cat: [0, 240, 1080, 1440] }]; };
/** Từ khoá ảnh: mục đầu mảng = nen_url (truyVanAnh), các mục sau = nen_them (truyVanThem) — cùng thứ tự với đề. */
export const truyVanTop = (de: DeTop) => de.muc[0]?.truy ?? de.tieu_de;
export const truyVanThemTop = (de: DeTop) => de.muc.slice(1, 5).map((m) => m.truy);

export function assTop(de: DeTop): string {
  const { T_MO, tu, T_KET, DAI, muc, ket, n } = nhipTop(de), d: DongAss[] = [];
  const dong = ngat(de.tieu_de, 20).slice(0, 3), co = dong.length >= 3 ? 72 : 84;
  // màn mở: phủ tối vừa, tiêu đề to giữa, câu móc dưới
  d.push([1, 0, T_MO, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.45)}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([2, 0, T_MO, 'Den', `{\\an5\\pos(540,820)${fs(co)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\q2\\fad(200,250)}${dong.map(chu).join('\\N')}`]);
  if (de.moc) d.push([2, 0.4, T_MO, 'Chu', `{\\an5\\pos(540,1060)\\b1${fs(42)}\\1c${mauAss(NHAN)}\\3c&H000000&\\bord2\\q2\\fad(200,250)}${ngat(de.moc, 30).slice(0, 2).map(chu).join('\\N')}`]);
  // từng mục: số lớn + tên + dòng trên dải tối ở đáy
  for (const [i, m] of muc.entries()) {
    const so = n - i, t0 = tu[i]!, t1 = i + 1 < n ? tu[i + 1]! : T_KET, ten = ngat(m.ten, 22).slice(0, 2), dongM = m.chu ? ngat(m.chu, 36).slice(0, 2) : [];
    const cao = 70 + 78 * ten.length + 48 * dongM.length;
    d.push([3, t0, t1, 'Ve', `{\\an2\\pos(540,1800)\\1c&H000000&\\1a${alpha(0.5)}\\fad(250,250)\\p1}${bo(1000, cao, 28)}`]);
    d.push([4, t0, t1, 'Ve', `{\\an5\\pos(170,${1800 - cao / 2})\\1c${mauAss(so === 1 ? NHAN : SAU)}\\fad(250,250)\\p1}${bo(150, 150, 75)}`]);
    d.push([5, t0, t1, 'Den', `{\\an5\\pos(170,${1800 - cao / 2 + 4})${fs(96)}\\1c${so === 1 ? '&H111111&' : '&HFFFFFF&'}\\fad(250,250)}${so}`]);
    let y = 1800 - cao + 36;
    d.push([5, t0, t1, 'Den', `{\\an7\\pos(280,${y})${fs(58)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\fad(250,250)}${ten.map(chu).join('\\N')}`]); y += 78 * ten.length;
    if (dongM.length) d.push([5, t0, t1, 'Chu', `{\\an7\\pos(280,${y})\\b1${fs(36)}\\1c${mauAss(TRANG)}\\1a&H30&\\fad(250,250)}${dongM.map(chu).join('\\N')}`]);
  }
  if (de.nhan) d.push([2, 0, DAI, 'Chu', `{\\an8\\pos(540,40)\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  if (ket.length) {
    d.push([6, T_KET, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c&H000000&\\1a${alpha(0.5)}\\fad(400,0)\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
    d.push([7, T_KET, DAI, 'Den', `{\\an5\\pos(540,900)${fs(64)}\\1c&HFFFFFF&\\q2\\fad(400,0)}${chu(ket[0]!)}`]);
    if (ket[1]) d.push([7, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1010)\\b1${fs(40)}\\1c${mauAss(TRANG)}\\1a&H30&\\fad(400,0)}${chu(ket[1])}`]);
  }
  return rapAss(W, H, d);
}
/** Dải tiếng: tệp thu thật lặp, vào/ra êm, cùng mức. */
export const locAmTop = (dai: number) => `[${'A'}]atrim=0:${dai.toFixed(2)},asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:d=1,afade=t=out:st=${Math.max(0, dai - 1.5).toFixed(2)}:d=1.5[a]`;

/** Lệnh ffmpeg: ảnh thật từng mục (nen = mục đầu, nenThem = các mục sau; thiếu ảnh thì mục dùng lại ảnh trước đó), mỗi ảnh lia chậm (zoompan) đúng
 *  thời lượng mục, màn mở dùng ảnh mục #1 (ảnh cuối), chồng mờ XF giữa các đoạn → ass → tiếng. `khung` = một khung JPG. */
export function lenhTop(o: { de: DeTop; ass: string; nen?: string | null; nenThem?: string[]; am?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const N = nhipTop(o.de), dai = Number(N.DAI.toFixed(2));
  if (!o.nen) throw new Error('mẫu top-n cần ảnh nền thật (nen_url)');
  const anhMuc = N.muc.map((_, i) => (i === 0 ? o.nen! : o.nenThem?.[i - 1] ?? o.nenThem?.[o.nenThem.length - 1] ?? o.nen!));
  // đoạn: [mở = ảnh mục #1] + từng mục + [kết = ảnh mục #1]; thời lượng mỗi đoạn + XF chồng mờ sang đoạn kế
  const doan = [{ anh: anhMuc[N.n - 1]!, tu: 0, den: N.T_MO }, ...N.muc.map((_, i) => ({ anh: anhMuc[i]!, tu: N.tu[i]!, den: i + 1 < N.n ? N.tu[i + 1]! : N.T_KET })), ...(N.DAI > N.T_KET + 1 ? [{ anh: anhMuc[N.n - 1]!, tu: N.T_KET, den: N.DAI }] : [])];
  const vao: string[] = [], f: string[] = [];
  doan.forEach((x, i) => { const d = Number((x.den - x.tu + XF).toFixed(2)); vao.push('-loop', '1', '-framerate', String(FPS), '-t', String(d), '-i', x.anh);
    f.push(`[${i}:v]scale=${Math.round(W * 1.12)}:${Math.round(H * 1.12)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.12)}:${Math.round(H * 1.12)},zoompan=z='1+0.08*on/${Math.round(d * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},eq=brightness=-0.03,setsar=1[v${i}]`); });
  let prev = '[v0]'; for (let i = 1; i < doan.length; i++) { const out = i === doan.length - 1 ? '[vx]' : `[x${i}]`; f.push(`${prev}[v${i}]xfade=transition=fade:duration=${XF}:offset=${doan[i]!.tu.toFixed(2)}${out}`); prev = out; }
  if (doan.length === 1) f.push(`[v0]null[vx]`);
  f.push(`[vx]trim=0:${dai},setpts=PTS-STARTPTS,ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`);
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', f.join(';'), '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  const iAm = doan.length, amVao = o.am ? ['-stream_loop', '-1', '-i', o.am] : ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${dai}`];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, ...amVao, '-filter_complex', `${f.join(';')};${locAmTop(dai).replace('[A]', `[${iAm}:a]`)}`, '-map', '[v]', '-map', '[a]', '-r', String(FPS), '-t', String(dai), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', o.ra];
}
export function kichBanTop(de: DeTop) {
  const N = nhipTop(de);
  return { tom_tat: `Top ${N.n} · ${de.tieu_de}`, shots: [{ tu: 0, den: N.T_MO, canh: 'Mở', hanh_dong: `Tiêu đề "${de.tieu_de}"${de.moc ? ` + móc "${de.moc}"` : ''} trên ảnh mục #1.` },
    ...N.muc.map((m, i) => ({ tu: N.tu[i]!, den: i + 1 < N.n ? N.tu[i + 1]! : N.T_KET, canh: `#${N.n - i} ${m.ten}`, hanh_dong: `Ảnh thật "${m.truy}" lia chậm, số ${N.n - i}, ${m.chu ?? ''}`.trim() })),
    ...(N.ket.length ? [{ tu: N.T_KET, den: N.DAI, canh: 'Kết', hanh_dong: N.ket.join(' / ') }] : [])] };
}
