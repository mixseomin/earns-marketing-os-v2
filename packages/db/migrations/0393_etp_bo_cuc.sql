-- TỔNG QUAN DẠNG WIDGET (anh 01/11/2026 "kéo thả tuỳ người dùng… tự lưu lại làm template riêng… có sẵn các template mặc định"): bố cục widget của từng người.
-- ten '__dang' = bố cục đang dùng (tự lưu mỗi lần kéo thả) · tên khác = template riêng người đó đặt · user_id 0 + ten '__team' = bản mặc định cho team (chủ đặt).
-- Widget + template mặc định nằm ở sổ apps/web/src/lib/etp-widget.json — bảng này chỉ giữ vị trí ô.
create table if not exists etp.bo_cuc (
  user_id bigint not null,
  ten text not null,
  o jsonb not null,
  cap_nhat timestamptz not null default now(),
  primary key (user_id, ten)
);
