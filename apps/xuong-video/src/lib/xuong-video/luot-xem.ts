// LƯỢT XEM THẬT của video đã đăng (anh 31/10/2026: "các video dạng game mini như front porch cũng khá hiệu quả" — duyệt dùng video THẮNG của chính kênh
// làm hook đã chứng minh, cạnh QC spy). Đọc số công khai trên trang YouTube Shorts (box3 đọc được, không cần khoá API). Không đọc được → null, không đoán.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Số trong `"viewCount":"1234"` đầu tiên của trang (lượt xem của chính video đó). Thuần. */
export const docLuotXem = (html: string): number | null => { const m = html.match(/"viewCount":"(\d+)"/); return m ? Number(m[1]) : null; };

export async function luotXemYoutube(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(20_000) });
    return r.ok ? docLuotXem(await r.text()) : null;
  } catch { return null; }
}

/** Mã video Facebook trong link reel / video (facebook.com/reel/<id>/, /videos/<id>). Thuần. */
export const maFacebook = (url: string): string | null => (url.match(/\/(?:reel|videos)\/(\d+)/) ?? [])[1] ?? null;
/** Lượt xem Facebook qua Graph (`<id>?fields=views`) — token Page bất kỳ đã opt-in app đọc được (đo 31/10/2026). */
export async function luotXemFacebook(url: string, token: string): Promise<number | null> {
  const id = maFacebook(url); if (!id || !token) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=views&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20_000) });
    const j = (await r.json()) as { views?: number }; return r.ok && typeof j.views === 'number' ? j.views : null;
  } catch { return null; }
}
/** Token Page đầu tiên trong /root/.secrets/fb-pages.json (box3) — chỉ đọc số. */
export async function tokenFacebook(): Promise<string | null> {
  try { const d = JSON.parse((await import('node:fs')).readFileSync('/root/.secrets/fb-pages.json', 'utf8')) as Record<string, { token?: string }>; return Object.values(d).find((x) => x.token)?.token ?? null; } catch { return null; }
}
/** Đọc lượt xem mọi nền có link của một video → { nen: số } (nền đọc hỏng thì bỏ qua). */
export async function luotXemCacNen(daDang: Record<string, { url?: string | null } | undefined>, tokenFb: string | null): Promise<Record<string, number>> {
  const ra: Record<string, number> = {};
  if (daDang.youtube?.url) { const n = await luotXemYoutube(daDang.youtube.url); if (n != null) ra.youtube = n; }
  if (daDang.facebook?.url && tokenFb) { const n = await luotXemFacebook(daDang.facebook.url, tokenFb); if (n != null) ra.facebook = n; }
  return ra;
}

/** Ngưỡng "video thắng": ≥ 500 lượt xem sau ≥ 7 ngày (kênh mới — Front Porch trung bình ~650, cao nhất 1.209, đo 31/10/2026). */
export const THANG_LUOT_XEM = 500, THANG_SAU_NGAY = 7;

if (process.argv[1]?.endsWith('luot-xem.ts') && process.argv.includes('--tu-kiem')) {
  const t: typeof import('node:assert').strict = (await import('node:assert')).strict;
  t.equal(docLuotXem('x "viewCount":"1209" y "viewCount":"5"'), 1209, 'lấy số đầu tiên');
  t.equal(docLuotXem('không có số'), null, 'không có thì null, không đoán 0');
  t.equal(maFacebook('https://www.facebook.com/reel/1003764759414194/'), '1003764759414194'); t.equal(maFacebook('https://x.com/a'), null);
  console.log('luot-xem: 4 ca đạt');
}
