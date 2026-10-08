-- Dự án plays riêng cho Xưởng video (studio.on.tc): góp ý 💬 trong studio rơi vào mos2.on.tc/p/xuong-video/plays,
-- Claude nhặt bằng GOPY_PROJECT=xuong-video scripts/gop-y.sh (lệnh /tasks-studio). 08/10/2026.
INSERT INTO projects (id, tenant_id, name, emoji, mode_id, color, website, one_liner)
VALUES ('xuong-video', 'self', 'Xưởng video', '🎬', 'saas', '#a78bfa', 'https://studio.on.tc', 'Xưởng video AI: kịch bản → storyboard → keyframe → clip')
ON CONFLICT (id) DO NOTHING;
