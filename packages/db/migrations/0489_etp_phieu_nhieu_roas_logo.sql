-- PHIẾU NHIỀU MỨC ROAS + LOGO GỐC (anh 27/11/2026: "Cho chọn nhiều mức roas và có cảnh báo sẽ lên nhiều camp (có số lượng) và mỗi loại phải sinh đủ
-- creative mới tương ứng. Mỗi phim thường sẽ có logo gốc đã tách đẹp thì hiện ra luôn").
-- roas_ds = các mức anh chọn (mỗi mức một creative MỚI + một camp); phieu_roas = mức của đúng thẻ Chờ lên (thẻ thứ i của phiếu nhận roas_ds[i]).
alter table etp.phieu_len add column if not exists roas_ds text[];
alter table etp.cho_len add column if not exists phieu_roas text;
-- logo gốc đã tách của phim (dung-mau.py logo_goc, nằm ở iMac ~/.cache/ethopex/anh-tinh/<cid>/logo-goc.png) → đẩy kho R2, etp2 hiện trong phiếu
create table if not exists etp.logo_goc (
  content_id integer primary key,
  url text not null,
  kieu text,          -- cat | ai | dai
  ban integer,        -- dung-mau.LOGO_BAN lúc tách
  cap_nhat timestamptz not null default now()
);
