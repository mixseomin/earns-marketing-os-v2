// Seeding readiness helpers — phát hiện những lý do ngăn 1 mục trong
// queue seed được (account chết, sai platform, thiếu URL, thiếu bài).
// Pure functions, không phụ thuộc React/DB, dùng được từ server hoặc
// client.

import type { SeedingQueueItem } from '@/lib/actions/seeding';
import { ACCOUNT_STATUS_META } from '@/lib/status-meta';

// Account không còn dùng được → seeding của nó vô nghĩa cho tới khi xử lý.
const DEAD_STATUSES = ['banned', 'blocked'];
export function isDeadStatus(s: string): boolean { return DEAD_STATUSES.includes(s); }

// Account chưa sẵn sàng để seed — subset của ACCOUNT_STATUS_META cho notReady states.
export const ACCT_STATUS_META: Record<string, { label: string; color: string; dot: string; hint: string }> =
  Object.fromEntries((['todo','creating','warming','limited'] as const).map((k) => {
    const m = ACCOUNT_STATUS_META[k];
    return [k, { label: m.label, color: m.color, dot: String(m.icon ?? ''), hint: m.hint ?? '' }];
  }));
export function notReady(s: string): boolean {
  return s !== 'active' && !isDeadStatus(s);
}

// Account.platform PHẢI khớp kênh (habitat). Account Reddit không đăng
// được vào forum/Twitter/Weibo… Trả lý do mismatch hoặc null nếu OK.
export function expectedPlatformForKind(kind: string): string | null {
  if (kind === 'subreddit') return 'reddit';
  if (kind === 'discord') return 'discord';
  if (kind === 'fb-group' || kind === 'fb_group' || kind === 'facebook') return 'facebook';
  if (kind === 'twitter' || kind === 'x' || kind === 'hashtag') return 'twitter';
  if (kind === 'telegram') return 'telegram';
  if (kind === 'youtube') return 'youtube';
  return null; // forum/cafe/org/other → kênh ngoài
}

export function platformIssue(it: SeedingQueueItem): string | null {
  const exp = expectedPlatformForKind(it.habitatKind);
  if (exp) {
    return it.platformKey === exp ? null
      : `Account "${it.platformKey}" không đăng được vào ${it.habitatKind} — cần account ${exp.toUpperCase()}`;
  }
  const hp = it.habitatPlatformKey;
  if (hp) {
    return hp === it.platformKey ? null
      : `Account "${it.platformKey}" khác nền tảng kênh (${hp}) — cần account trên ${hp}`;
  }
  return `Kênh ngoài (${it.habitatKind}) — account "${it.platformKey}" gần như chắc sai, cần 1 account riêng đăng ký trên kênh này`;
}

// Tổng hợp các vấn đề ngăn cản kế hoạch seeding cho 1 dòng queue.
// kind = 'no-url' | 'acct-dead' | 'acct-not-ready' | 'platform-mismatch'
// severity = 'bad' (đỏ, chặn hoàn toàn) | 'warn' (vàng, có thể seed nhưng rủi ro)
// fix = mã action cha có thể wire (open-habitat / open-account / reassign-acct)
export interface SeedingIssue {
  kind: 'no-url' | 'acct-dead' | 'acct-not-ready' | 'platform-mismatch'
      | 'no-posts' | 'incomplete-posts';
  label: string;        // hiển thị ngắn (chip + summary)
  detail: string;       // tooltip / banner
  severity: 'bad' | 'warn';
  fix?: 'open-habitat' | 'open-account' | 'reassign-acct' | 'auto-fix' | 'open-brief';
}

export function blockingIssues(it: SeedingQueueItem): SeedingIssue[] {
  const out: SeedingIssue[] = [];
  if (!it.habitatUrl) {
    out.push({
      kind: 'no-url', severity: 'bad',
      label: 'Thiếu URL', fix: 'open-habitat',
      detail: `Habitat "${it.habitatName}" chưa có URL community → không mở được để đăng, không xác định được community, KHÔNG markPosted được. Sửa habitat điền URL.`,
    });
  }
  if (isDeadStatus(it.accountStatus)) {
    out.push({
      kind: 'acct-dead', severity: 'bad',
      label: 'Account ngưng', fix: 'reassign-acct',
      detail: `Account @${it.accountHandle} đã ${it.accountStatus.toUpperCase()}${it.accountBlockReason ? ` — ${it.accountBlockReason}` : ''}. Phải gán account khác cho brief này.`,
    });
  } else if (notReady(it.accountStatus)) {
    const m = ACCT_STATUS_META[it.accountStatus];
    out.push({
      kind: 'acct-not-ready', severity: 'warn',
      label: m?.label ?? it.accountStatus.toUpperCase(), fix: 'open-account',
      detail: `Account @${it.accountHandle} chưa ACTIVE (${it.accountStatus}). ${m?.hint ?? 'Hoàn tất setup trước khi seed.'}`,
    });
  }
  const pi = platformIssue(it);
  if (pi) {
    out.push({
      kind: 'platform-mismatch', severity: 'bad',
      label: 'Sai nền tảng', fix: 'auto-fix',
      detail: pi,
    });
  }
  // Content readiness — phase hiện tại chưa có bài / bài chưa đủ data.
  if (it.backlogCount === 0) {
    out.push({
      kind: 'no-posts', severity: 'warn',
      label: 'Thiếu bài', fix: 'open-brief',
      detail: `Phase "${it.currentPhase}" chưa có bài nào trong backlog. Vào brief sinh bài bằng AI hoặc tạo thủ công.`,
    });
  } else if (it.completeCount < it.backlogCount) {
    out.push({
      kind: 'incomplete-posts', severity: 'warn',
      label: 'Thiếu nội dung', fix: 'open-brief',
      detail: `${it.completeCount}/${it.backlogCount} bài đủ data — còn ${it.backlogCount - it.completeCount} bài thiếu nội dung/ảnh. Vào brief điền nốt.`,
    });
  }
  return out;
}
