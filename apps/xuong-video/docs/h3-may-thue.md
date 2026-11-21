# H3 trên máy thuê — phương án sinh video rẻ (thử 16/11/2026)

MiniMax H3 bản mở (Comfy-Org/MiniMax-H3: ref2va cắt gọn INT8 + Qwen3-VL NVFP4 + LoRA turbo 4 bước), chạy ComfyUI trên GPU thuê RunPod, nhận **cùng đầu vào**
với cụm Seedance của studio (≤ 9 ảnh tham chiếu + clip blockout 3D + câu lệnh, `Reference image N` → `<Picture N>`, `Reference video 1` → `<Video 1>`).

## Kết quả lô thử (phim #3071, tập 3074, 16 cụm = mọi clip đang dùng)

| | Seedance (Kie) | H3 (RTX 4090 RunPod) |
|---|---|---|
| Tiền 16 cụm | 645¢ ≈ 167.700₫ | 35 phút máy × $0,89/giờ ≈ 13.500₫ (gồm 6 phút cài) |
| Thời gian sinh | — | 45–295 s / cụm, tổng 29 phút |
| Độ nét | cao hơn | 864×480 (cần nâng nét nếu đem dùng) |
| Tiếng | có | có (thoại + tiếng động cùng lượt) |

Soi tờ khung từng cụm: **H3 ngang hoặc hơn ở 13/16 cụm** (đứng, nói, đưa đồ; không vẽ logo thương hiệu — Seedance vẽ logo Coca-Cola ở 8374).
**H3 kém ở cụm nhiều hành động nối nhau**: 8380 (#19) bỏ cảnh tàu lăn bánh + nhóc chạy xa; 8376 (#15) nhân đôi nhóc; 8374 đoạn cuối lệch thứ tự shot.

## Phương án (anh chốt 16/11/2026 "Lưu phương án này lại")

- **H3** cho shot / cụm tĩnh hoặc ít hành động (đứng, nói, đưa đồ, cận mặt) — rẻ ~12 lần.
- **Seedance** cho cụm nhiều chuyển động phức tạp nối nhau (tàu chạy + người chạy, đuổi, ngã…).
- Ước cả phim: giảm 70–80% tiền video.

## Cách chạy

```
bash apps/xuong-video/scripts/h3/may-h3.sh <thư-mục-ra> <vao-1.json> [vao-2.json …]
```
- `vao.json`: {prompt, anh: [url ≤ 9], video: url, giay, rong, cao, seed, buoc, turbo} — dựng từ `xv_job.request` của lượt Seedance (xem chay-h3.py).
- Thuê máy theo danh sách (`XV_H3_GPU`), kiểm driver ≥ 580 (PyTorch CUDA 13 cho bản INT8 ConvRot), thả cả lô chạy TÁCH trên máy (lam-lo.sh) → iMac ghé kéo clip
  mỗi 30 s (rớt mạng không mất lô) → xoá máy (trap) · máy tự tắt khi xong / quá trần nếu iMac mất liên lạc.
- Kiểm 0đ trước khi thuê: `thu-0d.sh` trong image `h3/may/Dockerfile` (cài, đồ thị H3, lấy đúng clip) — CPU, không tốn tiền.

## Nối vào nút Sinh của studio (góp ý #1638, 17/11/2026)

- Timeline có ô **⚙ Sinh** = bộ sinh video chính của phim (`kinh_thanh.bo_sinh_video`, kieu.ts › `BO_SINH_VIDEO`): Model của phim (như cũ) · Seedance (Kie) · H3 (máy thuê).
- Chọn Seedance / H3 → nút Sinh nháp trên thẻ shot qua đủ cổng như cũ rồi **xếp hàng** shot (`xv_job` trang_thai `hang`, 0đ — sinh-video.ts › `xepHangCum`).
- Chạy hàng trên iMac: `bash apps/xuong-video/scripts/h3/chay-hang.sh` (0đ, in cụm sẽ chạy) → `… --chay` (tốn tiền): gom shot vào cụm (cum-seedance.mts),
  dựng clip 3D nối (cum-seedance-tap.sh) → Seedance gửi Kie; H3 xếp job `hang_h3` cùng đầu vào (`thu-seedance-cum.mts --bo=h3`) rồi `song-song.sh` →
  `thu-seedance-cum.mts --nap-h3=<job> --tep=<mp4>` gắn clip + phiên bản nhãn H3 → `hang-video.mts --dong` đóng hàng.
- Ô **🎬 Nguồn** cạnh đó hiện nguồn clip đang dùng của cả phim (đếm shot theo nhãn phiên bản) và đổi cho mọi tập tại chỗ (`chonNguonPhim`, 0đ).
- **Tự chạy hàng (anh duyệt 20/11/2026 "Cho dựng tiến trình H3 và tối ưu nó")**: việc nền iMac `iMac:com.earns.studio-hang-h3` (sổ cty `cong-ty/viec-nen.json`, 5 phút một nhịp)
  gọi `scripts/h3/tu-chay-hang.sh`: một câu SQL qua ssh hỏi hàng (trống thì thoát sau ~1 giây) → chờ hàng LẶNG 4 phút để gom cả tập vào một lượt thuê máy (shot cũ nhất chờ
  quá 20 phút thì chạy luôn) → số máy theo khối lượng (≤ 2 cụm 1 máy · ≤ 6: 2 · ≤ 12: 3 · hơn: 4) → `chay-hang.sh --chay` với `XV_HANG_BO=h3` (hàng Seedance không tự chạy).
  Một lượt một lúc (khoá `~/.cache/studio-hang-h3/khoa`); chỉ còn job cụm sót mà không có shot mới thì KHÔNG tự thuê máy lại. Nhật ký từng lượt + `so.jsonl` ở `~/.cache/studio-hang-h3/`.
  Xem trước, 0đ: `bash scripts/h3/tu-chay-hang.sh --xem`.
- **Cổng video trả phí**: shot chỉ vào được hàng khi đã thử VideoExpress hoặc tập được bật "Cho phép video trả phí" (Studio 2 › mục Dựng clip, chỉ quản trị; `moTraPhiS2`).
- **Chưa làm — phim KHÔNG có dựng 3D** (vd phim #7999 của Studio 2): `xepHangCum` từ chối shot chưa có clip 3D, kế hoạch cụm và `thu-seedance-cum.mts` đều đòi clip 3D nối làm
  tham chiếu. `chay-h3.py` thì đã nhận `video: null`. Muốn H3 dựng thẳng từ ảnh cảnh cần một nhánh riêng (xếp hàng, lập cụm mỗi shot một cụm, câu lệnh không có "Reference video",
  lời kể ngoài khung không qua khớp miệng) và phải thử MỘT shot trước khi chạy cả tập.

## Luật chuẩn H3 (anh chốt 17/11/2026 — mọi phim kế thừa, học từ bài phim ngắn H3 trên X)

Gắn trong máy, phim mới không phải bật gì:

1. **3 bản mỗi cụm, máy tự chọn** — `thu-seedance-cum.mts` › `H3_SO_BAN = 3` ghi `so_ban` vào job; `chay-h3.py` sinh seed, seed+1, seed+2 trên cùng máy (mô hình
   nạp một lần); `lam-lo.sh` trả `<job>.b1..b3.mp4`; `chay-hang.sh` đưa cả 3 vào `--nap-h3 --tep=a,b,c` → gắn từng bản, chấm = shot không gắn được × 100 + số lỗi
   soi clip (`soi-clip.ts`, ~37₫/shot) → bản điểm thấp nhất làm clip chính, hai bản kia nằm trong phiên bản để đổi tay. Tiền: ~850₫/bản → ~2.550₫/cụm + soi.
2. **Neo giọng studio** — cụm có thoại: tệp giọng của cụm (cùng hàm `fileGiongCum` với Seedance Audio 1: lặng + từng câu đúng mốc) đi vào `vao.giong`;
   `chay-h3.py` nạp `LoadAudio` → `MiniMaxH3AddGuide` (frame 0) → H3 khớp khẩu hình theo giọng studio, giọng nhân vật đồng nhất giữa các cụm.
3. **Kiểm 0đ trước khi thuê** — `thu-0d.sh` kiểm thêm đồ thị neo giọng và "so_ban=2 ra 2 tệp khác nhau" (chạy trên GitHub Actions khi build image).

Chưa gắn máy (làm khi có ca dùng): đoạn phản ứng không thoại 3–5 s phủ thoại dài (hiện do cổng tiền kỳ "vai kể" nhắc chen phản ứng); nâng nét riêng bản được chọn;
ghi kích thước thật đạo cụ trong câu lệnh; cảnh hội thoại 3 ảnh bối cảnh (góc A, góc ngược B, toàn cảnh).

## Năng lực theo hoàn cảnh (chọn H3 hay Seedance)

Mỗi dòng là một lần thử thật, kèm link xem.

| Ngày | Ca thử | Kết quả H3 | Chọn |
|---|---|---|---|
| 21/11/2026 | Máy quay xoay quanh người đi bộ (theo previs khối xám của genel_ai, so với Muse của họ): một người phụ nữ đi giữa lối văn phòng, máy từ chéo trái ra sau lưng, đám đông ngồi phía sau. Đầu vào: video previs 7 s + ảnh khung đầu/cuối. Video: https://img.on.tc/xuong-video/thu-h3/orbit-h3-orbit.b1.mp4 · so sánh (hàng 1 previs, 2 Muse, 3–5 là 3 bản H3): https://img.on.tc/xuong-video/thu-h3/orbit-h3-so-sanh.jpg | **Đạt:** giữ đúng bố cục (lối đi, vách ngăn bên phải, cột), chỉ một người đi, đám đông ngồi không nhân đôi hay méo. **Chưa đạt:** góc xoay quá nhẹ, khung đầu đã gần như sau lưng; Muse mở bằng góc nghiêng thấy nửa mặt rồi mới xoay ra sau. Ba bản seed gần như giống hệt nhau, nên chọn bản không giúp gì ở ca này. Ảnh 768×480, kém nét hơn Muse. 11 phút RunPod 4090 ≈ 4.300₫ | Cảnh đi bộ có đám đông, máy theo sau: **H3**. Cần xoay góc rộng (nghiêng ra sau lưng): **Seedance**, hoặc H3 với khung đầu là ảnh góc nghiêng thật thay vì khung previs |

## Bài học (mỗi dòng là một lần đã mất tiền máy)

1. Image tự khai yêu cầu CUDA 13 → RunPod chỉ xếp máy driver mới → "hết chỗ" mọi loại máy. Dùng image không khai, kiểm driver sau khi lên.
2. Ubuntu 24.04 chặn pip cài vào Python hệ thống (PEP 668) → `PIP_BREAK_SYSTEM_PACKAGES=1`.
3. `requirements.txt` của ComfyUI kéo torch cu12.8 đè cu130 → cài gói ComfyUI TRƯỚC, torch cu130 SAU, kiểm lại.
4. Ô xem trước của LoadVideo cũng nằm trong `/history` → chỉ lấy tệp của node SaveVideo, kiểm tệp thật trước khi báo ✓.
5. Một phiên ssh liền suốt mạch → mạng nhà chập là mất lượt → chạy tách trên máy, iMac chỉ ghé kéo.
6. Driver máy RTX 5090 cộng đồng có thể chỉ 570 → script tự xoá, sang máy kế.
