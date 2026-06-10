import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts, mediaAssets } from '@mos2/db';
import { and, eq } from 'drizzle-orm';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { uploadToR2, r2Enabled } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// POST /api/ext/media/generate
// Body: { projectId, accountId?, handle?, field, source?: 'ai'|'web', prompt? }
// → { ok, url, id, width, height, source }
// Source ảnh MỚI khi thư viện thiếu mẫu: AI-gen (gpt-image-2, khớp persona của
// account) hoặc web search (Google CSE, cần key). Upload R2 + insert media_assets
// (tags account → map với tk) + trả url để ext nạp thẳng vào ô upload.

// Field → kích thước + khung prompt. avatar/icon/logo = vuông; banner/cover = ngang.
function fieldShape(field: string): { size: '1024x1024' | '1536x1024'; banner: boolean } {
  return /(banner|cover|wallpaper|header|background)/i.test(field)
    ? { size: '1536x1024', banner: true }
    : { size: '1024x1024', banner: false };
}

function personaDesc(persona: Record<string, unknown>): string {
  const pick = (k: string) => { const v = persona?.[k]; return typeof v === 'string' ? v.trim() : ''; };
  const bits = [
    pick('gender'), pick('age'), pick('display_name') || pick('name'),
    pick('occupation') || pick('custom_fields_occupation'),
    pick('about') || pick('bio'), pick('location'), pick('interests'),
  ].filter(Boolean);
  return bits.join(', ').slice(0, 600);
}

function buildPrompt(field: string, persona: Record<string, unknown>, banner: boolean): string {
  const who = personaDesc(persona) || 'a friendly everyday person with a natural, approachable vibe';
  return banner
    ? `A wide profile banner / cover image reflecting this person's vibe and interests: ${who}. Aesthetic, tasteful, modern. No text, no logo, no watermark, no human face close-up.`
    : `A natural profile avatar portrait, head and shoulders, soft lighting, photographic, friendly and approachable, suitable as a forum/social avatar. Subject: ${who}. No text, no watermark, single subject, centered.`;
}

async function loadAccount(projectId: string, accountId?: number, handle?: string) {
  const db = getDb(); if (!db) return null;
  let where;
  if (accountId) where = eq(platformAccounts.id, accountId);
  else if (handle) where = projectId ? and(eq(platformAccounts.handle, handle), eq(platformAccounts.projectId, projectId)) : eq(platformAccounts.handle, handle);
  else return null;
  const [row] = await db.select({ id: platformAccounts.id, handle: platformAccounts.handle, projectId: platformAccounts.projectId, persona: platformAccounts.persona })
    .from(platformAccounts).where(where).limit(1);
  return row ?? null;
}

async function persist(opts: {
  projectId: string; field: string; buf: Buffer; mime: string; width: number; height: number;
  source: string; handle: string | null; accountId: number | null; prompt: string;
}): Promise<{ url: string; id: number } | null> {
  const db = getDb(); if (!db) return null;
  const ext = (opts.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const key = `profile/${opts.projectId || 'misc'}/${opts.field}-${stamp}.${ext}`;
  let url = r2Enabled() ? await uploadToR2(key, opts.buf, opts.mime) : null;
  if (!url) url = `data:${opts.mime};base64,${opts.buf.toString('base64')}`; // fallback: inline (vẫn nạp được)
  const tags = [opts.field, 'auto-gen', opts.source];
  if (opts.handle) tags.push(`account:${opts.handle}`);
  if (opts.accountId) tags.push(`acct:${opts.accountId}`);
  const [row] = await db.insert(mediaAssets).values({
    tenantId: TENANT, projectId: opts.projectId || null, kind: 'image',
    filename: `${opts.field}-${stamp}.${ext}`, url, mimeType: opts.mime,
    sizeBytes: opts.buf.length, width: opts.width, height: opts.height,
    tags, notes: `auto-sourced for ${opts.field}${opts.handle ? ` · @${opts.handle}` : ''}`, source: opts.source,
  }).returning({ id: mediaAssets.id });
  return { url, id: row?.id ?? 0 };
}

// Download 1 image URL → buffer (validate mime/size). Trả null nếu hỏng.
async function downloadImage(link: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const ir = await fetch(link, { signal: AbortSignal.timeout(9000), redirect: 'follow' });
    if (!ir.ok) return null;
    const mime = ir.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//.test(mime)) return null;
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length < 800 || buf.length > 8 * 1024 * 1024) return null;
    return { buf, mime };
  } catch { return null; }
}

// Trả list candidate image URL từ 1 provider (nếu có key). Thử nhiều provider →
// dùng provider nào sẵn key. Openverse KHÔNG cần key (CC commercial) → luôn có web.
async function providerUrls(query: string): Promise<Array<{ url: string; provider: string }>> {
  const out: Array<{ url: string; provider: string }> = [];
  const q = encodeURIComponent(query);
  const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* skip provider */ } };

  // 1) Pexels
  const pexels = process.env.PEXELS_KEY || process.env.PEXELS_API_KEY;
  if (pexels) await safe(async () => {
    const r = await fetch(`https://api.pexels.com/v1/search?per_page=5&query=${q}`, { headers: { Authorization: pexels }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const p of (j.photos || [])) { const u = p?.src?.large2x || p?.src?.large || p?.src?.original; if (u) out.push({ url: u, provider: 'pexels' }); }
  });
  // 2) Pixabay
  const pixabay = process.env.PIXABAY_KEY || process.env.PIXABAY_API_KEY;
  if (pixabay) await safe(async () => {
    const r = await fetch(`https://pixabay.com/api/?key=${pixabay}&image_type=photo&safesearch=true&per_page=5&q=${q}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const h of (j.hits || [])) { const u = h?.largeImageURL || h?.webformatURL; if (u) out.push({ url: u, provider: 'pixabay' }); }
  });
  // 3) Unsplash
  const unsplash = process.env.UNSPLASH_KEY || process.env.UNSPLASH_ACCESS_KEY;
  if (unsplash) await safe(async () => {
    const r = await fetch(`https://api.unsplash.com/search/photos?per_page=5&query=${q}`, { headers: { Authorization: `Client-ID ${unsplash}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const p of (j.results || [])) { const u = p?.urls?.regular || p?.urls?.full; if (u) out.push({ url: u, provider: 'unsplash' }); }
  });
  // 4) Google CSE
  const gkey = process.env.GOOGLE_CSE_KEY || process.env.GOOGLE_SEARCH_KEY;
  const gcx = process.env.GOOGLE_CSE_CX || process.env.GOOGLE_CSE_ID;
  if (gkey && gcx) await safe(async () => {
    const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${gkey}&cx=${gcx}&searchType=image&num=5&safe=active&q=${q}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const it of (j.items || [])) { if (it?.link) out.push({ url: it.link, provider: 'google-cse' }); }
  });
  // 5) Openverse — KHÔNG cần key (CC, dùng thương mại). Luôn chạy (fallback đảm bảo web có ảnh).
  await safe(async () => {
    const tok = process.env.OPENVERSE_TOKEN ? { Authorization: `Bearer ${process.env.OPENVERSE_TOKEN}` } : undefined;
    const r = await fetch(`https://api.openverse.org/v1/images/?license_type=commercial&page_size=8&q=${q}`, { headers: { 'User-Agent': 'mos2-crew/1.0', ...(tok || {}) }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return; const j = await r.json();
    for (const im of (j.results || [])) { const u = im?.url; if (u) out.push({ url: u, provider: 'openverse' }); }
  });
  return out;
}

async function webSearchImage(query: string): Promise<{ buf: Buffer; mime: string; provider: string } | null> {
  const cands = await providerUrls(query);
  // Shuffle → bấm 🔍 lại ra ảnh KHÁC (đỡ lặp), vẫn dừng ở ảnh tải được đầu tiên.
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j]!, cands[i]!]; }
  for (const c of cands) {
    const dl = await downloadImage(c.url);
    if (dl) return { ...dl, provider: c.provider };
  }
  return null;
}

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  let body: { projectId?: string; accountId?: number; handle?: string; field?: string; source?: string; prompt?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  const field = (body.field || 'avatar').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'avatar';
  const wantWeb = body.source === 'web';
  const acc = await loadAccount(body.projectId || '', body.accountId ? Number(body.accountId) : undefined, body.handle);
  const projectId = body.projectId || acc?.projectId || '';
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });
  const persona = (acc?.persona as Record<string, unknown>) || {};
  const { size, banner } = fieldShape(field);
  const [w, h] = size.split('x').map(Number) as [number, number];

  try {
    if (wantWeb) {
      const q = body.prompt?.trim() || [personaDesc(persona), banner ? 'banner background' : 'portrait avatar photo'].filter(Boolean).join(' ');
      const found = await webSearchImage(q);
      if (!found) return NextResponse.json({ ok: false, error: 'web search chưa cấu hình (GOOGLE_CSE_KEY/CX) hoặc không tìm thấy ảnh' }, { status: 200 });
      const saved = await persist({ projectId, field, buf: found.buf, mime: found.mime, width: w, height: h, source: 'web', handle: acc?.handle ?? null, accountId: acc?.id ?? null, prompt: q });
      if (!saved) return NextResponse.json({ ok: false, error: 'persist fail' }, { status: 500 });
      return NextResponse.json({ ok: true, url: saved.url, id: saved.id, width: w, height: h, source: 'web' });
    }

    if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY chưa cấu hình' }, { status: 200 });
    const prompt = body.prompt?.trim() || buildPrompt(field, persona, banner);
    const client = getOpenAI()!;
    const res = await client.images.generate({ model: 'gpt-image-2', prompt, size, quality: 'medium', n: 1 });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ ok: false, error: 'gpt-image-2 không trả ảnh' }, { status: 200 });
    const buf = Buffer.from(b64, 'base64');
    const saved = await persist({ projectId, field, buf, mime: 'image/png', width: w, height: h, source: 'gen', handle: acc?.handle ?? null, accountId: acc?.id ?? null, prompt });
    if (!saved) return NextResponse.json({ ok: false, error: 'persist fail' }, { status: 500 });
    return NextResponse.json({ ok: true, url: saved.url, id: saved.id, width: w, height: h, source: 'gen' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `gen lỗi: ${(e as Error).message || String(e)}` }, { status: 200 });
  }
}
