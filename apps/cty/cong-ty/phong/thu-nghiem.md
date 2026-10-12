---
ten: Phòng thử (mô hình rẻ nhất)
thu_tu: 14
khuon: day-chuyen
truong: Tâm
vai_truong_phong: tam   # ai đang giữ vai (decision 2026-10-11 nhân sự sống): quy trình trỏ vai, đổi người = đổi dòng này
vai_nguoi_lam: loc
vai_nguoi_kiem: ky
don_vi_viec: 1 việc nhỏ · mỗi lần bấm "Chạy một lượt"
cong_nguoi: người kiểm (Kỳ, mô hình khác người làm) soát theo tiêu chí; Giám đốc đọc nhật ký
so_do:
tom_tat: Phòng tạm để xem vận hành: giao việc → làm → kiểm → báo cáo, mỗi lượt ~1 cent
trang_thai: thử nghiệm · chạy khi bấm nút
thu_nghiem: true
ngan_sach_cai_tien_usd_thang: 0.5   # Giám đốc cấp (anh chốt 11/10/2026): trưởng phòng tự họp/so trong mức này; 0 hoặc bỏ = không tự họp
van_phong_cong: 3863   # văn phòng pixel riêng ở cty.on.tc/vp/thu-nghiem/ (trình chạy mos2-vp-thu.service; map ở deploy/nginx-cty.conf) — hiện cố định bên phải ngăn phòng
van_phong_home: /var/lib/cty/vp-thu   # giữ HOME cũ: bố cục + chỗ ngồi đã lưu của văn phòng này
---
Phòng tạm để nhìn một lượt vận hành thật với mô hình rẻ nhất. Mỗi lần bấm **Chạy một lượt** là một việc đi qua: Tâm (trưởng) đọc việc → giao cho Lộc kèm tiêu chí → Lộc làm, nộp kèm bằng chứng → Kỳ (kiểm, mô hình khác Lộc) soát theo tiêu chí, thiếu thì trả về một lần → Tâm viết báo cáo sáng theo mẫu AGENTS.md §7. Mọi lượt gọi qua proxy: trần chi $1/người/tháng, ghi `ai_usage`. Không có heartbeat: không bấm thì không chạy, không tốn tiền.
