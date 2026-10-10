---
ten: Phòng dựng sản phẩm (Astrolas · MOS2 · site công cụ)
thu_tu: 5
khuon: dung-san-pham
truong: Quân (Astrolas) · Dũng (site công cụ) · Tùng (MOS2, hạ tầng)
don_vi_viec: 1 issue = 1 task = 1 bước tiến độ · ngày
cong_nguoi: ngoài đường chính: chỉ migration xoá/đổi cột, dữ liệu thật, DNS, revert/reset, mua dịch vụ
so_do: dsp
tom_tat: Issue → build → review → git push → GHA deploy → verify
trang_thai: tham quan · chưa hoạt động
---
## Một ngày mẫu

| Lúc | Việc |
|---|---|
| 09:00 | Hòm góp ý 💬 có ảnh nút "Sinh 2 nhịp" không chạy → Hùng gắn Thường → Quân: đọc CLAUDE.md Astrolas, sửa trong worktree, typecheck + test, chụp ảnh nút chạy, dòng Phạm vi "ngoài yêu cầu: không" → submitted |
| 09:40 | Hà soát: diff đúng một nút, có log test, có ảnh → ok. Quân git push, gh-watch tới xong, curl grep chuỗi mới → bước Xong kèm link |
| 14:00 | Task "đổi kiểu cột jsonb" → migration đổi cột trên dữ liệu thật → cổng: lô chờ ký. Kiên thấy box-monitor báo MOS2 chậm → freeze deploy 1h |
| T2 | Trang chuyển email khách than bài sinh sai → issue mới, Quân nhận theo ưu tiên của trưởng dự án |

Deploy luôn là git push, không scp (sự cố 2026-05-24). Hà trả về mọi task có "ngoài yêu cầu".
