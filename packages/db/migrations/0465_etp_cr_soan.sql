-- BẢN SOẠN CREATIVE THEO PHIM (anh 23/11/2026, etp2 tab Camp: chip "🎬 N · ＋" trên hàng phim → ngăn kéo soạn creative: chọn mẫu, câu nhử, chữ QC → Lưu vào thư viện).
-- Một dòng = một bản anh đang soạn. Lưu = máy dựng theo mẫu (dung-mau.py trên iMac) nhận qua etp.mau_dung.tuy_chon, dựng xong ghi tv_id + creative_id về đây.
create table if not exists etp.cr_soan (
  id serial primary key,
  content_id integer not null,
  mau text,
  cau text,           -- câu nhử trên ảnh (trống = máy tự viết)
  nhan text,          -- một từ nhấn trong câu nhử (trống = từ cuối)
  chu_dau text,       -- dòng đầu chữ QC Meta (trống = máy tự viết)
  trang_thai text not null default 'nhap',   -- nhap · dung · xong · loi
  ghi text,
  tv_id integer,
  creative_id integer,
  ai text,
  tao timestamptz not null default now(),
  cap_nhat timestamptz not null default now()
);
create index if not exists etp_cr_soan_content on etp.cr_soan (content_id);
alter table etp.mau_dung add column if not exists tuy_chon jsonb;
