-- Nhóm gốc phim + nước giao thật của camp (anh 29/10/2026: "thêm icon quốc gia target … phim Ấn, Tàu, Âu… là những nhóm cụ thể phải tách … chấm điểm rồi đo xem").
-- etp.phim.nhom_goc: au_my · trung · an · latin · dong_a · da_mau · hoat_hinh — chấm bằng mắt trên poster (apps/etp/phan-tich/nhom-goc-phim.json, nạp bằng nhom-goc-nap.py).
-- etp.camp_nuoc: chi / thu theo nước của từng camp trong 7 ngày gần nhất (report Ethopex gom campaign_name + geo; dong-bo.py ghi đè mỗi lượt).
-- Camp đều nhắm cùng 39 nước (US, CA, GB, AU, NZ, DE, FR, NL…) — nước GIAO thật mới cho biết camp đang chạy ở đâu.
alter table etp.phim add column if not exists nhom_goc text;
create table if not exists etp.camp_nuoc (
  camp_id  integer not null,
  geo      text not null,
  chi      numeric not null default 0,
  thu      numeric not null default 0,
  cap_nhat timestamptz not null default now(),
  primary key (camp_id, geo)
);
