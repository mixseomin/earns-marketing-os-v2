'use server';

// Classify project HABITATS into existing project TRIBES using AI.
// The AI must pick from the tribes that ALREADY exist (it does NOT invent
// tribes — use suggestTribesForProject for that). PROPOSES only; the
// operator reviews + edits the mapping, then bulkAssignHabitatTribe applies.
//
// scope:
//   'needs-fix' (default) → habitats with no tribe OR whose current tribe
//                            is defunct (the ones actually needing a home)
//   'all'                  → every habitat in the project

import { getOpenAI, DEFAULT_MODEL, aiEnabled } from './openai';
import { getDb, projects, tribes, habitats } from '@mos2/db';
import { eq, and } from 'drizzle-orm';

export interface HabitatTribeSuggestion {
  habitatId: number;
  habitatName: string;
  habitatKind: string;
  currentTribeId: number | null;        // current PRIMARY tribe
  currentTribeName: string | null;
  currentTribeDefunct: boolean;
  primaryTribeId: number | null;        // AI-suggested primary
  primaryTribeName: string | null;
  alsoTribeIds: number[];               // AI-suggested secondary tribes
  alsoTribeNames: string[];
  confidence: number;       // 0..100
  reason: string;           // vi, ngắn
}

const SYSTEM_PROMPT = `Bạn là chiến lược gia phân khúc khán giả. Cho một danh sách TRIBE
(cụm khán giả theo bản sắc) và một danh sách HABITAT (community cụ thể:
subreddit, FB group, forum, Discord...). Một community LỚN thường chứa
NHIỀU tribe cùng lúc. Nhiệm vụ: với MỖI habitat, chọn các tribe phù hợp
(1 đến 3) từ danh sách ĐÃ CHO, sắp theo độ liên quan giảm dần — tribe
ĐẦU TIÊN là tribe TRỘI (primary), phần còn lại là phụ.

Quy tắc:
- CHỈ chọn tribe từ danh sách được cung cấp (dùng đúng "slug"). KHÔNG
  bịa tribe mới.
- Đa số habitat chỉ nên có 1-2 tribe. Chỉ thêm tribe thứ 3 khi community
  thực sự đa dạng rõ rệt. Đừng nhồi tribe không liên quan.
- Phần tử đầu của "tribeSlugs" = tribe trội (primary), bắt buộc có ≥1.
- Căn cứ: tên habitat, loại kênh, ngôn ngữ, chủ đề chính, mô tả/lexicon
  của từng tribe. Khớp theo ĐỘNG CƠ khán giả, không khớp theo nền tảng.
- reason: tiếng Việt CÓ DẤU, 1 câu ngắn vì sao khớp.
- confidence: 0..100 (độ chắc chắn cho tribe trội).

Trả về STRICT JSON (không markdown wrapper):
{
  "assignments": [
    { "habitatId": 123, "tribeSlugs": ["natal-chart-students","skeptic-curious"], "confidence": 80, "reason": "..." }
  ]
}
Mỗi habitat trong input phải xuất hiện đúng 1 lần trong output.`;

export interface SuggestHabitatTribesRequest {
  projectId: string;
  scope?: 'needs-fix' | 'all';
  extraInstruction?: string;
}

export async function suggestHabitatTribes(
  req: SuggestHabitatTribesRequest,
): Promise<{ ok: boolean; suggestions?: HabitatTribeSuggestion[]; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'Chưa cấu hình OPENAI_API_KEY.' };
  const openai = getOpenAI();
  if (!openai) return { ok: false, error: 'OpenAI client unavailable' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL chưa cấu hình.' };

  const projRows = await db.select().from(projects).where(eq(projects.id, req.projectId)).limit(1);
  const proj = projRows[0];
  if (!proj) return { ok: false, error: 'project không tồn tại' };
  if (proj.aiEnabled === false) return { ok: false, error: 'AI bị tắt cho project này.' };

  const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

  const allTribes = await db.select({
    id: tribes.id, slug: tribes.slug, name: tribes.name, lifecycle: tribes.lifecycle,
    descText: tribes.descText, psychographic: tribes.psychographic, lexicon: tribes.lexicon,
  }).from(tribes).where(and(eq(tribes.projectId, req.projectId), eq(tribes.tenantId, TENANT)));

  // Candidate tribes the AI may assign TO = non-defunct ones.
  const candidates = allTribes.filter((t) => t.lifecycle !== 'defunct');
  if (candidates.length === 0) {
    return { ok: false, error: 'Project chưa có tribe usable nào. Tạo tribe trước (✨ AI Tribes).' };
  }
  const tribeById = new Map(allTribes.map((t) => [t.id, t]));
  const tribeBySlug = new Map(candidates.map((t) => [t.slug, t]));

  const allHab = await db.select({
    id: habitats.id, name: habitats.name, kind: habitats.kind, tribeId: habitats.tribeId,
    language: habitats.language, communityType: habitats.communityType,
    dominantTopics: habitats.dominantTopics, url: habitats.url,
  }).from(habitats).where(and(eq(habitats.projectId, req.projectId), eq(habitats.tenantId, TENANT)));

  const scope = req.scope ?? 'needs-fix';
  const inScope = allHab.filter((h) => {
    if (scope === 'all') return true;
    if (h.tribeId == null) return true;
    const t = tribeById.get(h.tribeId);
    return !t || t.lifecycle === 'defunct';
  });
  if (inScope.length === 0) {
    return { ok: false, error: scope === 'needs-fix'
      ? 'Mọi habitat đã gắn tribe hợp lệ — không có gì cần sửa.'
      : 'Project chưa có habitat nào.' };
  }

  const userPrompt = [
    `DỰ ÁN: ${proj.name}${proj.oneLiner ? ` — ${proj.oneLiner}` : ''}`,
    '',
    'TRIBE CÓ THỂ GÁN (chỉ chọn trong số này, dùng slug):',
    ...candidates.map((t) =>
      `  - slug=${t.slug} | ${t.name}${t.descText ? ` — ${t.descText}` : ''}${t.psychographic ? ` [tâm lý: ${t.psychographic}]` : ''}${Array.isArray(t.lexicon) && t.lexicon.length ? ` [lexicon: ${(t.lexicon as string[]).slice(0, 8).join(', ')}]` : ''}`),
    '',
    `HABITAT CẦN GÁN (${inScope.length}):`,
    ...inScope.map((h) =>
      `  - habitatId=${h.id} | "${h.name}" [${h.kind}${h.language ? `, ${h.language}` : ''}${h.communityType ? `, ${h.communityType}` : ''}]${Array.isArray(h.dominantTopics) && h.dominantTopics.length ? ` topics: ${(h.dominantTopics as string[]).slice(0, 6).join(', ')}` : ''}${h.url ? ` (${h.url})` : ''}`),
    req.extraInstruction?.trim() ? '' : null,
    req.extraInstruction?.trim() ? `CHỈ DẪN THÊM (ƯU TIÊN CAO): ${req.extraInstruction.trim()}` : null,
    '',
    'Gán mỗi habitat vào 1 tribe slug. Sinh JSON ngay.',
  ].filter((x) => x != null).join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as { assignments?: Array<Record<string, unknown>> };
    const byHabitat = new Map<number, { slugs: string[]; confidence: number; reason: string }>();
    for (const a of Array.isArray(parsed.assignments) ? parsed.assignments : []) {
      const hid = Number(a.habitatId);
      if (!Number.isFinite(hid)) continue;
      // accept tribeSlugs[] (new) or tribeSlug (legacy single) defensively
      const rawSlugs = Array.isArray(a.tribeSlugs)
        ? a.tribeSlugs
        : (a.tribeSlug != null ? [a.tribeSlug] : []);
      const slugs = [...new Set(rawSlugs.map((s) => String(s).trim()).filter(Boolean))].slice(0, 3);
      let conf = Number(a.confidence);
      if (!Number.isFinite(conf)) conf = 0;
      conf = Math.max(0, Math.min(100, Math.round(conf)));
      byHabitat.set(hid, { slugs, confidence: conf, reason: String(a.reason ?? '').trim() });
    }

    const suggestions: HabitatTribeSuggestion[] = inScope.map((h) => {
      const cur = h.tribeId != null ? tribeById.get(h.tribeId) ?? null : null;
      const got = byHabitat.get(h.id);
      const resolved = (got?.slugs ?? [])
        .map((s) => tribeBySlug.get(s) ?? null)
        .filter((t): t is NonNullable<typeof t> => t != null);
      const primary = resolved[0] ?? null;
      const also = resolved.slice(1);
      return {
        habitatId: h.id,
        habitatName: h.name,
        habitatKind: h.kind,
        currentTribeId: h.tribeId,
        currentTribeName: cur ? cur.name : null,
        currentTribeDefunct: cur ? cur.lifecycle === 'defunct' : false,
        primaryTribeId: primary ? primary.id : null,
        primaryTribeName: primary ? primary.name : null,
        alsoTribeIds: also.map((t) => t.id),
        alsoTribeNames: also.map((t) => t.name),
        confidence: got ? got.confidence : 0,
        reason: got ? got.reason : '',
      };
    });
    return { ok: true, suggestions };
  } catch (e) {
    console.error('[habitat-tribe-suggest] failed:', e);
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}
