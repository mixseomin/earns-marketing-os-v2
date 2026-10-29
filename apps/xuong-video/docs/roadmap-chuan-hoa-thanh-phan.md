# Roadmap — Chuẩn hoá thành phần shot + Con bóc tách (studio)

> Anh 30/10/2026: "chuẩn hoá các thành phần trong từng shot, từng keyframe, từ trước khi sinh key đầu, key cuối rồi video. Sau đó phải có 1 bước bóc tách các phần cần có từ đầu đến cuối của từng phần." Lý do: quay thật có thư ký trường quay giữ liên tục; sinh AI thì phải mô tả cụ thể hơn phim thường, và phải kiểm lại ảnh sinh ra có khớp spec không.

## Nguyên tắc
Mỗi shot có một **SPEC THÀNH PHẦN** chuẩn, khai rõ cho khung **ĐẦU** và khung **CUỐI** (vì shot có thể đổi trạng thái: giật thẻ, cửa mở, quay đi). Spec → prompt (key đầu, key cuối, video). Sinh xong → **con bóc tách** đọc ảnh → trạng thái THẬT có cấu trúc → đối chiếu spec (lệch thì chặn + sinh lại) → mang trạng thái thật sang shot sau. Tất cả hiện trên studio timeline.

## Schema `ThanhPhanShot` (GĐ0)
Hợp nhất 3 mảnh rời đang có (costume plot · expression plan · prop ledger) thành MỘT spec/khung:
```
ThanhPhanKhung = {
  nhan_vat: [{ ten, ao: {mo_ta, mau}, toc: {kieu, mau}, trang_suc?, bieu_cam, huong_nhin, tay_cam? }],
  do: [{ ten, ai_giu | vi_tri, trang_thai }],           // thẻ đang đeo cổ / bị giật / cầm tay…
  boi_canh: { noi, anh_sang },
  khung_hinh: { co, vi_tri_nguoi }
}
ThanhPhanShot = { dau: ThanhPhanKhung, cuoi: ThanhPhanKhung }   // cuoi = dau nếu shot không đổi trạng thái
```
Tóc + ngoại hình chi tiết thành thuộc tính **hạng nhất** (hiện chỉ cảnh báo trong `cau-hoi-khung` mã `mac`).

## Giai đoạn
| GĐ | Việc | Dựa trên cái đã có |
|----|------|--------------------|
| **0** | Định nghĩa schema `ThanhPhanShot` + điền cho shot | `bang-trang-phuc.ts`, `qc-cam-xuc.ts`, `so-vat.ts` |
| **1** | Spec → prompt: key đầu (=trạng thái đầu), key cuối (=trạng thái cuối), video (đầu→cuối). Tóc/ngoại hình thành câu CHẶN | `phieu-shot.mts`, `anh-tu-so-do.mts`, `clip-dau-cuoi.mts` |
| **2** | **Con bóc tách** (LÕI MỚI): sau mỗi keyframe → vision Gemini Flash (~0,3¢) đọc ảnh → JSON `ThanhPhanThat` đúng schema → đối chiếu spec → lệch quá ngưỡng thì chặn + sinh lại (tối đa N). Lưu vào shot | mở rộng `soi-cau-hoi.ts` (đang hỏi đúng/sai → thêm TRÍCH có cấu trúc) |
| **3** | Nối trạng thái thật: `cuoi` shot N (đã bóc tách) = ràng buộc `dau` shot N+1; prompt shot sau nối từ thực tế | `noi-khung-clip.ts` |
| **4** | **Timeline**: thẻ shot hiện spec + trạng thái bóc tách (đầu→cuối), cờ đỏ chỗ lệch | `so-do-shot.ts`, `canh.tsx` |
| **5** | **Gate**: pipeline sinh keyframe tự gọi bóc tách + chấm TRƯỚC khi sang clip; tóc/ngoại hình thành thuộc tính chặn | `kiem-khung.ts`, cổng `sinh-anh.ts › lyChanKeyframe` |

## Thứ tự
**1 shot thử (làm ngay):** GĐ0 (spec 1 shot) → GĐ1 (prompt) → sinh key đầu + cuối → GĐ2 (bóc tách + chấm) → GĐ4 (hiện lên timeline) → **chụp cho anh xem**.
Sau khi anh duyệt mẫu: mở rộng cả cảnh 356 → GĐ3 (nối) → GĐ5 (gate chặn), rồi thành chuẩn mọi phim.

## Trạng thái
- [ ] GĐ0 schema + spec shot thử
- [ ] GĐ1 spec→prompt
- [ ] GĐ2 con bóc tách
- [ ] GĐ4 hiện timeline + chụp  ← mốc trình anh
- [ ] GĐ3 nối trạng thái · GĐ5 gate (sau khi duyệt mẫu)
