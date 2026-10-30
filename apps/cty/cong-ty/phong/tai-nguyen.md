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

**Kho tệp R2 + máy dọn rác** (anh 31/10/2026: "bổ sung report về trạng thái R2 và chi phí phát sinh" · "cần 1 con dọn rác tự động") — cùng nhịp, `apps/cty/worker/tai-nguyen-api.mjs`, $0:
1. Mỗi giờ đọc bucket `mos2-media` qua Cloudflare GraphQL: dung lượng, số tệp, tăng/ngày (7 ngày), thao tác từ đầu tháng → ước chi phí tháng theo giá R2 (lưu $0,015/GB sau 10 GB miễn phí; lớp A/B sau hạn miễn phí; xoá + băng thông 0). Báo cáo sáng có dòng **Kho tệp R2** + dự báo 30 ngày. Cảnh báo khi ước tháng > 100.000₫ hoặc tăng > 10 GB/ngày.
2. Mỗi đêm sau 03:00 chạy máy dọn rác studio `apps/xuong-video/scripts/don-rac-r2.mts --chay` (luật `src/lib/xuong-video/don-rac.ts`): tệp trong thư mục studio được dọn (clip, keyframe, xuat, khung-xam, thu, soat…) **cũ hơn 14 ngày mà không DB nào / tệp nào trên box3 còn nhắc tới** → dời vào thùng rác `xuong-video/rac/<ngày>/`, giữ 30 ngày rồi mới xoá hẳn. Không đụng `kho/` (thư viện Ethopex), `xuong-video/may/` (máy đăng), `ethopex/`, `lora/`, `nho/`. Phanh: kho tham chiếu < 3.000 khoá (quét DB hỏng) hoặc > 70% tệp cũ là "rác" (nghi quét sót) → không dọn, báo. Tối đa 5.000 tệp/đêm. Kết quả vào báo cáo sáng; máy hỏng → cảnh báo `box3:don-rac` cho thợ máy.
3. Trả một tệp về chỗ cũ: `cd /opt/earns-marketing-os-v2/apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/don-rac-r2.mts --tra <khoá gốc>`; chạy thử (chỉ đếm): bỏ `--chay`.

## Spy - tự sửa máy cào — Mạnh (anh duyệt 24/10/2026; tên có chữ Spy để biết đây là việc spy chạy trên iMac)

Cảnh báo **máy móc** (làn cào đứng, box3 / VPS quá tải, thiếu RAM, trình duyệt tắt) không chỉ báo: Nguyên xếp vào hàng `apps/cty/worker/tho-may-viec.mjs`, Mạnh (Claude Code không giao diện **trên iMac**, `apps/cty/may/tho-may.mjs`) nhận trong ≤ 5 phút, báo "đã nhận" ngay dưới tin cảnh báo, đo · tìm gốc · sửa trong repo spy-on-tc · kiểm · deploy, rồi trả lời dưới đúng tin đó (✅ đã sửa / ⚠️ không sửa được / 🙋 cần anh quyết). Trần **6 lượt / ngày**, **30 phút / lượt**. Khoá 2proxy, tài sản hết hạn là chuyện tiền — không vào hàng thợ máy.

## Người bán ckey của spy (giao Nguyên 26/10/2026)

Mọi lượt AI của spy đi **ckey trước → fal → chính hãng luôn cuối**. Danh sách người bán ckey do việc `spy-bao-tri-ckey.timer` (box3, 6 giờ, `spy-on-tc/scripts/bao-tri-ckey.mjs`) gọi thử + xếp lại, ghi `/var/lib/spy/ckey-tuyen.json`. Nguyên canh trong nhịp `kiem-tai-nguyen`: việc đứng quá 13 giờ (thợ máy nhận) · dòng hết người bán · người bán đổi giá — **anh** bấm chấp nhận trên ckey.vn, máy không bấm · danh sách đổi. Báo cáo ngày có dòng **Spy AI hôm qua** chia ckey / fal / chính hãng; chính hãng > 10% là cảnh báo.
