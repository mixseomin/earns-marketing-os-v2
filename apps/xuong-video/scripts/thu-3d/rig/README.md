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

Người thật đi đường riêng của bộ dựng set (`bo-set/nguoi-3d/gan-rig.py`, chép trọng số từ thân MPFB). Chưa có: hai chân hoạt hình, chim / có mỏ, đồ có bản lề, khuôn mặt (ARKit 52, nhịp sau).

## Gotcha

- Xương mới trùng TÊN xương mẫu đã xoá thừa hưởng `rigify_type` cũ → luôn xoá trắng `rigify_type` mọi xương trước khi gán.
- `rigify_generate` đòi metarig có nhóm xương có hàng nút giao diện → dựng trong vỏ metarig mẫu, không dựng armature trống.
- Nút gốc glTF nhập ở chế độ quaternion; nạp vào cảnh phải đặt `rotation_mode = 'XYZ'` trước khi xoay (`hang-khung-long.py › nap`).
