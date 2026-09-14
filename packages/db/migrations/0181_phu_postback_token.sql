-- Token postback theo MẠNG affiliate (adapter postback-<mạng>), không theo nguồn traffic: mạng gọi về
-- một URL cho mọi campaign, nguồn nằm trong sid. Token của phu_nguon giữ lại (route vẫn nhận) nhưng
-- trang chỉ hiện URL theo mạng.
ALTER TABLE phu_adapter ADD COLUMN IF NOT EXISTS postback_token text;
UPDATE phu_adapter SET postback_token = encode(gen_random_bytes(12), 'hex') WHERE loai = 'postback' AND postback_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS phu_adapter_postback_token ON phu_adapter (postback_token) WHERE postback_token IS NOT NULL;
