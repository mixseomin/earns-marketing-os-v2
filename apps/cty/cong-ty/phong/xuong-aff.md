---
ten: Xưởng Aff
thu_tu: 17
khuon: day-chuyen
truong: Long
don_vi_viec: 1 trang nội dung trên site affiliate · lượt sửa
cong_nguoi: Phòng Nội dung (Ngọc) chấm trước khi lên trang; tối đa 3 lượt chấm chưa DUYỆT mỗi bài, hết lượt thì Giám đốc quyết
so_do:
tom_tat: Long (Claude nội bộ) sửa bài bị Phòng Nội dung trả về, lưu nội bộ; chỉ bản Ngọc DUYỆT mới được máy đưa lên trang
du_an: [adfond]
trang_thai: đang chạy · theo bài trả về
---
Long là Claude nội bộ (Claude Code trên iMac, bộ điều phối gọi mỗi 5 phút, `apps/cty/may/long-sua-bai.mjs`): bài Phòng Nội dung trả về thì
báo nhận lên Telegram, sửa trong repo hotel-arb, dựng, commit NỘI BỘ, rồi nộp bản nháp + mã commit cho Ngọc chấm. Long không deploy, không push.
Ngọc DUYỆT → script cố định (không mô hình) dựng đúng commit đó, deploy ratesbyroom, push về origin, Ngọc báo "🚀 đã đưa lên" (lỗi thì ⚠️).
Giới hạn: quyền hẹp · chỉ ratesbyroom.com · 30 phút mỗi lượt sửa · cây hotel-arb có việc dở của phiên khác thì đợi · tối đa 3 lượt chấm chưa DUYỆT,
không xong thì báo DỪNG và máy không thử lại. Chuẩn chấm: `cong-ty/quy-dinh/noi-dung/chuan-duyet-bai.md` (bắt buộc ảnh thật, video nhúng, FAQ).
