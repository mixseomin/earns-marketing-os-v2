# ReelShort — đo một tập điển hình (23/10/2026)

Nguồn đo: kênh YouTube chính thức @ReelShortApp, video `icpSf6to9Ms` "My Boyfriend Stole My Life—Now I'm Taking It Back" (thể loại bị chà đạp → trả đòn,
gần phim tổng tài #132). Đo 5 phút đầu (≈ 3–4 tập đầu ghép liền), 426×240, ffmpeg phát hiện cắt cảnh (`select=gt(scene,0.25)`).

## Số đo
- **162 shot / 300 giây** — trung bình **1,85 s**, trung vị **1,53 s**, p25 1,03 s, p75 2,2 s.
- Phân bố: < 1 s: 36 · 1–2 s: 76 · 2–3 s: 30 · 3–5 s: 15 · > 5 s: 5 (shot dài nhất 15,9 s — một đoạn thoại).
- **≈ 70 % shot dưới 2 giây.**
- Chuỗi chấn thương cổ tay (giây 25–50): 13 shot liền 1,3–3 s — đánh bóng (toàn) → cận bóng → cận mặt đau → cận tay ôm cổ tay → bố trên xe lăn phản ứng → khán giả cầm biển → đối thủ đắc ý.

## Cách dựng thấy được trên khung hình
- **Người thật, bối cảnh thật** (sân pickleball, xe, ngoài trời) — không có dấu hiệu 3D / previs trên hình. Nguồn ngoài cũng nói ReelShort chủ yếu live-action quay ở Mỹ, 6–9 ngày quay / series, ~10 trang kịch bản / ngày (lafilm.edu, mofilm.org).
- **Hành động được KỂ BẰNG CẮT, không bằng một shot dài**: một động tác có tiếp xúc (bóng trúng tay, ngã, giật đồ) = chuỗi 4–8 mảnh 1–2 s: toàn → cận chi tiết (tay, bóng, vợt) → cận mặt phản ứng → người xung quanh phản ứng. Phần vật lý "giữa chừng" bị cắt đi, khán giả tự nối.
- **Cận mặt + phản ứng chiếm đa số**; cận chi tiết (insert) xen dày; toàn cảnh chỉ để mở cảnh / đổi chỗ.
- **Chữ trên màn**: phụ đề cháy cứng mọi câu thoại; giới thiệu nhân vật bằng tên chữ lớn (SLOANE HART, MASON CRANE) ở lần xuất hiện đầu; nhân vật chính mới xuất hiện có shot góc thấp anh hùng.
- Máy cầm tay / gimbal, nét nông.

## Áp vào xưởng AI (studio.on.tc)
- Model video sinh 4–8 s mỗi clip, nhưng nhịp ReelShort là 1–2 s mỗi shot → mỗi clip AI chỉ cần MỘT động tác đơn (bước tới / quay đầu / phản ứng mặt / tay nắm đồ), cắt lấy 1–2 s tốt nhất.
- Động tác có tiếp xúc tinh (giật thẻ, trao đồ) KHÔNG đòi model diễn trọn: tách thành mảnh trước-chạm / cận chi tiết / phản ứng — đúng chỗ model đang hỏng (#132 #15 dây thẻ kéo xuyên đầu).

# Dòng phim AI của ReelShort — 9 tập (26/10/2026)

ReelShort giờ có cả một dòng phim làm hoàn toàn bằng AI, cùng khuôn với phim người thật ở trên. Con tải tập về bằng `yt-dlp <link reelshort.com/episodes/…>`
(trang phát HLS 720×1280), soi tờ cắt cảnh (ffmpeg `select=gt(scene,0.3)`, tile), đo độ dài shot.

| Phim · tập | Dài | Shot | Trung vị | Mở tập bằng |
|---|---|---|---|---|
| Loved Me Most, Betrayed Me Worst · 1 | 242 s | 142 | 1,29 s | Lời kể tiệc sinh nhật → em gái bị giết → toà xử |
| The Triplets' Final Regret · 4 | 116 s | 61 | 1,50 s | Giữa cãi nhau → đốt khăn tay |
| Dear Brother, Your Regret Came Too Late · 1 | 127 s | 52 | 2,20 s | Thẻ tên nhân vật + máu trên khăn giấy + "stage four" |
| The Bride They Threw Away · 1 | 83 s | 43 | 1,62 s | Bút ký tên vào sổ hôn ước |
| She Stole My EpiPen… · 1 | 71 s | 32 | 1,92 s | Nữ chính đang sốc dị ứng |
| He Slapped Me at Our Wedding · 1 | 68 s | 35 | 1,79 s | Ngay sau cái tát |
| They Left Me to the Dead · 1 | 111 s | 59 | 1,67 s | Chạy trốn zombie |
| Forward, Without Him · 1 | 84 s | 32 | 2,46 s | Thư báo đậu Columbia + bó hoa |
| Their Brother, the Dragon Sacrifice · 1 | 215 s | 71 | 2,25 s | Rồng tấn công thành |

Trung vị cả 9 tập: **1,3–2,5 s một shot**, tập dài 68–242 s.

## 10 kỹ thuật dùng lặp lại (học theo)
1. **Mở tập ở đỉnh xung đột, giây đầu tiên**: không dạo đầu; cảnh dữ nhất (cái tát, sốc phản vệ, rồng phun lửa, máu trên khăn) là khung đầu.
2. **Lời kể ngôi thứ nhất trong đầu nhân vật** gánh truyện và tả cảm giác mà hình khó diễn ("My left cheek went numb first", "I decided not to waste breath
   trying to explain"); hình chỉ cần cận mặt / cận chi tiết đúng câu đó.
3. **Hành động có tiếp xúc = chuỗi mảnh 1–2 s**, mỗi mảnh một động tác AI làm tốt. Cái tát: tay vung → đầu bật → tay ôm má → cận mắt. Sốc dị ứng: tay
   ôm cổ → vết đỏ trên tay → lục túi → cây bút đồ chơi (bị tráo) → đồng hồ 10:58. Không clip nào phải diễn trọn cú chạm.
4. **Đồ vật là máy kể chuyện**: một món xuyên cảnh, mỗi trạng thái một cận (khăn tay: bén lửa → cháy → rơi → tro → ngón tay chạm tro; sổ hôn ước: ngòi
   bút → tên → tên bị gạch). Cận đồ chiếm khoảng 1/6 số shot, xen đều 3–5 shot một lần.
5. **Vòng phản ứng sau mỗi nhịp**: hành động → cận người chịu → cận người gây → cận người đứng xem (đối thủ cười nhếch, bố mẹ sững sờ).
6. **Thoại: mỗi câu một shot cận, khớp môi thật**, phụ đề cháy cứng to giữa màn; đối đáp bằng shot / phản shot đơn hoặc qua vai, vai tiền cảnh mờ.
7. **Thẻ tên nhân vật** (chữ serif lớn: STEPHANIE SIMS, HELENA, RICHARD PIERCE, Pearl Ashford) ở lần xuất hiện đầu.
8. **Một bảng sáng cho cả tập**: nắng chiều ngược sáng (Triplets, Forward, Slapped), vàng ấm đèn đêm (EpiPen), xám lạnh u ám (zombie, Bride). Nét nông,
   mặt chiếm khung, toàn cảnh chỉ để mở cảnh (khoảng 1 shot / 10).
9. **Nhân vật nhận ra bằng bóng dáng + màu**: mỗi người một kiểu tóc / màu áo không trùng (váy đỏ đô Nina, váy hồng em gái, tai thỏ, tóc bạch kim vs đen).
10. **Chuyển cảnh và hồi tưởng bằng loá sáng trắng / vàng** (light leak, bloom): hồi tưởng tuổi thơ mờ trắng, kết tập bằng một cú loá → móc câu tập sau.

## Áp vào studio (đề xuất, chưa gắn máy)
- Bảng mảnh: shot mặc định 1,5–2 s; mỗi clip AI chỉ một động tác đơn; cắt lấy đoạn đẹp nhất.
- Mỗi nhịp hành động tách thành chuỗi mảnh (trước chạm · cận chi tiết · phản ứng × 2–3) thay vì quay nhiều máy một lần diễn — cách 3D chốt trạng thái
  (`khoa-3d-dien-ai.mts`) chỉ còn cho mảnh cần nối liền thật.
- Thêm lớp lời kể ngôi thứ nhất (giọng nhân vật chính) cho phim kể kiểu này; thẻ tên ở lần xuất hiện đầu; khoá một bảng sáng cho cả tập trong câu tả.
- Mở mỗi tập bằng khung đỉnh xung đột; kết bằng câu móc + loá sáng.

## Eye trace — đo trên 9 tập AI (26/10/2026, `scripts/do-diem-nhin-mau.py`, YuNet)
Khung ngay trước + ngay sau mỗi cú cắt → mặt to nhất → điểm giữa hai mắt (0..1 khung). 811 điểm mặt.

- **Mắt luôn ở cùng một chỗ**: ngang **0,51 ± 0,16** (giữa khung), dọc **0,31 ± 0,09** (đúng đường 1/3 trên). 69 % mặt nằm trong ô giữa
  (ngang 1/3–2/3, dọc 0,18–0,42); tập dựng kỹ nhất 80–88 % (Dear Brother, Forward, Triplets).
- **Mặt to**: chiều cao mặt trung bình 0,22–0,36 chiều cao khung (cận / trung cận).
- Qua cú cắt mắt dịch trung vị **~0,2 bề ngang khung** — ngang mức ghép ngẫu nhiên: họ KHÔNG chỉnh từng cú cắt, họ đặt MỌI shot về một điểm neo
  mắt cố định, nên cắt kiểu gì mắt người xem cũng rơi đúng chỗ cũ. Liền mạch bằng quy ước khung, không bằng đo từng cặp.
- Bản 5 shot Thang máy của studio (ca5, 26/10): mắt dọc 0,24 ± 0,13, ngang lệch 0,15, mặt cao 0,12 (nhiều toàn / qua vai), chỉ 54 % trong ô giữa,
  mắt dịch trung vị **0,47** bề ngang qua cú cắt — gấp đôi ReelShort.
- Áp vào studio: điểm neo mắt mặc định (0,5 ; 0,31) + cỡ mặt 0,25–0,35 khung cho mọi shot không phải toàn / cận đồ — đặt ở khâu ngắm khung
  (dung-set.py › ngam_lai, câu cỡ cảnh trong prompt) và lấy làm đích cho khung dựng lại (diem-nhin-tap.ts › khungCanh) thay vì chỉ khớp từng cặp.
