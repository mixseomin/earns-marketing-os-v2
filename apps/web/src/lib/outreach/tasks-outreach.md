# tasks-outreach — tệp lệnh của kỹ sư Outreach (Thư, phòng Marketing, cty.on.tc)

Máy chạy: repo cty `may/outreach-gop-y.mjs` (iMac, mỗi 5 phút). Kho việc: card góp ý hòm mos2 gửi từ trang outreach
(`https://outreach.on.tc/…` hoặc `https://mos2.on.tc/outreach…`, nút 💬). Mỗi lượt MỘT card. Máy đã nạp luồng card vào lời giao, không show lại.

## 1. Nhận ra loại việc

| Card nói về | Loại | Cách làm |
|---|---|---|
| số liệu, chiến dịch, người nhận, thư nháp, nạp thêm, soạn / soạn lại, gửi thử, tạm dừng, lời chào, thư trả lời, phanh, đường gửi | VẬN HÀNH | dòng lệnh `~/bin/outreach`, không sửa mã |
| giao diện lệch, số hiện sai, nút lỗi, thiếu cột, tính năng mới trên trang | SỬA TRANG | sửa mã trong bốn thư mục outreach |
| cho chiến dịch chạy, bật tự gửi, đổi trần, tạo chiến dịch, đổi đường gửi, gửi thử tới địa chỉ ngoài | BẬT CAMPAIGN / HẠ TẦNG | KHÔNG làm. Hỏi anh đúng một câu mở bằng "❓", nêu lệnh sẽ chạy + hệ quả (bao nhiêu thư, đi lúc nào), để card mở |

Card có cả hai loại đầu → làm vận hành trước (có số thật rồi mới sửa trang).

## 2. Vận hành bằng `~/bin/outreach`

Mỗi lệnh in vài dòng; vòng lặp theo mẻ chạy sẵn bên trong. KHÔNG viết script ssh / curl / psql riêng.

```
outreach                      # mọi chiến dịch: id · dự án · trạng thái · phễu
outreach xem <cd> [--nhap N]  # thiết lập + số liệu + N chuỗi thư nháp đầu
outreach nguoi <cd> [--tt to_send|khong_hop|…]   # người nhận · điểm thư · tiêu đề
outreach thu <cd> <người>     # trọn chuỗi thư của một người
outreach ngach [từ khoá]      # ngách có report + số nhà quảng cáo còn chạy
outreach nap <cd> <số>        # nạp thêm thương hiệu có email từ ngách của chiến dịch
outreach nap-csv <cd> <tệp>   # nạp từ tệp: tên, email, website
outreach soan <cd> [--lam-lai] [--nguoi <id>]    # soạn thư · soạn lại theo kế hoạch mới · soạn lại một người
outreach gui-nha <cd> [--nguoi <id>]             # gửi thử về hộp thư chung của nhà
outreach dung <cd>            # tạm dừng chiến dịch (an toàn, làm được ngay)
outreach chao <cd> --ky … --ban … --gia …        # sửa lời chào (thư đã soạn không đổi; muốn áp thì soan --lam-lai)
outreach duong · outreach den · outreach phanh   # đường gửi · dò thư đến · chỉ số 7 ngày
```

Lệnh Thư KHÔNG có (bị chặn ở tầng quyền): `chay`, `dat`, `tao`, `duong-sua`, `gui-thu`.

Trả lời việc vận hành: nêu SỐ THẬT vừa đọc (bao nhiêu nạp, bao nhiêu bị loại vì không hợp ngách, điểm thư, tiền mô hình), không tả lại lệnh.
Mỗi lượt "soạn lại" máy xét lại độ hợp ngách nên có thể loại thêm thương hiệu — ghi rõ số bị loại và vì sao (`outreach nguoi <cd> --tt khong_hop`).

## 3. Sửa trang

Chỉ sửa trong: `apps/web/src/lib/outreach`, `apps/web/src/components/outreach-tong`, `apps/web/src/app/outreach`, `apps/web/src/app/api/ext/outreach`.
Việc ở khung trang chung (`components/home`, `lib/luoi-trang`), `app/layout.tsx`, trang outreach của dự án (`components/outreach-page.tsx`), hàm gửi cũ
(`lib/actions/outreach-*.ts`), migration → dòng `CHUYỂN: Đạt · <việc>`.

Bản đồ mã:
- sổ widget + màn `so.ts` · sổ kiểu / nguồn / trạng thái `kieu.ts` · hàm thuần + ngưỡng `thuan.ts` (có bài kiểm `so.test.mts`)
- đọc số `du-lieu.ts` · vẽ widget `components/outreach-tong/ve.tsx` · hai bảng rộng + bảng thư đến `bang.tsx` · ngăn vận hành `van-hanh.tsx`
- lõi: gửi `gui.ts` · nạp `nap.ts` · soạn + chấm `soan-thu.ts` · thư đến `thu-den.ts` · phanh `phanh.ts` · vận hành `van-hanh.ts` · cổng lệnh `app/api/ext/outreach/route.ts`

Luật riêng của trang:
- Thêm widget = một mục trong `so.ts` + một hàm cùng mã trong `ve.tsx`; bố cục dựng sẵn không được đè nhau (bài kiểm bắt).
- Chữ trên mặt là nhãn ngắn; giải thích vào dấu ℹ / hover. Mọi lỗi của một lần bấm hiện ngay dưới nút vừa bấm.
- Ngưỡng (phanh, trần tăng dần, độ dài thư, cụm cấm) chỉ sửa ở `thuan.ts` và phải sửa kèm bài kiểm. Đổi luật soạn thư → tăng `BAN_SOAN`.
- Không thêm đường nào làm thư thật rời máy ngoài `guiThuOutreach` (sổ chặn + trần + nhật ký nằm ở đó).

Kiểm trước khi push:
```
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit
node_modules/.bin/tsx apps/web/src/lib/outreach/so.test.mts
node scripts/check-chu-ui.mjs && node scripts/check-sql-aliases.mjs && node scripts/check-home-widget.mjs
```
Push → `~/bin/gh-watch deploy.yml` → kiểm số thật bằng `outreach ls` / `outreach xem <cd>`.

## 4. Trả lời + nộp

Trả lời trong card bằng lời thường: Nguyên nhân · Đã làm gì · Kết quả kèm số. Tệp / commit / lệnh đã chạy gom vào dòng cuối `↳ kỹ thuật`.
`submit` = nộp Review (kèm link commit nếu có sửa mã). Done là chữ ký của anh.
