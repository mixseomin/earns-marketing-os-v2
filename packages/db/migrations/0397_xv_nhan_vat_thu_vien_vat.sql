-- Anchor trỏ vào THƯ VIỆN VẬT DỤNG dùng chung (scripts/du-lieu/thu-vien/vat-dung.json › ma): cây Thành phần đánh dấu 📚 + nhánh 🧰 Công năng.
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS thu_vien_vat text;
