// KỸ THUẬT BỔ SUNG cho thư viện điện ảnh (anh 18/10/2026: "thêm tất cả các kỹ thuật của ngành điện ảnh vào thư viện từ camera, hook, chuyển cảnh…
// thì mới có cái mà chọn"). Claude chỉ chọn TRONG thư viện (dien-anh.ts › THU_VIEN) — kỹ thuật không có ở đây thì không bao giờ xuất hiện trong phim
// (vd cú máy chuyển chủ thể A → B kiểu HBO). Tệp này gộp vào THU_VIEN (dien-anh.ts) và NGANH (dien-anh-nganh.ts); chuyển động máy + nhịp diễn mới
// có đủ mô tả ngành và phần số cho 3D (test dien-anh-nganh.test.mts bắt). Nhóm mới: 🪝 hook (móc câu — chỉ shot mở). Thuần dữ liệu.
// Nguồn: Mascelli — The Five C's of Cinematography; Bowen — Grammar of the Shot; Katz — Film Directing Shot by Shot; Mercado — The Filmmaker's Eye;
// Blain Brown — Cinematography: Theory and Practice / Motion Picture and Video Lighting; Murch — In the Blink of an Eye; Ed Hooks — Acting for Animators;
// David Sonnenschein — Sound Design; Hook QC: Meta Creative Best Practices (3 giây đầu), TikTok Creative Center (hook types).
import type { KyThuat, NhomKyThuat, NhomChuyenCanh, TheLoai } from './dien-anh';
import type { NganhKyThuat, MayDi } from './dien-anh-nganh';

const T = 'tat_ca' as const;
const DRAMA: TheLoai[] = ['chinh_kich', 'tinh_cam', 'phim_doc', 'kinh_di', 'hanh_dong', 'vien_tuong', 'phieu_luu'];
const QC: TheLoai[] = ['qc_ugc', 'qc_cao_cap'];
const k = (nhom: NhomKyThuat, key: string, ten: string, mo_ta: string, prompt: string, the_loai: TheLoai[] | 'tat_ca'): KyThuat => ({ key, nhom, ten, mo_ta, prompt, the_loai });
const cc = (key: string, ten: string, mo_ta: string, nhom_cc: NhomChuyenCanh, xfade: string, giay_cc = 0.4, the_loai: TheLoai[] | 'tat_ca' = T): KyThuat => ({ key, nhom: 'chuyen_canh', ten, mo_ta, prompt: '', the_loai, xfade, nhom_cc, giay_cc });

export const THU_VIEN_THEM: KyThuat[] = [
  // ── Vai kể
  k('vai', 'xen_canh', 'Shot xen (cutaway)', 'Cắt sang một thứ khác trong cùng cảnh (đồng hồ, người ngoài cuộc, cửa) rồi quay lại — nén thời gian, che chỗ nối, gợi điều sắp tới.', 'cutaway to a related detail elsewhere in the same scene', T),
  k('vai', 'he_lo', 'Hé lộ (reveal)', 'Shot sinh ra để LỘ một thông tin khán giả chưa biết — người đứng sau, vật bị giấu, quy mô thật của nơi chốn.', 'reveal shot: the framing or camera move uncovers something previously hidden', T),
  k('vai', 'cau_noi', 'Cầu nối (bridging shot)', 'Shot nối hai cảnh / hai nơi / hai thời điểm: đường đi, cửa đóng, xe chạy qua — cho khán giả biết đã chuyển.', 'bridging transition shot linking two places or times', T),
  k('vai', 'ket_canh', 'Shot kết cảnh (closing)', 'Khung chốt lại cảnh: lùi xa, người rời khung, cửa khép — dấu chấm câu trước cảnh sau.', 'closing shot of the scene, a quiet final image that ends the beat', T),
  // ── Cỡ cảnh / khung
  k('co_canh', 'toan_than', 'Toàn thân (full shot)', 'Thấy trọn người từ đầu tới chân, ít không gian quanh — dáng, trang phục, cử chỉ cả thân.', 'full shot, the whole body from head to feet', T),
  k('co_canh', 'cao_boi', 'Ba phần tư (cowboy / American)', 'Từ đùi trở lên — đối mặt, thế đứng, tay gần hông; nhóm người đối đầu.', 'cowboy shot framed from mid-thigh up', ['hanh_dong', 'phieu_luu', 'phim_doc', 'chinh_kich']),
  k('co_canh', 'trung_toan', 'Trung toàn (medium wide)', 'Từ gối trở lên, còn không gian quanh — người và nơi chốn cân nhau.', 'medium wide shot from the knees up with room around the subject', T),
  k('co_canh', 'nhom', 'Khung nhóm (group shot)', 'Ba người trở lên trong một khung — quan hệ, phe phái, ai đứng giữa.', 'group shot with three or more characters arranged in one frame', T),
  k('co_canh', 'qua_tien_canh', 'Qua tiền cảnh (dirty frame)', 'Một mảng tiền cảnh mờ (vai, khung cửa, cành lá) che một phần khung — chiều sâu, như đang nhìn trộm.', 'dirty frame shot through a soft out-of-focus foreground element', DRAMA),
  k('co_canh', 'khung_trong_khung', 'Khung trong khung', 'Chủ thể đứng trong một khung có sẵn (cửa, cửa sổ, gương) — giam cầm, cô lập, nhấn mạnh.', 'frame within a frame: subject framed inside a doorway, window or mirror', DRAMA),
  k('co_canh', 'phan_chieu', 'Qua phản chiếu', 'Thấy chủ thể qua gương, kính, mặt nước — hai mặt, tự vấn, lộ điều sau lưng.', 'shot of the subject seen through a reflection in a mirror, glass or water', DRAMA),
  k('co_canh', 'chia_doi_khung', 'Chia đôi khung (split screen)', 'Hai hình cạnh nhau trong một khung — hai nơi cùng lúc, trước / sau, hai người gọi nhau.', 'split screen composition, two images side by side', ['qc_ugc', 'qc_cao_cap', 'hai', 'hanh_dong']),
  // ── Góc máy
  k('goc', 'ngang_vai', 'Ngang vai', 'Máy thấp hơn mắt một chút — nhân vật hơi cao lớn hơn, hợp nhân vật mạnh mà vẫn tự nhiên.', 'shoulder-level camera height', T),
  k('goc', 'ngang_hong', 'Ngang hông', 'Máy ngang thắt lưng — tay, súng, đồ vật trong tay; kiểu viễn Tây, đối đầu.', 'hip-level camera height', ['hanh_dong', 'phieu_luu', 'hai']),
  k('goc', 'ngang_goi', 'Ngang gối', 'Máy ngang đầu gối — bước chân, trẻ con, thú cưng; người lớn trông cao vọt.', 'knee-level camera height', ['hoat_hinh', 'hanh_dong', 'hai']),
  k('goc', 'qua_vai_nguoc', 'Góc ngược (reverse angle)', 'Máy đứng phía đối diện shot trước (180° trong cùng trục) — thấy điều người kia đang thấy.', 'reverse angle from the opposite side of the action, same screen axis', T),
  // ── Ống kính / độ nét
  k('ong_kinh', 'mat_ca', 'Mắt cá (fisheye)', 'Méo cong cực rộng — say, ảo giác, skate, hài.', 'fisheye lens with strong barrel distortion', ['hai', 'hanh_dong', 'qc_ugc']),
  k('ong_kinh', 'tilt_shift', 'Tilt-shift (thu nhỏ)', 'Một dải nét mỏng — thành phố như mô hình đồ chơi.', 'tilt-shift lens, miniature effect with a thin band of focus', ['phieu_luu', 'hai', 'qc_cao_cap']),
  k('ong_kinh', 'nong_sau', 'Xoá phông mỏng (shallow DOF)', 'Chỉ mắt nét, mọi thứ khác tan — cô lập, thân mật.', 'very shallow depth of field, creamy bokeh, only the eyes in focus', ['tinh_cam', 'chinh_kich', 'phim_doc', 'qc_cao_cap']),
  k('ong_kinh', 'sau_toan', 'Nét sâu (deep focus)', 'Tiền cảnh lẫn hậu cảnh đều nét — hai tầng hành động cùng lúc (Citizen Kane).', 'deep focus, foreground and background both sharp', ['chinh_kich', 'kinh_di', 'tai_lieu']),
  k('ong_kinh', 'chia_net', 'Chia nét (split diopter)', 'Hai chủ thể ở hai khoảng cách đều nét, vạch mờ ở giữa — căng thẳng hai người (De Palma).', 'split diopter shot, a near face and a far face both in sharp focus', ['kinh_di', 'chinh_kich', 'hanh_dong']),
  k('ong_kinh', 'mo_suong', 'Lọc mờ sương (diffusion)', 'Vùng sáng loang mềm — mơ màng, hồi ức, sắc đẹp.', 'diffusion filter, soft halation around highlights, dreamy glow', ['tinh_cam', 'qc_cao_cap', 'hoat_hinh']),
  // ── Ánh sáng
  k('anh_sang', 'rembrandt', 'Rembrandt', 'Tam giác sáng nhỏ trên má phía tối — chân dung kịch tính, cổ điển.', 'Rembrandt lighting with a small triangle of light on the shadow-side cheek', ['chinh_kich', 'phim_doc', 'kinh_di']),
  k('anh_sang', 'buom', 'Bướm (butterfly)', 'Đèn chính cao trước mặt, bóng nhỏ dưới mũi — sắc đẹp, sang trọng.', 'butterfly lighting from high in front, small shadow under the nose', ['qc_cao_cap', 'tinh_cam']),
  k('anh_sang', 'chia_doi', 'Chia đôi mặt (split)', 'Nửa mặt sáng nửa tối — hai mặt, bí ẩn, giằng xé.', 'split lighting, half the face lit and half in darkness', ['kinh_di', 'chinh_kich', 'phim_doc']),
  k('anh_sang', 'tia_sang', 'Tia sáng xuyên khói (volumetric)', 'Chùm tia rõ hình trong không khí bụi / khói — linh thiêng, hùng vĩ.', 'volumetric god rays cutting through haze', ['phieu_luu', 'vien_tuong', 'kinh_di', 'qc_cao_cap']),
  k('anh_sang', 'den_thuc', 'Đèn có trong cảnh (practical)', 'Nguồn sáng thấy được trong khung (đèn bàn, màn hình, nến) — tự nhiên, ấm cúng hoặc cô đơn.', 'motivated by visible practical lamps inside the frame', T),
  k('anh_sang', 'anh_man_hinh', 'Ánh màn hình', 'Mặt sáng xanh lạnh từ điện thoại / máy tính trong phòng tối — đêm khuya, bí mật.', 'cold blue screen glow lighting the face in a dark room', ['kinh_di', 'chinh_kich', 'phim_doc', 'qc_ugc']),
  k('anh_sang', 'lua_nen', 'Ánh nến / lửa', 'Ánh cam lay động — ấm, cổ, nguy hiểm.', 'warm flickering candle or firelight', ['tinh_cam', 'kinh_di', 'phieu_luu']),
  k('anh_sang', 'bong_rem', 'Bóng rèm (noir)', 'Sọc bóng rèm cửa chéo qua mặt và tường — phim đen, nghi ngờ.', 'film noir venetian blind shadows striping the face and wall', ['kinh_di', 'chinh_kich']),
  k('anh_sang', 'quet_den_xe', 'Đèn xe quét qua', 'Vệt đèn pha lướt qua phòng / mặt — có người tới, đêm, căng.', 'car headlights sweeping across the room', ['kinh_di', 'hanh_dong', 'chinh_kich']),
  // ── Màu
  k('mau', 'bo_tay', 'Bleach bypass', 'Bạc màu, tương phản gắt, da xám — chiến tranh, khắc nghiệt.', 'bleach bypass look, desaturated with harsh contrast', ['hanh_dong', 'chinh_kich']),
  k('mau', 'sepia', 'Sepia', 'Nâu vàng cũ — hồi ức xa, ảnh cũ.', 'sepia toned', ['chinh_kich', 'tai_lieu']),
  k('mau', 'mau_chon', 'Giữ một màu (color pop)', 'Cả khung xám, chỉ một vật giữ màu — nhấn đúng một thứ (áo đỏ Schindler).', 'selective color: black and white frame with a single object in color', ['chinh_kich', 'qc_cao_cap']),
  k('mau', 'hoai_niem', 'Phim cũ hoài niệm', 'Hạt phim, đen nâng, vàng ấm — ký ức, thập niên trước.', 'vintage film stock look, warm faded tones, visible grain', ['tinh_cam', 'chinh_kich', 'qc_cao_cap']),
  k('mau', 'dem_xanh', 'Đêm xanh (day for night)', 'Xanh lam tối, bóng sắc — đêm trăng.', 'day-for-night blue moonlight grade', ['kinh_di', 'phieu_luu', 'hoat_hinh']),
  // ── Tốc độ dựng
  k('toc_do', 'dong_hinh', 'Đóng băng (freeze frame)', 'Hình đứng hẳn lại một nhịp — chốt khoảnh khắc, giới thiệu nhân vật, kết.', '', ['hai', 'hanh_dong', 'qc_ugc', 'phim_doc']),
  k('toc_do', 'tua_nguoc', 'Tua ngược', 'Hình chạy lùi — tua lại "vì sao chuyện thành thế này", hài, phép.', '', ['hai', 'qc_ugc', 'vien_tuong']),
  k('toc_do', 'tua_nhanh', 'Tua nhanh (time-lapse)', 'Thời gian trôi rất nhanh tại chỗ — cả ngày làm việc, hoa nở, mây chạy.', 'time-lapse, hours compressed into seconds', T),
  k('toc_do', 'phat_lai', 'Phát lại (instant replay)', 'Cùng khoảnh khắc chiếu lại lần nữa (thường chậm) — nhấn cú đỉnh.', '', ['hai', 'hanh_dong', 'qc_ugc']),
  // ── Chuyển cảnh
  k('chuyen_canh', 'cat_hanh_dong', 'Cắt giữa động tác (match on action)', 'Cắt khi động tác đang dở, shot sau tiếp đúng động tác ở góc khác — mắt không thấy vết nối.', 'end mid-gesture so the next angle continues the same motion', T),
  k('chuyen_canh', 'cau_am', 'Cầu âm thanh (sound bridge)', 'Một âm (chuông, nhạc, câu nói) nối liền hai cảnh — khán giả đi theo tai sang cảnh mới.', '', ['chinh_kich', 'tinh_cam', 'phim_doc', 'kinh_di', 'tai_lieu']),
  k('chuyen_canh', 'quet_vat', 'Vật lướt che ống (object wipe)', 'Một vật / người đi ngang sát ống kính che kín khung — cắt giấu trong đó, ra cảnh khác.', 'end with a foreground object passing right across the lens and filling the frame', ['hanh_dong', 'qc_ugc', 'hai', 'phieu_luu']),
  k('chuyen_canh', 'cat_thoi_gian', 'Cắt nhảy thời gian (ellipsis)', 'Bỏ qua quãng giữa: vừa đặt cốc xuống → cốc đã nguội — khán giả tự hiểu thời gian trôi.', '', DRAMA),
  k('chuyen_canh', 'xen_ke', 'Dựng xen kẽ (cross-cut)', 'Cắt qua lại giữa hai mạch đang xảy ra cùng lúc ở hai nơi — hồi hộp tăng mỗi lần cắt.', '', ['hanh_dong', 'kinh_di', 'chinh_kich', 'phim_doc']),
  cc('zoom_vao', 'Zoom chuyển', 'Phóng vào tâm hình rồi ra cảnh mới — năng lượng, TikTok.', 'dong', 'zoomin', 0.35, ['qc_ugc', 'hai', 'hanh_dong']),
  cc('quet_tron', 'Quét tròn (radial)', 'Kim đồng hồ quét quanh tâm — thời gian trôi, đồ hoạ.', 'quet', 'radial', 0.45),
  cc('lat_doc', 'Lát cắt dọc', 'Các dải dọc thay nhau — đồ hoạ, hiện đại.', 'hinh', 'vuslice', 0.4, ['qc_ugc', 'qc_cao_cap']),
  cc('lo_trai', 'Lộ sang trái', 'Cảnh trước trượt đi để lộ cảnh sau nằm sẵn bên dưới.', 'truot', 'revealleft', 0.4),
  // ── Âm thanh
  k('am_thanh', 'dong_ho', 'Tiếng đồng hồ tích tắc', 'Đếm thời gian — chờ đợi, hạn chót, căng.', 'clock ticking', T),
  k('am_thanh', 'buoc_chan', 'Tiếng bước chân', 'Bước gần / xa — có người tới, ai đó bỏ đi.', 'footsteps', T),
  k('am_thanh', 'gio', 'Tiếng gió', 'Trống trải, lạnh, cô đơn.', 'wind howling', T),
  k('am_thanh', 'chuong_dt', 'Chuông / rung điện thoại', 'Một cuộc gọi đổi cục diện.', 'phone ringing or buzzing', T),
  k('am_thanh', 'riser', 'Riser (âm dâng)', 'Âm cao dần tới đỉnh — báo cú lớn sắp tới.', 'rising tension riser', ['hanh_dong', 'kinh_di', 'qc_ugc', 'qc_cao_cap', 'phim_doc']),
  k('am_thanh', 'braam', 'Braam / bass trầm', 'Một tiếng trầm cực mạnh — cú lật, trailer.', 'deep cinematic braam hit', ['hanh_dong', 'kinh_di', 'vien_tuong', 'phim_doc']),
  k('am_thanh', 'u_tai', 'Ù tai (tinnitus)', 'Âm cao rít, tiếng xung quanh tắt — sốc, sau vụ nổ.', 'high-pitched tinnitus ring as surrounding sound drops out', ['hanh_dong', 'chinh_kich', 'kinh_di']),
  k('am_thanh', 'dam_dong', 'Tiếng đám đông xì xào', 'Người xung quanh bàn tán — công khai, xấu hổ.', 'crowd murmuring', T),
  // ── Nhạc
  k('nhac', 'day_cang', 'Dây căng (ostinato)', 'Dàn dây lặp một nốt dồn dập — truy đuổi, căng dần.', 'tense string ostinato', ['hanh_dong', 'kinh_di', 'phim_doc', 'chinh_kich']),
  k('nhac', 'hop_xuong', 'Hợp xướng', 'Giọng hát tập thể — thiêng liêng, sử thi.', 'epic choir', ['phieu_luu', 'vien_tuong', 'hanh_dong']),
  k('nhac', 'jazz', 'Jazz', 'Sang, đêm, tinh nghịch.', 'smooth jazz', ['hai', 'tinh_cam', 'qc_cao_cap']),
  k('nhac', 'guitar_moc', 'Guitar mộc', 'Ấm, đời thường, chân thành.', 'warm acoustic guitar', ['tinh_cam', 'tai_lieu', 'qc_ugc']),
  k('nhac', 'synthwave', 'Synthwave', 'Neon thập niên 80, phóng xe đêm.', 'retro synthwave', ['vien_tuong', 'hanh_dong']),
  k('nhac', 'hiphop', 'Beat hip-hop', 'Nhịp đường phố, tự tin — UGC, thể thao.', 'hip-hop beat', ['qc_ugc', 'hai']),
  k('nhac', 'trailer_epic', 'Trailer sử thi', 'Trống lớn + kèn + braam — đỉnh cao, giới thiệu.', 'epic trailer music with big drums and brass hits', ['hanh_dong', 'phieu_luu', 'vien_tuong']),
  // ── 🪝 MÓC CÂU (chỉ shot mở 1–2 shot đầu — Meta / TikTok: người xem quyết định ở lại trong 1–3 giây)
  k('hook', 'giua_chuyen', 'Vào giữa chuyện (in medias res)', 'Mở thẳng vào lúc căng nhất, không giới thiệu — người xem phải ở lại để hiểu.', '', T),
  k('hook', 'xung_dot_ngay', 'Xung đột ngay giây đầu', 'Giây đầu đã có người làm nhục / đánh / tát / đuổi — phim ngắn dọc mở bằng đè nén.', '', ['phim_doc', 'chinh_kich', 'hanh_dong']),
  k('hook', 'cau_hoi', 'Câu hỏi treo', 'Đặt một câu hỏi người xem muốn biết đáp án ("Sao cô ấy lại quỳ?" / "Bạn có đang mặc sai cỡ?").', '', T),
  k('hook', 'tuong_lai_truoc', 'Chiếu trước kết cục (flash-forward)', 'Mở bằng một khoảnh khắc của đoạn sau ("3 tiếng sau, cô ấy là chủ tịch") rồi quay về đầu.', '', [...DRAMA, 'qc_ugc']),
  k('hook', 'ket_qua_truoc', 'Kết quả trước', 'Cho thấy kết quả / bản "sau" ngay — rồi mới kể đã làm thế nào.', '', [...QC, 'tai_lieu']),
  k('hook', 'pha_ky_vong', 'Phá kỳ vọng (pattern interrupt)', 'Một hình / âm lạ, trái thường lệ cắt ngang dòng lướt — não dừng lại để xử lý.', '', T),
  k('hook', 'noi_dau', 'Chạm nỗi đau', 'Mở bằng đúng vấn đề người xem đang gặp, thấy được bằng mắt (quần bó, áo hằn, gọng cấn).', '', QC),
  k('hook', 'con_so_soc', 'Con số gây sốc', 'Một con số khó tin ("97% phụ nữ mặc sai cỡ áo") — chữ to trên màn.', '', [...QC, 'tai_lieu']),
  k('hook', 'bi_mat', 'Hé bí mật', '"Điều không ai nói với bạn về…" — người xem sợ bỏ lỡ.', '', [...QC, 'tai_lieu', 'phim_doc']),
  k('hook', 'nhin_thang', 'Nhìn thẳng vào máy', 'Nhân vật nhìn thẳng ống kính, nói với người xem — phá bức tường thứ tư.', '', ['qc_ugc', 'hai', 'phim_doc']),
  k('hook', 'am_thanh_mo', 'Âm thanh mở trước', 'Một âm lạ / mạnh mở trước hình (tiếng tát, tiếng vỡ, tiếng thét) — tai kéo mắt.', '', T),
  k('hook', 'dem_nguoc', 'Hạn chót / đếm ngược', 'Đồng hồ, hạn chót, "còn 10 giây" — áp lực thời gian ngay từ đầu.', '', ['hanh_dong', 'kinh_di', 'phim_doc', 'qc_ugc']),
  k('hook', 'hinh_la', 'Hình ảnh lạ mắt', 'Một khung chưa ai thấy (góc lạ, vật kỳ, quy mô bất thường) — tò mò thị giác.', '', T),
  k('hook', 'loi_thoai_dap', 'Câu thoại đập', 'Câu đầu tiên là một câu sốc / đanh thép ("Dọn sạch đi. Rồi cút.").', '', [...DRAMA, 'qc_ugc']),
];

/** Mô tả ngành cho chuyển động máy + nhịp diễn mới (khoá '<nhóm>.<key>') — gộp vào NGANH của dien-anh-nganh.ts. */
const M = 'Mascelli — The Five C\'s of Cinematography; Katz — Film Directing Shot by Shot; Bowen — Grammar of the Shot';
const H = 'Ed Hooks — Acting for Animators; Thomas & Johnston — The Illusion of Life';
const n = (ten_nganh: string, dau_cuoi: string, thuc_hien: string, dong_co: string, cam_xuc: string, tranh: string, nguon = M): NganhKyThuat => ({ ten_nganh, dau_cuoi, thuc_hien, dong_co, cam_xuc, tranh, nguon });

export const THU_VIEN_THEM_MAY: KyThuat[] = [
  k('chuyen_dong', 'chuyen_chu_the', 'Chuyển chủ thể (hand-off)', 'Máy bám theo A rồi rời A, trượt sang dừng trên B đang chờ sẵn — lộ B như tình cờ, không cú cắt (kiểu HBO).', 'the camera follows the first subject, then drifts off it and settles on a second subject waiting nearby, one continuous move', [...DRAMA, 'tai_lieu']),
  k('chuyen_dong', 'vuot_tien_canh', 'Lướt qua vật che (wipe reveal)', 'Máy trượt ngang qua sau một vật tiền cảnh (cột, tường, người) để lộ chủ thể phía sau.', 'lateral camera move past a foreground obstruction that reveals the subject behind it', T),
  k('chuyen_dong', 'cung', 'Đi cung (arc)', 'Máy đi nửa vòng quanh chủ thể (≈ 90°) — đổi hậu cảnh, khoảnh khắc thay đổi trong nhân vật.', 'camera arcs around the subject by about ninety degrees', [...DRAMA, 'qc_cao_cap']),
  k('chuyen_dong', 'nang_ha', 'Nâng / hạ thẳng (pedestal)', 'Máy nâng hoặc hạ thẳng đứng, không nghiêng — đi theo người đứng dậy / ngồi xuống, lộ bàn.', 'pedestal move, the camera rises or lowers vertically without tilting', T),
  k('chuyen_dong', 'drone_len', 'Drone bay lên lộ cảnh', 'Drone từ thấp bay vút lên — cảnh vật lộ dần quy mô, mở hoặc kết phim.', 'drone rising straight up to reveal the full scale of the landscape', ['phieu_luu', 'tai_lieu', 'qc_cao_cap', 'hanh_dong']),
  k('chuyen_dong', 'drone_lui', 'Drone lùi xa', 'Drone lùi và bay cao khỏi nhân vật — cô đơn giữa thế giới, kết.', 'drone pulling back and up away from the subject', ['phieu_luu', 'chinh_kich', 'tai_lieu']),
  k('chuyen_dong', 'xoay_tren_xuong', 'Xoay từ trên xuống', 'Máy nhìn thẳng xuống và xoay chậm quanh trục — chóng mặt, định mệnh, nằm bất động.', 'top-down overhead shot slowly rotating around the vertical axis', ['kinh_di', 'chinh_kich', 'vien_tuong']),
  k('chuyen_dong', 'pov_di', 'Đi bằng mắt nhân vật (walking POV)', 'Máy là mắt nhân vật đang bước — khán giả tự đi vào nơi chốn.', 'walking point-of-view camera moving forward at eye height', ['kinh_di', 'qc_ugc', 'phieu_luu']),
  k('chuyen_dong', 'mot_cu_may', 'Một cú máy dài (oner)', 'Một shot không cắt nối nhiều chủ thể / nơi — khán giả không được nghỉ, thời gian thật.', 'long continuous take moving through the space from subject to subject without a cut', [...DRAMA, 'tai_lieu']),
  k('chuyen_dong', 'lia_qua_lai', 'Lia qua lại hai người', 'Máy đứng giữa lia qua lại giữa hai người đang nói — tranh cãi, tốc độ, hài.', 'camera pans back and forth between two people talking', ['hai', 'hanh_dong', 'phim_doc']),
  // ── Nhịp diễn
  k('dien_xuat', 'dong_cung', 'Đông cứng (freeze)', 'Toàn thân khựng lại, mắt mở, thở ngưng một nhịp — sốc, nhận ra.', 'freezes completely, eyes wide, breath held for a beat', T),
  k('dien_xuat', 'nghien_rang', 'Nghiến răng nén giận', 'Hàm siết, cơ má giật, mắt không rời — giận mà không nổ.', 'jaw clenched, cheek muscle twitching, eyes locked, anger held in', DRAMA),
  k('dien_xuat', 'quay_mat_di', 'Quay mặt đi', 'Không chịu nổi ánh nhìn — xấu hổ, đau, giấu nước mắt.', 'turns the face away, unable to hold the gaze', T),
  k('dien_xuat', 'tho_hat_ra', 'Thở hắt ra', 'Một hơi thở dài ra khỏi ngực, vai hạ — buông xuôi, nhẹ nhõm, chán.', 'lets out a long exhale, shoulders dropping', T),
  k('dien_xuat', 'nhuong_may', 'Nhướng mày', 'Một bên mày nhướng — nghi ngờ, thách thức, hài.', 'raises one eyebrow', T),
  k('dien_xuat', 'giot_le', 'Một giọt nước mắt', 'Mặt gần như bất động, một giọt lệ lăn xuống — đau mà kìm.', 'a single tear rolls down an almost still face', ['chinh_kich', 'tinh_cam', 'phim_doc']),
  k('dien_xuat', 'gat_dau_cham', 'Gật đầu chậm', 'Gật một lần thật chậm — chấp nhận, hiểu ra, quyết định.', 'one slow deliberate nod', T),
  k('dien_xuat', 'nin_cuoi', 'Nín cười / giấu nụ cười', 'Khoé môi muốn cong mà ép lại — đắc thắng ngầm, giấu bí mật.', 'suppresses a smile, the corners of the mouth fighting to stay flat', T),
];

export const NGANH_THEM: Record<string, { nganh: NganhKyThuat; may_di?: MayDi }> = {
  'chuyen_dong.chuyen_chu_the': { may_di: { kieu: 'chuyen', toc: 'vua' }, nganh: n('Hand-off / motivated pan between subjects (relay shot)',
    'Khung mở: A chiếm khung (xe chạy, người đi) → máy theo A → A ra khỏi khung hoặc máy rời A → khung kết dừng trên B (đã đứng sẵn, thường ở rìa khung mở).',
    'Một cú máy liền: lia / trượt theo chuyển động của A làm ĐỘNG CƠ, rồi tiếp tục trôi đúng tốc độ đó sang B và dừng mềm. B phải có mặt trong không gian từ trước (không xuất hiện đột ngột); dừng trên B đủ lâu để khán giả đọc được B đang làm gì.',
    'Lộ một người / một thông tin như tình cờ: kẻ theo dõi đứng chờ, người thứ ba chứng kiến; chuyển điểm nhìn từ nhân vật này sang nhân vật kia mà không cắt; dẫn khán giả theo luồng thông tin (lộ âm mưu).',
    'Khán giả không được báo trước — phát hiện B cùng lúc máy phát hiện; cảm giác "có ai đó luôn ở đó" (hồi hộp, chênh lệch thông tin).',
    'Lia sang B mà không có chuyển động nào của A dẫn đường (máy chuyển vô cớ); B nhảy vào khung đúng lúc máy tới (giả); dừng trên B quá ngắn; tốc độ đổi giữa chừng.') },
  'chuyen_dong.vuot_tien_canh': { may_di: { kieu: 'truot_qua', ti_le: 0.3, toc: 'vua' }, nganh: n('Wipe reveal / foreground pass reveal',
    'Khung mở bị một vật tiền cảnh che phần lớn (cột, tường, lưng người) → máy trượt ngang → khung kết lộ chủ thể rõ ràng phía sau.',
    'Trượt ngang (slider / dolly) song song mặt phẳng vật che; vật che phải gần máy và mờ nét để lướt qua nhanh; chủ thể đã nét sẵn.',
    'Giới thiệu nhân vật / nơi chốn có kịch tính; tiết lộ ai đang ở đó; nối hai cảnh (vật che lấp kín khung có thể giấu cú cắt).',
    'Tò mò rồi thoả mãn — như bước qua góc tường mới thấy.',
    'Vật che mỏng quá không che được gì; trượt quá chậm thành lề mề; chủ thể chưa vào vị trí khi lộ ra.') },
  'chuyen_dong.cung': { may_di: { kieu: 'vong', goc: 90, toc: 'cham' }, nganh: n('Arc shot (half orbit)',
    'Khung mở thấy chủ thể từ một phía (vd chính diện) → máy đi cung ~90° → khung kết ở góc ba phần tư / nghiêng, hậu cảnh đã đổi hẳn.',
    'Đường ray cong hoặc gimbal đi vòng giữ chủ thể ở tâm, khoảng cách không đổi; chậm, đều.',
    'Khoảnh khắc nhân vật thay đổi bên trong (quyết định, giác ngộ); hai người nhìn nhau lần đầu; khoe sản phẩm có chiều sâu.',
    'Thế giới quanh nhân vật xoay — cảm giác khoảnh khắc này quan trọng, mọi thứ đổi.',
    'Đi cung khi không có gì đổi (khoe máy); vượt trục 180° làm đảo hướng nhìn với shot kế.') },
  'chuyen_dong.nang_ha': { may_di: { kieu: 'len', toc: 'cham' }, nganh: n('Pedestal (boom up / boom down)',
    'Máy đi thẳng lên hoặc xuống, trục ống kính giữ ngang: khung mở ngang mặt người ngồi → khung kết ngang mặt người đã đứng (hoặc lộ mặt bàn từ trên).',
    'Cột pedestal / cần cẩu nhỏ / gimbal nâng hạ; không nghiêng máy (khác tilt); tốc độ khớp chuyển động của người.',
    'Đi theo nhân vật đứng dậy / ngồi xuống giữ đúng cỡ; lộ thứ trên bàn; đổi tầm mắt giữa trẻ con và người lớn.',
    'Mượt, khách quan, giữ khán giả ngang tầm nhân vật.',
    'Nghiêng máy theo thói quen (thành tilt); nâng không khớp nhịp đứng dậy.') },
  'chuyen_dong.drone_len': { may_di: { kieu: 'len', ti_le: 0.3, toc: 'cham' }, nganh: n('Drone rise / aerial reveal',
    'Khung mở gần mặt đất (người, xe, mái nhà) → drone bay thẳng lên → khung kết thấy toàn cảnh rộng, chủ thể nhỏ giữa không gian.',
    'Drone lên thẳng hoặc lên chéo, có thể nghiêng máy xuống dần; tốc độ chậm đều, hình ổn định; ánh sáng đẹp (giờ vàng).',
    'Mở phim / chương (thiết lập quy mô); kết phim (nhân vật nhỏ lại giữa thế giới); chiến thắng.',
    'Choáng ngợp, tự do, nhìn bao quát số phận.',
    'Bay lên mà không có gì đáng xem ở toàn cảnh; rung gió; lạm dụng thành "cảnh drone du lịch".') },
  'chuyen_dong.drone_lui': { may_di: { kieu: 'lui', ti_le: 0.3, toc: 'cham' }, nganh: n('Drone pull-back',
    'Khung mở ở trung cảnh nhân vật → drone lùi và lên → khung kết nhân vật chỉ còn một chấm giữa cảnh.',
    'Drone lùi theo đường thẳng, giữ nhân vật ở tâm; kết hợp lên cao; rất chậm.',
    'Cô đơn, kết thúc, nhân vật rời đi; đối lập người nhỏ – thế giới lớn.',
    'Buông khỏi nhân vật — khán giả rời đi cùng máy.',
    'Lùi quá nhanh; mất nhân vật khỏi tâm; không có khoảng lặng nhạc đi kèm.') },
  'chuyen_dong.xoay_tren_xuong': { may_di: { kieu: 'vong', goc: 90, toc: 'cham' }, nganh: n('Rotating top-down / overhead spin',
    'Máy nhìn thẳng xuống chủ thể (nằm, ngồi giữa sàn) → xoay chậm quanh trục đứng → khung kết cùng cỡ nhưng đã xoay.',
    'Đầu xoay trên cần cẩu / drone đứng yên; chủ thể ở chính tâm; xoay đều, có thể kèm nâng nhẹ.',
    'Mất phương hướng, chấn động, bất động sau biến cố; định mệnh nhìn từ trên.',
    'Chóng mặt, khách quan lạnh lùng.',
    'Chủ thể lệch tâm khiến xoay thành trôi; xoay nhanh gây say.') },
  'chuyen_dong.pov_di': { may_di: { kieu: 'tien', ti_le: 1.4, toc: 'vua' }, nganh: n('Walking POV',
    'Khung mở là thứ nhân vật thấy ở đầu đường đi → máy tiến tới ngang tầm mắt, nhún nhẹ theo bước → khung kết là nơi tới / thứ phát hiện.',
    'Máy cầm tay hoặc gimbal ở độ cao mắt, có nhịp bước nhẹ; nhìn theo hướng nhân vật sẽ nhìn; thường cắt lại về mặt nhân vật (luật nhân quả).',
    'Đưa khán giả vào thân nhân vật: bước vào nơi nguy hiểm, tìm kiếm; UGC trải nghiệm.',
    'Nhập vai, hồi hộp vì chỉ thấy được phía trước.',
    'Không cắt về mặt nhân vật để xác lập ai đang nhìn; rung quá mức.') },
  'chuyen_dong.mot_cu_may': { may_di: { kieu: 'tu_do', toc: 'vua' }, nganh: n('Long take / oner / sequence shot',
    'Khung mở một chủ thể → máy di chuyển liên tục qua không gian, bám người này rồi người khác → khung kết ở chủ thể / nơi cuối, không có cú cắt.',
    'Lên kế hoạch đường đi của máy và diễn viên như vũ đạo; mỗi chặng có một "điểm dừng" bố cục đẹp; gimbal / steadicam; với AI: chia nhịp trong một clip dài hoặc liền máy nối clip.',
    'Thời gian thật, không cho khán giả nghỉ (Children of Men, 1917); giới thiệu cả một thế giới; hỗn loạn liên tục.',
    'Ngộp thở, như đang có mặt; tin vào thời gian thật.',
    'Dài mà không có điểm dừng / không có gì mới mỗi chặng; diễn lệch nhịp; với AI quá 8 giây dễ trôi nhân vật.') },
  'chuyen_dong.lia_qua_lai': { may_di: { kieu: 'lia', goc: 60, toc: 'nhanh' }, nganh: n('Back-and-forth pan / swish pan between speakers',
    'Khung mở người A đang nói → lia nhanh sang B (đáp) → có thể lia về A; mỗi điểm dừng là một câu.',
    'Máy đứng giữa hai người, lia nhanh có nhòe nhẹ; dừng đúng lúc người kia bắt đầu nói.',
    'Cãi nhau tốc độ cao, hài (Wes Anderson, Edgar Wright); thay cho shot / ngược shot khi muốn nhịp liền.',
    'Nhịp nhanh, khán giả bị kéo qua lại như xem bóng bàn.',
    'Lia chậm làm lề mề; dùng trong cảnh cần cảm xúc sâu (nên cắt cận).') },
  'dien_xuat.dong_cung': { nganh: n('Freeze / startle hold', 'Mở: đang làm việc bình thường → giữa: nghe / thấy điều sốc, cả thân khựng lại, thở ngưng → kết: mắt mở, giữ nguyên 1–2 nhịp.', 'Dừng mọi chuyển động trong một khung hình, vai hơi nhô, mắt không chớp; không nói.', 'Nhận ra sự thật, cú lật thân phận, tin dữ.', 'Khán giả nín thở theo — khoảnh khắc như dài ra.', 'Diễn quá (há miệng to, tay ôm mặt) thành hài; khựng mà không giữ đủ lâu.', H) },
  'dien_xuat.nghien_rang': { nganh: n('Clenched jaw / suppressed anger', 'Mở: mặt bình thường → giữa: hàm siết, cơ má giật, hơi thở qua mũi → kết: vẫn kìm, mắt không rời đối phương.', 'Siết hàm thật, môi mím, cằm hơi hạ; không cao giọng.', 'Bị sỉ nhục mà phải nhịn; giận lạnh của người quyền lực.', 'Căng — khán giả chờ cơn giận bùng.', 'Nhăn cả mặt; để giận bùng quá sớm.', H) },
  'dien_xuat.quay_mat_di': { nganh: n('Averting the gaze', 'Mở: đang nhìn đối phương → giữa: không chịu nổi, mắt rời trước rồi đầu quay theo → kết: nhìn chỗ khác, cằm hạ.', 'Mắt dẫn đầu rồi đầu theo (không quay cả người); giữ trong khung để khán giả thấy nửa mặt.', 'Xấu hổ, đau, giấu nước mắt, nhượng bộ.', 'Đồng cảm, thấy nhân vật thua một nhịp.', 'Quay cả lưng lại máy (mất mặt diễn).', H) },
  'dien_xuat.tho_hat_ra': { nganh: n('Long exhale / sigh', 'Mở: ngực đầy hơi → giữa: thở ra dài, vai hạ → kết: người lỏng ra.', 'Thở bằng ngực rõ, vai và đầu hạ theo hơi thở; có thể nhắm mắt.', 'Buông xuôi, nhẹ nhõm sau căng thẳng, chán nản.', 'Khán giả thở cùng — giải toả.', 'Thở ra quá kịch như hài.', H) },
  'dien_xuat.nhuong_may': { nganh: n('Single eyebrow raise', 'Mở: mặt trung tính → giữa: một bên mày nhướng → kết: giữ, có thể kèm nghiêng đầu.', 'Chỉ một bên mày, phần mặt còn lại yên; nhịp ngắn.', 'Nghi ngờ, thách thức, mỉa, hài.', 'Đọc ngay thái độ, thường bật cười.', 'Nhướng cả hai mày (thành ngạc nhiên).', H) },
  'dien_xuat.giot_le': { nganh: n('Single tear', 'Mở: mặt gần bất động, mắt rưng → giữa: một giọt tràn mi → kết: giọt lăn xuống, mặt vẫn kìm.', 'Không nhăn mặt, không khóc thành tiếng; máy cận để giọt lệ đọc được.', 'Đau sâu mà kìm, mất mát, xúc động lặng.', 'Đau nhói, mạnh hơn khóc to.', 'Khóc nấc / nhăn mặt làm mất sự kìm nén.', H) },
  'dien_xuat.gat_dau_cham': { nganh: n('Slow nod', 'Mở: nhìn đối phương → giữa: gật một lần rất chậm → kết: giữ ánh nhìn.', 'Một lần gật, đầu xuống chậm lên chậm; mắt không rời.', 'Chấp nhận, hiểu ra, đồng ý một điều nặng nề, quyết định.', 'Trọng lượng — lời hứa không cần nói.', 'Gật nhiều lần nhanh (thành đồng ý vui).', H) },
  'dien_xuat.nin_cuoi': { nganh: n('Suppressed smile', 'Mở: mặt nghiêm → giữa: khoé môi muốn cong, ép lại → kết: một tia cười lọt qua mắt.', 'Nụ cười chỉ ở khoé môi và mắt, cố giữ miệng phẳng; nhịp ngắn.', 'Đắc thắng ngầm, giữ bí mật, thấy đối phương sắp thua.', 'Khán giả biết nhân vật nắm phần thắng — chênh lệch thông tin.', 'Cười hẳn ra (lộ bài).', H) },
};
