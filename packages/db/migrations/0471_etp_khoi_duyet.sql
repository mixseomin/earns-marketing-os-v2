-- KHỐI CAMP — duyệt / huỷ thật (anh 25/11/2026 "Tao duyệt khối kiểu gì? Nếu không duyệt thì sao?"): nút ▶ Bắt đầu sản xuất / Huỷ khối trên etp2 ghi vào đây.
-- trang_thai: cho (chưa bắt đầu, không tốn tiền) · duyet (anh đã bấm Bắt đầu sản xuất — được sinh AD) · chay · xong · huy (huỷ: dòng phim 'cho' của khối cũng 'huy', không xoá)
alter table etp.khoi add column if not exists duyet_ai text;
alter table etp.khoi add column if not exists duyet_luc timestamptz;
alter table etp.khoi add column if not exists huy_luc timestamptz;
alter table etp.khoi add column if not exists sua_luc timestamptz;
