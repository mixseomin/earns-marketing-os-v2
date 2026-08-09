-- create_account KHÔNG được tự nhận là 'password' khi không có password nào.
--
-- Hàm này hardcode auth_method='password' cho MỌI account mới, kể cả khi p_password rỗng. Nên mọi
-- đường tạo account (UI, ext, ~/bin/browsers) đều đẻ ra một lời khai sai: vault ghi "đăng nhập bằng
-- mật khẩu" trong khi password_enc NULL. Hậu quả thật: browsers-refresh đọc nhãn đó, đi đường
-- password, không thấy credential rồi kết luận 'no-credentials' thay vì thử SSO — account uneed #149
-- bị chấm hỏng suốt trong khi nó vẫn vào được bằng Google.
--
-- Đã vá ở 2 call-site (`browsers link`, `browsers new` ghi đè ngay sau khi tạo). Vá thứ 3 sẽ là UI,
-- thứ 4 là ext — nên sửa ở nguồn. Suy từ dữ liệu thay vì đoán: có password → 'password'; không có →
-- 'manual' (người tự đăng nhập, vault không giữ credential). Caller nào biết rõ hơn (SSO, api_key)
-- vẫn ghi đè được như hiện nay.

CREATE OR REPLACE FUNCTION create_account(
  p_platform text, p_handle text, p_email text, p_password text, p_key text,
  p_project text DEFAULT NULL, p_task_id bigint DEFAULT NULL, p_type text DEFAULT 'personal',
  p_status text DEFAULT 'warming', p_owner_name text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_browser_profile_id bigint DEFAULT NULL, p_proxy_id bigint DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE v_project text; v_id bigint;
BEGIN
  v_project := COALESCE(p_project, (SELECT project_id FROM human_tasks WHERE id = p_task_id));
  INSERT INTO platform_accounts
    (tenant_id, project_id, platform_key, handle, email, status, auth_method,
     password_enc, account_type, persona_owner_name, notes, last_verified_at,
     browser_profile_id, proxy_id)
  VALUES
    ('self', v_project, p_platform, p_handle, p_email, p_status,
     CASE WHEN COALESCE(p_password,'') <> '' THEN 'password' ELSE 'manual' END,
     CASE WHEN COALESCE(p_password,'') <> '' THEN encode(pgp_sym_encrypt(p_password, p_key),'base64') END,
     COALESCE(p_type,'personal'), p_owner_name, p_notes,
     CASE WHEN p_status='active' THEN now() ELSE NULL END,
     p_browser_profile_id, p_proxy_id)
  RETURNING id INTO v_id;
  -- Bảng nối = nguồn sự thật cho project↔account. Thiếu nó = account vô hình ở vault.
  IF v_project IS NOT NULL AND EXISTS (SELECT 1 FROM projects WHERE id = v_project) THEN
    INSERT INTO project_accounts (project_id, account_id, role)
    VALUES (v_project, v_id, 'primary') ON CONFLICT DO NOTHING;
  END IF;
  IF p_task_id IS NOT NULL THEN UPDATE human_tasks SET account_id = v_id WHERE id = p_task_id; END IF;
  RETURN v_id;
END $fn$;

-- Dọn hai nhóm đang khai sai. KHÔNG đụng nhóm auth_method IS NULL mà cũng không có password:
-- NULL nghĩa là "chưa biết", đó là sự thật, không phải lời khai sai.
UPDATE platform_accounts SET auth_method = 'manual'
WHERE auth_method = 'password' AND COALESCE(password_enc,'') = '';

UPDATE platform_accounts SET auth_method = 'password'
WHERE auth_method IS NULL AND COALESCE(password_enc,'') <> '';

COMMENT ON COLUMN platform_accounts.auth_method IS
  'Cách account THỰC SỰ đăng nhập: password (vault có password_enc) | sso-google | manual (người tự gõ, vault không giữ) | api_key | linked-account. NULL = chưa biết. Không suy từ nhãn này rằng vault có credential — kiểm password_enc.';
