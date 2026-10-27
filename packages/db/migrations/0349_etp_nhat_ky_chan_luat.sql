-- NHẬT KÝ NHÂN BẢN: LUẬT CHẶN ≠ LỖI (anh 27/10/2026, "⚠302 nghĩa là gì" trên Camp cây #65734).
-- nhan-ban.py từ nay ghi lần bị cổng luật chặn (chưa chạm trần, trần phim, bão hoà, đoạn đủ 3 camp, phải khác creative…) là ok = NULL;
-- các dòng cũ cùng loại đổi nhãn theo đúng câu chặn của máy — chỉ đổi cột ok, không xoá dòng nào.
update etp.nhat_ky set ok = null
 where viec = 'nhan_ban' and ok = false and (
       loi like '%chưa chạm trần%' or loi like 'clone phải khác creative%' or loi like '%đang bão hoà%'
    or loi like '%camp đang chạy (trần%' or loi like '%đã có camp đang chạy / vừa tạo%' or loi like 'đoạn creative #% đã % camp chạy%'
    or loi like 'thang nhân bản chỉ áp dụng bộ%');
