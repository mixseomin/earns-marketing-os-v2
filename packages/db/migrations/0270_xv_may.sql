-- MÁY → VIDEO (anh 17/10/2026, duyệt bố cục "3 cửa vào: Tự động · Theo template · Làm tự do"): video sinh hàng loạt bằng máy KHÔNG còn là
-- phim / tập / shot riêng. Một MÁY = mẫu dựng + nguồn đề + luật chọn + nơi đăng; mỗi VIDEO là một dòng nhẹ (đề, video, 3 khung, sổ đăng từng nền).
-- Sổ đăng (trước là tệp da-dang-<nền>.json trên iMac / MacBook) chuyển vào xv_may_video.da_dang — một chỗ cho mọi máy đọc / ghi.
CREATE TABLE IF NOT EXISTS xv_may (
  id serial PRIMARY KEY,
  ma text NOT NULL UNIQUE,                       -- khoá cho script (front-porch-only-one)
  ten text NOT NULL,
  du_an text NOT NULL,
  muc_dich text NOT NULL DEFAULT '',             -- nhóm trên danh sách: Bán sách · Kéo về site aff …
  mau text NOT NULL,                             -- mẫu dựng (may-dung-mau.ts › MAU_MAY_DUNG)
  nguon jsonb NOT NULL DEFAULT '{}'::jsonb,      -- { mo_ta, dung, tong } — máy nguồn tự ghi số
  luat jsonb NOT NULL DEFAULT '[]'::jsonb,       -- các luật chọn đề kế (chữ hiển thị)
  dang jsonb NOT NULL DEFAULT '[]'::jsonb,       -- [{ nen, ten, tk, gio, tran, kem, may }]
  chay boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS xv_may_video (
  id serial PRIMARY KEY,
  may_id int NOT NULL REFERENCES xv_may(id),
  slug text NOT NULL,
  chu_de text NOT NULL DEFAULT '',
  de jsonb NOT NULL,                             -- đề của mẫu (DeMotDung …)
  dang jsonb NOT NULL DEFAULT '{}'::jsonb,       -- chữ đăng: title / description / link / book / words
  nen_url text,
  video_url text,
  khung jsonb NOT NULL DEFAULT '[]'::jsonb,      -- 3 ảnh khung (giữa từng shot của mẫu), cắt từ bản dựng
  giay numeric,
  xuat_luc timestamptz,
  da_dang jsonb NOT NULL DEFAULT '{}'::jsonb,    -- { tiktok: { url, ngay, binhLuan? }, youtube: … }
  luu_tru boolean NOT NULL DEFAULT false,
  phim_id int,                                   -- phim Máy Dựng cũ (xv_phim) mà video này chuyển từ đó, để truy lại
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (may_id, slug)
);
CREATE INDEX IF NOT EXISTS xv_may_video_may_idx ON xv_may_video (may_id, id DESC);

INSERT INTO xv_may (ma, ten, du_an, muc_dich, mau, nguon, luat, dang, chay) VALUES (
  'front-porch-only-one', 'Only ONE is spelled right', 'puzzle-books', 'Bán sách · Front Porch Puzzles', 'do-chu-mot-dung',
  '{"mo_ta": "Chủ đề trong 3 cuốn sách (nostalgia, christmas, bible)", "dung": 57, "tong": 300}'::jsonb,
  '["Chỉ chủ đề đang mùa hoặc quanh năm", "Chủ đề sắp hết mùa trước", "Xoay vòng: sách ít video nhất trước", "Chủ đề dựng hỏng thì bỏ qua lần sau"]'::jsonb,
  '[{"nen": "tiktok", "ten": "TikTok", "tk": "@uriellrqv5g", "gio": "20:00", "tran": 1, "kem": "mã TT20", "may": "iMac"},
    {"nen": "youtube", "ten": "YouTube Shorts", "tk": "@frontporchpuzzles", "gio": "20:05", "tran": 1, "kem": "bình luận link đáp án + mã YT20", "may": "MacBook"},
    {"nen": "facebook", "ten": "Facebook Reels", "tk": "Page Front Porch Puzzles", "gio": "20:05", "tran": 1, "kem": "mã FB20", "may": "MacBook"},
    {"nen": "instagram", "ten": "Instagram Reels", "tk": "@frontporchpuzzles", "gio": "20:05", "tran": 1, "kem": "mã IG20", "may": "MacBook"}]'::jsonb,
  true
) ON CONFLICT (ma) DO NOTHING;

-- Chuyển 57 phim Máy Dựng (puzzle-books) thành video của máy: đề + chữ đăng + bản xuất mới nhất + 3 khung; phim cũ (đã lưu trữ) vẫn lưu trữ.
INSERT INTO xv_may_video (may_id, slug, chu_de, de, dang, nen_url, video_url, khung, giay, xuat_luc, luu_tru, phim_id, created_at)
SELECT m.id, p.kinh_thanh->'may_dung'->>'slug', coalesce(p.kinh_thanh->'may_dung'->>'chu_de', ''), p.kinh_thanh->'may_dung'->'de',
  coalesce(p.kinh_thanh->'may_dung'->'dang', '{}'::jsonb), p.kinh_thanh->'may_dung'->>'nen_url', t.video_url,
  coalesce((SELECT jsonb_agg(c.keyframe_url ORDER BY c.thu_tu) FROM xv_canh c WHERE c.tap_id = t.id AND c.keyframe_url IS NOT NULL), '[]'::jsonb),
  CASE WHEN t.video_url IS NOT NULL THEN 11.8 END, (t.xuat->-1->>'luc')::timestamptz,
  coalesce((p.kinh_thanh->>'luu_tru')::boolean, false), p.id, p.created_at
FROM xv_phim p
JOIN xv_may m ON m.ma = 'front-porch-only-one'
LEFT JOIN LATERAL (SELECT * FROM xv_tap WHERE phim_id = p.id ORDER BY so, id LIMIT 1) t ON true
WHERE p.loai = 'may_dung' AND p.kinh_thanh->'may_dung'->>'du_an' = 'puzzle-books'
ON CONFLICT (may_id, slug) DO NOTHING;

-- Phim Máy Dựng cũ không còn hiện ở danh sách Phim (video ở cửa Tự động): đánh dấu lưu trữ, không xoá.
UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{luu_tru}', 'true'::jsonb)
WHERE loai = 'may_dung' AND coalesce((kinh_thanh->>'luu_tru')::boolean, false) = false;
