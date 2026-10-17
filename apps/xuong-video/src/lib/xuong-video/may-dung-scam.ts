// MẪU MÁY DỰNG "Scam or Real?" (ngách đặt phòng khách sạn → ratesbyroom.com, anh duyệt plan social traffic 17/10/2026).
// THUẦN: đề (một tin nhắn "khách sạn" qua WhatsApp / Email / SMS) → tệp ASS + lệnh ffmpeg. Không AI, 0đ.
// Nhịp: tiêu đề + khung tin nhắn "đập" vào 0,5s, thanh thời gian + đồng hồ 7 giây → 7,3s lộ: dấu SCAM đỏ + khoanh đúng các dòng có dấu hiệu
// (đánh số, lý do bên dưới) hoặc dấu REAL xanh + lý do tin thật → 10,1s màn kết: không trả tiền qua link trong tin nhắn, so giá thật ở ratesbyroom.com.
// Tên khách sạn trong đề là tên BỊA — không dùng tên / logo thương hiệu thật.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-scam.test.mts

export type KenhScam = 'WhatsApp' | 'Email' | 'SMS';
export interface DeScam {
  kenh: KenhScam;
  gui: string;                              // người gửi hiện trên đầu tin (vd "Harborview Suites Reservations")
  tieu_de?: string;                         // dòng tiêu đề (Email)
  dong: { t: string; co?: number }[];       // các đoạn của tin; co = số dấu hiệu (1, 2, 3) → khoanh lúc lộ
  ket: 'scam' | 'real';
  ly_do: string[];                          // scam: lý do theo số dấu hiệu; real: vì sao tin này thật
  goi: string;                              // tên ngắn của chiêu (vd "Fake cancellation deadline")
}

export const FPS = 30, T_DEM = 0.3, DEM = 7, T_LO = T_DEM + DEM, T_KET = T_LO + 2.8, DAI = T_KET + 2.7;
const W = 1080, H = 1920, DO = '#E5484D', XANH = '#2EBD85', NHAN = '#FCA311', SAU = '#14213D', TRANG = '#F4F6F8';
const MAU_KENH: Record<KenhScam, string> = { WhatsApp: '#1FA855', Email: '#3B6FE0', SMS: '#5B6472' };
const EM = 1.25;
const fs = (px: number) => `\\fs${Math.round(px * EM)}`;
export function mauAss(hex: string): string { const h = hex.replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase(); return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`; }
const alpha = (duc: number) => `&H${Math.round((1 - Math.min(1, Math.max(0, duc))) * 255).toString(16).padStart(2, '0').toUpperCase()}&`;
const tg = (s: number) => { const c = Math.max(0, Math.round(s * 100)); return `${Math.floor(c / 360000)}:${String(Math.floor(c / 6000) % 60).padStart(2, '0')}:${String(Math.floor(c / 100) % 60).padStart(2, '0')}.${String(c % 100).padStart(2, '0')}`; };
const ms = (s: number) => Math.round(s * 1000);
const chu = (s: string) => s.replace(/[{}\\]/g, '');
function bo(w: number, h: number, r: number): string {
  const R = Math.min(r, w / 2, h / 2), k = Math.round(R * 0.4477 * 10) / 10;
  return `m ${R} 0 l ${w - R} 0 b ${w - k} 0 ${w} ${k} ${w} ${R} l ${w} ${h - R} b ${w} ${h - k} ${w - k} ${h} ${w - R} ${h} l ${R} ${h} b ${k} ${h} 0 ${h - k} 0 ${h - R} l 0 ${R} b 0 ${k} ${k} 0 ${R} 0`;
}
/** Ngắt chữ theo số ký tự (Atkinson 44px ≈ 0,5em/ký tự → khung 820px ≈ 31 ký tự). */
export function ngat(s: string, n = 31): string[] {
  const ra: string[] = []; let d = '';
  for (const w of s.split(/\s+/).filter(Boolean)) { if (d && (d + ' ' + w).length > n) { ra.push(d); d = w; } else d = d ? `${d} ${w}` : w; }
  if (d) ra.push(d);
  return ra;
}
/** Bố cục tin: mỗi đoạn → các dòng đã ngắt, toạ độ y; đoạn có dấu hiệu giữ khung bao (y đầu, y cuối) để khoanh. */
export function boCuc(de: DeScam) {
  const DONG = 66, x = 140, y0 = de.kenh === 'Email' && de.tieu_de ? 700 : 620;
  let y = y0; const doan: { dong: string[]; y: number[]; co?: number; tren: number; duoi: number }[] = [];
  for (const p of de.dong) {
    const ds = ngat(p.t), ys = ds.map((_, i) => y + i * DONG);
    doan.push({ dong: ds, y: ys, co: p.co, tren: y - DONG / 2 - 4, duoi: y + (ds.length - 1) * DONG + DONG / 2 + 4 });
    y += ds.length * DONG + 26;
  }
  return { x, doan, cuoi: y };
}

type Dong = [lop: number, tu: number, den: number, kieu: 'Ve' | 'Den' | 'Chu', text: string];

export function assScam(de: DeScam): string {
  const d: Dong[] = [], L = boCuc(de), lua = de.ket === 'scam', mauKet = lua ? DO : XANH, kenh = MAU_KENH[de.kenh];
  const nay = (tuX: number) => `\\fscx${tuX}\\fscy${tuX}\\t(0,500,0.5,\\fscx100\\fscy100)`;
  // tiêu đề: SCAM (đỏ) or REAL? (xanh)
  d.push([5, 0, T_KET, 'Den', `{\\an5\\pos(540,150)${fs(104)}\\4c&H000000&\\4a&H80&\\shad6${nay(130)}\\1c${mauAss(DO)}}SCAM{\\1c&HFFFFFF&\\fs${Math.round(70 * EM)}} or {\\1c${mauAss(XANH)}\\fs${Math.round(104 * EM)}}REAL?`]);
  d.push([5, 0, T_KET, 'Chu', `{\\an5\\pos(540,262)\\b1${fs(44)}\\1c&HFFFFFF&${nay(130)}}Spot the red flags in 7 seconds`]);
  // thanh thời gian
  d.push([2, 0, T_LO, 'Ve', `{\\an7\\pos(60,312)\\1c&HFFFFFF&\\1a${alpha(0.18)}\\p1}${bo(960, 20, 10)}`]);
  d.push([3, 0, T_LO, 'Ve', `{\\an7\\pos(60,312)\\1c${mauAss(NHAN)}\\clip(60,312,1020,332)\\t(${ms(T_DEM)},${ms(T_LO)},\\clip(60,312,60,332))\\p1}${bo(960, 20, 10)}`]);
  // khung điện thoại (thẻ trắng) + dải đầu theo màu kênh
  const cao = Math.max(760, L.cuoi - 360 + 40), tamY = 380 + cao / 2;
  d.push([1, 0, T_KET, 'Ve', `{\\an5\\pos(540,${Math.round(tamY + 14)})\\1c&H000000&\\1a${alpha(0.3)}${nay(90)}\\p1}${bo(940, cao, 34)}`]);
  d.push([2, 0, T_KET, 'Ve', `{\\an5\\pos(540,${Math.round(tamY)})\\1c${mauAss(TRANG)}${nay(90)}\\p1}${bo(940, cao, 34)}`]);
  d.push([3, 0, T_KET, 'Ve', `{\\an7\\pos(70,380)\\1c${mauAss(kenh)}\\clip(70,380,1010,520)${nay(90)}\\p1}${bo(940, 200, 34)}`]);
  // đầu tin: kênh + người gửi (+ tiêu đề email)
  d.push([4, 0, T_KET, 'Ve', `{\\an5\\pos(150,450)\\1c&HFFFFFF&\\1a${alpha(0.25)}${nay(90)}\\p1}${bo(84, 84, 42)}`]);
  d.push([5, 0, T_KET, 'Den', `{\\an5\\pos(150,452)${fs(38)}\\1c&HFFFFFF&${nay(90)}}${chu(de.gui.trim()[0] ?? '?').toUpperCase()}`]);
  d.push([5, 0, T_KET, 'Chu', `{\\an4\\pos(212,428)\\b1${fs(30)}\\1c&HFFFFFF&\\1a&H30&${nay(90)}}${chu(de.kenh)}`]);
  d.push([5, 0, T_KET, 'Chu', `{\\an4\\pos(212,472)\\b1${fs(38)}\\1c&HFFFFFF&${nay(90)}}${chu(de.gui)}`]);
  if (de.kenh === 'Email' && de.tieu_de) d.push([5, 0, T_KET, 'Chu', `{\\an4\\pos(140,580)\\b1${fs(38)}\\1c&H222222&${nay(90)}}${chu(de.tieu_de)}`]);
  // các đoạn tin (chữ đen trên thẻ trắng); dòng có dấu hiệu: lúc lộ khung đỏ viền + số
  for (const p of L.doan) {
    for (const [i, s] of p.dong.entries()) d.push([6, 0, T_KET, 'Chu', `{\\an4\\pos(${L.x},${p.y[i]})\\b0${fs(44)}\\1c&H1B1B1B&${nay(90)}}${chu(s)}`]);
    if (lua && p.co) {
      const h = p.duoi - p.tren, tam = (p.tren + p.duoi) / 2;
      d.push([4, T_LO, T_KET, 'Ve', `{\\an5\\pos(560,${Math.round(tam)})\\1c${mauAss(DO)}\\1a${alpha(0.14)}\\3c${mauAss(DO)}\\bord6\\fscx96\\fscy96\\t(0,250,\\fscx100\\fscy100)\\p1}${bo(880, h, 16)}`]);
      d.push([7, T_LO, T_KET, 'Ve', `{\\an5\\pos(98,${Math.round(tam)})\\1c${mauAss(DO)}\\fscx60\\fscy60\\t(0,250,\\fscx100\\fscy100)\\p1}${bo(64, 64, 32)}`]);
      d.push([8, T_LO, T_KET, 'Den', `{\\an5\\pos(98,${Math.round(tam) + 2})${fs(34)}\\1c&HFFFFFF&}${p.co}`]);
    }
  }
  // đồng hồ 7 → 1 (3 giây cuối đỏ)
  for (let s = DEM; s >= 1; s--) {
    const tu = s === DEM ? 0 : T_LO - s, den = T_LO - s + 1, gap = s <= 3, nayGiay = `\\t(${ms(den - tu - 0.2)},${ms(den - tu)},\\fscx112\\fscy112)`;
    d.push([7, tu, den, 'Ve', `{\\an5\\pos(540,1730)\\1c${gap ? mauAss(DO) : mauAss(NHAN)}${nayGiay}\\p1}${bo(200, 200, 100)}`]);
    d.push([8, tu, den, 'Den', `{\\an5\\pos(540,1732)${fs(110)}\\1c${gap ? '&HFFFFFF&' : '&H111111&'}${nayGiay}}${s}`]);
  }
  // lộ: dấu SCAM / REAL nghiêng + lý do bên dưới thẻ
  d.push([9, T_LO, T_KET, 'Ve', `{\\an5\\pos(800,${Math.round(380 + 60)})\\frz-12\\1c${mauAss(mauKet)}\\fscx40\\fscy40\\t(0,220,0.6,\\fscx100\\fscy100)\\p1}${bo(360, 120, 18)}`]);
  d.push([10, T_LO, T_KET, 'Den', `{\\an5\\pos(800,${Math.round(380 + 62)})\\frz-12${fs(78)}\\1c&HFFFFFF&\\fscx40\\fscy40\\t(0,220,0.6,\\fscx100\\fscy100)}${lua ? 'SCAM' : 'REAL'}`]);
  const yLy = Math.min(1640, 380 + cao + 70);
  for (const [i, s] of de.ly_do.slice(0, 3).entries()) {
    d.push([9, T_LO + 0.15 * i, T_KET, 'Chu', `{\\an4\\pos(90,${yLy + i * 70})\\b1${fs(40)}\\1c&HFFFFFF&\\fad(150,0)}{\\1c${mauAss(mauKet)}}${lua ? `${i + 1}` : '•'}{\\1c&HFFFFFF&}  ${chu(s)}`]);
  }
  // màn kết
  const fad = '\\fad(300,0)';
  d.push([20, T_KET, DAI, 'Ve', `{\\an7\\pos(0,0)\\1c${mauAss(SAU)}${fad}\\p1}m 0 0 l ${W} 0 l ${W} ${H} l 0 ${H}`]);
  d.push([21, T_KET, DAI, 'Den', `{\\an5\\pos(540,640)${fs(76)}\\1c&HFFFFFF&\\q2${fad}}Never pay through\\Na link in a message.`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,860)\\b1${fs(46)}\\1c&HFFFFFF&\\1a&H30&${fad}}Call the hotel on the number\\Nfrom its official website.`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1060)\\b1${fs(46)}\\1c&HFFFFFF&${fad}}Compare real hotel rates:`]);
  d.push([21, T_KET, DAI, 'Ve', `{\\an5\\pos(540,1170)\\1c${mauAss(NHAN)}${fad}\\p1}${bo(640, 120, 20)}`]);
  d.push([22, T_KET, DAI, 'Den', `{\\an5\\pos(540,1172)${fs(62)}\\1c&H111111&${fad}}ratesbyroom.com`]);
  d.push([21, T_KET, DAI, 'Chu', `{\\an5\\pos(540,1330)\\b1${fs(42)}\\1c${mauAss(NHAN)}${fad}}Free checklist: 5 red flags before you pay`]);
  return [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Ve,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1',
    'Style: Den,Archivo Black,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1',
    'Style: Chu,Atkinson Hyperlegible,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1',
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...d.map(([lop, tu, den, kieu, text]) => `Dialogue: ${lop},${tg(tu)},${tg(den)},${kieu},,0,0,0,,${text}`), '',
  ].join('\n');
}

/** Tiếng: tích mỗi giây lúc đếm, dồn 3 giây cuối; lộ SCAM = tiếng "bè" trầm, REAL = "ting". Sinh bằng ffmpeg, không nhạc ngoài. */
export const amScam = (ket: DeScam['ket']) => `0.3*sin(2*PI*660*t)*exp(-9*t)`
  + `+0.25*sin(2*PI*1400*t)*lt(mod(t-${T_DEM},1),0.04)*gte(t,${T_DEM})*lt(t,${T_LO})`
  + `+0.2*sin(2*PI*1700*t)*lt(mod(t-${T_DEM}+0.5,1),0.03)*gte(t,${T_LO - 3})*lt(t,${T_LO})`
  + (ket === 'scam' ? `+0.3*sgn(sin(2*PI*140*t))*exp(-3*(t-${T_LO}))*gte(t,${T_LO})*lt(t,${(T_LO + 0.6).toFixed(2)})` : `+0.35*sin(2*PI*880*t)*exp(-6*(t-${T_LO}))*gte(t,${T_LO})`);

/** Lệnh ffmpeg: nền dải radial xanh đêm → ass → H.264 + AAC. `khung` (giây) = một khung JPG. */
export function lenhScam(o: { de: DeScam; ass: string; fontsDir: string; ra: string; khung?: number }): string[] {
  const assEsc = (p: string) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const vao = ['-f', 'lavfi', '-i', `gradients=s=${W}x${H}:type=radial:x0=540:y0=600:x1=540:y1=2100:c0=0x24345E:c1=0x14213D:c2=0x0B1226:nb_colors=3:speed=0:r=${FPS}:d=${DAI}`];
  const loc = `[0:v]ass='${assEsc(o.ass)}':fontsdir='${assEsc(o.fontsDir)}',format=yuv420p[v]`;
  if (o.khung != null) return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung), '-frames:v', '1', '-q:v', '3', o.ra];
  return ['-y', '-hide_banner', '-loglevel', 'error', ...vao, '-f', 'lavfi', '-i', `aevalsrc='${amScam(o.de.ket)}':s=44100:d=${DAI}`,
    '-filter_complex', loc, '-map', '[v]', '-map', '1:a', '-r', String(FPS), '-t', String(DAI), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', o.ra];
}

/** Trang đích của ngách (trang con trên ratesbyroom.com — nhịp 1 của plan social traffic). */
export const LINK_SCAM = 'https://ratesbyroom.com/hotel-scam-check/';
/** Một dòng nguồn đề (mau/may/scam-or-real.json) → dòng nạp của máy: đề + chữ đăng tiếng Anh. */
export function tuNguonScam(x: DeScam & { slug: string }) {
  const { slug, ...de } = x, lua = de.ket === 'scam';
  return { slug, chu_de: de.goi, de, dang: {
    title: `Scam or real? This "hotel" ${de.kenh === 'Email' ? 'email' : 'message'} – spot the red flags in 7 seconds`,
    description: `${lua ? `Scam: ${de.ly_do.join(' · ')}.` : `Real: ${de.ly_do.join(' · ')}.`} Never pay through a link in a message – call the hotel on the number from its official website. Free checklist (5 red flags before you pay) + real hotel rates: ${LINK_SCAM}`,
    link: LINK_SCAM,
  } };
}

/** Kịch bản 3 shot (tab Mẫu / ngăn video của máy). */
export function kichBanScam(de: DeScam) {
  const lua = de.ket === 'scam';
  return { tom_tat: `Scam or Real? · ${de.goi}`, shots: [
    { tu: 0, den: T_LO, canh: 'Tin nhắn + đếm 7 giây', hanh_dong: `Tin ${de.kenh} từ "${de.gui}" hiện trong khung điện thoại; người xem có 7 giây tìm dấu hiệu, đồng hồ đếm 7 → 1.` },
    { tu: T_LO, den: T_KET, canh: lua ? 'Lộ: SCAM + dấu hiệu' : 'Lộ: REAL + lý do', hanh_dong: lua ? `Dấu SCAM đỏ; ${de.dong.filter((x) => x.co).length} dòng có dấu hiệu được khoanh và đánh số, lý do hiện bên dưới.` : 'Dấu REAL xanh; lý do vì sao tin này thật hiện bên dưới.' },
    { tu: T_KET, den: DAI, canh: 'Màn kết', hanh_dong: 'Không trả tiền qua link trong tin nhắn; gọi số trên web chính thức; so giá thật ở ratesbyroom.com + checklist miễn phí.' },
  ] };
}
