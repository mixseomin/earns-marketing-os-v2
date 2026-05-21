// 0057 Join membership state — TÁCH HẲN khỏi engagement phase.
// File riêng (không có 'use server') để export const/object cho client import.
// Server actions vẫn ở community-briefs.ts, chỉ re-export type từ đây.

export type JoinStatus =
  | 'not_joined'   // mới tạo brief, chưa thử join
  | 'pending'      // đã gửi join request, chờ approve
  | 'joined'       // ✅ đã trong community, có thể warm/engage/post
  | 'rejected'     // admin/mod từ chối join request
  | 'kicked'       // bị kick sau khi đã trong community
  | 'left';        // self-leave (quit chiến lược, account migration)

export const JOIN_STATUSES: JoinStatus[] = [
  'not_joined', 'pending', 'joined', 'rejected', 'kicked', 'left',
];

export const JOIN_STATUS_LABEL: Record<JoinStatus, string> = {
  not_joined: 'Chưa join',
  pending:    'Đang chờ duyệt',
  joined:     'Đã join',
  rejected:   'Bị từ chối',
  kicked:     'Bị kick',
  left:       'Đã rời',
};

export const JOIN_STATUS_COLOR: Record<JoinStatus, string> = {
  not_joined: '#9ca3af',
  pending:    '#fbbf24',
  joined:     '#10b981',
  rejected:   '#f87171',
  kicked:     '#f87171',
  left:       '#6b7280',
};

export const JOIN_STATUS_ICON: Record<JoinStatus, string> = {
  not_joined: '○',
  pending:    '⏳',
  joined:     '✓',
  rejected:   '✗',
  kicked:     '🚫',
  left:       '↩',
};

export function parseJoinStatus(v: unknown): JoinStatus {
  const s = String(v ?? 'not_joined');
  return (JOIN_STATUSES.includes(s as JoinStatus) ? s : 'not_joined') as JoinStatus;
}
