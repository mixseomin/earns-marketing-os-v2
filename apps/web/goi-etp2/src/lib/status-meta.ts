// Centralized status metadata registry.
//
// BEFORE this file existed: 9+ components each defined their own `STATUS_META`
// / `ACCT_STATUS_META` / `BRIEF_ACCT_STATUS_META` / etc., causing drift and
// duplicated copy. (See refactor survey 2026-05-22.)
//
// AFTER: each entity exports ONE meta map here. Components call
// `accountStatusMeta(status)` etc. — drift-free.
//
// Pattern: `<Entity>StatusMeta` map → `<Entity>Status` type → `<entity>StatusMeta()` accessor with safe fallback.
//
// Pair with `<StatusBadge>` (components/ui/status-badge.tsx) for render.

import type { ReactNode } from 'react';

export interface StatusInfo {
  label: string;                 // SHORT display ("READY", "WARMING")
  color: string;                 // CSS color
  icon?: ReactNode;              // emoji / icon char (optional)
  hint?: string;                 // tooltip / longer description
}

// Build accessor with fallback default to avoid `?.color || '#xxx'` boilerplate.
function makeAccessor<K extends string>(
  map: Record<K, StatusInfo>, fallbackKey: K,
): (s: string | K | null | undefined) => StatusInfo {
  return (s) => (s && (map as Record<string, StatusInfo>)[s]) || map[fallbackKey];
}

// ── Account lifecycle (platform_accounts.status) ─────────────────────
// Global status: "is this account usable on the platform AT ALL?"
// Not to be confused with community_briefs.joinStatus (membership) or
// currentPhase (engagement) — those are per-habitat.
// CHUẨN HOÁ 2026-08-09: đúng 9 giá trị, có CHECK constraint ở DB (mig 0168) nên không đường nào ghi
// giá trị lạ nữa. Trước đó dữ liệu có 'verified' và 'closed' KHÔNG nằm trong union → accessor rơi về
// fallback 'todo', tức UI hiển thị sai hẳn trạng thái; còn 'dormant'/'defunct' thì có trong code mà
// không có trong dữ liệu (chết khô). Thêm 'pending' vì "đã đăng ký, chờ duyệt/xác minh" trước đây
// KHÔNG có chỗ chứa nên bị nhét vào 'warming' (nghĩa là đang nuôi) — sai bản chất và job tự động
// chấm thành 'login-failed', đẩy nhầm sang việc login tay.
export type AccountStatus =
  | 'todo' | 'creating' | 'pending' | 'warming' | 'active'
  | 'limited' | 'blocked' | 'banned' | 'closed';

export const ACCOUNT_STATUS_META: Record<AccountStatus, StatusInfo> = {
  todo:     { label: 'TODO',     color: '#60a5fa', icon: '🔵', hint: 'Chưa setup — chưa có credential / chưa verify' },
  creating: { label: 'CREATING', color: '#fb923c', icon: '🟠', hint: 'Đang đăng ký — chưa hoàn tất' },
  pending:  { label: 'PENDING',  color: '#f59e0b', icon: '⏳', hint: 'Đã đăng ký xong, CHỜ duyệt / chờ mail xác minh — login tay cũng không vào được. Chạy `account-waiting` để check mail + chẩn đoán' },
  warming:  { label: 'WARMING',  color: '#fbbf24', icon: '🟡', hint: 'Đợi đủ tuổi/karma GLOBAL (warmupChecklist) — KHÔNG phải warm trong community' },
  active:   { label: 'READY',    color: '#10b981', icon: '🟢', hint: 'Đủ điều kiện platform — có thể assign vào community (phase per-habitat ở Brief modal)' },
  limited:  { label: 'LIMITED',  color: '#a78bfa', icon: '🟣', hint: 'Bị rate-limit / soft-block — chờ vài giờ/ngày, vẫn cứu được' },
  blocked:  { label: 'BLOCKED',  color: '#6b7280', icon: '🚫', hint: 'Bị chặn — cần appeal / fix thủ công' },
  banned:   { label: 'BANNED',   color: '#f87171', icon: '🔴', hint: 'Ban vĩnh viễn — không dùng được nữa' },
  closed:   { label: 'CLOSED',   color: '#94a3b8', icon: '⚫', hint: 'Mình tự đóng/xoá — không dùng nữa (khác banned: banned là bị platform cấm)' },
};

export const accountStatusMeta = makeAccessor(ACCOUNT_STATUS_META, 'todo');

// 4 display groups (UI gom 7 DB status → 4 cụm rõ nghĩa).
export type AccountStatusGroup = 'setup' | 'warming' | 'ready' | 'locked';
export interface StatusGroupInfo extends StatusInfo {
  members: AccountStatus[];
  tooltip: string;
}
export const ACCOUNT_STATUS_GROUPS: Record<AccountStatusGroup, StatusGroupInfo> = {
  setup:   { label: 'SETUP',   icon: '🔧', color: '#60a5fa',
    tooltip: 'Chưa setup xong — chưa có credential, đang đăng ký, hoặc đang chờ duyệt',
    members: ['todo', 'creating', 'pending'] },
  warming: { label: 'WARMING', icon: '🔥', color: '#fbbf24',
    tooltip: 'Đợi đủ tuổi/karma GLOBAL (mỗi platform có warmupChecklist riêng).\nĐây là warmup ở cấp ACCOUNT, không phải warm trong community.',
    members: ['warming'] },
  ready:   { label: 'READY',   icon: '✅', color: '#10b981',
    tooltip: 'Account đủ điều kiện platform → có thể assign vào community.',
    members: ['active'] },
  locked:  { label: 'LOCKED',  icon: '🔒', color: '#a78bfa',
    tooltip: 'Bị platform giới hạn / chặn — chọn lý do cụ thể (limited/blocked/banned)',
    members: ['limited', 'blocked', 'banned', 'closed'] },
};

export function accountStatusGroupOf(s: AccountStatus | string): AccountStatusGroup {
  if (s === 'todo' || s === 'creating' || s === 'pending') return 'setup';
  if (s === 'warming') return 'warming';
  if (s === 'active') return 'ready';
  return 'locked';
}

// "Parked" = account is DEAD/unusable and should be tucked into a separate collapsed
// section in every account list, not mixed with live ones. `limited` stays live
// (temporary rate-limit, recoverable); blocked/banned/dormant/defunct are parked.
// Single source of truth so every surface (vault, browsers CLI, pickers) agrees.
export function isParkedAccount(s: AccountStatus | string): boolean {
  return s === 'blocked' || s === 'banned' || s === 'closed';
}

/** Account KHÔNG cần giữ phiên / không tính vào cảnh báo "chưa đo" — mình cố ý bỏ chúng. */
export const DEAD_STATUSES: AccountStatus[] = ['banned', 'blocked', 'closed'];
/** Account ĐANG dùng → job giữ phiên phải quét (pending chưa vào được nên không quét). */
export const LIVE_STATUSES: AccountStatus[] = ['active', 'warming', 'limited'];

// ── Seeding queue status (computed per brief in seeding cockpit) ─────
export type SeedingQueueStatus = 'overdue' | 'due' | 'upcoming' | 'paused' | 'off-phase' | 'not-joined';

export const SEEDING_STATUS_META: Record<SeedingQueueStatus, StatusInfo> = {
  overdue:     { label: 'Quá hạn',    color: 'var(--bad)',  icon: '⏰', hint: 'Đã trễ lịch seed' },
  due:         { label: 'Đến hạn',    color: 'var(--warn)', icon: '⏳', hint: 'Đến hạn seed' },
  upcoming:    { label: 'Sắp tới',    color: 'var(--fg-3)', icon: '📅', hint: 'Trong tương lai gần' },
  'off-phase': { label: 'Ngoài phase', color: 'var(--fg-4)', icon: '⏸',  hint: 'Phase hiện tại không nằm trong active_phases của schedule' },
  paused:      { label: 'Tạm dừng',   color: 'var(--fg-4)', icon: '⏸',  hint: 'Schedule đã pause manually' },
  'not-joined':{ label: 'Chưa join',  color: '#9ca3af',     icon: '○',  hint: 'Account chưa join community — không thể seed' },
};

export const seedingStatusMeta = makeAccessor(SEEDING_STATUS_META, 'upcoming');

// ── Tool / Library status (library-page.tsx — was the only one exported) ─
export type ToolStatus = 'live' | 'beta' | 'planning' | 'paused' | 'deprecated';

export const TOOL_STATUS_META: Record<ToolStatus, StatusInfo> = {
  live:       { label: 'LIVE',       color: '#10b981', icon: '🟢', hint: 'Đang chạy production' },
  beta:       { label: 'BETA',       color: '#fbbf24', icon: '🟡', hint: 'Đang thử nghiệm' },
  planning:   { label: 'PLANNING',   color: '#60a5fa', icon: '🔵', hint: 'Đang lên kế hoạch' },
  paused:     { label: 'PAUSED',     color: '#9ca3af', icon: '⏸',  hint: 'Tạm dừng' },
  deprecated: { label: 'DEPRECATED', color: '#6b7280', icon: '⚰',  hint: 'Đã ngừng - không maintain' },
};

export const toolStatusMeta = makeAccessor(TOOL_STATUS_META, 'planning');

// ── Affiliate offer status (affiliate_programs.status) ───────────────
// Free-text from the CJ/Awin syncs + manual entries. active/joined/approved = earning; pending =
// applied & awaiting; paused/notjoined = not live; rejected = declined. Keys are lowercased on lookup.
export const OFFER_STATUS_META: Record<string, StatusInfo> = {
  active:    { label: 'ACTIVE',    color: '#10b981', icon: '🟢', hint: 'Đang chạy — được duyệt, kiếm tiền được' },
  joined:    { label: 'JOINED',    color: '#10b981', icon: '🟢', hint: 'Đã join — chạy được' },
  approved:  { label: 'APPROVED',  color: '#10b981', icon: '🟢', hint: 'Được duyệt' },
  pending:   { label: 'PENDING',   color: '#f59e0b', icon: '⏳', hint: 'Đã apply, chờ duyệt' },
  paused:    { label: 'PAUSED',    color: '#94a3b8', icon: '⏸', hint: 'Tạm dừng / chưa join' },
  notjoined: { label: 'NOTJOINED', color: '#7d8899', icon: '○', hint: 'Chưa join — có thể apply' },
  rejected:  { label: 'REJECTED',  color: '#f87171', icon: '🔴', hint: 'Bị từ chối' },
  unknown:   { label: 'UNKNOWN',   color: '#7d8899', hint: 'Không rõ trạng thái' },
};
export const offerStatusMeta = makeAccessor(OFFER_STATUS_META, 'unknown');

// ── Generic plan/step status (plan-cockpit.tsx) ──────────────────────
export type PlanStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export const PLAN_STATUS_META: Record<PlanStatus, StatusInfo> = {
  todo:        { label: 'TODO',        color: '#60a5fa', icon: '◯' },
  in_progress: { label: 'IN PROGRESS', color: '#fbbf24', icon: '◐' },
  blocked:     { label: 'BLOCKED',     color: '#f87171', icon: '⊘' },
  done:        { label: 'DONE',        color: '#10b981', icon: '●' },
  cancelled:   { label: 'CANCELLED',   color: '#6b7280', icon: '✕' },
};

export const planStatusMeta = makeAccessor(PLAN_STATUS_META, 'todo');

// ── Roadmap status (roadmap-page.tsx) ────────────────────────────────
export type RoadmapStatus = 'idea' | 'planned' | 'in_progress' | 'shipped' | 'parked';

export const ROADMAP_STATUS_META: Record<RoadmapStatus, StatusInfo> = {
  idea:        { label: 'IDEA',        color: '#94a3b8', icon: '💭' },
  planned:     { label: 'PLANNED',     color: '#60a5fa', icon: '📋' },
  in_progress: { label: 'IN PROGRESS', color: '#fbbf24', icon: '⚙' },
  shipped:     { label: 'SHIPPED',     color: '#10b981', icon: '🚀' },
  parked:      { label: 'PARKED',      color: '#6b7280', icon: '🅿' },
};

export const roadmapStatusMeta = makeAccessor(ROADMAP_STATUS_META, 'idea');

// ── Use-case / test status (tests-page.tsx) ──────────────────────────
export type UseCaseStatus = 'draft' | 'wip' | 'live' | 'verified' | 'broken' | 'archived';

export const USECASE_STATUS_META: Record<UseCaseStatus, StatusInfo> = {
  draft:    { label: 'DRAFT',    color: '#94a3b8', icon: '✎' },
  wip:      { label: 'WIP',      color: '#fbbf24', icon: '⚙' },
  live:     { label: 'LIVE',     color: '#60a5fa', icon: '◉' },
  verified: { label: 'VERIFIED', color: '#10b981', icon: '✓' },
  broken:   { label: 'BROKEN',   color: '#f87171', icon: '✗' },
  archived: { label: 'ARCHIVED', color: '#6b7280', icon: '⊘' },
};

export const useCaseStatusMeta = makeAccessor(USECASE_STATUS_META, 'draft');
