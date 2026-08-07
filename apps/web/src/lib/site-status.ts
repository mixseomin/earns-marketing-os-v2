/**
 * Trạng thái per-site của một backlink/plays task — MỘT nguồn duy nhất.
 *
 * Trước 2026-08-07 danh sách này tồn tại BA bản sao: `SITE_STATUS` trong components/backlinks-page.tsx,
 * `STATUSES` trong api/ext/tasks/[id]/site-status/route.ts, và một mảng viết thẳng trong
 * lib/actions/architecture.ts (setBacklinkSite). Thêm 'dropped' vào hai chỗ đầu là chưa đủ — bản
 * thứ ba lặng lẽ trả 'bad status', mà lỗi lại giống hệt lỗi của tầng route nên nhìn log không
 * phân biệt được. Mất một vòng deploy + restart mới lần ra.
 *
 * Thêm/bớt trạng thái = sửa ĐÚNG file này. Nhãn hiển thị đi kèm luôn để UI khỏi tự chế bản đồ riêng.
 */
export const SITE_STATUS_META = {
  pending:   { label: 'To do',       color: '#8a92a3' },
  claimed:   { label: 'In progress', color: '#ffb03c' },
  submitted: { label: 'Submitted',   color: '#9d6cff' },  // đã đăng, chờ duyệt — link chưa sống
  completed: { label: 'Completed',   color: '#5badff' },
  verified:  { label: 'Verified',    color: '#22c55e' },
  broken:    { label: 'Link lỗi',    color: '#ef4444' },  // từng sống, cron kiểm lại thấy mất → phải làm lại
  dropped:   { label: 'Đã bỏ',       color: '#6b7280' },  // LOẠI khỏi kế hoạch — khác completed = đã làm xong
} as const;

export type SiteStatus = keyof typeof SITE_STATUS_META;

export const SITE_STATUSES = Object.keys(SITE_STATUS_META) as SiteStatus[];

export const isSiteStatus = (s: string): s is SiteStatus => (SITE_STATUSES as string[]).includes(s);
