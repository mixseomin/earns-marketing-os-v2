# CHUẨN NÚT GÓP Ý 💬 — một chỗ cho mọi nơi dùng

Anh Tuấn 17/11/2026: "Chuẩn hoá toàn bộ phần gopy để áp dụng cho mọi nơi dùng nó !!"

Bản gốc: gói `@mos2/gop-y` (`src/client.tsx` giao diện, `src/server.ts` máy chủ, `src/dem.ts` phần đếm dùng chung).
Mọi app trong monorepo dùng nút góp ý PHẢI đi qua gói này: app chỉ giữ một tệp `'use server'` mỏng (người đăng nhập + R2 + mã hòm)
và một tệp giao diện gọi `<HomGopY …/>` (khung ngăn kéo, class nút, vị trí nút). Không chép tay nút, không viết API góp ý riêng.
Hai bản ngoài monorepo (khác nền, chép theo chuẩn này): spy-on-tc `web/gop-y.js` + `web/app.css` (Hiếu), Astrolas
`resources/views/v2/layouts/partials/_report_button.blade.php` (Thành).

Máy canh trôi: `node apps/cty/scripts/kiem-chuan-gop-y.mjs` (so ba bản; chạy trong `tu-kiem.mjs` cty, GHA chặn khi gốc thiếu chuẩn hoặc một bản lệch).

## 1. Hành vi bắt buộc của nút

| # | Hành vi | Chi tiết |
|---|---|---|
| 1 | **Sáng nhấp nhô khi AI đang làm** | (anh 25/11/2026, thay kiểu rung cũ `gy-rung`) Có việc của hòm đang được kỹ sư AI làm → nút mang class `gy-dang-lam`: viền + chữ `#22d3ee`, quầng sáng nhấp nhô theo keyframes `gy-sang` (`1.6s ease-in-out infinite`). Kiểu nằm MỘT chỗ: `src/nut.ts` `GY_NUT_CSS` — hòm React và script trang tĩnh cùng dùng, bản ngoài monorepo chép đúng từng ký tự (máy so). Giảm chuyển động (`prefers-reduced-motion`) → quầng đứng yên. Tooltip: `AI đang làm: <tiêu đề việc>`. |
| 1b | **Chấm tròn đỏ khi có việc kẹt** | (anh 25/11/2026) Hòm có card kẹt — `broken`, hoặc `claimed` quá trần phiên 45 phút (không phiên nào chạy) → chấm tròn đỏ `gy-cham-do` (12px) ở góc phải-trên nút. Đếm `ket` / `ketDs` trong `demGopY` (cả hòm, như `working`). Tooltip: `🔴 N việc kẹt: #id tiêu đề · …`. |
| 2 | **Số đỏ chờ ý kiến** | Số đỏ `gy-so-do` ở góc trái-trên = số card CỦA CHÍNH người đang xem đang chờ họ: CHỈ khi tin cuối của kỹ sư là CÂU HỎI cho người báo — kỹ sư mở tin bằng `❓` — và chưa ai đáp. Tin máy tự ghi (`[Khôi · …]`, `[máy] …`) hay tin báo kết quả không có `❓` không tính (card kẹt đi chấm đỏ mục 1b, không vào số này). Người khác không thấy số này. Tooltip: `N góp ý đang chờ ý kiến của bạn`. Trong tab Của tôi, card đó mang nhãn đỏ `chờ bạn`. |
| 2b | **Trang tĩnh cũng vậy** | Trang không chạy React (castle, worlds, studio2, ngatu, dantranh…) nạp `https://mos2.on.tc/api/gop-y-ngoai/nut`: hòm trong iframe ẩn đếm số rồi gửi `postMessage({loai:'gop-y:dem', working, ket, can_y_kien, tieuDe})`; script tô sáng / chấm đỏ / số đỏ lên MỌI phần tử `[data-gop-y-mo]` hoặc `[data-gop-y-nut]` (nút mở qua menu riêng như castle `gopy.js` mang `data-gop-y-nut`). Không trang nào tự viết kiểu nút. |
| 3 | **Tự làm mới 60 giây** | Nạp số 60 giây một lần CHỈ khi tab đang hiện (`document.visibilityState === 'visible'`), nạp lại ngay khi quay về tab (`visibilitychange`), và ngay sau khi người dùng gửi / trả lời trong hòm. Mạng chập → giữ số cũ. |
| 4 | **Tab Gửi góp ý** | Loại (Báo lỗi / Câu hỏi) · mô tả · ảnh. Nháp + ảnh sống qua F5 (localStorage theo `khoa` của app). |
| 5 | **Ảnh dán** | Chụp trang · Ctrl+V ở BẤT KỲ ô nào trong hòm · bấm Paste · kéo thả · chọn file · URL. Ảnh thu nhỏ ở trình duyệt (cạnh dài ≤ 2000px, ≤ 950KB) trước khi tải; mỗi ảnh một dòng trạng thái (nén → tải → xong / lỗi đỏ). |
| 6 | **Ngữ cảnh trang** | Tự gom lúc gửi: URL trang (hòm nhúng: `window.__trangGopY`), tiêu đề màn, tab đang chọn, `[data-ngu-canh]`, ngăn kéo đang mở, lỗi đang hiện trên màn, 5 lỗi JS gần nhất, thiết bị + khổ màn, trạng thái riêng `window.__nguCanhTrang`. Người gửi xem được trước khi gửi. |
| 7 | **Tab Của tôi / Hỏi đáp** | Card mình gửi còn mở + card đóng trong 7 ngày; chip lọc trạng thái + ô tìm; mở card xem cả luồng ngay tại chỗ (không mở tab mới). Hỏi đáp = riêng các card loại Câu hỏi. |
| 8 | **Làm lại / Duyệt xong** | Trong luồng: `💬 Trả lời` (thêm tin) · `↩ Làm lại` (phải ghi chỗ chưa đạt; card về Chờ xử, hẹn hôm nay) · `✓ Duyệt xong` (admin, không bắt gõ chữ; card Xong). Kỹ sư chỉ nộp Review, Done là chữ ký người duyệt. |
| 9 | **Lỗi kêu to** | Gửi / trả lời hỏng → dòng đỏ ngay dưới nút, kèm cách xử ("bấm ↻ Tải lại rồi gửi lại; nháp vẫn giữ"). |

## 2. Máy chủ phải trả

Gói (`@mos2/gop-y/server`):

- `guiGopY · dsGopYCuaToi · docTraoDoi · guiTraoDoi · taiAnh` — card `human_tasks` project = mã hòm, `prep_payload.source_platform='feedback'`,
  luồng ở `prep_payload.trao_doi`, trạng thái ở `prep_payload.site_status[<hòm>]`.
- `dsGopYCuaToi` trả thêm `choYKien: boolean` từng card (luật ở `dem.ts` `choToi`).
- `demGopY(duAn, me)` → **`{ working, dangLam, can_y_kien, choYKien, ket, ketDs, treo, kySu }`**:
  - `ket` / `ketDs` = card kẹt của hòm: `broken` + `claimed` quá trần 45 phút (`treo`) → chấm đỏ.
  - `working` = số card của hòm đang `claimed` còn trong trần phiên (45 phút từ `updated_at`), cộng lượt kỹ sư CLI phụ trách hòm đang chạy:
    dòng cuối nhật ký nhịp `<CTY_DATA_DIR>/nhip/<người>.json` là `▶ bắt đầu …`, đã chạy ≥ 15 giây và chưa quá 45 phút
    (bộ điều phối iMac đẩy dòng này về box3). Ánh xạ hòm → người: `cty→khoi · mos2→dat · xuong-video→vinh · spy→hieu` (`dem.ts KY_SU_HOM`).
    Đọc `<người>.jsonl` (`dem.ts viecTuNhatKy`): sau `▶` có dòng `◆ nhận card #N: …` / `◆ nhận việc giao: …` (kỹ sư tự đẩy) thì việc = dòng ◆ mới nhất;
    việc giao thẳng (ngoài hòm) được cộng thêm cả khi đang có card claimed. Chưa có `.jsonl` → dòng cuối `<người>.json`.
  - `dangLam` = tiêu đề các việc đó: tooltip nút + **dải đầu hòm** (trên nội dung mọi tab, luôn hiện) "🔧 AI đang làm: …" / "AI đang rảnh", nạp cùng nhịp 60 giây.
  - `treo` = card còn claimed mà quá trần (không phiên nào chạy): có thì dải ghi "⚠ N việc ghi Đang làm nhưng không phiên nào chạy: #id … (2 giờ)" — **cấm nói "rảnh" khi tab Đang làm còn card** (#1746).
  - `can_y_kien` = số card của chính `me` có `choYKien`; `choYKien` = id các card đó.

Bản ngoài (spy / Astrolas) trả cùng tên khoá trong `counts`: `counts.working`, `counts.ket`, `counts.can_y_kien`.

App nối vào giao diện: thêm `demGopY` vào bộ hành động `hd` (vd `apps/cty/src/lib/gop-y.ts`). App chưa nối → nút tự đếm từ `dsGopYCuaToi`
(`dem.ts demTuDs`: sáng theo card claimed của chính mình, chấm đỏ theo `broken` / quá trần, số đỏ theo `choYKien`) — chạy được nhưng không thấy lượt kỹ sư CLI.

## 3. Tình trạng (25/11/2026)

| Nơi | Theo chuẩn |
|---|---|
| cty.on.tc (`apps/cty`) | đủ: gói + `demGopY` (thấy cả lượt Khôi đang chạy) |
| studio.on.tc (`apps/xuong-video`) | đủ: gói + `demGopY` (`src/lib/gop-y.ts`, thấy cả lượt Vinh đang chạy) |
| mos2.on.tc / city (`apps/web`), etp2 (`apps/etp2`) | đủ: gói giao diện + máy chủ gói (`lib/actions/gop-y-mos2.ts` chỉ gắn người / hòm / lọc nguồn; etp2 thêm việc Huy đang làm, phần kẹt gọi `demTuDs` của gói) |
| castle.on.tc, worlds.on.tc (`apps/castle/public/gopy.js`, `data-gop-y-nut`) · studio2 · ngatu · dantranh (`data-gop-y-mo`) | trang tĩnh: script `/api/gop-y-ngoai/nut` tô sáng / chấm đỏ / số đỏ theo số hòm iframe gửi (25/11/2026) |
| spy (Hiếu) | bản chép JS thuần (spy-on-tc 182bf06): sáng `gy-sang` + chấm đỏ kẹt + số đỏ, máy so khớp gốc |
| Astrolas (Thành) | bản chép blade (ai 4847ea59c, đã gộp ai-pro 25/11): sáng `gy-sang` + chấm đỏ `counts.ket` + số đỏ, máy so khớp gốc |
