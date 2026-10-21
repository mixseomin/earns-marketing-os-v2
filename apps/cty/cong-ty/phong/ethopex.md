---
ten: Phòng Ethopex
thu_tu: 19
khuon: dung-san-pham
truong: Phát
don_vi_viec: 1 nhịp theo dõi · 30 phút
cong_nguoi: tăng ngân sách / tắt camp = anh bấm nút duyệt trên Telegram (máy không tự làm)
so_do: 
tom_tat: Theo dõi luật vận hành camp FB phim ngắn trên Ethopex, báo Telegram 📂 Ethopex khi có camp chạm luật; anh duyệt tăng / tắt bằng nút ngay trong tin
du_an: [ethopex]
trang_thai: chạy một việc · Theo dõi luật camp Ethopex (Phát, mỗi 30 phút trên box3, từ 21/10/2026)
---
**Vì sao có phòng này** (anh 21/10/2026: "cần 1 con chuyên theo dõi và báo qua telegram để ko phải đợi tao nhắc trên chat thì mới check các rule đó. Tạo 1 phòng mới là Ethopex cũng đc" + "tao có thể duyệt trên đó luôn"): luật của nhóm Support Ads đổi liên tục trong ngày (lãi đầu phiên tăng luôn, tắt camp lỗ sâu, ad bị từ chối…) — trước đây chỉ được chấm khi anh hỏi trong chat.

**Làm mỗi 30 phút (box3, nhịp máy `kiem-ethopex` — `apps/cty/worker/ethopex.mjs`, $0, không gọi mô hình)**:
1. Xử nút anh đã bấm trong chủ đề 📂 Ethopex: ✅ tăng ngân sách / ⏹ tắt camp qua API Ethopex (`apps/xuong-video/scripts/ethopex/lam-ethopex.py`) — chặn mức không hợp lệ, trần $20/camp, camp phải đang bật; làm xong đọc lại camp rồi trả lời ngay dưới tin.
2. Chấm mọi luật một lần (`apps/xuong-video/scripts/ethopex/luat-ethopex.py`, cùng luật với kb #261 mục 8–8g và tab Ethopex trang chủ mos2): lãi đầu phiên ROI > 50% → $2/$3 · đủ điều kiện tăng bậc (ROI tháng ≥ 20%, Spending > 50%) · ROI tụt (xem giảm / tắt) · tiêu > $10 lỗ > 50% → tắt · ad bị Meta từ chối → thay creative sạch · camp tiêu ~$30 vẫn lãi → hỏi Support scale bài viết cũ + bid ROAS.
3. Mục MỚI trong ngày → một tin mỗi nhóm vào 📂 Ethopex, nút duyệt cho từng camp; mục đã báo hôm nay không báo lại.

**Cấm**: tự tăng ngân sách / tự tắt camp khi anh chưa bấm; vượt trần $20/camp; đổi tài khoản QC, Page, pixel; xoá camp hay ad; lên camp mới.
