-- XEM NỘI DUNG PHIM (anh 02/11/2026 "Ko có khả năng xem nội dung phim đang có là gì"): ngăn phim trên etp.on.tc đọc nội dung thật từ Ethopex
-- (GET api-multi-be /api/v2/movie/groups/{group_id}: tóm tắt, mô tả, cốt truyện, thẻ, poster, link tập 1).
--   etp.thu_vien: mã phim thư viện → group_id + poster (apps/etp/thu_vien_phim.py ghi cùng lúc với kho spy ethopex_content)
--   etp.noi_dung_phim: bản nội dung đã đọc (lưu đệm 7 ngày — mở lại ngăn không gọi Ethopex)
create table if not exists etp.thu_vien (
  content_id bigint primary key,
  nhom_id bigint,
  ten text,
  locale text,
  anh text,
  url text,
  tao timestamptz,
  cap_nhat timestamptz not null default now()
);
create table if not exists etp.noi_dung_phim (
  content_id bigint primary key,
  du_lieu jsonb not null,
  luc timestamptz not null default now()
);
