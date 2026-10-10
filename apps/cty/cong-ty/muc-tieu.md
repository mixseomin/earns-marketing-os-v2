# Mục tiêu · ngân sách · trần chi (chốt 10/10/2026, kỳ 10/2026 → 10/2027)

> Chế độ tham quan: các con số dưới là khung đã duyệt, chưa có phòng nào hoạt động nên chưa có số thực.

## Ba chỉ số năm (mọi SOUL.md nhận 1–2 trong ba cái này)

| # | Chỉ số | Mốc | Ai đo |
|---|---|---|---|
| A | **Dòng tiền ròng tháng** = thu − chi ads − chi API − chi vendor | dương 3 tháng liên tiếp trước 03/2027 | An, mỗi tuần |
| B | **Số sản phẩm / kênh có đơn trong 30 ngày** (sách, khoá, tool, site affiliate) | tăng mỗi quý | An, từ sổ Tài sản + kenh_so_ngay |
| C | **Số tài khoản bị khoá / đình chỉ mới trong năm** | = 0 | Kiên, mỗi ngày |

C bảo vệ A và B: năm qua mất Etsy cũ và asfy_03.

## Phong bì ngân sách quý (tiền ngoài API) và trần chi API tháng

Số nằm ở `cong-ty/cau-hinh.md` (trần tổng, phong bì theo phòng) và `tran_usd_thang` trong SOUL.md từng người; hai bảng dưới dựng tự động từ đó. Phòng không có phong bì = $0 (server đã trả; chỉ API). Trong phong bì: trưởng phòng ký (mức 2). Vượt: mức 3. Khi bật: An giữ sổ phong bì, worker kiểm trước ca có tay chạm tiền (chưa dựng). Khi bật: proxy chặn 429 khi một người vượt trần hoặc cả công ty vượt trần tổng (`worker/proxy.mjs`, đã tự kiểm, chưa cài service).

## Sub

- `cty.on.tc` — trang này (sơ đồ, phòng, hồ sơ, luật); sau là portal need-to-know cho người thật / vendor.
- `vp.on.tc` — văn phòng pixel (pixel-agents), đứng sau cổng kiểm phiên của cty.
- `mos2.on.tc` — bàn của Giám đốc, như cũ.

## Đo sau 2 tuần khi bật

1. Giám đốc có đọc tin sáng không.
2. Có quyết định nào được ký mà trước đó Giám đốc không tự nghĩ ra.
3. Tiền chi API thực so với trần.
