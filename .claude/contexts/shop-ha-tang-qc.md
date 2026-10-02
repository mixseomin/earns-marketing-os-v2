# Hạ tầng QC độc lập của shop MOS (mellowstep…) — quyết định + cách làm

Bối cảnh (anh chốt 02/10/2026): chạy Meta cho shop MOS **không một dấu vết** nối sang dự án khác (Shopdy / bra).
Meta gom tài khoản thành cụm qua: NGƯỜI quản trị chung, THẺ chung, PROXY / thiết bị chung, TRANG / PIXEL / BM / TK QC chung.
Mỗi shop một bộ riêng, ghi ở `/shop?tab=ha_tang` (mos2). Tiến độ hạng mục: `tiendo show S04 --du-an mellowstep`.

## Luật cứng
- **Không dùng htuan82** (tài khoản cá nhân lâu năm của anh, đang là dev ở BM Shopdy) trong bất kỳ BM / Trang / TK QC nào của shop
  độc lập: nó là điểm nối, BM bên này dính khoá kéo bên kia và ngược lại. Báo cáo / API = **System User token** trong BM của shop.
- Không dùng Judy, BM / pixel / thẻ / Trang của Shopdy. Không nhắc Shopdy khi bàn về shop độc lập.
- Thẻ: chỉ lưu nhãn + 4 số cuối (DB CHECK). Anh tự nhập thẻ trên Facebook. Mua proxy / via / BM / thẻ: anh tự mua, máy không trả tiền.

## Danh sách cần có (một bộ)
| Thứ | Số lượng | Loại / ghi chú |
|---|---|---|
| Proxy | 2 IP | Webshare **Static Residential · Dedicated** · US · tích **High IP Reputation** · trả tháng (~$4,8/IP). Không Shared/Private, không Residential xoay vòng (tính GB, IP đổi). IPRoyal mục **ISP** tương đương (~$4 + Premium 35%); không chọn "Fresh IPs every renewal", không "multi-device". Không bấm Replace IP sau khi tài khoản đã đăng nhập qua IP đó. |
| Via | 2 | US lâu năm, có 2FA, đổi được email — người cầm chính + quản trị phụ (BM 1 quản trị = mất BM khi người đó bị khoá) |
| BM | 1 (+1 dự phòng) | mua (vuavia.io) rồi gỡ người bán, hoặc tự tạo từ via đã nuôi |
| Thẻ ảo | 2 | mỗi TK QC một thẻ, chưa từng dùng cho dự án khác, địa chỉ thanh toán US khớp persona |
| Email mới | 2 | thay email người bán của via |
| Browser profile | 2 | mỗi profile gắn cố định 1 proxy, múi giờ / ngôn ngữ khớp bang của IP; không mở trên máy / mạng khác |
| Trang | 1 | tên + logo shop, 3-5 bài trước khi chạy |
| TK QC | 1-2 | USD, múi giờ Mỹ |
| Pixel + xác minh miền + CAPI | 1 | tạo trong BM của shop, gắn vào site |
| System User + token | 1 | dán vào ô Token của BM trong tab (mã hoá pgcrypto) |
| Site | — | Contact + chân trang cần địa chỉ DN + số điện thoại (02/10 còn thiếu); `/terms-of-service` 404 → chuyển hướng `/static/terms-of-service` |

Thứ tự: proxy → browser profile → via (khoá quyền, nuôi ~7-8 ngày) → BM → Trang / TK QC / thẻ → pixel + xác minh miền → chạy mồi.

## Nuôi (warmup) — lộ trình mặc định, hạn tính từ ngày bắt đầu (ngày 0)
- Via: nhận + khoá quyền (0) → hồ sơ (2) → tương tác nhẹ (5) → ổn định 7 ngày (7) → tạo / vào BM (8)
- BM: tạo / nhận (0) → đủ 2 quản trị (1) → thông tin DN + xác minh miền (2) → pixel + token hệ thống (3)
- TK QC: gắn thẻ (0) → mồi ≤ $10/ngày (3) → qua lần trừ tiền đầu (5) → thử $20-30/ngày (10) → tăng dần, 14 ngày sạch (14)
- Trang: tạo (0) → ảnh + giới thiệu + link (1) → 3-5 bài (5) → gắn BM (6)
Đây là kế hoạch, không phải số đo; đổi ở `LO_NUOI`.

## Mã
| Gì | Ở đâu |
|---|---|
| Bảng | migrations `0210` (bm, the, tk, nguoi, trang, pixel), `0211` (proxy, chi tiết thẻ), `0212` (shop_qc_nuoi — sổ mốc chỉ-thêm) |
| Luật kiểm cô lập + checklist 9 bước (thuần, có test) | `apps/web/src/lib/shop/qc-ha-tang.ts` |
| Lộ trình nuôi + tính hành trình (thuần, có test) | `apps/web/src/lib/shop/qc-nuoi.ts` |
| Đọc sổ | `apps/web/src/lib/shop/qc-doc.ts` (`docHaTang` → `BoHaTang {h, kq, ck, moc}`) |
| Ghi | `apps/web/src/lib/actions/shop.ts`: `shopQcLuu`, `shopQcToken`, `shopQcProxyMoi`, `shopQcGanThietBi`, `shopQcMoc` |
| Màn | `components/shop-ha-tang.tsx` (bộ + drawer sửa), `components/shop-nuoi.tsx` (bảng Nuôi, khuôn bảng đơn hàng) |
| Dữ liệu mẫu | shop `demo` (id 2) có bộ mẫu để xem bảng Nuôi — không xoá |
