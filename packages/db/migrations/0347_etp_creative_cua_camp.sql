-- MỘT NGUỒN cho "creative thật của camp" (audit 27/10/2026): camp nhân bản qua Ethopex (★ ROAS "… duplicate by <gốc>") kho ghi creative_id = 0
-- → lấy creative của camp gốc. Trước đây biểu thức này chép tay ở apps/etp/lich-gio.py (CR_CAMP) và apps/web/src/lib/actions/etp-cham.ts.
CREATE OR REPLACE FUNCTION etp.creative_cua(p_creative int, p_ten text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(p_creative, 0), (SELECT s.creative_id FROM etp.camp s WHERE s.camp_id = substring(p_ten FROM 'duplicate by (\d+)')::int))
$$;
