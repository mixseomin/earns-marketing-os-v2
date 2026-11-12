// TỐC ĐỘ NÓI + CÁCH DIỄN của câu thoại — thuần (không DB, không mạng): dùng được cả trình duyệt (diem-murch.ts trên lưới) lẫn máy chủ (giong.ts gửi model TTS).
// Tách khỏi giong.ts 13/11/2026: giong.ts chỉ chạy máy chủ, kéo nó vào màn studio làm build hỏng.
/** CÁCH DIỄN của một câu → tốc độ + cảm xúc cho model TTS (anh 12/11/2026: "Chú cho cháu 5 nghìn cứ chậm chậm ngắt quãng" — trước đây dien_xuat
 *  không hề tới MiniMax: luôn speed 1 + cảm xúc của cả shot, giọng Việt đọc ~2,5 tiếng/giây). Câu có khai cách diễn = lời thoại đời thường → nền 1,1;
 *  từ khoá nhanh / chậm chỉnh tiếp; cảm xúc theo từ khoá. Câu khai thẳng `toc` / `cam` thì dùng đúng số đó. Thuần — test giong.test.mts. */
export function docCachDien(d?: string | null): { toc: number | null; cam: string | null } {
  const x = (d ?? '').toLowerCase().trim(); if (!x) return { toc: null, cam: null };
  const co = (ds: string[]) => ds.some((k) => x.includes(k));
  const toc = co(['lí nhí', 'ngập ngừng', 'thì thầm', 'nghẹn', 'chậm rãi', 'chậm lại', 'thẫn thờ']) && !co(['hỏi dồn', 'gấp', 'vội'])
    ? 0.95 : co(['nhanh', 'gấp', 'hỏi dồn', 'vội', 'chuồn', 'sốt ruột', 'gọi với', 'líu']) ? 1.18 : 1.1;
  const cam = co(['bực', 'gắt', 'giận', 'quát']) ? 'angry' : co(['ngạc nhiên', 'sững', 'giật mình']) ? 'surprised'
    : co(['buồn', 'lí nhí', 'xin lỗi', 'nghẹn']) ? 'sad' : co(['vui', 'cười', 'hào phóng', 'ấm', 'thân mật', 'phấn khởi']) ? 'happy' : null;
  return { toc, cam };
}
/** TỐC ĐỘ NÓI ĐO ĐƯỢC của một câu đã sinh: tiếng / giây (tiếng Việt: mỗi chữ cách nhau là một tiếng; số viết tắt "5k" = hai tiếng). null = chưa đo độ dài. */
export function tiengGiay(d: { loi?: string; dai?: number | null }): number | null {
  if (!d.dai || !d.loi?.trim()) return null;
  const n = d.loi.replace(/(\d+)k\b/gi, '$1 nghìn').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).length;
  return Math.round((n / d.dai) * 10) / 10;
}
/** Sàn tốc độ nói của lời thoại thường (tiếng / giây): đối thoại tiếng Việt tự nhiên ~4,5–5,5; dưới 4 là lê thê — trừ câu khai cách diễn chậm (lí nhí, ngập ngừng…). */
export const SAN_TIENG_GIAY = 4;
