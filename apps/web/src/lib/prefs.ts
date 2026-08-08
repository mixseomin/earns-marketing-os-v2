// LỰA CHỌN GIAO DIỆN của người dùng (đang xem view nào, lịch tháng/tuần, ẩn việc đã đóng sổ…) —
// chọn trên trang MỘT LẦN rồi nhớ, cho mọi lần mở sau.
//
// Trước 2026-08-08 mấy thứ này chỉ sống trong query param: F5 thì còn, nhưng bấm "Plays" từ menu là
// về mặc định, muốn giữ thì phải tự nhớ `?view=calendar&cal=week&closed=1`. Không ai nhớ query param.
// URL vẫn giữ (để chia sẻ đúng màn hình đang xem) nhưng KHÔNG còn là chỗ duy nhất.
//
// Cookie chứ không localStorage: server component đọc được nên lần paint ĐẦU đã đúng, không nháy từ
// mặc định sang lựa chọn. MỘT cookie JSON cho mọi khoá — thêm setting mới = thêm khoá, không đẻ thêm
// tên cookie (repo đã có 'slf2', 'seo_cols', … mỗi chỗ một kiểu).
//
// File này CỐ Ý thuần (không import next/headers): server đọc cookie ở page.tsx rồi đưa qua
// `parsePrefs`, client dùng `setPref`. Một module vừa xuất data client cần vừa chứa runtime
// server-only là cách làm vỡ static-prerender — đã dính một lần với next/cache.

export const PREFS_COOKIE = 'mos2-ui';

export type Prefs = Record<string, string>;

export function parsePrefs(raw: string | undefined | null): Prefs {
  if (!raw) return {};
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => typeof x === 'string')) as Prefs;
  } catch { return {}; }
}

/** Ghi một lựa chọn (client). Giá trị rỗng = xoá khoá, để cookie không phình vì mặc định. */
export function setPref(key: string, value: string): void {
  if (typeof document === 'undefined') return;
  const cur = parsePrefs(document.cookie.split('; ').find((c) => c.startsWith(`${PREFS_COOKIE}=`))?.slice(PREFS_COOKIE.length + 1));
  if (value) cur[key] = value; else delete cur[key];
  document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(cur))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** URL thắng (link chia sẻ đúng màn hình) → rồi tới lựa chọn đã nhớ → cuối cùng mới là mặc định. */
export function pick(fromUrl: string | null | undefined, saved: string | undefined, fallback: string): string {
  return fromUrl || saved || fallback;
}
