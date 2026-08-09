-- 1) LỊCH SỬ PASSWORD. Đổi password mà không giữ cái cũ là mất đường lùi: reset trượt giữa chừng,
--    hoặc site không nhận password mới, thì cái cũ là thứ duy nhất còn vào được. Enforce bằng TRIGGER
--    chứ không nhờ từng chỗ ghi nhớ gọi — UI, ~/bin/browsers, browsers-setpass, browsers-refresh đều
--    ghi vào cột này; luật nằm ở tầng bảng thì không đường nào lách được.
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS password_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN platform_accounts.password_history IS
  'Mọi password_enc CŨ, mới nhất ở cuối: [{enc, replacedAt}]. Trigger tự đẩy vào, đừng ghi tay.';

CREATE OR REPLACE FUNCTION archive_password_on_change() RETURNS trigger AS $$
BEGIN
  IF NEW.password_enc IS DISTINCT FROM OLD.password_enc
     AND OLD.password_enc IS NOT NULL AND OLD.password_enc <> '' THEN
    NEW.password_history := COALESCE(OLD.password_history, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('enc', OLD.password_enc, 'replacedAt', now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_archive_password ON platform_accounts;
CREATE TRIGGER trg_archive_password BEFORE UPDATE ON platform_accounts
  FOR EACH ROW EXECUTE FUNCTION archive_password_on_change();

-- 2) KỊCH BẢN RESET PASSWORD, cùng shape với login_recipe (xem 0164) + 2 bước riêng:
--      {"gmailLink":"<từ khoá tìm trong Gmail>"}  mở mail.google.com trong CÙNG profile, tìm mail mới
--                                                 nhất khớp, bấm link reset đầu tiên
--      {"fill":"…","value":"{{newPassword}}"}     password mới do runner sinh
--    NULL = không tự reset. Chỉ chạy khi vault ĐANG giữ password cho account đó (nghĩa là password
--    này do mình quản lý); account chưa từng lưu password thì password có thể do người khác/nơi khác
--    đổi — tự reset là cướp quyền của họ.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS password_reset_recipe jsonb;

COMMENT ON COLUMN platforms.password_reset_recipe IS
  'Kịch bản reset password ({"steps":[…]}), thêm {{newPassword}} + bước gmailLink. NULL = không tự reset.';
