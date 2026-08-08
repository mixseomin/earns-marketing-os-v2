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
  submitted: { label: 'Submitted',   color: '#9d6cff' },  // đã đăng, chờ NỀN TẢNG duyệt — link chưa sống
  // Làm xong rồi nhưng CHƯA ai xem. Người làm dừng ở đây; chỉ người duyệt mới đẩy sang Done.
  // Trước đây làm xong là 'completed' → rơi thẳng vào nhóm ẩn mặc định, không ai kịp nhìn kết quả.
  review:    { label: 'Review',      color: '#2dd4bf' },
  completed: { label: 'Done',        color: '#5badff' },  // đã duyệt → đóng sổ (ẩn mặc định)
  verified:  { label: 'Verified',    color: '#22c55e' },
  broken:    { label: 'Link lỗi',    color: '#ef4444' },  // từng sống, cron kiểm lại thấy mất → phải làm lại
  dropped:   { label: 'Đã bỏ',       color: '#6b7280' },  // LOẠI khỏi kế hoạch — khác completed = đã làm xong
} as const;

export type SiteStatus = keyof typeof SITE_STATUS_META;

export const SITE_STATUSES = Object.keys(SITE_STATUS_META) as SiteStatus[];

/**
 * Việc đã ĐÓNG SỔ: đã duyệt (completed/verified), bỏ khỏi kế hoạch (dropped), link hỏng (broken).
 * Bảng/lịch mặc định ẩn nhóm này để nhìn vào là thấy phần CÒN PHẢI LÀM; bật lại bằng một chip.
 * 'review' CỐ Ý không nằm trong đây: làm xong mà chưa ai xem thì phải còn trên bảng — đó chính là
 * việc của người duyệt. KHÔNG lẫn với TERMINAL_STATES của trang plays — set đó có cả 'submitted',
 * mà submitted là việc chưa đóng (đã đăng, còn phải theo duyệt) nên vẫn phải hiện.
 */
export const CLOSED_SITE_STATUSES = ['completed', 'verified', 'dropped', 'broken'] as const satisfies readonly SiteStatus[];

/**
 * Việc đã LÀM XONG — kể cả đang chờ duyệt. Khác CLOSED (đã đóng sổ + ẩn): một card ở 'review' là
 * xong việc nhưng chưa xong quy trình. Dùng cho: đếm tiến độ (7/14 bước), cổng "xong phải có kết
 * quả" (lib/task-done), thống kê. Ba chỗ trước đây mỗi chỗ tự viết `=== 'completed' || === 'verified'`
 * nên thêm một bậc là lệch ngay — giờ sửa ở đây là cả ba theo.
 */
export const FINISHED_SITE_STATUSES = ['review', 'completed', 'verified'] as const satisfies readonly SiteStatus[];

export const isFinished = (s: string | null | undefined): boolean => (FINISHED_SITE_STATUSES as readonly string[]).includes(s || '');

export const isSiteStatus = (s: string): s is SiteStatus => (SITE_STATUSES as string[]).includes(s);
