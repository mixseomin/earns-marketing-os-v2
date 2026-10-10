---
ten: Phòng Kinh doanh (người bán · đối tác ăn %)
thu_tu: 10
khuon: hat-nho
truong: Sơn
don_vi_viec: 1 đơn có mã nguồn · tích theo tháng
cong_nguoi: trả hoa hồng = mức 3 (An tính, Hà đối chiếu, Giám đốc ký và bấm trả)
so_do: 
tom_tat: Mã gán nguồn do máy cấp, sổ hoa hồng net, Kiên canh gian lận
trang_thai: tham quan · chưa hoạt động
---
## Năm lớp kiểm soát

1. **Gán nguồn bằng máy**: mỗi người một mã (utm_content / sub_id / mã giảm giá / link affiliate) → `kenh_so_ngay`, postback 2 lớp, API Gumroad, coupon Etsy. KDP không gắn được người → không trả % cho KDP.
2. **Sổ hoa hồng An tính, net không gross**: trừ hoàn, chargeback, phí sàn → ròng × tỉ lệ; cửa sổ thu hồi 30–60 ngày; giữ chờ 30–45 ngày.
3. **Kiên canh**: tự giới thiệu → không tính; đơn tăng vọt / hoàn vượt ngưỡng → đóng băng hoa hồng; spam / hứa sai → freeze mã, Trang xử.
4. **Trang riêng need-to-know** trên cty.on.tc: đơn của mình, trạng thái, bảng kê.
5. **Chạy thử một tháng** bằng chính kênh của Giám đốc (mã riêng TikTok, Pinterest) để kiểm số khớp sàn, rồi mới ký người đầu.

Trạng thái: hồ sơ Sơn có, chưa có người bán nào. Bước đầu khi bật = bảng `doanh_thu_theo_nguon`.
