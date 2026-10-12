// Lớp phủ tự do (chữ · ảnh · hình khối) — phần THUẦN dùng chung cho khung xem trước (CSS) và bản xuất (libass + ffmpeg overlay).
// Anh 11/10/2026: "bổ sung công cụ thêm các thành phần, layer custom như ảnh, text, objects… như các công cụ làm video".
// Một nguồn số đo cho cả hai nơi: toạ độ chuẩn hoá (tâm x, y; bề ngang w theo rộng khung; bề cao h theo cao khung), cỡ chữ co theo rộng khung.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/lop.test.mts
import type { DangHinh, HieuUngKhung, Lop, LoaiLop } from './kieu';
import { boChamCuoi } from './ngat-dong';

const so = (x: number) => (Math.round(x * 1000) / 1000).toString();
const kep = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Màu #RRGGBB → ASS &HBBGGRR& (không alpha). */
export const mauAss = (hex: string): string => { const h = (hex || '#FFFFFF').replace('#', '').padEnd(6, 'F').slice(0, 6); return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase(); };
export const gioAss = (t: number): string => { const cs = Math.max(0, Math.round(t * 100)); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60, c = cs % 100; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
const alphaAss = (mo: number) => `&H${Math.round((1 - kep(mo, 0, 1)) * 255).toString(16).toUpperCase().padStart(2, '0')}&`;

/** Mã lớp mới — một chỗ cho lớp mới, mẫu và nhân bản. */
export const idLop = () => Math.random().toString(36).slice(2, 10);
/** Chọn lớp kiểu Figma/CapCut: bấm một lớp = chọn cả NHÓM của nó; `them` (Shift/⌘) = bật/tắt nhóm đó trong vùng chọn đang có. */
export const nhomCua = (ds: Lop[], id: string): string[] => { const l = ds.find((x) => x.id === id); return !l ? [] : l.nhom ? ds.filter((x) => x.nhom === l.nhom).map((x) => x.id) : [id]; };
export function chonLopMoi(ds: Lop[], dang: string[], id: string, them: boolean): string[] {
  const n = nhomCua(ds, id);
  if (!them) return n;
  return n.every((x) => dang.includes(x)) ? dang.filter((x) => !n.includes(x)) : [...dang, ...n.filter((x) => !dang.includes(x))];
}
/** Gộp ≥2 lớp thành một đối tượng (mã nhóm mới; nhóm cũ bên trong tan vào nhóm mới). Dưới 2 lớp → giữ nguyên. */
/** Tên một nhóm lớp trên timeline: phần chung trước " · " của tên các lớp ("Impact · chớp/rung/zoom" → "Impact"), không có thì "Nhóm N lớp". */
export const tenNhom = (ds: Lop[]): string => { const p = ds.map((l) => tenLop(l).split(' · ')[0]!); return p.every((x) => x === p[0]) && p[0] ? p[0] : `Nhóm ${ds.length} lớp`; };
/** Làn lớp phủ trên timeline (12/10/2026 — 8 impact × 3 lớp thành 24 làn): lớp lẻ một làn như cũ (giữ thứ tự vẽ: làn trên = vẽ trên);
 *  mỗi NHÓM là một khối, và các nhóm cùng tên không chồng giờ xếp chung một làn. `ds` theo thứ tự lưu, kết quả theo thứ tự hiện (trên → dưới). */
export function lanLop(ds: Lop[]): { key: string; nhan: string; khoi: Lop[][] }[] {
  const lan: { key: string; nhan: string; khoi: Lop[][] }[] = []; const daNhom = new Set<string>();
  for (const l of [...ds].reverse()) {
    if (!l.nhom) { lan.push({ key: l.id, nhan: tenLop(l), khoi: [[l]] }); continue; }
    if (daNhom.has(l.nhom)) continue; daNhom.add(l.nhom);
    const k = ds.filter((x) => x.nhom === l.nhom); const nhan = tenNhom(k);
    const tu = Math.min(...k.map((x) => x.tu)), den = Math.max(...k.map((x) => x.den));
    const cho = lan.find((x) => x.nhan === nhan && x.khoi[0]!.length > 1 && x.khoi.every((b) => Math.max(...b.map((y) => y.den)) <= tu || Math.min(...b.map((y) => y.tu)) >= den));
    if (cho) cho.khoi.push(k); else lan.push({ key: `nhom:${l.nhom}`, nhan, khoi: [k] });
  }
  return lan;
}
export const gopNhom = (ds: Lop[], ids: string[], ma = idLop()): Lop[] => (ids.length < 2 ? ds : ds.map((l) => (ids.includes(l.id) ? { ...l, nhom: ma } : l)));
export const boNhom = (ds: Lop[], ids: string[]): Lop[] => ds.map((l) => (ids.includes(l.id) && l.nhom ? { ...l, nhom: undefined } : l));
/** Đổi cỡ (k) + xoay (độ) cả vùng chọn quanh tâm (cx, cy chuẩn hoá) — vị trí từng lớp xoay/co theo tâm chung, cỡ và góc riêng cộng thêm.
 *  Tính bằng px (rong × cao) để xoay không méo trên khung 9:16. */
export function bienDoiNhom(goc: Lop[], cx: number, cy: number, k: number, doXoay: number, rong: number, cao: number): Record<string, Partial<Lop>> {
  const r = (doXoay * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r), lam = (v: number, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
  const ra: Record<string, Partial<Lop>> = {};
  for (const l of goc) {
    const dx = (l.x - cx) * rong * k, dy = (l.y - cy) * cao * k;
    let xo = Math.round(l.xoay + doXoay); if (xo > 180) xo -= 360; if (xo < -180) xo += 360;
    ra[l.id] = { x: lam(cx + (dx * cos - dy * sin) / rong), y: lam(cy + (dx * sin + dy * cos) / cao), xoay: xo,
      ...(k !== 1 ? { w: lam(Math.max(0.01, l.w * k)), ...(l.loai === 'hinh' ? { h: lam(Math.max(0.005, l.h * k)) } : {}), ...(l.loai === 'chu' && l.co ? { co: lam(Math.min(0.4, l.co * k), 4) } : {}) } : {}) };
  }
  return ra;
}
/** Tên hiển thị của lớp (nhãn làn, bảng thuộc tính): tên đặt tay, không thì dòng chữ đầu / loại. */
export const tenLop = (l: Lop): string => l.ten || (l.loai === 'hieu_ung' ? HIEU_UNG.find((h) => h.key === l.hu)?.ten ?? 'Hiệu ứng' : l.loai === 'chu' ? (l.chu ?? '').split('\n')[0]!.slice(0, 24) || 'Chữ' : l.loai === 'anh' ? 'Ảnh' : 'Hình');
const NEN: Omit<Lop, 'id' | 'loai' | 'tu' | 'den'> = { x: 0.5, y: 0.5, w: 0.6, h: 0.1, xoay: 0, mo: 1, vao: 'mo', ra: 'mo' };
/** Lớp mới theo loại, đặt ở giây `tu`, dài 2,5s. */
export function lopMoi(loai: LoaiLop, tu: number, them: Partial<Lop> = {}): Lop {
  const goc: Lop = { ...NEN, id: idLop(), loai, tu: Math.max(0, tu), den: Math.max(0, tu) + 2.5 };
  // Chữ mới đặt ở 1/3 trên — không đè chữ màn (giữa/dưới) để vừa thêm là thấy ngay.
  if (loai === 'chu') Object.assign(goc, { chu: 'Chữ mới', font: 'Montserrat Black', co: 0.07, mau: '#FFFFFF', vien: '#000000', vien_day: 0.08, w: 0.8, y: 0.3 });
  if (loai === 'hinh') Object.assign(goc, { dang: 'bo_goc' as DangHinh, mau: '#6B4FD8', w: 0.6, h: 0.08 });
  if (loai === 'anh') Object.assign(goc, { w: 0.35 });
  if (loai === 'hieu_ung') Object.assign(goc, { hu: 'rung' as HieuUngKhung, cuong: 0.6, den: Math.max(0, tu) + 1, vao: 'khong', ra: 'khong' });
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
export const lopHien = (ds: Lop[], t: number): Lop[] => ds.filter((l) => !l.an && l.loai !== 'hieu_ung' && t >= l.tu && t < l.den).sort((a, b) => (a.loai === 'anh' ? 0 : 1) - (b.loai === 'anh' ? 0 : 1));
/** Độ mờ + lệch dọc + tỉ lệ tại giây t theo hiệu ứng vào/ra (0,3s) — khung xem trước dựng y như bản xuất. */
export function hieuUngTai(l: Lop, t: number): { mo: number; dy: number; scale: number } {
  const vao = kep((t - l.tu) / 0.3, 0, 1), ra = kep((l.den - t) / 0.3, 0, 1);
  let mo = l.mo, dy = 0, scale = 1;
  if (l.vao === 'mo' || l.vao === 'truot' || l.vao === 'pop') mo *= l.vao === 'pop' ? kep((t - l.tu) / 0.15, 0, 1) : vao;
  if (l.vao === 'truot') dy = 0.05 * (1 - kep((t - l.tu) / 0.25, 0, 1));
  if (l.vao === 'pop') scale = 0.6 + 0.4 * kep((t - l.tu) / 0.2, 0, 1);
  if (l.vao === 'nay') { const p = kep((t - l.tu) / 0.25, 0, 1); scale = p < 0.6 ? 0.5 + (1.15 - 0.5) * (p / 0.6) : 1.15 - 0.15 * ((p - 0.6) / 0.4); mo = l.mo * kep((t - l.tu) / 0.1, 0, 1) * (l.ra === 'mo' ? ra : 1); }
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
    if (l.an || l.loai === 'anh' || l.loai === 'hieu_ung' || l.den <= l.tu) return;
    const cx = Math.round(l.x * W), cy = Math.round(l.y * H);
    const vt = l.vao === 'truot' ? `\\move(${cx},${cy + Math.round(H * 0.05)},${cx},${cy},0,250)` : `\\pos(${cx},${cy})`;
    const fad = `\\fad(${l.vao === 'khong' || l.vao === 'go_chu' ? 0 : l.vao === 'pop' || l.vao === 'nay' ? 100 : 300},${l.ra === 'mo' ? 300 : 0})`;
    const pop = l.vao === 'pop' ? '\\fscx60\\fscy60\\t(0,200,\\fscx100\\fscy100)' : l.vao === 'nay' ? '\\fscx50\\fscy50\\t(0,150,\\fscx115\\fscy115)\\t(150,250,\\fscx100\\fscy100)' : '';
    const xoay = l.xoay ? `\\frz${so(-l.xoay)}` : '';
    const thoi = `${gioAss(l.tu)},${gioAss(l.den)}`;
    if (l.loai === 'chu') {
      const fs = Math.round(W * (l.co ?? 0.07)); const ten = `Lop${i}`;
      const bord = l.nen ? Math.round(fs * 0.3) : Math.max(0, Math.round(fs * (l.vien_day ?? 0.08)));
      styles.push(`Style: ${ten},${l.font || 'Montserrat Black'},${fs},${mauAss(l.mau ?? '#FFFFFF')},${mauAss(l.mau ?? '#FFFFFF')},${mauAss(l.nen || l.vien || '#000000')},&H80000000&,-1,${l.nghieng ? -1 : 0},0,0,100,100,0,0,${l.nen ? 3 : 1},${bord},0,5,0,0,0,1`);
      const tho = (l.chu ?? '').replace(/[{}\\]/g, '').split('\n').map(boChamCuoi).join('\n');   // không chấm cuối câu (ngat-dong.ts)
      // Gõ chữ (CapCut "typewriter"): từng ký tự hiện dần theo nhịp GO_CHU_MS — mỗi ký tự trong suốt rồi \t về đậm.
      const chu = l.vao === 'go_chu' ? [...tho].map((k, j) => (k === '\n' ? '\\N' : `{\\alpha&HFF&\\t(${j * GO_CHU_MS},${j * GO_CHU_MS + 1},\\alpha${alphaAss(l.mo)})}${k}`)).join('') : tho.split('\n').join('\\N');
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

/** Nhịp gõ chữ: mỗi ký tự (ms). Xem trước dùng cùng số. */
export const GO_CHU_MS = 45;
/** Số ký tự đang hiện của lớp chữ "gõ chữ" ở giây t (xem trước khi phát). */
export const soKyTuGo = (l: Lop, t: number): number => Math.max(0, Math.floor(((t - l.tu) * 1000) / GO_CHU_MS) + 1);

/** Hiệu ứng khung kiểu CapCut — một danh mục cho menu, nhãn làn, bản xuất. */
export const HIEU_UNG: { key: HieuUngKhung; ten: string; mo: string }[] = [
  { key: 'rung', ten: 'Rung máy', mo: 'khung rung như cầm tay — nhấn hook, CTA' },
  { key: 'chop', ten: 'Chớp sáng', mo: 'loé trắng rồi tắt dần — chuyển nhịp, lộ giá' },
  { key: 'zoom', ten: 'Zoom nhịp', mo: 'phóng gần 12% một nhịp — nhấn chi tiết' },
  { key: 'mo', ten: 'Mờ', mo: 'làm mờ nền để chữ/sản phẩm nổi' },
  { key: 'den_trang', ten: 'Đen trắng', mo: 'trước/sau, hồi tưởng nỗi đau' },
  { key: 'toi_vien', ten: 'Tối viền', mo: 'tối bốn góc, dồn mắt vào giữa' },
  { key: 'hat', ten: 'Hạt phim', mo: 'nhiễu hạt kiểu phim cũ / UGC' },
  { key: 'glitch', ten: 'Glitch RGB', mo: 'tách kênh màu — giật mắt, chuyển cảnh' },
];
export const tenHieuUng = (k?: HieuUngKhung) => HIEU_UNG.find((h) => h.key === k)?.ten ?? 'Hiệu ứng';

/** Lớp hiệu ứng → chuỗi lọc ffmpeg từ nhãn `vao` ra `ra` (áp lên video + lớp ảnh, dưới chữ). Bộ lọc nào có timeline thì dùng enable;
 *  crop KHÔNG có timeline (ffmpeg -filters) → rung/zoom tách luồng, bản rung/zoom phủ lại bằng overlay enable. */
export function lopHieuUngLoc(l: Lop, W: number, H: number, vao: string, ra: string, i: number): string {
  const c = kep(l.cuong ?? 0.6, 0.05, 1), a = so(l.tu), b = so(l.den), en = `enable='between(t\\,${a}\\,${b})'`;
  // Nhánh rung/zoom chỉ xử lý ĐÚNG khoảng của lớp (cắt ra, làm, trả về đúng giờ) — trước đây crop+scale toàn khung suốt cả phim cho mỗi lớp:
  // phim #9 có 16 lớp impact → xuất mất >10 phút thay vì ~1 phút (12/10/2026).
  const cua = `trim=start=${a}:end=${b},setpts=PTS-STARTPTS,`, ve = `,setpts=PTS+${a}/TB`;
  switch (l.hu) {
    case 'rung': { const A = Math.max(2, Math.round(W * 0.025 * c));
      return `[${vao}]split=2[hu${i}a][hu${i}b];[hu${i}b]${cua}crop=${W - 2 * A}:${H - 2 * A}:'${A}+${A}*sin(t*53)':'${A}+${A}*cos(t*41)',scale=${W}:${H},setsar=1${ve}[hu${i}c];[hu${i}a][hu${i}c]overlay=0:0:eof_action=pass:${en}[${ra}]`; }
    case 'zoom': { const z = 1 + 0.12 * c; const cw = Math.round(W / z) & ~1, ch = Math.round(H / z) & ~1;
      return `[${vao}]split=2[hu${i}a][hu${i}b];[hu${i}b]${cua}crop=${cw}:${ch}:${(W - cw) >> 1}:${(H - ch) >> 1},scale=${W}:${H},setsar=1${ve}[hu${i}c];[hu${i}a][hu${i}c]overlay=0:0:eof_action=pass:${en}[${ra}]`; }
    case 'chop': return `[${vao}]eq=brightness='${so(0.6 * c)}*max(0\\,1-(t-${a})/0.35)':eval=frame:${en}[${ra}]`;
    case 'mo': return `[${vao}]gblur=sigma=${so(3 + 14 * c)}:${en}[${ra}]`;
    case 'den_trang': return `[${vao}]hue=s=0:${en}[${ra}]`;
    case 'toi_vien': return `[${vao}]vignette=angle=${so(0.3 + 0.6 * c)}:${en}[${ra}]`;
    case 'hat': return `[${vao}]noise=alls=${Math.round(8 + 30 * c)}:allf=t+u:${en}[${ra}]`;
    case 'glitch': { const n = Math.max(2, Math.round(W * 0.012 * c)); return `[${vao}]rgbashift=rh=-${n}:bh=${n}:${en}[${ra}]`; }
    default: return `[${vao}]null[${ra}]`;
  }
}

/** Xem trước hiệu ứng khung ở giây t (CSS) — cùng số đo với lopHieuUngLoc: transform/filter cho lớp hình + độ đậm lớp phủ (chớp, tối viền, hạt). */
export function hieuUngKhungTai(ds: Lop[], t: number, rong: number): { transform: string; filter: string; chop: number; toiVien: number; hat: number } {
  const out = { transform: '', filter: '', chop: 0, toiVien: 0, hat: 0 };
  for (const l of ds) {
    if (l.an || l.loai !== 'hieu_ung' || t < l.tu || t >= l.den) continue;
    const c = kep(l.cuong ?? 0.6, 0.05, 1);
    if (l.hu === 'rung') { const A = rong * 0.025 * c; out.transform += ` scale(${1 + (4 * 0.025 * c)}) translate(${so(A * Math.sin(t * 53))}px, ${so(A * Math.cos(t * 41))}px)`; }
    if (l.hu === 'zoom') out.transform += ` scale(${1 + 0.12 * c})`;
    if (l.hu === 'mo') out.filter += ` blur(${so((3 + 14 * c) * rong / 1080)}px)`;
    if (l.hu === 'den_trang') out.filter += ' grayscale(1)';
    if (l.hu === 'glitch') { const n = Math.max(1, rong * 0.012 * c); out.filter += ` drop-shadow(${-n}px 0 rgba(255,0,0,.75)) drop-shadow(${n}px 0 rgba(0,180,255,.75))`; }
    if (l.hu === 'chop') out.chop = Math.max(out.chop, 0.6 * c * Math.max(0, 1 - (t - l.tu) / 0.35));
    if (l.hu === 'toi_vien') out.toiVien = Math.max(out.toiVien, 0.3 + 0.6 * c);
    if (l.hu === 'hat') out.hat = Math.max(out.hat, 0.1 + 0.3 * c);
  }
  return out;
}

/** Xem trước chuyển cảnh (CSS, gần đúng xfade của bản xuất): hình shot TRƯỚC phủ lên và biến đi theo kiểu, p = 0→1 trong d giây đầu shot sau.
 *  Trả style cho lớp hình cũ + màu loé (đen/trắng) nếu có. */
export function xemChuyenCanh(xfade: string, p: number): { cu: Record<string, string | number>; loe?: { mau: string; mo: number } } {
  const q = kep(p, 0, 1), pc = `${Math.round(q * 100)}%`;
  if (xfade === 'fadeblack' || xfade === 'fadewhite') return { cu: { opacity: q < 0.5 ? 1 : 0 }, loe: { mau: xfade === 'fadeblack' ? '#000' : '#fff', mo: 1 - Math.abs(2 * q - 1) } };
  if (/^slide|^cover/.test(xfade)) { const h = xfade.replace(/^(slide|cover)/, ''); const tr = h === 'left' ? `translateX(-${pc})` : h === 'right' ? `translateX(${pc})` : h === 'up' ? `translateY(-${pc})` : `translateY(${pc})`; return { cu: { transform: tr } }; }
  if (/^wipe|^smooth/.test(xfade)) { const h = xfade.replace(/^(wipe|smooth)/, ''); const ins = h === 'left' ? `inset(0 ${pc} 0 0)` : h === 'right' ? `inset(0 0 0 ${pc})` : h === 'up' ? `inset(0 0 ${pc} 0)` : h === 'down' ? `inset(${pc} 0 0 0)` : `inset(0 0 ${pc} ${pc})`; return { cu: { clipPath: ins } }; }
  if (xfade === 'circleopen') return { cu: { WebkitMaskImage: `radial-gradient(circle at center, transparent ${Math.round(q * 75)}%, #000 ${Math.round(q * 75) + 1}%)`, maskImage: `radial-gradient(circle at center, transparent ${Math.round(q * 75)}%, #000 ${Math.round(q * 75) + 1}%)` } };
  if (xfade === 'circleclose') return { cu: { clipPath: `circle(${Math.round((1 - q) * 75)}% at 50% 50%)` } };
  if (xfade === 'vertopen') return { cu: { clipPath: `polygon(0 0, ${50 - q * 50}% 0, ${50 - q * 50}% 100%, 0 100%, 0 0, 100% 0, 100% 100%, ${50 + q * 50}% 100%, ${50 + q * 50}% 0, 100% 0)` } };
  if (xfade === 'horzopen') return { cu: { clipPath: `polygon(0 0, 100% 0, 100% ${50 - q * 50}%, 0 ${50 - q * 50}%, 0 ${50 + q * 50}%, 100% ${50 + q * 50}%, 100% 100%, 0 100%)` } };
  if (xfade === 'zoomin') return { cu: { transform: `scale(${1 + q * 0.6})`, opacity: 1 - q } };
  if (xfade === 'squeezeh') return { cu: { transform: `scaleY(${1 - q})` } };
  if (xfade === 'pixelize' || xfade === 'hblur' || /wind$/.test(xfade)) return { cu: { filter: `blur(${Math.round(q * 12)}px)`, opacity: 1 - q } };
  return { cu: { opacity: 1 - q } };   // fade, dissolve, fadegrays, radial, hlslice… → mờ chéo
}
