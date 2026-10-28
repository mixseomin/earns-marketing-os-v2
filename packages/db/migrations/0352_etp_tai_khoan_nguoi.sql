-- REPORT THEO NGƯỜI (anh 28/10/2026: "Page này cũng cần bố trí lại để xem được report của từng người"): tài khoản QC Ethopex → người dùng (used_by_user)
-- dong-bo.py ghi từ /api/v1/ad-accounts mỗi lượt; camp_ngoai thêm tên phim (report content_group_name) cho cây phim → camp của người khác
create table if not exists etp.tai_khoan (
  ad_account_id bigint primary key, nguoi_id int, nguoi text, nha boolean not null default false, cap_nhat timestamptz not null default now());
alter table etp.camp_ngoai add column if not exists phim_ten text;
