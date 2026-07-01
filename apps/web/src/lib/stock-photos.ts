import 'server-only';

// Stock / web image sources (shared by the ext media/generate route and the backlink
// media picker). Each provider is optional (used only if its key is set); Openverse
// needs no key so there is always at least one web source.

export type PhotoCandidate = { url: string; provider: string };

// List candidate image URLs for a query across every configured provider.
export async function searchStockPhotos(query: string): Promise<PhotoCandidate[]> {
  const out: PhotoCandidate[] = [];
  const q = encodeURIComponent(query);
  const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* skip provider */ } };

  const pexels = process.env.PEXELS_KEY || process.env.PEXELS_API_KEY;
  if (pexels) await safe(async () => {
    const r = await fetch(`https://api.pexels.com/v1/search?per_page=8&query=${q}`, { headers: { Authorization: pexels }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const p of (j.photos || [])) { const u = p?.src?.large2x || p?.src?.large || p?.src?.original; if (u) out.push({ url: u, provider: 'pexels' }); }
  });
  const pixabay = process.env.PIXABAY_KEY || process.env.PIXABAY_API_KEY;
  if (pixabay) await safe(async () => {
    const r = await fetch(`https://pixabay.com/api/?key=${pixabay}&image_type=photo&safesearch=true&per_page=8&q=${q}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const h of (j.hits || [])) { const u = h?.largeImageURL || h?.webformatURL; if (u) out.push({ url: u, provider: 'pixabay' }); }
  });
  const unsplash = process.env.UNSPLASH_KEY || process.env.UNSPLASH_ACCESS_KEY;
  if (unsplash) await safe(async () => {
    const r = await fetch(`https://api.unsplash.com/search/photos?per_page=8&query=${q}`, { headers: { Authorization: `Client-ID ${unsplash}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const p of (j.results || [])) { const u = p?.urls?.regular || p?.urls?.full; if (u) out.push({ url: u, provider: 'unsplash' }); }
  });
  const gkey = process.env.GOOGLE_CSE_KEY || process.env.GOOGLE_SEARCH_KEY;
  const gcx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID;
  if (gkey && gcx) await safe(async () => {
    const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${gkey}&cx=${gcx}&searchType=image&num=8&safe=active&q=${q}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const it of (j.items || [])) { if (it?.link) out.push({ url: it.link, provider: 'google-cse' }); }
  });
  // Openverse — no key required (CC, commercial use). Always runs as a guaranteed fallback.
  await safe(async () => {
    const tok = process.env.OPENVERSE_TOKEN ? { Authorization: `Bearer ${process.env.OPENVERSE_TOKEN}` } : undefined;
    const r = await fetch(`https://api.openverse.org/v1/images/?license_type=commercial&page_size=10&q=${q}`, { headers: { 'User-Agent': 'mos2-crew/1.0', ...(tok || {}) }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const im of (j.results || [])) { const u = im?.thumbnail || im?.url; if (u) out.push({ url: u, provider: 'openverse' }); }
  });
  return out;
}

// Download an image URL → buffer (validates mime + size). Returns null on failure.
export async function downloadImage(link: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const ir = await fetch(link, { signal: AbortSignal.timeout(9000), redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mos2-crew/1.0)' } });
    if (!ir.ok) return null;
    const mime = ir.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//.test(mime)) return null;
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length < 800 || buf.length > 8 * 1024 * 1024) return null;
    return { buf, mime };
  } catch { return null; }
}
