-- Tên miền riêng cho link theo dõi của từng publisher.
--
-- Vì sao cần: link `pub.on.tc/t/<token>` lộ hạ tầng của mình và gộp mọi publisher vào một tên miền
-- — Facebook chặn tên miền nào thì chết tất cả cùng lúc. Publisher ngoài cũng muốn link mang tên
-- họ, nhìn tự nhiên hơn khi dán ra ngoài.
--
-- Hạ tầng đã sẵn: middleware cho `/t/*` chạy trên MỌI host (viết vậy từ đầu, vì link đã phát ra
-- ngoài rồi thì đổi host là gãy). Nên bật tính năng này chỉ cần DNS + vhost, không cần sửa route.
--
-- Lưu ĐÚNG phần host, không lưu cả URL: 'go.militarycalc.com'. Ai đó dán nguyên
-- 'https://go.militarycalc.com/' vào thì trackingUrl sẽ dựng ra link hỏng, nên chuẩn hoá ở tầng
-- ghi (actions/network.ts) chứ không đi sửa ở mọi chỗ đọc.
ALTER TABLE net_publishers ADD COLUMN IF NOT EXISTS link_domain text;

COMMENT ON COLUMN net_publishers.link_domain IS
  'Host riêng phục vụ /t/<token> cho publisher này (vd go.militarycalc.com). NULL = dùng PUB_ORIGIN chung.';
