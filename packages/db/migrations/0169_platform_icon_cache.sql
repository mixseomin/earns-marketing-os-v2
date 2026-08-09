-- Cache favicon theo platform. Trước đây UI đoán host bằng platformFaviconProps(): chỉ xử lý key
-- dạng 'abc-com' + một map cứng 12 dòng (discord/reddit/twitter…), nên saashub/uneed/f6s/webcatalog/
-- gumroad… rơi hết về glyph emoji dù DB ĐANG có URL thật của từng platform. Và mỗi lần render là một
-- request ra icons.duckduckgo.com — chậm, lộ referrer, hỏng khi họ đổi endpoint.
--
-- Giờ: resolve host từ chính cột URL của platform, tải MỘT lần, cất bytes ở đây, phục vụ qua
-- /api/platform-icon/<key> với cache-control 1 năm. Không còn map cứng để lệch.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS icon_data text;        -- base64 (không kèm prefix)
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS icon_mime text;
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS icon_fetched_at timestamptz;

COMMENT ON COLUMN platforms.icon_data IS
  'Favicon đã tải, base64. Do /api/platform-icon/<key> tự lấp đầy lần đầu. Xoá cột này = ép tải lại.';
