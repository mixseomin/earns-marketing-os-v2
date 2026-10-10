// Giọng · hiệu ứng âm thanh · nhạc nền cho studio (anh chốt 08/10/2026 sau #1194: "làm cả giọng và âm thanh, ánh sáng").
// Model + giá đọc trên trang fal 08/10/2026. File thuần dữ liệu — client lẫn server import được.
//   Giọng: mỗi nhân vật chọn MỘT giọng (model + voice) giữ cố định cả bộ phim → series không đổi giọng giữa các tập.
//   Hiệu ứng: shot đã có clip → sinh từ chính clip (khớp hành động); chưa có clip → sinh từ mô tả âm thanh + kỹ thuật âm thanh của shot.
//   Nhạc: một bài nền cho cả tập, dài bằng tập, lời nhắc ghép từ thể loại + kỹ thuật nhạc của các shot + đường cong cảm xúc.
import type { Canh, NhanVat, DongThoai } from './kieu';
import { CAM_XUC_EN } from './kieu';

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

/** Người nói của một dòng thoại để HIỂN THỊ/NHÓM — dòng không ghi tên = lời dẫn. Một chỗ cho mọi màn (thẻ shot, bảng ＋, timeline). */
export const LOI_DAN = 'Lời dẫn';
export const tenNoi = (d: Pick<DongThoai, 'nhan_vat'>): string => d.nhan_vat.trim() || LOI_DAN;
export const cungTen = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Nhân vật theo tên người nói (không phân biệt hoa thường, bỏ khoảng trắng thừa). */
export const timNv = <T extends Pick<NhanVat, 'ten'>>(nv: T[], ten: string): T | undefined => nv.find((x) => cungTen(x.ten, ten));
/** Tiếng sẵn của clip (Veo/Kling tự sinh) CHỈ được dùng khi shot có người NÓI TRONG KHUNG mà dòng đó chưa có file giọng riêng — tức model
 *  video là nguồn duy nhất của câu nói (khớp miệng). Mọi trường hợp khác TẮT, kể cả shot không có thoại: Veo tự bịa giọng/nhạc/tiếng rít
 *  (10/10/2026, phim #5: shot 3 có giọng nam 129 Hz không ai viết, shot 15/20/21 ồn -11 LUFS, shot 2 im -44) → bật lên là nền nhảy 30 dB
 *  giữa các shot. Shot có hiệu ứng riêng (am_thanh_url) cũng tắt. MỘT luật cho timeline, bản xuất và lúc gửi sinh video (generate_audio). */
export const dungTiengClip = (c: Pick<Canh, 'thoai' | 'loi_thoai' | 'nhan_vat' | 'thoai_url' | 'am_thanh_url'>, nv: NhanVat[]): boolean =>
  !c.am_thanh_url && dongThoai(c, nv).some((d) => !!d.nhan_vat.trim() && !laLoiDan(d.dien_xuat) && !d.url);
/** Giọng mặc định khi nhân vật chưa chọn giọng cố định (model fal; máy chủ có khoá ElevenLabs riêng thì đổi sang ElevenLabs trực tiếp). */
export const GIONG_MAC_DINH = { model: 'fal-ai/elevenlabs/tts/eleven-v3', voice: 'George' };
/** Giá (cents) một câu đọc theo model giọng — MỘT luật cho nút, bảng ＋ và sổ chi phí. null = model không công bố giá
 *  (hiện "chưa rõ giá", không đoán số). ~15 ký tự mỗi giây đọc cho model tính theo giây. */
export type GiaGiongModel = { giaCents: number | null; donVi: '1k_ky_tu' | 'giay' | 'luot' | 'khac' };
export function giaGiong(m: GiaGiongModel | undefined, soKyTu: number): number | null {
  if (!m || m.giaCents == null) return null;
  if (m.donVi === '1k_ky_tu') return (Math.max(1, soKyTu) / 1000) * m.giaCents;
  if (m.donVi === 'giay') return Math.max(1, soKyTu / 15) * m.giaCents;
  if (m.donVi === 'luot') return m.giaCents;
  return null;
}

/** Nhân vật (loại nhan_vat) xuất hiện ĐẦU TIÊN theo thứ tự của shot — không theo thứ tự danh sách nhân vật của phim. */
function nhanVatDauCua(c: Pick<Canh, 'nhan_vat'>, nv: NhanVat[]): NhanVat | undefined {
  for (const id of c.nhan_vat) { const v = nv.find((x) => x.id === id && x.loai === 'nhan_vat'); if (v) return v; }
  return undefined;
}
/** Thoại của shot theo DÒNG — một nguồn cho mọi chỗ (thẻ shot, form, bảng ＋, timeline, máy chủ sinh giọng).
 *  Shot mới: c.thoai. Shot cũ chỉ có chuỗi loi_thoai: tách từng dòng "Tên (diễn xuất): lời"; dòng không ghi tên → nhân vật đầu tiên của shot
 *  (#1204: thẻ shot cũ không hiện thoại, bảng giọng ghi nhầm "Lời dẫn"). Bỏ chú thích chữ trên màn ("Chữ:", "Text on screen:"). */
export function dongThoai(c: Pick<Canh, 'thoai' | 'loi_thoai' | 'nhan_vat' | 'thoai_url'>, nv: NhanVat[]): DongThoai[] {
  if (c.thoai?.length) return c.thoai.filter((d) => d.loi.trim());
  const mac = nhanVatDauCua(c, nv)?.ten ?? '';
  const ds: DongThoai[] = c.loi_thoai.split('\n').map((l) => l.split(/\b(Chữ( kết)?|Text on screen)\s*:/i)[0]!.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^\s*([^:"“(]{1,40}?)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/);
    const ten = m ? m[1]!.trim() : '';
    const laNv = ten && !!timNv(nv, ten);
    return m && laNv ? { nhan_vat: ten, dien_xuat: (m[2] ?? '').trim(), loi: m[3]!.replace(/["“”]/g, '').trim() } : { nhan_vat: mac, dien_xuat: '', loi: l.replace(/["“”]/g, '').trim() };
  }).filter((d) => d.loi);
  if (ds.length === 1 && c.thoai_url) ds[0] = { ...ds[0]!, url: c.thoai_url };
  return ds;
}


/** Cảm xúc của shot ĐI VÀO prompt ảnh/video (#1248) — đọc lúc sinh, nên sửa cảm xúc khán giả / diễn xuất ở form là lần sinh sau ăn theo,
 *  không phụ thuộc Claude đã viết sẵn vào prompt hay chưa. Ảnh: biểu cảm + không khí khung tĩnh; video: diễn xuất theo từng câu. */
/** Ghi chú diễn xuất là lời dẫn ngoài khung (V.O./voice-over/off-screen) — không ai trong khung diễn theo nó. */
export const laLoiDan = (dienXuat: string): boolean => /\bV\.?\s?O\.?\b|voice[- ]?over|off[- ]?screen|ngoài khung|lời dẫn/i.test(dienXuat);
export function promptCamXuc(c: Pick<Canh, 'cam_xuc' | 'thoai' | 'loi_thoai' | 'nhan_vat' | 'thoai_url'>, nv: NhanVat[], loai: 'anh' | 'video'): string {
  const v = Math.max(-5, Math.min(5, Math.round(c.cam_xuc || 0)));
  const moodEn = CAM_XUC_EN[v] ?? '';
  // Chỉ diễn xuất của người NÓI TRONG KHUNG (lời dẫn V.O. không áp lên ai), bỏ nhãn "V.O.", KHÔNG đặt trong ngoặc kép (model ảnh/video dễ in
  // câu trong ngoặc thành chữ) và không ghi cứng "Vietnamese" — ghi chú đi theo ngôn ngữ phim (09/10/2026).
  const dx = dongThoai(c, nv).filter((d) => d.nhan_vat.trim() && !laLoiDan(d.dien_xuat)).map((d) => `${d.nhan_vat.trim()}: ${d.dien_xuat.trim()}`).filter((x) => !/:\s*$/.test(x));
  const out: string[] = [];
  if (loai === 'anh') {
    if (dx[0]) out.push(`Facial expression and body language (director's note) — ${dx[0]}.`);
    if (moodEn && v !== 0) out.push(`Mood: the frame should make the viewer feel ${moodEn} — show it in the expression, lighting and color.`);
  } else {
    if (dx.length) out.push(`Performance, in order (director's notes) — ${dx.map((x, i) => `${i + 1}) ${x}`).join('; ')}.`);
    if (moodEn && v !== 0) out.push(`Emotional beat: by the end of the shot the viewer feels ${moodEn}.`);
  }
  return out.join(' ');
}
