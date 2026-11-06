# Học từ OpenMontage (github.com/calesthio/OpenMontage) — ghi một lần, không cần đọc lại

Thử ngày 07/11/2026 trên iMac, commit d21f5d4, 0₫, không nạp khoá API nào.
Bản cài: iMac `/Users/htuan/tham-khao/OpenMontage` (1 GB). Giấy phép **AGPL-3.0**: chỉ học ý, không chép mã vào studio.

## Nó là gì

Một bộ chỉ dẫn cho trợ lý lập trình: 13 tệp quy trình YAML, 157 tệp skill, 155 công cụ Python. Trợ lý đọc chỉ dẫn rồi tự điều phối
`research → proposal → script → scene_plan → assets → edit → compose → publish`, có điểm dừng chờ người duyệt. Python chỉ làm công cụ và lưu trạng thái.

## Đã chạy thử

| Thử | Kết quả |
|---|---|
| `make setup` | 33 giây, không lỗi |
| Kiểm công cụ | Không khoá: video 0/33, ảnh 0/29, giọng 0/18 (đã cài Piper vẫn 0), nhạc sinh 0/6. Chỉ còn công cụ cục bộ |
| Kiểm hợp đồng `tests/contracts` | 1270 đạt, 7 bỏ qua. Chỉ kiểm cấu trúc, không nói gì về chất lượng phim |
| Demo không khoá `world-in-numbers` | 23 giây 1080p, render 72 giây. Trình chiếu biểu đồ, không phải phim |
| `video_analyzer` trên `/Users/htuan/Me/GitHub/earns-marketing-os-v2/apps/xuong-video/giay-cat/ra/gag3-ban-co-final.mp4` và `seq-6-7.mp4` | Chỉ ra cảnh và khung hình. Tóm tắt, phong cách để trống vì trợ lý phải tự xem ảnh |
| Ink Puppet (mẫu `ink-theater/examples/mocap-figure`) qua HyperFrames | 21 giây, render 10 giây. Người que chạy mocap CMU |
| Bảng Backlot | Mở được, hiện dải công đoạn và trang kịch bản |

Chưa chạy trọn một phim: phần sinh hình và giọng đều cần khoá trả phí.

## Lỗi gặp khi thử

- `video_analyzer`: `opencv` không có trong `requirements.txt`, nên `motion_type` luôn `unknown`, nhưng vẫn ghi `motion_classification` vào bước đã xong.
- `video_analyzer`: clip không có cú cắt nào vẫn báo 9,26 cắt/phút; clip một cú cắt 14,7 giây báo 8,18 (thật là 4,1).
- `scripts/backlot_simulate_run.py` dừng ở bước `script` vì `PREREQUISITE VIOLATION`, tức demo bảng không chạy hết.

## Đáng học (chỉ lấy ý)

1. **Nghe lại bản đã xuất** (`skills/pipelines/explainer/compose-director.md`, bước 6c): chép lời từ chính tệp MP4 cuối, 0 từ thì dừng, dưới 80% số từ kịch bản thì điều tra. `kiemTieng` của studio kiểm trước khi dựng, còn cách này bắt lỗi xảy ra trong lúc dựng.
2. **Luật phê bình CHAI** (`skills/meta/reviewer.md`): lỗi phải chỉ đúng trường hoặc khung hình; thấy một lỗi thì quét hết lỗi cùng loại; lỗi nặng phải kèm câu sửa cụ thể. Hợp cho Phòng Nội dung và kiểm người xem.
3. **Hợp đồng diễn giọng** (`skills/meta/voice-performance-director.md`): cả bài có đường năng lượng, mỗi đoạn có tốc độ, từ nhấn, giây nghỉ trước và sau.
4. **Hồ sơ gu** (`skills/meta/taste-direction.md`): ba thang 1-10 (độ đa dạng hình, cường độ chuyển động, mật độ thông tin), kèm điều cấm và tiêu chí đạt, đi theo suốt các công đoạn.
5. **Tả phim mẫu theo 5 mặt** (`skills/meta/video-reference-analyst.md`): chủ thể, chuyển động chủ thể, bối cảnh, bố cục, máy quay.
6. **HyperFrames** (gói npm riêng của HeyGen, Apache-2.0, dùng được): HTML + GSAP ra MP4, mỗi khung là hàm thuần của thời gian. Cùng nguyên lý với `capture.mjs` của Teardown.

## Không cần học

- Bộ luật liền mạch hình: studio đã sâu hơn hẳn (`bo-set-3d.ts`, 18 luật, điểm Murch).
- Kho mocap CMU: studio đã có `mocap-kho.ts`.
- Bảng số giữ chân ở `skills/creative/short-form.md`: chưa đối chiếu nguồn gốc, không dùng làm chuẩn.
