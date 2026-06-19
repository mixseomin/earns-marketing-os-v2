// Shared "scale readiness" dimensions — dùng bởi cả /technologies (technology scope)
// và /platforms (platform scope + kế thừa technology). 1 cột = 1 page_kind của pack
// selector. "ready" = đủ tạo account + đăng được bài (signup + composer).
export interface ReadinessDim { pk: string; label: string; hint: string }

export const READINESS_DIMS: ReadinessDim[] = [
  { pk: 'signup', label: 'Signup', hint: 'Tạo account + sửa profile sau reg — điền form đăng ký / account-details (page_kind=signup, catalog WRITE thống nhất)' },
  { pk: 'composer', label: 'Compose', hint: 'Đăng/reply + login state + thread context' },
  { pk: 'post-metrics', label: 'Metrics', hint: 'Đọc số engagement (views/score/replies)' },
  { pk: 'account-profile', label: 'Profile', hint: 'Đọc hồ sơ tài khoản sau reg (handle / joined / messages) — track warmup. Không tính vào "ready".' },
];

// Tối thiểu để "operate" 1 scope = tạo được account + đăng được bài.
export const isReady = (c: Record<string, number>) => (c.signup ?? 0) > 0 && (c.composer ?? 0) > 0;
