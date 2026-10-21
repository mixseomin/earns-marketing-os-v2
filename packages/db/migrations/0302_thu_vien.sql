-- THƯ VIỆN THIẾT KẾ (anh 21/10/2026: "lưu vào thư viện thiết kế sau này dùng … tổ chức khoa học kèm hình minh hoạ, filter, treeview").
-- Một dòng = một mẫu tham khảo (repo, trang, video…). `nhanh` = các nút lá của sổ danh mục lib/thu-vien.ts (một mẫu nằm được nhiều nhánh);
-- `anh` = ảnh minh hoạ công khai (R2 qua lệnh chung `kho phat`); `ban_luu` = bản gốc cất lâu (Drive qua `kho cat`) — nguồn gốc biến mất vẫn còn.
CREATE TABLE IF NOT EXISTS thu_vien (
  id          serial PRIMARY KEY,
  ten         text NOT NULL,
  nhanh       text[] NOT NULL DEFAULT '{}',
  mo_ta       text NOT NULL DEFAULT '',
  cach_dung   text NOT NULL DEFAULT '',
  nguon_url   text,
  tac_gia     text,
  giay_phep   text,
  anh         text[] NOT NULL DEFAULT '{}',
  the         text[] NOT NULL DEFAULT '{}',
  ban_luu     text,
  tao_luc     timestamptz NOT NULL DEFAULT now(),
  cap_nhat    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS thu_vien_nguon ON thu_vien (nguon_url) WHERE nguon_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS thu_vien_nhanh ON thu_vien USING gin (nhanh);

INSERT INTO thu_vien (ten, nhanh, mo_ta, cach_dung, nguon_url, tac_gia, giay_phep, anh, the, ban_luu) VALUES (
  'I''m Upping My P(doom) — music video dựng bằng code',
  '{video-code,video-chu}',
  'Video ca nhạc dựng hoàn toàn bằng code (TypeScript + three.js): mỗi khung hình là hàm của thời điểm bài hát nên bản xem trước trên trình duyệt và bản xuất 1080p60/4K60 giống hệt nhau. Chữ karaoke khớp từng từ (căn lời bằng CTC + Whisper, nhịp/downbeat từ phân tích âm thanh), 17 cảnh (plate) mỗi cảnh một module, hậu kỳ bloom/halation/grain, motion blur lấy mẫu theo ô 32×32. Làm cùng Claude trong Claude Code.',
  'Mẫu cho video tự động của xưởng: (1) khung thời gian bám lời + lưới nhịp (src/timeline.ts) cho short có nhạc; (2) chữ karaoke từng từ cho video lời/quote; (3) xuất bằng Chrome headless → khung thô qua WebSocket → ffmpeg (scripts/render.ts) — chạy được trên box, không cần After Effects; (4) motion blur theo ô cho chuyển động nhanh. Đọc docs/ENGINE.md (API cảnh) + docs/TREATMENT.md (style bible) trước khi chép.',
  'https://github.com/mexicat/pdoom-video', 'mexicat', 'MIT (mã) — bài hát KHÔNG thuộc tác giả repo, chỉ dùng tham khảo nội bộ',
  '{https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig01.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig02.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig03.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig04.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig05.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig06.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig07.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig08.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig09.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig10.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig11.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig12.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig13.jpg,https://img.on.tc/kho/mos2/nguon/2026-10/pdoom-video-fig14.jpg}',
  '{three.js,karaoke,kinetic typography,generative,music video,motion blur,ffmpeg,headless chrome,TypeScript}',
  'kho-may/thu-vien/nguon/2026-10/pdoom-video-20261021.tar.gz'
) ON CONFLICT DO NOTHING;
