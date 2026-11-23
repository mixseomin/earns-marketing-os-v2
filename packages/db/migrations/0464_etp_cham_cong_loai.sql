-- CỔNG CHẤM xét luôn dấu LOẠI (anh 23/11/2026 "sửa cho triệt để"): camp 108721 / 108723 / 108725 lên từ creative giọng mở bằng "For Free" đã bị nhà loại —
-- dấu loại mất vì ghi thẳng etp.creative (dong-bo dựng lại mỗi 10 phút), mà cổng cham_cong không xét tu_choi nên mọi đường lên (nhan-ban, len-sau-cham,
-- dong_phim, mo_rong, cuu_cham…) đều cho qua. Nay duoc_len = false khi (a) creative có dấu loại (etp.creative.tu_choi, gốc xv_khoa_ngoai.ethopex_tu_choi),
-- hoặc (b) lời đọc mở bằng Free / For Free / gratis — kể cả khi người duyệt đã Đạt. Cột tat giữ nguyên (không để máy tự tắt camp đang chạy).
create or replace view etp.cham_cong as
 WITH d AS (
         SELECT c.creative_id,
            ( SELECT string_agg((e.k || ' '::text) || e.v, ', '::text ORDER BY (e.v::numeric)) AS string_agg
                   FROM jsonb_each_text(c.diem) e(k, v)
                  WHERE (e.k ~~ 'meta.%'::text OR e.k ~~ 'afs.%'::text) AND e.v::numeric <= 4::numeric AND NOT (EXISTS ( SELECT 1
                           FROM etp.tieu_chi_mien m
                          WHERE m.dang = r.dang AND m.k = e.k))) AS le4,
            ( SELECT string_agg((e.k || ' '::text) || e.v, ', '::text) AS string_agg
                   FROM jsonb_each_text(c.diem) e(k, v)
                  WHERE (e.k ~~ 'meta.%'::text OR e.k ~~ 'afs.%'::text) AND e.v::numeric = 5::numeric AND NOT (EXISTS ( SELECT 1
                           FROM etp.tieu_chi_mien m
                          WHERE m.dang = r.dang AND m.k = e.k))) AS bang5,
            u.ok AS duyet,
            ( SELECT 'chờ anh duyệt'::text ||
                        CASE
                            WHEN h.ghi <> ''::text THEN (' ('::text || h.ghi) || ')'::text
                            ELSE ''::text
                        END
                   FROM etp.cho_anh_duyet_cr h
                  WHERE h.creative_id = c.creative_id) AS giu,
            COALESCE('đã loại: '::text || r.tu_choi,
              ( SELECT 'lời đọc mở bằng Free / gratis'::text FROM etp.diem_cham dc
                 WHERE dc.creative_id = c.creative_id AND (dc.cham -> 'voice' ->> 'cau') ~* '^\s*(\[[^]]*\]\s*)*(for\s+free|free|gratis)\M' LIMIT 1)) AS loai
           FROM etp.cham c
             LEFT JOIN etp.cham_duyet u USING (creative_id)
             LEFT JOIN etp.creative r ON r.creative_id = c.creative_id
        )
 SELECT creative_id,
    ((le4 IS NULL AND duyet IS DISTINCT FROM false OR duyet IS TRUE) AND NOT (giu IS NOT NULL AND duyet IS NULL)) AND loai IS NULL AS duoc_len,
        CASE
            WHEN loai IS NOT NULL THEN loai
            WHEN duyet IS TRUE THEN NULL::text
            WHEN giu IS NOT NULL AND duyet IS NULL THEN giu
            ELSE COALESCE(le4,
            CASE
                WHEN duyet IS FALSE THEN 'người duyệt loại'::text
                ELSE NULL::text
            END)
        END AS chan_boi,
    le4 IS NOT NULL AND duyet IS NOT TRUE OR duyet IS FALSE AS tat,
        CASE
            WHEN giu IS NOT NULL AND duyet IS NULL THEN giu
            ELSE NULL::text
        END AS cho_duyet
   FROM d;
