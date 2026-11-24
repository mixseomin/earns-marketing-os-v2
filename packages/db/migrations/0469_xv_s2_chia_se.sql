-- Studio 2: chia sẻ phim CHỈ XEM cho người trong đội (anh 24/11/2026: "chia sẻ video mới này cho tk doanhoe. Ko cho quyền edit, nhưng có thể clone để edit thoải mái").
-- Người nhận đọc được phim (quyen-s2.ts › XEM) và bấm "Nhân bản để sửa" (nhanBanPhimS2) để có bản của mình; mọi hàm ghi khác bị từ chối.
CREATE TABLE IF NOT EXISTS xv_s2_chia_se (
  phim_id integer NOT NULL REFERENCES xv_phim(id) ON DELETE CASCADE,
  user_id integer NOT NULL,
  quyen text NOT NULL DEFAULT 'xem',
  boi integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phim_id, user_id)
);
CREATE INDEX IF NOT EXISTS xv_s2_chia_se_user ON xv_s2_chia_se (user_id);
-- phim #7999 "Lá số không đoán tương lai của tôi, nó giải thích tôi" → doanhoe (user 12), anh chia sẻ
INSERT INTO xv_s2_chia_se (phim_id, user_id, boi)
SELECT 7999, 12, 1 WHERE EXISTS (SELECT 1 FROM xv_phim WHERE id = 7999) AND EXISTS (SELECT 1 FROM users WHERE id = 12)
ON CONFLICT DO NOTHING;
