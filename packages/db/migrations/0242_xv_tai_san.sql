-- Kho tài sản dùng lại của studio (10/10/2026): clip/keyframe đạt, nhạc nền, preset giọng, khuôn QC, kiểu chữ thương hiệu —
-- creative sau lấy từ kho thay vì sinh lại. Bỏ khỏi kho = đặt xoa_luc (không xoá thật).
CREATE TABLE IF NOT EXISTS xv_tai_san (
  id serial PRIMARY KEY,
  loai text NOT NULL,                       -- clip | anh | nhac | giong | khuon_qc | kieu_chu
  ten text NOT NULL DEFAULT '',
  url text,                                 -- tệp (clip/ảnh/nhạc); null với preset
  thuong_hieu text NOT NULL DEFAULT '',     -- project của phim nguồn (vd 'bra')
  san_pham text NOT NULL DEFAULT '',
  the text[] NOT NULL DEFAULT '{}',
  mo_ta text NOT NULL DEFAULT '',
  so_do jsonb NOT NULL DEFAULT '{}'::jsonb, -- dai, ti_le, keyframe_url (của clip), prompt…
  du_lieu jsonb NOT NULL DEFAULT '{}'::jsonb,
  nguon jsonb NOT NULL DEFAULT '{}'::jsonb, -- phim_id, tap_id, canh_id, job_id
  chi_phi_cents numeric(12,3) NOT NULL DEFAULT 0,
  so_lan_dung integer NOT NULL DEFAULT 0,
  xoa_luc timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS xv_tai_san_url_uq ON xv_tai_san (loai, url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS xv_tai_san_loai_idx ON xv_tai_san (loai, thuong_hieu) WHERE xoa_luc IS NULL;

-- Nhạc nền đã sinh của mọi tập vào kho (nhạc luôn dùng lại được).
INSERT INTO xv_tai_san (loai, ten, url, thuong_hieu, mo_ta, nguon, chi_phi_cents)
SELECT 'nhac', 'Nhạc · ' || p.ten || ' · tập ' || t.so, t.nhac_url, p.project, coalesce(j.request->>'prompt', t.nhac_mo_ta),
  jsonb_build_object('phim_id', p.id, 'tap_id', t.id, 'job_id', j.id), coalesce(j.chi_phi_cents, 0)
FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id
LEFT JOIN LATERAL (SELECT id, request, chi_phi_cents FROM xv_job WHERE output_url = t.nhac_url ORDER BY id DESC LIMIT 1) j ON true
WHERE t.nhac_url IS NOT NULL
ON CONFLICT DO NOTHING;
