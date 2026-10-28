-- ĐO ĐIỂM CHẠM CREATIVE (anh 28/10/2026: "creative cũng cần thử với các dạng CTA khác nhau, màu sắc nút, style… đoạn hook — làm sao đo đếm được cho hoàn chỉnh
-- và có insight tốt"; "cần đo về số điểm chạm như voice, text, hình, nội dung"). Hai bảng:
--   so_pheu   — phễu camp × ngày từ Report Ethopex (apps/etp/dong-bo.py): phía Meta (impressions/clicks) + phía site supply_* (anh chỉ định nghĩa:
--               S CVR = S Conversions / S Clicks × 100 · CPM = Cost / S Impressions × 1000 · S Conversion Value = giá trị chuyển đổi phía supply)
--   diem_cham — sổ điểm chạm mỗi creative (hook · nội dung · voice · chữ trên video · CTA · ảnh đầu · chữ QC), máy xưởng ghi LÚC DỰNG (len-creative.py),
--               creative cũ điền ngược từ kho (nguon = 'dien_nguoc' — chỉ điểm chạm suy ra chắc chắn, phần không rõ ghi null)
create table if not exists etp.so_pheu (
  camp_id int not null, ngay date not null,
  hien int, nhap int, chuyen int,                 -- impressions · clicks · conversions (Report)
  s_hien int, s_nhap int, s_chuyen int, s_gt numeric,   -- supply_impressions · supply_clicks · supply_conversions · supply_conversion_value
  cap_nhat timestamptz default now(),
  primary key (camp_id, ngay)
);
create table if not exists etp.diem_cham (
  creative_id int primary key,
  cham jsonb not null,            -- {hook:{…}, noi_dung:{…}, voice:{…}, chu_video:{…}, cta:{…}, anh_dau:{…}, chu_qc:{…}}
  nguon text not null default 'len_creative',
  luc timestamptz default now()
);
