-- A/B HẠN MỨC MỖI ĐỊNH DẠNG (anh 05/11/2026: "AB01 chỉ áp dụng hạn chế ở mỗi định dạng đến khi chứng minh được hiệu quả. Còn mặc định vẫn là các nước như hiện tại!"
-- → chốt "1 thử + 1 đối chứng"): etp.ab.moi_dang = số camp MỖI NHÁNH đang chạy cùng lúc cho mỗi định dạng creative (null = không giới hạn, chia mọi camp);
-- etp.camp_ab.dang = định dạng lúc chia — đếm được cả camp vừa tạo chưa đồng bộ về kho (nhan-ban.ab_ap).
alter table etp.ab add column if not exists moi_dang int;
alter table etp.camp_ab add column if not exists dang text;
update etp.camp_ab a set dang = k.dang from etp.camp c join etp.creative k using (creative_id) where c.camp_id = a.camp_id and a.dang is null;
update etp.ab set moi_dang = 1, cach_chia = 'mỗi định dạng creative: 1 camp thử + 1 camp đối chứng chạy cùng lúc; camp còn lại giữ nước mặc định, không vào A/B' where ma = 'AB01';
