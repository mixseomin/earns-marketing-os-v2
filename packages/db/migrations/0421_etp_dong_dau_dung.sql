-- Mạnh: trạng thái cổng của phim lúc dòng dừng — đổi thì tự chạy lại bước dừng (anh 04/11/2026 "ko làm tự động hết đc à")
alter table etp.dong_phim add column if not exists dau_dung text;
