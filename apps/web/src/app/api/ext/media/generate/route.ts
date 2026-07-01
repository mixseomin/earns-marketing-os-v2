import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts, mediaAssets } from '@mos2/db';
import { and, eq } from 'drizzle-orm';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { uploadToR2, r2Enabled } from '@/lib/r2';
import { mechCanon } from '@/lib/selector-field-canon';
import { errorResponse } from '@/lib/ext-route';
import { searchStockPhotos, downloadImage } from '@/lib/stock-photos';

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

async function webSearchImage(query: string): Promise<{ buf: Buffer; mime: string; provider: string } | null> {
  const cands = await searchStockPhotos(query);
  // Shuffle → bấm 🔍 lại ra ảnh KHÁC (đỡ lặp), vẫn dừng ở ảnh tải được đầu tiên.
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j]!, cands[i]!]; }
  for (const c of cands) {
    const dl = await downloadImage(c.url);
    if (dl) return { ...dl, provider: c.provider };
  }
  return null;
}

export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;
  let body: { projectId?: string; accountId?: number; handle?: string; field?: string; source?: string; prompt?: string; url?: string; dataUrl?: string };
  try { body = await req.json(); } catch { return errorResponse('bad json', 400); }

  const field = mechCanon(body.field || 'avatar') || 'avatar';
  const wantWeb = body.source === 'web';
  const acc = await loadAccount(body.projectId || '', body.accountId ? Number(body.accountId) : undefined, body.handle);
  const projectId = body.projectId || acc?.projectId || '';
  if (!projectId) return errorResponse('projectId required', 400);
  const persona = (acc?.persona as Record<string, unknown>) || {};
  const { size, banner } = fieldShape(field);
  const [w, h] = size.split('x').map(Number) as [number, number];

  try {
    // CAPTURE: ảnh đang hiển thị TRÊN SITE (user đổi avatar trực tiếp) → import vào
    // MOS2 để khớp thực tế. dataUrl (ext fetch sẵn, ưu tiên) hoặc url (server tải).
    if (body.source === 'capture') {
      let buf: Buffer | null = null; let mime = 'image/png';
      if (body.dataUrl) {
        const m = /^data:([^;]+);base64,(.*)$/s.exec(body.dataUrl);
        if (m) { mime = m[1]!; buf = Buffer.from(m[2]!, 'base64'); }
      } else if (body.url) {
        const dl = await downloadImage(body.url); if (dl) { buf = dl.buf; mime = dl.mime; }
      }
      if (!buf || buf.length < 200) return errorResponse('không lấy được ảnh hiện tại', 200);
      const saved = await persist({ projectId, field, buf, mime, width: w, height: h, source: 'captured', handle: acc?.handle ?? null, accountId: acc?.id ?? null, prompt: 'captured from site' });
      if (!saved) return errorResponse('persist fail', 500);
      return NextResponse.json({ ok: true, url: saved.url, id: saved.id, width: w, height: h, source: 'captured' });
    }

    // FACES: mặt người StyleGAN LIVE (this-person-does-not-exist.com) — miễn phí, ko key, mỗi lần 1 mặt
    // UNIQUE ko trùng người thật (ko reverse-image match) → lý tưởng avatar seeding. Gender khớp persona.
    // (thispersondoesnotexist.com đã thành landing tĩnh — dùng mirror này thay.) Chỉ hợp avatar (ko banner).
    if (body.source === 'faces') {
      const g = /female|woman|\bnữ\b|\bf\b/i.test(String(persona.gender ?? '')) ? 'female' : 'male';
      const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
      let faceUrl = '';
      try {
        const jr = await fetch(`https://this-person-does-not-exist.com/new?new=1&gender=${g}&age=all&etnic=all`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(9000) });
        if (jr.ok) { const j = await jr.json() as { src?: string }; if (j.src) faceUrl = 'https://this-person-does-not-exist.com' + j.src; }
      } catch { /* fall through → lỗi 200 dưới */ }
      const dl = faceUrl ? await downloadImage(faceUrl) : null;
      if (!dl) return errorResponse('nguồn ảnh mặt không tải được — thử ✨ AI hoặc 🔍 web', 200);
      const saved = await persist({ projectId, field, buf: dl.buf, mime: dl.mime, width: 1024, height: 1024, source: 'faces', handle: acc?.handle ?? null, accountId: acc?.id ?? null, prompt: `this-person-does-not-exist (StyleGAN ${g})` });
      if (!saved) return errorResponse('persist fail', 500);
      return NextResponse.json({ ok: true, url: saved.url, id: saved.id, width: 1024, height: 1024, source: 'faces' });
    }

    if (wantWeb) {
      const q = body.prompt?.trim() || [personaDesc(persona), banner ? 'banner background' : 'portrait avatar photo'].filter(Boolean).join(' ');
      const found = await webSearchImage(q);
      if (!found) return errorResponse('web search chưa cấu hình (GOOGLE_CSE_KEY/CX) hoặc không tìm thấy ảnh', 200);
      const saved = await persist({ projectId, field, buf: found.buf, mime: found.mime, width: w, height: h, source: 'web', handle: acc?.handle ?? null, accountId: acc?.id ?? null, prompt: q });
      if (!saved) return errorResponse('persist fail', 500);
      return NextResponse.json({ ok: true, url: saved.url, id: saved.id, width: w, height: h, source: 'web' });
    }

    if (!aiEnabled()) return errorResponse('OPENAI_API_KEY chưa cấu hình', 200);
    const prompt = body.prompt?.trim() || buildPrompt(field, persona, banner);
    const client = getOpenAI()!;
    const res = await client.images.generate({ model: 'gpt-image-2', prompt, size, quality: 'medium', n: 1 });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return errorResponse('gpt-image-2 không trả ảnh', 200);
    const buf = Buffer.from(b64, 'base64');
    const saved = await persist({ projectId, field, buf, mime: 'image/png', width: w, height: h, source: 'gen', handle: acc?.handle ?? null, accountId: acc?.id ?? null, prompt });
    if (!saved) return errorResponse('persist fail', 500);
    return NextResponse.json({ ok: true, url: saved.url, id: saved.id, width: w, height: h, source: 'gen' });
  } catch (e) {
    return errorResponse(`gen lỗi: ${(e as Error).message || String(e)}`, 200);
  }
}
