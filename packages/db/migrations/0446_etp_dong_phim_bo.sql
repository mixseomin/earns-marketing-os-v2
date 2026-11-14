-- BỘ TÀI KHOẢN ANH CHỌN cho dòng phim (anh 15/11/2026 "thao tác chỉ có vài loại? số lượng cũng ko được thay đổi, chưa hiện bộ tk được chọn — ko linh hoạt"):
-- null = máy chọn như cũ (apps/etp/cong.py SQL_BO_PHIM: bộ đổi của phim / bo_phim_moi); '1'–'5' = lên camp đúng bộ đó (apps/etp/dong_phim.py b_camp_mr).
alter table etp.dong_phim add column if not exists bo text;
