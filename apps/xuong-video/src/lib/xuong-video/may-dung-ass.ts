// ĐỒ NGHỀ ASS dùng chung của các mẫu Máy Dựng (đố chữ, Scam or Real?, Before you land…) — THUẦN. Trước 17/10/2026 mỗi mẫu tự chép một bản
// mauAss / alpha / tg / bo / khung tệp ASS; mẫu thứ ba thì gom về đây (sửa một chỗ, mọi mẫu cùng đổi).

/** '#RRGGBB' → màu ASS '&H00BBGGRR&' (ASS ghi BGR). */
export function mauAss(hex: string): string {
  const h = hex.replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`;
}
/** Độ đục 0..1 → alpha ASS (00 = đục hẳn, FF = trong suốt). */
export const alpha = (duc: number) => `&H${Math.round((1 - Math.min(1, Math.max(0, duc))) * 255).toString(16).padStart(2, '0').toUpperCase()}&`;
/** Giây → mốc ASS h:mm:ss.cc */
export const tg = (s: number) => { const c = Math.max(0, Math.round(s * 100)); return `${Math.floor(c / 360000)}:${String(Math.floor(c / 6000) % 60).padStart(2, '0')}:${String(Math.floor(c / 100) % 60).padStart(2, '0')}.${String(c % 100).padStart(2, '0')}`; };
export const ms = (s: number) => Math.round(s * 1000);
/** Chữ đưa vào ASS: bỏ ký tự điều khiển { } \ + cờ nước (cặp regional indicator 🇯🇵 — libass không có font màu, vẽ thành hai ô vuông;
 *  Ngọc chặn esimfares vat-lac-loai-19201 10/11/2026 "lỗi font hai ô vuông"). Mọi mẫu Máy Dựng đi qua đây nên cả lớp hết. */
const CO_NUOC = /[\u{1F1E6}-\u{1F1FF}]/u;
export const chu = (s: string) => { const t = s.replace(/[{}\\]/g, ''); return CO_NUOC.test(t) ? t.replace(/[\u{1F1E6}-\u{1F1FF}]+\s?/gu, '').replace(/ {2,}/g, ' ') : t; };
/** Hình chữ nhật bo góc (ASS drawing, gốc 0,0) — đặt bằng \an5\pos(tâm) để phóng/thu quanh tâm. */
export function bo(w: number, h: number, r: number): string {
  const R = Math.min(r, w / 2, h / 2), k = Math.round(R * 0.4477 * 10) / 10;   // 1 − 0,5523: điểm điều khiển bezier xấp xỉ cung 1/4 tròn
  return `m ${R} 0 l ${w - R} 0 b ${w - k} 0 ${w} ${k} ${w} ${R} l ${w} ${h - R} b ${w} ${h - k} ${w - k} ${h} ${w - R} ${h} l ${R} ${h} b ${k} ${h} 0 ${h - k} 0 ${h - R} l 0 ${R} b 0 ${k} ${k} 0 ${R} 0`;
}
/** Ngắt chữ theo số ký tự (Atkinson 44px ≈ 0,5em/ký tự → khung 820px ≈ 31 ký tự). */
export function ngat(s: string, n = 31): string[] {
  const ra: string[] = []; let d = '';
  for (const w of s.split(/\s+/).filter(Boolean)) { if (d && (d + ' ' + w).length > n) { ra.push(d); d = w; } else d = d ? `${d} ${w}` : w; }
  if (d) ra.push(d);
  return ra;
}
/** NGẮT VỪA KHUNG, KHÔNG BAO GIỜ BỎ CHỮ: ≤ max dòng × n ký tự ở cỡ co; dài hơn thì ngắt rộng hơn và thu cỡ chữ cùng tỉ lệ (bề ngang dòng giữ nguyên).
 *  Mọi chỗ đặt chữ có trần số dòng trong mẫu Máy Dựng đi qua đây — CẤM ngat(…).slice(0, k) (máy kiểm: may-dung-ass.test.mts). Trước 12/11/2026 mỗi mẫu
 *  tự cắt k dòng → câu dài mất đuôi im lặng (spot-the-fake examweight mất "nursing career", Ngọc chặn "chữ bị cắt"), rồi vá từng mẫu một (veLua, #842, land, scam). */
export function vua(s: string, n: number, max: number, co: number): { dong: string[]; co: number } {
  const t = s.replace(/\s+/g, ' ').trim();
  for (let r = n; ; r = Math.ceil(r * 1.1)) { const dong = ngat(t, r); if (dong.length <= Math.max(1, max) || r >= t.length) return { dong, co: Math.floor((co * n) / Math.max(r, ...dong.map((x) => x.length))) }; }
  // thu cỡ theo dòng DÀI NHẤT thật, không theo r: một từ liền không ngắt được (link "ratesbyroom.com/hotel-scam-check/" 33 ký tự) dài hơn r → trước 13/11/2026 giữ nguyên cỡ, tràn hai mép (Ngọc chặn lam-tuong-40736)
}
/** Một dòng sự kiện: [lớp, từ giây, tới giây, kiểu chữ, nội dung đã gắn thẻ]. Kiểu: Ve (hình vẽ) · Den (Archivo Black) · Chu (Atkinson). */
export type DongAss = [lop: number, tu: number, den: number, kieu: 'Ve' | 'Den' | 'Chu', text: string];
/** MÀN KẾT CHUNG mọi mẫu Máy Dựng: ket[0] (thương hiệu / lời mời, ≤ 3 dòng × 20 ký tự ở cỡ `co`) + ket[1] (≤ 2 dòng × 34 ở cỡ 40), cả hai qua vua()
 *  nên câu dài ngắt dòng + thu cỡ, không tràn mép; dòng 2 đẩy xuống theo số dòng dòng 1. CẤM chu(ket[…]) in thẳng (\q2 không tự xuống dòng —
 *  "Explore your chart at astrolas.com" cỡ 80px tràn hai mép 1080, Ngọc chặn top-n astrolas 12/11/2026; máy kiểm: may-dung-ass.test.mts). */
/** Lớp tối phủ cả khung (m 0 0 l W 0 l W H l 0 H, W ≥ 1000 và H ≥ 1000 — vạch chia cao 8px không tính) — nền của màn, không phải chữ. */
const PHU_KHUNG = /\\p1\}m 0 0 l (\d+) 0 l \1 (\d+) l 0 \2\s*$/;
const laPhuKhung = (x: DongAss) => { const m = x[3] === 'Ve' ? PHU_KHUNG.exec(x[4]) : null; return !!m && Number(m[1]) >= 1000 && Number(m[2]) >= 1000; };
/** MÀN KẾT DỌN SẠCH: mọi chữ / thẻ của thân video còn chạy qua mốc `tu` bị cắt ở `tu` (trừ lớp tối phủ cả khung). Trước 13/11/2026 mẫu so-sanh giữ nhãn
 *  hai bên + dòng so sánh tới hết video, chỉ phủ lớp tối 62% → "examweight.com" của màn kết đè nhãn "Proctored exam" (Ngọc chặn examweight
 *  so-sanh-60893, báo sửa 2 lần vẫn quay lại); lac-loai (ô lưới + "Row…") và gia (bảng lý do) cùng kiểu. Dọn ở đây nên mọi mẫu dùng ketAss cùng hết. */
export function donManKet(d: DongAss[], tu: number): void {
  for (const x of d) if (x[1] < tu && x[2] > tu && !laPhuKhung(x)) x[2] = tu;
}
export function ketAss(d: DongAss[], lop: number, tu: number, den: number, ket: string[], o: { fs: (px: number) => string; trang: string; co?: number; vien?: boolean; fad?: number }): void {
  if (!ket[0]) return;
  donManKet(d, tu);
  const fad = `\\fad(${o.fad ?? 300},0)`, vien = o.vien !== false;
  const k0 = vua(ket[0], 18, 3, o.co ?? 60), y0 = 900 - 50 * (k0.dong.length - 1), y1 = y0 + 100 * k0.dong.length + 10;
  d.push([lop, tu, den, 'Den', `{\\an5\\pos(540,${y0})${o.fs(k0.co)}\\1c&HFFFFFF&${vien ? '\\3c&H000000&\\bord3' : ''}\\q2${fad}}${k0.dong.map(chu).join('\\N')}`]);
  if (!ket[1]) return;
  const k1 = vua(ket[1], 34, 2, 40);
  d.push([lop, tu, den, 'Chu', `{\\an5\\pos(540,${y1})\\b1${o.fs(k1.co)}\\1c${mauAss(o.trang)}${vien ? '\\3c&H000000&\\bord2' : ''}\\1a&H30&${fad}}${k1.dong.map(chu).join('\\N')}`]);
}
/** Ráp tệp ASS từ các dòng (khung + 3 kiểu chữ chung). chuDam: kiểu Chu in đậm mặc định (đố chữ dùng). */
export function rapAss(W: number, H: number, d: DongAss[], o: { chuDam?: boolean } = {}): string {
  return [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Ve,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1',
    'Style: Den,Archivo Black,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1',
    `Style: Chu,Atkinson Hyperlegible,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,${o.chuDam ? -1 : 0},0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...d.map(([lop, tu, den, kieu, text]) => `Dialogue: ${lop},${tg(tu)},${tg(den)},${kieu},,0,0,0,,${text}`), '',
  ].join('\n');
}
/** Đường dẫn tệp trong bộ lọc ffmpeg (ass=…, fontsdir=…): thoát \ : ' */
export const thoatLoc = (p: string) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

/** CHUYỂN ĐỘNG CHUNG của mọi mẫu (26/10/2026, gom từ 4 mẫu tự chép + chuẩn ease đo từ phim motion của người làm — tham-khao/video-skills.md:
 *  whaleyxbt/claude-motion, lemo-opuscar): VÀO = nhanh rồi chậm dần (ease-out, \t accel < 1), RA = chậm rồi nhanh (ease-in, accel > 1) và chỉ
 *  dài bằng nửa cú vào. Trước đây nửa số cú vào chạy tuyến tính (nhìn "máy"), nửa có ease — mỗi mẫu một kiểu. */
export const EASE_VAO = 0.5, EASE_RA = 2;
/** Nảy vào: từ cỡ tuX % về 100 % trong den giây, bắt đầu ở tu giây (mốc trong dòng). */
export const nayVao = (tuX: number, tu = 0, den = 0.5) => `\\fscx${tuX}\\fscy${tuX}\\t(${ms(tu)},${ms(tu + den)},${EASE_VAO},\\fscx100\\fscy100)`;
/** Nhịp đập của ô đồng hồ đếm: phồng 112 % trong 0,2 s cuối của mỗi giây (dòng dài `dai` giây). */
export const nhipDem = (dai: number) => `\\t(${ms(dai - 0.2)},${ms(dai)},${EASE_RA},\\fscx112\\fscy112)`;

/** LUẬT ĐỌC (anh 17/10/2026: "sau khi hiện nội dung đợi thêm 1-2s để họ còn đọc được"): một khối chữ hiện xong phải đứng ít nhất
 *  số từ ÷ TU_MOI_GIAY giây (tốc độ đọc chữ trên màn) + DEM_DOC giây đệm, tối thiểu 2 giây — rồi khối kế mới được hiện / màn mới được chuyển.
 *  Mọi mẫu máy tính nhịp theo đề bằng hàm này, không đặt mốc giây cứng. */
export const TU_MOI_GIAY = 3.5, DEM_DOC = 1.5;   // 3,5 từ/giây ≈ 210 từ/phút (đọc thường) + 1,5s đệm (anh: "đợi thêm 1-2s")
export const soTu = (...chu: string[]) => chu.join(' ').split(/\s+/).filter(Boolean).length;
/** Thời gian đọc trọn một khối (có đệm). */
export const giayDoc = (...chu: string[]) => Math.max(2, soTu(...chu) / TU_MOI_GIAY + DEM_DOC);
/** Thời gian đọc không đệm — dùng cho các dòng hiện nối tiếp trong cùng một khối (đệm cộng một lần ở dòng cuối). */
export const giayLuot = (...chu: string[]) => soTu(...chu) / TU_MOI_GIAY;
