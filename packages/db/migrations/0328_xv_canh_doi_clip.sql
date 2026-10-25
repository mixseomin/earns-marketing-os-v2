-- Xưởng video: ĐỔI CLIP của shot thì xoá các thông số GẮN VỚI CLIP CŨ (25/10/2026, phim #353: sinh lại #9 mà điểm vào 5,98 s của clip cụm cũ còn
-- nguyên → bản dựng cắt từ đoạn đuôi hỏng của clip mới). Gắn ở DB để MỌI đường ghi clip (sinh video, chọn phiên bản, kho, nạp diễn, script) đều đúng.
-- Câu lệnh nào đổi clip mà CŨNG đặt giá trị mới cho trường đó (sinh-cum ghi vao_s + cum cùng lúc) thì giữ giá trị mới.
--   ky_thuat.vao_s      điểm vào trong clip           ky_thuat.cum        clip này là clip cụm nào
--   ky_thuat.khung_lai  khung dựng lại theo điểm nhìn   cat_cuoi_s          điểm cắt cuối đo trên clip
CREATE OR REPLACE FUNCTION xv_canh_doi_clip() RETURNS trigger AS $$
BEGIN
  IF NEW.video_url IS DISTINCT FROM OLD.video_url OR NEW.video_cuoi_url IS DISTINCT FROM OLD.video_cuoi_url THEN
    IF (NEW.ky_thuat -> 'vao_s') IS NOT DISTINCT FROM (OLD.ky_thuat -> 'vao_s') THEN NEW.ky_thuat := NEW.ky_thuat - 'vao_s'; END IF;
    IF (NEW.ky_thuat -> 'cum') IS NOT DISTINCT FROM (OLD.ky_thuat -> 'cum') THEN NEW.ky_thuat := NEW.ky_thuat - 'cum'; END IF;
    IF (NEW.ky_thuat -> 'khung_lai') IS NOT DISTINCT FROM (OLD.ky_thuat -> 'khung_lai') THEN NEW.ky_thuat := NEW.ky_thuat - 'khung_lai'; END IF;
    IF NEW.cat_cuoi_s IS NOT DISTINCT FROM OLD.cat_cuoi_s THEN NEW.cat_cuoi_s := NULL; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xv_canh_doi_clip ON xv_canh;
CREATE TRIGGER xv_canh_doi_clip BEFORE UPDATE OF video_url, video_cuoi_url ON xv_canh FOR EACH ROW EXECUTE FUNCTION xv_canh_doi_clip();
