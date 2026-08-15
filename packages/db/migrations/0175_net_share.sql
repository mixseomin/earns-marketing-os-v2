-- Tỉ lệ CẮT của nhà (phần mình giữ lại), ba tầng đè lên nhau.
--
-- Trước: hằng số `PUB_SHARE = 0.7` nằm trong code — muốn đổi phải sửa file rồi deploy, và không
-- đổi riêng cho một offer hay một publisher được. Mà đây đúng là con số phải thương lượng: offer
-- biên mỏng thì cắt ít, publisher chạy khoẻ thì cắt ít hơn nữa.
--
-- Lưu PHẦN NHÀ GIỮ (`cut_pct`, 0-100) chứ không lưu phần publisher hưởng: đó là cách người ta nói
-- khi đàm phán ("cắt 30%"), và lưu đúng cái người ta nói thì không ai phải đổi ngược trong đầu.
--
-- Thứ tự đè, CỤ THỂ THẮNG CHUNG:
--   1. net_publisher_offers.publisher_rate — mức tuyệt đối cho một cặp pub × chiến dịch (đã có).
--      Thắng tất cả, vì nó không phải tỉ lệ mà là con số đã chốt.
--   2. net_publishers.cut_pct   — thoả thuận riêng với NGƯỜI. Cam kết cá nhân đè mặc định sản phẩm.
--   3. net_offers.cut_pct       — mặc định của một chiến dịch.
--   4. net_settings 'cut_pct'   — mức chung toàn network.
-- KHÔNG nhân chồng các tầng với nhau: nhân thì không ai nhẩm ra được mình đang ăn bao nhiêu.

CREATE TABLE IF NOT EXISTS net_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO net_settings (key, value) VALUES ('cut_pct', '30')
ON CONFLICT (key) DO NOTHING;

-- NULL = theo tầng trên nó, KHÔNG phải 0. Để 0 làm mặc định thì một hàng chưa ai đụng tới sẽ có
-- nghĩa "cắt 0%" — mình cho không toàn bộ hoa hồng mà không ai bấm nút nào.
ALTER TABLE net_offers     ADD COLUMN IF NOT EXISTS cut_pct numeric(5,2);
ALTER TABLE net_publishers ADD COLUMN IF NOT EXISTS cut_pct numeric(5,2);

ALTER TABLE net_offers     DROP CONSTRAINT IF EXISTS net_offers_cut_pct_range;
ALTER TABLE net_offers     ADD  CONSTRAINT net_offers_cut_pct_range     CHECK (cut_pct IS NULL OR (cut_pct >= 0 AND cut_pct <= 100));
ALTER TABLE net_publishers DROP CONSTRAINT IF EXISTS net_publishers_cut_pct_range;
ALTER TABLE net_publishers ADD  CONSTRAINT net_publishers_cut_pct_range CHECK (cut_pct IS NULL OR (cut_pct >= 0 AND cut_pct <= 100));
