-- DÀN MỨC ★ ROAS (anh 26/11/2026 "Tại sao các camp đều là 1.0? … Sửa từ gốc để đa dạng level ROAS"):
-- trước đây chỉ creative thuộc KHỐI (etp.ke_cr, 0476) được dàn mức; mọi đường khác (lượt 2, hồi chợ, lệnh chờ, ▶ Lên, nhan-ban mặc định) cứng hoi_cho.roas = 1.
-- Một hàm chọn mức chung cho MỌI đường: mức trong p_muc có ÍT camp ★ ROAS nhất của phim p_content trong p_ngay ngày; hoà thì theo thứ tự danh sách.
-- nhan-ban ghi etp.camp ngay lúc tạo (roas + tao) → camp kế tiếp cùng phim tự sang mức kế. Danh sách mức ở sổ luật etp-bang-luat.json › hoi_cho.muc.
create or replace function etp.muc_roas(p_content integer, p_muc numeric[], p_ngay integer default 7) returns numeric language sql stable as $$
  select u.m from unnest(p_muc) with ordinality u(m, i)
  order by (select count(*) from etp.camp c where c.content_id = p_content and c.la_roas and c.roas = u.m
              and coalesce(c.tao, c.cap_nhat) > now() - make_interval(days => p_ngay)), u.i
  limit 1
$$;
