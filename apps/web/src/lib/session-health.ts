// Sức khoẻ phiên đăng nhập — MỘT nguồn cho cả trang Environments lẫn drawer profile.
//
// Trước đây ngưỡng (7/21 ngày), màu, và cách đọc sessionState nằm rải ở environments-page.tsx +
// browser-profile-drawer.tsx: sửa ngưỡng một chỗ thì chỗ kia vẫn tô màu theo luật cũ, và hai nơi
// cùng hardcode '#d9a441'. Ai thêm surface thứ ba lại chép lần nữa.

import { LIVE_STATUSES, type AccountStatus } from './status-meta';

/** Ngày chưa mở profile: ≥ STALE_D là phải mở lại, ≥ WARN_D là sắp tới hạn. */
export const STALE_D = 21;
export const WARN_D = 7;
/** Cookie phiên còn ≤ EXPIRY_WARN_D ngày thì cảnh báo trước, đừng đợi hết hạn mới biết. */
export const EXPIRY_WARN_D = 7;

export const TONE = {
  bad: 'var(--bad, #e5534b)',
  warn: 'var(--warn, #d9a441)',
  muted: 'var(--fg-4)',
  quiet: 'var(--fg-3)',
} as const;

const DAY = 86_400_000;
const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null;
const daysUntil = (iso: string | null | undefined) =>
  iso ? Math.floor((new Date(iso).getTime() - Date.now()) / DAY) : null;

/**
 * Lịch của `~/bin/browsers-refresh` (LaunchAgent 10:30 hằng ngày). Hai số này PHẢI khớp WARM_BUFFER_D
 * / WARM_RECHECK_D bên script — sửa một bên mà quên bên kia thì UI hứa sai ngày kiểm lại.
 */
export const WARM_BUFFER_D = 3;
export const WARM_RECHECK_D = 30;

export type SessionFacts = {
  sessionState?: string | null;
  sessionExpiresAt?: string | null;
  sessionCheckedAt?: string | null;
  measurable?: boolean;
};

/**
 * "Bao giờ kiểm lại" — dựng lại đúng predicate DUE trong browsers-refresh, để trang không phải đoán:
 * chưa đo / không-alive / cookie sắp hết hạn (≤ WARM_BUFFER_D) / lâu chưa verify (≥ WARM_RECHECK_D)
 * = ghé ngay lượt chạy tới. Ngoài các ca đó thì ngày ghé = mốc nào tới trước.
 */
export function nextCheck(a: SessionFacts): { due: boolean; at: Date | null; text: string } {
  if (a.measurable === false) {
    return { due: false, at: null, text: 'không nằm trong lịch — platform chưa có session_check_url (job bỏ qua)' };
  }
  const exp = a.sessionExpiresAt ? new Date(a.sessionExpiresAt) : null;
  const chk = a.sessionCheckedAt ? new Date(a.sessionCheckedAt) : null;
  const now = Date.now();
  const cands = [exp ? exp.getTime() - WARM_BUFFER_D * DAY : null, chk ? chk.getTime() + WARM_RECHECK_D * DAY : null]
    .filter((t): t is number => t !== null);
  const due = !exp || !chk || a.sessionState !== 'alive' || Math.min(...cands) <= now;
  if (due) return { due: true, at: null, text: 'lượt chạy tới (job 10:30 hằng ngày)' };
  const at = new Date(Math.min(...cands));
  return { due: false, at, text: `${at.toLocaleDateString()} (còn ${Math.floor((at.getTime() - now) / DAY)} ngày)` };
}

/**
 * Tooltip ĐẦY ĐỦ cho một account: đo lúc nào, kết quả gì, cookie hết hạn khi nào, bao giờ ghé lại.
 * Dùng chung cho icon trên card lẫn chip khi lọc — trước đây hai chỗ tự nối chuỗi và chỉ nói mỗi
 * sessionState, tức là "alive" từ 3 tuần trước trông y hệt "alive" đo sáng nay.
 */
export function sessionTip(head: string, a: SessionFacts & { status?: string | null }): string {
  const chkD = daysSince(a.sessionCheckedAt);
  const leftD = daysUntil(a.sessionExpiresAt);
  return [
    `${head}${a.status ? ` · account: ${a.status}` : ''}`,
    `phiên: ${a.sessionState ?? 'chưa đo'}`,
    a.sessionCheckedAt
      ? `kiểm gần nhất: ${new Date(a.sessionCheckedAt).toLocaleString()} (${chkD === 0 ? 'hôm nay' : `${chkD} ngày trước`})`
      : 'kiểm gần nhất: chưa bao giờ',
    a.sessionExpiresAt
      ? `cookie hết hạn: ${new Date(a.sessionExpiresAt).toLocaleString()} → ${leftD !== null && leftD <= 0 ? 'ĐÃ HẾT HẠN' : `còn ~${leftD} ngày`}`
      : 'cookie hết hạn: chưa đọc được',
    `kiểm lại: ${nextCheck(a).text}`,
  ].join('\n');
}

export type IdleTone = 'never' | 'stale' | 'warn' | 'fresh';

/** Profile để lâu không mở = login hết hạn âm thầm. `never` cố tình xếp cùng mức nặng với `stale`. */
export function idleOf(lastOpenedAt: string | null | undefined): { days: number | null; tone: IdleTone; color: string; label: string } {
  const days = daysSince(lastOpenedAt);
  if (days === null) return { days: null, tone: 'never', color: TONE.bad, label: 'chưa mở lần nào' };
  if (days >= STALE_D) return { days, tone: 'stale', color: TONE.bad, label: 'cần mở lại' };
  if (days >= WARN_D) return { days, tone: 'warn', color: TONE.warn, label: 'sắp cũ' };
  return { days, tone: 'fresh', color: TONE.quiet, label: '' };
}

/** Ba nhóm trạng thái phiên dùng CHUNG cho filter, badge và các con số đếm trên card. */
export type SessionBucket = 'alive' | 'dead' | 'unknown';
export const bucketOf = (sessionState: string | null | undefined): SessionBucket =>
  sessionState === 'alive' ? 'alive' : sessionState === 'dead' ? 'dead' : 'unknown';

/**
 * "Chưa đo" ĐÁNG cảnh báo = đúng cái job `browsers-refresh` sẽ quét mà chưa ra kết quả:
 * platform có `session_check_url` (cờ `measurable` server tính) + status LIVE + phiên chưa alive/dead.
 * KHÔNG url, hoặc status ngoài LIVE (todo/creating/dead…) → job cố tình bỏ qua → KHÔNG phải "chưa đo",
 * đừng nag. Trước đây predicate bỏ qua session_check_url nên đếm cả trăm account job không hề đo được.
 * SSOT: banner /environments (client) lẫn pill unknownSessions (server) cùng gọi hàm này — đừng chép lại.
 */
export function isUnmeasuredSession(a: { sessionState?: string | null; status?: string | null; measurable?: boolean }): boolean {
  return bucketOf(a.sessionState) === 'unknown'
    && !!a.measurable
    && LIVE_STATUSES.includes(a.status as AccountStatus);
}

/**
 * Nhãn cho MỘT account trong profile. Hai con số khác nhau, đừng trộn:
 *  · lastUsedAt        = lần cuối được dùng. NULL = CHƯA ĐO, không phải phiên chết → xám, không đỏ.
 *  · sessionExpiresAt  = hạn cookie THẬT do browsers-refresh đọc từ profile. Có thì đếm ngược theo nó.
 */
export function accountSession(a: { lastUsedAt?: string | null; sessionExpiresAt?: string | null; sessionState?: string | null; sessionCheckedAt?: string | null; measurable?: boolean }) {
  const idleDays = daysSince(a.lastUsedAt);
  const leftDays = daysUntil(a.sessionExpiresAt);
  const bucket = bucketOf(a.sessionState);
  const color = leftDays !== null
    ? (leftDays <= 0 ? TONE.bad : leftDays <= EXPIRY_WARN_D ? TONE.warn : TONE.muted)
    : idleDays !== null && idleDays >= STALE_D ? TONE.warn : TONE.muted;
  const text = leftDays !== null
    ? (leftDays <= 0 ? '⚠ hết hạn' : `còn ${leftDays}d`)
    : idleDays === null ? '· chưa đo' : `${idleDays}d`;
  const tip = [
    a.lastUsedAt
      ? `Dùng gần nhất: ${new Date(a.lastUsedAt).toLocaleString()} (${idleDays}d trước)`
      : 'Chưa đo lần dùng nào — NULL ở đây nghĩa là chưa biết, không phải phiên đã chết.',
    leftDays !== null
      ? `Cookie đăng nhập hết hạn: ${new Date(a.sessionExpiresAt!).toLocaleString()} → ${leftDays <= 0 ? 'ĐÃ HẾT HẠN' : `còn ~${leftDays} ngày`}`
      : 'Chưa biết hạn phiên — chạy `browsers-refresh --idle 0` để đọc hạn cookie thật từ profile.',
    a.sessionCheckedAt ? `Đo phiên gần nhất: ${new Date(a.sessionCheckedAt).toLocaleString()}` : 'Chưa đo phiên lần nào.',
    `Kiểm lại: ${nextCheck(a).text}`,
  ].join('\n');
  return { idleDays, leftDays, bucket, color, text, tip, bold: leftDays !== null && leftDays <= EXPIRY_WARN_D };
}

/** Badge trạng thái phiên. null = không hiện badge nào (phiên đã xác minh còn sống). */
export function sessionBadge(sessionState: string | null | undefined): { text: string; color: string; dashed: boolean; title: string } | null {
  if (sessionState === 'alive') return null;
  if (sessionState === 'dead') {
    return { text: 'RỤNG PHIÊN', color: TONE.bad, dashed: false,
      title: 'browsers-refresh xác minh: đã bị đăng xuất. Chạy `browsers-refresh --idle 0` để thử login lại, hoặc mở profile login tay.' };
  }
  if (sessionState === 'unsure' || sessionState === 'blocked') {
    return { text: 'CHƯA RÕ', color: TONE.warn, dashed: false,
      title: sessionState === 'blocked'
        ? 'Kẹt challenge Cloudflare quá 30s — chưa đo được'
        : 'Không thấy dấu hiệu đăng nhập nào trên trang — nhiều khả năng platforms.session_check_url trỏ sai. Ảnh: /tmp/session-unsure-*.png' };
  }
  return { text: 'CHƯA ĐO', color: TONE.muted, dashed: true,
    title: 'Chưa xác minh phiên lần nào. Platform này có thể chưa có session_check_url → browsers-refresh bỏ qua. Chưa biết ≠ đang tốt.' };
}

/**
 * Account đang CHỜ được duyệt / chờ mail xác minh — trạng thái riêng, KHÔNG phải "rụng phiên".
 * Trước đây không có chỗ chứa nên nó đội lốt status='warming' và bị job chấm thành login-failed,
 * đẩy nhầm sang buổi login tay trong khi việc thật là chờ (rồi đòi) admin.
 * Verdict do ~/bin/account-waiting ghi khi hết hạn chờ.
 */
const VERDICT: Record<string, { text: string; color: string; title: string }> = {
  'mail-arrived': { text: 'CÓ MAIL', color: TONE.quiet, title: 'Mail đã về hộp thư của profile — vào xác minh rồi bỏ cờ chờ.' },
  'site-dead': { text: 'SITE CHẾT', color: TONE.bad, title: 'Không truy cập được từ cả máy local lẫn server → site chết. Bỏ site này.' },
  'ip-blocked': { text: 'IP BỊ CHẶN', color: TONE.bad, title: 'Server (IP nước ngoài) vào được nhưng máy local thì không → IP của mình bị chặn. Đăng ký lại qua proxy/IP khác.' },
  'admin-silent': { text: 'ADMIN IM', color: TONE.warn, title: 'Site sống, IP không bị chặn, nhưng mail không bao giờ tới → admin không duyệt. Đòi admin hoặc bỏ.' },
};

export function pendingBadge(a: { status?: string | null; pendingSince?: string | null; pendingVerdict?: string | null }) {
  // Nguồn sự thật là status='pending' (có CHECK constraint), không phải cờ jsonb.
  if (a.status !== 'pending' && !a.pendingSince) return null;
  if (a.pendingVerdict) return VERDICT[a.pendingVerdict] ?? { text: a.pendingVerdict.toUpperCase(), color: TONE.warn, title: '' };
  const d = a.pendingSince ? Math.floor((Date.now() - new Date(a.pendingSince).getTime()) / 86_400_000) : null;
  return { text: d === null ? 'CHỜ DUYỆT' : `CHỜ DUYỆT ${d}d`, color: TONE.warn, title: `Đang chờ duyệt/mail xác minh${a.pendingSince ? ` từ ${new Date(a.pendingSince).toLocaleDateString()}` : ''}. Chạy \`account-waiting\` để check mail + chẩn đoán khi hết hạn chờ.` };
}
