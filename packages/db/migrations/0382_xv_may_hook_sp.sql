-- KHO HOOK LÂN CẬN (anh duyệt 31/10/2026 "mở nhóm lân cận + cào"): ngách hẹp không có QC Facebook đúng từ khoá (MilitaryCalc #1553, Giỗ Chạp #1552: 0 QC)
-- → máy mượn hook từ nhóm spy rộng hơn. hook_sp CHỈ để lấy hook (may-dung.mts --sinh-kho); góc vẫn chỉ từ goc_sp.
ALTER TABLE xv_may ADD COLUMN IF NOT EXISTS hook_sp int[] NOT NULL DEFAULT '{}';
UPDATE xv_may SET hook_sp = '{2441}' WHERE ma = 'examweight-cau-hoi';
UPDATE xv_may SET hook_sp = '{2442}' WHERE ma = 'militarycalc';
UPDATE xv_may SET hook_sp = '{2443}' WHERE ma = 'giochap-van-khan';
UPDATE xv_may SET hook_sp = '{2444}' WHERE ma = 'sidecue';
UPDATE xv_may SET hook_sp = '{2445}' WHERE ma = 'front-porch-only-one';
