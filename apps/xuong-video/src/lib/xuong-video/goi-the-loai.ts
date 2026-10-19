// GÓI THỂ LOẠI (anh 18/10/2026, học từ Digen "Open Skills" — mỗi định dạng một gói đóng sẵn; "studio của mình sau này sẽ sản xuất đủ loại phim").
// Một gói = một ĐỊNH DẠNG sản xuất: loại sản phẩm + thể loại (→ khung beat CAU_TRUC, quy chuẩn dòng QUY_CHUAN_DONG, kỹ thuật hợp thể loại) + khung hình +
// độ dài tập + cung khán giả mặc định (khan-gia.ts) + luật dựng nhấn (luat-dung.ts) + tác phẩm tham chiếu. Gói KHÔNG khai lại các sổ đó — chỉ trỏ vào,
// máy (kiemGoi) đọc từ sổ thật và báo gói còn thiếu gì (vd chưa có khung beat riêng → dùng khung chung). Chọn gói trong Kinh thánh phim → đặt thể loại /
// khung hình; Claude tách cảnh đọc gói (vanGoi). Thuần, client lẫn server dùng được. Tự kiểm: goi-the-loai.test.mts.
import { CAU_TRUC, THE_LOAI, khoaKhung, type TheLoai } from './dien-anh';
import { QUY_CHUAN_DONG, khuonTheoKey } from './khuon-chuoi';
import { hieuUngKG, type MaKhanGia } from './khan-gia';
import { luatDung } from './luat-dung';
import type { LoaiPhim, TiLe } from './kieu';

/** Bố cục màn xem trên timeline (timeline.tsx › công tắc ◧ ▣ ◨). */
export type BoCucXem = 'trai' | 'giua' | 'phai';
export type GoiTheLoai = {
  key: string; ten: string; ic: string; nhom: 'Phim truyện' | 'Quảng cáo' | 'Mạng xã hội' | 'Kiến thức' | 'Doanh nghiệp';
  mo_ta: string; loai: LoaiPhim; the_loai: TheLoai; /** khung beat định dạng này CẦN (khoá CAU_TRUC) — máy so với khung tách cảnh thật sự dùng */ khung: string; ti_le: TiLe; /** giây mỗi tập / mỗi video [ít nhất, nhiều nhất] */ do_dai_s: [number, number];
  /** cung khán giả mặc định theo thứ tự thời gian của tập */ khan_gia: MaKhanGia[]; /** luật dựng nhấn mạnh cho định dạng này (khoá luat-dung.ts) */ luat: string[];
  tham_chieu: string;
  /** nhóm tương ứng trên chợ skill Digen (DIGEN_NHOM) — để biết đã phủ đủ loại video ngành đang làm */ digen?: string[];
  /** bố cục màn xem mặc định trên timeline (trái / giữa / phải); trống = theo khung hình (boCucGoi) */ bo_cuc?: BoCucXem;
};

export const GOI_THE_LOAI: GoiTheLoai[] = [
  // ── Sẵn sàng: đang sản xuất trong studio ──
  { key: 'phim_doc_tong_tai', ten: 'Phim ngắn dọc · tổng tài', ic: '📱', nhom: 'Phim truyện', loai: 'phim', the_loai: 'phim_doc', khung: 'phim_doc', ti_le: '9:16', do_dai_s: [60, 120],
    mo_ta: 'Đoản kịch nhiều tập: móc 3 giây, đè nén → vả mặt, mỗi 15–30 giây một nút thắt, cuối tập treo.',
    khan_gia: ['uc_che', 'danh_lua', 'to_mo', 'hoi_hop', 'bat_ngo', 'ha_he', 'to_mo'], luat: ['muon_gi_5s', 'gia_tri_doi', 'chenh_thong_tin', 'giu_phan_ung', 'ket_ro', 'noi_tap'],
    tham_chieu: 'Đoản kịch dọc Trung Quốc (ứng dụng ReelShort, DramaBox); quy ước "ức chế → vả mặt" là quy ước thể loại' , digen: ['Short Drama', 'Series'] },
  { key: 'qc_ugc', ten: 'Quảng cáo sản phẩm · UGC', ic: '🛍', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 45],
    mo_ta: 'Người thật cầm điện thoại nói về sản phẩm: móc câu → nỗi đau → giải pháp → bằng chứng → ưu đãi.',
    khan_gia: ['to_mo', 'buon', 'nhe_nhom', 'vui'], luat: ['muon_gi_5s', 'thay_tung_buoc', 'thoai_vua_giay', 'nhip_doc'],
    tham_chieu: 'Hướng dẫn sáng tạo của TikTok / Meta cho quảng cáo video ngắn (móc câu 1–3 giây đầu, xem không tiếng)' , digen: ['Social Ad'] },
  { key: 'series_hoat_hinh', ten: 'Series hoạt hình gia đình', ic: '🧸', nhom: 'Phim truyện', loai: 'phim', the_loai: 'hoat_hinh', khung: 'series_hoat_hinh', ti_le: '16:9', do_dai_s: [60, 180],
    mo_ta: 'Tập ngắn không lời / ít lời, gag bằng hành động, thế giới nhất quán qua các tập.',
    khan_gia: ['to_mo', 'vui', 'hoi_hop', 'bat_ngo', 'nhe_nhom'], luat: ['dan_khong_gian', 'khung_dong', 'khop_hanh_dong', 'motif', 'tu_ke_du'],
    tham_chieu: 'Larva, Shaun the Sheep (kể bằng hành động, không thoại)' , digen: ['Series', 'Kids'] },
  // ── Mở rộng: đủ loại phim — máy báo phần còn thiếu ──
  { key: 'qc_cao_cap', ten: 'Quảng cáo cao cấp', ic: '💎', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 30],
    mo_ta: 'Sản phẩm hoàn hảo, đèn studio, macro, chuyển động mượt — không người nói.', khan_gia: ['to_mo', 'ha_he'], luat: ['nhip_doc', 'anh_sang_cam_xuc', 'may_co_dong_co'],
    tham_chieu: 'Phim quảng cáo thương hiệu cao cấp (đèn studio, macro sản phẩm)' , digen: ['Brand', 'Product'] },
  { key: 'kinh_di_ngan', ten: 'Kinh dị ngắn', ic: '🕯', nhom: 'Phim truyện', loai: 'short', the_loai: 'kinh_di', khung: 'short', ti_le: '9:16', do_dai_s: [30, 90],
    mo_ta: 'Im lặng → mối nguy hé dần → cú doạ → móc cuối.', khan_gia: ['to_mo', 'hoi_hop', 'so_hai', 'bat_ngo', 'to_mo'], luat: ['chenh_thong_tin', 'khoang_lang', 'anh_sang_cam_xuc'],
    tham_chieu: 'Phim kinh dị ngắn kiểu Lights Out (2013, David F. Sandberg)' , digen: ['Film'] },
  { key: 'chinh_kich', ten: 'Phim ngắn chính kịch', ic: '🎭', nhom: 'Phim truyện', loai: 'phim', the_loai: 'chinh_kich', khung: 'phim', ti_le: '16:9', do_dai_s: [180, 900],
    mo_ta: 'Nhân vật đổi giá trị qua từng cảnh, khoảng lặng, chênh lệch thông tin thay lời giải thích.', khan_gia: ['buon', 'phan_van', 'hoi_hop', 'bat_ngo', 'nhe_nhom'],
    luat: ['gia_tri_doi', 'khoang_lang', 'chenh_thong_tin', 'giu_phan_ung'], tham_chieu: 'Phim truyền hình chính kịch HBO (máy chậm, dẫn dắt bằng hình)' , digen: ['Film'] },
  { key: 'hai_ngan', ten: 'Hài ngắn (skit)', ic: '😂', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'hai', khung: 'short', ti_le: '9:16', do_dai_s: [15, 60],
    mo_ta: 'Một tình huống, gài kỳ vọng rồi bẻ, cắt đúng nhịp câu đùa.', khan_gia: ['to_mo', 'vui', 'bat_ngo', 'vui'], luat: ['tu_ke_du', 'nhip_doc', 'giu_phan_ung'],
    tham_chieu: 'Skit hài ngắn mạng xã hội; thuyết lệch kỳ vọng (Carroll — Humour)' , digen: ['Meme'] },
  { key: 'tinh_cam_ngan', ten: 'Tình cảm ngắn', ic: '💞', nhom: 'Phim truyện', loai: 'short', the_loai: 'tinh_cam', khung: 'short', ti_le: '9:16', do_dai_s: [30, 120],
    mo_ta: 'Hai người, một khoảnh khắc đổi quan hệ; cận mặt, ánh ấm.', khan_gia: ['to_mo', 'phan_van', 'buon', 'nhe_nhom'], luat: ['giu_phan_ung', 'anh_sang_cam_xuc', 'khoang_lang'],
    tham_chieu: 'Phim ngắn tình cảm; nhịp phản ứng (Murch — cảm xúc là tiêu chí số một)' , digen: ['Short Drama'] },
  { key: 'trailer', ten: 'Trailer', ic: '🎬', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'phieu_luu', khung: 'trailer', ti_le: '16:9', do_dai_s: [30, 120],
    mo_ta: 'Thế giới → biến cố → leo thang dồn cắt → khoảng lặng → cú cuối + tựa.', khan_gia: ['to_mo', 'hoi_hop', 'bat_ngo', 'to_mo'], luat: ['nhip_doc', 'khoang_lang', 'ket_ro'],
    tham_chieu: 'Cấu trúc trailer phim điện ảnh (ba hồi rút gọn, nhạc dồn, button cuối)' , digen: ['Trailer'] },
  { key: 'tai_lieu_ngan', ten: 'Tài liệu ngắn', ic: '🎥', nhom: 'Kiến thức', loai: 'short', the_loai: 'tai_lieu', khung: 'tai_lieu', ti_le: '16:9', do_dai_s: [60, 300],
    mo_ta: 'Câu hỏi mở đầu, nhân chứng / hình hiện trường, trả lời dần.', khan_gia: ['to_mo', 'buon', 'nhe_nhom'], luat: ['dan_khong_gian', 'thay_tung_buoc', 'ket_ro'],
    tham_chieu: 'Phim tài liệu quan sát; Bill Nichols — Introduction to Documentary' , digen: ['Doc'] },
  // ── Phủ đủ loại video ngành đang làm (học từ chợ skill Digen 18/10/2026 — DIGEN_NHOM) ──
  { key: 'anime_ngan', ten: 'Anime ngắn', ic: '🗡', nhom: 'Phim truyện', loai: 'short', the_loai: 'hanh_dong', khung: 'short', ti_le: '16:9', do_dai_s: [60, 180],
    mo_ta: 'Hành động / phiêu lưu kiểu anime: khung tĩnh nhấn, đường tốc độ, cú tuyệt chiêu.', khan_gia: ['to_mo', 'hoi_hop', 'ha_he', 'bat_ngo'], luat: ['khung_dong', 'khop_hanh_dong', 'may_co_dong_co'],
    tham_chieu: 'Anime truyền hình Nhật (khung giữ + hiệu ứng tốc độ ở cú quyết định)', digen: ['Anime'] },
  { key: 'manhua_dong', ten: 'Truyện tranh động (manhua / motion comic)', ic: '📖', nhom: 'Phim truyện', loai: 'phim', the_loai: 'phim_doc', khung: 'phim_doc', ti_le: '9:16', do_dai_s: [60, 120],
    mo_ta: 'Khung tranh dọc + chuyển động nhẹ + lồng tiếng; nhịp đoản kịch.', khan_gia: ['uc_che', 'to_mo', 'bat_ngo', 'ha_he'], luat: ['muon_gi_5s', 'chenh_thong_tin', 'thoai_vua_giay'],
    tham_chieu: 'Motion comic / manhua dọc trên các nền tảng truyện tranh', digen: ['Manhua'] },
  { key: 'mv_nhac', ten: 'MV ca nhạc', ic: '🎵', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'tinh_cam', khung: 'mv', ti_le: '16:9', do_dai_s: [90, 240],
    mo_ta: 'Hình đi theo cấu trúc bài hát, cắt theo phách, điệp khúc là hình mạnh nhất.', khan_gia: ['vui', 'buon', 'nhe_nhom'], luat: ['khop_hanh_dong', 'anh_sang_cam_xuc', 'motif'],
    tham_chieu: 'Cấu trúc bài hát intro–verse–chorus–bridge–outro; MV K-pop (vũ đạo nhóm, đổi bối cảnh theo đoạn)', digen: ['Music'] },
  { key: 'youtuber', ten: 'Video YouTuber (nói vào máy)', ic: '🎙', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'qc_ugc', khung: 'video_youtube', ti_le: '16:9', do_dai_s: [180, 720],
    mo_ta: 'Người dẫn nói thẳng vào máy: móc đầu, hứa giá trị, nội dung chia phần, kêu gọi cuối.', khan_gia: ['to_mo', 'vui', 'bat_ngo', 'nhe_nhom'], luat: ['muon_gi_5s', 'thay_tung_buoc', 'nhip_doc', 'ket_ro'],
    tham_chieu: 'Hướng dẫn của YouTube cho nhà sáng tạo (giữ chân người xem trong những giây đầu, chương mục)', digen: ['YouTuber'] },
  { key: 'vtuber', ten: 'Người dẫn ảo (VTuber / avatar)', ic: '🤖', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'qc_ugc', khung: 'video_youtube', ti_le: '9:16', do_dai_s: [30, 180],
    mo_ta: 'Nhân vật ảo 2D / 3D nói với người xem; giữ đúng một khuôn mặt suốt kênh.', khan_gia: ['to_mo', 'vui'], luat: ['muon_gi_5s', 'thoai_vua_giay', 'giu_mat'],
    tham_chieu: 'VTuber (avatar dựng hình nói trực tiếp, nhận diện bằng nhân vật)', digen: ['VTuber'] },
  { key: 'nhap_vai', ten: 'Nhân vật nhập vai (roleplay)', ic: '🧝', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'tinh_cam', khung: 'short', ti_le: '9:16', do_dai_s: [15, 60],
    mo_ta: 'Nhân vật nói với người xem ở góc nhìn thứ hai (POV), như đang trò chuyện.', khan_gia: ['to_mo', 'vui', 'phan_van'], luat: ['giu_mat', 'thoai_vua_giay', 'giu_phan_ung'],
    tham_chieu: 'Video POV nhập vai trên TikTok / Reels', digen: ['Roleplay'] },
  { key: 'meme', ten: 'Meme / clip trend', ic: '😜', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'hai', khung: 'short', ti_le: '9:16', do_dai_s: [5, 20],
    mo_ta: 'Khuôn quen người xem đã biết + một cú bẻ; rất ngắn.', khan_gia: ['to_mo', 'vui', 'bat_ngo'], luat: ['tu_ke_du', 'nhip_doc'],
    tham_chieu: 'Định dạng meme / trend lặp lại trên mạng xã hội; thuyết lệch kỳ vọng (Carroll — Humour)', digen: ['Meme'] },
  { key: 'ke_chuyen', ten: 'Kể chuyện có người dẫn (storytime)', ic: '📜', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'chinh_kich', khung: 'short', ti_le: '9:16', do_dai_s: [30, 120],
    mo_ta: 'Một câu chuyện có lời dẫn, hình minh hoạ theo lời; móc ngay câu đầu.', khan_gia: ['to_mo', 'hoi_hop', 'bat_ngo'], luat: ['tu_ke_du', 'gia_tri_doi', 'ket_ro'],
    tham_chieu: 'Storytime trên TikTok / YouTube; McKee — Story (giá trị đổi)', digen: ['Story'] },
  { key: 'thieu_nhi', ten: 'Kể chuyện thiếu nhi', ic: '🧒', nhom: 'Phim truyện', loai: 'short', the_loai: 'hoat_hinh', khung: 'short', ti_le: '16:9', do_dai_s: [60, 300],
    mo_ta: 'Một bài học rõ, nhân vật dễ thương, màu tươi, không doạ.', khan_gia: ['to_mo', 'vui', 'nhe_nhom'], luat: ['tu_ke_du', 'ket_ro', 'khung_dong'],
    tham_chieu: 'Truyện kể thiếu nhi hoạt hình (một thông điệp, lặp lại để nhớ)', digen: ['Kids'] },
  { key: 'thuong_hieu', ten: 'Phim thương hiệu (brand film)', ic: '✨', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'short', ti_le: '16:9', do_dai_s: [60, 180],
    mo_ta: 'Kể chuyện cảm xúc trước, thương hiệu xuất hiện sau như lời kết.', khan_gia: ['buon', 'to_mo', 'nhe_nhom'], luat: ['gia_tri_doi', 'motif', 'anh_sang_cam_xuc'],
    tham_chieu: 'Brand film kể chuyện của các thương hiệu lớn (cảm xúc trước, sản phẩm sau)', digen: ['Brand'] },
  { key: 'qc_khuyen_mai', ten: 'Promo / khuyến mãi', ic: '🏷', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [6, 15],
    mo_ta: 'Một ưu đãi, một hình, một lời kêu gọi — 6 đến 15 giây.', khan_gia: ['to_mo', 'vui'], luat: ['muon_gi_5s', 'nhip_doc'],
    tham_chieu: 'Quảng cáo bumper 6 giây (YouTube) / promo ngắn', digen: ['Promo'] },
  { key: 'qc_bien_the', ten: 'Quảng cáo nhiều biến thể (programmatic)', ic: '🧮', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 30],
    mo_ta: 'Một thân quảng cáo, nhiều đầu (hook) / nhiều sản phẩm để thử hàng loạt.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['muon_gi_5s', 'thay_tung_buoc'],
    tham_chieu: 'Dynamic creative / thử nhiều hook trên Meta, TikTok', digen: ['Programmatic', 'Social Ad'] },
  { key: 'demo_san_pham', ten: 'Demo sản phẩm / phần mềm', ic: '🔧', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'quang_cao', ti_le: '16:9', do_dai_s: [30, 90],
    mo_ta: 'Cho thấy sản phẩm / tính năng làm việc thật, từng bước một.', khan_gia: ['to_mo', 'nhe_nhom', 'ha_he'], luat: ['thay_tung_buoc', 'khop_hanh_dong', 'ket_ro'],
    tham_chieu: 'Video demo sản phẩm, demo phần mềm (quay màn hình + chú thích)', digen: ['Product', 'Demo'] },
  { key: 'thu_do', ten: 'Thử đồ (try-on)', ic: '👗', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 45],
    mo_ta: 'Mặc thử trước gương, xoay người, trước / sau, cận chất liệu.', khan_gia: ['to_mo', 'vui', 'nhe_nhom'], luat: ['thay_tung_buoc', 'nhip_doc'],
    tham_chieu: 'Try-on haul trên TikTok / Reels', digen: ['Try-On'] },
  { key: 'ban_hang', ten: 'Video bán hàng (shopping)', ic: '🛒', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 60],
    mo_ta: 'Video gắn giỏ hàng: vấn đề → sản phẩm → dùng thử → giá / ưu đãi.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['muon_gi_5s', 'thay_tung_buoc'],
    tham_chieu: 'TikTok Shop / Reels Shopping', digen: ['Shopping'] },
  { key: 'lam_dep', ten: 'Làm đẹp (beauty)', ic: '💄', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 60],
    mo_ta: 'Trang điểm / dưỡng da: trước–sau, cận da, ánh sáng đều.', khan_gia: ['to_mo', 'nhe_nhom', 'vui'], luat: ['thay_tung_buoc', 'anh_sang_cam_xuc'],
    tham_chieu: 'Video makeup / skincare trên TikTok, YouTube', digen: ['Beauty'] },
  { key: 'o_to', ten: 'Ô tô', ic: '🚗', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'quang_cao', ti_le: '16:9', do_dai_s: [15, 60],
    mo_ta: 'Xe lăn bánh, cận chi tiết, đường máy bám xe.', khan_gia: ['to_mo', 'ha_he'], luat: ['may_co_dong_co', 'anh_sang_cam_xuc'],
    tham_chieu: 'Quảng cáo xe hơi (car-to-car tracking, cận chi tiết)', digen: ['Auto'] },
  { key: 'bat_dong_san', ten: 'Bất động sản', ic: '🏠', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'quang_cao', ti_le: '16:9', do_dai_s: [30, 90],
    mo_ta: 'Từ trên cao vào, đi qua từng phòng theo đường người đi.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['dan_khong_gian', 'may_co_dong_co'],
    tham_chieu: 'Tour nhà / dự án (flycam vào → đi qua từng không gian)', digen: ['Property'] },
  { key: 'kien_truc_3d', ten: 'Diễn hoạ kiến trúc (ArchViz)', ic: '🏛', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'quang_cao', ti_le: '16:9', do_dai_s: [30, 120],
    mo_ta: 'Công trình dựng 3D: đường máy chậm, ngày sang đêm, người làm tỉ lệ.', khan_gia: ['to_mo', 'ha_he'], luat: ['dan_khong_gian', 'anh_sang_cam_xuc', 'may_co_dong_co'],
    tham_chieu: 'Diễn hoạ kiến trúc 3D (walkthrough, đổi ánh sáng ngày–đêm)', digen: ['ArchViz'] },
  { key: 'du_lich', ten: 'Du lịch', ic: '✈️', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'phieu_luu', khung: 'short', ti_le: '9:16', do_dai_s: [15, 60],
    mo_ta: 'Đi tới → khám phá → khoảnh khắc đẹp nhất → muốn đi.', khan_gia: ['to_mo', 'vui', 'nhe_nhom'], luat: ['dan_khong_gian', 'khung_dong'],
    tham_chieu: 'Travel reel trên Instagram / TikTok', digen: ['Travel'] },
  { key: 'game_trailer', ten: 'Trailer game', ic: '🎮', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'vien_tuong', khung: 'trailer', ti_le: '16:9', do_dai_s: [60, 120],
    mo_ta: 'Thế giới game → xung đột → dồn cắt gameplay → logo + ngày ra mắt; HUD (máu, đạn, bản đồ) giữ cùng kiểu và vị trí mọi khung, phe ta / phe địch phân biệt rõ.', khan_gia: ['to_mo', 'hoi_hop', 'ha_he'], luat: ['nhip_doc', 'khoang_lang', 'ket_ro'],
    tham_chieu: 'Trailer game (cinematic xen gameplay, kết logo + ngày phát hành)', digen: ['Game'] },
  { key: 'the_thao', ten: 'Thể thao', ic: '⚽', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'hanh_dong', khung: 'short', ti_le: '16:9', do_dai_s: [15, 60],
    mo_ta: 'Dồn tới khoảnh khắc quyết định, quay chậm phát lại.', khan_gia: ['hoi_hop', 'ha_he'], luat: ['khop_hanh_dong', 'nhip_doc'],
    tham_chieu: 'Highlight thể thao truyền hình (quay chậm phát lại khoảnh khắc ghi điểm)', digen: ['Sports'] },
  { key: 'tin_tuc', ten: 'Tin tức ngắn', ic: '📰', nhom: 'Kiến thức', loai: 'short', the_loai: 'tai_lieu', khung: 'tin_tuc', ti_le: '9:16', do_dai_s: [30, 90],
    mo_ta: 'Điều quan trọng nhất nói trước, chi tiết sau, nguồn rõ.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['thay_tung_buoc', 'ket_ro', 'thoai_vua_giay'],
    tham_chieu: 'Kim tự tháp ngược của báo chí', digen: ['News'] },
  { key: 'giai_thich', ten: 'Video giải thích (explainer)', ic: '💡', nhom: 'Kiến thức', loai: 'short', the_loai: 'tai_lieu', khung: 'giai_thich', ti_le: '16:9', do_dai_s: [60, 180],
    mo_ta: 'Vấn đề → cách nó hoạt động → ví dụ → tóm tắt; hình minh hoạ đúng lời.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['thay_tung_buoc', 'tu_ke_du', 'ket_ro'],
    tham_chieu: 'Richard Mayer — Multimedia Learning (nguyên tắc hình + lời)', digen: ['Explainer'] },
  { key: 'suc_khoe', ten: 'Sức khoẻ', ic: '🩺', nhom: 'Kiến thức', loai: 'short', the_loai: 'tai_lieu', khung: 'giai_thich', ti_le: '9:16', do_dai_s: [30, 120],
    mo_ta: 'Giải thích một vấn đề sức khoẻ — chỉ thông tin có nguồn y khoa.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['thay_tung_buoc', 'ket_ro'],
    tham_chieu: 'Video giáo dục sức khoẻ; Mayer — Multimedia Learning', digen: ['Health'] },
  { key: 'tai_chinh', ten: 'Tài chính', ic: '💹', nhom: 'Kiến thức', loai: 'short', the_loai: 'tai_lieu', khung: 'giai_thich', ti_le: '9:16', do_dai_s: [30, 120],
    mo_ta: 'Giải thích một khái niệm / con số tài chính — số liệu có nguồn.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['thay_tung_buoc', 'ket_ro'],
    tham_chieu: 'Video giải thích tài chính; Mayer — Multimedia Learning', digen: ['Finance'] },
  { key: 'khoa_hoc', ten: 'Bài học / khoá học', ic: '🎓', nhom: 'Kiến thức', loai: 'phim', the_loai: 'tai_lieu', khung: 'bai_hoc', ti_le: '16:9', do_dai_s: [180, 900],
    mo_ta: 'Mục tiêu → gợi lại điều đã biết → giảng → ví dụ → thực hành → tóm tắt.', khan_gia: ['to_mo', 'nhe_nhom', 'vui'], luat: ['thay_tung_buoc', 'nhip_doc', 'ket_ro'],
    tham_chieu: 'Robert Gagné — Nine Events of Instruction; Mayer — Multimedia Learning', digen: ['Course'] },
  { key: 'dao_tao_noi_bo', ten: 'Đào tạo / truyền thông nội bộ', ic: '🏢', nhom: 'Doanh nghiệp', loai: 'short', the_loai: 'tai_lieu', khung: 'bai_hoc', ti_le: '16:9', do_dai_s: [60, 300],
    mo_ta: 'Hướng dẫn quy trình / thông báo cho nhân viên, rõ việc cần làm.', khan_gia: ['to_mo', 'nhe_nhom'], luat: ['thay_tung_buoc', 'ket_ro'],
    tham_chieu: 'Video đào tạo doanh nghiệp; Gagné — Nine Events of Instruction', digen: ['Training', 'Internal'] },
  { key: 'tuyen_dung', ten: 'Tuyển dụng', ic: '🤝', nhom: 'Doanh nghiệp', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [30, 60],
    mo_ta: 'Một ngày làm việc thật, nhân viên thật nói, lời mời ứng tuyển cuối.', khan_gia: ['to_mo', 'vui', 'nhe_nhom'], luat: ['muon_gi_5s', 'thay_tung_buoc'],
    tham_chieu: 'Video tuyển dụng / thương hiệu nhà tuyển dụng', digen: ['Recruit'] },
];
/** Nhóm loại video trên chợ skill Digen (agent.digen.ai, xem ngày 18/10/2026) — danh sách loại video ngành đang làm bằng AI. Test bắt mọi nhóm làm VIDEO
 *  phải có ít nhất một gói; nhóm không phải video / không định dạng (Poster = ảnh tĩnh — studio có ảnh QC; Custom, Other) không tính. */
export const DIGEN_NHOM = ['Short Drama', 'Anime', 'Music', 'Roleplay', 'Manhua', 'VTuber', 'Meme', 'Film', 'Series', 'Doc', 'Trailer', 'Brand', 'Social Ad', 'Promo', 'Programmatic',
  'Product', 'Try-On', 'Shopping', 'Poster', 'Explainer', 'Course', 'Training', 'Kids', 'Demo', 'Story', 'Recruit', 'Internal', 'Property', 'Travel', 'Auto', 'ArchViz', 'Beauty',
  'Game', 'News', 'Health', 'Finance', 'Sports', 'YouTuber', 'Custom', 'Other'] as const;
export const DIGEN_KHONG_TINH: readonly string[] = ['Poster', 'Custom', 'Other'];
export const goiTheoKey = (k: string | undefined | null) => GOI_THE_LOAI.find((g) => g.key === k);
/** BỐ CỤC MẶC ĐỊNH của gói (anh 19/10/2026: "gắn layout này thành default của mỗi gói"): khai riêng thắng; không khai thì phim dọc 9:16 → màn xem bên phải
 *  (cao, thấy timeline cùng lúc — kiểu CapCut), phim ngang → giữa hàng panel. Timeline dùng khi công tắc đang ở "tự động". */
export const boCucGoi = (g: Pick<GoiTheLoai, 'bo_cuc' | 'ti_le'>): BoCucXem => g.bo_cuc ?? (g.ti_le === '9:16' ? 'phai' : 'giua');

export type KetGoi = { goi: GoiTheLoai; khung: string; khungDung: string; khuon: string[]; quyChuan: string[]; thieu: string[]; sanSang: boolean };
/** Đọc các sổ THẬT để biết gói có gì + còn thiếu gì: khung beat gói cần có trong CAU_TRUC không, tách cảnh có thật sự dùng khung đó không
 *  (khoaKhung theo loại + thể loại), có quy chuẩn dòng phim không, hiệu ứng / luật trỏ tới có thật không. Sẵn sàng = không thiếu gì. */
export function kiemGoi(g: GoiTheLoai): KetGoi {
  const dung = khoaKhung(g.loai, g.the_loai, g.khung); const qc = QUY_CHUAN_DONG[g.the_loai];
  const thieu: string[] = [];
  if (!THE_LOAI.some((t) => t.key === g.the_loai)) thieu.push(`thể loại "${g.the_loai}" chưa có trong danh sách thể loại`);
  if (!CAU_TRUC[g.khung]) thieu.push(`chưa có khung beat "${g.khung}" — tách cảnh đang dùng khung chung "${CAU_TRUC[dung]?.ten ?? dung}"`);
  else if (dung !== g.khung) thieu.push(`tách cảnh đang dùng khung "${CAU_TRUC[dung]?.ten ?? dung}", không phải khung "${CAU_TRUC[g.khung]!.ten}" của gói`);
  if (!qc) thieu.push('chưa có quy chuẩn dòng phim (khuôn chuỗi hay dùng + luật của dòng)');
  for (const y of g.khan_gia) if (!hieuUngKG(y)) thieu.push(`hiệu ứng khán giả "${y}" không có`);
  for (const l of g.luat) if (!luatDung(l)) thieu.push(`luật dựng "${l}" không có`);
  return { goi: g, khung: CAU_TRUC[g.khung]?.ten ?? g.khung, khungDung: CAU_TRUC[dung]?.ten ?? dung, khuon: (qc?.khuon ?? []).filter((x) => khuonTheoKey(x)), quyChuan: qc?.luat ?? [], thieu, sanSang: !thieu.length };
}

/** Khối dặn Claude khi tách cảnh (claude.ts › heThong) theo gói đang chọn trong Kinh thánh. Rỗng = phim chưa chọn gói. */
export function vanGoi(key: string | undefined | null): string {
  const g = goiTheoKey(key); if (!g) return '';
  return `GÓI THỂ LOẠI: ${g.ten} — ${g.mo_ta} Độ dài mỗi tập ${g.do_dai_s[0]}–${g.do_dai_s[1]} giây, khung ${g.ti_le}. Tham chiếu: ${g.tham_chieu}.
Cung khán giả mặc định (ghi vào khan_gia của shot, đổi khi kịch bản cần): ${g.khan_gia.map((y) => hieuUngKG(y)?.ten ?? y).join(' → ')}.
Luật dựng nhấn cho định dạng này: ${g.luat.map((l) => luatDung(l)?.ten ?? l).join(' · ')}.`;
}
