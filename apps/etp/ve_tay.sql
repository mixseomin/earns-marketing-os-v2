-- KIỂM SOÁT TUYỆT ĐỐI LỆNH TĂNG CHI ETHOPEX (anh 18/11/2026 "Mày giao cho thằng Huy" — 17/11 lọt 91 camp dòng phim, 18/11 lọt 31 camp AT qua phanh chợ
-- vì cổng apps/etp/cong.py tin chữ ai / cờ người gọi tự khai).
-- etp.ve_tay: VÉ THAO TÁC TAY — nút người bấm (etp2 · nút Telegram · nút etp) xin một vé ngay lúc bấm (cong.xin_ve), vé đi qua ETP_VE vào tiến trình làm việc;
--   cổng chỉ miễn phanh / bảo trì / trần camp test khi vé đúng việc + camp / phim, chưa hết hạn, chưa dùng. Cửa API (ethopex_api.api) đốt vé lúc gửi (da_dung).
-- etp.cua: SỔ CỬA — mọi lệnh GHI qua cửa API chung: tạo camp, đổi ngân sách, bật / tắt. ok true = cửa cho qua và đã gửi, false = cửa chặn (ly), null = gửi hỏng.
--   Hậu kiểm (apps/etp/hau_kiem.py, dong-bo.py gọi mỗi lượt): camp mới / ngân sách tăng / camp bật trên Ethopex mà không có dòng cho qua ở đây → canh_bao đỏ.
create table if not exists etp.ve_tay (
  ma text primary key,
  viec text not null check (viec in ('tang', 'bat', 'nhan_ban')),
  camp_id integer,
  content_id integer,
  ai text not null,
  tao timestamptz not null default now(),
  het_han timestamptz not null,
  da_dung timestamptz,
  dung_cho text
);
create index if not exists etp_ve_tay_tao on etp.ve_tay (tao desc);
-- LỆNH TRỰC TIẾP CỦA ANH (anh 20/11/2026 09:35 VN: "Không PHANH nào được hạn chế quyền trực tiếp từ tao cả … PHANH chỉ được cảnh báo thêm 1 lần"):
--   loai 'truc_tiep' = vé cấp từ CLI cong.py --ve-truc-tiep (chỉ Claude trong chat với anh gọi) — miễn MỌI phanh trừ phim cấm / camp đội; lenh = nguyên văn câu anh,
--   phien = phiên gọi. Camp có vé trực tiếp đã dùng mang nhãn "Trực tiếp" (etp2, Telegram), máy luật không hạ / tắt lại trong 24 giờ đầu.
alter table etp.ve_tay add column if not exists loai text not null default 'tay';
alter table etp.ve_tay add column if not exists lenh text;
alter table etp.ve_tay add column if not exists phien text;
create index if not exists etp_ve_tay_truc_tiep on etp.ve_tay (camp_id, da_dung desc) where loai = 'truc_tiep';
-- dấu ĐÃ CẢNH BÁO MỘT LẦN: lần gọi đầu có phanh → in câu phanh, ghi dấu (viec, camp / phim); gọi lại trong 30 phút → cấp vé
create table if not exists etp.ve_canh_bao (
  id bigserial primary key,
  viec text not null,
  camp_id integer,
  content_id integer,
  lenh text,
  phanh text,
  luc timestamptz not null default now(),
  da_cap timestamptz
);

create table if not exists etp.cua (
  id bigserial primary key,
  luc timestamptz not null default now(),
  viec text not null,          -- tao_camp · nhan_ban · tang · giam · bat · tat · dat_sau_tao
  loai text,                   -- roas · thang · bai_cu · thay · lich · tay (có vé) · may
  camp_id integer,
  goc integer,
  content_id integer,
  ns numeric,
  ns_cu numeric,
  ve text,                     -- người bấm (ai của vé) khi lệnh mang vé hợp lệ
  ok boolean,
  ly text,
  tep text                     -- tiến trình gửi (sys.argv[0]) · chế độ sửa người team
);
create index if not exists etp_cua_camp on etp.cua (camp_id, luc desc);
create index if not exists etp_cua_luc on etp.cua (luc desc);
