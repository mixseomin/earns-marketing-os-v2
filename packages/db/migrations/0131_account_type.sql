-- account_type: phân loại account cho generation + badge UI ([P]/[B]/[S]).
--   personal = 1 người xuyên suốt MỌI project (không neo brand cố định) → sinh phải theo pin/task.
--   brand    = gắn 1 project/brand cụ thể → project_id account = nguồn brand khi sinh.
--   seeding  = community persona, không brand, không project cố định → như personal khi sinh.
-- Khác account_kind (user/bot/app — trục kỹ thuật login/bot). Idempotent.
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'brand';

-- Backfill data-driven: account KHÔNG gắn project → seeding; có gắn → giữ 'brand' (default).
UPDATE platform_accounts SET account_type = 'seeding'
  WHERE project_id IS NULL AND account_type = 'brand';
-- personal set thủ công (davidng…) sau deploy — không đoán id trong migration.
