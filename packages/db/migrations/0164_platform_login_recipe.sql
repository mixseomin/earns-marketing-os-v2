-- Kịch bản login của từng platform, dạng data chứ không phải code. Heuristic chung (dò nút SSO, dò ô
-- password, dò remember-me) đủ cho đa số site nhưng sai ở site lệch chuẩn; mỗi lần nới regex chung để
-- cứu một site là làm hỏng site khác. Recipe cho phép sửa ĐÚNG một site bằng một dòng JSON.
--
-- Shape: {"steps":[{...}]}. Bước hỗ trợ (xem refresh-sessions.mjs runRecipe):
--   {"goto":"<url>"}                    điều hướng
--   {"click":"<selector|text=...>"}     bấm
--   {"fill":"<selector>","value":"…"}   điền
--   {"check":"<selector>"}              tick checkbox (remember-me)
--   {"press":"Enter"}                   gõ phím
--   {"sso":"google"}                    đi đường SSO dùng Gmail quản lý của profile
--   {"wait":3000}                       chờ ms
--   {"expect":"<selector|text=...>"}    dấu hiệu ĐÃ vào được; thiếu nó coi như thất bại
-- Param thay vào lúc chạy: {{email}} {{handle}} {{password}} {{managerEmail}} — password lấy từ vault,
-- KHÔNG nằm trong recipe (recipe là config dùng chung, credential là của từng account).
--
-- NULL = chưa có recipe → runner dùng heuristic như cũ. Đừng seed đoán mò: recipe sai còn tệ hơn
-- không có, vì nó tắt heuristic đang chạy được.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS login_recipe jsonb;

COMMENT ON COLUMN platforms.login_recipe IS
  'Kịch bản login dạng data ({"steps":[…]}), param {{email}}/{{password}}/{{handle}}/{{managerEmail}}. NULL = dùng heuristic chung.';

-- Recipe đầu tiên: uneed. Khảo sát trang thật (profile militarycalc, 2026-08-09) — /login có nút SSO
-- chỉ ghi "Google" (heuristic đòi "Continue with Google" nên trượt), cộng form email/password +
-- nút "Continue". expect = link /settings, thứ chỉ có khi đã đăng nhập.
UPDATE platforms SET login_recipe = '{"steps":[
  {"goto":"https://www.uneed.best/login"},
  {"clickGoogle":"text=Google"},
  {"wait":4000},
  {"goto":"https://www.uneed.best/settings"},
  {"expect":"a[href*=\"/settings\"]"}
]}'::jsonb WHERE key = 'uneed';
