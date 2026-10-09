-- Hoàn tác thao tác nhầm trong studio (#1252, anh 09/10/2026): mỗi lần SỬA/CHỌN (sửa shot, chọn keyframe, duyệt, chọn bản video,
-- đổi giọng, xếp lại thứ tự, sửa tập/kinh thánh/bài đăng) máy chụp giá trị CŨ của đúng các cột sắp đổi vào đây trước khi ghi.
-- ↶ Hoàn tác = ghi lại giá trị cũ của mục mới nhất chưa hoàn (cả nhóm — xếp thứ tự N shot là một nhóm). Xoá đã có thùng rác riêng.
CREATE TABLE IF NOT EXISTS xv_hoan_tac (
  id          serial PRIMARY KEY,
  phim_id     int NOT NULL,
  nhom        text NOT NULL,                        -- một thao tác = một nhóm (nhiều bản ghi khi xếp thứ tự)
  bang        text NOT NULL,                        -- xv_phim | xv_tap | xv_canh | xv_nhan_vat | xv_bien_the
  ban_ghi_id  int NOT NULL,
  cot         text[] NOT NULL,                      -- cột đã chụp
  truoc       jsonb NOT NULL,                       -- {cột: giá trị cũ}
  mo_ta       text NOT NULL DEFAULT '',             -- "sửa shot #3: chữ màn", "chọn keyframe · shot #7"
  nguoi       text NOT NULL DEFAULT '',
  da_hoan     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_hoan_tac_phim_idx ON xv_hoan_tac (phim_id, da_hoan, created_at DESC);
