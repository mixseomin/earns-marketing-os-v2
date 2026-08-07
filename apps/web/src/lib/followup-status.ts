// Follow-up status vocab + calendar/badge styling — the SITE_STATUS_META analog for deferred-work
// items (human_tasks platform_key='followup'). PURE DATA, client-safe (no next/cache): imported by
// the calendar merge, the follow-up drawer, AND the server actions' validation. Colors line up with
// the plays calendar scheme (amber = in-progress, green = done, red = blocked).
export const FOLLOWUP_STATUS = ['pending', 'doing', 'done', 'blocked', 'dropped'] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUS)[number];

export interface Followup {
  id: number;
  projectId: string;
  title: string;
  status: FollowupStatus;
  due: string | null;      // YYYY-MM-DD come-back date (sla_due_at) or null
  detail: string;          // context to resume (instructions)
  notes: string;           // dated progress log
  updated: string | null;  // YYYY-MM-DD
}

export const FOLLOWUP_META: Record<FollowupStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Chờ', color: '#8a92a3', icon: '⬜' },
  doing: { label: 'Đang làm', color: '#ffb03c', icon: '🟧' },
  done: { label: 'Xong', color: '#22c55e', icon: '✅' },
  blocked: { label: 'Kẹt', color: '#ef4444', icon: '🟥' },
  dropped: { label: 'Bỏ', color: '#6b7280', icon: '✖️' },
};

export function isFollowupStatus(s: string): s is FollowupStatus {
  return (FOLLOWUP_STATUS as readonly string[]).includes(s);
}
