-- NHẬN PHIM CHỈ KHI ĐÃ XÁC ĐỊNH ÂU-MỸ (anh 02/11/2026: "Cột Nhóm Gốc đéo xác định được thì đừng có mà cho Test hay cho Nhận" — phim Trung 155143 lọt lô test):
-- mọi đường ghi etp.phim_nhan (nút Nhận etp.on.tc, phim-moi.py cắt lô, máy) đều qua trigger này — etp.phim.nhom_goc phải = 'au_my'.
create or replace function etp.chan_nhan_ngoai_au_my() returns trigger language plpgsql as $$
declare g text;
begin
  select nhom_goc into g from etp.phim where content_id = new.content_id;
  if coalesce(g, '') <> 'au_my' then
    raise exception 'phim % chưa xác định nhóm gốc Âu-Mỹ (nhóm gốc: %) — không nhận (chỉ chạy phim Âu-Mỹ, anh 29/10 + 02/11/2026)', new.content_id, coalesce(g, 'chưa chấm');
  end if;
  return new;
end $$;
drop trigger if exists etp_phim_nhan_au_my on etp.phim_nhan;
create trigger etp_phim_nhan_au_my before insert on etp.phim_nhan for each row execute function etp.chan_nhan_ngoai_au_my();
-- trả phim đang giữ mà không phải Âu-Mỹ (chưa lên camp)
update etp.phim_nhan n set tra_luc = now()
  where tra_luc is null and het_luc > now() and coalesce((select nhom_goc from etp.phim p where p.content_id = n.content_id), '') <> 'au_my'
    and not exists (select 1 from etp.camp c where c.content_id = n.content_id and c.tao >= n.nhan_luc);
