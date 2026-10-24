-- etp.on.tc bước 5 (anh 24/10/2026 "tiếp đi"): HÀNG ĐỢI VIỆC dây chuyền creative + TRẠNG THÁI PHIM MỚI trong kho.
-- viec: mỗi việc một phim (loai = cat: tải tập + chọn khung + dựng 2 góc + tờ soát). Thợ apps/etp/tho.py trên máy nào cũng nhận được
-- (select … for update skip locked), làm xong gửi kết quả về iMac (máy trung tâm soát 18+ + đẩy creative). Không có tiến trình nền: thợ chạy theo lô.
CREATE TABLE IF NOT EXISTS etp.viec (
  id          bigserial PRIMARY KEY,
  loai        text NOT NULL,                 -- cat
  lo          text NOT NULL,                 -- mã lô (thư mục ra trên iMac)
  content_id  integer NOT NULL,
  du_lieu     jsonb NOT NULL DEFAULT '{}',   -- {locale, nguon, ten, url, so_ban}
  trang_thai  text NOT NULL DEFAULT 'cho',   -- cho | dang | xong | loi
  may         text,                          -- máy đang / đã làm
  lan_thu     integer NOT NULL DEFAULT 0,
  ket_qua     jsonb,                         -- [{content_id, tu, den, file (trên iMac), loi}]
  loi         text,
  tao         timestamptz NOT NULL DEFAULT now(),
  bat_dau     timestamptz,
  xong        timestamptz,
  UNIQUE (loai, lo, content_id)
);
CREATE INDEX IF NOT EXISTS etp_viec_cho ON etp.viec (trang_thai, id);

-- trạng thái từng phim trong quy trình phim mới (phim-moi.py ghi song song với studio ethopex_phim_moi_tt)
CREATE TABLE IF NOT EXISTS etp.phim_moi (
  content_id  integer PRIMARY KEY,
  tt          text NOT NULL,                 -- poster_ok | poster_loai | da_cat | cat_loi | cat_loai | soat_loai | cong_loai | da_len
  ghi         text,
  lan         integer NOT NULL DEFAULT 0,
  ngay        text,                          -- ngày đích đã lên (dd/mm/yyyy)
  cap_nhat    timestamptz NOT NULL DEFAULT now()
);
