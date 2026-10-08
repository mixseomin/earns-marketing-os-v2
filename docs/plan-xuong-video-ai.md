# Xưởng video AI — kịch bản → storyboard → node → timeline (PLAN, 08/10/2026)

Trạng thái: **anh đã chốt 08/10/2026** (mục 7 ghi quyết định). G1 đã lên mos2 cùng ngày: `/p/<project>/xuong-video`.

## 1. Vì sao cần

Hiện có ba công cụ, mỗi cái thiếu một mảnh:

| Công cụ | Có | Thiếu |
|---|---|---|
| SpyPro Studio (app.spypro.ai/studio) | Node canvas (React Flow): Source → gen.image (nano_banana, imagen4) → gen.video (Veo 3.1: text / start image / start+end / components) → Output; template; inspector prompt/model/aspect; Variants library | Không có kịch bản, không có storyboard, không có timeline. Mỗi flow = 1 clip. |
| TTM Studio (ảnh 1) | Hàng chờ 38 cảnh, mỗi cảnh = prompt góc máy + Veo 3.1 lite, trạng thái, tải về | Sinh video thẳng từ chữ, không có keyframe ảnh để duyệt trước khi tốn tiền; không nối cảnh với nhau; không ghép. |
| TTM Music (ảnh 2) | Timeline dựng nhiều track, hiệu ứng, màu, xuất | Không biết gì về cảnh/kịch bản; nhận file rời, ghép tay. |

Tool mình dựng = **một tài liệu, ba cách nhìn**: cùng một mảng `shots[]` hiện ra là bảng storyboard, là node canvas, là timeline. Đây là pattern của Nomi và DramaClaw (open source, xem mục 2); không tool SaaS nào gộp đủ ba lớp.

## 2. Đã học gì từ ngoài (khảo sát 08/10/2026)

- **Làm đủ 3 lớp, mã mở**: Toonflow (16.7k sao, MIT, Vue), Nomi (AGPL, React/Electron, 24 MCP tool), DramaClaw (6.8k sao, Elastic, Python+React; canvas tự do và wizard tuyến tính trên cùng dữ liệu), ai-video-production-editor (GPL). Đọc mã Nomi + flowboard (React Flow 12 + Zustand, MIT) là đủ để bắt đầu.
- **SaaS storyboard-first**: LTX Studio (chuẩn UX: dán kịch bản → tự tách shot → keyframe → retake từng shot → timeline), Katalist, Dreamina Octo, Google Flow Scenebuilder. Không có node.
- **SaaS node thuần**: Figma Weave, Flora, Krea Nodes, Freepik Spaces, Runway Workflows, ImagineArt (palette video đủ nhất: trim, combine, extend, lipsync). Không có storyboard/timeline nối với graph.
- **Cách nối node với timeline**: Scenario Video Studio và ComfyUI-Montagen coi **timeline là một node sink** nhận list clip. Mình dùng đúng cách này.
- **Pattern chép**: (1) anchor nhân vật/sản phẩm/bối cảnh/phong cách là asset có id, shot tham chiếu `@ten`; (2) **gate keyframe**: duyệt ảnh tĩnh trước khi sinh video, ước giá trên nút; (3) ưu tiên Extend / first-last-frame chaining thay vì sinh lại; (4) model hoán đổi qua slot, engine chạy ở server, React Flow chỉ là UI; (5) node tô màu theo kiểu dữ liệu (chữ / ảnh / video / âm thanh); (6) MCP để Claude lấp shot theo kịch bản, người chỉ sửa trên canvas.

## 3. Mô hình dữ liệu (một nguồn)

```
video_projects        id, project_id (mos2), ten, kich_ban (text), trang_thai, tong_chi_phi
video_anchors         id, vp_id, loai (nhan_vat|san_pham|boi_canh|phong_cach), ten, mo_ta, anh_ref[]
video_shots           id, vp_id, thu_tu, canh, goc_may, hanh_dong, loi_thoai, thoi_luong_s,
                      anchors[] (id), keyframe_node_id, video_node_id, trang_thai
video_graph           vp_id, doc jsonb  -- {nodes[], edges[], viewport} đúng khuôn React Flow,
                                        -- node.data = {label, model, prompt, aspect, refs, runtime{status,outputUrl,taskId,cost}}
video_timeline        vp_id, doc jsonb  -- {tracks:[{kind:video|audio|text, clips:[{shot_id|asset_url, in, out, start}]}]}
video_jobs            id, node_id, provider, model, request jsonb, status, output_url, cost, error
```

Quy tắc: **shot là xương sống**. Tạo shot thì tự sinh cặp node `gen.image(keyframe) → gen.video` trên canvas và một clip trống trên timeline; xoá shot thì xoá cả ba. Node thêm tay ngoài shot (biến thể, upscale, ghép) vẫn được, nhưng chỉ shot mới có chỗ trên timeline.

## 4. Palette node (phiên bản 1)

| Nhóm | Node | Vào → Ra |
|---|---|---|
| Nguồn | `source.text` (kịch bản), `source.image` (ảnh sản phẩm / ảnh tham chiếu), `source.anchor` | → text / image |
| Sinh chữ | `gen.shots` (LLM Claude: kịch bản + anchors → `shots[]` JSON) | text → shots |
| Sinh ảnh | `gen.image` (Gemini nano banana / Imagen; refs nhiều ảnh) | text + image[] → image |
| Sinh video | `gen.video` (Veo 3.1 qua Google API; Kling/Seedance qua fal.ai) — mode: text / start image / start+end / extend | text + image → video |
| Sửa | `edit.trim`, `edit.upscale`, `edit.speed` | video → video |
| Âm thanh | `gen.voice` (TTS), `source.audio` | text → audio |
| Ghép | `compose.timeline` (**sink**: nhận nhiều video/audio, mở timeline editor bên trong) | video[] + audio[] → video |
| Ra | `output` (lưu library / tải / đẩy sang Publish) | any |

Cổng tô màu: chữ tím, ảnh xanh lá, video đỏ, âm thanh vàng. Chỉ nối cùng màu.

## 5. Luồng người dùng

1. Dán kịch bản (hoặc chọn sản phẩm từ sổ tài sản của shop → Claude viết kịch bản 15-30s).
2. Bấm "Tách cảnh" → bảng storyboard: mỗi hàng = shot (góc máy, hành động, lời thoại, thời lượng, anchor). Sửa tay được.
3. "Sinh keyframe" cho cả bảng → mỗi shot có 1-3 ảnh, chọn ảnh đạt. **Chưa tốn tiền video.**
4. "Sinh video" cho shot đã duyệt keyframe → chạy song song theo DAG, có ước giá tổng trước khi bấm.
5. Tab Timeline tự xếp clip theo thứ tự shot; kéo trim, thêm voice/nhạc/phụ đề; preview trong trình duyệt.
6. Render (ffmpeg trên box3) → mp4 → library / Publish.

Canvas luôn mở song song để người quen tự chế: thêm biến thể, nối ảnh shot 3 làm end-frame shot 4, thử model khác cho một shot.

## 6. Kỹ thuật

- **Ở đâu**: đề xuất trong MOS2, tab `/p/[id]/xuong-video` (tên tránh đụng `scenes` đã có = sân chơi social). Lý do: đã có `@xyflow/react` 12 + custom nodes (`components/architecture/`), Postgres, auth/role, project, sổ tài sản sản phẩm, pipeline QC Meta. Tách app riêng chỉ khi anh muốn bán ngoài.
- **Canvas**: React Flow 12 + Zustand, tài liệu graph lưu jsonb đúng khuôn SpyPro (đã dump mẫu: `nodes[].data.{label,model,prompt,aspectRatio,runtime}`, `edges[].{sourceHandle,targetHandle}`).
- **Engine**: server action `runGraph(vpId, nodeIds?)` → topo sort → đẩy `video_jobs` → worker poll provider (Veo trả taskId, poll tới xong) → cập nhật `runtime` → client poll 3s. Node idle có đủ input mới chạy; node đã có output không chạy lại trừ khi "Retake".
- **Provider adapter** một interface: `generateImage`, `generateVideo`, `extendVideo`, `tts`, `estimateCost`. Phiên bản 1: Google (Gemini image + Veo 3.1) và fal.ai. ComfyUI để sau.
- **Timeline**: phiên bản 1 tự viết gọn (track, clip, trim, kéo thả, preview bằng `<video>` nối tiếp); phiên bản 2 cân nhắc `@openvideo/timeline` (designcombo) hoặc Remotion Player. Render thật bằng ffmpeg concat + xfade + audio mix trên box3, không render trong trình duyệt.
- **MCP cho Claude**: `tach_canh`, `sinh_keyframe`, `sinh_video`, `xep_timeline`, `render` → Claude làm cả mạch từ chat, anh duyệt keyframe trên UI.
- **Tiền**: mỗi job ghi `cost`; `estimateCost` hiện trên nút Run; hạn mức ngày mỗi project; không có nút nào tự chạy khi chưa bấm.

## 7. Quyết định của anh (08/10/2026)

1. **Phạm vi**: cả ba — short video, phim ngắn nhiều tập (thị trường đang nóng), creative quảng cáo. Mỗi "phim" có `loai` = short | phim | quang_cao; khác nhau ở anchor mặc định và độ dài, chung một mạch.
2. **Model**: khoá có sẵn = Google (Gemini/Veo), Claude, OpenAI. **Sora 2 API của OpenAI đã đóng 24/09/2026** nên video chỉ còn Google.
   Bản test rẻ nhất (giá Gemini API 08/10/2026): ảnh **Nano Banana 2.1** 1K = $0,0336/ảnh (nhận tới 4 ảnh nhân vật + 10 ảnh vật làm tham chiếu — đúng thứ series cần) ·
   video **Veo 3.1 Lite** 720p = $0,05/giây → $0,40 một clip 8s (Fast $0,80, Quality $3,20) · chữ **Claude** (Opus 5.5 mặc định; Haiku 4.5 để thử rẻ, tách cảnh chỉ vài nghìn token).
   Một short 6 cảnh ≈ 6 ảnh + 48s video ≈ $2,60 ở mức Lite. Khoá đọc từ `GOOGLE_API_KEY` (hoặc `GEMINI_API_KEY`) và `ANTHROPIC_API_KEY` trong `.env.production`; trang tự báo thiếu khoá nào.
3. **Nơi đặt**: trong MOS2 (mos2.on.tc) dùng nội bộ trước.
4. **Series nhiều tập**: anchor (nhân vật · sản phẩm · bối cảnh · đạo cụ · phong cách) nằm ở tầng PHIM, mọi tập dùng chung; mỗi anchor có đặc tính cố định + ảnh mẫu (tải lên hoặc máy sinh "character sheet");
   prompt mọi cảnh tự nối phong cách bộ phim + đặc tính anchor + ảnh mẫu làm tham chiếu; tập sau đọc tóm tắt các tập trước để nối mạch.

## 7b. Đã làm — G1 (08/10/2026)

- Migration `0222_xuong_video.sql`: `xv_phim` · `xv_nhan_vat` (anchor) · `xv_tap` · `xv_canh` (shot = xương sống) · `xv_job` (sổ chi phí từng lần gọi model).
- `lib/xuong-video/`: `kieu.ts` (kiểu + bảng model/giá), `google.ts` (Gemini ảnh qua generateContent, Veo qua predictLongRunning + poll + tải), `claude.ts` (viết kịch bản, tách cảnh JSON có cấu trúc, prompt ảnh mẫu anchor).
- `lib/actions/xuong-video.ts`: CRUD + `vietKichBanTap` → `tachCanhTap` → `sinhKeyframe` (ứng viên) → `chonKeyframe` → `duyetCanh` (gate) → `sinhVideoCanh` (async) → `kiemVideo` (poll 10s) · `uocTien` trước khi bấm.
- Trang `/p/[id]/xuong-video` (`components/xuong-video/trang.tsx`): danh sách phim → drawer phim: kinh thánh · anchor (ảnh mẫu) · tập · storyboard từng cảnh với keyframe/duyệt/video; menu + tab đã khai.
- Còn lại theo lộ trình mục 8: G2 canvas node, G3 timeline + render ffmpeg, G4 extend/first-last + MCP, G5 nối shop.

## 8. Lộ trình (sau khi chốt)

| Giai đoạn | Làm gì | Ước |
|---|---|---|
| G1 | Schema + migration, bảng storyboard, `gen.shots` bằng Claude, `gen.image` keyframe qua Gemini, duyệt keyframe | 2 ngày |
| G2 | Canvas React Flow với 6 node đầu, engine chạy DAG, `gen.video` Veo 3.1, variants library | 3 ngày |
| G3 | `compose.timeline` + editor gọn + render ffmpeg box3 + output | 3 ngày |
| G4 | Anchor nhất quán, extend/first-last chaining, ước giá, MCP tools | 2 ngày |
| G5 | Nối shop: chọn sản phẩm → kịch bản → video → đẩy sang lô QC Meta | 1-2 ngày |

Tham chiếu: khảo sát đầy đủ (bảng 18 tool, 12 repo mở) nằm trong phiên chat 08/10/2026; mẫu tài liệu graph SpyPro (template 3 ảnh + 1 video, dump từ localStorage) ở `docs/xuong-video/spypro-flow-sample.json`.
