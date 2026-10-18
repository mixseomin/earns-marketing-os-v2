# Học từ Digen (agent.digen.ai) — ghi một lần, không cần vào lại

Xem ngày 18/10/2026. Trang tới từ một quảng cáo Meta (chiến dịch lấy lead).
- **Lần 1 (không đăng nhập):** trang chủ agent, danh mục skill, bảng xếp hạng người làm skill.
- **Lần 2 (đã đăng nhập):** tài khoản miễn phí sharapeach@gmail.com, đăng nhập qua Google (kho #553, hồ sơ trình duyệt #18, phiên sống trên MacBook), được tặng 300 credit. Đọc được trang chi tiết của 8 skill. Skill cộng đồng còn xem được cả mã nguồn: `SKILL.md` kèm thư mục `references/`.
- Chưa chạy skill nào, nên chưa tốn credit.

## Digen là gì

- **Agent chat kèm chợ "Open Skills".** Người dùng gõ một câu mô tả ý tưởng, rồi gõ `/` để chọn skill ("Describe your idea. Type / to pick a Skill.").
- **Quy mô:** 8.864 skill do người dùng khắp nơi tạo ("8,863 open skills, built by creators worldwide").
- **Menu bên trái:** New · Open Skill · Connectors · Search · Library · Creator Center.
- **Lối tắt trên ô nhập:** Movie · Drama · YouTuber · Music · Create Skill · MiniSora · Image Bot.
- **Skill chính thức (@official):**

  | Skill | Lượt dùng |
  |---|---|
  | Digen Drama Studio | 27K |
  | Clip Studio | 971 |
  | Image Bot | 24K |
  | Candy Series | 19K |
  | K-POP Idol | 239 |
  | FLUX 3 Image Klein | 279 |

  Còn có Movie Maker và MiniSora (con không đọc được số lượt dùng).
- **Skill cộng đồng nổi bật:** China Drama Studio, One Minute Drama (Live-Action Series Creator), AI Mini Movie Director, Trailer Maker, MAKE A WEB SERIES, Kids Story Video Maker, DanceFlow, Video Editor, Photoreal Character Sheet.
  Phần lớn skill phổ biến là filter gợi cảm và clip để câu tương tác (bikini, sleepwear, body morph…).
- **Xếp hạng người làm skill (theo ngày và toàn cầu):** đo bằng số token đã chạy, lượt dùng, lượt yêu thích, lượt cài. Người đứng đầu: 347M token, 26K lượt dùng.
- **Kéo người dùng:** mời bạn được 300 credit mỗi người; báo qua trình duyệt khi việc chạy xong ("Turn on browser notifications when tasks finish").
- **Lọc danh mục:** Featured · Popular · Recent, và khoảng 40 nhóm loại video. Danh sách nhóm nằm ở `src/lib/xuong-video/goi-the-loai.ts › DIGEN_NHOM`.

## Bên trong các skill (đọc khi đã đăng nhập)

**Nền tảng chung.**
- Một skill gồm `SKILL.md` (tên, mô tả "dùng khi nào", danh sách công cụ được phép, các bước) và thư mục `references/` chỉ đọc khi cần (progressive disclosure).
- Công cụ của agent:

  | Nhóm | Công cụ |
  |---|---|
  | Sinh ảnh | `generate_image` (t2i, i2i) |
  | Sinh video | `generate_video`: `ref2v` = video từ ảnh tham chiếu nhân vật / bối cảnh / đồ vật; `i2v`; `fl2v` = ảnh đầu + ảnh cuối |
  | Âm thanh | `generate_tts` (tts.design, giọng tả bằng chữ), `generate_music` |
  | Dựng | `mix_clips` (ghép, trộn tiếng, phụ đề), `probe_media`, `extract_clip`, `extract_frame`, `extract_audio` |
  | Tài liệu | `create_document` / `update_document` / `get_document` |
  | Điều phối | `write_todos` (kế hoạch hiện cho người dùng), `set_guidance` (gợi ý bước tiếp) |

- Mỗi sản phẩm có loại riêng: characters · locations · storyboard_images · storyboard_videos · voiceovers · music · final_videos · scripts. Sản phẩm trung gian hiện trên một "canvas".
- Skill có thể Install, Fork, Download; có phiên bản và ngày cập nhật.

| Skill | Lượt dùng | Cách làm (tóm tắt) |
|---|---|---|
| **Movie Maker** (@official, skill số 1) | 159K | Kịch bản → kế hoạch thế giới + shot → ảnh tham chiếu → **prompt ref2v sáu phần với các khối [Shot N] có giờ** → **một clip 10 giây** 720P. Một clip gồm 3–6 nhịp shot, không ghép chuỗi ảnh–video từng shot. Series nối trong cùng cuộc chat bằng "Hook–Turn–Button" (button của tập 1 khoá lối vào tập 2). Có 5 chế độ: tự chạy hết · có kịch bản sẵn · theo ảnh tham chiếu · sửa một bước · tập tiếp. |
| **Digen Drama Studio** (@official) | 27K | Cho phim ngắn dọc kiểu ReelShort / DramaBox. "Máy thể loại" cho các mô-típ hay cày: hợp đồng hôn nhân, tổng tài người sói, trọng sinh, bảng hệ thống, chaebol, sinh tồn, truyện tranh động. **Storyboard chia nhịp ~10 giây** kèm vị trí diễn, độ phủ, thoại. Bảng nhân vật nhiều góc, ảnh bối cảnh, đồ vật chính cùng một hướng hình. Có hai đường: **pilot** (khung series + tập 1 viết đủ) và **series** (cung dài, nhiều tập viết trước). Soát: siết móc câu, nấc phản diện, cảnh mở. Thông tin của bảng hệ thống / game phải nghe được. Ghi rõ **không làm** chấm nhạc chuẩn, lồng tiếng đầy đủ, master âm thanh. |
| **Shorts Maker** (@official) | 87K | Video 10 giây cố định từ ý tưởng, kịch bản hoặc ảnh / video / âm tham chiếu (cả link video để làm lại); ghép các tập trong cùng chat + sinh nhạc nền cho bản ghép. |
| **Clip Studio** (@official, hậu kỳ) | 988 | Cắt đầu cuối, giữ đoạn, chia, nối, thay nhạc giữ hình, tách MP3/WAV, lấy ảnh bìa, đo thông số, ghép giọng đọc rời, **tự nhận dạng lời rồi in phụ đề**. Skill khác sinh xong clip thì gọi skill này để ghép. |
| **Candy Series** (@official) | 19K | Phim dọc ~3 phút, **mỗi đoạn là một cảnh liền** "dừng đúng ở ranh giới chưa vượt" (cliffhanger). Khoá khuôn mặt + căn phòng một lần; "next" là đủ để làm đoạn tiếp. |
| **K-POP Idol** (@official) | 239 | **Khoá khuôn mặt bằng thông số hình học** (cao sọ, góc hàm, đường mặt, chi tiết mắt mũi môi) → bảng ba góc 16:9 (trước, sau, cận mặt) → ảnh đời thường / MV / phỏng vấn. Quy định quang học cố định (đèn flash cứng). |
| **One Minute Drama** (cộng đồng, có mã nguồn) | 15 | 60 giây = **6 cảnh × 10 giây: Móc → Xung đột → Hé lộ → Leo thang → Lật → Cliffhanger**. Mỗi cảnh sinh riêng bằng ref2v + ảnh nhân vật; giọng TTS theo từng nhân vật; nhạc nền nhỏ; ghép lại. Đầu ra A–G: tựa · series/thể loại · tóm tắt · nhân vật · 6 cảnh (mục đích, prompt, thoại, âm, **ghi chú nối cảnh**) · cliffhanger · **đóng gói** (3 tựa + mô tả + hashtag). Soát cuối 9 mục. Không nói đã có video khi công cụ chưa trả ra; không bịa URL. |
| **China Drama Studio** (cộng đồng, có mã nguồn) | 9 | Ít nhất 60 giây = **các phần 15 giây** (4 phần: Móc ngay → Xung đột → Leo thang → Lần trả đầu / lật quyền lực). Mỗi phần một sự kiện chính, prompt tự đủ (ngoại hình, nơi, hành động, nét mặt, máy, ánh sáng, thoại, **ghi chú nối phần sau**). Phân biệt rõ lời dẫn / thoại / tiếng động / nhạc / chỉ dẫn hình không được đọc. Thoại tiếng Anh mặc định. Nhắc lại chi tiết ngoại hình ở mọi prompt; "đừng tưởng sinh riêng sẽ tự giữ được mặt". Nối tập: mở từ hậu quả tập trước, không lặp lại tiết lộ, thiếu thông tin thì hỏi. |
| **Trailer Maker** (cộng đồng) | 112 | Hơn 2 phút, 4–8 nhịp, thẻ tựa đầu + cuối, **mỗi nhịp một ảnh storyboard riêng** (không dùng lại ảnh), i2v từng ảnh, thoại nằm trong tiếng của clip, nhạc ở mức thấp nhất. Trailer game: HUD giữ cùng kiểu và vị trí, hai phe phân biệt rõ. Cảnh hành động: đòn có hậu quả thấy được, có sức nặng, nhắm đúng phe địch. |

## Học được gì → studio đã làm gì (18/10/2026)

| Bài học | Studio đã làm | Ở đâu |
|---|---|---|
| Đóng gói theo định dạng ("skill" mỗi loại video) | **Gói thể loại:** 39 gói. Mỗi gói gồm khung beat, khuôn chuỗi, quy chuẩn dòng phim, cung khán giả, luật nhấn, độ dài, khung hình, tham chiếu | `goi-the-loai.ts`; Thư viện › Định dạng › 📦; Kinh thánh phim › Gói thể loại |
| Phủ đủ loại video ngành đang làm | Mọi nhóm làm video của Digen đều có gói; bài tự kiểm báo đỏ nếu sót | `goi-the-loai.test.mts` (DIGEN_NHOM) |
| Khung riêng cho từng định dạng | Thêm khung beat: series hoạt hình gag, trailer, tài liệu, MV, video YouTuber, tin tức, explainer, bài học. Thêm quy chuẩn dòng phim: hài, tình cảm, phiêu lưu, tài liệu, hành động, viễn tưởng | `dien-anh.ts › CAU_TRUC`, `khuon-chuoi.ts › QUY_CHUAN_DONG` |
| Agent hỏi về cảm xúc và nhịp trước khi làm | Ý đồ khán giả (11 hiệu ứng) vào kế hoạch shot, prompt video và nhạc nền | `khan-gia.ts` |
| Nối tập (Drama Studio, China Drama, One Minute Drama) | Luật dựng **noi_tap**, có nguồn (Douglas, *Writing the TV Drama Series*); gắn vào gói tổng tài; Claude nhận qua lời dặn tách cảnh | `luat-dung.ts`, `nganh-luat-dung.ts` |
| Cảnh hành động + trailer game (Trailer Maker) | Quy chuẩn dòng hành động thêm "mỗi đòn có hậu quả, có sức nặng" và "hai phe phân biệt"; gói trailer game ghi HUD nhất quán | `khuon-chuoi.ts`, `goi-the-loai.ts` |
| Hậu kỳ (Clip Studio) | Studio **đã có**: phụ đề trong bản xuất, poster / ảnh bìa, nhạc tự nhỏ dưới thoại (`xuat.ts`), chuẩn âm lượng LUFS, lồng tiếng | — |
| Bảng nhân vật nhiều góc, khoá mặt (K-POP Idol) | Studio **đã có**: bảng trang phục / nhân vật, LoRA mặt, cổng soi mặt | — |
| Ảnh đầu + ảnh cuối (fl2v) | Studio **đã có**: keyframe kết (`keyframe_ket`) | — |
| Prompt tách thoại khỏi chỉ dẫn hình, mỗi clip một sự kiện | Studio **đã có**: `boThoaiTrongPrompt`, luật nhịp đọc, bộ chấm prompt | — |

## Bài học chưa làm (chờ anh quyết)

1. **Vào việc bằng một câu.** Mô tả ý tưởng → chọn gói → máy dựng sẵn Kinh thánh và tách cảnh. Studio hiện phải qua nhiều bước mới tới tách cảnh.
2. **Đo theo từng gói.** Không đo lượt dùng như Digen, mà đo thứ có ích cho sản xuất: tiền trên một phút phim xong, tỉ lệ shot qua cổng ngay lần đầu, số lần sinh lại.
3. **Báo khi việc nền chạy xong** (sinh ảnh, video, dựng 3D) bằng thông báo trình duyệt.
4. **Thử đường ref2v nhiều shot trong một clip** (kiểu Movie Maker: ảnh tham chiếu nhân vật / bối cảnh / đồ vật + prompt có các khối [Shot N] theo giây). Nếu model của studio làm được, một clip 10 giây chứa 3–6 shot sẽ liền mạch hơn ghép từng clip. **Tốn tiền khi thử**, cần anh duyệt.
5. **Đóng gói tập tự động:** 3 tựa + mô tả + hashtag cho mỗi tập. Studio đã có bài đăng (`vietBaiDang`); có thể chuẩn hoá theo khuôn này.

## Không chép

Chợ skill cộng đồng, thưởng mời bạn, filter câu tương tác, xếp hạng theo số token.
Thế mạnh riêng của studio là phần Digen không cho thấy: luật ngành có nguồn, cổng máy, bản 3D dựng trước, ý đồ khán giả, chấm dẫn dắt, liền mạch.

## Nguồn

- Trang Digen: https://agent.digen.ai/en
- Bài giới thiệu của chính Digen (tiếng Pháp; số liệu không có nguồn kiểm chứng): https://resource.digen.ai/digen-ai-agent-generateur-videos-2026/
