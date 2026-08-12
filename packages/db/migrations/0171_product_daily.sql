-- Số theo ngày cho sản phẩm tự bán. Gumroad API v2 chỉ trả tổng cộng dồn và không có lượt xem;
-- lượt xem do job trình duyệt đọc từ trang Analytics rồi đẩy vào đây.
CREATE TABLE IF NOT EXISTS product_daily (
  id          bigserial PRIMARY KEY,
  store       text NOT NULL,
  product_id  text NOT NULL,
  date        text NOT NULL,
  views       integer NOT NULL DEFAULT 0,
  sales       integer NOT NULL DEFAULT 0,
  usd_cents   integer NOT NULL DEFAULT 0,
  source      text NOT NULL DEFAULT 'browser',
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_daily_uniq ON product_daily (store, product_id, date);
CREATE INDEX IF NOT EXISTS product_daily_date_idx ON product_daily (date);
