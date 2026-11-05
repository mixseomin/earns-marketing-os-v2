-- HÀNG CHỜ LÊN CAMP của creative chấm sạch chưa có camp — MỘT nguồn cho máy lên camp (apps/cty/worker/ethopex.mjs khối "PHIM MỚI LÊN CAMP")
-- và trang etp (Sản xuất / dòng phim). Anh 05/11/2026: ô "▶ 118h28" nhấp nháy như đang lên trong khi máy chỉ xét creative chấm < 3 ngày → không bao giờ tự lên.
-- ly_do null = máy SẼ tự lên (hang = thứ tự trong hàng, mỗi nhịp lấy 4); có ly_do = máy KHÔNG tự lên, câu nói vì sao (lời thường).
-- Sổ "lên lỗi, bỏ qua 24 giờ" chuyển từ tệp /var/lib/cty/ethopex-phim-moi-bo-qua.json vào etp.cau_hinh 'phim_moi_bo_qua' để trang đọc được.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('phim_moi_bo_qua', '{}'::jsonb,
  'creative lên camp lỗi ở khối PHIM MỚI → bỏ qua 24 giờ {creative_id: {luc, loi}} — ethopex.mjs ghi, view etp.cho_len_v đọc', 'migration 0431')
on conflict (khoa) do nothing;

create or replace view etp.cho_len_v as
with x as (
  select r.creative_id, r.content_id, coalesce(r.dang, '') dang, coalesce(r.lang, 'en') lang, coalesce(r.lo, '') lo, coalesce(r.tu, 0) tu, coalesce(r.den, 0) den, r.tu_choi,
    (select max(h.luc) from etp.cham h where h.creative_id = r.creative_id) cham_luc,
    exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu') nhan,
    exists (select 1 from etp.dong_phim d where d.content_id = r.content_id and d.trang_thai <> 'huy') co_dong,
    exists (select 1 from etp.phim_nhan_v n where n.content_id = r.content_id and n.trang_thai = 'giu' and n.nguoi_id not in (select nguoi_id from etp.tai_khoan where nha)) doi_nhan,
    exists (select 1 from etp.camp c where c.content_id = r.content_id) co_camp_phim,
    exists (select 1 from etp.camp c where c.content_id = r.content_id and c.trang_thai = 'ACTIVE') phim_chay,
    exists (select 1 from etp.camp c join etp.creative k on k.creative_id = c.creative_id where c.content_id = r.content_id and k.dang = r.dang) co_dang,
    (select (b.gia_tri->(r.creative_id::text)->>'luc')::timestamptz from etp.cau_hinh b where b.khoa = 'phim_moi_bo_qua') bq_luc,
    (select b.gia_tri->(r.creative_id::text)->>'loi' from etp.cau_hinh b where b.khoa = 'phim_moi_bo_qua') bq_loi
  from etp.creative r join etp.cham_cong g on g.creative_id = r.creative_id
  where g.duoc_len and r.content_id is not null and not exists (select 1 from etp.camp c where c.creative_id = r.creative_id)
), y as (
  select x.*, case
    when tu_choi is not null then 'creative đã bị từ chối'
    when cham_luc is null or cham_luc <= now() - interval '3 days' then 'chấm đã quá 3 ngày — máy chỉ tự lên creative chấm trong 3 ngày gần nhất'
    when co_dong and dang <> 'ảnh tĩnh' then 'phim có dòng phim tự động — dòng phim lên camp'
    when doi_nhan then 'phim người trong đội đang nhận — lên ở tài khoản người nhận'
    when co_camp_phim and not (dang in ('kể chuyện', 'ảnh tĩnh') and phim_chay and not co_dang) then case
      when dang in ('kể chuyện', 'ảnh tĩnh') and co_dang then 'phim đã có camp ' || dang
      when dang in ('kể chuyện', 'ảnh tĩnh') then 'phim không còn camp nào đang chạy'
      else 'phim đã từng có camp — máy không tự lên lại phim đã bị tắt' end
    when bq_luc > now() - interval '24 hours' then 'lần trước lên lỗi: ' || coalesce(bq_loi, 'không rõ') || ' — máy thử lại sau ' || to_char((bq_luc + interval '24 hours') at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
  end ly_do from x)
-- thứ tự = thứ tự máy lấy (phim đang NHẬN trước · kể chuyện / ảnh tĩnh làm theo lệnh · rồi chấm sớm trước)
select y.*, case when ly_do is null then (row_number() over (partition by ly_do is null order by nhan desc, (dang in ('kể chuyện', 'ảnh tĩnh')) desc, cham_luc))::int end hang from y;
