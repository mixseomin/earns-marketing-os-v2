// KHUNG TUYẾN TRUYỆN THEO DẠNG PHIM (thư viện điện ảnh — anh 31/10/2026: "đã có thư viện điện ảnh thì các phần vừa tổng hợp theo dạng phim lưu lại
// để dùng về sau; phim ngắn dọc 4–5 tuyến show ra kiểu hợp ngành, nhiều hơn thì báo"). Mỗi khung: các VAI tuyến ngành hay dùng (A/B/C…), tập
// thường mở, số tuyến cả bộ + số tuyến mỗi tập. Phim gắn tuyến với vai (TuyenTruyen.vai) → bảng tuyến hiện làn ngành còn thiếu, vượt trần thì báo.
// Gói thể loại (goi-the-loai.ts) trỏ vào đây theo thể loại; trang gói trong thư viện hiện khung. Thuần — tự kiểm: khung-tuyen.test.mts.
import type { KinhThanh, Series } from './kieu';
type TheLoaiKey = string;

export type VaiTuyen = { vai: string; ma: string; ten: string; mo_ta: string; /** tập thường mở tuyến này [sớm nhất, muộn nhất]; trống = từ tập 1 */ mo_tu?: [number, number] };
export type KhungTuyen = { key: string; ten: string; /** số tuyến cả bộ [ít nhất, nhiều nhất] */ ca_bo: [number, number]; /** số tuyến một tập nên đẩy */ moi_tap: [number, number];
  tuyen: VaiTuyen[]; ghi: string; nguon: string };

export const KHUNG_TUYEN: KhungTuyen[] = [
  { key: 'phim_doc', ten: 'Phim ngắn dọc (đoản kịch nhiều tập)', ca_bo: [4, 5], moi_tap: [1, 2],
    tuyen: [
      { vai: 'quan_he', ma: 'A', ten: 'Quan hệ chính · đảo vị thế', mo_ta: 'cặp chính, cán cân quyền lực lật qua lại — tuyến có mặt gần như mọi tập' },
      { vai: 'than_phan', ma: 'B', ten: 'Thân phận bí mật · lật mặt', mo_ta: 'điều nhân vật chính giấu (thừa kế, chủ quỹ, con thật…) — hé dần, mỗi lần hé là một cú vả mặt' },
      { vai: 'phan_dien', ma: 'C', ten: 'Phản diện dồn ép', mo_ta: 'kẻ làm nhục / gài bẫy nhân vật chính TRÊN MÀN — người sẽ bị vả mặt' },
      { vai: 'qua_khu', ma: 'D', ten: 'Bí mật gia đình · quá khứ', mo_ta: 'ân oán đời trước, di vật, thân thế — giữ người xem lâu dài, thường mở tập 10–20', mo_tu: [10, 20] },
      { vai: 'phu', ma: 'E', ten: 'Đồng minh · cặp phụ · tuyến thở', mo_ta: 'bạn thân, trợ lý, cặp phụ hoặc tuyến hài để đổi nhịp — thường sau tập 20', mo_tu: [20, 30] },
    ],
    ghi: 'Tập 1–2 phút chỉ gánh nổi tuyến A + một tuyến khác; cả bộ 60–100 tập cần 4–5 tuyến mở dần, không mở hết từ đầu. Trên 5 tuyến thì tập ngắn không đủ chỗ — gộp hoặc cắt.',
    nguon: 'Quy ước đoản kịch dọc Trung Quốc (ReelShort, DramaBox): đè nén → vả mặt, thân phận ẩn, phản diện trên màn' },
  { key: 'chinh_kich', ten: 'Phim lẻ chính kịch', ca_bo: [2, 3], moi_tap: [2, 3],
    tuyen: [
      { vai: 'muc_tieu', ma: 'A', ten: 'Mục tiêu bên ngoài', mo_ta: 'nhân vật muốn đạt được gì, cái gì cản' },
      { vai: 'noi_tam', ma: 'B', ten: 'Quan hệ · nội tâm', mo_ta: 'tuyến mang chủ đề — thường là một mối quan hệ thay đổi nhân vật' },
      { vai: 'phu', ma: 'C', ten: 'Tuyến phụ', mo_ta: 'tuyến ngắn soi chiếu chủ đề từ góc khác' },
    ], ghi: 'Phim lẻ 90–120 phút: A + B là xương sống, C tuỳ chọn.', nguon: 'Cấu trúc A-story / B-story (Save the Cat — B-story mang chủ đề)' },
  { key: 'hai', ten: 'Hài tình huống (sitcom / skit)', ca_bo: [3, 3], moi_tap: [2, 3],
    tuyen: [
      { vai: 'tinh_huong', ma: 'A', ten: 'Tình huống chính của tập', mo_ta: 'rắc rối lớn của tập' },
      { vai: 'phu', ma: 'B', ten: 'Tuyến phụ', mo_ta: 'rắc rối nhỏ của nhân vật khác, thường gặp A ở cuối' },
      { vai: 'runner', ma: 'C', ten: 'Runner (gag chạy nền)', mo_ta: 'một trò đùa lặp 2–3 lần trong tập' },
    ], ghi: 'Sitcom 22 phút: A/B/C, C là runner.', nguon: 'Quy ước phòng biên kịch sitcom Mỹ (A/B/C story, runner)' },
  { key: 'hoat_hinh', ten: 'Series hoạt hình tập ngắn', ca_bo: [2, 3], moi_tap: [1, 1],
    tuyen: [
      { vai: 'gag', ma: 'A', ten: 'Tình huống / gag chính', mo_ta: 'mỗi tập một xung đột hành động khép kín' },
      { vai: 'nguon_goc', ma: 'B', ten: 'Nguồn gốc nhân vật', mo_ta: 'tập nguồn gốc xen kẽ — vết sẹo, bí mật, món yêu ghét' },
      { vai: 'the_gioi', ma: 'C', ten: 'Mạch thế giới', mo_ta: 'điều lớn dần qua các tập, trả ở tập cuối mùa' },
    ], ghi: 'Tập 1–3 phút không lời: mỗi tập một tuyến, mạch dài chỉ để nối mùa.', nguon: 'Larva, Shaun the Sheep — tập khép kín, mạch mùa mỏng' },
];
/** Thể loại → khung (thể loại chưa có khung riêng dùng khung gần nhất; không có thì null). */
const THEO_THE_LOAI: Record<string, string> = { phim_doc: 'phim_doc', chinh_kich: 'chinh_kich', tinh_cam: 'chinh_kich', hai: 'hai', hoat_hinh: 'hoat_hinh' };
export const khungTheoKey = (k: string | null | undefined) => KHUNG_TUYEN.find((x) => x.key === k) ?? null;
export const khungTheoTheLoai = (tl: TheLoaiKey | string | null | undefined) => khungTheoKey(THEO_THE_LOAI[tl ?? ''] ?? null);
export const khungCuaPhim = (kt: Pick<KinhThanh, 'the_loai'> | null | undefined) => khungTheoTheLoai(kt?.the_loai);

export type DoiKhung = { khung: KhungTuyen; co: number; thieu: VaiTuyen[]; vuot: string | null };
/** So tuyến của phim với khung ngành: vai nào chưa có làn (theo TuyenTruyen.vai), số tuyến vượt trần thì câu báo. */
export function doiKhung(s: Series | null | undefined, k: KhungTuyen | null): DoiKhung | null {
  if (!k) return null;
  const ds = s?.tuyen ?? [];
  const thieu = k.tuyen.filter((v) => !ds.some((t) => t.vai === v.vai));
  const vuot = ds.length > k.ca_bo[1] ? `${ds.length} tuyến — vượt khung ngành ${k.ca_bo[0]}–${k.ca_bo[1]} của ${k.ten.toLowerCase()}: tập ngắn không đủ chỗ, nên gộp hoặc cắt bớt` : null;
  return { khung: k, co: ds.length, thieu, vuot };
}
/** Khối dặn AI (viết tiếp tập, sắp tuyến) theo khung ngành của phim. */
export function vanKhung(k: KhungTuyen | null): string {
  if (!k) return '';
  return `KHUNG TUYẾN NGÀNH (${k.ten}): cả bộ ${k.ca_bo[0]}–${k.ca_bo[1]} tuyến, mỗi tập đẩy ${k.moi_tap[0]}–${k.moi_tap[1]} tuyến. ${k.ghi}\n${k.tuyen.map((v) => `- ${v.ma} [vai ${v.vai}] ${v.ten}: ${v.mo_ta}${v.mo_tu ? ` (thường mở tập ${v.mo_tu[0]}–${v.mo_tu[1]})` : ''}`).join('\n')}`;
}
