-- Dự án plays riêng cho Công ty AI (cty.on.tc): góp ý 💬 trong cty rơi vào mos2.on.tc/p/cty/plays,
-- Claude nhặt bằng GOPY_PROJECT=cty scripts/gop-y.sh. 10/10/2026.
INSERT INTO projects (id, tenant_id, name, emoji, mode_id, color, website, one_liner)
VALUES ('cty', 'self', 'Công ty AI', '🏢', 'saas', '#0f6e73', 'https://cty.on.tc', 'Công ty AI: phòng ban, nhân sự có tên, nhiều mô hình qua API')
ON CONFLICT (id) DO NOTHING;
