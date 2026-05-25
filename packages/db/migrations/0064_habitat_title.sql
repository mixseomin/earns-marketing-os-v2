-- 0064: thêm habitats.title — display name của community.
--
-- Bối cảnh: 'name' lưu primary identifier ("r/astrologymemes" cho Reddit,
-- guild ID/slug cho Discord, v.v.) — bất biến, dùng làm key. Nhưng platform
-- thường có 1 "display title" riêng, dễ đọc cho con người ("Astrology Memes"
-- in sidebar). Trước đây ext không có chỗ lưu → modal MOS2 chỉ thấy slug.
--
-- Title scrape qua selector_overrides per platform, ext POST body.title.
-- Idempotent — chỉ ADD COLUMN IF NOT EXISTS.

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
