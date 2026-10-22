-- THÀNH PHỐ (city.on.tc, anh 23/10/2026 "dự án Adfond để ra rìa thành phố"): cờ đặt khu dự án ở dãy rìa (cạnh dự án ngừng) dù vẫn đang chạy.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pho_ria boolean NOT NULL DEFAULT false;
UPDATE projects SET pho_ria = true WHERE id = 'adfond';
