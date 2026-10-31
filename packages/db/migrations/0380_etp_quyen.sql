-- PHÂN QUYỀN etp.on.tc (anh 31/10/2026: "David và Sơn là admin sẽ xem đc full như hiện tại. Sau này sẽ có tk của Kiên sẽ chỉ xem phần của Kiên,
-- ko được xem các phần khác để tăng sự sáng tạo và tìm tòi ra ngách mới"; Sơn "được edit camp của Sơn").
-- Một sổ cho mọi người đăng nhập etp KHÔNG phải admin mos2 (admin mos2 = chủ, luôn xem + làm hết). Không có tên trong sổ = không vào etp.
--   vai admin  = xem toàn bộ như chủ; nguoi_id (nếu có) = sửa được camp trong các tài khoản QC của người đó (bật / tắt / ngân sách) — không đụng camp nhà / người khác
--   vai nguoi  = chỉ thấy phần của nguoi_id (camp / số / phim / creative / sổ lên bậc / đề xuất bậc của máy), không danh sách người, không dữ liệu nhà; không sửa
-- Gác ở apps/web/src/lib/etp-quyen.ts (trang, mọi action etp); lệnh sửa đi apps/etp/sua-ngoai.py qua cổng ethopex_api.py chế độ ETP_SUA_NGUOI.
create table if not exists etp.quyen (
  user_id bigint primary key references users(id) on delete cascade,
  vai text not null check (vai in ('admin', 'nguoi')),
  nguoi_id int,
  ghi text,
  luc timestamptz not null default now(),
  check (vai = 'admin' or nguoi_id is not null)
);
insert into etp.quyen (user_id, vai, nguoi_id, ghi)
  select id, 'admin', 115, 'Nguyễn Sơn — xem toàn bộ, sửa camp trong tài khoản của Sơn (anh 31/10/2026)' from users where email = 'nguyenson191295@gmail.com'
  on conflict (user_id) do nothing;
