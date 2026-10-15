// Ngắt dòng chữ trên màn (12/10/2026 — "Mercury R · Venus / R": chữ R rớt một mình xuống dòng). MỘT thuật toán cho bản xuất (ASS chữ màn,
// end card), lớp chữ và ô xem trước — trình duyệt không được tự ngắt nữa, nên xem trước và MP4 xuống dòng y hệt nhau.
//   1. Cụm không được tách: dấu/ký hiệu (· — → & : ! ?) và chữ cái đơn viết hoa (R, X) dính chữ ĐỨNG TRƯỚC; từ chức năng tiếng Anh
//      (a, the, of, to, your…) tránh đứng cuối dòng (phạt mềm) — kiểu dàn chữ của trailer/QC.
//   2. Số dòng = ít nhất có thể với bề rộng cho phép; rồi chia CÂN (quy hoạch động, phạt bình phương phần thiếu) — chữ căn giữa nhìn
//      thành khối, không có dòng cụt một chữ.
//   3. Bề rộng đo theo FONT THẬT (be-rong-font.ts, đọc từ TTF — 12/10/2026 "SIGNED. HER TERMS." Playfair Black chữ hoa tràn khung: ước
//      0,4 × cỡ cho mọi ký tự hụt gần gấp đôi với serif đậm viết hoa). Một cụm vẫn rộng hơn khung → cả câu thu nhỏ cho vừa (coVua).
//   4. Chữ trên hình không để dấu chấm cuối câu (anh 12/10/2026) — boChamCuoi, áp ở chỗ đọc chữ màn/lớp chữ/end card.
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ngat-dong.test.mts
import { BE_RONG_FONT, EM_CSS } from './be-rong-font';

const DINH_TRUOC = /^([·•—–\-&|:/+=!?.,;…»)\]→]+|[A-Z℞]|[0-9]{1,2}%?)$/u;
const DINH_SAU = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'or', 'my', 'your', 'her', 'his', 'its', 'our', 'their', 'is', 'no', '«', '(', '[']);

/** Cụm không tách: dấu/ký hiệu và chữ cái đơn viết hoa dính chữ đứng trước (luật cứng). */
export function cumChu(chu: string): string[] {
  const cum: string[] = [];
  for (const t of chu.trim().split(/\s+/).filter(Boolean)) {
    if (cum.length && DINH_TRUOC.test(t)) cum[cum.length - 1] += ` ${t}`; else cum.push(t);
  }
  return cum;
}
/** Phạt (đơn vị ký tự²) khi dòng kết bằng từ chức năng — tránh khi còn cách khác, nhưng không đẻ thêm dòng vì nó. */
const PHAT_TU_CHUC_NANG = 60;
/** Ngắt `chu` thành dòng dài tối đa `toiDa` ký tự (một cụm dài hơn toiDa thì đứng riêng một dòng). */
/** `rong` = cách đo một dòng (mặc định đếm ký tự; chữ màn dùng doDong — bề rộng px theo font thật), `toiDa` cùng đơn vị. */
export function ngatDong(chu: string, toiDa: number, rong: (s: string) => number = (s) => s.length): string[] {
  const c = cumChu(chu); if (!c.length) return [];
  const dai = (i: number, j: number) => rong(c.slice(i, j).join(' '));   // dòng gồm cụm [i, j)
  // số dòng tối thiểu: tham lam
  let n = 0; for (let i = 0; i < c.length;) { let j = i + 1; while (j < c.length && dai(i, j + 1) <= toiDa) j++; n++; i = j; }
  if (n === 1) return [c.join(' ')];
  // chia cân đúng n dòng: f[k][i] = chi phí xếp cụm [i..) vào k dòng
  const N = c.length; const VO = 1e12;
  const f: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(N + 1).fill(VO));
  const tach: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(N + 1).fill(-1));
  f[0]![N] = 0;
  for (let k = 1; k <= n; k++) for (let i = N - 1; i >= 0; i--) for (let j = i + 1; j <= N - k + 1; j++) {
    const d = dai(i, j); if (d > toiDa && j > i + 1) break;
    const con = f[k - 1]![j]!; if (con >= VO) continue;
    const cuoi = c[j - 1]!.split(' ').at(-1)!.toLowerCase();
    const phi = con + (Math.max(0, toiDa - d)) ** 2 + (d > toiDa ? 1e6 : 0) + (j < N && DINH_SAU.has(cuoi) ? PHAT_TU_CHUC_NANG : 0);
    if (phi < f[k]![i]!) { f[k]![i] = phi; tach[k]![i] = j; }
  }
  if (f[n]![0]! >= VO) return [c.join(' ')];
  const out: string[] = []; let i = 0;
  for (let k = n; k > 0; k--) { const j = tach[k]![i]!; out.push(c.slice(i, j).join(' ')); i = j; }
  return out;
}
/** Bề rộng chuỗi theo phần nghìn cỡ chữ ASS của font (ký tự có dấu lạ → ký tự gốc bỏ dấu; không biết → 0,62). */
export function rongChu(font: string, s: string): number {
  const b = BE_RONG_FONT[font] ?? BE_RONG_FONT['DejaVu Sans']!;
  let w = 0; for (const ch of s) w += b[ch] ?? b[ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')] ?? 620;
  return w / 1000;
}
/** Thước đo một dòng chữ màn khung rộng W: bề rộng px theo font thật × cỡ × độ rộng chữ, và bề rộng tối đa (90% khung trừ viền hai bên).
 *  Bản xuất (W = 1080) và ô xem trước (W = bề rộng ô) cùng tỉ lệ → cùng chỗ xuống dòng. */
export function doDong(W: number, k: { font: string; co: number; ngang: number; vien_day: number }): { toiDa: number; rong: (s: string) => number } {
  const fs = W * k.co;
  return { toiDa: W * 0.9 - 2 * fs * k.vien_day, rong: (s) => rongChu(k.font, s) * fs * (k.ngang / 100) };
}
/** Ngắt dòng chữ màn + hệ số thu nhỏ (≤1) khi một dòng vẫn rộng hơn khung (từ quá dài) — bản xuất và xem trước gọi chung. */
export function dongChuMan(chu: string, W: number, k: Parameters<typeof doDong>[1]): { dong: string[]; co: number } {
  const d = doDong(W, k); const dong = ngatDong(chu, d.toiDa, d.rong);
  const max = Math.max(0, ...dong.map(d.rong));
  return { dong, co: max > d.toiDa ? d.toiDa / max : 1 };
}
/** CSS font-size = cỡ ASS × tỉ lệ này (trình duyệt tính cỡ theo em, libass theo winAscent+winDescent) — không có thì ô xem to hơn MP4. */
export const emCss = (font: string): number => EM_CSS[font] ?? EM_CSS['DejaVu Sans'] ?? 1;
/** Bỏ dấu chấm cuối câu của chữ trên hình (giữ "…", "?", "!" và chấm giữa câu/tên miền). */
export const boChamCuoi = (s: string): string => s.replace(/(?<![.\s])\.\s*$/u, '').replace(/\s+$/u, '');

/** CỤM CHỮ (15/10/2026 — anh: "chữ hơi bé và dài quá, mỗi khuôn chỉ show vài từ hợp lý"): cắt câu thành các cụm ≤ toiDa từ hiện LẦN LƯỢT
 *  (kiểu phụ đề TikTok/Reels). Thứ tự: (1) cắt theo CÂU trước — . ! ? … ; : là ranh giới, hai câu không chung một khung ("6 bras out. 3" sai);
 *  (2) trong một câu, số cụm ít nhất, dài đều nhau, từ chức năng (the, a, my, it…) không đứng cuối cụm; ký hiệu đứng riêng (· — &) dính chữ
 *  trước; chữ "I" dính chữ trước. Dấu phẩy / chấm phẩy / · treo cuối cụm bỏ. Câu có **nhấn** giữ nguyên. */
const CUOI_CUM_KHONG = new Set([...DINH_SAU, 'it', 'with', 'from', 'that', 'this', 'so', 'but', 'i', 'you', 'we', 'she', 'he', 'they', 'have', 'has', 'had', 'be', 'like']);
function chiaMotCau(cau: string, toiDa: number): string[] {
  const tu: string[] = [];
  for (const w of cau.trim().split(/\s+/).filter(Boolean)) {
    if (tu.length && (/^[·•—–&|+=→]+$/u.test(w) || w === 'I')) tu[tu.length - 1] += ` ${w}`; else tu.push(w);
  }
  if (tu.length <= toiDa) return tu.length ? [tu.join(' ')] : [];
  const so = Math.ceil(tu.length / toiDa);
  const co = Array.from({ length: so }, (_, i) => Math.floor(tu.length / so) + (i < tu.length % so ? 1 : 0));
  for (let i = 0; i < so - 1; i++) {
    const cuoi = co.slice(0, i + 1).reduce((a, b) => a + b, 0) - 1;
    if (CUOI_CUM_KHONG.has(tu[cuoi]!.toLowerCase().replace(/[^a-z]/g, '')) && co[i]! > 1 && co[i + 1]! < toiDa) { co[i]!--; co[i + 1]!++; }
  }
  const out: string[] = []; let k = 0;
  for (const n of co) { out.push(tu.slice(k, k + n).join(' ')); k += n; }
  return out;
}
export function chiaCum(cau: string, toiDa: number): string[] {
  if (!toiDa || toiDa < 1 || /\*\*/.test(cau)) return [cau];
  // "·" / "•" / "|" ngăn các NHÃN (tên · ưu đãi · size): mỗi nhãn một khung; nhãn ngắn (≤ toiDa + 2 từ, vd "Buy 1 Get 1 Free") giữ nguyên —
  // trước đây chặt thành "Buy 1 Get" / "1 Free" ở end card (anh 15/10/2026). Câu thường không có dấu ngăn vẫn theo luật toiDa.
  const out = cau.split(/(?<=[.!?…;:])\s+/u).flatMap((c) => {
    const nhan = c.split(/\s+[·•|]\s+/u);
    if (nhan.length < 2) return chiaMotCau(c, toiDa);
    const ra: string[] = []; let gom: string[] = []; let soTu = 0;   // gộp nhãn ngắn liền nhau tới toiDa từ ("XS–6XL · 11 colors")
    const day = () => { if (gom.length) ra.push(gom.join(' · ')); gom = []; soTu = 0; };
    for (const x of nhan.map((v) => v.trim()).filter(Boolean)) {
      const n = x.split(/\s+/u).length;
      if (n > toiDa + 2) { day(); ra.push(...chiaMotCau(x, toiDa)); continue; }
      if (soTu && soTu + n > toiDa) day();
      gom.push(x); soTu += n;
    }
    day();
    return ra;
  }).map((c) => c.replace(/\s*[,;·•]$/u, ''));
  return out.length ? out : [cau];
}
