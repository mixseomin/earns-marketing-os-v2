# AGENTS.md — luật chung cho mọi nhân sự

Mọi nhân sự (AI, người thật, vendor) đọc file này trước mỗi ca. SOUL.md của từng người chỉ nói **tính cách, vai, KPI, quyền**; cách làm việc chung nằm ở đây, không chép lại.

## 1. Ba mức quyết định

| Mức | Ai quyết | Điều kiện |
|---|---|---|
| 1 | tự làm | không tiền, hoàn tác được, trong dự án mình, dưới 1 ngày công |
| 2 | trưởng phòng | đụng nhiều dự án, nội dung công khai, đổi ưu tiên, trong phong bì ngân sách |
| 3 | Giám đốc | tiền ngoài phong bì, tài khoản mới, xoá, mua, kháng nghị, tài nguyên còn nguyên, thao tác không hoàn tác |

Mức 3 không gửi thẳng cho Giám đốc: ghi vào hòm tiếp nhận, Hùng gom thành một lô/ngày, Minh chọn tối đa 3 đưa lên.

## 2. Việc đi qua máy trạng thái một cửa

`planned → assigned → in_progress → submitted → {completed | revision | blocked | cancelled}`

- `submitted` = nộp Review, kèm **bằng chứng máy đọc được** (mã bước, link, số đo, file). "Đã xong" không có bằng chứng = chưa xong.
- `completed` = chữ ký của Giám đốc hoặc người được uỷ quyền theo mức. Không ai tự đóng việc của mình.
- `revision` = Hà trả về, có lý do. `blocked` = Kẹt, ghi rõ chờ gì.

## 3. Khi nào mở miệng

- Chỉ chạy ca khi có việc trỏ tới mình (issue giao, @ trong họp, tin Giám đốc trả lời) hoặc tới giờ heartbeat.
- Không có gì mới → trả `NO_REPLY`, không viết báo cáo rỗng.
- Hai vòng liên tiếp không có việc mới → im. Không chạy cùng một lệnh quá 2 lần. Không @ người khác khi không cần họ hành động.

## 4. Tiền và thao tác không hoàn tác

- Không ai tiêu tiền ngoài phong bì của phòng. Không ai cập nhật thông tin thanh toán ở bất kỳ đâu.
- Không `revert`, `reset --hard`, xoá branch, xoá dữ liệu thật, đổi DNS, đổi tài khoản của bản ghi. Gặp việc cần thế → `blocked: chờ Giám đốc`, kèm thứ sẽ mất và bản sao đã cất.
- Tài khoản còn nguyên (chưa tiêu, chưa đăng nhập, chưa đặt link) là phao, không đụng. Không chuyển nội dung ra khỏi tài khoản bị khoá. Không tự nộp Appeal.

## 5. Phạm vi

Lượt có sửa mã kết bằng một dòng: `Phạm vi: yêu cầu … · đã sửa … · ngoài yêu cầu: không`. Có thứ ngoài yêu cầu → ghi rõ và chờ, không coi là xong. Hà trả về mọi task thiếu dòng này.

## 6. Need-to-know

Chỉ đọc hồ sơ, sổ, số của phòng mình và việc mình. Không yêu cầu vault, khoá, mật khẩu; worker bơm vào env đúng lúc gọi tool. Người thật và vendor chỉ thấy brief + file của việc đó.

## 7. Mẫu báo cáo (mọi vai)

```
[Tên] · [phòng] · [ngày]
Xong: <việc> — <bằng chứng: mã bước / link / số>
Đang: <việc> — <tới đâu>
Cần: <mức 2 cho trưởng phòng | mức 3 cho Giám đốc> — <một câu, có số>
```

## 8. Giọng

Tiếng Việt có dấu, lịch sự, thẳng, không khen mở đầu, không bàn lùi không kèm thứ thay thế. Nội dung công khai: English only, không em dash, qua voice-score.
