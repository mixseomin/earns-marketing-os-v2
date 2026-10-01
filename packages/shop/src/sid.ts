// Mã nguồn đơn (sid) — cùng khuôn sổ PHỦ: "<utm_source>_<utm_campaign>". Thuần, dùng được cả trình duyệt lẫn máy chủ.

const sach = (v: string | null | undefined) => (v ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

/** sid từ utm; không có utm thì rơi về nguồn dự phòng (vd source_type của Woo: "organic"/"typein"). */
export function sidTuUtm(source?: string | null, campaign?: string | null, duPhong?: string | null): string {
  const s = sach(source), c = sach(campaign);
  if (s || c) return `${s || 'utm'}_${c || 'none'}`;
  return sach(duPhong);
}

/** Tiền tố sid (2 khúc đầu) — khoá gộp của report PHỦ. */
export function sidPrefix(sid: string | null | undefined): string {
  const x = String(sid ?? '').trim();
  if (!x) return '';
  return x.split('_').slice(0, 2).join('_');
}
