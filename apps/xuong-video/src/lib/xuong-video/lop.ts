// Lớp phủ tự do (chữ · ảnh · hình khối) — phần THUẦN dùng chung cho khung xem trước (CSS) và bản xuất (libass + ffmpeg overlay).
// Anh 11/10/2026: "bổ sung công cụ thêm các thành phần, layer custom như ảnh, text, objects… như các công cụ làm video".
// Một nguồn số đo cho cả hai nơi: toạ độ chuẩn hoá (tâm x, y; bề ngang w theo rộng khung; bề cao h theo cao khung), cỡ chữ co theo rộng khung.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/lop.test.mts
import type { DangHinh, Lop, LoaiLop } from './kieu';

const so = (x: number) => (Math.round(x * 1000) / 1000).toString();
const kep = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Màu #RRGGBB → ASS &HBBGGRR& (không alpha). */
export const mauAss = (hex: string): string => { const h = (hex || '#FFFFFF').replace('#', '').padEnd(6, 'F').slice(0, 6); return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase(); };
export const gioAss = (t: number): string => { const cs = Math.max(0, Math.round(t * 100)); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
const alphaAss = (mo: number) => `&H${Math.round((1 - kep(mo, 0, 1)) * 255).toString(16).toUpperCase().padStart(2, '0')}&`;

/** Mã lớp mới — một chỗ cho lớp mới, mẫu và nhân bản. */
export const idLop = () => Math.random().toString(36).slice(2, 10);
/** Tên hiển thị của lớp (nhãn làn, bảng thuộc tính): tên đặt tay, không thì dòng chữ đầu / loại. */
export const tenLop = (l: Lop): string => l.ten || (l.loai === 'chu' ? (l.chu ?? '').split('\n')[0]!.slice(0, 24) || 'Chữ' : l.loai === 'anh' ? 'Ảnh' : 'Hình');
const NEN: Omit<Lop, 'id' | 'loai' | 'tu' | 'den'> = { x: 0.5, y: 0.5, w: 0.6, h: 0.1, xoay: 0, mo: 1, vao: 'mo', ra: 'mo' };
/** Lớp mới theo loại, đặt ở giây `tu`, dài 2,5s. */
export function lopMoi(loai: LoaiLop, tu: number, them: Partial<Lop> = {}): Lop {
  const goc: Lop = { ...NEN, id: idLop(), loai, tu: Math.max(0, tu), den: Math.max(0, tu) + 2.5 };
  // Chữ mới đặt ở 1/3 trên — không đè chữ màn (giữa/dưới) để vừa thêm là thấy ngay.
  if (loai === 'chu') Object.assign(goc, { chu: 'Chữ mới', font: 'Montserrat Black', co: 0.07, mau: '#FFFFFF', vien: '#000000', vien_day: 0.08, w: 0.8, y: 0.3 });
  if (loai === 'hinh') Object.assign(goc, { dang: 'bo_goc' as DangHinh, mau: '#6B4FD8', w: 0.6, h: 0.08 });
  if (loai === 'anh') Object.assign(goc, { w: 0.35 });
  return { ...goc, ...them };
}
/** Mẫu dựng sẵn (một hoặc vài lớp) — kiểu đồ hoạ QC hay gặp. tiLe = rộng/cao khung, để hình tròn ra tròn thật. */
export const MAU_LOP: { key: string; ten: string; tao: (tu: number, tiLe: number) => Lop[] }[] = [
  { key: 'chu', ten: 'Chữ', tao: (tu) => [lopMoi('chu', tu)] },
  { key: 'huy_hieu', ten: 'Huy hiệu giảm giá', tao: (tu, r) => [lopMoi('hinh', tu, { ten: 'Nền huy hiệu', dang: 'tron', mau: '#E11D48', x: 0.78, y: 0.3, w: 0.3, h: 0.3 * r, vao: 'pop' }),
    lopMoi('chu', tu, { ten: 'Chữ huy hiệu', chu: 'SAVE\n70%', co: 0.07, x: 0.78, y: 0.3, w: 0.28, vien_day: 0, vao: 'pop' })] },
  { key: 'sao', ten: '★★★★★', tao: (tu) => [lopMoi('chu', tu, { ten: 'Sao đánh giá', chu: '★★★★★', font: 'DejaVu Sans', co: 0.08, mau: '#F8D800', vien: '#7A5B00', vien_day: 0.04 })] },
  { key: 'bang', ten: 'Băng chữ', tao: (tu) => [lopMoi('hinh', tu, { ten: 'Băng', dang: 'chu_nhat', mau: '#6B4FD8', x: 0.5, y: 0.7, w: 1, h: 0.07, vao: 'truot' }),
    lopMoi('chu', tu, { ten: 'Chữ trên băng', chu: 'FREE SHIPPING', co: 0.06, y: 0.7, vien_day: 0, vao: 'truot' })] },
  { key: 'mui_ten', ten: 'Mũi tên', tao: (tu) => [lopMoi('chu', tu, { ten: 'Mũi tên', chu: '➜', font: 'DejaVu Sans', co: 0.16, mau: '#F8D800', vien_day: 0.04, vao: 'pop' })] },
  { key: 'hinh', ten: 'Hình khối', tao: (tu) => [lopMoi('hinh', tu)] },
];

/** Lớp đang hiện ở giây t (không ẩn), dưới trước — ảnh luôn dưới chữ/hình như bản xuất. */
export const lopHien = (ds: Lop[], t: number): Lop[] => ds.filter((l) => !l.an && t >= l.tu && t < l.den).sort((a, b) => (a.loai === 'anh' ? 0 : 1) - (b.loai === 'anh' ? 0 : 1));
/** Độ mờ + lệch dọc + tỉ lệ tại giây t theo hiệu ứng vào/ra (0,3s) — khung xem trước dựng y như bản xuất. */
export function hieuUngTai(l: Lop, t: number): { mo: number; dy: number; scale: number } {
  const vao = kep((t - l.tu) / 0.3, 0, 1), ra = kep((l.den - t) / 0.3, 0, 1);
  let mo = l.mo, dy = 0, scale = 1;
  if (l.vao === 'mo' || l.vao === 'truot' || l.vao === 'pop') mo *= l.vao === 'pop' ? kep((t - l.tu) / 0.15, 0, 1) : vao;
  if (l.vao === 'truot') dy = 0.05 * (1 - kep((t - l.tu) / 0.25, 0, 1));
  if (l.vao === 'pop') scale = 0.6 + 0.4 * kep((t - l.tu) / 0.2, 0, 1);
  if (l.ra === 'mo') mo *= ra;
  return { mo, dy, scale };
}

const duongHinh = (dang: DangHinh | undefined, w: number, h: number): string => {
  const r = Math.round(Math.min(w, h) * 0.22);
  if (dang === 'tron') { const kx = w / 2 * 0.5523, ky = h / 2 * 0.5523, cx = w / 2, cy = h / 2;
    return `m ${cx} 0 b ${so(cx + kx)} 0 ${w} ${so(cy - ky)} ${w} ${cy} b ${w} ${so(cy + ky)} ${so(cx + kx)} ${h} ${cx} ${h} b ${so(cx - kx)} ${h} 0 ${so(cy + ky)} 0 ${cy} b 0 ${so(cy - ky)} ${so(cx - kx)} 0 ${cx} 0`; }
  if (dang === 'bo_goc') return `m ${r} 0 l ${w - r} 0 b ${w} 0 ${w} 0 ${w} ${r} l ${w} ${h - r} b ${w} ${h} ${w} ${h} ${w - r} ${h} l ${r} ${h} b 0 ${h} 0 ${h} 0 ${h - r} l 0 ${r} b 0 0 0 0 ${r} 0`;
  return `m 0 0 l ${w} 0 ${w} ${h} 0 ${h}`;
};

/** Lớp chữ + hình → Style + Dialogue cho tệp ASS của bản xuất (cùng tệp với chữ màn; chữ màn lớp 100 nằm trên). */
export function lopAss(ds: Lop[], W: number, H: number): { styles: string[]; events: string[] } {
  const styles: string[] = []; const events: string[] = [];
  ds.forEach((l, i) => {
    if (l.an || l.loai === 'anh' || l.den <= l.tu) return;
    const cx = Math.round(l.x * W), cy = Math.round(l.y * H);
    const vt = l.vao === 'truot' ? `\\move(${cx},${cy + Math.round(H * 0.05)},${cx},${cy},0,250)` : `\\pos(${cx},${cy})`;
    const fad = `\\fad(${l.vao === 'khong' ? 0 : l.vao === 'pop' ? 150 : 300},${l.ra === 'mo' ? 300 : 0})`;
    const pop = l.vao === 'pop' ? '\\fscx60\\fscy60\\t(0,200,\\fscx100\\fscy100)' : '';
    const xoay = l.xoay ? `\\frz${so(-l.xoay)}` : '';
    const thoi = `${gioAss(l.tu)},${gioAss(l.den)}`;
    if (l.loai === 'chu') {
      const fs = Math.round(W * (l.co ?? 0.07)); const ten = `Lop${i}`;
      const bord = l.nen ? Math.round(fs * 0.3) : Math.max(0, Math.round(fs * (l.vien_day ?? 0.08)));
      styles.push(`Style: ${ten},${l.font || 'Montserrat Black'},${fs},${mauAss(l.mau ?? '#FFFFFF')},${mauAss(l.mau ?? '#FFFFFF')},${mauAss(l.nen || l.vien || '#000000')},&H80000000&,-1,${l.nghieng ? -1 : 0},0,0,100,100,0,0,${l.nen ? 3 : 1},${bord},0,5,0,0,0,1`);
      const chu = (l.chu ?? '').replace(/[{}\\]/g, '').split('\n').join('\\N');
      events.push(`Dialogue: ${1 + i},${thoi},${ten},,0,0,0,,{\\an5${vt}${xoay}\\alpha${alphaAss(l.mo)}${fad}${pop}}${chu}`);
    } else {
      const w = Math.max(2, Math.round(l.w * W)), h = Math.max(2, Math.round(l.h * H));
      const vien = l.vien_day ? `\\bord${Math.max(1, Math.round(W * l.vien_day * 0.05))}\\3c${mauAss(l.vien ?? '#000000')}` : '\\bord0';
      events.push(`Dialogue: ${1 + i},${thoi},LopHinh,,0,0,0,,{\\an5${vt}${xoay}\\1c${mauAss(l.mau ?? '#6B4FD8')}${vien}\\shad0\\alpha${alphaAss(l.mo)}${fad}${pop}\\p1}${duongHinh(l.dang, w, h)}{\\p0}`);
    }
  });
  if (events.some((e) => e.includes(',LopHinh,'))) styles.push('Style: LopHinh,Arial,20,&H00FFFFFF&,&H00FFFFFF&,&H00000000&,&H00000000&,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1');
  return { styles, events };
}

/** Lớp ảnh → chuỗi lọc ffmpeg phủ lên `vao`, ra nhãn `ra`. k = chỉ số đầu vào (ảnh nạp với -loop 1 -t <cả bản>). Ảnh giữ tỉ lệ, rộng w×W. */
export function lopAnhLoc(l: Lop, k: number, W: number, H: number, vao: string, ra: string): string {
  const w = Math.max(2, Math.round(l.w * W) & ~1);
  const cx = Math.round(l.x * W), cy = Math.round(l.y * H);
  const xoay = l.xoay ? `,rotate=${so(l.xoay)}*PI/180:c=none:ow=rotw(iw):oh=roth(ih)` : '';
  const fadeVao = l.vao === 'khong' ? '' : `,fade=t=in:st=${so(l.tu)}:d=0.3:alpha=1`;
  const fadeRa = l.ra === 'mo' ? `,fade=t=out:st=${so(Math.max(l.tu, l.den - 0.3))}:d=0.3:alpha=1` : '';
  const y = l.vao === 'truot' ? `'${cy}-h/2+${Math.round(H * 0.05)}*max(0\\,1-(t-${so(l.tu)})/0.25)'` : `${cy}-h/2`;
  return `[${k}:v]scale=${w}:-2,format=rgba,colorchannelmixer=aa=${so(kep(l.mo, 0, 1))}${xoay}${fadeVao}${fadeRa}[la${k}];[${vao}][la${k}]overlay=x=${cx}-w/2:y=${y}:enable='between(t\\,${so(l.tu)}\\,${so(l.den)})'[${ra}]`;
}
