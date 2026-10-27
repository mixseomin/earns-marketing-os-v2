-- TIÊU CHÍ MỚI HỌC TỪ CA META TỪ CHỐI THẬT (anh 27/10/2026: "60419: sao máy chấm lại cho điểm sạch creative này?").
-- Gốc: bộ tiêu chí Meta chỉ có khoả thân (hình), cưỡng ép, bạo lực, vũ khí, ngôn từ (chửi tục), giật tít — KHÔNG có mục nào cho
-- "Adult Sexual Solicitation and Sexually Explicit Language", là chính sách Meta xét CHỮ + LỜI (mua bán / bao nuôi / gạ gẫm), không xét hình.
-- #60419 hình kín đáo, không chửi tục → máy cho 9–10 ở mọi mục; Meta từ chối vì lời thoại "I'm your boss / I spend money to back you, know your place",
-- "You can have any woman you want", "I'm seriously doubting your sexuality". Máy chấm đọc etp.tieu_chi nên học ngay, không sửa mã.
INSERT INTO etp.tieu_chi (nhom, ma, ten, mo_ta, thu_tu) VALUES ('meta', 'ga_gam', 'Gạ gẫm · lời tình dục',
  'Adult Sexual Solicitation & Sexually Explicit Language — judged on on-screen TEXT and spoken VOICE (even when every frame is modest). Score 4 or less for ANY of: a man paying for, keeping or "backing" a woman in exchange for her company or obedience (sugar-daddy / kept-woman / "I spend money on you, know your place"); "you can have any woman you want" or women offered, bought or traded; asking someone to spend the night, sleep with, or "serve" someone; jokes or remarks about someone''s sexuality or sex life ("doubting your sexuality", "is he even a man"); explicit or suggestive sexual words, innuendo about bed, body or virginity; escort, mistress, one-night-stand or contract-lover wording in subtitles or the drama title. Real rejections: creative #60419 (Mimada por el Multimillonario Amigo de Mi Exmarido — "I''m your boss, I spend money to back you", "You can have any woman you want", "I''m seriously doubting your sexuality") → rejected for Adult Sexual Solicitation and Sexually Explicit Language.',
  3)
ON CONFLICT (nhom, ma) DO UPDATE SET ten = excluded.ten, mo_ta = excluded.mo_ta;
UPDATE etp.tieu_chi SET thu_tu = thu_tu + 1 WHERE nhom = 'meta' AND ma IN ('bao_luc', 'vu_khi', 'ngon_tu', 'giat_tit');
-- phốt cũ đã ghi nhầm vào khoả thân (dong-bo.py gộp mọi chữ "Sexual" vào khoa_than) → sang nhóm mới
UPDATE etp.phot SET nhom = 'ga_gam' WHERE ly_do ~* 'Solicitation|Sexually Explicit Language' AND nhom = 'khoa_than';
