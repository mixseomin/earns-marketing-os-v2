---
ten: Phòng Tài nguyên
thu_tu: 18
khuon: dung-san-pham
truong: Nguyên
don_vi_viec: 1 nhịp kiểm · 30 phút
cong_nguoi: gia hạn / mua / bỏ khoá proxy = mức 3 (Giám đốc); đổi làn ↔ máy = mức 2 (Tùng)
so_do: 
tom_tat: Giữ mọi tài nguyên đã trả tiền có việc làm và không chết im lặng — slot proxy, làn cào, máy chủ; chỉ báo, không tự tiêu tiền
du_an: [spy]
trang_thai: chạy một việc · Kiểm tài nguyên máy cào spy (Nguyên, mỗi 30 phút trên box3, bật 19/10/2026)
---
**Vì sao có phòng này** (anh 19/10/2026: "cần có phòng tài nguyên hay ai quản lý cái này cho tao"): một đêm 17–19/10 máy cào spy chết 2 ngày, 5/6 khoá 2proxy đã trả tiền nằm không, khoá hết hạn giữa chừng, box3 quá tải tải 5,7 / 4 nhân — tất cả đều do anh tự phát hiện, không gì tự báo.

**Làm mỗi 30 phút (box3, nhịp máy `kiem-tai-nguyen` — `apps/cty/worker/tai-nguyen.mjs`, $0, không gọi mô hình)**:
1. Đọc bảng làn ↔ máy (`may_cao_lan`, DB spy) và lần chạy gần nhất của từng làn: cào chính (Meta/Google), góc thường, góc ưu tiên, đối thủ, SpyPro.
2. Đọc hạn từng khoá 2proxy (API đơn hàng, tối đa 1 lần/giờ) và khoá đang gắn làn nào (tên biến trong `/root/.secrets/spy.env`, bảng `KHOA_LAN`).
3. Đọc tải box3, RAM trống, trình duyệt máy cào (`spy-cao-daemon`).
4. Ghi ảnh chụp `/var/lib/cty/tai-nguyen.json`; cảnh báo MỚI → Telegram chủ đề 🧰 Tài nguyên (cùng cảnh báo nhắc lại sau 6 giờ):
   làn được giao mà đứng > 2 giờ (SpyPro > 3 giờ) · khoá còn < 3 ngày · khoá trả tiền mà không làn nào dùng · box3 tải > 3,5 hoặc RAM < 1,2 GB · daemon trình duyệt tắt khi có làn giao box3.

**Cấm**: gia hạn / mua / bật auto gia hạn khoá 2proxy (anh cấm 19/10/2026 — chỉ báo, anh quyết); đổi làn ↔ máy khi trưởng phòng Kỹ thuật chưa duyệt; tự bật làn đang tắt.
