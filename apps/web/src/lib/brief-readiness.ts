// Brief readiness — gom 2 tầng status (account.status + community_briefs.join_status)
// thành 1 "actionability" verdict để các gate check thống nhất.
//
// Bug 2026-05-22: brief 11 có account=todo (chưa tạo) NHƯNG join_status=joined →
// logically impossible (account chưa tồn tại sao join community được). Modal
// render bình thường → user nghĩ account active. Cần:
//   1. Cascade: account ∈ {todo, creating} → join_status PHẢI là 'not_joined'
//   2. Gates: account !ready → block tất cả create/dispatch/advance (giống !joined)
//   3. UI: chip account loud + tooltip giải thích tại sao locked
//
// Returned verdict:
//   - 'ready': có thể create/post/advance bridge-seed-direct
//   - 'account-not-ready': account chưa active (todo/creating/limited/blocked/banned)
//   - 'not-joined': account ready nhưng chưa joined community
//   - 'pending-join': đã gửi join request, chờ approve
//   - 'kicked' / 'rejected' / 'left': membership-dead — cần fix
//
// Caller dùng: if (verdict !== 'ready') block + show reason.

import { accountStatusMeta } from './status-meta';
import { JOIN_STATUS_LABEL, type JoinStatus } from './join-status';

export type BriefReadiness =
  | 'ready'
  | 'account-not-ready'
  | 'not-joined'
  | 'pending-join'
  | 'rejected'
  | 'kicked'
  | 'left';

export interface BriefReadinessResult {
  verdict: BriefReadiness;
  ready: boolean;            // true chỉ khi verdict === 'ready'
  reason: string;            // user-facing message tiếng Việt
  fixHint: string;           // "Đánh dấu đã join" / "Mở account modal verify" / ...
  blockingLayer: 'account' | 'membership' | 'none';
}

// Account status được coi là "có thể action": chỉ 'active'. Mọi trạng thái khác
// = account chưa sẵn sàng (todo/creating chưa tạo, warming chưa đủ tuổi,
// limited/blocked/banned bị platform khoá).
const ACCOUNT_READY_STATUS = new Set(['active']);

/**
 * Account-level readiness — chỉ xét account.status, không xét membership.
 * Dùng cho UI account chip warning + gate cascade.
 */
export function isAccountReady(accountStatus: string | null | undefined): boolean {
  return !!accountStatus && ACCOUNT_READY_STATUS.has(accountStatus);
}

/**
 * Combined readiness — account + membership.
 * accountStatus ưu tiên cao hơn membership (vì không thể join khi account chưa tồn tại).
 */
export function getBriefReadiness(
  accountStatus: string | null | undefined,
  joinStatus: JoinStatus | string | null | undefined,
): BriefReadinessResult {
  // Layer 1: account-level (ưu tiên cao nhất — không có account thì không có gì cả)
  if (!isAccountReady(accountStatus)) {
    const meta = accountStatusMeta(accountStatus || 'todo');
    return {
      verdict: 'account-not-ready',
      ready: false,
      reason: `Account chưa sẵn sàng (${meta.label}): ${meta.hint ?? ''}`,
      fixHint: 'Mở account modal → hoàn tất setup / verify / fix limit',
      blockingLayer: 'account',
    };
  }

  // Layer 2: membership (account ready, kiểm tra join status)
  const js = (joinStatus as string) || 'not_joined';
  if (js === 'joined') {
    return { verdict: 'ready', ready: true, reason: '', fixHint: '', blockingLayer: 'none' };
  }
  if (js === 'pending') {
    return {
      verdict: 'pending-join',
      ready: false,
      reason: 'Đã gửi join request, chờ admin/mod duyệt — chưa nên đăng bài',
      fixHint: 'Khi được approved → mở header chip Join status → đánh dấu "đã join"',
      blockingLayer: 'membership',
    };
  }
  if (js === 'rejected') {
    return {
      verdict: 'rejected',
      ready: false,
      reason: 'Bị admin/mod từ chối join community',
      fixHint: 'Sửa profile/intro post + thử lại — hoặc swap account khác',
      blockingLayer: 'membership',
    };
  }
  if (js === 'kicked') {
    return {
      verdict: 'kicked',
      ready: false,
      reason: 'Account đã bị kick sau khi join',
      fixHint: 'Đợi cool-down 1-4 tuần + liên hệ mod — hoặc swap account',
      blockingLayer: 'membership',
    };
  }
  if (js === 'left') {
    return {
      verdict: 'left',
      ready: false,
      reason: 'Account đã chủ động rời community',
      fixHint: 'Join lại + đánh dấu nếu muốn quay lại',
      blockingLayer: 'membership',
    };
  }
  // not_joined hoặc unknown
  return {
    verdict: 'not-joined',
    ready: false,
    reason: 'Account chưa join community này',
    fixHint: 'Mở community → gửi join request / accept invite → đánh dấu ở header chip',
    blockingLayer: 'membership',
  };
}

/**
 * Cascade rule: khi account ∈ {todo, creating, blocked, banned}, join_status PHẢI
 * là 'not_joined' (không thể join khi account chưa tồn tại / bị ban).
 * Returns next joinStatus value (caller UPDATE community_briefs nếu khác current).
 */
export function cascadeJoinStatus(
  accountStatus: string | null | undefined,
  currentJoinStatus: JoinStatus | string,
): JoinStatus {
  const s = accountStatus || 'todo';
  // Account chưa tồn tại / đã chết → force not_joined
  if (s === 'todo' || s === 'creating' || s === 'blocked' || s === 'banned') {
    return 'not_joined';
  }
  // warming/limited/active/dormant/defunct: giữ nguyên (warming có thể đã join 1
  // community, account vẫn build karma — không reset).
  return (currentJoinStatus as JoinStatus) || 'not_joined';
}

/**
 * Human-readable label cho verdict (UI surface).
 */
export function readinessLabel(v: BriefReadiness): string {
  switch (v) {
    case 'ready':              return 'Sẵn sàng';
    case 'account-not-ready':  return 'Account chưa sẵn sàng';
    case 'not-joined':         return 'Chưa join community';
    case 'pending-join':       return 'Đang chờ duyệt';
    case 'rejected':           return 'Bị từ chối';
    case 'kicked':             return 'Bị kick';
    case 'left':               return 'Đã rời';
  }
}

// Re-export để caller chỉ cần 1 import
export { JOIN_STATUS_LABEL };
