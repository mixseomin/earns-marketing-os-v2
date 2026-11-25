-- KHỐI NHIỀU MỨC ★ ROAS (anh 25/11/2026 "8 phim x 4 camp mỗi loại roas từ 0.9 đến 1.2"):
-- mỗi phim trong khối lên len(muc) camp, mỗi camp MỘT creative mới riêng (không cạnh tranh nhau), ngân sách camp mới $5.
alter table etp.khoi add column if not exists muc numeric[];
update etp.khoi set muc = '{0.9,1.0,1.1,1.2}', cr_camp = 4, ns = 5 where id = 1;
