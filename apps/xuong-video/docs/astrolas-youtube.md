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

## Tổ chức trong studio (vòng 4, đề xuất 02/11/2026 — chưa dựng)

Hiện trạng đo 02/11:
- Studio đã có MỘT máy `astrolas` (xv_may, mẫu `canh-dong`, một chuỗi `phong_cach` "celestial, purple/gold"), 36 video, toàn bài Dạng × Góc lên FB Page Eyes On Stars (#632). Mục YouTube @astrolasapp trong `xv_may.dang` đang khoá.
- Kênh Yesterday's News Tonight chạy bằng hồ sơ kênh `apps/xuong-video/scripts/lich-su/kenh.json` (mục `parody`: `may`, `lich_tap`, `gio_tap`, `ten_kenh`, giọng, theme, khuôn) + bộ nhận diện `scripts/lich-su/brand/yesterdays-news-tonight/` + máy chạy `chay-kenh.mjs`. Bảng mos2 Tài sản › Kênh social đọc `lich_tap`/`gio_tap` (`apps/web/src/lib/tai-san/kenh-sp.ts`).
- Máy đăng chưa có khái niệm playlist (grep `playlist` trong scripts đăng: không có).

Cây đề xuất: **Kênh → Loạt → Tập**.

| Tầng | Là gì | Chứa gì | Nằm ở đâu |
|---|---|---|---|
| Kênh | máy `astrolas` (một, không tách) | khung thương hiệu: giọng, logo + chuông, màu, font, góc logo, màn cuối, khuôn ảnh bìa; tài khoản đăng; sự thật đã kiểm; góc spy | `xv_may` astrolas + `scripts/lich-su/brand/astrolas/` |
| Loạt | một playlist YouTube | tên + tiền tố tiêu đề, họ hình (theme), khuôn kịch bản, ngày trong tuần, trang đích trên site, mã playlist | một mục hồ sơ trong `kenh.json`, cùng `may: astrolas` |
| Tập | một video | kịch bản đánh số, ghi `loat` | `scripts/lich-su/tap/*.json` → `xv_may_video` |

Vì sao không tách mỗi loạt thành một máy: trần đăng và khoảng cách 3 giờ của máy đăng tính theo tài khoản; nhiều máy cùng đăng một kênh thì mỗi máy tự tính trần riêng → vượt trần kênh mới và chồng lịch. Một máy giữ một trần chung, các loạt chia nhau suất.

Lịch: kênh mới trần 1 bài/ngày → các loạt KHÔNG trùng ngày (vd thứ 2 + thứ 6 "Chart Chapters", thứ 4 "Lịch trời"); `chay-kenh.mjs` đánh dấu `nguon.dang_lam` theo máy nên hai loạt cùng ngày sẽ giẫm nhau.

FB Eyes On Stars giữ dòng bài Dạng × Góc hiện tại (đang đo ở bước 7 kế hoạch chính), không đưa sang YouTube để kênh YouTube giữ một khung nhận diện.

Phần phải dựng (chỉ khi anh duyệt):
1. `brand/astrolas/`: logo + chuông, màn cuối, khuôn ảnh bìa có nhãn loạt (theo mẫu `brand/yesterdays-news-tonight/ve-brand.py`).
2. Theme `engraving` 9:16 cho máy dựng lịch sử (chuyển từ lemo-opuscar), sau đó `paper-lantern`.
3. Khuôn kịch bản "Chart Chapters" trong `kenh.json` + script lấy mốc ZR / Profection từ astrolas.com.
4. Trường `loat` trên tập → máy đăng gắn playlist YouTube + tiền tố tiêu đề; bảng Kênh social hiện loạt ở từng dòng Lịch.

## Ngôn ngữ EN → ES → JA (vòng 5, đề xuất 02/11/2026 — chưa dựng)

Đo 02/11:
- astrolas.com `config/app.php` `public_locales` = chỉ `en`, `vi`. Tệp `lang/es.json`, `ja.json` có nhưng chưa mở công khai; dịch nội dung ja đang dở (followup #486), es chưa bắt đầu (#459). → Video ES/JA lúc này dẫn người xem về trang tiếng Anh.
- Máy lịch sử đã chạy được ES: `tap.ngon_ngu`, `kenh.json` có `tu.es`, `ket.es`; nhưng tập ES đang được VIẾT RIÊNG (bolivia-mar-es, brasil-es), không phải bản dịch của tập EN.
- YouTube multi-language audio: nguồn 2026 nói ngược nhau về Shorts; video của mình có chữ in trên hình (tiêu đề, nhãn, chữ chạy) nên track tiếng thay không dịch được chữ trên hình.

Đề xuất:
- **Sản xuất: một tập gốc EN, các bản ngôn ngữ là biến thể của cùng tập.** Dùng lại bố cục cảnh + hình; dịch kịch bản, đọc lại bằng giọng bản ngữ, dựng lại chữ trên hình. Mốc lá số và sự thật giữ nguyên (không phụ thuộc ngôn ngữ). Câu đùa / chơi chữ phải viết lại cho ngôn ngữ đó, không dịch thẳng.
- **Phát hành: mỗi ngôn ngữ một kênh YouTube** (Astrolas, Astrolas en Español, Astrolas 日本語), cùng khung thương hiệu, cùng cấu trúc loạt / playlist. Lý do: chữ in trên hình; thuật toán phát theo khán giả từng ngôn ngữ; trần đăng tính theo tài khoản nên mỗi kênh có trần riêng mà không spam.
- **Trong studio:** Kênh → Loạt → Tập giữ nguyên; thêm chiều ngôn ngữ ở tầng Tập (tập gốc + bản `es`, `ja` trỏ về tập gốc) và ở tầng Kênh (mỗi kênh ngôn ngữ một mục đăng trong `xv_may.dang` có `ngon_ngu`, máy đăng chỉ lấy bản đúng ngôn ngữ). Khung thương hiệu chung, chỉ khác giọng đọc theo ngôn ngữ + câu màn cuối dịch.
Hồ sơ trong studio KHÔNG tách theo ngôn ngữ (chốt đề xuất 02/11):
- Một máy `astrolas`, một phim quản lý kênh, một tệp tập. Chỉ tách ở ĐẦU RA: mỗi ngôn ngữ một video (`xv_may_video`, có `ngon_ngu` + slug tập gốc) và một mục đăng kênh ngôn ngữ đó.
- Tệp tập (`scripts/lich-su/tap/<id>.json`): phần không đổi theo ngôn ngữ để chung — `canh` (bố cục, hình, nhân vật, năm), `su_that`, `nguon`, `goc`. Phần chữ đổi theo ngôn ngữ để trong `ban.<nn>`: `tieu_de`, `mo_ta_dang`, `hook`, `giong`, và theo từng câu `chu` + `canh.chu_to` (+ chữ con dấu). Dịch giữ đúng số câu để câu nào khớp cảnh nấy; thời lượng cảnh tính lại theo tiếng đọc mới.
- Sửa cảnh một lần → mọi ngôn ngữ ăn theo. Khác cách hiện tại của máy lịch sử (tập ES viết riêng thành tệp riêng: bolivia-mar-es, brasil-es).
- **Thứ tự mở:** EN trước. ES / JA chỉ mở khi astrolas.com có trang đích ngôn ngữ đó công khai (ít nhất trang công cụ được trỏ + trang đăng ký); JA đang dịch dở nên có thể đi trước ES nếu xong trước. Mở ngôn ngữ mới = tài khoản YouTube mới (lập tài khoản theo luật chung, có proxy).

## Studio tổ chức theo YouTube: Kênh → Playlist → Video (vòng 6, đề xuất 02/11/2026 — chưa dựng)

Hiện trạng đo 02/11: studio đã có 2 tầng cho kênh — Phim = Kênh (`xv_phim` #1195 Yesterday's News Tonight, `kinh_thanh.may` trỏ máy đăng) → Tập = Video (`xv_tap` 1182, 1198; tệp `scripts/lich-su/tap/*.json`) → bản xuất `xv_may_video`. Thiếu tầng Playlist.

Ánh xạ đề xuất:
| YouTube | Studio | Ghi chú |
|---|---|---|
| Kênh | Phim loại kênh (`xv_phim`) nối máy `astrolas` | MỘT kênh studio "Astrolas"; các kênh YouTube EN/ES/JA là nơi đăng của nó (mục `xv_may.dang` có `ngon_ngu`) |
| Playlist | tầng mới: danh sách playlist khai trong hồ sơ kênh (`kenh.json`, cạnh `lich_tap`) | mã, tên, tiền tố tiêu đề, theme, khuôn kịch bản, ngày trong tuần, trang đích, mã playlist YouTube theo ngôn ngữ |
| Video | Tập (`xv_tap` + tệp tập) ghi `playlist` | bản ngôn ngữ trong `ban.<nn>`; mỗi ngôn ngữ một `xv_may_video` |

Làm CHUNG cho mọi kênh của studio (Yesterday's News Tonight cũng dùng được), không làm riêng Astrolas. Lịch làm tập chuyển từ cấp kênh xuống cấp playlist; trần đăng vẫn tính ở cấp kênh.

## Việc kế (chỉ khi anh chốt)

1. Kịch bản mẫu đánh số "Chart Chapters: Steve Jobs" — mốc ZR / Profection lấy từ astrolas.com.
2. Một khung ảnh dọc 1080×1920 có đủ lớp thương hiệu, kiểu engraving.
3. Anh duyệt → khai cấu hình khung thương hiệu trong studio → dựng tập mẫu.
