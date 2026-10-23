// CẮT CÓ CỚ (anh 23/10/2026, phim #322 cảnh Thang máy: "các cảnh đang thiếu tính liên kết tự nhiên — vd Vivian liếc sang trái ở gần cuối rồi mới
// sang cảnh Thần, như bắt đầu tiếp nhận rồi mới diễn tiếp… mọi thứ đang rất rời rạc"). Gốc: mỗi mảnh 1–2 s viết như một việc đứng riêng — không
// mảnh nào GIEO cớ ở đuôi cho mảnh sau, không mảnh nào NHẬN cớ ở đầu. Ngữ pháp dựng: mỗi điểm cắt có một cớ —
//   nhin     : đuôi shot trước có ánh mắt / quay đầu về phía thứ shot sau cho thấy (eyeline cut)
//   tieng    : tiếng của shot sau vang TRƯỚC điểm cắt (J-cut — sfx 'key@-giây', sfx.ts)
//   dong_tac : động tác bắt đầu ở đuôi shot trước, nối tiếp ở đầu shot sau (cut on action)
//   phan_ung : câu / hành động xong ở đuôi shot trước, shot sau mở bằng người nghe đang tiếp nhận
// Đuôi = dan_dung.ket, đầu = dan_dung.mo (vào prompt video: "the action runs from … to …"). Thuần — tự kiểm: noi-nhip.test.mts
import type { DanDung } from './kieu';

export type KieuNoi = NonNullable<DanDung['noi']>;
export const TEN_NOI: Record<KieuNoi, string> = { nhin: 'theo ánh mắt', tieng: 'theo tiếng vang trước điểm cắt', dong_tac: 'theo động tác', phan_ung: 'sang người tiếp nhận' };
const NHIN = /\b(look|looks|looking|glance|glances|eyes?|gaze|stares?|turns? (her|his|their) head|watch(es|ing)?)\b/i;
type Shot = { thu_tu?: number; dan_dung?: DanDung | null; ky_thuat?: { am_thanh?: string[] } | null };
/** HƯỚNG MƠ HỒ: "to her right" là TRÁI màn hình khi người quay mặt về máy — model hiểu theo người, người viết nghĩ theo màn hình (#322 #2 23/10/2026:
 *  viết "eyes slide to her right … toward screen right" → Hạ quay sang trái màn hình, sai trục với Vivian vào từ phải). Hướng nối cắt chỉ ghi "screen left/right". */
const HUONG_NGUOI = /\b(to|toward|towards)\s+(her|his|their)\s+(left|right)\b/i;

/** Lỗi nối cắt của một chuỗi shot liền nhau (cùng phân cảnh). Rỗng = mọi điểm cắt có cớ, có đuôi gieo và đầu nhận. */
export function loiNoiNhip(ds: Shot[]): string[] {
  const so = (c: Shot, i: number) => `#${c.thu_tu ?? i + 1}`; const out: string[] = [];
  for (let i = 0; i + 1 < ds.length; i++) {
    const a = ds[i]!; const b = ds[i + 1]!; const k = a.dan_dung?.noi; const cat = `${so(a, i)}→${so(b, i + 1)}`;
    if (!k) { out.push(`${cat}: chưa khai cớ cắt (nhìn / tiếng / động tác / tiếp nhận)`); continue; }
    if (!a.dan_dung?.ket?.trim()) out.push(`${cat}: đuôi ${so(a, i)} trống — không gieo gì cho cắt ${TEN_NOI[k]}`);
    if (!b.dan_dung?.mo?.trim()) out.push(`${cat}: đầu ${so(b, i + 1)} trống — không nhận cớ từ ${so(a, i)}`);
    for (const [ten, c, j] of [['đuôi', a, i], ['đầu', b, i + 1]] as const) { const t = ten === 'đuôi' ? c.dan_dung?.ket : c.dan_dung?.mo; if (t && HUONG_NGUOI.test(t)) out.push(`${cat}: ${ten} ${so(c, j)} ghi hướng theo người ("${t.match(HUONG_NGUOI)![0]}") — model lật trái/phải; ghi "screen left/right"`); }
    if (k === 'nhin' && a.dan_dung?.ket && !NHIN.test(a.dan_dung.ket)) out.push(`${cat}: cắt theo ánh mắt mà đuôi ${so(a, i)} không có cái nhìn`);
    if (k === 'tieng' && !(a.ky_thuat?.am_thanh ?? []).some((x) => /@-/.test(x))) out.push(`${cat}: cắt theo tiếng mà không có tiếng nào vang trước điểm cắt (âm thanh 'key@-0.6' ở ${so(a, i)})`);
  }
  return out;
}
