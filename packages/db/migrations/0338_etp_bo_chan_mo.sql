-- BỘ LỖ THÌ NGỪNG MỞ CAMP MỚI (anh 26/10/2026 "làm đi", sau phân tích: bộ 2 chưa ngày nào lãi — 23/10 0%, 24/10 −9%, 25/10 −26%, lỗ ~$85/ngày, toàn camp ≤ 2 ngày tuổi).
-- Một nguồn cho nhan-ban.py (tạo camp creative mới / nhân bản / thang) và luat-ethopex.py (danh sách thang): ROI gộp 3 ngày ĐÃ KHÉP của bộ < 0 (chi ≥ $50) → trả lý do; null = được mở.
-- Tự gỡ khi 3 ngày khép gần nhất của bộ hết âm. Camp đang chạy của bộ không bị đụng (tăng / giảm / T7 vẫn theo luật riêng).
CREATE OR REPLACE FUNCTION etp.bo_chan_mo(b text) RETURNS text LANGUAGE sql STABLE AS $$
  WITH x AS (SELECT sum(s.chi) chi, sum(s.thu) thu FROM etp.so_ngay s JOIN etp.camp c USING (camp_id)
             WHERE c.bo = b AND s.ngay BETWEEN (now() AT TIME ZONE 'utc')::date - 3 AND (now() AT TIME ZONE 'utc')::date - 1)
  SELECT CASE WHEN chi >= 50 AND thu < chi THEN format('bộ %s lỗ 3 ngày đã khép (chi $%s, ROI %s%%) — tạm ngừng mở camp mới, tự gỡ khi 3 ngày gần nhất hết âm', b, round(chi, 2), round((thu - chi) / chi * 100)) END FROM x
$$;
