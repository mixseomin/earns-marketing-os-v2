// CHỌN CÁCH KHỚP MÔI theo LOẠI PHIM (anh 15/11/2026: "ghi lại thế nào để áp dụng phù hợp cho từng loại phim"). Thuần — kế hoạch cụm (scripts/cum-seedance.mts)
// và script sinh đọc cùng một hàm. Hai cách (so sánh: docs/so-sanh-mo-hinh-3d-video.md › Khớp môi):
//   seedance_audio — gửi giọng làm audio tham chiếu (@Audio1 + nguyên văn câu) ngay lúc sinh: mặt + thân diễn theo câu, giữ nét vẽ, gần như 0đ thêm.
//                    Yếu: nhiều người nói trong một lần sinh; tiếng Việt chưa đo (tốt nhất tiếng Trung, rồi tiếng Anh — theo hướng dẫn công khai).
//   sync_v2        — sinh clip câm rồi fal Sync Lipsync v2 vẽ lại vùng miệng theo giọng (scripts/khop-moi-shot.mts): khớp âm chặt, ít phụ thuộc ngôn ngữ,
//                    $3/phút; rủi ro lệch nét trên phim vẽ (model học mặt người thật).
// TRẠNG THÁI: luật GIẢ ĐỊNH theo đặc tính hai cách — chưa đo trên phim nào. Đo xong (A/B shot #4 phim #3071) thì sửa bảng LUAT và ghi kết quả vào sổ so sánh.
import type { ChatLieu } from './prompt-khoi';

export type CachKhopMoi = 'seedance_audio' | 'sync_v2';
export function chonCachKhopMoi(o: { chatLieu: ChatLieu; ngonNgu?: string | null; soNguoiNoi: number }): { cach: CachKhopMoi; vi: string } {
  const nn = String(o.ngonNgu ?? 'vi').slice(0, 2).toLowerCase();
  // nhiều người nói trong MỘT lần sinh: Seedance nhép lẫn (ByteDance tự nhận) — tách cụm mỗi lần một người nói, hoặc khớp sau từng shot
  if (o.soNguoiNoi > 1) return { cach: 'sync_v2', vi: `${o.soNguoiNoi} người nói trong một lần sinh — Seedance nhép lẫn người; tách cụm theo người nói hoặc khớp sau từng shot` };
  // phim VẼ / hoạt hình: giữ nét vẽ quan trọng hơn khớp từng âm — khớp sau có thể vẽ miệng kiểu người thật
  if (o.chatLieu !== 'nguoi_that') return { cach: 'seedance_audio', vi: 'phim vẽ / hoạt hình — sinh kèm giọng giữ nét vẽ, mặt diễn theo câu' };
  // người thật: tiếng Trung / Anh Seedance khớp tốt; ngôn ngữ khác (tiếng Việt) khớp sau chặt hơn
  if (nn === 'zh' || nn === 'en') return { cach: 'seedance_audio', vi: `người thật, tiếng ${nn} — Seedance khớp tốt, một lượt` };
  return { cach: 'sync_v2', vi: `người thật, tiếng ${nn} — Seedance chưa đo tiếng này, khớp sau bám âm vị chặt hơn` };
}
