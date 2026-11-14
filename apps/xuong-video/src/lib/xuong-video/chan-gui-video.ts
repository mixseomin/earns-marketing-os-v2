// LUẬT CHẤM TRƯỚC KHI GỬI MODEL VIDEO (anh 14/11/2026: "sửa xong phải luôn cho các phát sinh này vào luật chấm trước khi gửi cho AI"). Mỗi luật là một lỗi đã
// gặp thật ở phim #3071 — có lỗi thì KHÔNG gửi (không tốn tiền), báo đúng câu. Thuần, tự kiểm: chan-gui-video.test.mts.
//   - mã nội bộ lọt prompt ("looks … at dau_ga") — model không hiểu, có khi vẽ chữ
//   - tên nhân vật / chữ tiếng Việt ngoài lời thoại ("Reference image 1 is Chú", câu diễn tiếng Việt) — model không biết tên, in tên lên hình
//   - tả khung ngược tỉ lệ phim ("vertical film" cho phim 16:9 — promptCumMoi ghi cứng trước đây)
//   - clip 3D tham chiếu không phải bản xuất SẠCH (còn tia nhìn / dây đường đi vàng — Seedance chép nguyên vào phim, cụm #2–7)
import { coTiengViet } from './kieu';

/** Bỏ lời thoại ("<ai> says: <câu>") — lời thoại tiếng Việt là ĐÚNG (miệng nhép theo), không tính vào luật chữ. Câu thoại kết ở dấu chấm trước một câu tiếng Anh mới. */
export const boLoiThoai = (p: string): string => p.replace(/says:\s[\s\S]*?(?=\.\s+(?:Shot \d|Keep|No |Reference|Every|The |A |An |Camera|Throughout|Static|Nobody|Real|WHITELIST|Emotional|EXPRESSION)|\.?$)/g, 'says: …');

export function loiPromptGui(prompt: string, o: { tiLe?: string | null; tenNhanVat?: string[] }): string[] {
  const loi: string[] = []; const p = boLoiThoai(prompt);
  const ma = [...new Set(p.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? [])];
  if (ma.length) loi.push(`prompt lộ mã nội bộ: ${ma.slice(0, 5).join(', ')} — đổi sang tên tiếng Anh nhìn thấy được (sổ ten_moc của bộ set)`);
  const ten = (o.tenNhanVat ?? []).filter((t) => t.trim() && new RegExp(`(^|[^\\p{L}])${t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'u').test(p));
  if (ten.length) loi.push(`prompt gọi tên nhân vật ngoài lời thoại: ${ten.join(', ')} — model không biết tên (đảo vai / in tên lên hình): gọi bằng dáng nhìn thấy`);
  if (coTiengViet(p)) { const m = p.match(/[^.;:]*[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ][^.;:]*/i)?.[0]?.trim(); loi.push(`prompt còn chữ tiếng Việt ngoài lời thoại${m ? `: "${m.slice(0, 80)}"` : ''} — chỉ lời thoại được tiếng Việt`); }
  if (o.tiLe === '16:9' && /\bvertical\b/i.test(p)) loi.push('prompt tả "vertical" trong khi phim 16:9');
  if (o.tiLe === '9:16' && /\bwidescreen\b/i.test(p)) loi.push('prompt tả "widescreen" trong khi phim 9:16');
  return loi;
}

/** Clip 3D tham chiếu phải là bản xuất SẠCH (xuat-clip.cjs › dungSach, cờ clip.sach) — clip cũ còn tia vàng thì xuất lại (clip-three-tap.sh). */
export function loiClipThamChieu(ds: { so: number; clip?: { sach?: boolean } | null }[]): string[] {
  const cu = ds.filter((x) => x.clip && x.clip.sach !== true).map((x) => `#${x.so}`);
  return cu.length ? [`clip 3D tham chiếu ${cu.join(' ')} chưa phải bản xuất sạch (còn tia nhìn / dây đường đi) — chạy lại clip-three-tap.sh`] : [];
}
