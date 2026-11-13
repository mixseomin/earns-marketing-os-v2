# Chuẩn chấm điểm của studio

Anh ra chuẩn 13/11/2026 (phim #3071): bộ chấm ảnh báo "14/20 đạt" trong khi ảnh sai nhìn thấy bằng mắt, và vòng tự-sửa dựa trên bộ chấm đó làm 4 shot xấu đi.
Chuẩn ngành cho một bộ chấm: **nó phải được đo trước khi được tin** (GenEval github.com/djghosh13/geneval, DSG github.com/j-min/DSG: câu hỏi có/không, đối chiếu với nhãn người).

## Ba loại bộ chấm

| Loại | Là gì | Điều kiện để được CHẶN / TỰ CHỌN |
|---|---|---|
| **Luật** | soát chữ, soát dữ liệu có cấu trúc – cùng đầu vào luôn cùng kết quả | mỗi luật có test dựng từ ca thật (bản hỏng bị bắt, bản sửa qua) |
| **Đo** | số đo hình học từ dữ liệu 3D của chính studio | dữ liệu đo đúng phiên bản khung đang dùng (không đo trên khung cũ) |
| **Giám khảo** | mô hình nhìn ảnh / video / đọc kịch bản rồi phán (LLM, bộ dò vật) | đã đo trên bộ gắn nhãn, đạt ngưỡng ghi ở dưới |

## Luật cho giám khảo

1. **Bộ gắn nhãn trước, ngưỡng sau.** Ít nhất 40 mẫu, khoảng nửa là mẫu xấu, nhãn gắn khi CHƯA xem kết quả bộ chấm. Lưu trong repo cạnh bộ chấm.
2. **Tách bộ chỉnh và bộ thi.** Ngưỡng chỉnh trên một nửa, con số báo cáo lấy từ nửa còn lại. Chỉnh trên chính lô đang chấm thì con số không có nghĩa.
3. **Báo hai số**: trong các mẫu nó cho đạt, bao nhiêu % đạt thật (độ chính xác); trong các mẫu xấu, nó bắt được bao nhiêu % (độ bắt lỗi). Không báo "x/20 đạt" trơn.
4. **Chưa đo = "chưa kiểm chứng"**: chỉ hiển thị để tham khảo. Cấm chặn, cấm tự chọn ảnh, cấm tự sinh lại, cấm tự thêm câu vào câu lệnh.
5. **Không chấm được ≠ đạt.** Mô hình lỗi / không trả / không đọc được kết quả → ghi "chưa chấm", không tính là qua.
6. **Hỏi có/không từng mục, trả theo khuôn**, không chấm bằng văn tự do. Mỗi mục lệch nêu được: mong đợi gì, thấy gì.
7. **Ngưỡng có nguồn**: ghi đo trên bộ nào, ngày nào. Ngưỡng đặt theo một shot sự cố thì ghi rõ là tạm.
8. **Điểm chỉ so được trong cùng một bộ chấm.** Giao diện hiện lỗi cụ thể, không chỉ con số.

## Trạng thái đã soát (13/11/2026)

| Bộ chấm | Loại | Kiểm chứng | Quyền hiện tại |
|---|---|---|---|
| `kiem-prompt.ts` (soát câu lệnh) | luật | test từ ca thật | chặn sinh khi một lỗi ≥ 20 điểm phạt |
| `doi-chieu-anh.ts` + `doi-chieu-khung.ts` (bóc tách ảnh rồi so với yêu cầu) | giám khảo | **chưa đo** | chỉ hiển thị; không cổng nào đọc |
| `scripts/vong-sua.mts` (sinh lại theo giám khảo trên, tự đổi keyframe) | dùng giám khảo chưa đo | – | **tắt mặc định** từ 13/11/2026, chỉ chạy khi gọi `--vong-sua=N` |
| `scripts/cham-do/cham_do.py` (số đo keyframe ↔ khung 3D) | giám khảo (bộ dò vật + độ sâu) | **chưa đo** – ngưỡng chỉnh trên chính 20 ảnh của tập #3074 | chỉ in kết quả; `--ghi` khoá |
| Giám khảo LLM nói chung (`claude.ts`) | giám khảo | chưa đo | không lượt nào đặt nhiệt độ cố định – cùng ảnh có thể ra hai kết quả |

Chưa soát, làm ở nhịp sau: `kiem-khung.ts`, `kiem-nguoi-xem.ts`, `qc-cam-xuc.ts`, `diem-nhin*.ts`, `diem-nhan.ts`, `kiem-ai-3d.ts`, `cham-kich-ban.ts`, `cham-the-loai.ts`, `diem-murch.ts`, `cham-may.ts`, `dan-dat.ts`, `tuyen-truyen.ts`, `nhip-hinh.ts`, `kiem-qc.ts` và các cổng `chan*`.
