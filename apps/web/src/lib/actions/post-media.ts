'use server';

// Media cho 1 post (card): sinh ảnh AI (gpt-image-2 — gpt-image-1 đã lỗi thời,
// xem memory reference_image_gen_model), gắn/gỡ media_asset, list thư
// viện để chọn. cards.media_asset_id = ảnh/video kèm bài.
//
// Voice + habitat visual style inject: voice_profile preset → image style hint
// (shitposter = meme/jpeg, expert = clean data viz, hype = neon...) + habitat
// visual_style_descriptor (AI-inferred từ icon) → ảnh fit theme community.

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { uploadToR2 } from '@/lib/r2';
import { resolveVoiceProfile, voiceImageStyle } from '@/lib/ai/voice-profile';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

export interface ProjectMediaItem {
  id: number; filename: string; url: string; kind: string;
  width: number | null; height: number | null; source: string | null; createdAt: string;
}

export async function listProjectMedia(
  projectId: string, kind: string = 'image',
): Promise<ProjectMediaItem[]> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT id, filename, url, kind, width, height, source, created_at
    FROM media_assets
    WHERE (project_id = ${projectId} OR project_id IS NULL)
      AND (${kind} = '' OR kind = ${kind})
    ORDER BY created_at DESC LIMIT 80
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    filename: String(r.filename ?? ''),
    url: String(r.url ?? ''),
    kind: String(r.kind ?? 'image'),
    width: r.width != null ? Number(r.width) : null,
    height: r.height != null ? Number(r.height) : null,
    source: r.source ? String(r.source) : null,
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : '',
  }));
}

export async function setCardMedia(
  projectId: string, cardId: number, mediaAssetId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const res = await db.execute(sql`
    UPDATE cards SET media_asset_id = ${mediaAssetId}, updated_at = now()
    WHERE id = ${cardId} AND project_id = ${projectId}
    RETURNING id
  `);
  if ((res as unknown as Array<unknown>).length === 0) return { ok: false, error: 'card not in project' };
  // KHÔNG revalidatePath — client tự setState (mediaAssetId + mediaUrl).
  return { ok: true };
}

// Lấy 1 mục dưới heading "## <name>" trong scaffold để làm prompt ảnh.
function sectionOf(body: string, ...names: string[]): string {
  const lines = (body || '').split('\n');
  const want = names.map((n) => n.toLowerCase());
  let cap = false; const out: string[] = [];
  for (const ln of lines) {
    const h = ln.match(/^#{1,3}\s+(.*)/);
    if (h) { cap = want.some((w) => h[1]!.toLowerCase().includes(w)); continue; }
    if (cap && ln.trim() && !/^_\(.*\)_$/.test(ln.trim())) out.push(ln.trim());
  }
  return out.join(' ').slice(0, 600);
}

// Aspect ratio per content type. Carousel = 1:1 (Instagram square), story = 9:16.
function aspectAndSize(contentType: string): { aspect: string; size: '1024x1024' | '1024x1792' | '1792x1024' } {
  if (contentType === 'story') return { aspect: 'vertical 9:16 mobile-first', size: '1024x1792' };
  if (contentType === 'video' || contentType === 'link') return { aspect: 'landscape 16:9', size: '1792x1024' };
  // carousel = 1:1 (sequence trong feed)
  return { aspect: 'square 1:1', size: '1024x1024' };
}

interface ImageContext {
  cardId: number;
  projectId: string;
  contentType: string;
  title: string;
  visualBrief: string;
  tone: string;
  habitatName: string;
  habitatVoiceProfile: string;
  habitatVisualStyle: string | null;
  channelVoiceOverride: string | null;
  channelDescription: string;
}

async function loadImageContext(
  projectId: string, cardId: number,
): Promise<ImageContext | { error: string }> {
  const db = ensureDb();
  const rows = await db.execute(sql`
    SELECT c.title, c.body_review, c.body_target, c.content_type, c.brief_id, c.channel_id,
           b.tone, b.narrative_md,
           h.name AS habitat_name, h.kind AS habitat_kind,
           h.voice_profile, h.visual_style_descriptor,
           hc.voice_profile_override AS channel_voice_override,
           hc.description AS channel_description,
           pa.handle AS account_handle
      FROM cards c
      LEFT JOIN community_briefs b ON b.id = c.brief_id
      LEFT JOIN habitats h ON h.id = b.habitat_id
      LEFT JOIN habitat_channels hc ON hc.id = c.channel_id
      LEFT JOIN platform_accounts pa ON pa.id = b.account_id
     WHERE c.id = ${cardId} AND c.project_id = ${projectId}
     LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { error: 'card not in project' };

  const ct = String(r.content_type ?? 'text');
  const title = String(r.title ?? '').replace(/^\[[^\]]*\]\s*/, '');
  const body = String(r.body_review ?? '');
  return {
    cardId, projectId,
    contentType: ct,
    title,
    visualBrief: sectionOf(body, 'brief hinh anh', 'brief hình ảnh', 'caption', 'noi dung', 'nội dung'),
    tone: String(r.tone ?? '') || 'clean, modern, on-brand',
    habitatName: String(r.habitat_name ?? ''),
    habitatVoiceProfile: String(r.voice_profile ?? 'regular'),
    habitatVisualStyle: r.visual_style_descriptor ? String(r.visual_style_descriptor) : null,
    channelVoiceOverride: r.channel_voice_override ? String(r.channel_voice_override) : null,
    channelDescription: String(r.channel_description ?? ''),
  };
}

// Build image prompt v2: voice profile style + habitat visual descriptor +
// channel intent (nếu có). Variant index để tạo prompt variation cho mode
// variants (giữ palette/style consistent, đổi composition/angle).
function buildImagePrompt(ctx: ImageContext, variantHint?: string): string {
  const { aspect } = aspectAndSize(ctx.contentType);
  const voice = resolveVoiceProfile(ctx.habitatVoiceProfile, ctx.channelVoiceOverride);
  const voiceStyle = voiceImageStyle(voice);
  return [
    `Social media visual for a community post titled "${ctx.title}".`,
    ctx.visualBrief ? `Visual concept: ${ctx.visualBrief}.` : '',
    ctx.channelDescription ? `Channel context: ${ctx.channelDescription}.` : '',
    `Brand tone: ${ctx.tone}.`,
    voiceStyle ? `Style direction (voice profile=${voice}): ${voiceStyle}.` : '',
    ctx.habitatVisualStyle ? `Community aesthetic (match this vibe): ${ctx.habitatVisualStyle}.` : '',
    `Composition: ${aspect}, social-feed ready, high contrast, no text overlay, no watermark, no logo.`,
    variantHint ? `Variation: ${variantHint}.` : '',
    voice === 'shitposter' || voice === 'edgelord'
      ? 'Style: deliberately raw/imperfect — do NOT make it look polished or stocky.'
      : 'Style: polished, editorial, not stocky.',
  ].filter(Boolean).join(' ');
}

// Insert 1 generated image vào media_assets, optionally link làm media chính
// của card. Trả {assetId, url}. Tách helper để reuse cho variants/sequence.
async function persistImage(
  ctx: ImageContext, buf: Buffer, b64: string,
  size: { w: number; h: number },
  promptUsed: string,
  link: boolean,
  variantTag: string,
): Promise<{ assetId: number; url: string }> {
  const db = ensureDb();
  const fn = (ctx.title || `card-${ctx.cardId}`).replace(/[^a-zA-Z0-9-_ ]/g, '').trim().slice(0, 60)
    + `-${variantTag}.png`;
  const r2url = await uploadToR2(`posts/${ctx.projectId}/${ctx.cardId}-${Date.now()}-${variantTag}.png`, buf, 'image/png');
  const storeUrl = r2url ?? `data:image/png;base64,${b64}`;
  const ins = await db.execute(sql`
    INSERT INTO media_assets
      (tenant_id, project_id, kind, filename, url, mime_type, size_bytes,
       width, height, source, tags, notes)
    VALUES
      ('self', ${ctx.projectId}, 'image', ${fn}, ${storeUrl}, 'image/png',
       ${buf.length}, ${size.w}, ${size.h}, 'gen',
       ${JSON.stringify(['post-gen', 'gpt-image-2', r2url ? 'r2' : 'data-url',
                         `card:${ctx.cardId}`, `variant:${variantTag}`])}::jsonb,
       ${`Auto-sinh cho post #${ctx.cardId} (${ctx.contentType}, ${variantTag}). Prompt: ${promptUsed.slice(0, 220)}`})
    RETURNING id
  `);
  const assetId = Number((ins as unknown as Array<{ id: number }>)[0]!.id);
  if (link) {
    await db.execute(sql`
      UPDATE cards SET media_asset_id = ${assetId}, updated_at = now()
      WHERE id = ${ctx.cardId} AND project_id = ${ctx.projectId}
    `);
  }
  return { assetId, url: storeUrl };
}

// Sinh 1 ảnh — set làm media chính của card. Behavior cũ, vẫn dùng cho text/image post.
export async function generatePostImage(
  projectId: string, cardId: number,
): Promise<{ ok: boolean; assetId?: number; url?: string; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const ctxOrErr = await loadImageContext(projectId, cardId);
  if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
  const ctx = ctxOrErr;
  const { size } = aspectAndSize(ctx.contentType);
  const prompt = buildImagePrompt(ctx);
  try {
    const client = getOpenAI()!;
    const res = await client.images.generate({
      model: 'gpt-image-2', prompt, size, quality: 'medium', n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: 'gpt-image-2 không trả ảnh' };
    const buf = Buffer.from(b64, 'base64');
    const [w, h] = size.split('x').map(Number) as [number, number];
    const saved = await persistImage(ctx, buf, b64, { w, h }, prompt, true, 'v1');
    return { ok: true, assetId: saved.assetId, url: saved.url };
  } catch (e) {
    return { ok: false, error: `Sinh ảnh lỗi: ${(e as Error).message || String(e)}` };
  }
}

// Sinh N variants song song với prompt variations khác composition/angle.
// Trả list — user pick 1, không tự link làm media chính. Cost = N × $0.053.
export async function generatePostImageVariants(
  projectId: string, cardId: number, count: number = 3,
): Promise<{ ok: boolean; variants?: Array<{ assetId: number; url: string }>; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  if (count < 1 || count > 6) return { ok: false, error: 'count phải 1-6' };
  const ctxOrErr = await loadImageContext(projectId, cardId);
  if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
  const ctx = ctxOrErr;
  const { size } = aspectAndSize(ctx.contentType);

  // Variant hints — đổi composition để model sinh ảnh thực sự khác nhau (chỉ
  // bump temperature/seed thì variations quá giống). Cap 6 hints.
  const VARIANT_HINTS = [
    'wide composition, centered subject',
    'close-up detail, shallow depth of field',
    'overhead/top-down angle',
    'low angle, dramatic perspective',
    'asymmetric off-center composition',
    'symmetrical balanced framing',
  ];

  try {
    const client = getOpenAI()!;
    const tasks = Array.from({ length: count }, (_, i) => {
      const hint = VARIANT_HINTS[i % VARIANT_HINTS.length]!;
      const prompt = buildImagePrompt(ctx, hint);
      return client.images.generate({
        model: 'gpt-image-2', prompt, size, quality: 'medium', n: 1,
      }).then(async (res) => {
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) return null;
        const buf = Buffer.from(b64, 'base64');
        const [w, h] = size.split('x').map(Number) as [number, number];
        return persistImage(ctx, buf, b64, { w, h }, prompt, false, `var-${i + 1}`);
      }).catch(() => null);
    });
    const results = (await Promise.all(tasks)).filter((x): x is { assetId: number; url: string } => x != null);
    if (results.length === 0) return { ok: false, error: 'Tất cả variants đều fail' };
    return { ok: true, variants: results };
  } catch (e) {
    return { ok: false, error: `Sinh variants lỗi: ${(e as Error).message || String(e)}` };
  }
}

// Sinh N ảnh tuần tự cho carousel/thread (storytelling sequence). Mỗi ảnh
// đại diện 1 beat của bài: hook → context → twist → proof → CTA (cho carousel
// 5 ảnh; thread = 3 ảnh = hook → midpoint → reveal). Style/palette locked
// qua habitat visual descriptor để có continuity.
//
// Khác variants: variants = N versions của CÙNG 1 ảnh, sequence = N ảnh khác
// nhau telling 1 câu chuyện. KHÔNG link auto vào card.media_asset_id (card
// đơn 1 media, sequence phải dùng cards.gallery hoặc multi-card).
export async function generatePostImageSequence(
  projectId: string, cardId: number,
): Promise<{ ok: boolean; sequence?: Array<{ assetId: number; url: string; beat: string }>; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const ctxOrErr = await loadImageContext(projectId, cardId);
  if ('error' in ctxOrErr) return { ok: false, error: ctxOrErr.error };
  const ctx = ctxOrErr;

  // Số beats per content type
  const ct = ctx.contentType;
  const beats: string[] = ct === 'carousel'
    ? ['hook (attention grab)', 'context (set the scene)', 'twist (the surprise)', 'proof (evidence/data)', 'CTA (the ask)']
    : ct === 'thread'
      ? ['opening hook', 'midpoint reveal', 'closing punch']
      : ['hero shot'];

  if (beats.length === 1) {
    // Không phải sequence type → fallback gọi generatePostImage
    const r = await generatePostImage(projectId, cardId);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, sequence: [{ assetId: r.assetId!, url: r.url!, beat: 'hero shot' }] };
  }

  const { size } = aspectAndSize(ct);

  try {
    const client = getOpenAI()!;
    // Sequence chạy SONG SONG (Promise.all) — 5 calls ~10s thay vì 50s.
    // Trade-off: model không biết ảnh trước → continuity phụ thuộc vào
    // habitat visual descriptor + palette locked trong prompt.
    const tasks = beats.map((beat, i) => {
      const beatHint = `sequence beat ${i + 1}/${beats.length}: ${beat}. CONTINUITY: same color palette + style as other beats in this sequence.`;
      const prompt = buildImagePrompt(ctx, beatHint);
      return client.images.generate({
        model: 'gpt-image-2', prompt, size, quality: 'medium', n: 1,
      }).then(async (res) => {
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) return null;
        const buf = Buffer.from(b64, 'base64');
        const [w, h] = size.split('x').map(Number) as [number, number];
        const saved = await persistImage(ctx, buf, b64, { w, h }, prompt, false, `seq-${i + 1}`);
        return { ...saved, beat };
      }).catch(() => null);
    });
    const results = (await Promise.all(tasks)).filter((x): x is { assetId: number; url: string; beat: string } => x != null);
    if (results.length === 0) return { ok: false, error: 'Tất cả beats đều fail' };
    return { ok: true, sequence: results };
  } catch (e) {
    return { ok: false, error: `Sinh sequence lỗi: ${(e as Error).message || String(e)}` };
  }
}
