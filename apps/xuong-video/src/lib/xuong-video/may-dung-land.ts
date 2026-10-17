// MẪU MÁY DỰNG "Before you land" (ngách eSIM du lịch → esimfares.com, roadmap S02 17/10/2026; góc spy #19191 roaming đắt + #19200 kích hoạt khi
// đã ở nước ngoài). THUẦN: đề (một nước + 1–3 cửa ngõ quốc tế) → ASS + lệnh ffmpeg. Không AI, 0đ.
// Dữ liệu đề: scripts/nguon/before-you-land.py — nước lấy từ kho esimfares (chỉ nước có trang đối tác thật), sân bay đối chiếu OurAirports.
// KHÔNG nói giá, dung lượng, tốc độ, nhà mạng — những thứ đổi theo tuần và mình không đo được (cùng luật với site esimfares).
// Nhịp TÍNH THEO ĐỀ (nhipLand — luật đọc may-dung-ass.ts › giayDoc): tên nước → thẻ cửa ngõ + dải cảnh báo roaming → ba bước tick lần lượt → màn kết.
// Khối nào hiện xong cũng đứng đủ thời gian đọc + 1,5s đệm rồi khối kế mới vào.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-land.test.mts
import { alpha, bo, chu, giayDoc, giayLuot, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export interface DeLand {
  iso: string;                                        // mã nước 2 chữ thường (trang esimfares.com/<iso>/)
  nuoc: string;                                       // tên nước tiếng Anh
  san_bay: { iata: string; ten: string; tp: string }[];   // 1–3 cửa ngõ quốc tế chính
  link: string;                                       // https://esimfares.com/<iso>/
}

export const FPS = 30;
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
export const CHU_MO = 'Do this before the wheels touch down', CHU_CANH = 'Your home SIM can start roaming the moment it connects abroad';
export const CHU_KET = (nuoc: string) => [`Land connected in ${nuoc}`, 'Compare eSIM plans before you fly:', 'esimfares.com'];
export const BUOC = (nuoc: string) => [`Install a ${nuoc} eSIM at home, on Wi-Fi`, 'Keep it switched off until you land', 'Turn off data roaming on your home line'];

/** Mốc thời gian của một đề (giây). Mỗi khối: hiện → đứng đủ giayDoc(chữ của khối) → khối kế. */
export function nhipLand(de: DeLand) {
  const sb = de.san_bay.slice(0, 3), buoc = BUOC(de.nuoc);
  const T_CUA = 0.5 + giayDoc('LANDING IN', de.nuoc, CHU_MO);                                   // cảnh tên nước
  const T_CANH = T_CUA + 0.25 + sb.length * 0.4 + giayDoc(...sb.map((a) => tenGon(a.ten)));   // đọc xong tên các sân bay mới hiện cảnh báo (thẻ còn nằm trên màn suốt các khối sau)
  const T_BUOC = T_CANH + giayDoc(CHU_CANH);                                                   // đọc xong cảnh báo mới sang 3 bước
  const buocTu: number[] = []; let t = T_BUOC + 0.4 + giayLuot('3 STEPS, 2 MINUTES');
  for (const b of buoc) { buocTu.push(t); t += Math.max(1.2, giayLuot(b)); }                  // bước kế hiện khi đọc xong bước trước
  const T_KET = buocTu[buocTu.length - 1]! + giayDoc(buoc[buoc.length - 1]!);                  // bước cuối: đọc + đệm
  const DAI = T_KET + giayDoc(...CHU_KET(de.nuoc));
  return { T_CUA, T_CANH, T_BUOC, buocTu, T_KET, DAI };
}

export function assLand(de: DeLand): string {
  const { T_CUA, T_CANH, T_BUOC, buocTu, T_KET, DAI } = nhipLand(de);
  const d: DongAss[] = [], nay = (tu: number) => `\\fscx${tu}\\fscy${tu}\\t(0,450,0.5,\\fscx100\\fscy100)`, sb = de.san_bay.slice(0, 3);
  // Bố cục dọc 1080×1920 phủ cả khung (17/10/2026: bản đầu dồn hết vào 60% trên, nửa dưới trống). Nền = ảnh thật của nước (lenhLand), làm tối.
  // ── 0 → T_CUA: tên nước ở giữa màn
  d.push([5, 0, T_CUA, 'Chu', `{\\an5\\pos(540,700)\\b1${fs(56)}\\1c${mauAss(XANH)}\\3c&H000000&\\bord3${nay(120)}}LANDING IN`]);
  d.push([6, 0, T_CUA, 'Den', `{\\an5\\pos(540,880)${fs(Math.round(coTen(de.nuoc) * 1.2))}\\1c&HFFFFFF&\\3c&H000000&\\bord4\\shad8\\4a&H60&\\q0${nay(135)}}${chu(de.nuoc.toUpperCase())}`]);
  d.push([5, 0.5, T_CUA, 'Chu', `{\\an5\\pos(540,1080)\\b1${fs(54)}\\1c&HFFFFFF&\\3c&H000000&\\bord3\\fad(250,200)}${ngat(CHU_MO, 16).join('\\N')}`]);
  const mb = 'm 0 18 l 120 10 b 140 9 150 14 150 18 b 150 22 140 27 120 26 l 0 18 m 70 15 l 40 -20 l 58 -20 l 98 14 m 70 21 l 40 56 l 58 56 l 98 22 m 6 17 l -6 0 l 6 0 l 22 15';
  d.push([4, 0, T_CUA, 'Ve', `{\\an7\\1c${mauAss(NHAN)}\\fscx160\\fscy160\\move(-260,1260,1100,1340,0,${Math.round(T_CUA * 1000)})\\frz-4\\p1}${mb}`]);
  // ── T_CUA → T_KET: tên nước thu lên đầu, thẻ cửa ngõ, cảnh báo, 3 bước
  d.push([6, T_CUA, T_KET, 'Chu', `{\\an5\\pos(540,200)\\b1${fs(44)}\\1c${mauAss(XANH)}\\3c&H000000&\\bord3\\fad(200,0)}LANDING IN`]);
  d.push([6, T_CUA, T_KET, 'Den', `{\\an5\\pos(540,330)${fs(coTen(de.nuoc))}\\1c&HFFFFFF&\\3c&H000000&\\bord4\\q0\\fad(200,0)}${chu(de.nuoc.toUpperCase())}`]);
  const HANG = 150, caoThe = 130 + sb.length * HANG, yThe = 470;
  d.push([2, T_CUA, T_KET, 'Ve', `{\\an7\\pos(50,${yThe})\\1c${mauAss(TRANG)}\\1a${alpha(0.96)}\\fad(200,0)\\p1}${bo(980, caoThe, 34)}`]);
  d.push([3, T_CUA, T_KET, 'Chu', `{\\an4\\pos(100,${yThe + 66})\\b1${fs(36)}\\1c&H6B6B6B&\\fad(200,0)}MAIN ARRIVAL AIRPORTS`]);
  for (const [i, a] of sb.entries()) {
    const y = yThe + 165 + i * HANG, tu = T_CUA + 0.25 + i * 0.4;
    d.push([4, tu, T_KET, 'Ve', `{\\an5\\pos(200,${y})\\1c${mauAss(SAU)}\\fscx70\\fscy70\\t(0,200,\\fscx100\\fscy100)\\p1}${bo(210, 116, 20)}`]);
    d.push([5, tu, T_KET, 'Den', `{\\an5\\pos(200,${y + 2})${fs(62)}\\1c${mauAss(NHAN)}\\fscx70\\fscy70\\t(0,200,\\fscx100\\fscy100)}${chu(a.iata)}`]);
    d.push([5, tu, T_KET, 'Chu', `{\\an4\\pos(335,${y - 26})\\b1${fs(46)}\\1c&H1B1B1B&\\fad(150,0)}${chu(tenGon(a.ten))}`]);
    d.push([5, tu, T_KET, 'Chu', `{\\an4\\pos(335,${y + 30})\\b0${fs(38)}\\1c&H5A5A5A&\\fad(150,0)}${chu(tpGon(a.tp))}`]);
  }
  const yDuoi = yThe + caoThe;   // đáy thẻ
  // dải cảnh báo roaming (đỏ) giữa phần còn lại của màn
  const yCanh = Math.round((yDuoi + 1800) / 2);
  d.push([4, T_CANH, T_BUOC, 'Ve', `{\\an5\\pos(540,${yCanh})\\1c${mauAss(DO)}\\fscx92\\fscy92\\t(0,220,\\fscx100\\fscy100)\\p1}${bo(980, 230, 30)}`]);
  d.push([5, T_CANH, T_BUOC, 'Chu', `{\\an5\\pos(540,${yCanh})\\b1${fs(52)}\\1c&HFFFFFF&\\q2}${ngat(CHU_CANH, 24).join('\\N')}`]);
  // ba bước: chia đều phần dưới thẻ
  const yB = yDuoi + 90, buoc = (1790 - yB - 60) / 3;   // chiều cao một hàng bước
  d.push([5, T_BUOC, T_KET, 'Chu', `{\\an4\\pos(70,${yB})\\b1${fs(46)}\\1c${mauAss(XANH)}\\3c&H000000&\\bord3\\fad(200,0)}3 STEPS, 2 MINUTES`]);
  for (const [i, s] of BUOC(de.nuoc).entries()) {
    const y = Math.round(yB + 60 + buoc * (i + 0.5)), tu = buocTu[i]!;
    d.push([3, tu, T_KET, 'Ve', `{\\an5\\pos(540,${y})\\1c${mauAss(SAU)}\\1a${alpha(0.82)}\\fad(150,0)\\p1}${bo(980, Math.min(160, buoc - 20), 26)}`]);
    d.push([4, tu, T_KET, 'Ve', `{\\an5\\pos(130,${y})\\1c${mauAss(XANH)}\\fscx50\\fscy50\\t(0,200,\\fscx100\\fscy100)\\p1}${bo(96, 96, 48)}`]);
    d.push([5, tu, T_KET, 'Den', `{\\an5\\pos(130,${y + 2})${fs(46)}\\1c${mauAss(SAU)}}${i + 1}`]);
    d.push([5, tu, T_KET, 'Chu', `{\\an4\\pos(205,${y})\\b1${fs(42)}\\1c&HFFFFFF&\\q2\\fad(200,0)}${ngat(s, 36).map(chu).join('\\N')}`]);   // tên nước dài (United Arab Emirates) → tự xuống dòng, không tràn mép
  }
  // ── màn kết
  const fad = '\\fad(300,0)';
  d.push([20, T_KET, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c${mauAss(SAU)}\\1a${alpha(0.88)}${fad}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([21, T_KET, DAI, 'Den', `{\\an5\\pos(540,700)${fs(92)}\\1c&HFFFFFF&\\q2${fad}}Land connected\\Nin ${chu(de.nuoc)}`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,990)\\b1${fs(52)}\\1c&HFFFFFF&\\1a&H20&${fad}}${CHU_KET(de.nuoc)[1]}`]);
  d.push([21, T_KET, DAI, 'Ve', `{\\an5\\pos(540,1150)\\1c${mauAss(NHAN)}${fad}\\p1}${bo(800, 150, 26)}`]);
  d.push([22, T_KET, DAI, 'Den', `{\\an5\\pos(540,1152)${fs(74)}\\1c&H111111&${fad}}esimfares.com`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1340)\\b1${fs(48)}\\1c${mauAss(XANH)}${fad}}Save this for your trip`]);
  return rapAss(W, H, d);
}

/** Tiếng: "vút" lúc máy bay qua, "ting" mỗi tick bước, "ding" màn kết. Sinh bằng ffmpeg, không nhạc ngoài. */
export const amLand = (de: DeLand) => { const { T_CUA, buocTu, T_KET } = nhipLand(de); return `0.18*sin(2*PI*(220+400*t)*t)*exp(-1.2*t)*lt(t,${T_CUA.toFixed(2)})`
  + buocTu.map((t0) => `+0.3*sin(2*PI*1320*t)*exp(-9*(t-${t0.toFixed(2)}))*gte(t,${t0.toFixed(2)})`).join('')
  + `+0.3*sin(2*PI*880*t)*exp(-5*(t-${T_KET.toFixed(2)}))*gte(t,${T_KET.toFixed(2)})`; };

/** Lệnh ffmpeg: nền dải xanh đêm → ass → H.264 + AAC. `khung` (giây) = một khung JPG. */
export function lenhLand(o: { de: DeLand; ass: string; nen?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  const DAI = Number(nhipLand(o.de).DAI.toFixed(2));
  // nền = ảnh thật của nước (nen_url của video, Pexels): phủ kín khung, đẩy chậm (zoom 1 → 1,06), làm tối + mờ nhẹ cho chữ đọc rõ
  const vao = o.nen ? ['-loop', '1', '-framerate', String(FPS), '-t', String(DAI), '-i', o.nen]
    : ['-f', 'lavfi', '-i', `gradients=s=${W}x${H}:type=linear:x0=0:y0=0:x1=0:y1=${H}:c0=0x123B5E:c1=0x0B1D33:c2=0x081424:nb_colors=3:speed=0:r=${FPS}:d=${DAI}`];
  // lia chậm từ trên xuống bằng crop theo t (17/10/2026: zoompan ở cỡ 2x tốn ~35s/video — crop trên ảnh 1,08x rẻ hơn hẳn, vẫn có chuyển động)
  const nen = o.nen ? `[0:v]scale=${Math.round(W * 1.08)}:${Math.round(H * 1.08)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.08)}:${Math.round(H * 1.08)},crop=${W}:${H}:x='(iw-ow)/2':y='(ih-oh)*t/${DAI}',eq=brightness=-0.22:saturation=0.85,boxblur=2:1`
    : '[0:v]null';
  const loc = `${nen},ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-f', 'lavfi', '-i', `aevalsrc='${amLand(o.de)}':s=44100:d=${DAI}`,
    '-filter_complex', loc, '-map', '[v]', '-map', '1:a', '-r', String(FPS), '-t', String(DAI), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', o.ra];
}

/** Một dòng nguồn đề (mau/may/before-you-land.json) → dòng nạp của máy: đề + chữ đăng tiếng Anh (không giá, không nhà mạng). */
export function tuNguonLand(x: DeLand & { slug: string; nen_url?: string; nen_nguon?: string }) {
  const { slug, nen_url, nen_nguon: _nguon, ...de } = x;
  const cua = de.san_bay.map((a) => `${tpGon(a.tp)} (${a.iata})`).join(', ');
  return { slug, chu_de: de.nuoc, de, dang: {
    title: `Landing in ${de.nuoc}? Do this before your plane touches down`,
    description: `Main arrival airports: ${cua}. Your home SIM can start roaming the moment it connects abroad. 1) Install a ${de.nuoc} eSIM at home, on Wi-Fi. 2) Keep it switched off until you land. 3) Turn off data roaming on your home line. Compare eSIM plans for ${de.nuoc}: ${de.link}`,
    link: de.link,
  }, nen_url: nen_url ?? null };
}

/** Kịch bản 3 shot (tab Mẫu / ngăn video của máy). */
export function kichBanLand(de: DeLand) {
  const { T_CUA, T_BUOC, DAI } = nhipLand(de);
  return { tom_tat: `Before you land · ${de.nuoc}`, shots: [
    { tu: 0, den: T_CUA, canh: 'Tên nước', hanh_dong: `"LANDING IN ${de.nuoc.toUpperCase()}" đập vào, máy bay lướt ngang, dòng "Do this before the wheels touch down".` },
    { tu: T_CUA, den: T_BUOC, canh: 'Cửa ngõ + cảnh báo roaming', hanh_dong: `Thẻ ${de.san_bay.length} sân bay chính (${de.san_bay.map((a) => a.iata).join(', ')}), dải đỏ: SIM nhà có thể bắt đầu roaming ngay khi bắt sóng nước ngoài.` },
    { tu: T_BUOC, den: DAI, canh: '3 bước + màn kết', hanh_dong: 'Ba bước tick lần lượt (cài eSIM ở nhà, tắt tới khi hạ cánh, tắt roaming SIM nhà) → so gói eSIM ở esimfares.com.' },
  ] };
}
