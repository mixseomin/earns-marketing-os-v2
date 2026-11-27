# goi-etp2 — bản ĐÓNG BĂNG mã etp2 cho apps/web

etp2 đã sang repo riêng (github.com/mixseomin/etp2 · iMac /Users/htuan/Me/GitHub/etp2) ngày 27/11/2026.
apps/web chỉ còn dùng hai thứ của etp2, qua alias trong apps/web/next.config.mjs:

- @etp2/thanh-pho — tab Thành phố của etp.on.tc (components/etp-view.tsx)
- @etp2/tong2 — widget Tổng quan 2 ở mos2 /home (components/home/etp2-o.tsx)

Thư mục này = các tệp etp-tong2-widget.tsx kéo theo, chép từ apps/etp2/src ở commit 1d22e9ee9.
Anh 27/11/2026: "etp.on.tc vẫn giữ nguyên như hiện tại và ko thay đổi gì nữa" → KHÔNG cập nhật theo etp2.
Muốn đổi Thành phố / widget /home thì sửa ở đây (có yêu cầu riêng của anh).
