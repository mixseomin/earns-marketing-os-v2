-- SHOT CON (anh 01/11/2026: "#2.9 … sub của shot #2, đoạn cuối của #2, liền mạch với đoạn cuối #2" · "#3.1 … đoạn khớp hứng đoạn 2.9"):
-- thu_tu = số XẾP PHÁT (nhận số lẻ: #2.9 → 2.04 phát ngay sau #2, #3.1 → 2.51 phát ngay trước #3 — kieu.ts › khoaPhat) nên mọi ORDER BY thu_tu xếp đúng;
-- so_hien = số HIỆN cho người (2.9, 3.1; NULL = như thu_tu); con_cua = id shot cha. Không dồn số các shot khác, sổ theo số shot giữ nguyên.
ALTER TABLE xv_canh ALTER COLUMN thu_tu TYPE numeric(9,4) USING thu_tu::numeric;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS so_hien numeric(9,4);
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS con_cua integer;
