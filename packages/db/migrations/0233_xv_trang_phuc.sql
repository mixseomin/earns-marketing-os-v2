-- Trang phục của nhân vật TRONG TỪNG SHOT (09/10/2026): đè lên trang phục ghi trong mô tả cố định của anchor. Anh hỏi "làm sao bảo AI
-- sinh cảnh chỉ mặc áo lót chứ không mặc ngoài" — mô tả anchor Chị Lan có "áo thun trắng" + lệnh "giữ ĐÚNG như mô tả" làm model chồng bra lên áo thun.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS trang_phuc text NOT NULL DEFAULT '';
