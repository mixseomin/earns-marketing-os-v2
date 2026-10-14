---
ten: Phòng Bảo trì
thu_tu: 15
khuon: dung-san-pham
truong: Bảo
don_vi_viec: 1 lượt dọn · ngày
cong_nguoi: xoá ngoài danh mục đã khai = mức 3; đổi ngưỡng giữ = mức 2
so_do: 
tom_tat: Giữ máy anh gọn: dọn nhật ký chat cũ mỗi ngày, cũ trước mới sau, ghi sổ mỗi lượt
du_an: [mos2]
trang_thai: chạy một việc · Dọn nhật ký chat MacBook (Bảo, mỗi ngày 03:30, bật 14/10/2026)
---
**Vì sao có phòng này** (anh 14/10/2026): nhật ký chat Claude (`~/.claude/projects/**/*.jsonl`) đẻ ~5 GB/tuần, đầy đĩa → swap không nở được → máy đơ. Thiết lập `cleanupPeriodDays` của Claude Code chỉ dọn lúc MỞ Claude, mà các phiên chạy hàng tuần không mở lại — nên cần một lượt dọn theo LỊCH, mỗi ngày.

**Làm mỗi ngày (03:30, máy MacBook, LaunchAgent `com.htuan.don-nhat-ky`, script `~/bin/don-nhat-ky`)**:
1. Xoá nhật ký cũ hơn **14 ngày**, cũ nhất trước.
2. Tổng còn vượt **8 GB** → xoá tiếp từ cũ đến mới, nhưng **không bao giờ** đụng tệp có ghi trong 48 giờ qua (phiên đang chạy).
3. Ghi một dòng vào sổ sự kiện công ty (`tu: bao`): số tệp xoá, GB giải phóng, tổng còn lại, tệp cũ nhất còn lại. Lỗi cũng ghi (`loai: loi`).

**Cấm**: xoá thứ gì ngoài `~/.claude/projects/**/*.jsonl` và thư mục rỗng nó để lại; xoá tệp đang được ghi; đổi ngưỡng 14 ngày / 8 GB khi Giám đốc chưa chốt.
