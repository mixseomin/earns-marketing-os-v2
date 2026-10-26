// HỌ NỀN — một chỗ duy nhất quy NƠI ĐĂNG về họ nền và khoá nền tảng (favicon / platform_key). Trước 26/10/2026 công thức này chép tay ở 6 chỗ
// (ke-hoach-goc, social-traffic, API kế hoạch, 3 component) với 3 dị bản lệch nhau (/audit 26/10/2026) — nay mọi nơi gọi đây.
//   nen = 'facebook' | 'fb_anh' | 'fb_link' | 'facebook:580' (Page cũ) | 'x' | 'x_anh' | 'x_link' | 'x_poll' | 'tiktok_anh' | 'youtube' | 'instagram' | 'dailymotion'
//   node_modules/.bin/tsx apps/web/src/lib/ho-nen.test.mts

/** Họ nền của một nơi đăng: bỏ hậu tố dạng (_anh / _link / _poll) và tài khoản (':<acct>'); fb → facebook. */
export const hoCua = (nen: string): string => { const g = (nen.split(':')[0] ?? nen).replace(/_(anh|link|poll)$/, ''); return g === 'fb' ? 'facebook' : g; };
/** Khoá nền tảng (platform_key của vault / SiteFavicon) theo họ nền. */
export const HO_PK: Record<string, string> = { facebook: 'facebook', x: 'twitter', youtube: 'youtube', instagram: 'instagram', tiktok: 'tiktok', dailymotion: 'dailymotion', pinterest: 'pinterest', threads: 'threads' };
export const pkCua = (nen: string): string => HO_PK[hoCua(nen)] ?? hoCua(nen);
