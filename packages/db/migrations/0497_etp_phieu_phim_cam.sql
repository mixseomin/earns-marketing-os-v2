-- etp.day_hang_phieu(): soát sổ phim cấm trước khi khởi dựng (mọi dạng, không chỉ dòng phim). Thân hàm còn lại giữ nguyên 0495.
CREATE OR REPLACE FUNCTION etp.day_hang_phieu()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  p record; tc jsonb; o jsonb; ban int; ten_phim text; nhom text; so int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('etp.day_hang_phieu'));   -- hai lời gọi cùng lúc (gửi phiếu + nhịp 10 phút) không khởi trùng một phiếu
  for p in
    select distinct on (x.content_id, x.dang) x.* from etp.phieu_len x
    where x.trang_thai = 'xep' order by x.content_id, x.dang, x.id
  loop
    -- phiếu trước cùng phim + dạng còn đang dựng → chờ tiếp
    if exists (select 1 from etp.phieu_len y where y.content_id = p.content_id and y.dang = p.dang and y.trang_thai = 'dung' and y.tao > now() - interval '2 days') then continue; end if;
    -- phim trong sổ cấm (xv_khoa_ngoai ethopex_phim_cam, anh 20/11/2026 "phim cấm là ko đc bật"): không khởi dựng dạng nào — 28/11/2026 phiếu AD #44 phim 105244 xếp lại vẫn được khởi
    if coalesce((select k.gia_tri ? p.content_id::text from xv_khoa_ngoai k where k.ten = 'ethopex_phim_cam'), false) then
      update etp.phieu_len set trang_thai = 'loi', loi = 'phim trong sổ cấm (ethopex_phim_cam) — không dựng', cap_nhat = now() where id = p.id;
      continue;
    end if;
    tc := coalesce(p.tuy_chon, '{}'::jsonb);
    if p.dang = 'AD' then
      if exists (select 1 from etp.mau_dung m where m.mau = 'dt_anh_dong_logo' and m.content_id = p.content_id
                 and m.trang_thai in ('dang', 'cho', 'cho_nang_cap') and (m.tuy_chon is not null or m.trang_thai = 'dang')) then continue; end if;
      ban := greatest(1, coalesce(array_length(p.roas_ds, 1), 1));
      o := jsonb_strip_nulls(jsonb_build_object(
        'giong', case when tc ? 'giong' or tc ? 'cau' then jsonb_strip_nulls(jsonb_build_object('id', tc ->> 'cau', 'kieu', tc ->> 'giong')) end,
        'cta', case when tc ? 'cta' then jsonb_build_object('id', tc ->> 'cta') end));
      insert into etp.mau_dung (mau, content_id, buoc, trang_thai, ghi, ten_mau, tuy_chon)
        values ('dt_anh_dong_logo', p.content_id, 'cho', 'cho', 'camp đang sản xuất #' || p.id || ' — chờ máy dựng ' || ban || ' bản AD (iMac) nhận', 'Ảnh động logo gốc + CTA',
          jsonb_build_object('phieu', p.id, 'ban', ban) || case when o <> '{}'::jsonb then jsonb_build_object('o', o) else '{}'::jsonb end)
        on conflict (mau, content_id) do update set buoc = 'cho', trang_thai = 'cho', tuy_chon = excluded.tuy_chon, cap_nhat = now(), ghi = excluded.ghi
        where etp.mau_dung.trang_thai in ('loi', 'cho', 'xong', 'dung');
      if not found then continue; end if;   -- máy dựng AD đang ở trạng thái không nhận bản mới → chờ lượt sau
    else
      if exists (select 1 from etp.dong_phim d where d.content_id = p.content_id and d.loai = p.dang and d.trang_thai = 'chay') then continue; end if;
      select coalesce(f.ten, v.ten), f.nhom_goc into ten_phim, nhom
        from (select p.content_id) k left join etp.phim f using (content_id) left join etp.thu_vien_phim v using (content_id);
      if nhom is not null and nhom <> 'au_my' then
        update etp.phieu_len set trang_thai = 'loi', loi = 'phim nhóm gốc ''' || nhom || ''' — chỉ chạy phim Âu-Mỹ', cap_nhat = now() where id = p.id;
        continue;
      end if;
      insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp, bo, phieu_id) values (p.content_id, ten_phim, null, p.dang, p.ai, null, null, p.id);
    end if;
    update etp.phieu_len set trang_thai = 'dung', cap_nhat = now() where id = p.id and trang_thai = 'xep';
    so := so + 1;
  end loop;
  return so;
end $function$;
