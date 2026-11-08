# Astrolas — xưởng video cho team (card góp ý 1549)

Plan chốt với anh 08/11/2026 (phiên claude/astrolas-video-review-dawodz). **Chưa dựng gì.** Phiên nào làm tiếp: đọc tệp này + `gop-y.sh show 1549` trước.

## Anh đã chốt
- Team Astrolas **dùng studio.on.tc làm video cho riêng team** — video KHÔNG vào hệ thống chung: không vào `so-kenh.json › hang_cho`, playlist, `chay-so-kenh.mjs`, máy đăng @astrolasapp / Page Eyes On Stars.
- **Không cần duyệt** (không cổng team duyệt, không anh duyệt cuối, không Phòng Nội dung chấm để đăng).
- **Mở đường ý tưởng tự do, có trần tiền** (máy báo giá trước, vượt trần thì dừng trước khi chi).

## Luồng
Team đặt → máy dựng (vẫn qua máy kiểm sự thật / giọng / tiếng) → team xem → sửa nếu muốn → tải về.

## Giao diện (team = vai `operator`, chỉ thấy phim Astrolas, 2 tab)
```
┌ Astrolas · Xưởng của team ─────────────── Tháng này: 42k / ___₫┐
│  [ Đặt ]   [ Video của tôi ]                                    │
```
**Đặt**
```
│ (•) Theo mẫu   ( ) Ý tưởng tự do                                │
│ Mẫu [Chart Chapters ▾] ▶demo   Chủ đề [Serena Williams] ✓AA     │
│ Khung [9:16 ▾]   Ghi chú [...]                                  │
│ Máy kiểm ✓ đúng mẫu ✓ nguồn thật   Ước ~3.800₫   [ Làm video ]  │
│ Tự do: [ý tưởng] → máy xếp vào mẫu (0đ)                         │
│        hoặc ngoài mẫu: báo giá ~18k · còn 158k  [ Làm ]         │
│        (vượt trần → dừng trước khi chi)                         │
```
**Video của tôi**
```
│ ▶ Steve Jobs · CC  xong 10/11                                   │
│   [⬇ MP4] [⬇ Bìa] [⧉ Caption]  [↩ Sửa: ☐Hook ☐Chữ ☐Lời ☐Bìa +ghi chú]│
│ ⟳ Serena · CC      đang dựng 60%                                │
```
Team KHÔNG thấy: phim khác, timeline, keyframe, nút sinh hình/video, bảng 3D, tiền từng lượt.

## Giữ
- Luật sự thật sổ kênh (người AA, diễn giải nguyên văn site, không bịa) — video vẫn mang thương hiệu Astrolas.
- 13 mẫu đã duyệt làm khuôn (`so-kenh.json › mau`); thêm người qua `la-so/them-nguoi.mjs` (chỉ AA).
- Tập team đánh dấu `nguon = 'team'`, không lẫn số liệu / hàng chờ kênh chung.
- Luật 23: sinh tốn tiền chỉ trong trần anh đặt.

## Còn chờ anh chốt
1. Trần tiền: ___₫ / tập ngoài mẫu, ___₫ / tháng cả team; tập theo mẫu có tính vào trần tháng không.
2. Team gồm ai (email gán quyền).

## Thứ tự dựng (sau khi chốt)
1. Migration: bảng đơn đặt của team (mẫu, chủ đề, ghi chú, người đặt, trạng thái, tiền ước/thật) + trần tiền.
2. Studio: tab Đặt / Video của tôi cho `operator` trên phim Astrolas.
3. Máy dựng đơn team (dùng lại bộ viết theo mẫu của `chay-so-kenh.mjs`, KHÔNG nạp máy đăng).
4. Cổng trần tiền + máy xếp ý tưởng tự do vào mẫu.
