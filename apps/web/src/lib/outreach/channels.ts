// Outreach channel taxonomy — the full list of ways to reach a site owner, ported from orit.app's
// channel model (orit-extension TIPS/ICONS/groups + orit /domain/:domain discovery). One prospect can
// be reached via any of these; email/form auto/semi, the rest are ext-assisted (operator clicks Send —
// social platforms ban automation). Approach tip = the RIGHT way to use each channel (not spam a link).
// See decisions/2026-07-20-outreach-multichannel-plan.md.
export type ChannelGroup = 'email' | 'form' | 'social' | 'messaging' | 'developer' | 'reviews' | 'creator';

export interface ChannelDef {
  key: string;
  label: string;
  icon: string;
  group: ChannelGroup;
  send: 'auto' | 'semi' | 'assisted';   // auto=Mailjet cron · semi=open+paste (form) · assisted=ext opens compose, human sends
  tip: string;                          // how to approach on this channel (Vietnamese, operator-facing)
}

export const CHANNELS: ChannelDef[] = [
  { key: 'email', label: 'Email', icon: '✉️', group: 'email', send: 'auto', tip: 'Gửi thẳng, cá nhân hoá subject. Tự động qua Mailjet.' },
  { key: 'contact_form', label: 'Contact form', icon: '📝', group: 'form', send: 'semi', tip: 'Mở form của họ, dán intro 3 dòng sắc gọn.' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in', group: 'social', send: 'assisted', tip: 'Kết nối kèm note nhắc điểm chung; hợp B2B/chuyên môn/.edu.' },
  { key: 'x', label: 'X / Twitter', icon: '𝕏', group: 'social', send: 'assisted', tip: 'Tương tác với tweet của họ trước, rồi DM ngắn.' },
  { key: 'facebook', label: 'Facebook', icon: 'f', group: 'social', send: 'assisted', tip: 'Nhắn qua Page hoặc group chung; DM ngắn có ngữ cảnh.' },
  { key: 'instagram', label: 'Instagram', icon: '📷', group: 'social', send: 'assisted', tip: 'Comment post trước, rồi DM kèm ngữ cảnh.' },
  { key: 'reddit', label: 'Reddit', icon: '🤖', group: 'social', send: 'assisted', tip: 'Reply post/comment của họ bằng giá trị thật, không spam link.' },
  { key: 'youtube', label: 'YouTube', icon: '▶️', group: 'social', send: 'assisted', tip: 'Comment video mới bằng nhận xét thật, gài nhẹ.' },
  { key: 'comment', label: 'Comment trên post', icon: '🗨️', group: 'social', send: 'assisted', tip: 'Bình luận đúng nội dung bài của họ, gài tool tự nhiên.' },
  { key: 'telegram', label: 'Telegram', icon: '✈️', group: 'messaging', send: 'assisted', tip: 'DM ngắn gọn, thẳng vào việc.' },
  { key: 'discord', label: 'Discord', icon: '🎮', group: 'messaging', send: 'assisted', tip: 'Vào server của họ, tương tác kênh chung trước.' },
  { key: 'medium', label: 'Medium', icon: '📝', group: 'developer', send: 'assisted', tip: 'Comment bài của họ, rồi email.' },
  { key: 'devto', label: 'dev.to', icon: '👩‍💻', group: 'developer', send: 'assisted', tip: 'Comment bài của họ, rồi liên hệ.' },
  { key: 'github', label: 'GitHub', icon: '🐙', group: 'developer', send: 'assisted', tip: 'Mở issue hoặc góp PR cho repo của họ.' },
];

export const CHANNEL_BY_KEY: Record<string, ChannelDef> = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));

// Map an orit channel_type (from /domain/:domain discovery) onto our channel key. twitter→x, etc.
export function channelKeyFromOrit(oritType: string): string {
  const t = (oritType || '').toLowerCase();
  if (t === 'twitter') return 'x';
  if (t === 'website') return 'contact_form';
  return CHANNEL_BY_KEY[t] ? t : 'other';
}
