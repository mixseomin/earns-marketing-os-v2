-- BỘ CHẤM CREATIVE (anh 25/10/2026: "mọi creative đều phải show chi tiết đã quét text, ảnh, nội dung, voice… chưa và có điểm chấm so với yêu cầu
-- của Meta. Ngoài ra có thêm bộ chấm riêng cho AFS về content ads, CTA…" · "chia thành group các cột của từng nhóm chấm điểm" · "sạch và bền nhất").
-- MỘT nguồn tiêu chí: etp.tieu_chi — máy chấm (apps/xuong-video/scripts/ethopex/cham-creative.py) đọc để hỏi, trang etp đọc để dựng nhóm cột.
-- Thêm / sửa tiêu chí = sửa bảng này (migration mới), không sửa mã.
CREATE TABLE IF NOT EXISTS etp.tieu_chi (
  nhom     text NOT NULL,            -- meta | afs
  ma       text NOT NULL,            -- khoá ngắn, ổn định (cột điểm)
  ten      text NOT NULL,            -- tên hiện trên trang (lời thường)
  mo_ta    text NOT NULL,            -- câu hỏi cho máy chấm (tiếng Anh, đúng chính sách)
  thu_tu   smallint NOT NULL,
  PRIMARY KEY (nhom, ma)
);
INSERT INTO etp.tieu_chi (nhom, ma, ten, mo_ta, thu_tu) VALUES
  ('meta', 'khoa_than', 'Khoả thân · gợi dục', 'Adult Nudity & Sexual Activity: nudity, exposed intimate parts, sheer / see-through or lingerie close-ups, sexual acts or strongly sexualised posing, bed scenes implying sex, suggestive dialogue.', 1),
  ('meta', 'cuong_ep', 'Cưỡng ép tình dục', 'Adult Sexual Exploitation: forced or non-consensual sexual touching, a person pinned / cornered against a wall or bed while another leans in face-to-face, clothes torn, a victim crying after a struggle, any implied sexual threat, prostitution talk.', 2),
  ('meta', 'bao_luc', 'Máu · bạo lực', 'Violent & Graphic Content: blood, injuries, gore, beating, a person tied up or restrained, death or dead bodies, words like kill / dead / murder.', 3),
  ('meta', 'vu_khi', 'Vũ khí · nguy hiểm', 'Weapons & Dangerous Acts: guns, knives or swords pointed at or used on a person, self-harm, drug use, dangerous stunts.', 4),
  ('meta', 'ngon_tu', 'Ngôn từ', 'Profanity, hate speech, bullying or degrading insults in on-screen text or spoken voice.', 5),
  ('meta', 'giat_tit', 'Giật tít · gây sốc', 'Sensational or shocking content, misleading claims, before/after or personal-attribute targeting ("Are you divorced?").', 6),
  ('afs', 'cta', 'CTA đúng mẫu', 'The end CTA must read exactly "WATCH FREE · LEARN MORE" / "MÍRALA GRATIS · MÁS INFORMACIÓN": no Tap / Click / Toca, no arrows, pointing hands or icons, no countdown, no "limited time", no FREE / GRATIS badge.', 1),
  ('afs', 'du_nhap', 'Không dụ nhấp', 'No click-bait or pressure to click: no fake buttons, fake system notifications or play icons, no voice urging to tap or click, no exaggerated urgency.', 2),
  ('afs', 'khop_dich', 'Khớp nội dung đích', 'The ad shows real scenes and the real title of the drama the click leads to; nothing promised that the landing page will not deliver.', 3),
  ('afs', 'an_toan', 'An toàn thương hiệu', 'Google advertiser brand safety (stricter than Meta): no sexual innuendo, violence, crime glorification, shocking or disturbing imagery anywhere in the video.', 4),
  ('afs', 'chat_luong', 'Chất lượng hình · tiếng', 'Clean production: no leftover overlays / watermarks / buttons from the source app, no broken frames, audio and subtitles in sync, text readable.', 5)
ON CONFLICT (nhom, ma) DO UPDATE SET ten = excluded.ten, mo_ta = excluded.mo_ta, thu_tu = excluded.thu_tu;

-- Mỗi creative một dòng: bốn lớp quét (đã quét chưa + nội dung đọc được) và điểm 0–10 từng tiêu chí (10 = sạch hoàn toàn).
CREATE TABLE IF NOT EXISTS etp.cham (
  creative_id  integer PRIMARY KEY,
  doan         text,                         -- content:từ-đến
  luc          timestamptz NOT NULL DEFAULT now(),
  may          text,                         -- máy chấm (iMac / box3)
  lop          jsonb NOT NULL DEFAULT '{}',  -- {chu|giong|anh|noi_dung: {luc, ...}} — lớp nào thiếu khoá = chưa quét
  diem         jsonb NOT NULL DEFAULT '{}',  -- {"meta.khoa_than": 9, "afs.cta": 10, ...}
  ly_do        jsonb NOT NULL DEFAULT '{}',  -- {"meta.khoa_than": "khung 12: ...", ...} chỉ ghi khi điểm < 10
  meta         smallint,                     -- điểm nhóm = điểm thấp nhất trong nhóm (một tiêu chí hỏng là hỏng)
  afs          smallint,
  ket          text,                         -- ok | cam | xem
  loi          text                          -- lỗi kỹ thuật lượt chấm (lớp nào không chạy được)
);
CREATE INDEX IF NOT EXISTS etp_cham_ket ON etp.cham (ket);
