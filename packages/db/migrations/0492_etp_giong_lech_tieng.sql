-- CỔNG CHẤM chặn creative GIỌNG LỆCH TIẾNG PHIM (anh 27/11/2026 "Xoá và chặn hoàn toàn loại đó"): giọng nghe được trong video (etp.cham.lop.giong.ngon_ngu)
-- khác tiếng của creative / phim (etp.creative.lang) → duoc_len = false cho mọi đường lên camp, chan_boi nêu rõ hai tiếng. Số đo: CC lệch tiếng 103 camp nhà
-- ROI −60…−81%, 1/103 camp lãi; CC đúng tiếng +2% (en) / −9% (es). 248 creative cũ đã ghi dấu loại vào xv_khoa_ngoai.ethopex_tu_choi; cổng này giữ creative MỚI.
-- Phần còn lại của view giữ nguyên bản 0464.
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
                CASE
                    WHEN h.creative_id IS NOT NULL THEN 'chờ anh duyệt'::text ||
                    CASE
                        WHEN h.ghi <> ''::text THEN (' ('::text || h.ghi) || ')'::text
                        ELSE ''::text
                    END
                    ELSE NULL::text
                END AS giu,
            COALESCE('đã loại: '::text || r.tu_choi, ( SELECT 'lời đọc mở bằng Free / gratis'::text AS text
                   FROM etp.diem_cham dc
                  WHERE dc.creative_id = c.creative_id AND ((dc.cham -> 'voice'::text) ->> 'cau'::text) ~* '^\s*(\[[^]]*\]\s*)*(for\s+free|free|gratis)\M'::text
                 LIMIT 1),
              CASE WHEN NULLIF((c.lop -> 'giong'::text) ->> 'ngon_ngu'::text, ''::text) IS NOT NULL AND ((c.lop -> 'giong'::text) ->> 'ngon_ngu'::text) <> r.lang
                   THEN (('giọng lệch tiếng: video nói '::text || ((c.lop -> 'giong'::text) ->> 'ngon_ngu'::text)) || ' ≠ tiếng phim '::text) || r.lang
                   ELSE NULL::text END) AS loai
           FROM etp.cham c
             LEFT JOIN etp.cham_duyet u USING (creative_id)
             LEFT JOIN etp.creative r ON r.creative_id = c.creative_id
             LEFT JOIN etp.cho_anh_duyet_cr h ON h.creative_id = c.creative_id
        )
 SELECT creative_id,
    (le4 IS NULL AND duyet IS DISTINCT FROM false OR duyet IS TRUE) AND NOT (giu IS NOT NULL AND duyet IS NULL) AND loai IS NULL AS duoc_len,
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
