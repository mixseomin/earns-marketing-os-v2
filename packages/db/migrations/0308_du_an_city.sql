-- HÒM GÓP Ý city.on.tc (anh 23/10/2026 "cần thêm phần góp ý ở city này, tạo command tasks-city"): card góp ý của thành phố là human_tasks
-- project_id='city' (khoá ngoại tới projects) — nút 💬 trên city.on.tc gửi vào đây, /tasks-city xử (scripts/gop-y.sh GOPY_PROJECT=city).
INSERT INTO projects (id, name, emoji, mode_id, website, one_liner)
SELECT 'city', 'Thành phố (city.on.tc)', '🏙', 'content-studio', 'https://city.on.tc', 'Thành phố 3D hệ sinh thái — hòm góp ý của city.on.tc'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = 'city');
