-- TRANG /home DẠNG WIDGET (anh 20/11/2026 "mọi thứ tổ chức dạng widget + layout để linh hoạt hiển thị theo nhu cầu"): bố cục từng MÀN của từng người.
-- man = mã màn (sổ apps/web/src/lib/home/so.ts) · o = mảng ô {ma, x, y, w, h, tabs?, k?} theo lưới mịn 48×72 (apps/web/src/lib/home/luoi.ts kiểm trước khi ghi).
-- user_id 0 = bản mặc định cho cả team (admin đặt). Không có dòng = dùng bố cục dựng sẵn trong sổ.
create table if not exists home_bo_cuc (
  user_id bigint not null,
  man text not null,
  o jsonb not null,
  cap_nhat timestamptz not null default now(),
  primary key (user_id, man)
);
