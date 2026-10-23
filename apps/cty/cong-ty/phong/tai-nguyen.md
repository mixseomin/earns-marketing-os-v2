---
ten: Phòng Tài nguyên
thu_tu: 18
khuon: dung-san-pham
truong: Nguyên
don_vi_viec: 1 nhịp kiểm · 30 phút
cong_nguoi: gia hạn / mua / bỏ khoá proxy = mức 3 (Giám đốc); đổi làn ↔ máy = mức 2 (Tùng)
so_do: 
tom_tat: Giữ mọi tài nguyên đã trả tiền có việc làm và không chết im lặng — slot proxy, làn cào, máy chủ, số dư cổng API; chỉ báo, không tự tiêu tiền
du_an: [spy]
trang_thai: chạy một việc · Kiểm tài nguyên máy cào spy + số dư cổng API (Nguyên, mỗi 30 phút trên box3; báo cáo API mỗi sáng 08:00 từ 20/10/2026)
---
**Vì sao có phòng này** (anh 19/10/2026: "cần có phòng tài nguyên hay ai quản lý cái này cho tao"): một đêm 17–19/10 máy cào spy chết 2 ngày, 5/6 khoá 2proxy đã trả tiền nằm không, khoá hết hạn giữa chừng, box3 quá tải tải 5,7 / 4 nhân — tất cả đều do anh tự phát hiện, không gì tự báo.

**Làm mỗi 30 phút (box3, nhịp máy `kiem-tai-nguyen` — `apps/cty/worker/tai-nguyen.mjs`, $0, không gọi mô hình)**:
1. Đọc bảng làn ↔ máy (`may_cao_lan`, DB spy) và lần chạy gần nhất của từng làn: cào chính (Meta/Google), góc thường, góc ưu tiên, đối thủ, SpyPro.
2. Đọc hạn từng khoá 2proxy (API đơn hàng, tối đa 1 lần/giờ) và khoá đang gắn làn nào (tên biến trong `/root/.secrets/spy.env`, bảng `KHOA_LAN`).
3. Đọc % CPU bận thật box3 + VPS (trung bình giữa hai nhịp, /proc/stat — không dùng load average), RAM trống, trình duyệt máy cào (`spy-cao-daemon`).
4. Ghi ảnh chụp `/var/lib/cty/tai-nguyen.json`; cảnh báo MỚI → Telegram chủ đề 🧰 Tài nguyên (cùng cảnh báo nhắc lại sau 6 giờ):
   làn được giao mà đứng > 2 giờ (SpyPro > 3 giờ) · khoá còn < 3 ngày · khoá trả tiền mà không làn nào dùng · box3 / VPS CPU bận ≥ 85% suốt khoảng giữa hai nhịp (kèm 3 tiến trình nặng nhất) hoặc RAM < 1,2 GB · daemon trình duyệt tắt khi có làn giao box3.

**Số dư cổng API** (anh 20/10/2026: "phòng quản lý các API này về hiện trạng như balance… báo cáo hàng ngày qua telegram") — cùng nhịp, `apps/cty/worker/tai-nguyen-api.mjs`, $0:
1. Đọc số dư thẳng từ cổng: ShopAIKey (trần − đã dùng), Kie.ai (credit), RunPod ($). ckey.vn chỉ đọc được bằng khoá TÀI KHOẢN (`ckey.vn/api/profile`, khác khoá AI) — đặt biến `CKEY_TAI_KHOAN_KEY` trong `.env.production` thì máy đọc; chưa có thì báo cáo ghi "chưa đọc được". Anthropic / Google / fal không có API số dư → chỉ báo tiền đã tiêu.
2. Cảnh báo vào 🧰 Tài nguyên: số dư dưới sàn (ShopAIKey $5 · Kie 500 credit · RunPod $2 · ckey 50.000₫) hoặc chỉ còn < 3 ngày theo mức tiêu 7 ngày (mức tiêu = số dư tụt mỗi ngày, ngày nạp tiền bỏ).
3. **Báo cáo ngày** — nhịp đầu tiên sau 08:00 giờ VN, một tin / ngày: số dư từng cổng + mức tiêu + số ngày còn đủ, và tiền studio đã tiêu hôm qua theo cổng (sổ job `xv_job`, 26.000₫ ≈ $1).
4. Tự kiểm: `node apps/cty/worker/tai-nguyen-api.mjs --tu-kiem`; xem tại chỗ (không gửi): `--in`.

**Cấm**: nạp tiền / mua credit bất kỳ cổng nào; gia hạn / mua / bật auto gia hạn khoá 2proxy (anh cấm 19/10/2026 — chỉ báo, anh quyết); đổi làn ↔ máy khi trưởng phòng Kỹ thuật chưa duyệt; tự bật làn đang tắt.

## Thợ máy — Mạnh (anh duyệt 24/10/2026)

Cảnh báo **máy móc** (làn cào đứng, box3 / VPS quá tải, thiếu RAM, trình duyệt tắt) không chỉ báo: Nguyên xếp vào hàng `apps/cty/worker/tho-may-viec.mjs`, Mạnh (Claude Code không giao diện **trên iMac**, `apps/cty/may/tho-may.mjs`) nhận trong ≤ 5 phút, báo "đã nhận" ngay dưới tin cảnh báo, đo · tìm gốc · sửa trong repo spy-on-tc · kiểm · deploy, rồi trả lời dưới đúng tin đó (✅ đã sửa / ⚠️ không sửa được / 🙋 cần anh quyết). Trần **6 lượt / ngày**, **30 phút / lượt**. Khoá 2proxy, tài sản hết hạn là chuyện tiền — không vào hàng thợ máy.
