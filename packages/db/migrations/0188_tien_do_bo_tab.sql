-- Bỏ cột `tab` (tên tab Google Sheet chiếu ra) — sheet bỏ hẳn 20/09/2026, mã không còn ghi/đọc cột này.
ALTER TABLE tien_do_hang_muc DROP COLUMN IF EXISTS tab;
