// Ba mẫu dựng sẵn — mỗi định dạng một phim mẫu (anh yêu cầu 08/10/2026): kinh thánh + anchor + kịch bản tập 1 đã điền,
// bấm "Tạo từ mẫu" là có ngay thứ để tách cảnh → keyframe → video. File thường (không 'use server'), chỉ dữ liệu.
import type { KinhThanh, LoaiNhanVat, LoaiPhim } from './kieu';

export type MauPhim = {
  loai: LoaiPhim; ten: string; mo_ta: string; kinh_thanh: KinhThanh;
  nhan_vat: { loai: LoaiNhanVat; ten: string; mo_ta: string; giong?: string }[];
  tap: { ten: string; kich_ban: string }[];
};

export const MAU_PHIM: MauPhim[] = [
  {
    loai: 'short',
    ten: 'Mẫu short · Thỏ và Rùa (40s)',
    mo_ta: 'Short 9:16 kể lại ngụ ngôn thỏ và rùa theo nhịp TikTok: hook 3 giây, 5 cảnh, kết có twist nhẹ.',
    kinh_thanh: { phong_cach: '3D hoạt hình kiểu Pixar, màu ấm, ánh sáng mềm buổi sáng, khu rừng cổ tích, lens 35mm, độ sâu trường ảnh nông', ti_le: '9:16', do_phan_giai: '720p', ngon_ngu: 'vi' },
    nhan_vat: [
      { loai: 'nhan_vat', ten: 'Timo', mo_ta: 'Rùa con 8 tuổi, mai xanh rêu có vân lục giác, mắt to màu nâu, đeo khăn quàng đỏ, dáng mập tròn, đi chậm nhưng chắc, tính điềm tĩnh.', giong: 'giọng trẻ con ấm, chậm rãi' },
      { loai: 'nhan_vat', ten: 'Lio', mo_ta: 'Thỏ xám tai dài, mặc gi-lê xanh dương có túi, chân sau dài, mắt lanh lợi, hay cười trêu, nhanh nhảu và hơi tự mãn.', giong: 'giọng cao, nhanh, tinh nghịch' },
      { loai: 'boi_canh', ten: 'Khu rừng Thì Thầm', mo_ta: 'Khu rừng cổ tích buổi sáng: cây sồi cổ thụ, thảm cỏ xanh, sương mỏng, tia nắng xiên qua tán lá, con đường đất dẫn ra mặt hồ lấp lánh phía xa.' },
    ],
    tap: [{ ten: 'Thỏ và Rùa', kich_ban: `Cảnh 1 (hook): Cận mặt Lio nhìn thẳng vào máy, cười: "Rùa mà đòi đua với thỏ? Xem nhé." Lio phóng vụt đi, bụi tung.
Cảnh 2: Toàn cảnh vạch xuất phát trong Khu rừng Thì Thầm, Timo chậm rãi bước qua, ngước nhìn tia nắng, mỉm cười.
Cảnh 3: Lio nằm gối đầu dưới gốc sồi, ngáp dài: "Còn xa lắm, ngủ tí đã." Mắt lim dim.
Cảnh 4: Máy trượt theo Timo đi qua cầu gỗ, qua đồng hoa, từng bước đều, mặt hồ lấp lánh dần hiện ra.
Cảnh 5: Lio bật dậy chạy tới đích thì Timo đã đứng đó. Timo quay lại, nháy mắt với máy: "Chậm mà đều, vẫn tới trước." Chữ kết: Theo dõi để xem tập sau.` }],
  },
  {
    loai: 'phim',
    ten: 'Mẫu phim ngắn · Khu rừng Thì Thầm (nhiều tập)',
    mo_ta: 'Series phim ngắn 16:9, mỗi tập 60-90 giây, cùng tuyến nhân vật: Timo (rùa) và Lio (thỏ) đi tìm Hạt Giống Ánh Sáng để cứu khu rừng đang úa.',
    kinh_thanh: { phong_cach: '3D hoạt hình điện ảnh kiểu Pixar, bảng màu ấm xanh rêu + cam hoàng hôn, ánh sáng khối, lens 50mm, khung hình điện ảnh', ti_le: '16:9', do_phan_giai: '720p', ngon_ngu: 'vi' },
    nhan_vat: [
      { loai: 'nhan_vat', ten: 'Timo', mo_ta: 'Rùa con 8 tuổi, mai xanh rêu có vân lục giác, mắt to màu nâu, đeo khăn quàng đỏ, mang túi vải nhỏ bên hông, đi chậm nhưng chắc, tính điềm tĩnh và kiên nhẫn.', giong: 'giọng trẻ con ấm, chậm rãi' },
      { loai: 'nhan_vat', ten: 'Lio', mo_ta: 'Thỏ xám tai dài, mặc gi-lê xanh dương có túi, chân sau dài, mắt lanh lợi, nhanh nhảu, hay nói trước nghĩ sau nhưng tốt bụng.', giong: 'giọng cao, nhanh, tinh nghịch' },
      { loai: 'nhan_vat', ten: 'Cụ Trưởng Lão', mo_ta: 'Cú mèo già lông nâu xám, mắt vàng to, đeo kính tròn, chống gậy gỗ cong, dáng gù, nói chậm và hiền.', giong: 'giọng trầm, khàn, hiền' },
      { loai: 'boi_canh', ten: 'Khu rừng Thì Thầm', mo_ta: 'Khu rừng cổ tích: cây sồi cổ thụ trung tâm (Cây Ước Nguyện) có hốc lớn, thảm cỏ, sương mỏng; phía xa là Đỉnh Núi Pha Lê trắng xanh.' },
      { loai: 'dao_cu', ten: 'Hạt Giống Ánh Sáng', mo_ta: 'Hạt giống to bằng quả trứng, vỏ trong suốt phát sáng vàng nhạt, bên trong có tia sáng xoáy nhẹ.' },
    ],
    tap: [{ ten: 'Hạt Giống Ánh Sáng', kich_ban: `Cảnh 1: Toàn cảnh buổi sáng ở Khu rừng Thì Thầm, muông thú tụ quanh gốc Cây Ước Nguyện, lá cây đang úa vàng.
Cảnh 2: Cụ Trưởng Lão dùng gậy gỗ chỉ về phía Đỉnh Núi Pha Lê, trao túi vải cho Timo: "Chỉ Hạt Giống Ánh Sáng mới cứu được rừng. Đường xa, hãy đi cùng nhau."
Cảnh 3: Lio vỗ ngực cười: "Cháu chạy nhanh nhất rừng, cháu đi một mình cũng được!" Timo cẩn thận cất tấm bản đồ vào túi.
Cảnh 4: Lio phóng vụt qua cánh đồng hoa, Timo đi sau, từng bước đều, nhìn bản đồ.
Cảnh 5: Lio phanh gấp trước đầm lầy bùn đen đầy gai, sương mù dày, Lio loay hoay rồi trượt chân, lún dần.
Cảnh 6: Timo tới nơi, bình tĩnh ném khăn quàng đỏ ra kéo Lio lên. Lio thở dốc, lần đầu nhìn Timo bằng ánh mắt khác.
Cảnh 7: Hai bạn ngồi bên bờ đầm, phía xa Đỉnh Núi Pha Lê lấp lánh dưới hoàng hôn. Lio: "Mai... mình đi cùng nhau nhé?" Timo gật đầu. Chữ kết: Tập 2 — Hang Dơi Tối.` }],
  },
  {
    loai: 'quang_cao',
    ten: 'Mẫu creative QC · áo bra không gọng (24s)',
    mo_ta: 'Creative Meta/TikTok 9:16 cho sản phẩm áo bra không gọng: hook vấn đề → sản phẩm → bằng chứng → CTA. Thay sản phẩm bằng ảnh thật của shop ở anchor.',
    kinh_thanh: { phong_cach: 'Quay thật kiểu UGC, ánh sáng tự nhiên trong nhà, màu trung tính ấm, máy cầm tay nhẹ, điện thoại 9:16, chân thực không bóng bẩy', ti_le: '9:16', do_phan_giai: '720p', ngon_ngu: 'vi' },
    nhan_vat: [
      { loai: 'san_pham', ten: 'Áo bra không gọng', mo_ta: 'Áo bra không gọng màu be nude, chất vải mềm co giãn, dây vai bản rộng 2cm, khoá móc sau 3 nấc, đường may phẳng, không ren. Phải giữ ĐÚNG màu, kiểu dáng và chi tiết như ảnh mẫu.' },
      { loai: 'nhan_vat', ten: 'Chị Lan', mo_ta: 'Phụ nữ châu Á 38 tuổi, tóc đen dài buộc thấp, dáng người thật, da ngăm nhẹ, mặc áo thun trắng rộng và quần jean, biểu cảm tự nhiên, thân thiện.', giong: 'giọng nữ miền Nam, gần gũi, như kể chuyện với bạn' },
      { loai: 'boi_canh', ten: 'Phòng ngủ sáng', mo_ta: 'Phòng ngủ có cửa sổ lớn ánh sáng ban ngày, giường ga trắng, tường kem, cây xanh nhỏ ở góc.' },
    ],
    tap: [{ ten: 'Hook: hằn vai cả ngày', kich_ban: `Cảnh 1 (hook): Chị Lan ngồi mép giường, nhăn mặt xoa vai, nhìn máy: "Đeo bra gọng 10 tiếng mỗi ngày, tối về vai hằn đỏ hết."
Cảnh 2: Cận sản phẩm Áo bra không gọng trên tay Chị Lan, kéo giãn dây vai bản rộng, lật mặt trong cho thấy đường may phẳng.
Cảnh 3: Chị Lan mặc áo thun ngoài, xoay người trước cửa sổ, vỗ vai: "Mềm, không gọng, mặc cả ngày quên luôn là đang mặc."
Cảnh 4: Cận khoá móc 3 nấc và chất vải co giãn, tay kéo nhẹ rồi thả.
Cảnh 5: Chị Lan cầm điện thoại cười: "Đang giảm 50% cho 100 đơn đầu, bấm xem size ở dưới nhé." Chữ: Mua 2 tặng 1 · Đổi size miễn phí.` }],
  },
];
