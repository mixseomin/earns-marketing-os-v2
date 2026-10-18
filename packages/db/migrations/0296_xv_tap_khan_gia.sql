-- Ý đồ khán giả của tập (apps/xuong-video/src/lib/xuong-video/khan-gia.ts › YDoKhanGia[]): mỗi phần tử = một đoạn shot (id xv_canh từ → tới) + hiệu ứng
-- đạo diễn muốn khán giả cảm (vui · tò mò · hồi hộp · bất ngờ · đánh lừa A→B có shot lật · gieo phân vân · sợ…). Timeline vẽ làn 🎭 Ý đồ khán giả + máy soát.
ALTER TABLE xv_tap ADD COLUMN IF NOT EXISTS khan_gia jsonb NOT NULL DEFAULT '[]'::jsonb;
