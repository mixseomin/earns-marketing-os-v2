// Helper bọc URL external để chặn referrer leak. 2 layer:
//   1. href.li redirect → origin Referer header thành href.li (không phải mos2.on.tc)
//   2. rel="noreferrer" trên <a> (caller tự set) → chặn Referer ngay từ browser
//
// Dùng cho MỌI link ra ngoài MOS2 (Reddit/community/external tools). Internal
// link MOS2 (/p/.../seeding) KHÔNG cần wrap.
//
// Edge cases:
//   - URL null/empty → trả về '#' (safe href)
//   - URL đã wrap href.li sẵn → không double-wrap
//   - mailto:/tel:/data:/blob: → bypass (không phải http)
//   - URL relative (vd /api/...) → bypass (internal)

export function wrapExternalUrl(url: string | null | undefined): string {
  if (!url) return '#';
  const u = String(url).trim();
  if (!u) return '#';
  // Bypass schemes không phải http(s)
  if (!/^https?:\/\//i.test(u)) return u;
  // Đã wrap rồi
  if (u.startsWith('https://href.li/?') || u.startsWith('http://href.li/?')) return u;
  return `https://href.li/?${u}`;
}

// Convenience: build rel string + wrapped href cho <a target="_blank"> spread.
// Usage: <a {...extLinkProps(url)} style={...}>label</a>
export function extLinkProps(url: string | null | undefined): {
  href: string;
  target: '_blank';
  rel: 'noopener noreferrer';
} {
  return {
    href: wrapExternalUrl(url),
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}
