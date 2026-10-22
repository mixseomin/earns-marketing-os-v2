# Rig chuẩn cho mô hình sinh từ ảnh

Một lệnh gắn rig Rigify cho mọi nhân vật / đồ vật sinh từ ảnh (TRELLIS, Hunyuan3D, Tripo…), 0đ, ~10 s trên iMac:

```
Blender -b --factory-startup -P gan-rig.py -- <mo-hinh.glb|.gltf> <loai> <thu-muc-ra>
```

Ra: `rig.blend` (lưới `Da` + rig `Rig`) và `soat.N.<dáng>.png` (thử dáng bằng điều khiển của rig, in độ dịch lưới mỗi dáng).

## Quy ước chung

- Mặt nhìn **−y**, lưng / đỉnh **+z** (đúng đầu ra TRELLIS). Đáy chạm z = 0, tâm xy về gốc (`luoi.nap_chuan`).
- Xương gây biến dạng là `DEF-*` của Rigify; người diễn hoạt chỉ cầm điều khiển (`neck`, `head`, `tail*`, `foot_ik.L`, `front_foot_ik.L`, `vat`…).
- Trọng số tính trên bản sao kín (voxel remesh) rồi chép sang lưới gốc, vì lưới sinh từ ảnh thường hở và bone heat hỏng (`gan_da.gan`).

## Các khâu (rig/)

| Tệp | Việc | Thêm loại mới thì |
|---|---|---|
| `luoi.py` | nạp + chuẩn hoá lưới | không đổi |
| `giai_phau.py` | tìm mốc từ hình khối (chân = cụm thấp nhất, cổ / đuôi = tâm lát cắt…) | thêm một hàm vào `LOAI` |
| `khung_rigify.py` | dựng metarig theo mốc (vỏ = metarig mẫu của Rigify để có nhóm xương) + `rigify_generate` | thêm một hàm vào `METARIG` |
| `gan_da.py` | trọng số da | không đổi |
| `thu_dang.py` | tờ thử dáng | thêm một bộ vào `DANG` |

## Loại đang có

- `bon_chan`: thú bốn chân (khủng long, chó, mèo, ngựa). Sống `basic_spine`, cổ + đầu `super_head`, đuôi `basic_tail`, chân `front_paw` / `rear_paw` 4 đốt có IK + khoá bàn chân. Đo trên bronto TRELLIS: 42 xương DEF, 0/3514 đỉnh thiếu trọng số.
- `do_vat`: đồ cứng, một xương gốc ở đáy (dời / xoay / nhấc).

## Khuôn mặt (giao diện ARKit)

```
Blender -b <rig.blend> -P gan-mat.py -- <thu-muc-ra>     → rig-mat.blend + bc.<biểu cảm>.png
```

Giao diện chung mọi nhân vật = thanh trượt tên ARKit trên đối tượng rig (`rig['jawOpen'] = 0…1`); biểu cảm mẫu (`BIEU_CAM`: cười, giận, buồn, ngạc nhiên, chớp, liếc…) là tổ hợp các thanh đó nên dùng lại cho mọi con. Khuôn `mat_hoat_hinh` (thú hoạt hình mắt to):
mắt / khoé miệng tìm bằng lấy mẫu dày màu bề mặt (cụm nâu hai bên đầu, ép đối xứng), nhãn cầu tách riêng nhìn theo tay cầm `nhin_mat`, mí trên = nửa vỏ cầu màu da (chớp = xoay mí), đường xẻ miệng + hình nắn da (jaw / smile / frown / brow / cheek), khoang miệng tối.

Giới hạn đã biết: lưới TRELLIS thưa (~3,5k đỉnh), mõm không có cấu trúc môi → há miệng gập như một tấm, cười / mày còn nhẹ. Cách lên tầng: sinh ảnh concept có miệng hé (lưới ra sẵn khe môi) hoặc dựng lại lưới (QuadriFlow) trước khi nắn.

Người thật đi đường riêng của bộ dựng set (`bo-set/nguoi-3d/gan-rig.py`, chép trọng số từ thân MPFB). Chưa có: hai chân hoạt hình, chim / có mỏ, đồ có bản lề, điểm bám (leo trèo).

## Gotcha

- Xương mới trùng TÊN xương mẫu đã xoá thừa hưởng `rigify_type` cũ → luôn xoá trắng `rigify_type` mọi xương trước khi gán.
- `rigify_generate` đòi metarig có nhóm xương có hàng nút giao diện → dựng trong vỏ metarig mẫu, không dựng armature trống.
- Đặt scale / location cho vật rồi gắn cha theo xương phải `view_layer.update()` trước khi chép `matrix_world` (khoang miệng từng phình thành cầu 2 m).
- Màu đọc từ `image.pixels` là sRGB — đổi sang tuyến tính trước khi đưa vào Base Color (mí từng trắng bệch).
- Nút gốc glTF nhập ở chế độ quaternion; nạp vào cảnh phải đặt `rotation_mode = 'XYZ'` trước khi xoay (`hang-khung-long.py › nap`).
