-- HÀNG ĐỢI PHIẾU LÊN CAMP (card #1931, anh 28/11/2026 "Sao phải dừng. Cấm mày ngắt mạch làm việc của tao như vậy. Phải tự cho vào hàng đợi"):
-- trước đây gửi phiếu thứ hai cho phim đang có phiếu cùng dạng chờ dựng (hoặc AD / dòng phim của phim đó đang chạy) bị TỪ CHỐI, anh phải chờ rồi gửi lại.
-- Nay phiếu nào cũng vào etp.phieu_len trạng thái 'xep' (xếp hàng), và MỘT chỗ duy nhất khởi dựng: etp.day_hang_phieu().
--   trang_thai: xep | dung | cho_duyet | len | xong | loi | bo
-- Gọi từ: etp2 guiPhieu ngay sau khi ghi phiếu · trigger khi một phiếu rời 'dung' (phiếu trước nhả chỗ) · dong-bo.py mỗi 10 phút (hang_phieu.py, thử lại khi máy dựng còn bận).
-- Một (phim, dạng) chỉ có MỘT phiếu 'dung' một lúc: cho_len.py gắn bản dựng vào phiếu 'dung' mới nhất, mau_dung mỗi phim một dòng AD.
-- Hàm chỉ khởi việc DỰNG creative (mau_dung / dong_phim) — không tạo / bật camp; camp vẫn chỉ lên khi anh duyệt bản ở Chờ lên.

create or replace function etp.day_hang_phieu() returns int language plpgsql as $f$
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
end $f$;

-- phiếu trước rời 'dung' (bản dựng vào Chờ lên / lỗi / bỏ) → đẩy ngay phiếu kế, không chờ nhịp 10 phút. Lỗi ở đây không được làm hỏng lệnh của máy dựng.
create or replace function etp.phieu_nha_cho() returns trigger language plpgsql as $f$
begin
  begin perform etp.day_hang_phieu(); exception when others then raise warning 'day_hang_phieu: %', sqlerrm; end;
  return null;
end $f$;

drop trigger if exists phieu_nha_cho on etp.phieu_len;
create trigger phieu_nha_cho after update of trang_thai on etp.phieu_len
  for each row when (old.trang_thai = 'dung' and new.trang_thai <> 'dung') execute function etp.phieu_nha_cho();
