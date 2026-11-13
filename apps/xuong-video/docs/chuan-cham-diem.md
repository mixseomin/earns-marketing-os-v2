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

## Đo bộ chấm ảnh

Lệnh đo (0₫, iMac): `~/.venvs/cham-do/bin/python apps/xuong-video/scripts/cham-do/do_nhan.py --tap 3074 [--bo gemini,so_do]`.
Bộ nhãn: `apps/xuong-video/scripts/cham-do/nhan/<tập>.json` (`da_gan` = mọi ảnh đã gắn, `dat` = ảnh đạt, `tieu_chi` = tiêu chí gắn).
Ảnh sinh sau lần gắn nhãn bị bỏ khỏi phép đo cho tới khi gắn thêm. Quyền tính trong lệnh:
- **tự chọn ảnh**: độ chính xác ≥ 90 % và chấm được mọi ảnh;
- **chặn**: bắt ≥ 80 % ảnh xấu **và** cho qua ≥ 80 % ảnh tốt (chặn mà loại oan ảnh tốt cũng là hỏng).

Kết quả 13/11/2026, tập #3074, 129 ảnh (35 đạt):

| Bộ chấm | Chấm được | Nói đạt → đạt thật | Bắt ảnh xấu | Nhận ảnh tốt | AUC | Chọn-thử (trúng / chọn bừa) | Quyền |
|---|---|---|---|---|---|---|---|
| Giám khảo Gemini (bóc tách + đối chiếu) | 78/129 | 4/5 (80 %) | 54/55 (98 %) | 4/23 (17 %) | 0,61 | 70 % / 67 % | không – gần như báo lệch mọi ảnh, xếp hạng gần đoán bừa |
| Bộ chấm số đo `cham_do.py` | 129/129 | 26/53 (49 %) | 67/94 (71 %) | 26/35 (74 %) | 0,79 | 74 % / 35 % | không – xếp hạng có ích, nhưng nói đạt thì một nửa sai; số này còn lạc quan vì ngưỡng chỉnh trên chính 20 shot này |

Kết luận: cả hai chỉ được hiển thị. Bộ số đo dùng được để **xếp thứ tự gợi ý** cho người chọn, không được tự chọn.

## Trạng thái đã soát (13/11/2026)

| Bộ chấm | Loại | Kiểm chứng | Quyền hiện tại |
|---|---|---|---|
| `kiem-prompt.ts` (soát câu lệnh) | luật | test từ ca thật | chặn sinh khi một lỗi ≥ 20 điểm phạt |
| `doi-chieu-anh.ts` + `doi-chieu-khung.ts` (bóc tách ảnh rồi so với yêu cầu) | giám khảo | đã đo, không đạt (bảng trên) | chỉ hiển thị; không cổng nào đọc |
| `scripts/vong-sua.mts` (sinh lại theo giám khảo trên, tự đổi keyframe) | dùng giám khảo chưa đo | – | **tắt mặc định** từ 13/11/2026, chỉ chạy khi gọi `--vong-sua=N` |
| `scripts/cham-do/cham_do.py` (số đo keyframe ↔ khung 3D) | giám khảo (bộ dò vật + độ sâu) | đã đo, không đạt (bảng trên) | chỉ in kết quả; `--ghi` khoá |
| Giám khảo 🔍 Kiểm khung (Claude, `kiem-khung.ts`) | giám khảo | chưa đo | chặn video (`khung.ts › chanKhung`), có nút người nhận tay (`duyet_tay`) – đúng dạng "cảnh báo, người bỏ qua được" |
| Giám khảo người xem (Claude, `kiem-nguoi-xem.ts`) | giám khảo | chưa đo | chặn xuất tập (`nguoi-xem.ts › chanNguoiXem`); có nút **✋ Nhận tay** (`thu_nguoi_xem.duyet_tay`, gắn mã kịch bản, sửa kịch bản là hết hiệu lực) từ 13/11/2026 |
| Soát keyframe quảng cáo (`qc-cam-xuc.ts`) | giám khảo | chưa đo | chặn video phim QC |

Tính ổn định: giám khảo Gemini 3 chạy ở nhiệt độ mặc định (Google khuyên giữ 1,0 cho dòng này), nên độ ổn định phải đo bằng chấm lặp cùng ảnh, không ép nhiệt độ.

Chưa soát, làm ở nhịp sau: `kiem-khung.ts`, `kiem-nguoi-xem.ts`, `qc-cam-xuc.ts`, `diem-nhin*.ts`, `diem-nhan.ts`, `kiem-ai-3d.ts`, `cham-kich-ban.ts`, `cham-the-loai.ts`, `diem-murch.ts`, `cham-may.ts`, `dan-dat.ts`, `tuyen-truyen.ts`, `nhip-hinh.ts`, `kiem-qc.ts` và các cổng `chan*`.
