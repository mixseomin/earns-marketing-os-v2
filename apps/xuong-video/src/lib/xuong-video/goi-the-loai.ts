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

export type GoiTheLoai = {
  key: string; ten: string; ic: string; nhom: 'Phim truyện' | 'Quảng cáo' | 'Mạng xã hội' | 'Kiến thức';
  mo_ta: string; loai: LoaiPhim; the_loai: TheLoai; /** khung beat định dạng này CẦN (khoá CAU_TRUC) — máy so với khung tách cảnh thật sự dùng */ khung: string; ti_le: TiLe; /** giây mỗi tập / mỗi video [ít nhất, nhiều nhất] */ do_dai_s: [number, number];
  /** cung khán giả mặc định theo thứ tự thời gian của tập */ khan_gia: MaKhanGia[]; /** luật dựng nhấn mạnh cho định dạng này (khoá luat-dung.ts) */ luat: string[];
  tham_chieu: string;
};

export const GOI_THE_LOAI: GoiTheLoai[] = [
  // ── Sẵn sàng: đang sản xuất trong studio ──
  { key: 'phim_doc_tong_tai', ten: 'Phim ngắn dọc · tổng tài', ic: '📱', nhom: 'Phim truyện', loai: 'phim', the_loai: 'phim_doc', khung: 'phim_doc', ti_le: '9:16', do_dai_s: [60, 120],
    mo_ta: 'Đoản kịch nhiều tập: móc 3 giây, đè nén → vả mặt, mỗi 15–30 giây một nút thắt, cuối tập treo.',
    khan_gia: ['uc_che', 'danh_lua', 'to_mo', 'hoi_hop', 'bat_ngo', 'ha_he', 'to_mo'], luat: ['muon_gi_5s', 'gia_tri_doi', 'chenh_thong_tin', 'giu_phan_ung', 'ket_ro'],
    tham_chieu: 'Đoản kịch dọc Trung Quốc (ứng dụng ReelShort, DramaBox); quy ước "ức chế → vả mặt" là quy ước thể loại' },
  { key: 'qc_ugc', ten: 'Quảng cáo sản phẩm · UGC', ic: '🛍', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_ugc', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 45],
    mo_ta: 'Người thật cầm điện thoại nói về sản phẩm: móc câu → nỗi đau → giải pháp → bằng chứng → ưu đãi.',
    khan_gia: ['to_mo', 'buon', 'nhe_nhom', 'vui'], luat: ['muon_gi_5s', 'thay_tung_buoc', 'thoai_vua_giay', 'nhip_doc'],
    tham_chieu: 'Hướng dẫn sáng tạo của TikTok / Meta cho quảng cáo video ngắn (móc câu 1–3 giây đầu, xem không tiếng)' },
  { key: 'series_hoat_hinh', ten: 'Series hoạt hình gia đình', ic: '🧸', nhom: 'Phim truyện', loai: 'phim', the_loai: 'hoat_hinh', khung: 'series_hoat_hinh', ti_le: '16:9', do_dai_s: [60, 180],
    mo_ta: 'Tập ngắn không lời / ít lời, gag bằng hành động, thế giới nhất quán qua các tập.',
    khan_gia: ['to_mo', 'vui', 'hoi_hop', 'bat_ngo', 'nhe_nhom'], luat: ['dan_khong_gian', 'khung_dong', 'khop_hanh_dong', 'motif', 'tu_ke_du'],
    tham_chieu: 'Larva, Shaun the Sheep (kể bằng hành động, không thoại)' },
  // ── Mở rộng: đủ loại phim — máy báo phần còn thiếu ──
  { key: 'qc_cao_cap', ten: 'Quảng cáo cao cấp', ic: '💎', nhom: 'Quảng cáo', loai: 'quang_cao', the_loai: 'qc_cao_cap', khung: 'quang_cao', ti_le: '9:16', do_dai_s: [15, 30],
    mo_ta: 'Sản phẩm hoàn hảo, đèn studio, macro, chuyển động mượt — không người nói.', khan_gia: ['to_mo', 'ha_he'], luat: ['nhip_doc', 'anh_sang_cam_xuc', 'may_co_dong_co'],
    tham_chieu: 'Phim quảng cáo thương hiệu cao cấp (đèn studio, macro sản phẩm)' },
  { key: 'kinh_di_ngan', ten: 'Kinh dị ngắn', ic: '🕯', nhom: 'Phim truyện', loai: 'short', the_loai: 'kinh_di', khung: 'short', ti_le: '9:16', do_dai_s: [30, 90],
    mo_ta: 'Im lặng → mối nguy hé dần → cú doạ → móc cuối.', khan_gia: ['to_mo', 'hoi_hop', 'so_hai', 'bat_ngo', 'to_mo'], luat: ['chenh_thong_tin', 'khoang_lang', 'anh_sang_cam_xuc'],
    tham_chieu: 'Phim kinh dị ngắn kiểu Lights Out (2013, David F. Sandberg)' },
  { key: 'chinh_kich', ten: 'Phim ngắn chính kịch', ic: '🎭', nhom: 'Phim truyện', loai: 'phim', the_loai: 'chinh_kich', khung: 'phim', ti_le: '16:9', do_dai_s: [180, 900],
    mo_ta: 'Nhân vật đổi giá trị qua từng cảnh, khoảng lặng, chênh lệch thông tin thay lời giải thích.', khan_gia: ['buon', 'phan_van', 'hoi_hop', 'bat_ngo', 'nhe_nhom'],
    luat: ['gia_tri_doi', 'khoang_lang', 'chenh_thong_tin', 'giu_phan_ung'], tham_chieu: 'Phim truyền hình chính kịch HBO (máy chậm, dẫn dắt bằng hình)' },
  { key: 'hai_ngan', ten: 'Hài ngắn (skit)', ic: '😂', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'hai', khung: 'short', ti_le: '9:16', do_dai_s: [15, 60],
    mo_ta: 'Một tình huống, gài kỳ vọng rồi bẻ, cắt đúng nhịp câu đùa.', khan_gia: ['to_mo', 'vui', 'bat_ngo', 'vui'], luat: ['tu_ke_du', 'nhip_doc', 'giu_phan_ung'],
    tham_chieu: 'Skit hài ngắn mạng xã hội; thuyết lệch kỳ vọng (Carroll — Humour)' },
  { key: 'tinh_cam_ngan', ten: 'Tình cảm ngắn', ic: '💞', nhom: 'Phim truyện', loai: 'short', the_loai: 'tinh_cam', khung: 'short', ti_le: '9:16', do_dai_s: [30, 120],
    mo_ta: 'Hai người, một khoảnh khắc đổi quan hệ; cận mặt, ánh ấm.', khan_gia: ['to_mo', 'phan_van', 'buon', 'nhe_nhom'], luat: ['giu_phan_ung', 'anh_sang_cam_xuc', 'khoang_lang'],
    tham_chieu: 'Phim ngắn tình cảm; nhịp phản ứng (Murch — cảm xúc là tiêu chí số một)' },
  { key: 'trailer', ten: 'Trailer', ic: '🎬', nhom: 'Mạng xã hội', loai: 'short', the_loai: 'phieu_luu', khung: 'trailer', ti_le: '16:9', do_dai_s: [30, 120],
    mo_ta: 'Thế giới → biến cố → leo thang dồn cắt → khoảng lặng → cú cuối + tựa.', khan_gia: ['to_mo', 'hoi_hop', 'bat_ngo', 'to_mo'], luat: ['nhip_doc', 'khoang_lang', 'ket_ro'],
    tham_chieu: 'Cấu trúc trailer phim điện ảnh (ba hồi rút gọn, nhạc dồn, button cuối)' },
  { key: 'tai_lieu_ngan', ten: 'Tài liệu ngắn', ic: '🎥', nhom: 'Kiến thức', loai: 'short', the_loai: 'tai_lieu', khung: 'tai_lieu', ti_le: '16:9', do_dai_s: [60, 300],
    mo_ta: 'Câu hỏi mở đầu, nhân chứng / hình hiện trường, trả lời dần.', khan_gia: ['to_mo', 'buon', 'nhe_nhom'], luat: ['dan_khong_gian', 'thay_tung_buoc', 'ket_ro'],
    tham_chieu: 'Phim tài liệu quan sát; Bill Nichols — Introduction to Documentary' },
];
export const goiTheoKey = (k: string | undefined | null) => GOI_THE_LOAI.find((g) => g.key === k);

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
