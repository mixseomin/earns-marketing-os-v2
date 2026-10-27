// KẾ HOẠCH DẠNG × GÓC × SẢN PHẨM (anh 26/10/2026: "tao sẽ làm tất cả các ngách, mọi sản phẩm, mọi dịch vụ… kết hợp với góc trong spy mới ra được
// nội dung"; "page này phải nâng cấp để mô tả hết những gì plan theo từng bước, sau đó mới triển khai"). Đây là SỔ kế hoạch: mô tả, việc con,
// trạng thái từng bước — tab Social › Góc › Kế hoạch đọc sổ này + số thật (kho dạng, máy, góc spy). Làm xong bước nào đổi trạng thái ở đây
// trong cùng commit. Trạng thái: cho (chờ) · dang (đang làm) · xong · duyet (chờ anh duyệt).
export type TtBuoc = 'cho' | 'dang' | 'xong' | 'duyet';
export interface ViecCon { ten: string; tt: TtBuoc; ghi?: string }
export interface Buoc { so: number; ma: string; ten: string; tt: TtBuoc; muc_dich: string; cach: string[]; viec: ViecCon[]; hien: 'kho' | 'ghep' | 'mau' | 'duong' | 'san-pham' | 'giong' | 'do' }

export const NGUYEN_LY = 'Một bài = một SẢN PHẨM (máy studio có nhóm góc spy) × một GÓC (spy) × một DẠNG (kho dạng bài). Ba thứ là dữ liệu; máy không phụ thuộc ngách. Thêm sản phẩm mới = thêm một dòng máy, không thêm mã.';

export const KE_HOACH: Buoc[] = [
  { so: 1, ma: 'kho', ten: 'Kho dạng bài vào mos2', tt: 'xong', hien: 'kho',
    muc_dich: 'Mọi dạng bài thu thập được nằm một chỗ, mỗi tài sản social bật / tắt dạng như đang bật / tắt góc.',
    cach: ['Kho 36 dạng ở scripts/ke-hoach-goc/dang-bai.json (có nguồn) — mos2 đọc thẳng tệp này.', 'Bảng dang_tat (máy, dạng) như goc_tat: dạng tắt không vào kế hoạch các tuần chưa sinh. Ngách của máy là cột xv_may.ngach (migration 0344), sửa ngay trên trang khi chọn sản phẩm.', 'Bảng ghép loại góc spy → dạng là trường goc_loai của từng dạng (bước này hiện ở mục Ghép).'],
    viec: [{ ten: 'Thu thập dạng bài từ web, lưu repo', tt: 'xong', ghi: 'commit 9cee64bf' }, { ten: 'Trang Kế hoạch mô tả đủ 7 bước + số thật', tt: 'xong', ghi: 'chung → chọn sản phẩm mới lọc' }, { ten: 'Bật / tắt dạng + ngách theo tài sản (dang_tat, xv_may.ngach)', tt: 'xong', ghi: 'migration 0344' }] },
  { so: 2, ma: 'ghep', ten: 'Kế hoạch tuần chọn dạng từ kho', tt: 'xong', hien: 'ghep',
    muc_dich: 'Mỗi ô tuần = góc + dạng hợp loại góc đó, thay bảng xoay cứng 7 ô / họ nền.',
    cach: ['ke-hoach-goc.ts › sinhTuan: dạng = kho lọc theo loại góc của ô + họ nền + đường đăng đã có; ưu tiên dạng ít dùng nhất 14 ngày qua.', 'Luật: mỗi kênh ≥ 4 dạng khác nhau / tuần; không hai ngày liền cùng dạng; góc có bài site thì nhường ô cho Bài link (noiBaiSite giữ nguyên).', 'Bảng nội dung + tab Góc hiện tên dạng trên từng ô; ô dạng chưa có mẫu / chưa có đường đăng đánh dấu cần dựng.'],
    viec: [{ ten: 'Chọn dạng theo loại góc (thay XOAY)', tt: 'xong', ghi: 'chon-dang.ts, commit e4448835' }, { ten: 'Luật đa dạng ≥ 4 dạng / kênh / tuần', tt: 'xong' }, { ten: 'Tự kiểm: tuần sinh ra không có 2 ngày liền cùng dạng', tt: 'xong', ghi: 'tuần 09/11 sinh thử: 8 kênh × 7 dạng khác nhau' }] },
  { so: 3, ma: 'mau', ten: 'Mẫu dựng chung cho dạng 0đ', tt: 'xong', hien: 'mau',
    muc_dich: 'Mỗi dạng 0đ một mẫu studio dùng cho MỌI ngách: đề = góc + dữ liệu sản phẩm, nền = ảnh / video thật Pexels, tiếng sinh ffmpeg.',
    cach: ['Đường ảnh (anh chốt 27/10/2026): ảnh thật Pexels → AI sửa theo góc (ckey Nano Banana, 110₫, giữ cảnh, thêm vật của sản phẩm) → video: clip phủ thật 0đ (mưa / tuyết / bụi / sương) hoặc Grok ảnh→video rồi lặp chồng mờ 0,8s thành 30–60s; Meta có thể gắn nhãn AI — chấp nhận.', 'Thứ tự: cảnh động → bộ bài ảnh (thẻ chữ, ai còn nhớ, đoán năm/giá, hai lựa chọn) → top 3/5 → lầm tưởng / đúng-sai → so sánh → cái nào giả + chuỗi hội thoại → câu nói theo tình huống → đố thị giác (tìm vật, lạc loài, câu đố mẹo).', 'Mỗi mẫu: may-dung-<ma>.ts + test, qua Phòng Nội dung chấm, chụp khung gửi anh; mỗi mẫu một nhịp.', 'Tên dạng là khái niệm chung cho mọi dự án; tên sản phẩm chỉ ở cột Mẫu / ví dụ (anh 26/10/2026). Bỏ "Comment YES or NO" ở màn kết Only ONE ngay nhịp đầu (Facebook coi là mồi tương tác).'],
    viec: [{ ten: 'Cảnh động thả hồn (video Pexels + tiếng nền)', tt: 'xong', ghi: 'may-dung-canh.ts · 2 video thử DUYỆT 26/10' },
      { ten: 'Ảnh sống: ảnh Pexels + AI sửa theo góc (ckey 110₫) + clip phủ mưa/tuyết/bụi 0đ, hoặc Grok ảnh→video (3.250₫/10s · 6.500₫/6s) lặp chồng mờ thành 30–60s', tt: 'cho', ghi: 'anh lưu vào plan 27/10; thử 26/10 đạt: ảnh sửa giữ cảnh, Grok mưa nhỏ giọt, lặp 60s không thấy mối nối; Grok tiêu tiền → anh duyệt từng đợt' },
      { ten: 'Máy đăng chọn video đúng DẠNG của ô (không chỉ đúng góc)', tt: 'xong', ghi: 'puzzle-books 23f7235' },
      { ten: 'Máy sinh đề theo góc bằng chữ AI (may-de.ts, Haiku qua ckey; may-dung --sinh-de)', tt: 'xong', ghi: '2 đề thử 27/10 DUYỆT 10/10; chạy rộng theo đợt anh duyệt' }, { ten: 'Bộ bài ảnh: thẻ chữ · nhận ra cái này không · đoán năm/giá · hai lựa chọn', tt: 'xong', ghi: 'may-dung-anh.ts (một mẫu, bốn kiểu, chỉ ảnh 4:5) · 4 bài thử 27/10' }, { ten: 'Top 3/5 đếm ngược', tt: 'xong', ghi: 'may-dung-top.ts: mỗi mục một ảnh thật riêng (nen_them, migration 0348), lia chậm + chồng mờ, số đếm ngược, tiếng thật; máy sinh đề đã có DeTopSchema' }, { ten: 'Lầm tưởng vs sự thật · Đúng/Sai', tt: 'xong', ghi: 'may-dung-lat.ts: một mẫu hai dạng, mỗi câu một ảnh thật (nen_them), đếm 3s rồi lật MYTH/FACT · TRUE/FALSE + lý do, điểm cuối; dải ảnh dùng chung may-dung-chuoi.ts' }, { ten: 'So sánh X vs Y', tt: 'xong', ghi: 'may-dung-so-sanh.ts: chia đôi màn trên/dưới, hai ảnh thật, 2–4 cặp dòng đối nhau hiện dần, kết luận một dòng' }, { ten: 'Cái nào giả? · Chuỗi hội thoại leo thang (mở rộng mẫu Thật hay giả)', tt: 'dang', ghi: 'Cái nào giả xong: may-dung-gia.ts, hai thẻ A/B trên ảnh thật mờ, đếm 7s, FAKE/REAL + khoanh dấu hiệu + lý do; chuỗi hội thoại còn chờ' }, { ten: 'Câu nói theo tình huống', tt: 'xong', ghi: 'may-dung-cau-noi.ts (3–5 câu bản ngữ + cách đọc + nghĩa trên cảnh thật); container Cloudflare đã có Noto CJK 27/10, bản thử tiếng Nhật DUYỆT 10/10' }, { ten: 'Tìm vật giấu · Vật lạc loài · Câu đố mẹo', tt: 'dang', ghi: 'Câu đố mẹo xong (kiểu cau-do của Lật đáp án); vật lạc loài xong (may-dung-lac-loai.ts, lưới ô chữ trên ảnh thật); tìm vật giấu / tìm điểm khác cần AI sửa ảnh (ckey 110₫/ảnh) — để sau, hỏi anh' }, { ten: 'Bỏ "Comment YES or NO" khỏi mẫu Chọn đúng giữa nhiều sai (Only ONE)', tt: 'xong', ghi: 'màn kết → "Try one on paper"; chữ đăng TikTok/FB/bài thường (dang-short.mjs) bỏ câu mời bình luận' }] },
  { so: 4, ma: 'duong', ten: 'Đường đăng còn thiếu', tt: 'dang', hien: 'duong',
    muc_dich: 'Mọi dạng trong kho đều có đường lên nền tảng; hết ô "cần dựng" vì thiếu đường.',
    cach: ['puzzle-books dang-br.mjs thêm: Instagram carousel, Instagram Story bình chọn, TikTok bài ảnh trượt, X bình chọn.', 'Mỗi đường một hàm + tự kiểm danh tính trước khi đăng như các đường đang có; máy đăng (dang-may.mjs › DANG) nhận thêm nền.'],
    viec: [{ ten: 'Instagram carousel', tt: 'cho' }, { ten: 'Instagram Story bình chọn', tt: 'cho' }, { ten: 'TikTok bài ảnh trượt', tt: 'cho' }, { ten: 'X bình chọn', tt: 'xong', ghi: 'dang-br › dangXPoll (khung soạn X khảo sát 27/10), nền x_poll trong máy đăng + Phòng Nội dung; đề poll do máy sinh đề (DePollSchema) hoặc nạp tay' }] },
  { so: 5, ma: 'san-pham', ten: 'Mọi sản phẩm vào máy', tt: 'cho', hien: 'san-pham',
    muc_dich: 'Mỗi dự án / sản phẩm / dịch vụ có nhóm góc trên spy thành một máy studio: nhóm góc + site đích + kênh → tự vào kế hoạch tuần.',
    cach: ['Máy = một dòng xv_may (ma, goc_sp, site_dich, dang[] nơi đăng). Thiếu kênh: đổi tên Page cũ (luật 18/10/2026) hoặc lập tài khoản mới có proxy.', 'Sản phẩm chưa có nhóm góc trên spy: cào spy trước rồi mới lập máy.', 'Thứ tự: sản phẩm đã có site + kênh trước (ExamWeight bật lại, Wordfrost, MilitaryCalc, Giỗ Chạp đã có), rồi sản phẩm cần lập kênh.'],
    viec: [{ ten: 'Bật lại máy ExamWeight', tt: 'cho' }, { ten: 'Máy Wordfrost · MilitaryCalc', tt: 'cho' }, { ten: 'Máy cho app Clane (Foldwell, Milkline, Final Tin, Light-House, Route Planner, Tâm ngắm, Saidly, Teleprompter)', tt: 'cho' }, { ten: 'Máy Bra / Orabra · Astrolas · Mellowstep', tt: 'cho' }] },
  { so: 6, ma: 'giong', ten: 'Giọng AI cho dạng cần giọng', tt: 'cho', hien: 'giong',
    muc_dich: 'Kể chuyện, lồng tiếng giải thích, từ đọc sai, 10 câu theo chủ đề — bốn dạng cần giọng đọc.',
    cach: ['Báo giá THẬT của đường sẽ đi (cổng API rẻ đã có ở vault) trước, anh gật mới chạy; dưới $0,01 / video thì tự chạy theo luật 16/10/2026.', 'Giọng lưu cùng video trong studio, tái dùng khi dựng lại.'],
    viec: [{ ten: 'Đo giá một video mẫu', tt: 'cho' }, { ten: 'Mẫu kể chuyện có thật', tt: 'cho' }, { ten: 'Mẫu lồng tiếng giải thích', tt: 'cho' }] },
  { so: 7, ma: 'do', ten: 'Đo theo dạng', tt: 'cho', hien: 'do',
    muc_dich: 'Biết dạng nào kéo người ở kênh nào; dạng yếu giảm tần suất, dạng mạnh thêm ô.',
    cach: ['Bảng Số bài thêm chiều dạng × góc (lượt xem, thích, bình luận, click site).', 'Luật dạng yếu: 2 tuần không bài nào có lượt xem ở một kênh → giảm tần suất dạng đó cho kênh đó (không bỏ hẳn). Luật kênh chết (nhip-an-toan › kenhChet) đã chạy từ 26/10/2026.'],
    viec: [{ ten: 'Số bài theo dạng × góc', tt: 'cho' }, { ten: 'Luật dạng yếu trong kế hoạch tuần', tt: 'cho' }] },
];

/** Đường đăng của máy đăng (puzzle-books dang-br.mjs / dang-may.mjs): co = đã có hàm đăng. Dạng trong kho cần đường chưa có → ô "cần dựng". */
export const DUONG_DANG: { nen: string; ho: string; ten: string; co: boolean }[] = [
  { nen: 'facebook', ho: 'facebook', ten: 'Facebook Reel (Graph API)', co: true }, { nen: 'fb_anh', ho: 'facebook', ten: 'Facebook bài ảnh / album', co: true }, { nen: 'fb_link', ho: 'facebook', ten: 'Facebook bài link', co: true },
  { nen: 'x', ho: 'x', ten: 'X video', co: true }, { nen: 'x_anh', ho: 'x', ten: 'X bài ảnh (1–4 ảnh)', co: true }, { nen: 'x_link', ho: 'x', ten: 'X bài link', co: true }, { nen: 'x_poll', ho: 'x', ten: 'X bình chọn', co: true },
  { nen: 'instagram', ho: 'instagram', ten: 'Instagram Reel', co: true }, { nen: 'ig_carousel', ho: 'instagram', ten: 'Instagram carousel', co: false }, { nen: 'ig_story_poll', ho: 'instagram', ten: 'Instagram Story bình chọn', co: false },
  { nen: 'tiktok', ho: 'tiktok', ten: 'TikTok video (máy ảo Android)', co: true }, { nen: 'tiktok_anh', ho: 'tiktok', ten: 'TikTok bài ảnh trượt', co: false },
  { nen: 'youtube', ho: 'youtube', ten: 'YouTube Shorts', co: true }, { nen: 'dailymotion', ho: 'dailymotion', ten: 'Dailymotion (API)', co: true },
];

/** Sản phẩm / dịch vụ ứng viên cho bước 5: đã có nhóm góc trên spy (id nhóm = goc_sp.id) nhưng chưa có máy studio. */
export const UNG_VIEN: { ma: string; ten: string; du_an: string; goc_sp: number[]; site: string | null; ngach: string[]; ghi: string }[] = [
  { ma: 'examweight', ten: 'ExamWeight', du_an: 'examweight', goc_sp: [], site: 'examweight.com', ngach: ['hoc'], ghi: 'máy examweight-cau-hoi đang tắt, chưa gán nhóm góc' },
  { ma: 'wordfrost', ten: 'Wordfrost', du_an: 'wordfrost', goc_sp: [1559], site: null, ngach: ['hoc', 'san-pham'], ghi: 'app iOS, cần kênh' },
  { ma: 'militarycalc', ten: 'MilitaryCalc', du_an: 'militarycalc', goc_sp: [1553], site: 'militarycalc.com', ngach: ['san-pham'], ghi: 'có site, cần kênh' },
  { ma: 'astrolas', ten: 'Astrolas', du_an: 'astrolas', goc_sp: [9], site: 'astrolas.com', ngach: ['san-pham'], ghi: 'dịch vụ chiêm tinh; không dùng br htuan82' },
  { ma: 'bra', ten: 'Bra / Orabra', du_an: 'bra', goc_sp: [399, 230, 347], site: null, ngach: ['san-pham'], ghi: 'shop Shopdy; QC Meta riêng' },
  { ma: 'teleprompter', ten: 'Teleprompter', du_an: 'clane', goc_sp: [842], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'saidly', ten: 'Saidly (transcription)', du_an: 'clane', goc_sp: [1551], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'foldwell', ten: 'Foldwell (bills & rx)', du_an: 'clane', goc_sp: [1562], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'milkline', ten: 'Milkline (feeding)', du_an: 'clane', goc_sp: [1563], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'final-tin', ten: 'Final Tin (quit pouches)', du_an: 'clane', goc_sp: [1561], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'light-house', ten: 'The Light-House (idle game)', du_an: 'clane', goc_sp: [1560], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'route-planner', ten: 'Route Planner', du_an: 'clane', goc_sp: [1654], site: null, ngach: ['du-lich', 'san-pham'], ghi: 'app Clane' },
  { ma: 'tam-ngam', ten: 'Tâm ngắm (crosshair)', du_an: 'clane', goc_sp: [1554], site: null, ngach: ['san-pham'], ghi: 'app Clane' },
  { ma: 'mellowstep', ten: 'Mellowstep', du_an: 'mellowstep', goc_sp: [], site: 'mellowstep.com', ngach: ['san-pham'], ghi: 'chưa có nhóm góc spy — cào trước' },
];
