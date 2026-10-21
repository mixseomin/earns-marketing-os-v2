#!/usr/bin/env bash
# KIỂM NGÂN SÁCH CAMP ETHOPEX (rule nhóm Support Ads — anh chuyển 20/10 + 21/10/2026). CHỈ ĐỌC + BÁO: mọi lần tăng / giảm / tắt phải được anh DUYỆT đúng camp đó.
#  TĂNG: cột Spending = cost / budget. Camp ROI CAO và Spending > 50% (chi tiêu lên mà ROI vẫn giữ) → tăng MỘT bậc theo thang
#        $1 → 3 → 5 → 7 → 10 → 15 → 20, TRẦN $20/camp (giữ ROI cao). Một ngày tác động tăng tối đa 2–3 lần.
#  KHUNG GIỜ (21/10/2026, Dol Dang): camp chạy chủ yếu Mỹ → hiệu suất tốt nhất 21h hôm nay – 5h sáng hôm sau (giờ VN). Khi tối ưu scale, tăng vào
#        các mốc ~21h · ~24h · 8h (giờ VN). KHÔNG thu ngân sách lại sau khung — tăng tới mốc vừa phải rồi để camp tự chạy, theo dõi ROI.
#        Ngân sách đang thấp ($1–3) thì chưa cần canh giờ.
#  GIẢM / TẮT: chỉ khi phim đi xuống (down trend) hoặc creative bão hoà → CPC/CPA tăng, ROI tụt → báo anh để giảm ngân sách hoặc tắt camp.
#        Máy so ROI 3 ngày gần nhất với 4 ngày trước đó (camp đã chi ≥ $3): ROI tụt từ ≥ ngưỡng xuống < 0, hoặc tụt ≥ 30 điểm → "CẦN XEM GIẢM / TẮT".
#  LÃI ĐẦU PHIÊN (Dol Dang 21/10/2026: "phim trends win… đầu phiên nó lãi thì mình tăng luôn" + "chỉ tăng budget những camp ROI > 50%"): camp lãi hôm nay,
#        đã chi ≥ $0,5, ROI hôm nay > 50% → tăng luôn lên $2 (ROI 50–100%) / $3 (ROI ≥ 100%), không chờ Spending > 50%. Camp ≥ $3 đi theo thang trên.
#  TẮT CAMP (Dol Dang 21/10/2026, tạm thời): camp tiêu TỪ TRƯỚC TỚI NAY > $10 mà ROI < −50% → tắt. Máy đọc report all-time, báo "CẦN TẮT"; tắt = anh.
#  MỐC $30 (Dol Dang 21/10/2026): camp tiêu tới ~$30 mà vẫn lãi → báo để nhóm Support chỉ cách scale bài viết cũ + bid ROAS (rule mới lúc đó).
#  NHÂN BẢN: phim có camp đạt → Duplicate camp + thêm creative cùng phim (phim phải nằm trong danh sách phim thắng anh duyệt, kiem-so-camp.sh).
# Luật chấm ở MỘT chỗ: luat-ethopex.py (chạy trên box3, đọc API Report + chi tiết camp, khoá ở studio) — phòng Ethopex của cty (Phát) gọi cùng tệp đó.
# Dùng: kiem-ngan-sach.sh [roi_toi_thieu=20] [spending_toi_thieu=50]
set -u
ROI_MIN=${1:-20}; SP_MIN=${2:-50}
ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 apps/xuong-video/scripts/ethopex/luat-ethopex.py $ROI_MIN $SP_MIN"
