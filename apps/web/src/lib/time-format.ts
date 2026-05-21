// Small time-formatting helpers shared across components. Centralized to
// avoid duplicate `fmtAgo` definitions in brief-edit-modal, post-row,
// phase-history-view, inbox-page, etc.

/**
 * Compact relative time ("3m ago", "2h ago", "5d ago", "2024-12-01" for >30 days).
 */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60)         return `${diffSec}s ago`;
  if (diffSec < 3600)       return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400)      return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

/** Vietnamese variant: "vừa xong", "3 phút trước", "2 giờ trước", "5 ngày trước" */
export function fmtAgoVi(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 30)          return 'vừa xong';
  if (diffSec < 60)          return `${diffSec}s trước`;
  if (diffSec < 3600)        return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400)       return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 86400 * 30)  return `${Math.floor(diffSec / 86400)} ngày trước`;
  if (diffSec < 86400 * 365) return `${Math.floor(diffSec / (86400 * 30))} tháng trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/** Short date (YYYY-MM-DD). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toISOString().slice(0, 10);
}

/** Short datetime (YYYY-MM-DD HH:mm local). */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const off = t.getTimezoneOffset();
  const local = new Date(t.getTime() - off * 60000);
  return local.toISOString().slice(0, 16).replace('T', ' ');
}
