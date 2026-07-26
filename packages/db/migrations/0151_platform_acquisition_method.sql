-- P3 no-signup backlink routing (decision earns-strategy 2026-07-27):
-- phương thức lấy được backlink ở platform này khi KHÔNG tạo account thường được.
-- enum (ext ghi): oauth_only | no_account_form | guest_post_email | gated | no_ugc
-- NULL = self-serve / chưa phân loại. Nhớ per-platform → advisor bỏ bước tạo account lần sau + report phân bổ nhân sự.
ALTER TABLE "platforms" ADD COLUMN IF NOT EXISTS "acquisition_method" text;
