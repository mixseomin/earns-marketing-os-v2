// SHOP — video sản phẩm: một bộ luật cho cả nơi ghi (CJ productVideo, ô sửa tay ở /shop) lẫn nơi hiện (mô tả trang sản phẩm apps/store).
// Nhận chuỗi/mảng bất kỳ (CJ trả chuỗi, có khi nhiều link nối dấu phẩy) → danh sách link http(s) sạch, bỏ trùng, tối đa 6.

export function dsVideo(raw: unknown): string[] {
  const tho = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(/[\s,;]+/) : [];
  return [...new Set(tho.map((x) => x.trim()).filter((x) => /^https?:\/\/\S+$/.test(x) && x.length <= 500))].slice(0, 6);
}

/** Link → cách nhúng. YouTube nhúng bản nocookie; còn lại phát thẳng bằng <video>. */
export function nhungVideo(url: string): { loai: 'youtube'; src: string } | { loai: 'file'; src: string } {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return yt ? { loai: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}` } : { loai: 'file', src: url };
}

// Tự kiểm: node_modules/.bin/tsx packages/shop/src/video.ts
if (process.argv[1]?.endsWith('video.ts')) {
  const a = dsVideo('https://cc.oss.com/a.mp4, https://cc.oss.com/a.mp4 ;ftp://x  https://youtu.be/dQw4w9WgXcQ');
  if (a.length !== 2) throw new Error(`dsVideo: ${JSON.stringify(a)}`);
  if (dsVideo(null).length || dsVideo(['', 'javascript:alert(1)']).length) throw new Error('dsVideo phải bỏ rỗng/không http');
  if (nhungVideo(a[1]!).loai !== 'youtube' || nhungVideo(a[0]!).loai !== 'file') throw new Error('nhungVideo');
  console.log('video: 3/3 ok');
}
