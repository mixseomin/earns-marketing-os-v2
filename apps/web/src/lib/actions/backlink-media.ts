'use server';

// Prepare post media for backlink tasks straight from the drawer: search the stock
// providers, or AI-generate, then persist into media_assets for the project. Reuses
// the same image pipeline as the ext media/generate route (lib/stock-photos + R2).
import { getDb, mediaAssets } from '@mos2/db';
import { and, eq, sql } from 'drizzle-orm';
import { uploadToR2, r2Enabled } from '@/lib/r2';
import { getOpenAI, aiEnabled, DEFAULT_MODEL } from '@/lib/ai/openai';
import { searchStockPhotos, downloadImage, type PhotoCandidate } from '@/lib/stock-photos';
import { getCurrentUser } from '@/lib/auth';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const wide = (field: string) => /(cover|banner|screenshot|thumbnail|infographic|header|wallpaper)/i.test(field);

async function requireAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

async function persist(projectId: string, field: string, buf: Buffer, mime: string, source: string, w: number | null, h: number | null, originUrl?: string): Promise<{ id: number; url: string } | null> {
  const db = getDb(); if (!db) return null;
  const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const key = `backlink/${projectId || 'misc'}/${field}-${stamp}.${ext}`;
  let url = r2Enabled() ? await uploadToR2(key, buf, mime) : null;
  if (!url) url = `data:${mime};base64,${buf.toString('base64')}`;
  // origin:<stock url> lets the picker dedup already-saved images (R2 url ≠ stock url).
  const tags = [field, 'backlink', source, ...(originUrl ? [`origin:${originUrl}`] : [])];
  const [row] = await db.insert(mediaAssets).values({
    tenantId: TENANT, projectId: projectId || null, kind: 'image',
    filename: `${field}-${stamp}.${ext}`, url, mimeType: mime,
    sizeBytes: buf.length, width: w, height: h,
    tags, notes: `backlink ${field} · ${source}`, source,
  }).returning({ id: mediaAssets.id });
  return row ? { id: row.id, url } : null;
}

// Delete a saved project media asset (admin, project-scoped). Called from the drawer with confirm.
export async function deleteBacklinkMedia(projectId: string, id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  await db.delete(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.projectId, projectId)));
  return { ok: true };
}

// Search stock/web providers → candidate URLs (not saved yet; user picks one).
export async function searchBacklinkMedia(query: string): Promise<{ ok: boolean; candidates?: PhotoCandidate[]; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const q = query.trim();
  if (!q) return { ok: false, error: 'query rỗng' };
  const raw = await searchStockPhotos(q);
  const seen = new Set<string>();
  const candidates = raw.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true))).slice(0, 12);
  return candidates.length ? { ok: true, candidates } : { ok: false, error: 'không tìm thấy ảnh (chưa cấu hình provider key?)' };
}

// Download a chosen candidate → R2 → media_assets for the project.
export async function attachBacklinkMedia(projectId: string, url: string, field: string): Promise<{ ok: boolean; id?: number; url?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  if (!projectId || !/^https?:\/\//.test(url)) return { ok: false, error: 'input không hợp lệ' };
  const dl = await downloadImage(url);
  if (!dl) return { ok: false, error: 'không tải được ảnh' };
  const saved = await persist(projectId, field, dl.buf, dl.mime, 'web', null, null, url);
  return saved ? { ok: true, ...saved } : { ok: false, error: 'lưu thất bại' };
}

// One-click auto-prep: register the site's branded OG cover, a live homepage screenshot
// (thum.io), and the logo — all free hotlinks, no manual step. Idempotent by url.
export async function autoPrepareProjectMedia(projectId: string, website: string): Promise<{ ok: boolean; added?: number; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const site = (website || '').replace(/\/$/, '');
  if (!/^https?:\/\//.test(site)) return { ok: false, error: 'project chưa có website' };
  const rows: Array<{ field: string; url: string; w: number | null; h: number | null; notes: string; check?: boolean }> = [
    { field: 'cover', url: `${site}/opengraph-image`, w: 1200, h: 630, notes: 'Auto: OG cover (branded)' },
    { field: 'screenshot', url: `https://image.thum.io/get/width/1200/${site}`, w: 1200, h: null, notes: 'Auto: homepage screenshot' },
    { field: 'logo', url: `${site}/logo.png`, w: null, h: null, notes: 'Auto: site logo', check: true },
  ];
  let added = 0;
  for (const r of rows) {
    if (r.check) {
      try { const h = await fetch(r.url, { method: 'HEAD', signal: AbortSignal.timeout(6000) }); if (!h.ok || !/^image\//.test(h.headers.get('content-type') || '')) continue; } catch { continue; }
    }
    const [ex] = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.url, r.url)).limit(1);
    if (ex) continue;
    await db.insert(mediaAssets).values({
      tenantId: TENANT, projectId, kind: 'image', filename: `${r.field}.png`, url: r.url,
      mimeType: 'image/png', width: r.w, height: r.h, tags: [r.field, 'backlink', 'auto'], notes: r.notes, source: 'auto',
    });
    added++;
  }
  return { ok: true, added };
}

// Write the post/article a backlink task needs to embed the link (guest post, blog,
// community write-up). Output = English Markdown with one inline link to the site, saved
// into prep_payload.draft so it flows through the drawer's md/html/plain + link-mode UI.
export async function generateBacklinkDraft(taskId: number, ctx: {
  projectName: string; website: string; oneLiner?: string; bio?: string;
  title?: string; instructions?: string; mechanism?: string;
}): Promise<{ ok: boolean; draft?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const db = getDb(); if (!db) return { ok: false, error: 'no db' };
  const site = (ctx.website || '').replace(/\/$/, '');
  if (!/^https?:\/\//.test(site)) return { ok: false, error: 'project chưa có website' };
  const brief = [
    `Product: ${ctx.projectName} (${site})`,
    ctx.oneLiner && `What it is: ${ctx.oneLiner}`,
    ctx.bio && `More: ${ctx.bio}`,
    ctx.title && `Placement: ${ctx.title}`,
    ctx.mechanism && `Mechanism: ${ctx.mechanism}`,
    ctx.instructions && `Instructions (internal, Vietnamese): ${ctx.instructions}`,
  ].filter(Boolean).join('\n');
  const prompt = `Write a helpful 350-500 word blog/community post in ENGLISH, in Markdown, that a real person would publish on the target platform below. It must read as genuine editorial value (a tip, guide, or perspective on the topic), NOT an ad.

${brief}

Rules:
- One short H1 title (# ...), then body paragraphs, optionally one short list.
- Embed the product link exactly ONCE, naturally in-context, as a Markdown link: [${ctx.projectName}](${site}). Do not repeat the URL elsewhere.
- Human voice: no em dashes (use "-"), no "in today's fast-paced world", no "delve", no marketing fluff, vary sentence length.
- Topic must match the placement/platform audience. Do not mention that this is for a backlink.
Return ONLY the Markdown, no preamble.`;
  try {
    const res = await getOpenAI()!.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });
    let draft = res.choices?.[0]?.message?.content?.trim().replace(/^```(?:markdown|md)?\n?|\n?```$/g, '').trim();
    if (!draft) return { ok: false, error: 'AI không trả nội dung' };
    if (!draft.includes(site)) draft += `\n\nLearn more: [${ctx.projectName}](${site})`; // guarantee the link exists
    await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb) || jsonb_build_object('draft', to_jsonb(${draft}::text)), updated_at = now() WHERE id = ${taskId} AND platform_key = 'backlink'`);
    return { ok: true, draft };
  } catch (e) {
    return { ok: false, error: `gen lỗi: ${(e as Error).message || String(e)}` };
  }
}

// AI-generate a fresh image for the field and persist it.
export async function generateBacklinkMedia(projectId: string, prompt: string, field: string): Promise<{ ok: boolean; id?: number; url?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  if (!projectId) return { ok: false, error: 'thiếu project' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const p = prompt.trim() || `Clean, modern illustration for a "${field}". Aesthetic, tasteful. No text, no logo, no watermark.`;
  const size = wide(field) ? '1536x1024' : '1024x1024';
  const [w, h] = size.split('x').map(Number) as [number, number];
  try {
    const res = await getOpenAI()!.images.generate({ model: 'gpt-image-2', prompt: p, size, quality: 'medium', n: 1 });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: 'gpt-image không trả ảnh' };
    const saved = await persist(projectId, field, Buffer.from(b64, 'base64'), 'image/png', 'gen', w, h);
    return saved ? { ok: true, ...saved } : { ok: false, error: 'lưu thất bại' };
  } catch (e) {
    return { ok: false, error: `gen lỗi: ${(e as Error).message || String(e)}` };
  }
}
