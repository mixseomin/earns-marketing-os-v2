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
