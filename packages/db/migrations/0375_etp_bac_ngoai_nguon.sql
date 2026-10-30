-- SỔ LÊN BẬC CỦA TEAM — NẠP LỊCH SỬ (anh 30/10/2026 "Show nhiều nhất data có thể"): trigger 0373 chỉ ghi từ 30/10; phần trước dựng lại từ
-- bản sao lưu DB hằng ngày (/var/backups/mos2, etp.camp_ngoai lúc 03:00 UTC) + giờ tạo camp (apps/etp/bac-ngoai-lich-su.py). Mỗi dòng nói rõ độ chắc:
--   nguon  = trigger (giờ chính xác tới 10 phút) · sao_luu (đổi ngân sách giữa hai bản sao lưu — khoang ghi khoảng) · tao_camp (giờ tạo chính xác)
--   khoang = khoảng thời gian thật sự xảy ra khi không biết giờ chính xác / ghi chú độ chắc
--   goc_doan = camp gốc đoán theo nhóm tên (cùng đoạn _xN / bản số), không phải tên ghi thẳng gốc (Dup by / _D)
alter table etp.bac_ngoai add column if not exists nguon text not null default 'trigger';
alter table etp.bac_ngoai add column if not exists khoang text;
alter table etp.bac_ngoai add column if not exists goc_doan boolean not null default false;
alter table etp.bac_ngoai alter column chi_nay drop not null;
create unique index if not exists etp_bac_ngoai_nap on etp.bac_ngoai (camp_id, kieu, luc) where nguon <> 'trigger';
