# Studio 2 — studio2.on.tc

Trình dựng video kiểu timeline cho team (hai bản Gọn / Pro, bố cục widget theo loại hình video). Trang là tệp tĩnh; dữ liệu phim THẬT đọc từ studio.on.tc (apps/xuong-video) qua đường đọc `POST /api/xv/doc` mà vhost chuyển sang cổng studio — menu tên phim có ô tìm phim của studio, cạnh ba phim mẫu đóng sẵn. Với phim của studio, các BƯỚC LÀM PHIM chạy thật qua đường ghi `POST /api/xv/ghi` (sổ hàm `apps/xuong-video/src/lib/ghi-ham.ts`); riêng sửa lời / chữ / thời lượng trong Thuộc tính thì chưa lưu về studio. Ba phim mẫu vẫn là bản bấm thử.

Ghép dữ liệu studio → mô hình dự án ở `public/studio2.js › tuStudio` (bản gốc từng cảnh giữ ở `GOC`). Hàm studio đang dùng: `dsNhomTuDo` (danh sách), `docPhim`, `dsCanh` — các hàm này chỉ trả dữ liệu cho tài khoản quản trị.

Widget **Nhật ký** (bản Pro, phim thật; bật ở menu Bố cục, ở Thuộc tính › Soát, hoặc link có `&nk=<bước>`): dải bước của cảnh đang ở kim — Kịch bản · 3D · Ảnh · Clip · Giọng · Soát, mỗi bước một đèn — và các lượt sinh của bước đó (model, giờ, xong / hỏng, tiền; bấm một lượt để xem câu lệnh nguyên văn + tham số). Đọc từ `apps/xuong-video/src/lib/actions-studio2.ts` (`nhatKyTap`, `nhatKyCanh`). Đèn tính ở `studio2.js › buocCanh`.

- `public/index.html`, `public/studio2.css`, `public/studio2.js` — trang + mã trình dựng (sửa thẳng ở đây).
- `public/du-lieu.js` — dữ liệu hai phim thật (Hai chai nước ngọt: studio phim #3071 tập 3074; YNT: phim #1195 tập 1659). Dựng lại: `python3 apps/studio2/scripts/dl.py`.
- `public/v/` — ảnh, clip, lớp tách của ba phim mẫu.
- `scripts/du-lieu-goc/` — dữ liệu gốc lấy từ DB studio (`truy-van.sql`) và `lop/lop.json`.
- `scripts/lop-ynt.cjs` — tách từng lớp của cảnh YNT bằng bộ dựng `apps/xuong-video/scripts/lich-su/ban-do.html` (chạy trên iMac, 0₫).
- `deploy/studio2.on.tc.nginx` — vhost tĩnh sau SSO mos2; `deploy.sh` khối 5e3 tự cài, DNS do `deploy/dns-on-tc.sh` tạo.

**Tạo video mới + widget Quy trình (phim của studio)** — khối "LÀM VIDEO THẬT" trong `studio2.js`: nút ＋ trên thanh trên mở hộp tạo (tên, loại Short / Phim nhiều tập / Quảng cáo, ý tưởng, hoặc mẫu dựng sẵn) → `taoPhim` / `taoPhimMau` trên studio → mở phim với bố cục "Làm video mới". Widget Quy trình: phim chưa có cảnh thì ba bước Ý tưởng → Máy viết kịch bản → Máy tách thành cảnh; có cảnh thì 16 mục của studio (`quyTrinhTap`: đạt / thiếu gì / chặn vẽ ảnh, dựng clip hay xuất) kèm nút bước: thử người xem, gợi ý phong cách, đề xuất nhân vật + bối cảnh, ảnh mẫu, vẽ ảnh, duyệt, đọc lời, chốt nhịp, dựng clip, nhạc, xuất. Bước tốn tiền: bấm lần đầu hiện giá ước (`GIA_CHU`, `uocTien`, `uocAm`), bấm lần nữa mới chạy, mỗi lần một bước; studio từ chối thì câu của studio hiện ngay dưới nút. Việc đang chạy bên studio được đọc lại mỗi 7 giây (`theoDoi`). Mục nào chưa có nút thì có link "Làm ở studio ↗".

**Bố cục widget (bản Pro, màn rộng hơn 900px)** là lưới 2 chiều dựng bằng thư viện gridstack 14.1.0 (MIT, chép sẵn ở `public/lib/gridstack-14.1.0/`, không gọi CDN): nắm đầu widget kéo tới ô bất kỳ, kéo mép / góc để co giãn ngang + dọc, lưới vừa đúng một màn. Menu Bố cục chọn độ mịn lưới (6 × 4 · 12 × 8 · 24 × 16), "Luôn hiện lưới", "Xếp lại một hàng". Mép trên timeline kéo được để đổi chiều cao. Vị trí nhớ theo từng loại hình trong trình duyệt (`E.luoi`, khối "widget trên LƯỚI 2 CHIỀU" trong `studio2.js`). Bản Gọn và màn hẹp không dùng lưới.

**Bố cục đặt sẵn theo loại video** (`studio2.js › BO_CUC`, menu Bố cục có hình thu nhỏ từng bố cục): Phim nhân vật 3D · Phim ngắn / series · Quảng cáo · Tài liệu lời dẫn · Kể chuyện bằng hình · Video máy dựng · Soi từng bước sinh. Phim thật tự nhận loại ở `tuStudio` (có 3D → phim 3D; `loai = quang_cao` hoặc thể loại `qc_*` → quảng cáo; `may_dung` → máy dựng; thể loại `tai_lieu` hoặc video cả tập lời dẫn → tài liệu; còn lại → phim ngắn / series). Thể loại gốc của studio: 37 gói ở `apps/xuong-video/src/lib/xuong-video/goi-the-loai.ts`, 14 template quảng cáo ở `apps/xuong-video/mau/templates.json`, các kiểu máy dựng ở `may-dung-*.ts`. Chưa tự sắp thì mỗi loại theo bố cục đặt sẵn; tự kéo / co giãn thì nhớ riêng cho loại đó.

Link mở thẳng: phim mẫu `?phim=cn|ynt|leo&ban=gon|pro`; phim thật `?phim=<số phim>&tap=<số tập>&ban=gon|pro[&nk=kb|3d|anh|clip|giong|soat]`.
