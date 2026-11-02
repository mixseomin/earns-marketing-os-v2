-- XEM NỘI DUNG PHIM (anh 02/11/2026 "Ko có khả năng xem nội dung phim đang có là gì"): ngăn phim trên etp.on.tc đọc nội dung thật từ Ethopex
-- (GET api-multi-be /api/v2/movie/groups/{group_id}: tóm tắt, mô tả, cốt truyện, thẻ, poster, link tập 1).
--   (khối etp.thu_vien dưới đây là no-op: trùng tên bảng thư viện creative đã có — bảng đúng ở 0406 etp.thu_vien_phim)
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
