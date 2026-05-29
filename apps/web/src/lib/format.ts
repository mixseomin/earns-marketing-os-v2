// Number/text formatting helpers shared across components. Centralized để
// gỡ các bản trùng `fmtNum`/`formatStatShort` ở habitats-table, seeding-cockpit,
// all-posts-tab, tribes-page (mỗi nơi 1 bản hơi lệch → output không nhất quán).

/**
 * Compact number: <1000 nguyên; 1k–1M dạng "1.2k"/"12k"; ≥1M dạng "1.5M".
 * Bỏ ".0" thừa (1000 → "1k" không phải "1.0k").
 */
export function fmtCompactNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}
