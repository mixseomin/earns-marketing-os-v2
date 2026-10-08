// Thư viện ngôn ngữ điện ảnh của studio (góp ý #1194 + #1195, 08/10/2026): cỡ cảnh · góc máy · chuyển động máy · ống kính · ánh sáng ·
// màu · chuyển cảnh · âm thanh · nhạc, mỗi kỹ thuật gắn thể loại hợp với nó (kinh dị ≠ hài ≠ quảng cáo UGC) + cấu trúc beat theo loại phim.
// Claude chọn kỹ thuật cho từng shot TỪ thư viện này (theo thể loại của phim); `prompt` (tiếng Anh) được ghép vào prompt ảnh/video
// nên ảnh + clip ra đúng cỡ cảnh, ánh sáng, chuyển động. File thuần dữ liệu — client lẫn server import được.

export type TheLoai = 'hoat_hinh' | 'phieu_luu' | 'kinh_di' | 'hanh_dong' | 'tinh_cam' | 'hai' | 'chinh_kich' | 'vien_tuong' | 'tai_lieu' | 'qc_ugc' | 'qc_cao_cap';
export type NhomKyThuat = 'co_canh' | 'goc' | 'chuyen_dong' | 'ong_kinh' | 'anh_sang' | 'mau' | 'chuyen_canh' | 'am_thanh' | 'nhac';
export type KyThuat = { key: string; nhom: NhomKyThuat; ten: string; mo_ta: string; prompt: string; the_loai: TheLoai[] | 'tat_ca' };
/** Kỹ thuật đã chọn cho một shot (mỗi nhóm một key; âm thanh có thể nhiều). */
export type KyThuatShot = Partial<Record<Exclude<NhomKyThuat, 'am_thanh'>, string>> & { am_thanh?: string[] };

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
];

export const NHOM_KY_THUAT: { key: NhomKyThuat; ten: string; icon: string }[] = [
  { key: 'co_canh', ten: 'Cỡ cảnh', icon: '🔲' }, { key: 'goc', ten: 'Góc máy', icon: '📐' }, { key: 'chuyen_dong', ten: 'Chuyển động máy', icon: '🎥' },
  { key: 'ong_kinh', ten: 'Ống kính', icon: '🔭' }, { key: 'anh_sang', ten: 'Ánh sáng', icon: '💡' }, { key: 'mau', ten: 'Màu', icon: '🎨' },
  { key: 'chuyen_canh', ten: 'Chuyển cảnh', icon: '✂' }, { key: 'am_thanh', ten: 'Âm thanh', icon: '🔊' }, { key: 'nhac', ten: 'Nhạc', icon: '🎵' },
];

const T = 'tat_ca' as const;
const k = (nhom: NhomKyThuat, key: string, ten: string, mo_ta: string, prompt: string, the_loai: TheLoai[] | 'tat_ca'): KyThuat => ({ key, nhom, ten, mo_ta, prompt, the_loai });

export const THU_VIEN: KyThuat[] = [
  // ── Cỡ cảnh
  k('co_canh', 'ews', 'Toàn cảnh rất rộng (mở cảnh)', 'Giới thiệu nơi chốn, cho thấy nhân vật nhỏ bé trước thế giới. Đặt đầu phân cảnh.', 'extreme wide establishing shot, tiny figures in a vast environment', ['phieu_luu', 'hoat_hinh', 'vien_tuong', 'chinh_kich', 'kinh_di', 'tai_lieu']),
  k('co_canh', 'ws', 'Toàn cảnh', 'Thấy trọn người và không gian quanh — hành động lớn, vị trí nhân vật.', 'wide shot, full bodies visible with their surroundings', T),
  k('co_canh', 'ms', 'Trung cảnh', 'Từ hông trở lên: hội thoại, cử chỉ tay. Cỡ cảnh "kể chuyện" mặc định.', 'medium shot, framed from the waist up', T),
  k('co_canh', 'mcu', 'Cận trung', 'Từ ngực trở lên: thoại có cảm xúc, nói vào máy (UGC).', 'medium close-up, chest up, face clearly readable', T),
  k('co_canh', 'cu', 'Cận mặt', 'Cảm xúc chiếm trọn khung: phản ứng, nước mắt, quyết định.', 'close-up on the face, emotion fills the frame, shallow depth of field', T),
  k('co_canh', 'ecu', 'Đặc tả', 'Chỉ một chi tiết: mắt, bàn tay, giọt mồ hôi — căng thẳng tột độ hoặc chi tiết sản phẩm.', 'extreme close-up detail, a single feature fills the frame', ['kinh_di', 'chinh_kich', 'hanh_dong', 'tinh_cam', 'qc_cao_cap']),
  k('co_canh', 'insert', 'Cận đồ vật (insert)', 'Cận vật quan trọng với câu chuyện hoặc sản phẩm.', 'insert shot of the object, crisp detail, clean background', T),
  k('co_canh', 'ots', 'Qua vai', 'Nhìn qua vai người nghe tới người nói — đặt hai người trong một quan hệ.', 'over-the-shoulder shot, foreground shoulder softly out of focus', ['chinh_kich', 'tinh_cam', 'hanh_dong', 'kinh_di', 'hai', 'vien_tuong']),
  k('co_canh', 'two', 'Khung hai người', 'Hai nhân vật cùng khung: tình bạn, đối đầu, khoảng cách giữa họ nói lên quan hệ.', 'two-shot, both characters framed together', T),
  k('co_canh', 'pov', 'Góc nhìn nhân vật (POV)', 'Khán giả nhìn bằng mắt nhân vật — đồng cảm hoặc sợ hãi.', 'first-person point-of-view shot', ['kinh_di', 'hanh_dong', 'qc_ugc', 'phieu_luu']),
  // ── Góc máy
  k('goc', 'ngang', 'Ngang tầm mắt', 'Trung tính, gần gũi — khán giả ngang hàng nhân vật.', 'eye-level camera angle', T),
  k('goc', 'thap', 'Góc thấp (hất lên)', 'Nhân vật trông mạnh, oai, đáng sợ hoặc anh hùng.', 'low-angle shot looking up, subject appears powerful', ['hanh_dong', 'phieu_luu', 'kinh_di', 'vien_tuong', 'hoat_hinh', 'qc_cao_cap']),
  k('goc', 'cao', 'Góc cao (nhìn xuống)', 'Nhân vật nhỏ bé, yếu thế, cô đơn.', 'high-angle shot looking down, subject appears small and vulnerable', ['chinh_kich', 'kinh_di', 'tinh_cam', 'hoat_hinh']),
  k('goc', 'nghieng', 'Góc nghiêng (Dutch)', 'Khung lệch — bất an, mất cân bằng, điên loạn.', 'dutch angle, tilted horizon, unsettling composition', ['kinh_di', 'hanh_dong', 'vien_tuong']),
  k('goc', 'tren_xuong', 'Từ trên xuống (bird-eye)', 'Nhìn thẳng từ trên: bố cục, bản đồ, định mệnh.', "top-down bird's-eye view", ['phieu_luu', 'hanh_dong', 'qc_cao_cap', 'tai_lieu']),
  k('goc', 'sat_dat', 'Sát đất (worm-eye)', 'Máy sát mặt đất — kịch tính, thế giới khổng lồ.', "worm's-eye view from ground level", ['hoat_hinh', 'phieu_luu', 'hanh_dong']),
  k('goc', 'selfie', 'Selfie / cầm tay nói vào máy', 'Người nói cầm điện thoại nói thẳng vào ống kính — chất UGC thật.', 'selfie angle, handheld phone held at arm length, looking straight into the lens', ['qc_ugc']),
  // ── Chuyển động máy
  k('chuyen_dong', 'tinh', 'Máy đứng yên', 'Để diễn xuất tự nói; hợp hài (đúng nhịp) và chính kịch.', 'static locked-off camera', T),
  k('chuyen_dong', 'day_vao', 'Đẩy chậm vào (push-in)', 'Máy tiến dần vào mặt — khoảnh khắc nhận ra, cảm xúc dâng.', 'slow push-in dolly toward the subject', ['chinh_kich', 'tinh_cam', 'kinh_di', 'hoat_hinh', 'vien_tuong', 'qc_cao_cap']),
  k('chuyen_dong', 'lui_ra', 'Lùi ra (pull-out)', 'Máy lùi xa — hé lộ bối cảnh, cô đơn, kết cảnh.', 'slow dolly pull-out revealing the surroundings', ['chinh_kich', 'phieu_luu', 'kinh_di', 'tinh_cam']),
  k('chuyen_dong', 'lia', 'Lia ngang (pan)', 'Quét không gian, theo hướng nhìn của nhân vật.', 'smooth horizontal pan', T),
  k('chuyen_dong', 'nghieng_len', 'Nghiêng lên/xuống (tilt)', 'Từ chân lên mặt — hé lộ nhân vật hoặc vật to lớn.', 'vertical tilt reveal', T),
  k('chuyen_dong', 'truot_ngang', 'Trượt ngang (truck)', 'Máy đi song song nhân vật đang đi — đồng hành.', 'tracking shot moving sideways alongside the subject', ['phieu_luu', 'hoat_hinh', 'hanh_dong', 'qc_cao_cap', 'tai_lieu']),
  k('chuyen_dong', 'cau', 'Cẩu lên (crane)', 'Máy bay lên cao — hùng vĩ, kết thúc, chiến thắng.', 'crane shot rising up and away', ['phieu_luu', 'hoat_hinh', 'chinh_kich', 'vien_tuong']),
  k('chuyen_dong', 'cam_tay', 'Cầm tay (handheld)', 'Rung nhẹ, thật, gấp gáp — hành động, UGC, tài liệu.', 'handheld camera with natural subtle shake', ['hanh_dong', 'kinh_di', 'tai_lieu', 'qc_ugc']),
  k('chuyen_dong', 'theo', 'Bám theo (steadicam)', 'Máy theo sau lưng nhân vật mượt mà — đưa khán giả vào hành trình.', 'smooth steadicam following behind the subject', ['phieu_luu', 'kinh_di', 'hanh_dong', 'chinh_kich']),
  k('chuyen_dong', 'vong', 'Quay vòng (orbit)', 'Máy vòng quanh nhân vật/sản phẩm — khoảnh khắc lớn, khoe sản phẩm.', '360-degree orbit around the subject', ['hanh_dong', 'tinh_cam', 'qc_cao_cap', 'vien_tuong']),
  k('chuyen_dong', 'quat', 'Quất nhanh (whip pan)', 'Lia cực nhanh nhòe hình — nhịp hài hoặc chuyển cảnh năng lượng.', 'fast whip pan with motion blur', ['hai', 'hanh_dong', 'qc_ugc']),
  k('chuyen_dong', 'doi_net', 'Đổi nét (rack focus)', 'Chuyển nét từ vật này sang vật kia — dẫn mắt, tiết lộ.', 'rack focus shifting from foreground to background', ['kinh_di', 'chinh_kich', 'tinh_cam', 'qc_cao_cap']),
  k('chuyen_dong', 'zoom_gat', 'Zoom gắt (crash zoom)', 'Zoom vào cực nhanh — sốc, hài, nhấn mạnh.', 'sudden crash zoom', ['hai', 'kinh_di', 'qc_ugc']),
  // ── Ống kính
  k('ong_kinh', 'rong', 'Góc rộng 24mm', 'Không gian giãn, gần mà méo nhẹ — phiêu lưu, hài.', '24mm wide-angle lens', T),
  k('ong_kinh', 'chuan', 'Chuẩn 35–50mm', 'Gần mắt người, tự nhiên.', '35mm lens, natural perspective', T),
  k('ong_kinh', 'chan_dung', 'Chân dung 85mm', 'Nền xoá mịn, mặt nổi bật — cảm xúc, sản phẩm.', '85mm portrait lens, creamy bokeh background', ['tinh_cam', 'chinh_kich', 'qc_cao_cap', 'hoat_hinh']),
  k('ong_kinh', 'tele', 'Tele 135mm', 'Nén hậu cảnh, theo dõi từ xa — rình rập, cô lập.', '135mm telephoto lens, compressed background', ['kinh_di', 'hanh_dong', 'tai_lieu', 'chinh_kich']),
  k('ong_kinh', 'macro', 'Macro', 'Chi tiết siêu cận: chất vải, đường may, giọt nước.', 'macro lens, extreme texture detail', ['qc_cao_cap', 'qc_ugc', 'tai_lieu', 'kinh_di']),
  k('ong_kinh', 'anamorphic', 'Anamorphic', 'Khung điện ảnh rộng, vệt loé ngang — chất phim chiếu rạp.', 'anamorphic lens, horizontal lens flares, cinematic widescreen', ['vien_tuong', 'hanh_dong', 'phieu_luu', 'chinh_kich']),
  // ── Ánh sáng
  k('anh_sang', 'sang_deu', 'Sáng đều (high-key)', 'Ít bóng, tươi sáng — hài, hoạt hình, quảng cáo.', 'bright high-key lighting, minimal shadows', ['hai', 'hoat_hinh', 'qc_ugc', 'qc_cao_cap']),
  k('anh_sang', 'toi', 'Tối nhiều bóng (low-key)', 'Mảng tối lớn, một nguồn sáng — bí ẩn, đe doạ.', 'low-key lighting, deep shadows, single hard source', ['kinh_di', 'chinh_kich', 'hanh_dong', 'vien_tuong']),
  k('anh_sang', 'tuong_phan', 'Sáng tối gắt (chiaroscuro)', 'Nửa mặt sáng nửa tối — giằng xé nội tâm.', 'chiaroscuro lighting, half the face in shadow', ['chinh_kich', 'kinh_di', 'tinh_cam']),
  k('anh_sang', 'hoang_hon', 'Giờ vàng', 'Nắng chiều vàng ấm, xiên dài — hoài niệm, lãng mạn, hy vọng.', 'golden hour sunlight, warm low sun, long soft shadows', ['tinh_cam', 'hoat_hinh', 'phieu_luu', 'chinh_kich', 'qc_cao_cap']),
  k('anh_sang', 'gio_xanh', 'Giờ xanh', 'Sau hoàng hôn, xanh lạnh dịu — trầm lặng, buồn.', 'blue hour, cool twilight ambience', ['chinh_kich', 'tinh_cam', 'vien_tuong']),
  k('anh_sang', 'cua_so', 'Ánh cửa sổ mềm', 'Ánh ban ngày qua cửa sổ, mềm và thật — UGC, đời thường.', 'soft natural window light, gentle falloff', ['qc_ugc', 'tai_lieu', 'tinh_cam', 'chinh_kich']),
  k('anh_sang', 'nguoc', 'Ngược sáng / bóng đen', 'Nhân vật thành bóng trước nguồn sáng — bí ẩn, hùng tráng.', 'strong backlight, silhouette', ['phieu_luu', 'kinh_di', 'hanh_dong', 'tinh_cam']),
  k('anh_sang', 'vien', 'Đèn viền (rim light)', 'Viền sáng tách người khỏi nền tối — điện ảnh, sản phẩm sang.', 'rim light outlining the subject against a dark background', ['qc_cao_cap', 'hanh_dong', 'vien_tuong', 'chinh_kich']),
  k('anh_sang', 'neon', 'Neon', 'Ánh hồng/xanh neon — đô thị đêm, tương lai.', 'neon pink and cyan practical lighting', ['vien_tuong', 'hanh_dong']),
  k('anh_sang', 'trang', 'Ánh trăng', 'Xanh bạc yếu, đêm — huyền bí, sợ hãi.', 'cold moonlight, silver-blue night', ['kinh_di', 'phieu_luu', 'hoat_hinh']),
  k('anh_sang', 'nhap_nhay', 'Đèn chập chờn', 'Đèn nhấp nháy — bất an, sắp có chuyện.', 'flickering light, unstable illumination', ['kinh_di', 'vien_tuong']),
  k('anh_sang', 'duoi_len', 'Rọi từ dưới lên', 'Đèn hắt từ dưới mặt — ma quái.', 'under-lighting from below the face', ['kinh_di']),
  k('anh_sang', 'studio', 'Đèn studio sản phẩm', 'Softbox lớn, phản sáng trắng — sản phẩm sạch, đúng màu.', 'professional studio product lighting, large softbox, clean reflections', ['qc_cao_cap']),
  // ── Màu
  k('mau', 'am', 'Ấm áp', 'Cam vàng — gia đình, an toàn, thân thương.', 'warm color grade, amber and honey tones', ['hoat_hinh', 'tinh_cam', 'qc_ugc', 'chinh_kich']),
  k('mau', 'teal_cam', 'Teal–cam', 'Da cam nổi trên nền xanh — chuẩn bom tấn.', 'teal and orange blockbuster color grade', ['hanh_dong', 'phieu_luu', 'vien_tuong']),
  k('mau', 'lanh', 'Lạnh, bạc màu', 'Xanh xám, rút bão hoà — u ám, cô độc.', 'cold desaturated grade, steel blue and grey', ['kinh_di', 'chinh_kich', 'vien_tuong']),
  k('mau', 'xanh_benh', 'Xanh bệnh hoạn', 'Ám xanh lá vàng — ghê rợn, sai sai.', 'sickly green tint, unsettling', ['kinh_di']),
  k('mau', 'pastel', 'Pastel', 'Hồng, xanh bạc hà nhạt — dễ thương, nhẹ nhàng.', 'soft pastel palette', ['hoat_hinh', 'hai', 'tinh_cam', 'qc_ugc']),
  k('mau', 'tu_nhien', 'Tự nhiên', 'Đúng màu thật, da thật — tài liệu, UGC, sản phẩm.', 'natural true-to-life colors, accurate skin tones', ['tai_lieu', 'qc_ugc', 'qc_cao_cap']),
  k('mau', 'tuong_phan_cao', 'Tương phản cao', 'Đen sâu, sáng gắt — mạnh, kịch tính.', 'high-contrast grade, deep blacks', ['hanh_dong', 'kinh_di', 'qc_cao_cap']),
  k('mau', 'den_trang', 'Đen trắng', 'Hồi ức, nghiêm trang, nghệ thuật.', 'black and white', ['chinh_kich', 'kinh_di', 'tai_lieu']),
  // ── Chuyển cảnh (cách shot này nối sang shot sau)
  k('chuyen_canh', 'cat', 'Cắt thẳng', 'Mặc định, gọn.', '', T),
  k('chuyen_canh', 'cat_khop', 'Cắt khớp hình (match cut)', 'Hình dáng/chuyển động shot sau khớp shot trước — nối ý, thời gian trôi.', 'end on a strong shape or motion that the next shot will mirror', ['phieu_luu', 'chinh_kich', 'vien_tuong', 'qc_cao_cap', 'hoat_hinh']),
  k('chuyen_canh', 'j_cut', 'J-cut (tiếng đến trước)', 'Âm thanh cảnh sau vang lên trước khi hình đổi — dẫn mượt.', '', ['chinh_kich', 'tinh_cam', 'tai_lieu', 'phieu_luu']),
  k('chuyen_canh', 'l_cut', 'L-cut (tiếng còn kéo dài)', 'Tiếng cảnh trước còn đọng khi hình đã sang — dư âm cảm xúc.', '', ['chinh_kich', 'tinh_cam', 'tai_lieu']),
  k('chuyen_canh', 'hoa_tan', 'Hoà tan (dissolve)', 'Hình chồng mờ — thời gian trôi, hồi ức.', '', ['tinh_cam', 'chinh_kich', 'hoat_hinh']),
  k('chuyen_canh', 'toi_den', 'Tắt dần về đen', 'Kết một chương, khoảng lặng.', '', ['chinh_kich', 'kinh_di', 'tinh_cam', 'tai_lieu']),
  k('chuyen_canh', 'quat_chuyen', 'Quất chuyển (whip)', 'Lia nhanh sang cảnh mới — năng lượng, hài, quảng cáo.', 'end with a fast whip-pan motion blur', ['hai', 'hanh_dong', 'qc_ugc']),
  k('chuyen_canh', 'cat_soc', 'Cắt sốc (smash cut)', 'Từ yên tĩnh cắt phắt sang ồn ào (hoặc ngược) — doạ, hài.', '', ['kinh_di', 'hai', 'hanh_dong']),
  k('chuyen_canh', 'nhay', 'Jump cut', 'Cắt nhảy trong cùng khung — nhịp nhanh kiểu TikTok/UGC.', '', ['qc_ugc', 'hai']),
  // ── Âm thanh
  k('am_thanh', 'nen_phong', 'Âm nền phòng', 'Tiếng phòng nhỏ, đồng hồ, tủ lạnh — thật, gần.', 'quiet room tone ambience', T),
  k('am_thanh', 'rung', 'Âm rừng', 'Chim, gió lá, côn trùng.', 'forest ambience, birdsong, rustling leaves', ['hoat_hinh', 'phieu_luu', 'kinh_di', 'tai_lieu']),
  k('am_thanh', 'pho', 'Âm phố', 'Xe cộ, người qua lại.', 'city street ambience, distant traffic', ['hanh_dong', 'chinh_kich', 'tai_lieu', 'qc_ugc']),
  k('am_thanh', 'mua', 'Mưa', 'Mưa rơi — buồn, lãng mạn, ghê rợn.', 'steady rain ambience', ['tinh_cam', 'chinh_kich', 'kinh_di']),
  k('am_thanh', 'foley', 'Tiếng động cận (foley)', 'Bước chân, vải sột soạt, đồ chạm — làm hình "có thật".', 'close foley sounds synced to the action', T),
  k('am_thanh', 'tim_dap', 'Nhịp tim', 'Tiếng tim đập to dần — hồi hộp.', 'heartbeat getting louder', ['kinh_di', 'hanh_dong', 'chinh_kich']),
  k('am_thanh', 'im_lang', 'Im lặng đột ngột', 'Cắt hết âm — trước cú doạ hay khoảnh khắc lớn.', 'sudden silence', ['kinh_di', 'chinh_kich', 'hanh_dong']),
  k('am_thanh', 'dap_doa', 'Âm doạ (sting)', 'Một tiếng đánh mạnh lúc doạ.', 'sharp horror sting', ['kinh_di']),
  k('am_thanh', 'cuon_len', 'Âm cuộn lên (riser)', 'Âm dâng dần dẫn vào cao trào hay tiết lộ.', 'rising whoosh riser', ['hanh_dong', 'vien_tuong', 'qc_cao_cap', 'qc_ugc', 'kinh_di']),
  k('am_thanh', 'vut', 'Vút (whoosh)', 'Đi kèm chuyển động nhanh, chuyển cảnh.', 'whoosh swoosh', ['hanh_dong', 'hai', 'qc_ugc', 'qc_cao_cap']),
  k('am_thanh', 'cot_ket', 'Cót két', 'Cửa, sàn gỗ cót két.', 'creaking wooden door and floorboards', ['kinh_di', 'hai']),
  // ── Nhạc
  k('nhac', 'piano', 'Piano ấm', 'Vài nốt piano mộc — tình cảm, hồi tưởng.', 'gentle warm solo piano', ['tinh_cam', 'chinh_kich', 'hoat_hinh', 'qc_ugc']),
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

export const kyThuat = (key: string | undefined, nhom?: NhomKyThuat) => (key ? THU_VIEN.find((x) => x.key === key && (!nhom || x.nhom === nhom)) : undefined);
export const hopTheLoai = (x: KyThuat, tl: TheLoai | undefined) => x.the_loai === 'tat_ca' || !tl || x.the_loai.includes(tl);
/** Kỹ thuật của một nhóm, cái hợp thể loại đứng trước. */
export const dsTheoNhom = (nhom: NhomKyThuat, tl?: TheLoai) => THU_VIEN.filter((x) => x.nhom === nhom).sort((a, b) => Number(hopTheLoai(b, tl)) - Number(hopTheLoai(a, tl)));

/** Đoạn prompt tiếng Anh cho ẢNH keyframe (khung tĩnh: cỡ cảnh, góc, ống kính, ánh sáng, màu). */
export function promptKyThuatAnh(kt: KyThuatShot | undefined): string {
  if (!kt) return '';
  return (['co_canh', 'goc', 'ong_kinh', 'anh_sang', 'mau'] as const).map((n) => kyThuat(kt[n], n)?.prompt).filter(Boolean).join(', ');
}
/** Đoạn prompt tiếng Anh cho VIDEO (chuyển động máy + chuyển cảnh + âm thanh + nhạc — model có tiếng hiểu được). */
export function promptKyThuatVideo(kt: KyThuatShot | undefined): string {
  if (!kt) return '';
  const may = kyThuat(kt.chuyen_dong, 'chuyen_dong')?.prompt;
  const ket = kyThuat(kt.chuyen_canh, 'chuyen_canh')?.prompt;
  const am = (kt.am_thanh ?? []).map((x) => kyThuat(x, 'am_thanh')?.prompt).filter(Boolean);
  const nhac = kyThuat(kt.nhac, 'nhac')?.prompt;
  return [may && `Camera: ${may}.`, ket && `${ket}.`, am.length ? `Sound: ${am.join(', ')}.` : '', nhac ? `Music: ${nhac}.` : ''].filter(Boolean).join(' ');
}
/** Nhãn tiếng Việt ngắn của các kỹ thuật đã chọn — hiện trên thẻ shot / timeline. */
export function nhanKyThuat(kt: KyThuatShot | undefined): string[] {
  if (!kt) return [];
  const out: string[] = [];
  for (const n of NHOM_KY_THUAT) {
    if (n.key === 'am_thanh') { for (const a of kt.am_thanh ?? []) { const x = kyThuat(a, 'am_thanh'); if (x) out.push(`${n.icon} ${x.ten}`); } continue; }
    const x = kyThuat(kt[n.key as Exclude<NhomKyThuat, 'am_thanh'>], n.key);
    if (x) out.push(`${n.icon} ${x.ten}`);
  }
  return out;
}
/** Chỉ giữ key có trong thư viện (Claude lỡ bịa key thì bỏ). */
export function lamSachKyThuat(kt: Record<string, unknown> | undefined): KyThuatShot {
  const o: KyThuatShot = {};
  if (!kt) return o;
  for (const n of NHOM_KY_THUAT) {
    const v = kt[n.key];
    if (n.key === 'am_thanh') { const ds = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && !!kyThuat(x, 'am_thanh')); if (ds.length) o.am_thanh = ds.slice(0, 3); continue; }
    if (typeof v === 'string' && kyThuat(v, n.key)) (o as Record<string, string>)[n.key] = v;
  }
  return o;
}

// ── Cấu trúc beat theo loại phim ──────────────────────────────────────────────────────────────────────────────
export type Beat = { ten: string; mo_ta: string; cam_xuc: number };
export const CAU_TRUC: Record<string, { ten: string; beats: { ten: string; mo_ta: string }[] }> = {
  phim: { ten: 'Ba hồi (rút gọn Save the Cat)', beats: [
    { ten: 'Mở đầu', mo_ta: 'Thế giới bình thường, nhân vật và điều họ thiếu' }, { ten: 'Biến cố', mo_ta: 'Sự kiện phá vỡ bình thường, đẩy nhân vật vào hành trình' },
    { ten: 'Bước qua ngưỡng', mo_ta: 'Nhân vật chọn dấn thân' }, { ten: 'Thử thách', mo_ta: 'Vui chơi & thử thách, quan hệ hình thành' },
    { ten: 'Giữa phim', mo_ta: 'Bước ngoặt: chiến thắng giả hoặc thất bại giả, mục tiêu đổi' }, { ten: 'Tất cả sụp đổ', mo_ta: 'Điểm thấp nhất, mất mát' },
    { ten: 'Cao trào', mo_ta: 'Nhân vật dùng điều đã học để đối mặt' }, { ten: 'Kết', mo_ta: 'Thế giới mới, nhân vật đã thay đổi (móc tập sau nếu là series)' },
  ] },
  short: { ten: 'Short (hook → dồn → twist → chốt)', beats: [
    { ten: 'Hook 3 giây', mo_ta: 'Câu/khung hình giữ ngón tay lại' }, { ten: 'Dồn nén', mo_ta: 'Tăng tò mò, tăng tốc' },
    { ten: 'Twist', mo_ta: 'Lật kỳ vọng' }, { ten: 'Chốt', mo_ta: 'Kết đọng lại + lời kêu gọi theo dõi' },
  ] },
  quang_cao: { ten: 'Quảng cáo (hook → nỗi đau → giải pháp → bằng chứng → ưu đãi)', beats: [
    { ten: 'Hook', mo_ta: '3 giây đầu: câu nói chạm đúng người xem' }, { ten: 'Nỗi đau', mo_ta: 'Vấn đề họ gặp mỗi ngày' },
    { ten: 'Khuấy', mo_ta: 'Làm nỗi đau rõ hơn, đồng cảm' }, { ten: 'Giải pháp', mo_ta: 'Sản phẩm xuất hiện' },
    { ten: 'Demo', mo_ta: 'Cho thấy nó hoạt động' }, { ten: 'Bằng chứng', mo_ta: 'Người thật, số liệu, đánh giá' },
    { ten: 'Ưu đãi + CTA', mo_ta: 'Giảm giá, lời kêu gọi mua' },
  ] },
};
