-- THÀNH PHỐ (anh 22/10/2026): "Clane.app là gốc dự án app nói chung. Trong đó có các sản phẩm là app. Mỗi app lại có nguồn traffic vào nó."
-- Dự án gốc Clane (site clane.app + mọi *.clane.app); thành phố đưa mọi app (App Store, Microsoft Store, Google Play) vào khu này.
INSERT INTO projects (id, name, emoji, mode_id, website, one_liner)
SELECT 'clane', 'Clane', '📱', 'content-studio', 'https://clane.app', 'Gốc dự án app: mỗi app (iOS, Windows…) là một sản phẩm'
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE id = 'clane');
