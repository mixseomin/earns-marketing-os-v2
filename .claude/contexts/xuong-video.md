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

## Chuẩn làm video (chốt 13/10/2026 — "đây là chuẩn bị quan trọng cho mọi video")
Thứ tự máy ép, không ai phải nhớ:
1. **Viết kịch bản / tách cảnh** đã kèm `LUAT_KE_CHUYEN` (claude.ts, trong `heThong`): phim tự kể đủ (gài → trả), 5s đầu biết ai muốn gì, khoảnh khắc chính không câm, nhân vật mới phải giới thiệu, ~2,5 từ/giây + 0,5s thở. Sửa "skill làm video" = sửa khối này.
2. **🧑 Kiểm người xem có hiểu không** (`nguoi-xem.ts` + `claude.ts › thuNguoiXem`, nút trong tab Kịch bản): Claude chỉ thấy THẤY/CHỮ/NGHE từng shot, kể lại, chấm hiểu; lượt 2 so với logline/brief. Đạt = hiểu ≥7/10 + đúng ý. Lưu `xv_tap.thu_nguoi_xem` kèm mã phiên bản kịch bản → sửa chữ/lời/hành động là phải thử lại. **Chặn sinh keyframe + chặn xuất** (`chanTienKy`, `xuatTap`).
3. **Chấm cấu trúc** (`cham-kich-ban.ts`, series): 5 nhịp, hook = lúc câu/chữ móc tới người xem ≤3s, lật ngược 55–92%.
4. **Giọng trước video**; giọng về → tự khớp giây shot (`hoanTatAm › khopSauGiong`) + nhân vật chưa có giọng được gán giọng riêng (`giong-rieng.ts`).
5. **Máy kiểm tiếng** (`khop-giong.ts › kiemTieng`): câu bị cắt khi sang shot, đè nhau, đọc >1,15×, shot có thoại <2s → thanh 🎬 + chặn xuất.
6. **"Sinh nháp" một lần bấm**: tự duyệt keyframe đang chọn, thiếu giọng thì sinh giọng rồi tự gửi video. Phong cách vẽ tay → negative prompt cấm bàn tay/dụng cụ vẽ.
8. **Nhịp hình** (`nhip-hinh.ts`): shot liền nhau trùng cỡ cảnh + chuyển động máy, >40% shot máy đứng yên → chặn keyframe (mục Shot list trong thanh 🎬), sửa 0đ bằng 🎥 Đa dạng chuyển động máy (`hau-ky.ts › daDangMayTapDb`). Luật kể chuyện số 9 bắt mỗi shot một hành động thân thể lớn; prompt video có câu "khung hình sống" (trừ QC chép mẫu).
7. **Lồng tiếng Việt** (`ban-dich.ts` thuần + `long-tieng.ts`, nút 🇻🇳 tab Xuất): dịch (nhớ theo nội dung trên R2) → đọc lại từng câu bằng giọng của bản gốc (`giongDong`; file khoá theo nội dung, dùng lại) → MP4 + track M4A. Một bản cho hai việc: người chỉ biết tiếng Việt xem hộ + track tiếng phụ trên YouTube. Bản dịch lưu vào shot (`xv_canh.chu_man_dich`, `thoai[i].dich`, kèm câu gốc lúc dịch — lệch = cũ, im) → timeline/toàn màn hình xem bằng nút Tiếng: Gốc | 🇻🇳 (`?tln=vi`), bản xuất đọc cùng hàm `theoNgonNgu`. Danh sách "Đã xuất" chỉ hiện bản mới nhất mỗi ngôn ngữ (`banHien`). Chữ màn phim chưa chọn kiểu → băng nền tối (`gopKieu`, một hàm cho xuất + xem trước).
Script box (0đ trừ khi ghi): `kiem-cong-shot.mts <tap>` · `long-tieng-vi.mts <tap> [--khong-dich]` (cổng từng shot + kiểm tiếng) · `khop-giong.mts <tap>` · `sinh-giong-tap.mts` (TỐN TIỀN) · `sinh-anh-phim.mts --phim=N --xuat --thieu-nhac` (bản xem cả phim từ keyframe).

## Keyframe từ bản 3D — bài học + máy chặn (15/10/2026, cảnh 7 Tango & Lint tập 19)
Khung màu 3D là ẢNH SỐ 1 của keyframe: model vẽ theo nó hơn theo chữ. Cái gì 3D sai / thiếu thì keyframe sai theo — sửa ở 3D, không sửa chữ.
- **Vật mỗi shot một kiểu** (thẻ cam lúc nhựa phẳng lúc ví da): mô tả anchor nước đôi ("card / card holder") + 3D khối trơn không mang dáng anchor. Máy chặn: `quy-trinh.ts › moTaNuocDoi` (thieuMau chặn keyframe); nhãn khối gọi đạo cụ bằng mô tả anchor (`sinh-anh.ts › goiVat` → `moTaThay(thay, enCua)`); đạo cụ khung 3D thấy mà shot không gắn anchor được tự kèm ảnh mẫu (`doc-db.ts › boiCanhCanh`). Dựng 3D vật thì cho nó dáng / màu / `en` theo ẢNH MẪU anchor.
- **Trạng thái vật mất** (kẹo đã bẻ đôi mà keyframe vẽ nguyên): 3D chỉ có dáng gốc. Khai `vi_tri.chia` → Blender dựng từng mảnh + nhãn `[split …]`; `lienMachTap` chặn shot nào để vật "lành" lại; `mayDayDu` mang trạng thái theo món để lại.
- **Máy 3D lệch góc khai** (7.1a khai ngang mà bộ giải đẩy lên cao 59° → keyframe bỏ khung 3D, mất cú quay đầu): `bo-set-3d.ts › gocMayLech` trong chanKhungXam. Bộ giải tự động chỉ được dời máy trong dải góc khai; cú nhìn cần máy ngang tầm thì đặt tay.
- **Khoảnh khắc chính rơi giữa hai keyframe** (7.6a "after a high-five" → không có cú đập tay): `ho-so.ts › KET_SAU_KHI` — khung kết chụp ĐỈNH hành động, không chụp "sau khi".
- **Bộ dựng set đọc–ghi chính tango-ban.json**: bỏ một dòng code KHÔNG gỡ được giá trị đã ghi (ghim máy 5.3) — gỡ phải xoá tường minh; đoạn tự thêm vật phải gỡ đúng mọi món nó thêm (đã đẻ 16 khung cửa sổ). Nạp set từ chối vật trùng tên.
- **Chủ thể cú cận chỉ là một mẩu** (#32: Tango đứng che phích, phích 3% ở mép phải — cổng chỉ hỏi "có trong khung"): `bo-set-3d.ts › chuTheQuaNho` — cỡ cu/ecu/insert/mcu mỗi vật `may_3d.khung` ≥ 5% và không chạm mép. Cú TÁC ĐỘNG lên vật (vi_tri.lam) sau cú POV: đặt máy GÓC NGƯỢC (sau vật nhìn về mặt nhân vật, khai qua_truc) — máy sau lưng nhân vật thì nhân vật che vật.
- **Phần của vật / vật ngoài khung** (#32: cửa sổ thẻ 34% mà ví da 0.7% → không kèm ảnh mẫu ví; ảnh mẫu USB Hub đi kèm dù hub ngoài khung → Tango đứng trên hub): vật set khai `anchor` = phần của anchor đó (`doc-db.ts › anchorCua`, cộng % theo anchor, nhãn "…, part of <mô tả anchor>"); đạo cụ < `PT_THAY` trong khung không gửi ảnh mẫu. Một ngưỡng `PT_THAY` cho nhãn / tự kèm / lọc.
- Sinh lại sau khi sửa: dựng 3D (`bo-set/chay-imac.sh <tap>`, 0đ) → `kiem-cong-shot.mts` → chỉ sinh shot dính lỗi (`sinh-shot.mts --keyframe` rồi `--keyframe-ket`) → soi bảng 3D ↔ keyframe từng shot trước khi sang video.
