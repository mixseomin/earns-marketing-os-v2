-- NHẬN PHIM (anh 02/11/2026: "các thành viên vào chọn film sẽ pick ra và nhận quyền. Sau 1 ngày ko lên camp thì sẽ lại release cho người khác đc vào lên camp"):
-- mỗi lần nhận một dòng (không xoá — trả / hết hạn chỉ là trạng thái). Người = etp.tai_khoan.nguoi_id (117 nhà · 115 Sơn · 116 Kiên).
create table if not exists etp.phim_nhan (
  id bigserial primary key,
  content_id bigint not null,            -- mã phim thư viện = content_id của camp
  nguoi_id int not null,
  nguoi text,
  nhan_luc timestamptz not null default now(),
  het_luc timestamptz not null,          -- nhận + 24 giờ
  tra_luc timestamptz,                   -- tự trả trước hạn
  ai_nhan int                            -- users.id người bấm
);
create index if not exists phim_nhan_phim on etp.phim_nhan (content_id, nhan_luc desc);

-- trạng thái tính lúc đọc: da_len = người nhận đã có camp phim này (tài khoản của họ) từ lúc nhận → giữ luôn; giu = còn hạn; het = quá hạn chưa lên; tra = tự trả
create or replace view etp.phim_nhan_v as
select n.*,
  coalesce((select min(c.tao) from etp.camp c join etp.tai_khoan t using (ad_account_id) where c.content_id = n.content_id and t.nguoi_id = n.nguoi_id and c.tao >= n.nhan_luc),
           (select min(c.tao) from etp.camp_ngoai c join etp.tai_khoan t using (ad_account_id) where c.content_id = n.content_id and t.nguoi_id = n.nguoi_id and c.tao >= n.nhan_luc)) len_luc,
  case when n.tra_luc is not null then 'tra'
       when exists (select 1 from etp.camp c join etp.tai_khoan t using (ad_account_id) where c.content_id = n.content_id and t.nguoi_id = n.nguoi_id and c.tao >= n.nhan_luc)
         or exists (select 1 from etp.camp_ngoai c join etp.tai_khoan t using (ad_account_id) where c.content_id = n.content_id and t.nguoi_id = n.nguoi_id and c.tao >= n.nhan_luc) then 'da_len'
       when n.het_luc > now() then 'giu'
       else 'het' end trang_thai
from etp.phim_nhan n;
