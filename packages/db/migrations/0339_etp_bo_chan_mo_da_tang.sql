-- BỘ LỖ = CAMP ĐÃ TĂNG NGÂN SÁCH MÀ VẪN LỖ (anh 26/10/2026: "phần lỗ của camp mới thuộc chi phí cơ hội và budget $1 nên không coi là lỗ. Chỉ khi tăng ngân sách rồi
-- mà vẫn lỗ thì mới là lỗ"). Thay bản 0338 (tính cả camp $1 → chặn nhầm bộ 2, kéo theo chặn cả phim mới): chỉ cộng ngày-camp có ngân sách > $1 (etp.so_ngay.ngan_sach).
-- nhan-ban.py chỉ dùng hàm này để chặn NHÂN BẢN / THANG (mở rộng); camp mới $1 của phim mới không bao giờ bị chặn vì lý do bộ lỗ.
CREATE OR REPLACE FUNCTION etp.bo_chan_mo(b text) RETURNS text LANGUAGE sql STABLE AS $$
  WITH x AS (SELECT sum(s.chi) chi, sum(s.thu) thu FROM etp.so_ngay s JOIN etp.camp c USING (camp_id)
             WHERE c.bo = b AND s.ngan_sach > 1 AND s.ngay BETWEEN (now() AT TIME ZONE 'utc')::date - 3 AND (now() AT TIME ZONE 'utc')::date - 1)
  SELECT CASE WHEN chi >= 50 AND thu < chi THEN format('bộ %s: camp đã tăng ngân sách vẫn lỗ 3 ngày đã khép (chi $%s, ROI %s%%) — ngừng nhân bản / thang, camp mới $1 vẫn lên', b, round(chi, 2), round((thu - chi) / chi * 100)) END FROM x
$$;
