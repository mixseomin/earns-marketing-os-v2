# Dáng đi người thật — học từ đâu, studio đang làm gì

Ghi 22/10/2026 (anh: "Ko bịa dáng đi nữa. Tìm nguồn để học lại cho chuẩn" — tập 135 #15 Vivian đi "dật dẹo").
Mã: `scripts/bo-set/dung-set.py` (dien_shot, vòng diễn) · `scripts/bo-set/mesh/mocap.py` (do_di, chon_di, ap_mocap).

## Nguồn

| Nguồn | Điều học được |
|---|---|
| [Epic — Distance Matching](https://dev.epicgames.com/documentation/unreal-engine/distance-matching-in-unreal-engine), [AnimDistanceMatchingLibrary](https://docs.unrealengine.com/PythonAPI/class/AnimDistanceMatchingLibrary.html) | Phát hoạt ảnh theo QUÃNG đã đi chứ không theo đồng hồ để chân không trượt; nhịp phát hiệu dụng kẹp mặc định 0,75–1,25; đoạn đi lặp (walk/jog) chỉnh nhịp cho khớp tốc độ, giả định tốc độ đều. |
| [Epic — Pose Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine) | Stride Warping: co / giãn khoảng cách bước, StrideScale = LocomotionSpeed / RootMotionSpeed. Orientation Warping: bẻ chân theo hướng đi. |
| [Epic — Adapting Lyra animation](https://www.unrealengine.com/tech-blog/adapting-lyra-animation-to-your-ue5-game) | Lyra kết hợp chỉnh nhịp + stride warping; "chuẩn ngành" chỉnh tối đa 15–20 %, quá nữa hình hỏng — nên có nhiều đoạn theo tốc độ. |
| [Unreal — bOrientRotationToMovement](https://docs.unrealengine.com/4.27/en-US/API/Runtime/Engine/GameFramework/UCharacterMovementComponent/bOrientRotationT-/) + RotationRate | Nhân vật quay theo hướng chuyển động với tốc độ quay giới hạn. |
| [Daniel Holden — IK & Foot Locking](https://theorangeduck.com/page/inverse-kinematics-foot-locking) | Khoá bàn chân khi chạm đất: nhận chạm bằng vận tốc mũi chân (~0,1–0,5 m/s) + độ cao (~0,1 m), lọc đa số 5 khung, khoá vị trí thế giới, IK hai xương, hoà vào / ra. |
| [Simon Clavet — Motion Matching (GDC 2016)](https://gdcvault.com/play/1022985/Motion-Matching-and-The-Road) | Bắt đầu / dừng / rẽ lấy thẳng từ dữ liệu mocap thay vì tự dựng chuyển tiếp. |
| [Monmouth — walk cycle (Williams, Animator's Survival Kit)](https://animation.monmouth.edu/instruct/?p=351) | Tư thế chạm – hạ – qua – nâng; thân thấp nhất lúc chạm, cao nhất lúc qua. |
| CMU Mocap (mocap.cs.cmu.edu, index `una-dinosauria/cmu-mocap`) | Dữ liệu thật: đi chậm 08_04, đi thường 35_01, đi nhanh 08_01/08_05; rẽ 90° khi đi 16_17…16_20; đi rồi dừng 16_33/16_34. |

## Số đo từ dữ liệu thật (không tự đặt)

- Tốc độ gốc (cao-hông/giây, đoạn giữa): 08_04 1,12 · 35_01 1,35 · 08_11 1,36 · 08_02 1,66 · 08_01 1,76 · 08_05 1,76.
- Rẽ 90° khi đang đi (CMU 16_17…16_20, khử lắc hông trung bình trượt 1 s): 10→90 % trong 0,99–1,10 s, trung bình 68–79°/s → `TOC_QUAY = 75`.

## Studio đang làm (BAN_DUNG 109)

1. Đi trong cửa sổ của mã mocap đi (`mc_…@a-b`): tới nơi đúng b.
2. Chọn đoạn đi thường gần tốc độ kịch bản nhất (`chon_di`) — kiểu bộ đoạn theo tốc độ của Lyra.
3. Distance matching: pha bước theo quãng, nhịp phát kẹp `TOC_PHAT = (0,8; 1,2)`.
4. Stride warping phần lệch còn lại: co / giãn thành phần trước–sau của đùi + cẳng chân.
5. Lặp trong một vòng bước liền mạch (`do_di`: cặp khung giống dáng nhất cách ≥ 0,9 s).
6. Quay theo hướng đi với tốc độ đo được (75°/s), tới nơi quay về hướng kết cùng tốc độ.
7. Tăng / giảm tốc trong một bước (~0,55 s) ở hai đầu. Thân nghiêng + hông nhún lấy từ mocap, không thêm tay.

## Chưa làm (bước kế theo nguồn)

- Khoá bàn chân (Holden) — lớp cuối để hết trượt chân còn sót.
- Đoạn BẮT ĐẦU / DỪNG thật (16_33/16_34 slow walk, stop) thay cho tăng / giảm tốc hình thang.
