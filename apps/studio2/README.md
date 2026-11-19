# Studio 2 — studio2.on.tc

Trình dựng video kiểu timeline cho team (hai bản Gọn / Pro, bố cục widget theo loại hình video). Trang là tệp tĩnh; dữ liệu phim THẬT đọc từ studio.on.tc (apps/xuong-video) qua đường đọc `POST /api/xv/doc` mà vhost chuyển sang cổng studio — menu tên phim có ô tìm phim của studio, cạnh ba phim mẫu đóng sẵn. Mới chỉ ĐỌC: sửa ở đây chưa lưu về studio; các nút vẽ lại, dựng lại, xuất video mới chỉ báo, chưa gọi máy thật.

Ghép dữ liệu studio → mô hình dự án ở `public/studio2.js › tuStudio` (bản gốc từng cảnh giữ ở `GOC`). Hàm studio đang dùng: `dsNhomTuDo` (danh sách), `docPhim`, `dsCanh` — các hàm này chỉ trả dữ liệu cho tài khoản quản trị.

- `public/index.html`, `public/studio2.css`, `public/studio2.js` — trang + mã trình dựng (sửa thẳng ở đây).
- `public/du-lieu.js` — dữ liệu hai phim thật (Hai chai nước ngọt: studio phim #3071 tập 3074; YNT: phim #1195 tập 1659). Dựng lại: `python3 apps/studio2/scripts/dl.py`.
- `public/v/` — ảnh, clip, lớp tách của ba phim mẫu.
- `scripts/du-lieu-goc/` — dữ liệu gốc lấy từ DB studio (`truy-van.sql`) và `lop/lop.json`.
- `scripts/lop-ynt.cjs` — tách từng lớp của cảnh YNT bằng bộ dựng `apps/xuong-video/scripts/lich-su/ban-do.html` (chạy trên iMac, 0₫).
- `deploy/studio2.on.tc.nginx` — vhost tĩnh sau SSO mos2; `deploy.sh` khối 5e3 tự cài, DNS do `deploy/dns-on-tc.sh` tạo.

Link mở thẳng: phim mẫu `?phim=cn|ynt|leo&ban=gon|pro`; phim thật `?phim=<số phim>&tap=<số tập>&ban=gon|pro`.
