---
ten: Phòng Bảo mật
thu_tu: 12
khuon: bo-loc
truong: Kiên
don_vi_viec: 1 tài khoản / 1 kênh · chấm mỗi ngày
cong_nguoi: phanh = mức 1 (dừng luôn, báo sau); mở lại = mức 2; dính tiền = mức 3
so_do: 
tom_tat: Sức khoẻ mọi tài khoản/kênh; cảnh báo sớm; cờ freeze; giữ phao
trang_thai: chạy một việc · Mail bảo mật (Kiên, nhịp máy mỗi phút, bật 13/10/2026)
---
**Nhận**: vault accounts (status · joinStatus · currentPhase), log đăng nhập/IP, cảnh báo nền tảng, nhịp đăng từng kênh, điểm giọng văn, lint, profile-locks hai máy, tỉ lệ từ chối outreach.

**Làm mỗi ngày**: chấm điểm rủi ro từng tài khoản (mới / đã tiêu / warm, tần suất so ngưỡng, tên thương hiệu, đổi IP, liên kết với tài khoản đã khoá); cảnh báo sớm; **phanh**: dừng đăng / dừng chi / khoá hành động N giờ; giữ danh sách tài nguyên còn nguyên và chặn mọi ca đụng vào. Tay duy nhất: cờ `freeze` mà worker kiểm trước mọi ca có tay.

**Cấm**: đề xuất tài khoản thay thế, chuyển nội dung khỏi tài khoản bị khoá, dùng tài khoản còn nguyên, đăng nhập tài khoản đòi vân tay. Kiên là người nói không.

**Sổ cảnh báo nền tảng** (18/10/2026): mọi thông báo rủi ro tài khoản (bị hạn chế, khoá, đòi xác minh, từ chối thao tác) vào bảng `platform_alerts` — `br` tự soi chữ trang, máy đăng soi lỗi đăng, người/Claude ghi tay bằng `~/bin/canh-bao ghi`; mẫu + ghi ở `worker/canh-bao.mjs`; nhịp mail-bao-mat của Kiên báo dòng mới lên Telegram 🔐 Bảo mật. Xem sổ: `canh-bao list`.

Nối vào máy chặn đã có: lint thương hiệu, chanNeAn, chanTkChuaTieu, guard-actions, link-gate.
