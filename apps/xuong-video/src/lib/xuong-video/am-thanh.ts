// Giọng · hiệu ứng âm thanh · nhạc nền cho studio (anh chốt 08/10/2026 sau #1194: "làm cả giọng và âm thanh, ánh sáng").
// Model + giá đọc trên trang fal 08/10/2026. File thuần dữ liệu — client lẫn server import được.
//   Giọng: mỗi nhân vật chọn MỘT giọng (model + voice) giữ cố định cả bộ phim → series không đổi giọng giữa các tập.
//   Hiệu ứng: shot đã có clip → sinh từ chính clip (khớp hành động); chưa có clip → sinh từ mô tả âm thanh + kỹ thuật âm thanh của shot.
//   Nhạc: một bài nền cho cả tập, dài bằng tập, lời nhắc ghép từ thể loại + kỹ thuật nhạc của các shot + đường cong cảm xúc.
import type { Canh, NhanVat } from './kieu';

export type LoaiAm = 'giong' | 'sfx_video' | 'sfx_chu' | 'nhac';
export type MoHinhAm = { key: string; ten: string; loai: LoaiAm; /** cents mỗi đơn vị */ gia: number; donVi: '1k_ky_tu' | 'giay' | 'phut'; ghiChu: string };

export const MO_HINH_AM: MoHinhAm[] = [
  { key: 'fal-ai/elevenlabs/tts/eleven-v3', ten: 'ElevenLabs v3 (diễn cảm xúc)', loai: 'giong', gia: 10, donVi: '1k_ky_tu', ghiChu: 'Diễn cảm tốt nhất, hiểu thẻ [sad] [whispers] [excited]; nhiều ngôn ngữ kể cả tiếng Việt' },
  { key: 'fal-ai/minimax/speech-02-hd', ten: 'MiniMax Speech 02 HD', loai: 'giong', gia: 10, donVi: '1k_ky_tu', ghiChu: 'Có tham số cảm xúc (vui/buồn/sợ/giận), tối ưu tiếng Việt' },
  { key: 'mirelo-ai/sfx-v1/video-to-audio', ten: 'Mirelo SFX (từ clip)', loai: 'sfx_video', gia: 0.7, donVi: 'giay', ghiChu: 'Nghe hình mà tạo tiếng khớp hành động' },
  { key: 'fal-ai/elevenlabs/sound-effects/v2', ten: 'ElevenLabs SFX (từ mô tả)', loai: 'sfx_chu', gia: 0.2, donVi: 'giay', ghiChu: 'Hiệu ứng từ câu mô tả' },
  { key: 'sonilo/v1.1/text-to-sound-effects', ten: 'Sonilo SFX (từ mô tả, rẻ)', loai: 'sfx_chu', gia: 0.18, donVi: 'giay', ghiChu: 'Rẻ nhất' },
  { key: 'cassetteai/music-generator', ten: 'CassetteAI Music (rẻ)', loai: 'nhac', gia: 2, donVi: 'phut', ghiChu: 'Nhạc nền không lời, rất rẻ' },
  { key: 'fal-ai/elevenlabs/music', ten: 'ElevenLabs Music', loai: 'nhac', gia: 60, donVi: 'phut', ghiChu: 'Chất lượng cao, làm tròn lên phút' },
];
export const moHinhAm = (key: string) => MO_HINH_AM.find((m) => m.key === key);
/** Giá (cents) cho một lượt: số ký tự (giọng) hoặc số giây (sfx/nhạc). */
export function giaAm(key: string, luong: number): number {
  const m = moHinhAm(key);
  if (!m) return 0;
  if (m.donVi === '1k_ky_tu') return (Math.max(1, luong) / 1000) * m.gia;
  if (m.donVi === 'giay') return Math.max(1, luong) * m.gia;
  return (key === 'fal-ai/elevenlabs/music' ? Math.ceil(luong / 60) : luong / 60) * m.gia;
}

/** Giọng có sẵn theo model (tên gốc của model + mô tả tiếng Việt gần đúng để chọn). */
export const GIONG: Record<string, { id: string; ta: string }[]> = {
  'fal-ai/elevenlabs/tts/eleven-v3': [
    { id: 'Aria', ta: 'nữ trưởng thành, biểu cảm, hơi khàn' }, { id: 'Sarah', ta: 'nữ trẻ, nhẹ nhàng, tin cậy' }, { id: 'Laura', ta: 'nữ trẻ, sôi nổi, hơi lạ' },
    { id: 'Charlotte', ta: 'nữ, mềm, quyến rũ' }, { id: 'Alice', ta: 'nữ giọng Anh, tự tin' }, { id: 'Matilda', ta: 'nữ, ấm áp, thân thiện' },
    { id: 'Jessica', ta: 'nữ trẻ, tươi, biểu cảm' }, { id: 'Lily', ta: 'nữ giọng Anh, ấm, dịu' }, { id: 'River', ta: 'trung tính, điềm tĩnh' },
    { id: 'Roger', ta: 'nam, tự tin, thoải mái' }, { id: 'Charlie', ta: 'nam giọng Úc, tự nhiên, vui' }, { id: 'George', ta: 'nam giọng Anh, ấm, trầm, kể chuyện' },
    { id: 'Callum', ta: 'nam, khàn, cường độ cao' }, { id: 'Liam', ta: 'nam trẻ, rõ ràng' }, { id: 'Will', ta: 'nam trẻ, thân thiện, thoải mái' },
    { id: 'Eric', ta: 'nam trung niên, thân thiện' }, { id: 'Chris', ta: 'nam, bình dị, gần gũi' }, { id: 'Brian', ta: 'nam trầm, đọc truyện' },
    { id: 'Daniel', ta: 'nam giọng Anh, phát thanh viên' }, { id: 'Bill', ta: 'nam lớn tuổi, đáng tin' },
  ],
  'fal-ai/minimax/speech-02-hd': [
    { id: 'Wise_Woman', ta: 'nữ lớn tuổi, thông thái' }, { id: 'Calm_Woman', ta: 'nữ, điềm tĩnh' }, { id: 'Friendly_Person', ta: 'trung tính, thân thiện' },
    { id: 'Inspirational_girl', ta: 'nữ trẻ, truyền cảm hứng' }, { id: 'Lively_Girl', ta: 'bé gái, lanh lợi' }, { id: 'Lovely_Girl', ta: 'bé gái, đáng yêu' },
    { id: 'Sweet_Girl_2', ta: 'nữ trẻ, ngọt' }, { id: 'Exuberant_Girl', ta: 'nữ trẻ, hào hứng' }, { id: 'Abbess', ta: 'nữ, trang nghiêm' },
    { id: 'Deep_Voice_Man', ta: 'nam trầm' }, { id: 'Casual_Guy', ta: 'nam, thoải mái' }, { id: 'Patient_Man', ta: 'nam, kiên nhẫn, chậm' },
    { id: 'Young_Knight', ta: 'nam trẻ, dũng cảm' }, { id: 'Determined_Man', ta: 'nam, quyết đoán' }, { id: 'Decent_Boy', ta: 'bé trai, lễ phép' },
    { id: 'Imposing_Manner', ta: 'nam, uy nghi' }, { id: 'Elegant_Man', ta: 'nam, lịch lãm' },
  ],
};

/** Ai nói câu thoại: "Lio: ..." → Lio; không ghi thì nhân vật đầu tiên của shot. Dùng chung timeline + máy chủ. */
export function nguoiNoi(c: Pick<Canh, 'loi_thoai' | 'nhan_vat'>, nv: NhanVat[]): NhanVat | null {
  const m = c.loi_thoai.match(/^\s*([^:"“]{1,40}?)\s*:/);
  if (m) { const ten = m[1]!.toLowerCase(); const v = nv.find((x) => x.ten.toLowerCase() === ten) ?? nv.find((x) => ten.includes(x.ten.toLowerCase())); if (v) return v; }
  return nv.find((x) => x.loai === 'nhan_vat' && c.nhan_vat.includes(x.id)) ?? null;
}
/** Lời thật cần đọc: bỏ "Tên:" đầu câu, bỏ ngoặc kép, bỏ chú thích "Chữ:"/"Text on screen:" (chữ trên màn không đọc). */
export function loiCanDoc(loi: string): string {
  return loi.replace(/^\s*[^:"“]{1,40}:\s*/, '').split(/\b(Chữ( kết)?|Text on screen)\s*:/i)[0]!.replace(/["“”]/g, '').trim();
}
