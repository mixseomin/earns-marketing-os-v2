// Ngắt dòng chữ trên màn (12/10/2026 — "Mercury R · Venus / R": chữ R rớt một mình xuống dòng). MỘT thuật toán cho bản xuất (ASS chữ màn,
// end card), lớp chữ và ô xem trước — trình duyệt không được tự ngắt nữa, nên xem trước và MP4 xuống dòng y hệt nhau.
//   1. Cụm không được tách: dấu/ký hiệu (· — → & : ! ?) và chữ cái đơn viết hoa (R, X) dính chữ ĐỨNG TRƯỚC; từ chức năng tiếng Anh
//      (a, the, of, to, your…) tránh đứng cuối dòng (phạt mềm) — kiểu dàn chữ của trailer/QC.
//   2. Số dòng = ít nhất có thể với bề rộng cho phép; rồi chia CÂN (quy hoạch động, phạt bình phương phần thiếu) — chữ căn giữa nhìn
//      thành khối, không có dòng cụt một chữ.
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ngat-dong.test.mts
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
export function ngatDong(chu: string, toiDa: number): string[] {
  const c = cumChu(chu); if (!c.length) return [];
  const dai = (i: number, j: number) => c.slice(i, j).join(' ').length;   // dòng gồm cụm [i, j)
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
/** Số ký tự một dòng chữ màn chứa được: bề rộng dùng 92% khung, một ký tự ≈ 0,4 × cỡ chữ × độ rộng chữ (đo 10/10/2026 trên libass).
 *  Bản xuất (W = 1080/1920) và ô xem trước (W = bề rộng ô) cùng tỉ lệ → cùng số ký tự → cùng chỗ xuống dòng. */
export const kyTuMoiDong = (W: number, co: number, ngang = 100): number => Math.max(8, Math.floor((W * 0.92) / (W * co * 0.4 * (ngang / 100))));
