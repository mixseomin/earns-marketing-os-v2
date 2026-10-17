// MẪU MÁY DỰNG "Before you land" (ngách eSIM du lịch → esimfares.com, roadmap S02 17/10/2026; góc spy #19191 roaming đắt + #19200 kích hoạt khi
// đã ở nước ngoài). THUẦN: đề (một nước + 1–3 cửa ngõ quốc tế) → ASS + lệnh ffmpeg. Không AI, 0đ.
// Dữ liệu đề: scripts/nguon/before-you-land.py — nước lấy từ kho esimfares (chỉ nước có trang đối tác thật), sân bay đối chiếu OurAirports.
// KHÔNG nói giá, dung lượng, tốc độ, nhà mạng — những thứ đổi theo tuần và mình không đo được (cùng luật với site esimfares).
// Nhịp: 0 tên nước đập vào · 3,0 thẻ cửa ngõ + dải cảnh báo roaming · 8,0 ba bước (tick lần lượt) · 12,6 màn kết: so gói eSIM ở esimfares.com.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-land.test.mts
import { alpha, bo, chu, mauAss, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export interface DeLand {
  iso: string;                                        // mã nước 2 chữ thường (trang esimfares.com/<iso>/)
  nuoc: string;                                       // tên nước tiếng Anh
  san_bay: { iata: string; ten: string; tp: string }[];   // 1–3 cửa ngõ quốc tế chính
  link: string;                                       // https://esimfares.com/<iso>/
}

export const FPS = 30, T_CUA = 3.0, T_BUOC = 8.0, T_KET = 12.6, DAI = 15.6;
const W = 1080, H = 1920, NHAN = '#FCA311', XANH = '#2EC4B6', DO = '#E5484D', SAU = '#0B1D33', TRANG = '#F4F6F8';
const EM = 1.25;
const fs = (px: number) => `\\fs${Math.round(px * EM)}`;
/** Cỡ chữ tên nước theo độ dài (tên dài như "United Arab Emirates" vẫn vừa 1 dòng / 2 dòng). */
export function coTen(ten: string): number { const n = ten.length; return n <= 7 ? 150 : n <= 10 ? 124 : n <= 14 ? 96 : 76; }
/** Tên sân bay gọn cho thẻ: bỏ chữ "International Airport"/"Airport" ở cuối, cắt 30 ký tự. */
export function tenGon(t: string): string {
  const g = t.replace(/\s+(International\s+)?Airport$/i, '').replace(/\s+Airport\b/i, '').trim();
  return g.length > 30 ? `${g.slice(0, 29).trimEnd()}…` : g;
}
/** Thành phố gọn: bỏ phần trong ngoặc / sau dấu phẩy (OurAirports hay ghi "Paris (Roissy-en-France, Val-d'Oise)"). */
export const tpGon = (t: string) => t.replace(/\s*\(.*$/, '').split(',')[0]!.trim();
export const BUOC = (nuoc: string) => [`Install a ${nuoc} eSIM at home, on Wi-Fi`, 'Keep it switched off until you land', 'Turn off data roaming on your home line'];

export function assLand(de: DeLand): string {
  const d: DongAss[] = [], nay = (tu: number) => `\\fscx${tu}\\fscy${tu}\\t(0,450,0.5,\\fscx100\\fscy100)`, sb = de.san_bay.slice(0, 3);
  // ── 0 → T_CUA: tên nước
  d.push([5, 0, T_KET, 'Chu', `{\\an5\\pos(540,260)\\b1${fs(48)}\\1c${mauAss(XANH)}${nay(120)}}LANDING IN`]);
  d.push([6, 0, T_KET, 'Den', `{\\an5\\pos(540,${sb.length ? 400 : 520})${fs(coTen(de.nuoc))}\\1c&HFFFFFF&\\4c&H000000&\\4a&H70&\\shad6\\q0${nay(135)}}${chu(de.nuoc.toUpperCase())}`]);
  d.push([5, 0, T_CUA + 0.4, 'Chu', `{\\an5\\pos(540,560)\\b1${fs(46)}\\1c&HFFFFFF&\\fad(250,250)}Do this before the wheels touch down`]);
  // máy bay hạ dần (vẽ tay: thân + cánh), trượt ngang
  const mb = 'm 0 18 l 120 10 b 140 9 150 14 150 18 b 150 22 140 27 120 26 l 0 18 m 70 15 l 40 -20 l 58 -20 l 98 14 m 70 21 l 40 56 l 58 56 l 98 22 m 6 17 l -6 0 l 6 0 l 22 15';
  d.push([4, 0, T_CUA, 'Ve', `{\\an7\\1c${mauAss(NHAN)}\\move(-180,640,980,720,0,${Math.round(T_CUA * 1000)})\\frz-4\\p1}${mb}`]);
  // ── T_CUA → T_KET: thẻ cửa ngõ
  const caoThe = 120 + sb.length * 128, yThe = 640;
  d.push([2, T_CUA, T_KET, 'Ve', `{\\an7\\pos(70,${yThe})\\1c${mauAss(TRANG)}\\fad(200,0)\\p1}${bo(940, caoThe, 30)}`]);
  d.push([3, T_CUA, T_KET, 'Chu', `{\\an4\\pos(120,${yThe + 64})\\b1${fs(32)}\\1c&H6B6B6B&\\fad(200,0)}MAIN ARRIVAL AIRPORTS`]);
  for (const [i, a] of sb.entries()) {
    const y = yThe + 150 + i * 128, tu = T_CUA + 0.25 + i * 0.3;
    d.push([4, tu, T_KET, 'Ve', `{\\an5\\pos(205,${y})\\1c${mauAss(SAU)}\\fscx70\\fscy70\\t(0,200,\\fscx100\\fscy100)\\p1}${bo(170, 96, 18)}`]);
    d.push([5, tu, T_KET, 'Den', `{\\an5\\pos(205,${y + 2})${fs(50)}\\1c${mauAss(NHAN)}\\fscx70\\fscy70\\t(0,200,\\fscx100\\fscy100)}${chu(a.iata)}`]);
    d.push([5, tu, T_KET, 'Chu', `{\\an4\\pos(320,${y - 22})\\b1${fs(38)}\\1c&H1B1B1B&\\fad(150,0)}${chu(tenGon(a.ten))}`]);
    d.push([5, tu, T_KET, 'Chu', `{\\an4\\pos(320,${y + 26})\\b0${fs(32)}\\1c&H5A5A5A&\\fad(150,0)}${chu(tpGon(a.tp))}`]);
  }
  // dải cảnh báo roaming (đỏ)
  const yCanh = yThe + caoThe + 90;
  d.push([4, T_CUA + 1.4, T_BUOC, 'Ve', `{\\an5\\pos(540,${yCanh})\\1c${mauAss(DO)}\\fscx92\\fscy92\\t(0,220,\\fscx100\\fscy100)\\p1}${bo(940, 150, 24)}`]);
  d.push([5, T_CUA + 1.4, T_BUOC, 'Chu', `{\\an5\\pos(540,${yCanh})\\b1${fs(40)}\\1c&HFFFFFF&\\q2}Your home SIM can start roaming\\Nthe moment it connects abroad`]);
  // ── T_BUOC → T_KET: ba bước, tick lần lượt
  const yB = yThe + caoThe + 40;
  d.push([5, T_BUOC, T_KET, 'Chu', `{\\an4\\pos(80,${yB})\\b1${fs(40)}\\1c${mauAss(XANH)}\\fad(200,0)}3 STEPS, 2 MINUTES`]);
  for (const [i, s] of BUOC(de.nuoc).entries()) {
    const y = yB + 110 + i * 120, tu = T_BUOC + 0.4 + i * 1.2;
    d.push([4, tu, T_KET, 'Ve', `{\\an5\\pos(118,${y})\\1c${mauAss(XANH)}\\fscx50\\fscy50\\t(0,200,\\fscx100\\fscy100)\\p1}${bo(76, 76, 38)}`]);
    d.push([5, tu, T_KET, 'Den', `{\\an5\\pos(118,${y + 2})${fs(38)}\\1c${mauAss(SAU)}}${i + 1}`]);
    d.push([5, tu, T_KET, 'Chu', `{\\an4\\pos(180,${y})\\b1${fs(38)}\\1c&HFFFFFF&\\fad(200,0)}${chu(s)}`]);
  }
  // ── màn kết
  const fad = '\\fad(300,0)';
  d.push([20, T_KET, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c${mauAss(SAU)}${fad}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([21, T_KET, DAI, 'Den', `{\\an5\\pos(540,620)${fs(72)}\\1c&HFFFFFF&\\q2${fad}}Land connected\\Nin ${chu(de.nuoc)}`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,860)\\b1${fs(44)}\\1c&HFFFFFF&\\1a&H30&${fad}}Compare eSIM plans before you fly:`]);
  d.push([21, T_KET, DAI, 'Ve', `{\\an5\\pos(540,990)\\1c${mauAss(NHAN)}${fad}\\p1}${bo(680, 124, 22)}`]);
  d.push([22, T_KET, DAI, 'Den', `{\\an5\\pos(540,992)${fs(60)}\\1c&H111111&${fad}}esimfares.com`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1150)\\b1${fs(40)}\\1c${mauAss(XANH)}${fad}}Save this for your trip`]);
  d.push([3, 0, DAI, 'Ve', `{\\an7\\pos(0,1860)\\1c${mauAss(XANH)}\\1a${alpha(0.9)}\\p1}m 0 0 l ${W} 0 l ${W} 60 l 0 60`]);
  return rapAss(W, H, d);
}

/** Tiếng: "vút" lúc máy bay qua, "ting" mỗi tick bước, "ding" màn kết. Sinh bằng ffmpeg, không nhạc ngoài. */
export const amLand = () => `0.18*sin(2*PI*(220+400*t)*t)*exp(-1.2*t)*lt(t,${T_CUA})`
  + [0, 1, 2].map((i) => { const t0 = T_BUOC + 0.4 + i * 1.2; return `+0.3*sin(2*PI*1320*t)*exp(-9*(t-${t0.toFixed(2)}))*gte(t,${t0.toFixed(2)})`; }).join('')
  + `+0.3*sin(2*PI*880*t)*exp(-5*(t-${T_KET}))*gte(t,${T_KET})`;

/** Lệnh ffmpeg: nền dải xanh đêm → ass → H.264 + AAC. `khung` (giây) = một khung JPG. */
export function lenhLand(o: { de: DeLand; ass: string; fontsDir: string; ra: string; khung?: number }): string[] {
  const vao = ['-f', 'lavfi', '-i', `gradients=s=${W}x${H}:type=linear:x0=0:y0=0:x1=0:y1=${H}:c0=0x123B5E:c1=0x0B1D33:c2=0x081424:nb_colors=3:speed=0:r=${FPS}:d=${DAI}`];
  const loc = `[0:v]ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-f', 'lavfi', '-i', `aevalsrc='${amLand()}':s=44100:d=${DAI}`,
    '-filter_complex', loc, '-map', '[v]', '-map', '1:a', '-r', String(FPS), '-t', String(DAI), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', o.ra];
}

/** Một dòng nguồn đề (mau/may/before-you-land.json) → dòng nạp của máy: đề + chữ đăng tiếng Anh (không giá, không nhà mạng). */
export function tuNguonLand(x: DeLand & { slug: string }) {
  const { slug, ...de } = x;
  const cua = de.san_bay.map((a) => `${tpGon(a.tp)} (${a.iata})`).join(', ');
  return { slug, chu_de: de.nuoc, de, dang: {
    title: `Landing in ${de.nuoc}? Do this before your plane touches down`,
    description: `Main arrival airports: ${cua}. Your home SIM can start roaming the moment it connects abroad. 1) Install a ${de.nuoc} eSIM at home, on Wi-Fi. 2) Keep it switched off until you land. 3) Turn off data roaming on your home line. Compare eSIM plans for ${de.nuoc}: ${de.link}`,
    link: de.link,
  } };
}

/** Kịch bản 3 shot (tab Mẫu / ngăn video của máy). */
export function kichBanLand(de: DeLand) {
  return { tom_tat: `Before you land · ${de.nuoc}`, shots: [
    { tu: 0, den: T_CUA, canh: 'Tên nước', hanh_dong: `"LANDING IN ${de.nuoc.toUpperCase()}" đập vào, máy bay lướt ngang, dòng "Do this before the wheels touch down".` },
    { tu: T_CUA, den: T_BUOC, canh: 'Cửa ngõ + cảnh báo roaming', hanh_dong: `Thẻ ${de.san_bay.length} sân bay chính (${de.san_bay.map((a) => a.iata).join(', ')}), dải đỏ: SIM nhà có thể bắt đầu roaming ngay khi bắt sóng nước ngoài.` },
    { tu: T_BUOC, den: DAI, canh: '3 bước + màn kết', hanh_dong: 'Ba bước tick lần lượt (cài eSIM ở nhà, tắt tới khi hạ cánh, tắt roaming SIM nhà) → so gói eSIM ở esimfares.com.' },
  ] };
}
