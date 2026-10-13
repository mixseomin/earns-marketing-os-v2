---
ten: Phòng Game Retro (video NES tự chơi)
thu_tu: 16
khuon: day-chuyen
truong: Duy
vai_truong_phong: duy        # ai giữ vai: quy trình trỏ vai, đổi người = đổi dòng này
vai_nguoi_lam: linh          # cắt đoạn, dựng khung 9:16, tiêu đề + caption tiếng Anh
vai_kenh_keo_khach: yen      # đăng 3 nền, đo số, link tiếp thị liên kết máy retro
vai_thi_truong: tien         # chọn game, soi thị trường máy retro trên spy.on.tc (Góc bán + QC Meta)
don_vi_viec: 1 game · tuần → 5–10 video ngắn · 3 nền (YouTube Shorts · TikTok · Facebook Reels)
cong_nguoi: Giám đốc cấp ROM + tài khoản kênh (mức 3); trưởng phòng duyệt lô video trước khi đăng (nội dung công khai, mức 2)
so_do:
tom_tat: Máy phát lại bản TAS (TASVideos) trên FCEUX → quay có tiếng → cắt khoảnh khắc → khung dọc 9:16 → đăng 3 nền; về sau dùng chính các đoạn này làm mẫu quảng cáo bán máy chơi game cầm tay retro
du_an: []   # chưa có dự án MOS2; máy ở repo ~/Me/Earns/nes-video
trang_thai: đang dựng · máy quay chạy tay trên iMac (repo ~/Me/Earns/nes-video) · chưa có tài khoản kênh · chưa có việc nền · nhân sự AI chưa bật
---
## Phòng làm gì

Mỗi tuần một game NES có bản TAS trên TASVideos. Máy phát lại bản TAS bằng FCEUX tự dựng (`nes-video/vendor/fceux`,
đã bật lại ghi tiếng), quay trọn game có tiếng trong vài phút, rồi người làm chọn 5–10 khoảnh khắc (trận boss, qua màn,
pha né đẹp) cắt thành video dọc 30–60 giây, bản trên 1 phút cho TikTok. Đầu ra kiếm tiền theo thứ tự có tiền sớm:
link tiếp thị liên kết máy chơi game cầm tay retro → mẫu quảng cáo Meta bán máy retro (gameplay ghép vào màn hình máy)
→ quảng cáo trên video dài YouTube.

## Một tuần mẫu

| Lúc | Việc |
|---|---|
| T2 08:00 | Tiến chọn game tuần (TAS có sẵn, game nổi tiếng với khán giả Mỹ 30–45 tuổi, số đo video tuần trước); xin Giám đốc ROM đúng bản (MD5 trong .fm2) |
| T2 | Máy quay trọn bản TAS (`scripts/quay.sh`), Linh kiểm mốc giữa + cuối: nhân vật không bấm lệch |
| T3 | Linh cắt 5–10 khoảnh khắc, dựng khung 9:16 (`scripts/dung-khung.sh … mo`), viết tiêu đề + caption tiếng Anh (nhãn tool-assisted, ghi tên tác giả TAS) |
| T3 17:00 | Duy duyệt lô; lô đầu của mỗi game Giám đốc xem |
| T4–CN | Yến đăng 1–2 video/ngày/nền, link tiếp thị ở mô tả + bio |
| CN | Yến nộp số 7 ngày (lượt xem, giữ chân, bấm link); Duy tổng kết: kiểu video nào giữ, game nào bỏ |

## Luật

- TASVideos: ghi rõ tool-assisted, ghi tên người làm bản TAS, không sửa hình/tiếng bản gốc theo nghĩa đánh tráo người chơi.
- ROM chỉ do Giám đốc cấp; phòng không tự tải.
- Tài khoản kênh mới, chương trình tiếp thị liên kết mới, chạy quảng cáo = mức 3 (Giám đốc).
- Việc nền (máy chạy theo lịch) chưa có cái nào: muốn dựng thì hỏi Giám đốc từng việc, gắn đúng một người chủ trì + chi phí.
