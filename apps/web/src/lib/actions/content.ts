'use server';

import { touchEntity } from '@/lib/touch-entity';
import { and, eq } from 'drizzle-orm';
import { getDb, contentPieces } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL, aiEnabled } from '@/lib/ai/openai';
import { CHANNELS, publishedNeedsUrl, PUBLISHED_NEEDS_URL_MSG, scheduleTooFar, SCHEDULE_TOO_FAR_MSG, type ContentStatus } from '@/lib/content-channels';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'piece';
}

export interface ContentInput {
  slug?: string;
  title: string;
  channel: string;
  tribeSlug?: string | null;
  persona?: string | null;
  subject?: string | null;
  bodyMd: string;
  status?: ContentStatus;
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  publishUrl?: string | null;
  aiNotes?: string[];
  tags?: string[];
  metrics?: Record<string, string | number>;
}

export async function createContentPiece(projectId: string, input: ContentInput): Promise<{ ok: boolean; slug?: string; error?: string }> {
  if (!input.title.trim()) return { ok: false, error: 'title required' };
  if (publishedNeedsUrl(input.channel, input.status, input.publishUrl)) return { ok: false, error: PUBLISHED_NEEDS_URL_MSG };
  if (scheduleTooFar(input.scheduledAt, input.tags)) return { ok: false, error: SCHEDULE_TOO_FAR_MSG };
  const db = ensureDb();
  let slug = input.slug?.trim() || slugify(input.title);
  // Unique per project
  for (let i = 1; i < 100; i++) {
    const ex = await db.select({ id: contentPieces.id }).from(contentPieces)
      .where(and(eq(contentPieces.tenantId, TENANT), eq(contentPieces.projectId, projectId), eq(contentPieces.slug, slug)))
      .limit(1);
    if (ex.length === 0) break;
    slug = `${slugify(input.title)}-${i}`;
  }
  await db.insert(contentPieces).values({
    tenantId: TENANT, projectId, slug,
    title: input.title, channel: input.channel,
    tribeSlug: input.tribeSlug ?? null, persona: input.persona ?? null,
    subject: input.subject ?? null, bodyMd: input.bodyMd,
    status: input.status ?? 'draft',
    scheduledAt: input.scheduledAt ?? null,
    publishedAt: input.publishedAt ?? null,
    publishUrl: input.publishUrl ?? null,
    aiNotes: input.aiNotes ?? [],
    tags: input.tags ?? [],
    metrics: input.metrics ?? {},
  });
  await touchEntity('content', { projectId });
  return { ok: true, slug };
}

export async function updateContentPiece(id: number, projectId: string, patch: Partial<ContentInput>): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  // Đặt ngày cũng phải soi hàng hiện tại: patch thường chỉ mang mỗi scheduledAt, mà tag 'milestone'
  // (thứ cho phép đặt xa) nằm trong hàng cũ.
  if (patch.scheduledAt) {
    const tags = patch.tags ?? (await db.select({ tags: contentPieces.tags }).from(contentPieces)
      .where(eq(contentPieces.id, id)).limit(1))[0]?.tags as string[] | undefined;
    if (scheduleTooFar(patch.scheduledAt, tags ?? [])) return { ok: false, error: SCHEDULE_TOO_FAR_MSG };
  }
  // Patch lẻ nên phải soi hàng hiện tại: đổi mỗi status sang 'published' mà link nằm sẵn trong DB thì
  // vẫn hợp lệ, còn đổi status khi cột link trống thì không.
  if (patch.status === 'published' || patch.publishUrl !== undefined || patch.channel !== undefined) {
    const [cur] = await db.select({ channel: contentPieces.channel, status: contentPieces.status, publishUrl: contentPieces.publishUrl })
      .from(contentPieces).where(eq(contentPieces.id, id)).limit(1);
    if (publishedNeedsUrl(patch.channel ?? cur?.channel ?? '', patch.status ?? cur?.status,
      patch.publishUrl !== undefined ? patch.publishUrl : cur?.publishUrl)) return { ok: false, error: PUBLISHED_NEEDS_URL_MSG };
  }
  const set: Partial<typeof contentPieces.$inferInsert> = { updatedAt: new Date() };
  for (const key of Object.keys(patch) as Array<keyof ContentInput>) {
    const v = patch[key];
    if (v === undefined) continue;
    (set as Record<string, unknown>)[key] = v;
  }
  await db.update(contentPieces).set(set).where(eq(contentPieces.id, id));
  await touchEntity('content', { projectId });
  return { ok: true };
}

export async function archiveContentPiece(id: number, projectId: string): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(contentPieces).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(contentPieces.id, id));
  await touchEntity('content', { projectId });
  return { ok: true };
}

// AI generate: produce title + bodyMd + subject + aiNotes from prompt + channel.
export async function generateContent(input: {
  prompt: string;
  channel: string;
  tribeSlug?: string;
  persona?: string;
  skillSnippet?: string;  // optional skill body từ /library to use as system prompt
}): Promise<{ ok: boolean; title?: string; subject?: string; bodyMd?: string; aiNotes?: string[]; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const client = getOpenAI();
  if (!client) return { ok: false, error: 'OpenAI client unavailable' };

  const channel = CHANNELS.find((c) => c.id === input.channel);
  const channelHint = channel ? `${channel.label} — ${channel.hint}` : input.channel;

  const systemPrompt = input.skillSnippet?.trim()
    ? input.skillSnippet
    : `Bạn là content creator cho marketing portfolio (Earns project). Output style trực tiếp, không sáo rỗng, action-driven.`;

  const userPrompt = `Tạo 1 piece content cho channel: ${channelHint}
${input.tribeSlug ? `Tribe / audience: ${input.tribeSlug}` : ''}
${input.persona ? `Persona / handle: ${input.persona}` : ''}
Brief: ${input.prompt}

Trả JSON object: { "title": "≤60 chars", "subject": "≤80 chars hook hoặc subject line (rỗng nếu không phải email/post)", "bodyMd": "full content markdown", "aiNotes": [3-5 quick checks về hook/tone/CTA] }`;

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1200,
    });
    const text = res.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text) as { title?: unknown; subject?: unknown; bodyMd?: unknown; aiNotes?: unknown };
    return {
      ok: true,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      bodyMd: typeof parsed.bodyMd === 'string' ? parsed.bodyMd : '',
      aiNotes: Array.isArray(parsed.aiNotes) ? parsed.aiNotes.filter((n): n is string => typeof n === 'string') : [],
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Chi tiết 1 bài cho drawer trên LỊCH plays — lấy đúng phần cần để runner chạy (caption + link đã đăng).
// Lịch chỉ mang cột nhẹ (CalPiece) để global /plays không kéo body_md của cả trăm bài; mở drawer mới nạp.
export async function getPieceDetail(id: number, projectId: string): Promise<{ bodyMd: string; publishUrl: string | null; publishedAt: string | null; metrics: Record<string, string | number>; tribeSlug: string | null; persona: string | null } | null> {
  const db = ensureDb();
  // tribe + persona đi kèm luôn: form sửa bài mà không đọc được hai cột này thì lúc lưu sẽ ghi đè
  // null lên giá trị đang có — sửa cái tiêu đề, mất luôn tribe.
  const rows = await db.select({ bodyMd: contentPieces.bodyMd, publishUrl: contentPieces.publishUrl, publishedAt: contentPieces.publishedAt, metrics: contentPieces.metrics, tribeSlug: contentPieces.tribeSlug, persona: contentPieces.persona })
    .from(contentPieces)
    .where(and(eq(contentPieces.tenantId, TENANT), eq(contentPieces.projectId, projectId), eq(contentPieces.id, id)))
    .limit(1);
  const r = rows[0];
  return r ? { bodyMd: r.bodyMd, publishUrl: r.publishUrl, publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null, metrics: (r.metrics as Record<string, string | number>) ?? {}, tribeSlug: r.tribeSlug, persona: r.persona } : null;
}

/** Bài có link thì trang đích PHẢI tồn tại — đăng link 404 là mất uy tín ở đúng chỗ vừa xin sự chú ý,
 *  và trên Facebook/Reddit thì bài link hỏng còn bị dìm. Kiểm bằng máy, ghi kết quả vào tag để lịch
 *  và banner "thiếu nguyên liệu" đọc được: linkcheck:ok | linkcheck:bad.
 *  Không kiểm được cta:<path> vì đó là đường dẫn tương đối, chưa biết tên miền của project. */
export async function checkPieceLinks(id: number, projectId: string): Promise<{ ok: boolean; results: Array<{ url: string; status: number }> }> {
  const db = ensureDb();
  const rows = await db.select({ bodyMd: contentPieces.bodyMd, tags: contentPieces.tags })
    .from(contentPieces).where(eq(contentPieces.id, id)).limit(1);
  const row = rows[0];
  if (!row) return { ok: false, results: [] };

  const urls = [...new Set((row.bodyMd ?? '').match(/https?:\/\/[^\s<>")]+/g) ?? [])].slice(0, 8);
  const results: Array<{ url: string; status: number }> = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
      results.push({ url, status: r.status });
    } catch {
      results.push({ url, status: 0 });   // 0 = không nối được (DNS/timeout)
    }
  }
  const ok = results.every((r) => r.status >= 200 && r.status < 400);
  const tags = ((row.tags as string[] | null) ?? []).filter((t) => !t.startsWith('linkcheck:'));
  if (results.length) tags.push(`linkcheck:${ok ? 'ok' : 'bad'}`);
  await db.update(contentPieces).set({ tags, updatedAt: new Date() }).where(eq(contentPieces.id, id));
  await touchEntity('content', { projectId });
  return { ok, results };
}

// Lựa chọn cho form soạn bài — nạp LÚC MỞ FORM, không kéo sẵn theo trang. /plays là trang toàn
// portfolio (43 project); kéo skill + tribe của mọi project vào payload chỉ để thỉnh thoảng mở
// một form là trả giá ở mọi lần tải trang.
export async function pieceFormOptions(projectId: string): Promise<{
  skills: Array<{ slug: string; title: string; body: string }>;
  tribes: Array<{ slug: string; name: string }>;
}> {
  const [{ listSkills }, { listTribes }] = await Promise.all([import('@/lib/actions/library'), import('@/lib/data')]);
  const [skills, tribes] = await Promise.all([listSkills(), listTribes(projectId)]);
  return {
    skills: skills.map((s) => ({ slug: s.slug, title: s.title, body: s.body })),
    tribes: tribes.map((t) => ({ slug: t.slug, name: t.name })),
  };
}
