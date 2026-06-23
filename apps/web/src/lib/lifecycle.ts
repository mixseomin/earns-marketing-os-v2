// Post lifecycle enum = single source for earns-marketing-os-v2 (was duplicated in
// the update-lifecycle route's VALID_LIFECYCLES + the dashboard's LIFECYCLE_META).
// null / '_none' = unmarked (post_lifecycle NULL). Uses CSS vars (dashboard context).
// ⚠ The value list mirrors the ext's core/lifecycle.js ORDER (cross-repo: one source
// per repo; the two must stay in sync).

// 'pending-approval' = bài đã submit nhưng forum bắt chờ mod duyệt (chưa public, chưa có
// permalink). Ext bắt ngay trên trang confirm sau submit. Khi mod duyệt → bài hiện trong
// thread → scanTrk mark-posted → confirmCardPosted tự clear pending về null.
export const LIFECYCLE_VALUES = ['pending-approval', 'live', 'ghosted', 'removed-by-mod', 'self-deleted', 'low-engagement'] as const;
export type Lifecycle = (typeof LIFECYCLE_VALUES)[number];

// Valid for writes: the values + null (unmark).
export const VALID_LIFECYCLE_VALUES: Array<Lifecycle | null> = [null, ...LIFECYCLE_VALUES];

export const LIFECYCLE_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  'pending-approval': { icon: '🕓', label: 'Pending approval', color: 'var(--warn)', bg: 'rgba(251,191,36,.12)' },
  live:             { icon: '✅', label: 'Live',          color: 'var(--ok)',   bg: 'rgba(74,222,128,.15)' },
  ghosted:          { icon: '👻', label: 'Ghosted',       color: '#a78bfa',     bg: 'rgba(167,139,250,.15)' },
  'removed-by-mod': { icon: '🗑', label: 'Mod removed',   color: 'var(--bad)',  bg: 'rgba(248,113,113,.15)' },
  'self-deleted':   { icon: '🗑', label: 'Self deleted',  color: 'var(--fg-3)', bg: 'var(--bg-3)' },
  'low-engagement': { icon: '💤', label: 'Low engage',    color: 'var(--warn)', bg: 'rgba(251,191,36,.15)' },
  _none:            { icon: '⏳', label: 'Chưa đánh dấu', color: 'var(--fg-4)', bg: 'var(--bg-2)' },
};
