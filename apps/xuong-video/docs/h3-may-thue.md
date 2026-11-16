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

## Bài học (mỗi dòng là một lần đã mất tiền máy)

1. Image tự khai yêu cầu CUDA 13 → RunPod chỉ xếp máy driver mới → "hết chỗ" mọi loại máy. Dùng image không khai, kiểm driver sau khi lên.
2. Ubuntu 24.04 chặn pip cài vào Python hệ thống (PEP 668) → `PIP_BREAK_SYSTEM_PACKAGES=1`.
3. `requirements.txt` của ComfyUI kéo torch cu12.8 đè cu130 → cài gói ComfyUI TRƯỚC, torch cu130 SAU, kiểm lại.
4. Ô xem trước của LoadVideo cũng nằm trong `/history` → chỉ lấy tệp của node SaveVideo, kiểm tệp thật trước khi báo ✓.
5. Một phiên ssh liền suốt mạch → mạng nhà chập là mất lượt → chạy tách trên máy, iMac chỉ ghé kéo.
6. Driver máy RTX 5090 cộng đồng có thể chỉ 570 → script tự xoá, sang máy kế.
