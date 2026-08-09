-- f6s: khảo sát trang thật 2026-08-09 (profile militarycalc).
--   /account/settings → đá về /main/authorization/login
--   màn đó chỉ có 2 nút: "Continue with email" và "Continue another way" (SSO nằm sau nút thứ hai)
--   bấm "Continue with email" → hiện ô placeholder="Email address" + ô password + nút "Sign in".
--   Ô email là type=text KHÔNG name/id → selector dựa name/id trượt, đó là lý do heuristic không bao
--   giờ điền được và account bị gắn nhãn 'login-failed' oan.
-- expect = /account/settings mở được mà không bị đá về login.
UPDATE platforms SET login_recipe = '{"steps":[
  {"goto":"https://www.f6s.com/account/settings"},
  {"click":"text=Continue with email"},
  {"wait":2000},
  {"fill":"input[placeholder=\"Email address\"]","value":"{{email}}"},
  {"fill":"input[type=password]","value":"{{password}}"},
  {"click":"text=Sign in"},
  {"wait":6000},
  {"goto":"https://www.f6s.com/account/settings"},
  {"expect":"text=Notification"}
]}'::jsonb WHERE key = 'f6s';
