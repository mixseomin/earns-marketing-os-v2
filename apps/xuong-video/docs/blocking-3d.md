# Blocking 3D trước tiền hình — chuẩn của studio

Anh chốt 12/11/2026 (phim #3071 tập #3074). Luật dựng: `blocking_dien_chong` trong `src/lib/xuong-video/luat-dung.ts`, mô tả ngành trong `src/lib/xuong-video/nganh-luat-dung.ts` (Dmytryk, Reisz, Arijon, Mascelli).

Áp cho mọi phim mới có tương tác người với người hoặc người với đồ vật. Thứ tự bắt buộc:

## 1. Dữ liệu cảnh — một nguồn cho hình 3D lẫn prompt

Một tệp dựng `scripts/du-lieu/bo-set/<cảnh>.py` sinh ra `.json` (vat · khoi · may theo mã shot, đơn vị cm, x đông · y bắc · z lên). Mỗi người / đồ trong `may[ma].vi_tri` khai:

| Trường | Nghĩa |
|---|---|
| `nhip` | mốc động tác trong shot `[{u, p?, h?, nhin?}]`, u từ 0 tới 1 — ví dụ quay người ở 0–22 %, chạy ở 22–100 % |
| `trao` | khoảng chuyền tay của món đổi tay `[a, b]` (mặc định 0,35–0,7) |
| `tay` | mức giơ tay theo mốc `[[u, 0..1], …]` — giơ tiền lên trước khi cắt sang cận tay |
| `tay_cam` | `'trai'` khi tay phải bận (chai tay trái, tiền tay phải) |
| `nhin_ai` / `nhin_ai_den` | đích nhìn lúc mở / kết: tên người hoặc tên mốc |

Ở cấp shot: `may.khoa_nhin` (máy đặt sao giữ vậy, Blender không ngắm lại). Ở cấp khối: `khoi_3d.cung` (tàu, xe trượt thẳng, không chúi người như người đi).

## 2. Xem và soát bằng three.js (không render, vài giây)

```
python3 scripts/bo-set/xem-web/dung-trang.py <set.json> <tap.json> <ra.html> "<tên>"
```

`tap.json` = `json_agg` từ `xv_canh` của tập: `{so, ma, phat, cd, thoai}`. Trang có người có khớp, tia nhìn, giọng thoại và:

- **Bảng nối shot** — mọi cú cắt phải ✓: chỗ đứng, hướng thân, hướng nhìn thật (góc từ mặt tới đích), đồ ở tay ai, hướng nhìn trên màn, **trục 180° giữ cho cả cảnh** (so với shot gần nhất có trục), hướng di chuyển trên màn.
- **Câu prompt hướng nhìn + nhịp theo giây** (Việt / Anh) sinh từ đúng dữ liệu dựng hình — thấy gì trên khung thì prompt viết đúng thế.

Động tác quan trọng (trao đồ) phải có **cận tay** nối hành động; cắt giữa động tác (quay người, chuyền tay), không cắt ở chỗ đứng yên.

## 3. Clip tham chiếu có diễn chồng

```
XV_PLAYWRIGHT=<gói playwright> XV_CHROMIUM=<chrome-headless-shell> node scripts/bo-set/xem-web/xuat-clip.cjs <trang.html> <thư mục ra>
```

iMac: gói ở `/Users/htuan/gumroad-views/node_modules/playwright`, Chromium ở `~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`. Cả tập 12 shot khoảng 20 giây, 720p 24 khung/giây.

- Hành động là **một dòng liên tục của cả cảnh**, shot là cửa sổ máy. Mỗi clip dư 0,6 giây hai đầu (`XV_DU`), lấy đuôi hành động shot trước và đầu hành động shot sau, **chạy đúng tốc độ thật**. Shot ngắn dư thêm cho đủ 4 giây (Seedance cần ≥ 4 giây). **Cấm kéo chậm động tác** cho đủ độ dài.
- Cạnh mỗi clip có `shot-NN.json` `{vao, ra, giay_chinh}`: lúc dựng cắt bỏ `vao` giây đầu (`ky_thuat.vao_s`) và `ra` giây cuối.
- Người vắng ở shot liền kề, hoặc shot sau khai `nhay` (nhảy thời gian), thì giữ dáng ở mép shot.

## 4. Cổng tiền hình

Phim có `kinh_thanh.video_tho` chưa duyệt thì `sinh-anh.ts › lyChanKeyframe` chặn mọi keyframe AI (kể cả chế độ thử). Anh duyệt xong: `bo-set.mts --duyet-tho --phim=<id>`.

## 5. Hình thật (tốn tiền — chỉ chạy khi anh bảo)

Seedance 2.0 reference-to-video qua fal `bytedance/seedance-2.0/fast/reference-to-video`: ≤ 9 ảnh mẫu, ≤ 3 video (tổng 2–15 giây), ≤ 3 âm thanh, prompt. Giá fal: $0,2419 / giây 720p, có video đầu vào nhân 0,6. Ảnh mẫu giống người thật có thể bị fal từ chối (lỗi 422, đã gặp 23/10/2026).

Blender (`scripts/bo-set/dien-tap.sh`) vẫn dùng cho clip thô / bản đồ độ sâu nhưng **chưa đọc** `nhip` / `trao` / `tay` — clip tham chiếu đi từ three.js.

## 6. Chi tiết nhỏ (uống, cầm, trao) — nói cùng một điều qua BA kênh

Anh hỏi 12/11/2026: "cầm chai vừa đi vừa uống thì ai có hiểu không, làm sao hạn chế hiểu sai". Model đọc ba kênh; kênh nào thiếu thì nó đoán:

1. **Hình chuyển động** (clip tham chiếu): động tác phải CÓ trong 3D — `dien: ['uong@a-b']` đưa chai lên miệng; đồ có dáng nhận ra được (chai: thân + cổ + nhãn + ống hút), không để khối trơn.
2. **Ảnh mẫu** của đồ vật (anchor có ảnh).
3. **Prompt**: câu NHỊP theo giây (ai làm gì lúc nào) + dòng ĐỒ (số lượng, tay nào, trạng thái: "exactly ONE half-drunk glass cola bottle with a straw in his LEFT hand") + câu cấm ("No other bottles, notes or props"). Cả hai dòng sinh tự động từ dữ liệu (`do_en` trong tệp dựng cảnh).

Soát tốc độ: câu nhịp tự ghi "đi" / "chạy" theo m/giây — thấy "chạy" ở cảnh lẽ ra đi thong thả là dữ liệu sai quãng đường (bắt được ở #8: 5,5 m trong 1,5 s).
