# Xưởng video — studio.on.tc (apps/xuong-video)

App RIÊNG (không nằm trong mos2): Next 15, cổng 3840, `mos2-studio.service`, vhost studio.on.tc trên **box3 167.233.241.16**.
Dùng chung DB `mos2_prod` + `.env.production` + phiên SSO `mos2-session` (.on.tc). Deploy = commit + push main (GHA → deploy.sh khối 5c/5d).

- **Góp ý của anh** → card plays dự án `xuong-video` (mos2.on.tc/p/xuong-video/plays). Nhặt + xử bằng **`/tasks-studio`**
  (`ssh root@167.233.241.16 GOPY_PROJECT=xuong-video /opt/earns-marketing-os-v2/scripts/gop-y.sh list|show|claim|reply|submit`).
  Không đụng card của dự án khác; nộp Review, không tự đóng.
- Sinh ảnh chạy trên Cloudflare Worker `xv-worker` (tài khoản CF Astrolas, Workers Paid) qua queue `xv-jobs`; Worker báo về `/api/xv/xong`.
- Luật: **CẤM tự sinh video bằng AI** (hook rule 23); mọi lượt sinh tốn tiền chỉ do anh bấm. Giá chỉ ghi dạng `$`. Giờ GMT+7.
- File chính: `src/lib/actions.ts` (server actions), `src/lib/xuong-video/*` (provider, worker job), `worker/`. UI `src/components/` chia theo vai:
  `trang.tsx` (danh sách phim + drawer phim) · `kinh-thanh.tsx` (mục 0–1) · `nhan-vat.tsx` (mục 2) · `tap.tsx` (mục 3) · `canh.tsx` (thẻ shot + form) ·
  `animatic.tsx` · `timeline.tsx` · `bang-sinh.tsx` · `gop-y.tsx`. Dùng chung: `ui.tsx` (O, Nut, Seg, Menu, mono, kiểu Khoa/TabPhim) · `mo-hinh-ui.tsx` ·
  `ngan.tsx` (MỌI drawer: tieuDe/nut/dau, ghim đầu, kéo rộng) · `nho.ts` (useNho) · `dinh-ky.ts` (useDinhKy) · `vi-tri-noi.ts` (lớp nổi neo ref/điểm) ·
  `lib/luu-tru.ts` (mọi localStorage). Đừng dựng lại hàng tiêu đề drawer, try/catch localStorage hay setInterval tay — `npm run typecheck` chặn biến/import thừa.

## Clone một shot của QC mẫu cho ĐÚNG (chốt 10/10/2026, shot 1 phim #5 "Jett Husband")
Sản phẩm đúng là quan trọng nhất; text của mẫu giữ NGUYÊN VĂN (memory `feedback_co_ban_goc_giu_nguyen_text`). Từng bước, mỗi bước tốn tiền một lượt, kiểm xong mới sang bước kế (`scripts/sinh-shot.mts --canh=<id>`):
1. **Đo bản gốc, không đoán từ ảnh nhỏ**: tách khung 0,1s quanh shot (ffmpeg trên box từ `creative_tep` adfond) → hình thật, chữ màn + mốc đổi chữ, màu chữ (đọc pixel), vị trí; giọng đọc = Whisper fal trên âm thanh gốc (<$0,01) → lời nguyên văn + mốc giây, cao độ ~>165 Hz là giọng nữ. Phân tích cũ 2s/khung 360px tả sai cả người lẫn bối cảnh.
2. **Chữ màn** = nguyên văn mẫu, đổi theo giây bằng dòng `@0.55 …`; kiểu chữ ở `qc.kieu_chu` (font Montserrat trong `public/fonts`, mau/vien/nhan/co/ngang) — bản xuất vẽ bằng libass, ô xem trước vẽ cùng kiểu (`ChuManXem`).
3. **Giọng** = dòng thoại `nhan_vat: ''` (lời dẫn), `tre` = giây vào như mẫu; bản xuất tự đọc nhanh ≤1,35× nếu tràn shot. Sinh giọng TRƯỚC video (có giọng → clip câm).
4. **Sản phẩm**: biến thể màu của anchor sản phẩm có ảnh thật (`xv_bien_the` nhom 'trang_thai', anh_url) → gán vào shot; mô tả anchor phải chính xác kèm điều CẤM (vd "NOT five-pocket jeans, no coin pocket, no rivets, no fading"). Model ảnh **Nano Banana 2.1** ($0,034) — Seedream ($0,004) ra sai kiểu đồ dù có ảnh + mô tả (A/B 10/10/2026).
5. **Prompt hình** tả đúng khung mẫu (cỡ cảnh, thứ ở tiền cảnh, bối cảnh); không chữ "caption/text/badge"; `--xem` in prompt + cổng ngôn ngữ trước khi chi; keyframe mới tự được chọn.
6. **Video** Veo 3.1 Lite từ keyframe đã duyệt; xem dải khung xem sản phẩm có giữ không. **Xuất thử** `--xuat` (0đ) rồi đặt cạnh khung gốc cùng thời điểm để so.
