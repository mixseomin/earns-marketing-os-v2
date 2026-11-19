# Studio 2 — studio2.on.tc

Trình dựng video kiểu timeline cho team (hai bản Gọn / Pro, bố cục widget theo loại hình video). Bản này là tệp tĩnh, mở với ba phim mẫu; các nút vẽ lại, dựng lại, xuất video mới chỉ báo, chưa gọi máy thật.

- `public/index.html`, `public/studio2.css`, `public/studio2.js` — trang + mã trình dựng (sửa thẳng ở đây).
- `public/du-lieu.js` — dữ liệu hai phim thật (Hai chai nước ngọt: studio phim #3071 tập 3074; YNT: phim #1195 tập 1659). Dựng lại: `python3 apps/studio2/scripts/dl.py`.
- `public/v/` — ảnh, clip, lớp tách của ba phim mẫu.
- `scripts/du-lieu-goc/` — dữ liệu gốc lấy từ DB studio (`truy-van.sql`) và `lop/lop.json`.
- `scripts/lop-ynt.cjs` — tách từng lớp của cảnh YNT bằng bộ dựng `apps/xuong-video/scripts/lich-su/ban-do.html` (chạy trên iMac, 0₫).
- `deploy/studio2.on.tc.nginx` — vhost tĩnh sau SSO mos2; `deploy.sh` khối 5e3 tự cài, DNS do `deploy/dns-on-tc.sh` tạo.

Link mở thẳng: `?phim=cn|ynt|leo&ban=gon|pro`.
