# Phim ngắn AI Trung Quốc (AI真人短剧) — soát 5 phim (26/10/2026)

Nguồn: các kênh YouTube đăng "全集" (cả bộ ghép 1–6 giờ) gắn thẻ #AI真人短剧 / 红果短剧圈 / AI剧场, lượt xem 290K–680K. Tải 4 phút đầu bằng
`yt-dlp --download-sections "*0-240"`, soi tờ cắt cảnh, đo eye trace bằng `scripts/do-diem-nhin-mau.py`. Đọc cùng `reelshort.md`.

| Video | Thể loại | Khổ | Shot / 240 s | Trung vị | Mắt ngang | Mắt dọc | Cao mặt | Mắt dịch qua cắt |
|---|---|---|---|---|---|---|---|---|
| 3f3TWgdIPBw (九公主AI剧场) | Xuyên không: vợ chồng tài xế xe tải lạc về biên ải cổ | 9:16 | 90 | 2,33 s | 0,52 ± 0,16 | 0,32 ± 0,06 | 0,26 | 0,20 |
| Wc3ghwXKYQw (浪漫剧场) | Bé gái cứu bà cụ → nhà tỷ phú nhận cháu | 9:16 | 91 | 2,27 s | 0,49 ± 0,10 | 0,32 ± 0,12 | 0,24 | 0,16 |
| LkFrwKIonYg (星火剧场) | Đại nữ chủ trở về đòi lại tập đoàn | 9:16 | 85 | 2,17 s | 0,51 ± 0,13 | 0,29 ± 0,06 | 0,25 | 0,17 |
| GcBmw6uxYic (星河短剧) | Bố mua nhà cho con gái, thông gia chiếm phòng | 9:16 | 70 | 2,54 s | 0,49 ± 0,14 | 0,36 ± 0,12 | 0,19 | 0,27 |
| Azi8II9I0-g (红果短剧圈) | Cổ trang: nữ tù gả cho thợ săn | 16:9 | 84 | 2,40 s | 0,54 ± 0,13 | 0,34 ± 0,10 | 0,36 | 0,13 |

Không thấy dấu dựng 3D / previs: bố cục, góc máy, ánh sáng đều kiểu ảnh sinh từng khung rồi chuyển thành video.

## Giống ReelShort (quy ước chung của phim ngắn AI)
- **Điểm neo mắt** y hệt: ngang ~0,5, dọc ~0,3 (đường 1/3 trên), mặt cao 0,19–0,36 khung → cắt kiểu gì mắt cũng rơi đúng chỗ.
- Cận đồ vật kể chuyện, vòng phản ứng sau mỗi nhịp, mở tập ở đỉnh xung đột, phụ đề cháy cứng.

## Khác / học thêm từ phim TQ
1. **Thoại dày, không lời kể**: người nói cận mặt, mỗi shot một câu, phụ đề giữa-dưới; shot dài hơn ReelShort một chút (trung vị 2,2–2,5 s).
2. **Dàn diễn viên đời thường**: tài xế trung niên, ông chú bụng phệ, bà cụ, em bé 3 tuổi, thằng béo ăn đùi gà — không phải ai cũng mặt người mẫu.
   Phim trông thật và hợp khán giả lớn tuổi.
3. **Bối cảnh đời thường cụ thể**: cabin xe tải, chợ đầu mối dưa hấu, bếp chung cư, phòng khách nhà giàu (đèn chùm xoắn, sofa da).
4. **Ký hiệu giàu sang để lật thân phận**: xe sang biển số 江A00000, toàn cảnh trên không dinh thự, hợp đồng quỹ tín thác trên bàn.
5. **Chuyển thời gian bằng loá sáng**: loá trắng mờ + vệt sáng vàng cho hồi tưởng; chữ thư pháp dọc "六小时前" (6 tiếng trước); đường hầm loé trắng = xuyên không.
6. **Cận đặc tả một con mắt** lúc nhân vật nhận ra sự thật; **nắm đấm siết** / **tay đặt lên cửa** thay cho cả cử chỉ giận / do dự.
7. **Góc nhìn chủ quan**: qua kính lái, đồng hồ tốc độ, tay lái — người xem ngồi cùng nhân vật.
8. **Dòng chữ AIGC**: "虚拟情节，切勿当真" (tình tiết hư cấu) dán góc màn — luật dán nhãn nội dung AI ở TQ.
9. **Phân phối**: dựng thành bản "全集" dài 1–6 giờ đăng YouTube, tiêu đề song ngữ / tiếng Anh, có cả bản 16:9 — sống bằng thời gian xem dài.

## Áp vào studio
- Điểm neo mắt (0,5 ; 0,31) là quy ước chung của cả hai bên → nên thành luật mặc định của studio (đề xuất ở `reelshort.md`).
- Dàn nhân vật phụ đời thường (béo, già, trẻ con) cho phim gia đình / đô thị; thẻ chữ thời gian dọc; loá sáng cho hồi tưởng; cận mắt / nắm tay cho
  khoảnh khắc nhận ra / giận.
- Bản ghép dài cho YouTube là đường phân phối thứ hai cho cùng một bộ phim, gần như 0đ (ffmpeg).
