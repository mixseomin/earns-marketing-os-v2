// Ba mẫu dựng sẵn — mỗi định dạng một phim mẫu (anh yêu cầu 08/10/2026): kinh thánh + anchor + kịch bản tập 1 đã điền,
// bấm "Tạo từ mẫu" là có ngay thứ để tách cảnh → keyframe → video. File thường (không 'use server'), chỉ dữ liệu.
import type { KinhThanh, LoaiNhanVat, LoaiPhim } from './kieu';

export type MauPhim = {
  /** khoá riêng của mẫu (một loại có thể có nhiều mẫu) */
  key: string; nhan: string;
  loai: LoaiPhim; ten: string; mo_ta: string; kinh_thanh: KinhThanh;
  nhan_vat: { loai: LoaiNhanVat; ten: string; mo_ta: string; giong?: string }[];
  tap: { ten: string; kich_ban: string }[];
};

export const MAU_PHIM: MauPhim[] = [
  {
    key: 'short-tho-rua', nhan: 'short · Thỏ và Rùa',
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
    key: 'phim-khu-rung', nhan: 'phim ngắn · Khu rừng Thì Thầm',
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
    key: 'qc-bra-ugc', nhan: 'QC · bra không gọng (UGC tiếng Việt)',
    loai: 'quang_cao',
    ten: 'Mẫu creative QC · áo bra không gọng (24s)',
    mo_ta: 'Creative Meta/TikTok 9:16 cho sản phẩm áo bra không gọng: hook vấn đề → sản phẩm → bằng chứng → CTA. Thay sản phẩm bằng ảnh thật của shop ở anchor.',
    kinh_thanh: { phong_cach: 'Quay thật kiểu UGC, ánh sáng tự nhiên trong nhà, màu trung tính ấm, máy cầm tay nhẹ, điện thoại 9:16, chân thực không bóng bẩy', ti_le: '9:16', do_phan_giai: '720p', ngon_ngu: 'vi', the_loai: 'qc_ugc',
      qc: { ten: 'Áo bra không gọng', link: '', diem_noi_bat: 'Không gọng, vải mềm co giãn, dây vai bản rộng 2cm, khoá móc sau 3 nấc, đường may phẳng — mặc cả ngày không hằn vai', doi_tuong: 'Phụ nữ Việt 30-50 tuổi đi làm, mặc bra gọng cả ngày bị hằn vai', uu_dai: 'Giảm 50% cho 100 đơn đầu · Mua 2 tặng 1 · Đổi size miễn phí', thi_truong: 'Việt Nam · tiếng Việt', anh: [] } },
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
  {
    // Mẫu theo đúng dự án bra shop đang chạy (anh yêu cầu #1196, 08/10/2026): thị trường Mỹ, phụ nữ 50+, bra nâng nhẹ không gọng.
    // Khung chữ lấy từ hai góc đối thủ LunaFits đang thắng (adfond/luu/doi-thu/lunafits.md, chụp 25/09/2026): "The lift of a push-up.
    // The comfort of a bralette." (~1.800 QC từ 02/04) + "most bras are designed for a 25-year-old body" (09/2026) — giữ khung, đổi sản phẩm/link theo shop.
    key: 'qc-bra-50', nhan: 'QC · bra nâng nhẹ 50+ (Mỹ, góc LunaFits)',
    loai: 'quang_cao',
    ten: 'Mẫu QC · Gentle lifting bra for seniors (45s, Meta US)',
    mo_ta: 'Creative Meta 9:16, 45 giây, tiếng Anh cho phụ nữ Mỹ 50+: hook "bra thiết kế cho cơ thể tuổi 25" → người sáng lập kể → demo nâng + thoải mái → bằng chứng → ưu đãi 50%+ → Shop now. Khung chữ theo hai góc đang thắng của LunaFits; thay ảnh sản phẩm thật của shop ở anchor.',
    kinh_thanh: { phong_cach: 'Authentic UGC testimonial look, soft natural window light, warm neutral tones, handheld iPhone 9:16 framing, real skin texture, no glamour retouching, cozy American suburban home', ti_le: '9:16', do_phan_giai: '720p', ngon_ngu: 'en', the_loai: 'qc_ugc',
      qc: { ten: 'Gentle Lift Bra', link: '', diem_noi_bat: 'The lift of a push-up, the comfort of a bralette: no wires, no pads, seamless soft knit, wide comfort straps, front hook closure, gentle side lift', doi_tuong: 'American women 50+ tired of underwire bras that dig in and do not fit a changing body', uu_dai: '50%+ OFF Sitewide · Shop now', thi_truong: 'United States · English', anh: [] } },
    nhan_vat: [
      { loai: 'san_pham', ten: 'Gentle Lift Bra', mo_ta: 'Wireless lifting bra, soft nude beige, seamless knit, wide 2 cm comfort straps, front hook-and-eye closure, no underwire, no padding, gentle lift from the sides. Keep EXACT color, shape and details from the reference photo.' },
      { loai: 'nhan_vat', ten: 'Linda', mo_ta: 'American woman, 58, shoulder-length silver-blonde hair, warm smile, natural laugh lines, real mature body, wears a loose cream cardigan over a white tee and light jeans; friendly founder who talks to camera like a friend.', giong: 'warm, calm American female voice, mid-50s, conversational' },
      { loai: 'nhan_vat', ten: 'Carol', mo_ta: 'American woman, 64, short grey hair, glasses on a chain, petite, cheerful, wears a soft lilac sweater; happy customer giving a quick testimonial.', giong: 'bright, friendly older American female voice' },
      { loai: 'boi_canh', ten: 'Bright bedroom', mo_ta: 'Sunny suburban bedroom, white linen bed, light wood dresser with a round mirror, sheer curtains, a small plant; daylight from a big window.' },
    ],
    tap: [{ ten: 'Bras are designed for a 25-year-old body', kich_ban: `Scene 1 (hook, 3s): Linda sits on the edge of the bed, looks straight into camera: "Nobody tells you that most bras are designed for a 25-year-old body."
Scene 2: Close-up of Linda pulling an old underwire bra out of a drawer, sighing, tossing it aside: "After 50, everything changes. And your bra should too."
Scene 3: Linda by the mirror holding the Gentle Lift Bra: "After 20 years working in this industry, I made a bra that actually fits the way we live."
Scene 4: Product close-up: hands stretch the soft seamless band, show the wide straps and the front hook. Text on screen: No wires. No pads.
Scene 5: Linda in a loose tee over the bra turns side to side in daylight, smiling: "The lift of a push-up. The comfort of a bralette. Yes, really."
Scene 6: Carol in her living room, laughing: "I wear it all day and forget I have it on."
Scene 7: Linda back to camera, warm: "Thousands have made the switch. Maybe it's your turn." Text on screen: GENTLE LIFTING BRA FOR SENIORS · 50%+ OFF Sitewide 💕 · Shop now` }],
  },
];
