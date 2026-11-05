-- Tên + mã FB của tài khoản QC (Ethopex /api/v1/ad-accounts: display_name, external_id) — anh 05/11/2026 "mọi người trong đội dùng bộ tk riêng
-- rồi nên bổ sung vào đây giống tk nhà": ô TK trên etp.on.tc khi xem một người trong đội = mỗi tài khoản QC của người đó một bộ (apps/web/src/lib/etp-doc.ts)
alter table etp.tai_khoan add column if not exists ten text, add column if not exists ext text;
