---
ten: Phòng Kỹ thuật
thu_tu: 8
khuon: dung-san-pham
truong: Tùng
don_vi_viec: 1 issue hạ tầng · ngày
cong_nguoi: deploy prod, dữ liệu thật, DNS, server = mức 3
so_do: 
tom_tat: Server, deploy, MOS2, hook chặn; phục vụ phòng khác, không tự nhận việc
trang_thai: tham quan · chưa hoạt động
---
Tùng là người có tay duy nhất trên hạ tầng: box1/2/3, nginx, systemd, GHA, Cloudflare. Mọi deploy là git push. Hook chặn trên box3 (cấm tiền, xoá, đổi tài khoản, mua, không hoàn tác) do Tùng cài trước khi ai khác được cấp tay. Khi box-monitor báo sập: ca ngoài giờ, sửa, bằng chứng = curl 200 + journalctl.
