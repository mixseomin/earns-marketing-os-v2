-- THÀNH PHỐ (mos2 tab Social › 🏙 Thành phố, anh 22/10/2026): sổ site ↔ dự án + cờ dự án ngừng hoạt động.
-- projects.website chỉ giữ MỘT site; dự án nhiều site (Bra: 8 site Shopdy) ghi ở du_an_site. Site không có dòng nào = site đứng riêng (tự là dự án).
CREATE TABLE IF NOT EXISTS du_an_site (
  site text PRIMARY KEY,                       -- host không www (vickiwear.com)
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ghi text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- dự án ngừng hoạt động: thành phố đặt cụm của nó ở rìa khu dân cư (không xoá, không ẩn ở chỗ khác)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ngung_luc timestamptz;

INSERT INTO du_an_site (site, project_id, ghi) VALUES
  ('orabra.com', 'bra', 'anh 22/10/2026'), ('vesnacharm.com', 'bra', 'anh 22/10/2026'), ('vickiwear.com', 'bra', 'anh 22/10/2026'),
  ('elliechic.com', 'bra', 'anh 22/10/2026'), ('junomuse.com', 'bra', 'anh 22/10/2026'), ('brixpant.com', 'bra', 'anh 22/10/2026'),
  ('velopant.com', 'bra', 'anh 22/10/2026'), ('litdecos.com', 'bra', 'anh 22/10/2026')
ON CONFLICT (site) DO NOTHING;
UPDATE projects SET ngung_luc = now() WHERE id = 'bra' AND ngung_luc IS NULL;   -- anh 22/10/2026: "dự án đó đang không hoạt động nữa"
