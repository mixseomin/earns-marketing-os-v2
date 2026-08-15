-- Nền tảng network affiliate của mình (demo; publisher hiện là đội media buy in-house).
--
-- Ý chính về tracking: KHÔNG nhồi dữ liệu vào ô sub-id của network upstream. Nhét đúng MỘT mã
-- click rỗng nghĩa (`click_id`), mọi thứ khác tra ngược từ đây. CJ chỉ có 1 ô 64 ký tự nên đóng
-- gói kiểu `pub01-camp7-cr3` là tự trói; mà link đã nằm trong quảng cáo rồi thì sửa không được nữa.
--
-- Cấu trúc học từ net VN (AccessTrade/Adpia/MasOffer), ba điểm khác thiết kế ban đầu của mình:
--   1. Publisher phải ĐĂNG KÝ từng chiến dịch và được duyệt mới tạo được link → net_publisher_offers.
--   2. Sub-id của publisher là BỐN ô đặt tên kiểu utm, không phải một ô `s=`. Họ chia camp/creative
--      trong bốn ô đó mà không phải xin mình cấp thêm.
--   3. Hoa hồng có ba trạng thái đối soát (chờ → tạm duyệt → được duyệt/huỷ), không phải hai.
--      Ba trạng thái này KHÔNG lưu bảng: suy ra từ action-status + locking-date của CJ, xem
--      lib/network/status.ts. Lưu bảng khi nào cần sổ cái để TRẢ TIỀN, trước đó chỉ là bản sao chậm.

CREATE TABLE IF NOT EXISTS net_publishers (
  id          bigserial PRIMARY KEY,
  slug        text NOT NULL,                     -- nằm trong link, nên ngắn + ổn định
  name        text NOT NULL,
  -- Đăng nhập portal publisher dùng luôn user MOS2 (đội in-house đã có tài khoản). Publisher
  -- ngoài sau này chưa có user thì để trống, cấp sau — không đẻ hệ đăng nhập thứ hai lúc này.
  user_id     bigint,
  kind        text NOT NULL DEFAULT 'inhouse',   -- inhouse | external
  status      text NOT NULL DEFAULT 'active',    -- active | paused | banned
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS net_publishers_slug ON net_publishers (slug);
CREATE INDEX IF NOT EXISTS net_publishers_user ON net_publishers (user_id);

CREATE TABLE IF NOT EXISTS net_offers (
  id            bigserial PRIMARY KEY,
  slug          text NOT NULL,                   -- nằm trong link
  name          text NOT NULL,
  network       text NOT NULL,                   -- cj | awin | impact … khớp key affiliate-networks.ts
  advertiser    text,
  category      text,                            -- net VN xếp chiến dịch theo ngành, giữ nguyên nếp đó
  upstream_url  text NOT NULL,                   -- link CJ/Awin gốc, CHƯA có tham số sub-id
  -- Hai con số làm nên doanh thu: upstream trả mình bao nhiêu, mình trả publisher bao nhiêu.
  -- Để text vì mỗi network viết một kiểu ("8%", "$12 CPA", "20-62.25%") — chuẩn hoá sau, đừng ép sớm.
  upstream_rate  text,
  publisher_rate text,
  cookie_days   integer,
  terms         text,                            -- điều kiện ghi nhận đơn, publisher đọc trước khi đăng ký
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS net_offers_slug ON net_offers (slug);

-- Đăng ký chiến dịch. Đây là cái làm nên một NETWORK thay vì một cái rút gọn link: publisher chọn
-- chiến dịch, mình duyệt, duyệt rồi mới ra link. Cũng là chỗ về sau gắn rate riêng cho từng
-- publisher (thưởng người chạy tốt) mà không phải đẻ thêm bảng.
CREATE TABLE IF NOT EXISTS net_publisher_offers (
  id             bigserial PRIMARY KEY,
  publisher_id   bigint NOT NULL REFERENCES net_publishers (id) ON DELETE CASCADE,
  offer_id       bigint NOT NULL REFERENCES net_offers (id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  publisher_rate text,                             -- đè rate mặc định của offer, để trống = theo offer
  note           text,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz,
  decided_by     bigint
);
CREATE UNIQUE INDEX IF NOT EXISTS net_publisher_offers_uniq ON net_publisher_offers (publisher_id, offer_id);
CREATE INDEX IF NOT EXISTS net_publisher_offers_status ON net_publisher_offers (status, requested_at DESC);

-- Bảng DUY NHẤT mà mất là mất vĩnh viễn: đơn về sau 30 ngày mà không có dòng click tương ứng thì
-- không còn đường nào biết nó của publisher nào. Ghi TRƯỚC, redirect SAU — không đảo thứ tự.
CREATE TABLE IF NOT EXISTS net_clicks (
  id            bigserial PRIMARY KEY,
  click_id      text NOT NULL,
  offer_id      bigint NOT NULL REFERENCES net_offers (id) ON DELETE CASCADE,
  publisher_id  bigint REFERENCES net_publishers (id) ON DELETE SET NULL,
  -- Bốn ô sub-id của publisher, đặt tên theo utm cho quen tay (AccessTrade dùng đúng bộ này).
  -- Của họ, mình không diễn giải, chỉ trả lại nguyên văn trong báo cáo.
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  ip            inet,
  ua            text,
  country       text,
  referer       text,
  -- 'click' = lượt bấm thật. 'backfill' = dòng đối chiếu cho sid ĐẶT TAY trước khi có nền tảng này
  -- (vd `CJ_Trip_HK_13.8`), để đơn cũ vẫn quy được về publisher. Báo cáo phải LOẠI backfill khỏi
  -- số click, nếu không mình tự bịa ra lượt bấm chưa từng xảy ra.
  source        text NOT NULL DEFAULT 'click',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS net_clicks_click_id ON net_clicks (click_id);
CREATE INDEX IF NOT EXISTS net_clicks_created ON net_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS net_clicks_pub ON net_clicks (publisher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS net_clicks_offer ON net_clicks (offer_id, created_at DESC);

-- ── Dữ liệu mồi (demo) ───────────────────────────────────────────────────────
-- Một publisher + một chiến dịch có thật, để nền tảng chạy được ngay thay vì màn hình rỗng.
INSERT INTO net_publishers (slug, name, kind, note)
VALUES ('thoai', 'Thoai', 'inhouse', 'Đội media buy in-house')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO net_offers (slug, name, network, advertiser, category, upstream_url, upstream_rate, terms)
VALUES ('trip-hk', 'Trip.com HK', 'cj', 'Trip.com (Global)', 'du-lịch',
        'https://www.dpbolvw.net/kj122zw41w3JLKKLSQQQTJLPPNOSMK',
        '2.5% (CJ link 15534820)',
        'Đơn ghi nhận khi khách hoàn tất đặt phòng/vé. CJ khoá đơn theo locking-date, trước đó số tiền còn đổi được.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO net_publisher_offers (publisher_id, offer_id, status, decided_at)
SELECT p.id, o.id, 'approved', now() FROM net_publishers p, net_offers o
WHERE p.slug = 'thoai' AND o.slug = 'trip-hk'
ON CONFLICT (publisher_id, offer_id) DO NOTHING;

-- Đơn CJ $19.75 ngày 14/08 mang sid `CJ_Trip_HK_13.8` — đặt tay từ trước khi có nền tảng này.
-- Dòng đối chiếu dưới đây cho nó một chủ, nên báo cáo quy được về Thoai. source='backfill' để
-- nó KHÔNG bị đếm thành một lượt bấm.
INSERT INTO net_clicks (click_id, offer_id, publisher_id, utm_campaign, source, created_at)
SELECT 'CJ_Trip_HK_13.8', o.id, p.id, '3877648', 'backfill', timestamptz '2026-08-13 07:00:00-07'
FROM net_publishers p, net_offers o
WHERE p.slug = 'thoai' AND o.slug = 'trip-hk'
ON CONFLICT (click_id) DO NOTHING;
