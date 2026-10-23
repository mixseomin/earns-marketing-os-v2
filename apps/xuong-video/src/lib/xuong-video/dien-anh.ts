// Thư viện ngôn ngữ điện ảnh của studio (góp ý #1194 + #1195, 08/10/2026): cỡ cảnh · góc máy · chuyển động máy · ống kính · ánh sáng ·
// màu · chuyển cảnh · âm thanh · nhạc, mỗi kỹ thuật gắn thể loại hợp với nó (kinh dị ≠ hài ≠ quảng cáo UGC) + cấu trúc beat theo loại phim.
// Claude chọn kỹ thuật cho từng shot TỪ thư viện này (theo thể loại của phim); `prompt` (tiếng Anh) được ghép vào prompt ảnh/video
// nên ảnh + clip ra đúng cỡ cảnh, ánh sáng, chuyển động. File thuần dữ liệu — client lẫn server import được.
import { luatDung } from './luat-dung';
import { NGANH, type NganhKyThuat, type MayDi } from './dien-anh-nganh';
import { THU_VIEN_THEM, THU_VIEN_THEM_MAY } from './dien-anh-them';
export type { NganhKyThuat, MayDi } from './dien-anh-nganh';

export type TheLoai = 'hoat_hinh' | 'phieu_luu' | 'kinh_di' | 'hanh_dong' | 'tinh_cam' | 'hai' | 'chinh_kich' | 'vien_tuong' | 'tai_lieu' | 'qc_ugc' | 'qc_cao_cap' | 'phim_doc';
export type NhomKyThuat = 'vai' | 'co_canh' | 'goc' | 'chuyen_dong' | 'dien_xuat' | 'toc_do' | 'ong_kinh' | 'anh_sang' | 'mau' | 'chuyen_canh' | 'am_thanh' | 'nhac' | 'hook';
/** xfade/nhom_cc/giay_cc: riêng nhóm chuyển cảnh — kiểu ffmpeg xfade mà BẢN XUẤT dựng thật giữa shot này và shot sau, nhóm kiểu CapCut, độ dài (giây). */
/** nganh = mô tả ngành đầy đủ (khung mở → kết, cách làm, động cơ, tác động, lỗi hay gặp, nguồn) và may_di = phần số cho máy 3D — dien-anh-nganh.ts. */
export type KyThuat = { key: string; nhom: NhomKyThuat; ten: string; mo_ta: string; prompt: string; the_loai: TheLoai[] | 'tat_ca'; xfade?: string; nhom_cc?: NhomChuyenCanh; giay_cc?: number; nganh?: NganhKyThuat; may_di?: MayDi };
export type NhomChuyenCanh = 'cat' | 'co_ban' | 'truot' | 'quet' | 'hinh' | 'dong';
/** Nhóm hiệu ứng chuyển cảnh (kiểu CapCut) — để chọn theo nhóm. 'cat' = cắt thẳng/kỹ thuật dựng không có hiệu ứng hình. */
export const NHOM_CHUYEN_CANH: { key: NhomChuyenCanh; ten: string }[] = [
  { key: 'cat', ten: 'Cắt (không hiệu ứng)' }, { key: 'co_ban', ten: 'Cơ bản' }, { key: 'truot', ten: 'Trượt' }, { key: 'quet', ten: 'Quét' }, { key: 'hinh', ten: 'Hình khối' }, { key: 'dong', ten: 'Động' },
];
/** Kỹ thuật đã chọn cho một shot (mỗi nhóm một key; âm thanh có thể nhiều). */
/** giay_cc: số giây chuyển cảnh đặt tay cho điểm nối SAU shot này (#1297) — trống = mặc định của kiểu. */
/** luat = mã luật dựng cảnh (luat-dung.ts) shot này thực hiện — shot ref tới thư viện. */
/** nen_ghep = shot NỀN GHÉP của khuôn đổi nền (mot_dang_moi_noi): ảnh nền không người, nơi chốn xuất hiện MỘT lần, người cắt nền phủ lên —
 *  keyframe của shot chính là mẫu nơi đó nên không cần anchor Bối cảnh (quy-trinh.ts › thieuMau); nơi lặp lại vẫn phải có anchor. */
export type KyThuatShot = Partial<Record<Exclude<NhomKyThuat, 'am_thanh'>, string>> & { am_thanh?: string[]; giay_cc?: number; luat?: string[]; nen_ghep?: boolean;
  /** ĐIỂM VÀO CLIP (giây): bản dựng lấy đoạn phát bắt đầu từ đây thay vì đầu clip — mảnh ReelShort 1–2 s cắt đúng khoảnh khắc diễn trong clip 4–8 s
   *  (#322 #4: mắt chỉ liếc ở giây cuối). Không khai = bỏ ≤ 0,5 s đầu như cũ. */ vao_s?: number;
  /** KỲ VỌNG từ sơ đồ cảnh (so-do-canh.ts › kyVong): người → phía màn (−1 trái / 0 giữa / +1 phải) + phía nhìn — cổng scripts/soat-huong.mts so với soi mặt */
  huong_so?: Record<string, { ben: -1 | 0 | 1; nhin?: -1 | 0 | 1 }>;
  /** TRẠNG THÁI ĐỒ VẬT ở shot này (so-vat.ts › dongVat, tiếng Việt cho người đọc storyboard; ⚡ = đổi ngay tại shot này) */ vat?: string[] };

/** VẬT LÝ THẬT trong clip (19/10/2026 #1 tổng tài: câu diễn "coffee arcs" → cà phê vọt lên trời): chất lỏng / đồ vật theo trọng lực. Thể loại được
 *  phép phá vật lý (anh: "các dạng viễn tưởng… sẽ có ngoại lệ về vật lý") — viễn tưởng (phép thuật, phản trọng lực), hoạt hình (cường điệu), kinh dị
 *  (vật bay, siêu nhiên) — không nhận câu này. */
export const THE_LOAI_PHA_VAT_LY: ReadonlySet<TheLoai> = new Set<TheLoai>(['vien_tuong', 'hoat_hinh', 'kinh_di']);
export const cauVatLy = (tl: TheLoai | '' | undefined): string => (tl && THE_LOAI_PHA_VAT_LY.has(tl) ? '' : 'Real-world physics: liquids pour and splash downward with gravity, objects fall naturally — nothing flies upward or hangs in the air unless it is thrown upward.');
export const THE_LOAI: { key: TheLoai; ten: string; mo_ta: string }[] = [
  { key: 'hoat_hinh', ten: 'Hoạt hình gia đình', mo_ta: 'Ấm áp, màu tươi, máy mềm, cảm xúc rõ ràng' },
  { key: 'phieu_luu', ten: 'Phiêu lưu', mo_ta: 'Khung rộng hùng vĩ, cẩu máy, nhạc dàn nhạc' },
  { key: 'kinh_di', ten: 'Kinh dị', mo_ta: 'Bóng tối, góc nghiêng, im lặng rồi doạ, âm trầm' },
  { key: 'hanh_dong', ten: 'Hành động', mo_ta: 'Cắt nhanh, máy cầm tay, góc thấp, trống dồn' },
  { key: 'tinh_cam', ten: 'Tình cảm', mo_ta: 'Cận mặt, ánh vàng, chuyển chậm, piano' },
  { key: 'hai', ten: 'Hài', mo_ta: 'Sáng đều, khung tĩnh, cắt đúng nhịp, nhạc nảy' },
  { key: 'chinh_kich', ten: 'Chính kịch', mo_ta: 'Tương phản sáng tối, máy chậm, khoảng lặng' },
  { key: 'vien_tuong', ten: 'Viễn tưởng', mo_ta: 'Neon, teal-cam, ống anamorphic, âm điện tử' },
  { key: 'tai_lieu', ten: 'Tài liệu', mo_ta: 'Ánh sáng tự nhiên, máy quan sát, âm hiện trường' },
  { key: 'qc_ugc', ten: 'Quảng cáo UGC', mo_ta: 'Điện thoại cầm tay, nói vào máy, sáng cửa sổ, cắt nhanh' },
  { key: 'qc_cao_cap', ten: 'Quảng cáo cao cấp', mo_ta: 'Sản phẩm hoàn hảo, đèn studio, macro, chuyển động mượt' },
  { key: 'phim_doc', ten: 'Phim ngắn dọc (tổng tài / micro-drama)', mo_ta: 'Cận mặt, đối thoại qua vai, sang trọng lạnh, cắt theo câu thoại, nhạc căng; mỗi 15–30s một nút thắt, cuối tập là cliffhanger' },
];

export const NHOM_KY_THUAT: { key: NhomKyThuat; ten: string; icon: string }[] = [
  { key: 'vai', ten: 'Vai kể / điểm nhìn', icon: '👁' }, { key: 'co_canh', ten: 'Cỡ cảnh', icon: '🔲' }, { key: 'goc', ten: 'Góc máy', icon: '📐' }, { key: 'chuyen_dong', ten: 'Chuyển động máy', icon: '🎥' }, { key: 'dien_xuat', ten: 'Diễn xuất cảm xúc', icon: '🎭' }, { key: 'toc_do', ten: 'Tốc độ (dựng)', icon: '⏩' },
  { key: 'ong_kinh', ten: 'Ống kính', icon: '🔭' }, { key: 'anh_sang', ten: 'Ánh sáng', icon: '💡' }, { key: 'mau', ten: 'Màu', icon: '🎨' },
  { key: 'chuyen_canh', ten: 'Chuyển cảnh', icon: '✂' }, { key: 'am_thanh', ten: 'Âm thanh', icon: '🔊' }, { key: 'nhac', ten: 'Nhạc', icon: '🎵' },
  { key: 'hook', ten: 'Móc câu (hook)', icon: '🪝' },
];

const T = 'tat_ca' as const;
const k = (nhom: NhomKyThuat, key: string, ten: string, mo_ta: string, prompt: string, the_loai: TheLoai[] | 'tat_ca'): KyThuat => ({ key, nhom, ten, mo_ta, prompt, the_loai });
/** Chuyển cảnh có hiệu ứng hình (bản xuất dựng bằng xfade). */
const cc = (key: string, ten: string, mo_ta: string, nhom_cc: NhomChuyenCanh, xfade: string, giay_cc = 0.4, the_loai: TheLoai[] | 'tat_ca' = T): KyThuat => ({ key, nhom: 'chuyen_canh', ten, mo_ta, prompt: '', the_loai, xfade, nhom_cc, giay_cc });

/** Chuyển cảnh thật giữa hai shot liền nhau — MỘT luật cho bản xuất (xfade) lẫn timeline (dải + xem trước): d = giây kiểu, không quá nửa
 *  thời lượng phát của mỗi bên, làm tròn 0,01s; dưới 0,1s hoặc kiểu không có hiệu ứng hình → null (cắt thẳng). */
/** giayTay = số giây đặt tay (ky_thuat.giay_cc của shot trước); muon = số giây xin (tay hoặc mặc định), d = số giây thật sau khi chặn nửa shot. */
export function chuyenCanhGiua(key: string | undefined, phatTruoc: number, phatSau: number, giayTay?: number): { kt: KyThuat; xfade: string; d: number; muon: number } | null {
  const kt = kyThuat(key, 'chuyen_canh');
  if (!kt?.xfade) return null;
  const muon = giayTay && giayTay > 0 ? giayTay : kt.giay_cc ?? 0.4;
  const d = Math.round(Math.min(muon, phatTruoc * 0.5, phatSau * 0.5) * 100) / 100;
  return d >= 0.1 ? { kt, xfade: kt.xfade, d, muon } : null;
}

const THU_VIEN_GOC: KyThuat[] = [
  // ── Vai kể / điểm nhìn (14/10/2026 — "shot thiếu góc người thứ 3, góc tổng thể, góc tâm trạng, dẫn thời gian"): shot này kể bằng mắt
  // AI và để làm gì trong cảnh. Cỡ cảnh nói khung rộng/hẹp; vai nói chức năng. Cổng tiền kỳ đòi đủ vai (nhip-hinh.ts › kiemVaiKe).
  k('vai', 'thiet_lap', 'Thiết lập (nơi + thời điểm)', 'Cho thấy ĐANG Ở ĐÂU và LÚC NÀO trước khi chuyện xảy ra: cả nơi chốn + giờ trong ngày qua ánh sáng.', 'establishing shot that shows where and when: the whole place and the time of day told by its light', T),
  k('vai', 'thoi_gian', 'Dấu thời gian', 'Một hình cho biết giờ / thời gian trôi: đèn tắt, ánh bình minh bò qua bàn, bóng đổ dài, màn hình tối dần.', 'a clear visual cue of the time of day or of time passing: the colour and direction of the light, long shadows, a lamp or screen changing', T),
  k('vai', 'tong_the', 'Tổng thể (master)', 'Mọi nhân vật trong cảnh + khoảng cách giữa họ trong một khung — khán giả nắm vị trí ai ở đâu.', 'master shot: every character of the scene and the space between them visible at once, clear geography', T),
  k('vai', 'hanh_trinh', 'Hành trình', 'Nhân vật đi từ nơi này sang nơi khác qua một mốc quen — nối hai nơi.', 'journey shot: the character travelling across the landscape past a recognizable landmark', T),
  k('vai', 'hanh_dong', 'Hành động', 'Shot kể việc chính (mặc định).', '', T),
  k('vai', 'nguoi_thu_ba', 'Góc người thứ ba (quan sát)', 'Nhìn từ chỗ một nhân vật/vật KHÁC đang quan sát (nấp, ló, từ xa) — khán giả biết điều nhân vật chính chưa biết.', 'seen from a hidden observer\'s position: a soft out-of-focus foreground shape partly framing the action, as if someone is secretly watching', T),
  k('vai', 'chu_quan', 'Chủ quan (POV)', 'Nhìn bằng mắt nhân vật — thấy đúng cái nó thấy.', 'point-of-view shot, seeing exactly what the character sees', T),
  k('vai', 'phan_ung', 'Phản ứng', 'Giữ trên mặt/người nhân vật khi nó phản ứng — cảm xúc lắng vào khán giả.', 'reaction shot holding on the character as they react, the emotion clearly readable', T),
  k('vai', 'chi_tiet', 'Chi tiết (insert)', 'Cận vật/chi tiết làm nên truyện (cái gài, cái trả).', 'insert detail of the story object, crisp and clearly readable', T),
  k('vai', 'tam_trang', 'Tâm trạng', 'Khung không khí, gần như không hành động: ánh sáng, khoảng trống, một chuyển động nhỏ của môi trường — giữ nhịp lặng để cảm xúc ngấm.', 'mood shot with almost no action: atmosphere, light and empty space, one small movement in the environment, a quiet held moment', T),
  // ── Cỡ cảnh
  k('co_canh', 'ews', 'Toàn cảnh rất rộng (mở cảnh)', 'Giới thiệu nơi chốn, cho thấy nhân vật nhỏ bé trước thế giới. Đặt đầu phân cảnh.', 'extreme wide establishing shot, tiny figures in a vast environment', ['phieu_luu', 'hoat_hinh', 'vien_tuong', 'chinh_kich', 'kinh_di', 'tai_lieu']),
  k('co_canh', 'ws', 'Toàn cảnh', 'Thấy trọn người và không gian quanh — hành động lớn, vị trí nhân vật.', 'wide shot, full bodies visible with their surroundings', T),
  k('co_canh', 'ms', 'Trung cảnh', 'Từ hông trở lên: hội thoại, cử chỉ tay. Cỡ cảnh "kể chuyện" mặc định.', 'medium shot, framed from the waist up', T),
  k('co_canh', 'mcu', 'Cận trung', 'Từ ngực trở lên: thoại có cảm xúc, nói vào máy (UGC).', 'medium close-up, chest up, face clearly readable', T),
  k('co_canh', 'cu', 'Cận mặt', 'Cảm xúc chiếm trọn khung: phản ứng, nước mắt, quyết định.', 'close-up on the face, emotion fills the frame, shallow depth of field', T),
  k('co_canh', 'ecu', 'Đặc tả', 'Chỉ một chi tiết: mắt, bàn tay, giọt mồ hôi — căng thẳng tột độ hoặc chi tiết sản phẩm.', 'extreme close-up detail, a single feature fills the frame', ['kinh_di', 'chinh_kich', 'hanh_dong', 'tinh_cam', 'phim_doc', 'qc_cao_cap']),
  k('co_canh', 'insert', 'Cận đồ vật (insert)', 'Cận vật quan trọng với câu chuyện hoặc sản phẩm.', 'insert shot of the object, crisp detail, clean background', T),
  k('co_canh', 'ots', 'Qua vai', 'Nhìn qua vai người nghe tới người nói — đặt hai người trong một quan hệ.', 'over-the-shoulder shot, foreground shoulder softly out of focus', ['chinh_kich', 'tinh_cam', 'phim_doc', 'hanh_dong', 'kinh_di', 'hai', 'vien_tuong']),
  k('co_canh', 'two', 'Khung hai người', 'Hai nhân vật cùng khung: tình bạn, đối đầu, khoảng cách giữa họ nói lên quan hệ.', 'two-shot, both characters framed together', T),
  k('co_canh', 'pov', 'Góc nhìn nhân vật (POV)', 'Khán giả nhìn bằng mắt nhân vật — đồng cảm hoặc sợ hãi.', 'first-person point-of-view shot', ['kinh_di', 'hanh_dong', 'qc_ugc', 'phieu_luu']),
  // ── Góc máy
  k('goc', 'ngang', 'Ngang tầm mắt', 'Trung tính, gần gũi — khán giả ngang hàng nhân vật.', 'eye-level camera angle', T),
  k('goc', 'thap', 'Góc thấp (hất lên)', 'Nhân vật trông mạnh, oai, đáng sợ hoặc anh hùng.', 'low-angle shot looking up, subject appears powerful', ['hanh_dong', 'phieu_luu', 'kinh_di', 'vien_tuong', 'hoat_hinh', 'qc_cao_cap']),
  k('goc', 'cao', 'Góc cao (nhìn xuống)', 'Nhân vật nhỏ bé, yếu thế, cô đơn.', 'high-angle shot looking down, subject appears small and vulnerable', ['chinh_kich', 'kinh_di', 'tinh_cam', 'phim_doc', 'hoat_hinh']),
  k('goc', 'nghieng', 'Góc nghiêng (Dutch)', 'Khung lệch — bất an, mất cân bằng, điên loạn.', 'dutch angle, tilted horizon, unsettling composition', ['kinh_di', 'hanh_dong', 'vien_tuong']),
  k('goc', 'tren_xuong', 'Từ trên xuống (bird-eye)', 'Nhìn thẳng từ trên: bố cục, bản đồ, định mệnh.', "top-down bird's-eye view", ['phieu_luu', 'hanh_dong', 'qc_cao_cap', 'tai_lieu']),
  k('goc', 'sat_dat', 'Sát đất (worm-eye)', 'Máy sát mặt đất — kịch tính, thế giới khổng lồ.', "worm's-eye view from ground level", ['hoat_hinh', 'phieu_luu', 'hanh_dong']),
  k('goc', 'selfie', 'Selfie / cầm tay nói vào máy', 'Người nói cầm điện thoại nói thẳng vào ống kính — chất UGC thật.', 'selfie angle, handheld phone held at arm length, looking straight into the lens', ['qc_ugc']),
  // ── Chuyển động máy
  k('chuyen_dong', 'tinh', 'Máy đứng yên', 'Để diễn xuất tự nói; hợp hài (đúng nhịp) và chính kịch.', 'static locked-off camera', T),
  k('chuyen_dong', 'day_vao', 'Đẩy chậm vào (push-in)', 'Máy tiến dần vào mặt — khoảnh khắc nhận ra, cảm xúc dâng.', 'slow push-in dolly toward the subject', ['chinh_kich', 'tinh_cam', 'phim_doc', 'kinh_di', 'hoat_hinh', 'vien_tuong', 'qc_cao_cap']),
  k('chuyen_dong', 'lui_ra', 'Lùi ra (pull-out)', 'Máy lùi xa — hé lộ bối cảnh, cô đơn, kết cảnh.', 'slow dolly pull-out revealing the surroundings', ['chinh_kich', 'phieu_luu', 'kinh_di', 'tinh_cam', 'phim_doc']),
  k('chuyen_dong', 'lia', 'Lia ngang (pan)', 'Quét không gian, theo hướng nhìn của nhân vật.', 'smooth horizontal pan', T),
  k('chuyen_dong', 'nghieng_len', 'Nghiêng lên/xuống (tilt)', 'Từ chân lên mặt — hé lộ nhân vật hoặc vật to lớn.', 'vertical tilt reveal', T),
  k('chuyen_dong', 'truot_ngang', 'Trượt ngang (truck)', 'Máy đi song song nhân vật đang đi — đồng hành.', 'tracking shot moving sideways alongside the subject', ['phieu_luu', 'hoat_hinh', 'hanh_dong', 'qc_cao_cap', 'tai_lieu']),
  k('chuyen_dong', 'cau', 'Cẩu lên (crane)', 'Máy bay lên cao — hùng vĩ, kết thúc, chiến thắng.', 'crane shot rising up and away', ['phieu_luu', 'hoat_hinh', 'chinh_kich', 'vien_tuong']),
  k('chuyen_dong', 'cam_tay', 'Cầm tay (handheld)', 'Rung nhẹ, thật, gấp gáp — hành động, UGC, tài liệu.', 'handheld camera with natural subtle shake', ['hanh_dong', 'kinh_di', 'tai_lieu', 'qc_ugc']),
  k('chuyen_dong', 'theo', 'Bám theo (steadicam)', 'Máy theo sau lưng nhân vật mượt mà — đưa khán giả vào hành trình.', 'smooth steadicam following behind the subject', ['phieu_luu', 'kinh_di', 'hanh_dong', 'chinh_kich']),
  k('chuyen_dong', 'vong', 'Quay vòng (orbit)', 'Máy vòng quanh nhân vật/sản phẩm — khoảnh khắc lớn, khoe sản phẩm.', '360-degree orbit around the subject', ['hanh_dong', 'tinh_cam', 'phim_doc', 'qc_cao_cap', 'vien_tuong']),
  k('chuyen_dong', 'quat', 'Quất nhanh (whip pan)', 'Lia cực nhanh nhòe hình — nhịp hài hoặc chuyển cảnh năng lượng.', 'fast whip pan with motion blur', ['hai', 'hanh_dong', 'qc_ugc']),
  k('chuyen_dong', 'doi_net', 'Đổi nét (rack focus)', 'Chuyển nét từ vật này sang vật kia — dẫn mắt, tiết lộ.', 'rack focus shifting from foreground to background', ['kinh_di', 'chinh_kich', 'tinh_cam', 'phim_doc', 'qc_cao_cap']),
  k('chuyen_dong', 'zoom_gat', 'Zoom gắt (crash zoom)', 'Zoom vào cực nhanh — sốc, hài, nhấn mạnh.', 'sudden crash zoom', ['hai', 'kinh_di', 'qc_ugc']),
  k('chuyen_dong', 'zoom_cham', 'Zoom chậm (slow zoom)', 'Máy đứng yên, tiêu cự đổi chậm — như có người đang quan sát từ xa; áp lực dồn dần.', 'very slow optical zoom in from a fixed camera position, perspective unchanged, observational', ['chinh_kich', 'kinh_di', 'tai_lieu']),
  k('chuyen_dong', 'cau_xuong', 'Cẩu xuống (crane down)', 'Máy hạ từ trên cao xuống đúng tầm mắt nhân vật — dẫn khán giả từ nơi chốn vào người.', 'crane shot descending from high above down to the character\'s eye level', ['phieu_luu', 'hoat_hinh', 'chinh_kich', 'qc_cao_cap']),
  k('chuyen_dong', 'dan_truoc', 'Dẫn trước (leading shot)', 'Máy lùi trước mặt nhân vật đang đi tới — thấy nét mặt suốt hành trình.', 'leading shot: the camera tracks backwards in front of the character walking toward it, face always readable', ['phieu_luu', 'hoat_hinh', 'chinh_kich', 'hanh_dong']),
  // ── Diễn xuất cảm xúc (15/10/2026 — "mắt nhân vật rưng rưng… lưu vào thư viện"): nhịp diễn của shot — đi vào prompt video; mô tả ngành ở dien-anh-nganh.ts.
  k('dien_xuat', 'mat_rung_rung', 'Mắt rưng rưng', 'Mí dưới đầy nước, mắt long lanh, cố kìm rồi một giọt lăn — mất mát, được tha thứ.', 'eyes slowly welling up with tears, glistening, the character fights them back, then a single tear rolls down', ['tinh_cam', 'phim_doc', 'chinh_kich', 'hoat_hinh']),
  k('dien_xuat', 'moi_run', 'Môi run, cằm run', 'Cố không khóc: môi mím, cằm run nhẹ, hít một hơi run.', 'chin quivering and lower lip trembling as the character tries not to cry', ['tinh_cam', 'phim_doc', 'chinh_kich', 'hoat_hinh']),
  k('dien_xuat', 'nuot_khan', 'Nuốt khan', 'Thấy nguy, nuốt "ực" thấy rõ, người co lại.', 'a big visible nervous gulp, the body shrinking slightly', T),
  k('dien_xuat', 'nin_tho', 'Khựng, nín thở', 'Đang cử động thì đứng hình một nhịp rồi mới phản ứng.', 'freezes completely for a beat, holding breath, only the eyes move', T),
  k('dien_xuat', 'nhin_lai_hai_lan', 'Nhìn lại hai lần (double take)', 'Liếc qua như không có gì, quay đi, rồi quay phắt lại mắt mở to.', 'classic double take: a casual glance away, then a sharp snap back with wide eyes', ['hai', 'hoat_hinh', 'qc_ugc']),
  k('dien_xuat', 'take_cuong_dieu', 'Bật ngửa cường điệu (cartoon take)', 'Nén người rồi bung cường điệu, mắt lồi, giữ một nhịp.', 'cartoon take: a quick squash of anticipation, then an exaggerated stretch with bulging eyes, held for a beat before settling', ['hai', 'hoat_hinh']),
  k('dien_xuat', 'chop_mat_cham', 'Chớp mắt chậm (deadpan)', 'Nhìn thẳng, nhắm mở mắt thật chậm, mặt không đổi — "thật hả?".', 'a slow deadpan blink, face otherwise unchanged', ['hai', 'hoat_hinh', 'qc_ugc']),
  k('dien_xuat', 'liec_mat', 'Liếc mắt', 'Đầu yên, chỉ mắt đảo sang mục tiêu — toan tính, nghi ngờ, mở chuỗi nhìn → thấy → làm.', 'eyes dart sideways toward the target while the head stays still', T),
  k('dien_xuat', 'nhan_ra', 'Nhận ra', 'Ánh mắt dừng lại, đồng tử mở, hít nhẹ — ý nghĩ hiện trên mắt trước khi mặt đổi.', 'a realization beat: the gaze stops, pupils widen, a small intake of breath, then the expression changes', T),
  k('dien_xuat', 'cuoi_qua_nuoc_mat', 'Cười qua nước mắt', 'Mắt còn ướt mà khoé môi nhích lên — nghẹn ngào mà ấm.', 'a small smile breaking through tears', ['tinh_cam', 'phim_doc', 'chinh_kich', 'hoat_hinh']),
  k('dien_xuat', 'rung_minh', 'Rùng mình ghê sợ', 'Sóng rùng mình chạy từ đầu xuống chân, nhăn mũi, lùi lại.', 'a full-body disgusted shudder rippling from top to bottom, nose wrinkled', ['hai', 'hoat_hinh']),
  k('dien_xuat', 'xiu_vai', 'Xìu xuống', 'Thở ra, người xẹp xuống, đầu cúi, tóc rũ theo — thất vọng.', 'deflates with a sigh, body sagging and head drooping, hair drooping with it', T),
  k('dien_xuat', 'cuoi_ranh_manh', 'Cười ranh mãnh', 'Mắt hẹp lại, nhếch mép, xoa hai tay — vừa nảy ra kế.', 'eyes narrow into a sly one-sided grin, rubbing hands together', ['hai', 'hoat_hinh']),
  // Máy hiện đại (12/10/2026) — kiểu trailer/TikTok hành động; prompt viết theo cách Veo hiểu được trong một clip 4–8s.
  k('chuyen_dong', 'fpv', 'Drone FPV lao', 'Drone FPV bổ nhào, luồn sát qua khe hẹp tốc độ cao — mở cảnh hành động, cảm giác bay.', 'FPV drone shot diving fast and weaving through tight gaps at high speed, banking turns, kinetic', ['hanh_dong', 'phieu_luu', 'vien_tuong', 'qc_cao_cap']),
  k('chuyen_dong', 'dolly_zoom', 'Dolly zoom (vertigo)', 'Máy lùi trong khi zoom vào — nhân vật đứng yên, hậu cảnh giãn ra: khoảnh khắc choáng, nhận ra sự thật.', 'dolly zoom vertigo effect, subject stays the same size while the background stretches and warps', ['hanh_dong', 'kinh_di', 'chinh_kich', 'vien_tuong']),
  k('chuyen_dong', 'snorricam', 'Gắn người (snorricam)', 'Máy gắn chặt vào người — mặt đứng yên, thế giới quay cuồng: hoảng loạn, chạy trốn.', 'snorricam body-mounted camera locked on the subject while the world swings wildly around them', ['hanh_dong', 'kinh_di', 'chinh_kich']),
  k('chuyen_dong', 'bullet_time', 'Bullet-time', 'Thời gian gần như đứng, máy quay vòng quanh khoảnh khắc — mảnh vỡ, giọt nước lơ lửng.', 'bullet-time shot, time nearly frozen, camera orbits around the frozen moment with debris suspended in mid-air', ['hanh_dong', 'vien_tuong', 'qc_cao_cap']),
  k('chuyen_dong', 'speed_ramp', 'Đổi tốc (speed ramp)', 'Đang thường chậm hẳn lại ở khoảnh khắc đỉnh rồi vọt nhanh — nhịp đập kiểu trailer.', 'speed ramp: real-time motion that drops into extreme slow motion at the peak moment, then snaps back to full speed', ['hanh_dong', 'qc_ugc', 'qc_cao_cap']),
  k('chuyen_dong', 'xuyen_vat', 'Xuyên vật (fly-through)', 'Máy lao xuyên qua màn hình, ổ khoá, kẽ hở sang thế giới khác — nối hai cảnh không cần cắt.', 'camera pushes forward and flies straight through the object into the scene beyond, seamless fly-through', ['hanh_dong', 'vien_tuong', 'qc_cao_cap', 'qc_ugc']),
  k('chuyen_dong', 'hyperlapse', 'Hyperlapse', 'Máy di chuyển trong khi thời gian tua nhanh — đèn phố kéo vệt, mây chạy: thời gian dồn dập.', 'hyperlapse, the camera moves forward while time races, light trails streaking and clouds rushing', ['hanh_dong', 'tai_lieu', 'qc_cao_cap']),
  k('chuyen_dong', 'xoay_truc', 'Xoay trục (barrel roll)', 'Máy lăn tròn quanh trục ống kính khi lao tới — mất phương hướng, chuyển cảnh xoáy.', 'camera barrel roll, rotating around the lens axis while pushing forward', ['hanh_dong', 'vien_tuong']),
  // ── Tốc độ (dựng) — bản xuất đổi tốc thật bằng ffmpeg (toc-do.ts), không phải lời nhắc cho model; ảnh tĩnh không đổi tốc.
  k('toc_do', 'cham', 'Chậm 0,5×', 'Cả shot chậm một nửa — khoảnh khắc đẹp, cảm xúc.', '', T),
  k('toc_do', 'rat_cham', 'Rất chậm 0,3×', 'Gần như đứng — mảnh vỡ, giọt nước, cú va.', '', ['hanh_dong', 'qc_cao_cap', 'vien_tuong']),
  k('toc_do', 'nhanh', 'Nhanh 1,6×', 'Dồn nhịp, hài, chạy trốn.', '', ['hanh_dong', 'hai', 'qc_ugc']),
  k('toc_do', 'ramp', 'Ramp: nhanh → chậm → vọt', 'Speed ramp kiểu trailer: chậm hẳn ở khoảnh khắc đỉnh rồi vọt lại.', '', ['hanh_dong', 'qc_ugc', 'qc_cao_cap']),
  k('toc_do', 'ramp_treo', 'Ramp treo trước cắt', 'Nhanh rồi treo chậm tới điểm cắt — đặt trước cắt sốc / tiếng đập.', '', ['hanh_dong', 'kinh_di']),
  k('toc_do', 'ramp_bung', 'Ramp bung', 'Mở bằng chậm hẳn rồi bung tốc — vào shot hành động.', '', ['hanh_dong', 'qc_ugc']),
  // ── Ống kính
  k('ong_kinh', 'probe', 'Probe macro (Laowa)', 'Ống thăm dò sát đất/sát vật, lướt giữa các chi tiết — đồ vật hoá thành công trình khổng lồ.', 'probe macro lens gliding inches above the surface, tiny objects look monumental', ['hanh_dong', 'qc_cao_cap', 'qc_ugc', 'vien_tuong']),
  k('ong_kinh', 'rong', 'Góc rộng 24mm', 'Không gian giãn, gần mà méo nhẹ — phiêu lưu, hài.', '24mm wide-angle lens', T),
  k('ong_kinh', 'chuan', 'Chuẩn 35–50mm', 'Gần mắt người, tự nhiên.', '35mm lens, natural perspective', T),
  k('ong_kinh', 'chan_dung', 'Chân dung 85mm', 'Nền xoá mịn, mặt nổi bật — cảm xúc, sản phẩm.', '85mm portrait lens, creamy bokeh background', ['tinh_cam', 'phim_doc', 'chinh_kich', 'qc_cao_cap', 'hoat_hinh']),
  k('ong_kinh', 'tele', 'Tele 135mm', 'Nén hậu cảnh, theo dõi từ xa — rình rập, cô lập.', '135mm telephoto lens, compressed background', ['kinh_di', 'hanh_dong', 'tai_lieu', 'chinh_kich']),
  k('ong_kinh', 'macro', 'Macro', 'Chi tiết siêu cận: chất vải, đường may, giọt nước.', 'macro lens, extreme texture detail', ['qc_cao_cap', 'qc_ugc', 'tai_lieu', 'kinh_di']),
  k('ong_kinh', 'anamorphic', 'Anamorphic', 'Khung điện ảnh rộng, vệt loé ngang — chất phim chiếu rạp.', 'anamorphic lens, horizontal lens flares, cinematic widescreen', ['vien_tuong', 'hanh_dong', 'phieu_luu', 'chinh_kich']),
  // ── Ánh sáng
  k('anh_sang', 'sang_deu', 'Sáng đều (high-key)', 'Ít bóng, tươi sáng — hài, hoạt hình, quảng cáo.', 'bright high-key lighting, minimal shadows', ['hai', 'hoat_hinh', 'qc_ugc', 'qc_cao_cap']),
  k('anh_sang', 'toi', 'Tối nhiều bóng (low-key)', 'Mảng tối lớn, một nguồn sáng — bí ẩn, đe doạ.', 'low-key lighting, deep shadows, single hard source', ['kinh_di', 'chinh_kich', 'hanh_dong', 'vien_tuong']),
  k('anh_sang', 'tuong_phan', 'Sáng tối gắt (chiaroscuro)', 'Nửa mặt sáng nửa tối — giằng xé nội tâm.', 'chiaroscuro lighting, half the face in shadow', ['chinh_kich', 'kinh_di', 'tinh_cam', 'phim_doc']),
  k('anh_sang', 'hoang_hon', 'Giờ vàng', 'Nắng chiều vàng ấm, xiên dài — hoài niệm, lãng mạn, hy vọng.', 'golden hour sunlight, warm low sun, long soft shadows', ['tinh_cam', 'phim_doc', 'hoat_hinh', 'phieu_luu', 'chinh_kich', 'qc_cao_cap']),
  k('anh_sang', 'gio_xanh', 'Giờ xanh', 'Sau hoàng hôn, xanh lạnh dịu — trầm lặng, buồn.', 'blue hour, cool twilight ambience', ['chinh_kich', 'tinh_cam', 'phim_doc', 'vien_tuong']),
  k('anh_sang', 'cua_so', 'Ánh cửa sổ mềm', 'Ánh ban ngày qua cửa sổ, mềm và thật — UGC, đời thường.', 'soft natural window light, gentle falloff', ['qc_ugc', 'tai_lieu', 'tinh_cam', 'phim_doc', 'chinh_kich']),
  k('anh_sang', 'nguoc', 'Ngược sáng / bóng đen', 'Nhân vật thành bóng trước nguồn sáng — bí ẩn, hùng tráng.', 'strong backlight, silhouette', ['phieu_luu', 'kinh_di', 'hanh_dong', 'tinh_cam', 'phim_doc']),
  k('anh_sang', 'vien', 'Đèn viền (rim light)', 'Viền sáng tách người khỏi nền tối — điện ảnh, sản phẩm sang.', 'rim light outlining the subject against a dark background', ['qc_cao_cap', 'hanh_dong', 'vien_tuong', 'chinh_kich']),
  k('anh_sang', 'neon', 'Neon', 'Ánh hồng/xanh neon — đô thị đêm, tương lai.', 'neon pink and cyan practical lighting', ['vien_tuong', 'hanh_dong']),
  k('anh_sang', 'trang', 'Ánh trăng', 'Xanh bạc yếu, đêm — huyền bí, sợ hãi.', 'cold moonlight, silver-blue night', ['kinh_di', 'phieu_luu', 'hoat_hinh']),
  k('anh_sang', 'nhap_nhay', 'Đèn chập chờn', 'Đèn nhấp nháy — bất an, sắp có chuyện.', 'flickering light, unstable illumination', ['kinh_di', 'vien_tuong']),
  k('anh_sang', 'duoi_len', 'Rọi từ dưới lên', 'Đèn hắt từ dưới mặt — ma quái.', 'under-lighting from below the face', ['kinh_di']),
  k('anh_sang', 'studio', 'Đèn studio sản phẩm', 'Softbox lớn, phản sáng trắng — sản phẩm sạch, đúng màu.', 'professional studio product lighting, large softbox, clean reflections', ['qc_cao_cap']),
  // ── Màu
  k('mau', 'am', 'Ấm áp', 'Cam vàng — gia đình, an toàn, thân thương.', 'warm color grade, amber and honey tones', ['hoat_hinh', 'tinh_cam', 'phim_doc', 'qc_ugc', 'chinh_kich']),
  k('mau', 'teal_cam', 'Teal–cam', 'Da cam nổi trên nền xanh — chuẩn bom tấn.', 'teal and orange blockbuster color grade', ['hanh_dong', 'phieu_luu', 'vien_tuong']),
  k('mau', 'lanh', 'Lạnh, bạc màu', 'Xanh xám, rút bão hoà — u ám, cô độc.', 'cold desaturated grade, steel blue and grey', ['kinh_di', 'chinh_kich', 'vien_tuong']),
  k('mau', 'xanh_benh', 'Xanh bệnh hoạn', 'Ám xanh lá vàng — ghê rợn, sai sai.', 'sickly green tint, unsettling', ['kinh_di']),
  k('mau', 'pastel', 'Pastel', 'Hồng, xanh bạc hà nhạt — dễ thương, nhẹ nhàng.', 'soft pastel palette', ['hoat_hinh', 'hai', 'tinh_cam', 'phim_doc', 'qc_ugc']),
  k('mau', 'tu_nhien', 'Tự nhiên', 'Đúng màu thật, da thật — tài liệu, UGC, sản phẩm.', 'natural true-to-life colors, accurate skin tones', ['tai_lieu', 'qc_ugc', 'qc_cao_cap']),
  k('mau', 'tuong_phan_cao', 'Tương phản cao', 'Đen sâu, sáng gắt — mạnh, kịch tính.', 'high-contrast grade, deep blacks', ['hanh_dong', 'kinh_di', 'qc_cao_cap']),
  k('mau', 'den_trang', 'Đen trắng', 'Hồi ức, nghiêm trang, nghệ thuật.', 'black and white', ['chinh_kich', 'kinh_di', 'tai_lieu']),
  // ── Chuyển cảnh (cách shot này nối sang shot sau)
  k('chuyen_canh', 'cat', 'Cắt thẳng', 'Mặc định, gọn.', '', T),
  // Liền máy (14/10/2026): shot sau tiếp ĐÚNG khoảnh khắc cuối shot này, cùng nơi, máy cùng phía → clip shot này sinh với khung cuối =
  // keyframe shot sau (sinh-video.ts › khungCuoiCanh, kieu.ts › noiKhungShot) và keyframe shot sau lấy keyframe shot này làm tham chiếu.
  k('chuyen_canh', 'lien_may', 'Liền máy (nối khung)', 'Shot sau tiếp đúng giây cuối shot này, cùng nơi — clip kết bằng chính khung mở của shot sau, cắt không giật.', '', T),
  k('chuyen_canh', 'cat_khop', 'Cắt khớp hình (match cut)', 'Hình dáng/chuyển động shot sau khớp shot trước — nối ý, thời gian trôi.', 'end on a strong shape or motion that the next shot will mirror', ['phieu_luu', 'chinh_kich', 'vien_tuong', 'qc_cao_cap', 'hoat_hinh']),
  k('chuyen_canh', 'j_cut', 'J-cut (tiếng đến trước)', 'Âm thanh cảnh sau vang lên trước khi hình đổi — dẫn mượt.', '', ['chinh_kich', 'tinh_cam', 'phim_doc', 'tai_lieu', 'phieu_luu']),
  k('chuyen_canh', 'l_cut', 'L-cut (tiếng còn kéo dài)', 'Tiếng cảnh trước còn đọng khi hình đã sang — dư âm cảm xúc.', '', ['chinh_kich', 'tinh_cam', 'phim_doc', 'tai_lieu']),
  { ...k('chuyen_canh', 'hoa_tan', 'Hoà tan (dissolve)', 'Hình chồng mờ — thời gian trôi, hồi ức.', '', ['tinh_cam', 'chinh_kich', 'hoat_hinh']), xfade: 'dissolve', nhom_cc: 'co_ban' as NhomChuyenCanh, giay_cc: 0.6 },
  { ...k('chuyen_canh', 'toi_den', 'Tắt dần về đen', 'Kết một chương, khoảng lặng.', '', ['chinh_kich', 'kinh_di', 'tinh_cam', 'tai_lieu']), xfade: 'fadeblack', nhom_cc: 'co_ban' as NhomChuyenCanh, giay_cc: 0.6 },
  { ...k('chuyen_canh', 'quat_chuyen', 'Quất chuyển (whip)', 'Lia nhanh sang cảnh mới — năng lượng, hài, quảng cáo.', 'end with a fast whip-pan motion blur', ['hai', 'hanh_dong', 'qc_ugc']), xfade: 'hblur', nhom_cc: 'dong' as NhomChuyenCanh, giay_cc: 0.35 },
  k('chuyen_canh', 'cat_soc', 'Cắt sốc (smash cut)', 'Từ yên tĩnh cắt phắt sang ồn ào (hoặc ngược) — doạ, hài.', '', ['kinh_di', 'hai', 'hanh_dong']),
  k('chuyen_canh', 'nhay', 'Jump cut', 'Cắt nhảy trong cùng khung — nhịp nhanh kiểu TikTok/UGC.', '', ['qc_ugc', 'hai']),
  // Nhóm hiệu ứng chuyển cảnh kiểu CapCut (11/10/2026) — bản xuất dựng thật bằng ffmpeg xfade, mượn đuôi shot trước nên giờ các shot không đổi.
  cc('mo_cheo', 'Mờ chéo', 'Hình trước mờ dần sang hình sau — mềm, dùng được mọi chỗ.', 'co_ban', 'fade', 0.4),
  cc('loe_trang', 'Loé trắng', 'Loé sáng rồi vào cảnh mới — lộ giá, chuyển nhịp QC.', 'co_ban', 'fadewhite', 0.4),
  cc('qua_xam', 'Mờ qua xám', 'Phai màu rồi lên màu cảnh sau — hồi tưởng, trước/sau.', 'co_ban', 'fadegrays', 0.5),
  cc('truot_trai', 'Trượt trái', 'Cảnh sau đẩy cảnh trước sang trái — lướt kiểu story.', 'truot', 'slideleft', 0.35),
  cc('truot_phai', 'Trượt phải', 'Cảnh sau đẩy sang phải.', 'truot', 'slideright', 0.35),
  cc('truot_len', 'Trượt lên', 'Đẩy lên như vuốt TikTok.', 'truot', 'slideup', 0.35),
  cc('truot_xuong', 'Trượt xuống', 'Đẩy xuống.', 'truot', 'slidedown', 0.35),
  cc('phu_trai', 'Phủ từ phải', 'Cảnh sau trượt vào phủ lên cảnh trước (cảnh trước đứng yên).', 'truot', 'coverleft', 0.35),
  cc('quet_trai', 'Quét trái', 'Vạch quét ngang thay cảnh — gọn, đồ hoạ.', 'quet', 'wipeleft', 0.35),
  cc('quet_phai', 'Quét phải', 'Vạch quét sang phải.', 'quet', 'wiperight', 0.35),
  cc('quet_len', 'Quét lên', 'Vạch quét từ dưới lên.', 'quet', 'wipeup', 0.35),
  cc('quet_cheo', 'Quét chéo', 'Quét từ góc trên trái — năng động.', 'quet', 'wipetl', 0.4),
  cc('muot_trai', 'Quét mượt', 'Quét có mép mềm — sang trọng.', 'quet', 'smoothleft', 0.45),
  cc('mo_tron', 'Mở tròn', 'Vòng tròn nở ra lộ cảnh sau — tiết lộ sản phẩm.', 'hinh', 'circleopen', 0.45),
  cc('dong_tron', 'Đóng tròn', 'Vòng tròn khép lại vào cảnh sau.', 'hinh', 'circleclose', 0.45),
  cc('mo_doc', 'Mở cửa dọc', 'Tách đôi dọc như mở cửa — ra mắt, khai trương.', 'hinh', 'vertopen', 0.4),
  cc('mo_ngang', 'Mở cửa ngang', 'Tách đôi ngang.', 'hinh', 'horzopen', 0.4),
  cc('quat_tron', 'Quạt xoay', 'Quét vòng như kim đồng hồ.', 'hinh', 'radial', 0.45),
  cc('lat_cat', 'Lát cắt', 'Các lát ngang thay cảnh — kiểu đồ hoạ.', 'hinh', 'hlslice', 0.4),
  cc('phong_vao', 'Phóng vào', 'Phóng to cảnh trước rồi vào cảnh sau — dồn năng lượng, hook.', 'dong', 'zoomin', 0.35),
  cc('pixel', 'Vỡ điểm ảnh', 'Vỡ thành ô vuông rồi ghép lại — game, công nghệ.', 'dong', 'pixelize', 0.45),
  cc('ep_ngang', 'Ép ngang', 'Ép dẹt cảnh trước rồi bung cảnh sau — vui, nảy.', 'dong', 'squeezeh', 0.35),
  cc('gio_cuon', 'Gió cuốn', 'Vệt gió quét ngang — nhanh, hài.', 'dong', 'hlwind', 0.4),
  // ── Âm thanh
  k('am_thanh', 'nen_phong', 'Âm nền phòng', 'Tiếng phòng nhỏ, đồng hồ, tủ lạnh — thật, gần.', 'quiet room tone ambience', T),
  k('am_thanh', 'rung', 'Âm rừng', 'Chim, gió lá, côn trùng.', 'forest ambience, birdsong, rustling leaves', ['hoat_hinh', 'phieu_luu', 'kinh_di', 'tai_lieu']),
  k('am_thanh', 'pho', 'Âm phố', 'Xe cộ, người qua lại.', 'city street ambience, distant traffic', ['hanh_dong', 'chinh_kich', 'tai_lieu', 'qc_ugc']),
  k('am_thanh', 'mua', 'Mưa', 'Mưa rơi — buồn, lãng mạn, ghê rợn.', 'steady rain ambience', ['tinh_cam', 'phim_doc', 'chinh_kich', 'kinh_di']),
  k('am_thanh', 'foley', 'Tiếng động cận (foley)', 'Bước chân, vải sột soạt, đồ chạm — làm hình "có thật".', 'close foley sounds synced to the action', T),
  k('am_thanh', 'tim_dap', 'Nhịp tim', 'Tiếng tim đập to dần — hồi hộp.', 'heartbeat getting louder', ['kinh_di', 'hanh_dong', 'chinh_kich']),
  k('am_thanh', 'im_lang', 'Im lặng đột ngột', 'Cắt hết âm — trước cú doạ hay khoảnh khắc lớn.', 'sudden silence', ['kinh_di', 'chinh_kich', 'hanh_dong']),
  k('am_thanh', 'dap_doa', 'Âm doạ (sting)', 'Một tiếng đánh mạnh lúc doạ.', 'sharp horror sting', ['kinh_di']),
  k('am_thanh', 'pop', 'Pop (bật ra)', 'Tiếng nảy ngắn khi chữ / sản phẩm bật ra.', 'short playful pop sound', ['qc_ugc', 'qc_cao_cap', 'hai', 'hoat_hinh']),
  k('am_thanh', 'ding', 'Ding (chuông)', 'Chuông nhỏ — lợi ích, "đúng rồi".', 'bright small bell ding', ['qc_ugc', 'qc_cao_cap', 'hai', 'hoat_hinh']),
  k('am_thanh', 'ka_ching', 'Ka-ching (tính tiền)', 'Máy tính tiền — ưu đãi, giá, CTA.', 'cash register ka-ching', ['qc_ugc', 'qc_cao_cap']),
  k('am_thanh', 'chup', 'Chụp ảnh', 'Tiếng màn trập — khoảnh khắc, khoe kết quả.', 'camera shutter click', ['qc_ugc', 'qc_cao_cap', 'tai_lieu']),
  k('am_thanh', 'cuon_len', 'Âm cuộn lên (riser)', 'Âm dâng dần dẫn vào cao trào hay tiết lộ.', 'rising whoosh riser', ['hanh_dong', 'vien_tuong', 'qc_cao_cap', 'qc_ugc', 'kinh_di']),
  k('am_thanh', 'vut', 'Vút (whoosh)', 'Đi kèm chuyển động nhanh, chuyển cảnh.', 'whoosh swoosh', ['hanh_dong', 'hai', 'qc_ugc', 'qc_cao_cap']),
  // Có tiếng THẬT trong bản xuất (public/sfx, bảng sfx.ts): vut, dap_doa, cuon_len, tim_dap, mua + bốn tiếng dưới — đặt vào đầu shot (điểm cắt).
  k('am_thanh', 'dap', 'Đập mạnh (impact)', 'Trống trầm "bùm" đúng điểm cắt — cắt sốc, lộ chữ, cú đánh. Có tiếng thật trong bản xuất.', 'deep cinematic impact boom', ['hanh_dong', 'kinh_di', 'qc_ugc', 'qc_cao_cap']),
  k('am_thanh', 'vo_kinh', 'Vỡ kính', 'Kính vỡ, mảnh leng keng — đổ vỡ, sốc. Có tiếng thật trong bản xuất.', 'glass shattering, shards tinkling', ['hanh_dong', 'kinh_di', 'chinh_kich']),
  k('am_thanh', 'chop_dien', 'Chập điện', 'Tia lửa điện xẹt — máy hỏng, glitch. Có tiếng thật trong bản xuất.', 'electric spark zap and buzz', ['hanh_dong', 'vien_tuong', 'kinh_di']),
  k('am_thanh', 'sam', 'Sấm', 'Sấm rền — bão, điềm xấu, cao trào. Có tiếng thật trong bản xuất.', 'rolling thunder crack', ['hanh_dong', 'kinh_di', 'chinh_kich', 'phieu_luu']),
  k('am_thanh', 'cot_ket', 'Cót két', 'Cửa, sàn gỗ cót két.', 'creaking wooden door and floorboards', ['kinh_di', 'hai']),
  // ── Nhạc
  k('nhac', 'piano', 'Piano ấm', 'Vài nốt piano mộc — tình cảm, hồi tưởng.', 'gentle warm solo piano', ['tinh_cam', 'phim_doc', 'chinh_kich', 'hoat_hinh', 'qc_ugc']),
  k('nhac', 'dan_nhac', 'Dàn nhạc dâng', 'Dây + kèn trào lên — hùng tráng, chiến thắng.', 'swelling orchestral score', ['phieu_luu', 'hoat_hinh', 'hanh_dong', 'vien_tuong']),
  k('nhac', 'drone', 'Âm trầm căng (drone)', 'Một nốt trầm kéo dài — hồi hộp, bất an.', 'low ominous suspense drone', ['kinh_di', 'vien_tuong', 'chinh_kich']),
  k('nhac', 'day_dao', 'Dây cào (horror strings)', 'Violin cào chói — ghê rợn.', 'screeching dissonant horror strings', ['kinh_di']),
  k('nhac', 'pop', 'Pop vui', 'Nhạc pop nhịp nhanh — năng lượng, quảng cáo.', 'upbeat modern pop beat', ['qc_ugc', 'qc_cao_cap', 'hai']),
  k('nhac', 'pizzicato', 'Pizzicato tinh nghịch', 'Dây gảy nảy — hài, lém lỉnh.', 'playful pizzicato strings', ['hai', 'hoat_hinh']),
  k('nhac', 'lofi', 'Lo-fi', 'Chill, nhẹ — đời thường, UGC.', 'chill lo-fi beat', ['qc_ugc', 'tai_lieu']),
  k('nhac', 'trong', 'Trống dồn', 'Bộ gõ dồn dập — hành động, rượt đuổi.', 'driving epic percussion', ['hanh_dong', 'phieu_luu', 'vien_tuong']),
  k('nhac', 'dien_tu', 'Synth điện tử', 'Synth lạnh — tương lai, công nghệ.', 'atmospheric synth score', ['vien_tuong', 'qc_cao_cap']),
  k('nhac', 'sang_trong', 'Sang trọng tối giản', 'Nhạc tối giản, sang — sản phẩm cao cấp.', 'minimal elegant luxury soundtrack', ['qc_cao_cap']),
  k('nhac', 'khong', 'Không nhạc', 'Để thoại/âm thật tự nói.', '', T),
];

/** Thư viện đầy đủ: mỗi kỹ thuật kèm mô tả ngành + phần số máy (nếu có) từ dien-anh-nganh.ts. */
// Bổ sung ngành (dien-anh-them.ts, anh 18/10/2026 "thêm tất cả kỹ thuật của ngành điện ảnh") gộp sau bản gốc — key trùng thì bản gốc thắng.
export const THU_VIEN: KyThuat[] = [...THU_VIEN_GOC, ...[...THU_VIEN_THEM, ...THU_VIEN_THEM_MAY].filter((x) => !THU_VIEN_GOC.some((g) => g.nhom === x.nhom && g.key === x.key))].map((x) => { const n = NGANH[`${x.nhom}.${x.key}`]; return n ? { ...x, nganh: n.nganh, ...(n.may_di ? { may_di: n.may_di } : {}) } : x; });
export const kyThuat = (key: string | undefined, nhom?: NhomKyThuat) => (key ? THU_VIEN.find((x) => x.key === key && (!nhom || x.nhom === nhom)) : undefined);
export const hopTheLoai = (x: KyThuat, tl: TheLoai | undefined) => x.the_loai === 'tat_ca' || !tl || x.the_loai.includes(tl);
/** Kỹ thuật của một nhóm, cái hợp thể loại đứng trước. */
export const dsTheoNhom = (nhom: NhomKyThuat, tl?: TheLoai) => THU_VIEN.filter((x) => x.nhom === nhom).sort((a, b) => Number(hopTheLoai(b, tl)) - Number(hopTheLoai(a, tl)));

/** Đoạn prompt tiếng Anh cho ẢNH keyframe (khung tĩnh: cỡ cảnh, góc, ống kính, ánh sáng, màu). */
export function promptKyThuatAnh(kt: KyThuatShot | undefined): string {
  if (!kt) return '';
  return (['vai', 'co_canh', 'goc', 'ong_kinh', 'anh_sang', 'mau'] as const).map((n) => kyThuat(kt[n], n)?.prompt).filter(Boolean).join(', ');
}
/** Đoạn prompt tiếng Anh cho VIDEO (chuyển động máy + chuyển cảnh + âm thanh + nhạc — model có tiếng hiểu được). */
export function promptKyThuatVideo(kt: KyThuatShot | undefined): string {
  if (!kt) return '';
  const may = kyThuat(kt.chuyen_dong, 'chuyen_dong')?.prompt;
  const dien = kyThuat(kt.dien_xuat, 'dien_xuat')?.prompt;
  const ket = kyThuat(kt.chuyen_canh, 'chuyen_canh')?.prompt;
  const am = (kt.am_thanh ?? []).map((x) => kyThuat(x, 'am_thanh')?.prompt).filter(Boolean);
  const nhac = kyThuat(kt.nhac, 'nhac')?.prompt;
  return [may && `Camera: ${may}.`, dien && `Performance: ${dien}.`, ket && `${ket}.`, am.length ? `Sound: ${am.join(', ')}.` : '', nhac ? `Music: ${nhac}.` : ''].filter(Boolean).join(' ');
}
/** Nhãn tiếng Việt ngắn của các kỹ thuật đã chọn — hiện trên thẻ shot / timeline. */
/** Kỹ thuật đã chọn của một shot, đủ nhóm + mô tả — nguồn cho nhãn ngắn (thẻ shot, bảng ＋) và hover chi tiết. */
/** ma = '<nhóm>.<key>' (luật dựng cảnh: 'luat.<key>') — khoá mở ngăn chi tiết (thu-vien.tsx › ChiTietKyThuatNgan). */
export type MucKyThuat = { ma: string; nhom: string; icon: string; ten: string; mo_ta: string };
export function chiTietKyThuat(kt: KyThuatShot | undefined): MucKyThuat[] {
  if (!kt) return [];
  const out: MucKyThuat[] = [];
  for (const n of NHOM_KY_THUAT) {
    const keys = n.key === 'am_thanh' ? kt.am_thanh ?? [] : [kt[n.key as Exclude<NhomKyThuat, 'am_thanh'>]];
    for (const k of keys) { const x = kyThuat(k, n.key); if (x) out.push({ ma: `${n.key}.${x.key}`, nhom: n.ten, icon: n.icon, ten: x.ten, mo_ta: x.mo_ta }); }
  }
  for (const k of kt.luat ?? []) { const l = luatDung(k); if (l) out.push({ ma: `luat.${l.key}`, nhom: 'Luật dựng cảnh', icon: '📐', ten: l.ten, mo_ta: l.luat }); }
  return out;
}
export const nhanKyThuat = (kt: KyThuatShot | undefined): string[] => chiTietKyThuat(kt).map((m) => `${m.icon} ${m.ten}`);
/** Chỉ giữ key có trong thư viện (Claude lỡ bịa key thì bỏ). */
export function lamSachKyThuat(kt: Record<string, unknown> | undefined): KyThuatShot {
  const o: KyThuatShot = {};
  if (!kt) return o;
  for (const n of NHOM_KY_THUAT) {
    const v = kt[n.key];
    if (n.key === 'am_thanh') { const ds = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && !!kyThuat(x, 'am_thanh')); if (ds.length) o.am_thanh = ds.slice(0, 3); continue; }
    if (typeof v === 'string' && kyThuat(v, n.key)) (o as Record<string, string>)[n.key] = v;
  }
  const g = Number(kt.giay_cc); if (Number.isFinite(g) && g >= 0.1 && g <= 3) o.giay_cc = Math.round(g * 100) / 100;
  const lu = (Array.isArray(kt.luat) ? kt.luat : []).filter((x): x is string => typeof x === 'string' && !!luatDung(x));
  if (lu.length) o.luat = [...new Set(lu)].slice(0, 4);
  return o;
}

// ── Cấu trúc beat theo loại phim ──────────────────────────────────────────────────────────────────────────────
export type Beat = { ten: string; mo_ta: string; cam_xuc: number };
export const CAU_TRUC: Record<string, { ten: string; beats: { ten: string; mo_ta: string; phan?: number }[] }> = {
  phim: { ten: 'Ba hồi (rút gọn Save the Cat)', beats: [
    { ten: 'Mở đầu', mo_ta: 'Thế giới bình thường, nhân vật và điều họ thiếu' }, { ten: 'Biến cố', mo_ta: 'Sự kiện phá vỡ bình thường, đẩy nhân vật vào hành trình' },
    { ten: 'Bước qua ngưỡng', mo_ta: 'Nhân vật chọn dấn thân' }, { ten: 'Thử thách', mo_ta: 'Vui chơi & thử thách, quan hệ hình thành' },
    { ten: 'Giữa phim', mo_ta: 'Bước ngoặt: chiến thắng giả hoặc thất bại giả, mục tiêu đổi' }, { ten: 'Tất cả sụp đổ', mo_ta: 'Điểm thấp nhất, mất mát' },
    { ten: 'Cao trào', mo_ta: 'Nhân vật dùng điều đã học để đối mặt' }, { ten: 'Kết', mo_ta: 'Thế giới mới, nhân vật đã thay đổi (móc tập sau nếu là series)' },
  ] },
  // 5 nhịp — CÙNG bộ tên máy chấm kịch bản đòi (cham-kich-ban.ts); trước đây 4 nhịp Hook/Dồn nén/Twist/Chốt làm tập series bị chặn oan.
  short: { ten: 'Short (hook → vấn đề → leo thang → lật ngược → kết/móc)', beats: [
    { ten: 'Hook 3 giây', mo_ta: 'Câu/khung hình giữ ngón tay lại' }, { ten: 'Vấn đề', mo_ta: 'Nhân vật muốn gì và cái gì cản' },
    { ten: 'Leo thang', mo_ta: 'Mỗi lần thử lại tệ hơn, tăng tốc' }, { ten: 'Lật ngược', mo_ta: 'Lật kỳ vọng' }, { ten: 'Kết / móc', mo_ta: 'Kết đọng lại + móc sang tập sau / lời kêu gọi theo dõi' },
  ] },
  // PHIM NGẮN DỌC (micro-drama kiểu tổng tài — anh 16/10/2026): tập 60–120s, 60–100 tập; mỗi 15–30s một nút, cuối tập là cliffhanger. Tên beat
  // khớp máy chấm (cham-kich-ban.ts › nhipCua): Hook / Vấn đề / Leo thang / Lật ngược / Cliffhanger. `phan` = tỉ lệ thời lượng.
  phim_doc: { ten: 'Phim ngắn dọc (móc 3s → sỉ nhục → nút 1 → nút 2 → đánh mặt → cliffhanger)', beats: [
    { ten: 'Hook 3 giây', mo_ta: 'Mở NGAY giữa xung đột: một câu sốc, cái tát, lời tuyên bố, ánh mắt lạnh — không giới thiệu', phan: 0.04 },
    { ten: 'Vấn đề — sỉ nhục', mo_ta: 'Nhân vật chính bị coi thường / dồn ép bất công; người xem đứng về phía họ', phan: 0.16 },
    { ten: 'Leo thang — nút 1', mo_ta: 'Kẻ ép tăng đòn; một bí mật / thân phận hé ra một chút (người xem biết hơn kẻ ép)', phan: 0.2 },
    { ten: 'Leo thang — nút 2', mo_ta: 'Ép đến tận cùng, nhân vật chính im lặng / nhẫn nhịn — khán giả nóng ruột chờ phản đòn', phan: 0.2 },
    { ten: 'Lật ngược — đánh mặt', mo_ta: 'Phản đòn: thân phận / sự thật lộ ra, kẻ ép bẽ mặt (face-slap) — khoảnh khắc cảm xúc mạnh nhất tập', phan: 0.25 },
    { ten: 'Cliffhanger — móc tập sau', mo_ta: 'Một câu / hình bỏ lửng mở xung đột mới — dừng đúng lúc người xem muốn biết tiếp', phan: 0.15 },
  ] },
  // GÓI THỂ LOẠI (goi-the-loai.ts, 18/10/2026) — khung riêng cho định dạng mà khung chung không đúng nhịp:
  // Series hoạt hình gag (Larva / Shaun the Sheep): quy tắc ba của hài — lặp hai lần, lần ba bẻ; leo thang tới thảm hoạ rồi kết bằng một nút hài.
  series_hoat_hinh: { ten: 'Tập hoạt hình gag (thế giới → mục tiêu nhỏ → gag ×3 leo thang → thảm hoạ → nút kết)', beats: [
    { ten: 'Thế giới', mo_ta: 'Nơi chốn + nhân vật quen thuộc, đọc được trong vài giây (không lời)', phan: 0.1 }, { ten: 'Mục tiêu nhỏ', mo_ta: 'Một thứ nhân vật muốn ngay bây giờ (miếng ăn, món đồ, chỗ ngồi)', phan: 0.1 },
    { ten: 'Gag 1', mo_ta: 'Lần thử đầu hỏng theo kiểu buồn cười', phan: 0.15 }, { ten: 'Gag 2', mo_ta: 'Thử lại, lớn hơn, hỏng to hơn (lặp cấu trúc gag 1)', phan: 0.2 },
    { ten: 'Gag 3 — bẻ', mo_ta: 'Lần ba bẻ kỳ vọng (quy tắc ba): kết quả bất ngờ, leo tới thảm hoạ', phan: 0.25 }, { ten: 'Nút kết', mo_ta: 'Hậu quả + một cái nháy / gag cuối, có thể móc tập sau', phan: 0.2 },
  ] },
  // Trailer ba hồi (lệ dựng trailer điện ảnh): mở thế giới → biến cố → dồn cắt leo thang theo nhạc → khoảng lặng → cú cuối + tựa + button.
  trailer: { ten: 'Trailer ba hồi (thế giới → biến cố → dồn cắt → lặng → cú cuối + tựa)', beats: [
    { ten: 'Thế giới', mo_ta: 'Bình thường của nhân vật, khung rộng, nhạc nhẹ', phan: 0.2 }, { ten: 'Biến cố', mo_ta: 'Sự kiện phá vỡ bình thường — câu thoại / hình chốt câu hỏi của phim', phan: 0.2 },
    { ten: 'Dồn cắt', mo_ta: 'Montage leo thang: shot ngắn dần theo nhạc, không lộ kết', phan: 0.35 }, { ten: 'Khoảng lặng', mo_ta: 'Nhạc tắt, một nhịp đen / im', phan: 0.05 },
    { ten: 'Cú cuối + tựa', mo_ta: 'Một shot mạnh nhất hoặc câu đùa (button) rồi tựa phim', phan: 0.2 },
  ] },
  // Tài liệu ngắn (Sheila Curran Bernard — Documentary Storytelling): câu hỏi rõ ngay đầu, trả lời bằng bằng chứng nhìn thấy được.
  tai_lieu: { ten: 'Tài liệu ngắn (câu hỏi → bối cảnh → bằng chứng → phát hiện → ý nghĩa)', beats: [
    { ten: 'Câu hỏi', mo_ta: 'Móc bằng một câu hỏi / hình hiện trường gây tò mò', phan: 0.12 }, { ten: 'Bối cảnh', mo_ta: 'Ở đâu, ai, chuyện bắt đầu thế nào', phan: 0.2 },
    { ten: 'Bằng chứng', mo_ta: 'Nhân chứng, tư liệu, hình thật — mỗi mảnh một shot rõ', phan: 0.33 }, { ten: 'Phát hiện', mo_ta: 'Điều bất ngờ làm đổi cách hiểu', phan: 0.2 },
    { ten: 'Ý nghĩa', mo_ta: 'Trả lời câu hỏi mở đầu + điều khán giả mang về', phan: 0.15 },
  ] },
  // MV: hình theo cấu trúc bài hát (intro–verse–chorus–bridge–outro), điệp khúc là hình mạnh nhất, cắt theo phách.
  mv: { ten: 'MV ca nhạc (intro → verse → chorus → verse 2 → chorus → bridge → chorus cuối → outro)', beats: [
    { ten: 'Intro', mo_ta: 'Thế giới / nhân vật của bài, hình gây tò mò', phan: 0.08 }, { ten: 'Verse 1', mo_ta: 'Kể tình huống, hình gần, ít cắt', phan: 0.17 },
    { ten: 'Chorus', mo_ta: 'Hình mạnh nhất / vũ đạo / bối cảnh lớn, cắt theo phách', phan: 0.15 }, { ten: 'Verse 2', mo_ta: 'Tình huống đi tiếp, thêm chi tiết mới', phan: 0.15 },
    { ten: 'Chorus 2', mo_ta: 'Lặp hình điệp khúc, lớn hơn', phan: 0.13 }, { ten: 'Bridge', mo_ta: 'Đổi màu / đổi nơi, khoảnh khắc cảm xúc', phan: 0.12 },
    { ten: 'Chorus cuối', mo_ta: 'Cao trào hình ảnh', phan: 0.14 }, { ten: 'Outro', mo_ta: 'Hình đọng lại', phan: 0.06 },
  ] },
  // Video YouTuber (hướng dẫn nhà sáng tạo của YouTube: giữ chân trong những giây đầu, chương mục, kêu gọi cuối).
  video_youtube: { ten: 'Video YouTuber (móc → hứa giá trị → các phần → tóm lại → kêu gọi)', beats: [
    { ten: 'Móc', mo_ta: 'Kết quả / câu hỏi / cảnh mạnh nhất trong 5–15 giây đầu', phan: 0.08 }, { ten: 'Hứa giá trị', mo_ta: 'Video này cho người xem điều gì, vì sao nên xem hết', phan: 0.07 },
    { ten: 'Phần 1', mo_ta: 'Ý chính đầu tiên, có minh hoạ', phan: 0.22 }, { ten: 'Phần 2', mo_ta: 'Ý chính tiếp theo', phan: 0.22 }, { ten: 'Phần 3', mo_ta: 'Ý mạnh nhất để cuối', phan: 0.22 },
    { ten: 'Tóm lại', mo_ta: 'Nhắc lại điều người xem mang về', phan: 0.1 }, { ten: 'Kêu gọi', mo_ta: 'Theo dõi / xem video sau / bình luận', phan: 0.09 },
  ] },
  // Tin tức: kim tự tháp ngược của báo chí — điều quan trọng nhất trước, chi tiết sau, nguồn rõ.
  tin_tuc: { ten: 'Tin ngắn (kim tự tháp ngược: điều quan trọng nhất → chi tiết → bối cảnh → nguồn)', beats: [
    { ten: 'Tít + hình chính', mo_ta: 'Chuyện gì xảy ra, ở đâu, khi nào — một câu', phan: 0.2 }, { ten: 'Chi tiết quan trọng', mo_ta: 'Ai, bao nhiêu, vì sao', phan: 0.35 },
    { ten: 'Bối cảnh', mo_ta: 'Trước đó đã có gì, ảnh hưởng tới ai', phan: 0.3 }, { ten: 'Nguồn + tiếp theo', mo_ta: 'Nguồn tin, điều cần theo dõi', phan: 0.15 },
  ] },
  // Explainer (Mayer — Multimedia Learning: hình đúng lời, bỏ chữ thừa, chia nhỏ từng bước).
  giai_thich: { ten: 'Explainer (vấn đề → cách hoạt động → ví dụ → tóm tắt)', beats: [
    { ten: 'Vấn đề / câu hỏi', mo_ta: 'Điều người xem đang thắc mắc, một câu', phan: 0.15 }, { ten: 'Ý chính', mo_ta: 'Câu trả lời ngắn nhất trước', phan: 0.15 },
    { ten: 'Cách hoạt động', mo_ta: 'Chia từng bước, mỗi bước một hình', phan: 0.35 }, { ten: 'Ví dụ', mo_ta: 'Một ví dụ đời thường', phan: 0.2 }, { ten: 'Tóm tắt', mo_ta: 'Nhắc lại ý chính + nên làm gì', phan: 0.15 },
  ] },
  // Bài học (Gagné — Nine Events of Instruction, gộp còn 7 nhịp cho video).
  bai_hoc: { ten: 'Bài học (gây chú ý → mục tiêu → gợi điều đã biết → giảng → ví dụ → thực hành → tóm tắt)', beats: [
    { ten: 'Gây chú ý', mo_ta: 'Một câu hỏi / tình huống thật', phan: 0.06 }, { ten: 'Mục tiêu', mo_ta: 'Học xong làm được gì', phan: 0.06 },
    { ten: 'Gợi điều đã biết', mo_ta: 'Nối với kiến thức người học có sẵn', phan: 0.08 }, { ten: 'Giảng', mo_ta: 'Nội dung chia nhỏ, hình minh hoạ đúng lời', phan: 0.35 },
    { ten: 'Ví dụ', mo_ta: 'Làm mẫu một lần', phan: 0.18 }, { ten: 'Thực hành', mo_ta: 'Câu hỏi / bài tập người học tự thử', phan: 0.15 }, { ten: 'Tóm tắt', mo_ta: 'Nhắc lại + bước tiếp theo', phan: 0.12 },
  ] },
  // Quảng cáo: `phan` = tỉ lệ thời lượng của beat (cộng = 1) → tách cảnh biết beat nào được mấy giây với thời lượng mục tiêu bất kỳ.
  quang_cao: { ten: 'Quảng cáo (hook → nỗi đau → giải pháp → bằng chứng → ưu đãi)', beats: [
    { ten: 'Hook', mo_ta: '1–3 giây đầu: HÌNH gây dừng tay + chữ trên màn + câu chạm đúng người xem', phan: 0.1 }, { ten: 'Nỗi đau', mo_ta: 'Vấn đề họ gặp mỗi ngày, thấy bằng mắt', phan: 0.15 },
    { ten: 'Khuấy', mo_ta: 'Làm nỗi đau rõ hơn, đồng cảm', phan: 0.1 }, { ten: 'Giải pháp', mo_ta: 'Sản phẩm xuất hiện (trước giây thứ 5 nếu được)', phan: 0.15 },
    { ten: 'Demo', mo_ta: 'Cho thấy nó hoạt động: cận chi tiết, trước/sau, mặc thử', phan: 0.2 }, { ten: 'Bằng chứng', mo_ta: 'Người thật, số liệu, đánh giá — CHỈ số có trong mục sản phẩm', phan: 0.15 },
    { ten: 'Ưu đãi + CTA', mo_ta: 'Trấn an (size / đổi trả / bảo hành) → ưu đãi → hành động cụ thể, có chữ trên màn', phan: 0.15 },
  ] },
};
/** Chia thời lượng mục tiêu cho các beat theo `phan` → "Hook 0–3s · Nỗi đau 3–7s …" (beat không có phan → chia đều phần còn lại). */
/** Khung beat của một tập: thể loại có khung riêng (phim ngắn dọc) thắng loại sản phẩm; không thì theo loại (phim / short / quảng cáo). MỘT chỗ chọn. */
/** khungGoi = khung beat của GÓI THỂ LOẠI phim đang chọn (goi-the-loai.ts) — gói thắng thể loại thắng loại sản phẩm. */
export const khoaKhung = (loai: string, theLoai?: string | null, khungGoi?: string | null): string => (khungGoi && CAU_TRUC[khungGoi] ? khungGoi : theLoai && CAU_TRUC[theLoai] ? theLoai : CAU_TRUC[loai] ? loai : 'phim');
export function giayBeat(loai: string, tong: number): { ten: string; tu: number; den: number }[] {
  const beats = (CAU_TRUC[loai] ?? CAU_TRUC.phim!).beats;
  const coPhan = beats.reduce((a, b) => a + (b.phan ?? 0), 0);
  const chuaPhan = beats.filter((b) => !b.phan).length;
  const conLai = Math.max(0, 1 - coPhan);
  let t = 0;
  return beats.map((b) => { const g = tong * (b.phan ?? (chuaPhan ? conLai / chuaPhan : 0)); const tu = t; t += g; return { ten: b.ten, tu: Math.round(tu * 10) / 10, den: Math.round(t * 10) / 10 }; });
}
