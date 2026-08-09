-- CHUẨN HOÁ platform_accounts.status — 9 giá trị, và khoá bằng CHECK constraint.
--
-- Trước đó cột này là text tự do nên mỗi đường ghi đẻ một từ vựng riêng: dữ liệu có 'verified' và
-- 'closed' KHÔNG nằm trong union TypeScript → accessor rơi về fallback 'todo', UI hiển thị SAI hẳn
-- trạng thái mà không ai biết. Ngược lại 'dormant'/'defunct' có trong code mà không có trong dữ liệu.
-- CHECK constraint = chỗ duy nhất chặn được, vì có 5+ đường ghi (UI, ~/bin/browsers, create_account,
-- browsers-refresh, SQL tay).
--
-- Thêm 'pending': "đã đăng ký xong, CHỜ duyệt / chờ mail xác minh". Trước đây không có chỗ chứa nên
-- cointalk phải đội lốt 'warming' (nghĩa là ĐANG NUÔI) → job giữ phiên chấm nó thành 'login-failed'
-- và đẩy sang buổi login tay, trong khi login tay không bao giờ vào được một account chưa kích hoạt.

-- 1) Dọn giá trị lạc
UPDATE platform_accounts SET status = 'active' WHERE status = 'verified';   -- 2 google-adsense pub id
UPDATE platform_accounts SET status = 'closed' WHERE status IN ('dormant', 'defunct');

-- 2) Account đang chờ duyệt (đã đánh dấu bằng environment.pendingSince) về đúng status
UPDATE platform_accounts SET status = 'pending'
WHERE environment ? 'pendingSince' AND status IN ('warming', 'creating', 'todo');

-- 3) Bất kỳ giá trị nào ngoài danh sách → 'todo' (an toàn: 'todo' nghĩa là chưa dùng được)
UPDATE platform_accounts SET status = 'todo'
WHERE status IS NULL OR status NOT IN
  ('todo','creating','pending','warming','active','limited','blocked','banned','closed');

-- 4) Khoá từ vựng
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_status_check;
ALTER TABLE platform_accounts ADD CONSTRAINT platform_accounts_status_check
  CHECK (status IN ('todo','creating','pending','warming','active','limited','blocked','banned','closed'));

COMMENT ON COLUMN platform_accounts.status IS
  'Vòng đời account (9 giá trị, CHECK constraint): todo → creating → pending (chờ duyệt) → warming → active; limited/blocked/banned = platform hạn chế; closed = mình tự đóng. KHÔNG chứa trạng thái phiên đăng nhập — cái đó ở environment.sessionState.';
