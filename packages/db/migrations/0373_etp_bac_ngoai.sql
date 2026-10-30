-- SỔ LÊN BẬC CỦA TEAM (anh 30/10/2026: "theo dõi hiệu suất của mọi người trong team về thời điểm lên bậc… chỉ đề xuất, không tự ý update").
-- Ethopex history chỉ ghi lúc tạo camp, không ghi lần đổi ngân sách; etp.camp_ngoai ghi đè ngân sách mỗi lượt đồng bộ → mất thời điểm.
-- Trigger trên etp.camp_ngoai: mọi đường ghi (dong-bo 10 phút, chạy tay) đều vào sổ, không phụ thuộc mã gọi.
--   · sua      = đổi ngân sách ngay trên camp (cu → moi)
--   · nhan_ban = camp mới có camp gốc đọc từ tên ("Dup by <id>" kiểu Kiên, "_D<id>" kiểu Sơn); cu = ngân sách gốc lúc nhân
--   · tao      = camp mới không có gốc
-- Kèm ảnh chụp số LÚC ĐỔI (của camp, hoặc của camp gốc khi nhân bản): chi/thu ngày mới nhất, ngày trước, cả chặng — để so máy luật nhà vs người.
-- Chỉ đọc / ghi sổ; không luật nào hành động trên camp ngoài.
create table if not exists etp.bac_ngoai (
  id bigserial primary key,
  camp_id int not null,
  luc timestamptz not null default now(),
  nguoi_id int,
  kieu text not null check (kieu in ('sua', 'nhan_ban', 'tao')),
  goc_id int,
  cu numeric,
  moi numeric,
  trang_thai text,
  chi_nay numeric, thu_nay numeric,
  chi_qua numeric, thu_qua numeric,
  chi_tron numeric, thu_tron numeric
);
create index if not exists etp_bac_ngoai_nguoi_luc on etp.bac_ngoai (nguoi_id, luc desc);
create index if not exists etp_bac_ngoai_camp on etp.bac_ngoai (camp_id, luc);

create or replace function etp.ghi_bac_ngoai() returns trigger language plpgsql as $$
declare
  g int; nguon int; ns_goc numeric; k text; d1 date;
  cn numeric; tn numeric; cq numeric; tq numeric; ct numeric; tt numeric;
begin
  if tg_op = 'UPDATE' then
    if new.ngan_sach is not distinct from old.ngan_sach or new.ngan_sach is null or old.ngan_sach is null then return new; end if;
    k := 'sua'; nguon := new.camp_id; ns_goc := old.ngan_sach;
  else
    g := coalesce(substring(new.ten from '(?i)^dup by (\d{4,})'), substring(new.ten from '_D(\d{4,})'))::int;
    if g is not null and exists (select 1 from etp.camp_ngoai where camp_id = g) then
      k := 'nhan_ban'; nguon := g; select ngan_sach into ns_goc from etp.camp_ngoai where camp_id = g;
    else
      k := 'tao'; g := null; nguon := new.camp_id;
    end if;
  end if;
  select max(ngay) into d1 from etp.so_ngay_ngoai where camp_id = nguon;
  select coalesce(sum(chi) filter (where ngay = d1), 0), coalesce(sum(thu) filter (where ngay = d1), 0),
         coalesce(sum(chi) filter (where ngay = d1 - 1), 0), coalesce(sum(thu) filter (where ngay = d1 - 1), 0),
         coalesce(sum(chi), 0), coalesce(sum(thu), 0)
    into cn, tn, cq, tq, ct, tt from etp.so_ngay_ngoai where camp_id = nguon;
  insert into etp.bac_ngoai (camp_id, nguoi_id, kieu, goc_id, cu, moi, trang_thai, chi_nay, thu_nay, chi_qua, thu_qua, chi_tron, thu_tron)
  values (new.camp_id, (select nguoi_id from etp.tai_khoan where ad_account_id = new.ad_account_id), k, g, ns_goc, new.ngan_sach, new.trang_thai,
          cn, tn, cq, tq, ct, tt);
  return new;
end $$;

drop trigger if exists etp_camp_ngoai_bac on etp.camp_ngoai;
create trigger etp_camp_ngoai_bac after insert or update of ngan_sach on etp.camp_ngoai
  for each row execute function etp.ghi_bac_ngoai();
