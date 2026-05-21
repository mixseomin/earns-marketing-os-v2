// Centralized Vietnamese label constants.
//
// Trước refactor: 67+ chỗ inline "Lưu" / "Huỷ" / "Xóa" / "Sửa" / etc. trong
// components → drift (vd "Hủy" vs "Huỷ"), khó A/B test copy, khó i18n sau.
//
// Pattern:
//   import { L } from '@/lib/labels';
//   <button>{L.save}</button>     // thay vì "Lưu"
//   <button>{L.cancel}</button>   // thay vì "Huỷ"
//
// Naming convention: camelCase, ngắn gọn. Group theo concern. Comment cho
// label dễ confuse (vd save vs persist vs apply).

export const L = {
  // ── Actions cơ bản ───────────────────────────────────────
  save:    'Lưu',
  cancel:  'Huỷ',
  close:   'Đóng',
  delete:  'Xoá',
  edit:    'Sửa',
  create:  'Tạo mới',
  add:     'Thêm',
  remove:  'Bỏ',
  copy:    'Copy',
  paste:   'Paste',
  apply:   'Áp dụng',
  reset:   'Reset',
  refresh: 'Làm mới',
  retry:   'Thử lại',
  undo:    'Hoàn tác',
  done:    'Xong',
  ok:      'OK',
  yes:     'Có',
  no:      'Không',

  // ── States ───────────────────────────────────────────────
  loading:    'Đang tải…',
  saving:     'Đang lưu…',
  deleting:   'Đang xoá…',
  creating:   'Đang tạo…',
  generating: 'Đang tạo…',
  uploading:  'Đang upload…',
  syncing:    'Đang đồng bộ…',
  processing: 'Đang xử lý…',

  // ── Status messages ──────────────────────────────────────
  saved:    '✓ Đã lưu',
  copied:   '✓ Đã copy',
  deleted:  '✓ Đã xoá',
  created:  '✓ Đã tạo',
  updated:  '✓ Đã cập nhật',

  // ── Errors ───────────────────────────────────────────────
  errorGeneric:    'Có lỗi xảy ra',
  errorNetwork:    'Lỗi kết nối',
  errorPermission: 'Không có quyền',
  errorNotFound:   'Không tìm thấy',
  errorRequired:   'Bắt buộc',
  errorInvalid:    'Không hợp lệ',
  errorCopy:       'Copy lỗi',

  // ── Confirm dialogs ──────────────────────────────────────
  confirmDelete:        'Click lần nữa để xác nhận xoá vĩnh viễn',
  confirmDeleteShort:   '⚠ Click again to confirm',
  confirmDestructive:   'Hành động này không thể hoàn tác',

  // ── Form helpers ─────────────────────────────────────────
  fieldRequired:    'Trường này bắt buộc',
  fieldOptional:    '(tuỳ chọn)',
  fieldAuto:        '(auto)',
  selectPlaceholder: '— chọn —',
  searchPlaceholder: 'Tìm kiếm…',
  noResults:         'Không có kết quả',
  emptyList:         'Chưa có dữ liệu',

  // ── Pagination / list ────────────────────────────────────
  showMore:    'Xem thêm',
  showLess:    'Thu gọn',
  loadMore:    'Tải thêm',
  total:       'Tổng',
  page:        'Trang',
  perPage:     '/ trang',

  // ── Time relative ────────────────────────────────────────
  justNow:    'vừa xong',
  ago:        'trước',
  in:         'sau',
  today:      'hôm nay',
  yesterday:  'hôm qua',
  tomorrow:   'ngày mai',
} as const;

export type LabelKey = keyof typeof L;

// English fallback (i18n hook nếu cần multi-locale sau).
// KHÔNG dùng trực tiếp ở UI — UI hiện default Vietnamese.
export const L_EN: Record<LabelKey, string> = {
  save: 'Save', cancel: 'Cancel', close: 'Close', delete: 'Delete', edit: 'Edit',
  create: 'Create', add: 'Add', remove: 'Remove', copy: 'Copy', paste: 'Paste',
  apply: 'Apply', reset: 'Reset', refresh: 'Refresh', retry: 'Retry', undo: 'Undo',
  done: 'Done', ok: 'OK', yes: 'Yes', no: 'No',
  loading: 'Loading…', saving: 'Saving…', deleting: 'Deleting…', creating: 'Creating…',
  generating: 'Generating…', uploading: 'Uploading…', syncing: 'Syncing…', processing: 'Processing…',
  saved: '✓ Saved', copied: '✓ Copied', deleted: '✓ Deleted', created: '✓ Created', updated: '✓ Updated',
  errorGeneric: 'An error occurred', errorNetwork: 'Network error', errorPermission: 'No permission',
  errorNotFound: 'Not found', errorRequired: 'Required', errorInvalid: 'Invalid', errorCopy: 'Copy failed',
  confirmDelete: 'Click again to confirm permanent deletion',
  confirmDeleteShort: '⚠ Click again to confirm',
  confirmDestructive: 'This action cannot be undone',
  fieldRequired: 'This field is required', fieldOptional: '(optional)', fieldAuto: '(auto)',
  selectPlaceholder: '— select —', searchPlaceholder: 'Search…',
  noResults: 'No results', emptyList: 'No data',
  showMore: 'Show more', showLess: 'Show less', loadMore: 'Load more',
  total: 'Total', page: 'Page', perPage: '/ page',
  justNow: 'just now', ago: 'ago', in: 'in', today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow',
};
