# Kế hoạch video kênh YouTube Astrolas (@astrolasapp)

Lập 02/11/2026 (iMac). Chat mới nối tiếp: đọc hết tệp này, rồi `~/bin/followup list astrolas` xem mục "Video YouTube Astrolas" (nhật ký trạng thái mới nhất nằm ở đó).

## Trạng thái hiện tại — đọc trước

- **CHƯA DỰNG GÌ.** Anh chửi nặng 02/11 khi Claude tự dựng lại bằng Three.js lúc chưa được bảo: "chưa nói cứ nhảy vào làm". Mọi bước dưới đây chỉ làm khi anh chốt trong câu mới nhất.
- Đang chờ anh chọn: (a) mảng kể chuyện, (b) hướng gộp 3 họ hình, (c) mở 2 loạt trước.
- Bước kế khi anh chốt: viết **một** kịch bản mẫu đánh số theo khuôn phim #1195 (đề xuất "Chart Chapters: Steve Jobs") + một khung ảnh có đủ lớp thương hiệu → anh duyệt → mới dựng.
- Kênh YouTube Astrolas trong sổ máy đăng đang khoá (`nghi_den` 2099-12-31). Không mở khoá khi chưa có video được duyệt.

## Luật cứng của mạch này

- Video phải đi qua studio.on.tc (sản xuất + lưu ở studio). Công cụ ngoài chỉ làm hộ một khâu bằng script trong repo.
- **CẤM** dùng profile br htuan82 cho Astrolas. Không mở mos2 / studio bằng trình duyệt tự động.
- Sinh AI ước dưới 5.000₫ (cộng dồn cả lượt) thì tự chạy rồi báo tiền thật; trên ngưỡng phải hỏi.
- Mốc lá số (ngày giờ, chương Zodiacal Releasing, Profection) **lấy từ chính astrolas.com (Swiss Ephemeris) qua script**, không để mô hình tự đoán. Chuyện lịch sử cần tệp sự thật đã kiểm như `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/su-that/`.
- Đăng bài chỉ qua một đường máy đăng (`dang-may.mjs`), không viết script đăng riêng.

## Vì sao làm lại

Video mẫu cũ (giải thích bầu trời lúc sinh, shot-code `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/scripts/shot-code/bau-troi.html` + `bau-troi-tinh.js`) anh chê "nhìn lởm". Tờ khung: `astrolas-youtube/mau-cu-bi-che.jpg`. Anh muốn nhiều lựa chọn phong cách trước, rồi plan nội dung theo tính năng thật của site.

## Nguồn phong cách (đã tải, MIT)

Thư mục iMac (không commit): `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/tham-khao/ma-nguon/<chủ>_<repo>/`. Đánh giá chung: `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/tham-khao/video-skills.md`.

- **lemomo-ai/lemo-opuscar** — 59 kiểu. Khung `docs/frames/<kiểu>.jpg`, phim `https://github.com/lemomo-ai/lemo-opuscar/releases/download/films/<kiểu>.mp4`, gallery https://lemomo-ai.github.io/lemo-opuscar/. Mặc định 1920×1080, phải chuyển sang 1080×1920.
- **Vincentwei1021/mg-styles-15** — khung `videos/*.jpg`, phim `https://vincentwei1021.github.io/mg-styles-15/videos/<n>.mp4`.
- Thêm: reedodev/explainer-studio, Kianzzz/xilo-opus-video.
- Thư viện prompt Opus của studio: `apps/xuong-video/src/lib/xuong-video/prompt-opus.ts` + `scripts/du-lieu/thu-vien/prompt-opus.json` (703 prompt).
- Máy dựng shot-code: `apps/xuong-video/scripts/shot-code/dung.mjs` (Playwright; trang phải có `window.__dung`, `__seek(t)`).

Đã gửi anh xem:
- `astrolas-youtube/16-kieu.jpg` — tờ 16 kiểu: 1 engraving, 2 stained-glass, 3 art-deco, 4 woodcut, 5 ukiyoe, 6 watercolor, 7 ink-wash, 8 paper-lantern, 9 silkscreen-poster, 10 hologram-hud, 11 dark-keynote, 12 aurora-glass, 13 3d-render, 14 line-art, 15 risograph, 16 silent-film.
- `astrolas-youtube/demo-7-kieu.mp4` — 46 giây, 7 kiểu theo thứ tự: hologram-hud, engraving, stained-glass, risograph, paper-lantern, ink-wash, aurora-glass.

## Nội dung có thật trên astrolas.com để bám

Repo site: `/Users/htuan/Me/GitHub/Astrolas.com` (Laravel, iMac).
- Công cụ: Birth Chart, Synastry, Solar Return, Progression, Lunar Return, Annual Profections, Zodiacal Releasing, Transit, Solar Arc, Diurnal, Daily Profections, Lunation Analyzer, Moon Phase, Horary, Today's sky, Compatibility checker, AI đọc ảnh lá số (free).
- Trang: 12 `/sign/*`; 30 trang `*-sign` (Lilith, Chiron, Juno, Psyche, Eros, Part of Fortune…); 6 lá số người nổi tiếng `/c/` (steve-jobs, taylor-swift, elon-musk, beyonce, lady-gaga, cristiano-ronaldo); thẻ chia sẻ cặp `/c/leo-x-scorpio-g4l`; 923 bài blog tiếng Anh.
- Bán: Member $19.99/tháng hoặc $167.90/năm (lộ trình năm: Profection + Solar Return, Zodiacal Releasing, email báo mốc); báo cáo lẻ $4.99; gói sao.

## Bản plan 7 loạt (vòng 1, đã gửi anh)

| # | Loạt | Kiểu hình | Trỏ về |
|---|---|---|---|
| 1 | "Năm theo tuổi" (Profections / ZR) | hologram-hud | Annual Profections, Zodiacal Releasing |
| 2 | Bầu trời ngày sinh người nổi tiếng | engraving | `/c/*` |
| 3 | Vị trí ẩn (Lilith, Chiron…) | stained-glass | 30 trang `*-sign` |
| 4 | Cặp cung | risograph | Compatibility, Synastry, thẻ `/c/a-x-b` |
| 5 | Trăng trong tuần | paper-lantern | Moon Phase, Lunation Analyzer |
| 6 | Horary — hỏi một câu | ink-wash | Horary |
| 7 | Mẹo dùng công cụ | aurora-glass | từng công cụ |

Ưu tiên lúc đó: 1, 2, 5, 3, 4, 6, 7.

## Dạng kể chuyện theo khuôn phim #1195 (vòng 2)

Phim #1195 trên studio = kênh Yesterday's News Tonight: mỗi tập kể trọn một chuyện có thật, 9:16, hình vẽ 2D. Kịch bản đánh số từng câu, câu mở gây tò mò, giữa tập có lời hẹn "Stay for…", vài câu lại có `[câu đùa]`. Máy làm tập: `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/scripts/lich-su/chay-kenh.mjs` (3 tập/tuần). Tập mẫu: `scripts/lich-su/tap/*.json`.

4 mảng chuyện cho Astrolas:
1. **Đời người nổi tiếng theo chương lá số** (đề xuất số một). Ví dụ: Steve Jobs bị đuổi khỏi Apple năm 1985, quay lại năm 1997, hai mốc rơi vào chương nào của Zodiacal Releasing. Trỏ về ZR, Profections, `/c/steve-jobs`. Mỗi người 1–3 tập. Cho người xem thấy tận mắt thứ gói Member đang bán.
2. **Thần thoại sau mỗi vị trí**: Chiron, Lilith, Psyche và Eros… Trỏ về 42 trang `*-sign` + `/sign/*`. Kết bằng "What's your Chiron sign?".
3. **Lịch sử các kỹ thuật**: William Lilly và đại hoả hoạn London 1666, Kepler xem tử vi kiếm sống, Vettius Valens chia đời thành chương. Trỏ về Horary, ZR, Profections. Khoảng 15–20 tập.
4. **Nhật/nguyệt thực đổi lịch sử**: Columbus và nguyệt thực 1504, Thales và nhật thực 585 TCN. Trỏ về Lunation Analyzer, Moon Phase, Today's sky. Khoảng 10 tập, đăng sát ngày có thực.

Khác kênh lịch sử: bớt đùa, thiên bí ẩn (đùa nhiều thì thành chế giễu chiêm tinh); số liệu lá số lấy từ site; dùng lại máy `chay-kenh.mjs`.

## Tổ chức kênh + nhận diện thương hiệu (vòng 3, đề xuất mới nhất)

Hai lớp: **khung thương hiệu cố định** ở mọi video, **phong cách đổi theo loạt** (playlist). Khoảng 70% giống nhau, 30% đổi.

Lớp 1 — khung cố định:
- Một giọng đọc cho cả kênh (dấu nhận diện mạnh nhất của kênh không mặt).
- Mở đầu nửa giây logo + một tiếng chuông riêng.
- Một bộ màu + font lấy từ astrolas.com; mọi phong cách phải chạy trong bộ màu đó.
- Chữ astrolas nhỏ ở cùng một góc màn suốt video.
- Một câu kết + màn cuối chung: "See your own chart free at astrolas.com".
- Một khuôn ảnh bìa chung, chỉ khác màu nhãn loạt.

Lớp 2 — gộp 7 kiểu còn 3 họ hình:
1. **Kể chuyện** (khuôn #1195, engraving): "Chart Chapters" (mảng 1), "The Myth Behind" (mảng 2).
2. **Công cụ / số liệu** (hologram-hud): Profections, ZR, mẹo công cụ.
3. **Lịch trời** (paper-lantern): Trăng trong tuần, nhật/nguyệt thực.

Xếp kênh:
- Tên video có tiền tố loạt: "Chart Chapters: Steve Jobs", "The Myth Behind: Chiron".
- Trang chủ kênh: video giới thiệu + playlist "Start here", rồi mỗi loạt một hàng.
- Short và video dài tách playlist; short trỏ về bản dài cùng loạt.
- **Mở 2 loạt trước** (kể chuyện + lịch trời); loạt nào giữ người xem tốt mới mở loạt thứ ba.
- Ngày cố định trong tuần, ví dụ thứ 2 kể chuyện, thứ 5 lịch trời.

Trong studio: khung thương hiệu là một cấu hình chung của máy Astrolas (`xv_may.phong_cach`); mỗi loạt chỉ khai phong cách + tiền tố tên.

## Việc kế (chỉ khi anh chốt)

1. Kịch bản mẫu đánh số "Chart Chapters: Steve Jobs" — mốc ZR / Profection lấy từ astrolas.com.
2. Một khung ảnh dọc 1080×1920 có đủ lớp thương hiệu, kiểu engraving.
3. Anh duyệt → khai cấu hình khung thương hiệu trong studio → dựng tập mẫu.
