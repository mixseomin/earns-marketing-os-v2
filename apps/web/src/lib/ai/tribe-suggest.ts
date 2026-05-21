'use server';

// Generate AI-suggested audience TRIBES (layer-2 identity clusters) for a
// project, grounded in the project's OWN context: name / one-liner / bio,
// the concrete habitats already being targeted, and existing tribes (so
// suggestions don't duplicate). The operator reviews + edits + picks which
// to actually create — this action only PROPOSES.
//
// Tribe = WHO the audience is (motivation / identity), NOT the channel.
// "Reddit users" is a habitat-kind, not a tribe. "Natal-chart students"
// is a tribe.

import { getOpenAI, DEFAULT_MODEL, aiEnabled } from './openai';
import { getDb, projects, tribes, habitats } from '@mos2/db';
import { eq, and } from 'drizzle-orm';

export interface SuggestedTribe {
  name: string;          // short identity label, e.g. "Natal-chart students"
  slug: string;          // kebab, derived
  descText: string;      // 1-3 câu mô tả nhóm (vi)
  signal: string;        // vì sao nhóm này đáng theo đuổi cho dự án (vi)
  psychographic: string; // tâm lý / động cơ / nỗi đau (vi)
  sentiment: number;     // -100..100 thái độ nhóm với chủ đề/brand
  lexicon: string[];     // từ ngữ nhóm THỰC SỰ dùng (giữ ngôn ngữ gốc, đa số EN)
  avoid: string[];       // từ/định kiến khiến nhóm rời đi (ngôn ngữ gốc)
}

const SYSTEM_PROMPT = `Bạn là chiến lược gia phân khúc khán giả (audience segmentation) cho
một dự án content/marketing. Nhiệm vụ: từ context của CHÍNH dự án, đề xuất
các TRIBE — cụm khán giả theo BẢN SẮC / ĐỘNG CƠ (ai họ là, vì sao họ quan
tâm), KHÔNG phải theo loại kênh.

Quy tắc:
- TRIBE = identity (vd "Người học bản đồ sao", "Dân hoài nghi tò mò").
  KHÔNG dùng tên kênh làm tribe ("Reddit users", "Facebook" là SAI).
- Mỗi tribe phải KHÁC BIỆT rõ về động cơ — không chồng lấn nhau.
- Bám sát context dự án + danh sách community thật được cung cấp; suy ra
  những nhóm người đang ở trong các community đó.
- KHÔNG trùng với các tribe đã tồn tại (được liệt kê) — bổ sung nhóm MỚI.
- desc/signal/psychographic: tiếng Việt CÓ DẤU, ngắn gọn, cụ thể, không sáo.
- lexicon/avoid: giữ NGUYÊN NGỮ nhóm thật sự dùng (đa số tiếng Anh nếu
  community tiếng Anh) — đây là từ khoá để viết nội dung đúng giọng, KHÔNG
  dịch sang tiếng Việt.
- sentiment: -100..100, ước lượng thái độ nhóm với chủ đề/brand.

Trả về STRICT JSON (không markdown wrapper):
{
  "tribes": [
    {
      "name": "string ngắn (2-5 từ)",
      "descText": "1-3 câu (vi)",
      "signal": "vì sao đáng theo đuổi cho dự án này (vi)",
      "psychographic": "tâm lý/động cơ/nỗi đau (vi)",
      "sentiment": 0,
      "lexicon": ["term", "term"],
      "avoid": ["term", "term"]
    }
  ]
}`;

function toSlug(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'tribe';
}

export interface SuggestTribesRequest {
  projectId: string;
  count?: number;               // mong muốn (mặc định 8, clamp 3..12)
  extraInstruction?: string;    // chỉ dẫn thêm của operator (ưu tiên cao)
}

export async function suggestTribesForProject(
  req: SuggestTribesRequest,
): Promise<{ ok: boolean; tribes?: SuggestedTribe[]; error?: string }> {
  if (!aiEnabled()) return { ok: false, error: 'Chưa cấu hình OPENAI_API_KEY.' };
  const openai = getOpenAI();
  if (!openai) return { ok: false, error: 'OpenAI client unavailable' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL chưa cấu hình.' };

  const projRows = await db.select().from(projects).where(eq(projects.id, req.projectId)).limit(1);
  const proj = projRows[0];
  if (!proj) return { ok: false, error: 'project không tồn tại' };
  if (proj.aiEnabled === false) return { ok: false, error: 'AI bị tắt cho project này (ai_enabled=false).' };

  const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
  const existingTribes = await db.select({ name: tribes.name, lifecycle: tribes.lifecycle })
    .from(tribes).where(and(eq(tribes.projectId, req.projectId), eq(tribes.tenantId, TENANT)));
  const habRows = await db.select({ name: habitats.name, kind: habitats.kind, lang: habitats.language })
    .from(habitats).where(and(eq(habitats.projectId, req.projectId), eq(habitats.tenantId, TENANT)))
    .limit(40);

  const want = Math.min(12, Math.max(3, req.count ?? 8));

  const userPrompt = [
    `DỰ ÁN: ${proj.name}`,
    proj.oneLiner ? `ONE-LINER: ${proj.oneLiner}` : null,
    proj.bio ? `BIO: ${proj.bio}` : null,
    proj.kpi ? `KPI: ${proj.kpi}` : null,
    '',
    existingTribes.length
      ? `TRIBE ĐÃ CÓ (đừng trùng — bổ sung nhóm mới):\n${existingTribes.map((t) => `  - ${t.name}${t.lifecycle === 'defunct' ? ' (defunct)' : ''}`).join('\n')}`
      : 'TRIBE ĐÃ CÓ: (chưa có tribe nào)',
    '',
    habRows.length
      ? `COMMUNITY THẬT ĐANG NHẮM (suy ra audience từ đây):\n${habRows.map((h) => `  - ${h.name} [${h.kind}${h.lang ? `, ${h.lang}` : ''}]`).join('\n')}`
      : 'COMMUNITY THẬT: (chưa có habitat nào — suy từ context dự án)',
    '',
    `Đề xuất khoảng ${want} tribe khác biệt, phủ các động cơ chính của khán giả dự án này.`,
    req.extraInstruction?.trim() ? '' : null,
    req.extraInstruction?.trim() ? `CHỈ DẪN THÊM CỦA OPERATOR (ƯU TIÊN CAO — áp lên trên tất cả):` : null,
    req.extraInstruction?.trim() ? `  ${req.extraInstruction.trim()}` : null,
    '',
    'Sinh JSON ngay bây giờ.',
  ].filter(Boolean).join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text) as { tribes?: Array<Record<string, unknown>> };
    const raw = Array.isArray(parsed.tribes) ? parsed.tribes : [];
    const seen = new Set<string>();
    const out: SuggestedTribe[] = [];
    for (const o of raw) {
      const name = String(o.name ?? '').trim();
      if (!name) continue;
      const slug = toSlug(name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      const arr = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];
      let sentiment = Number(o.sentiment);
      if (!Number.isFinite(sentiment)) sentiment = 0;
      sentiment = Math.max(-100, Math.min(100, Math.round(sentiment)));
      out.push({
        name: name.slice(0, 80),
        slug,
        descText: String(o.descText ?? '').trim(),
        signal: String(o.signal ?? '').trim(),
        psychographic: String(o.psychographic ?? '').trim(),
        sentiment,
        lexicon: arr(o.lexicon),
        avoid: arr(o.avoid),
      });
    }
    if (out.length === 0) return { ok: false, error: 'AI không trả về tribe nào hợp lệ.' };
    return { ok: true, tribes: out };
  } catch (e) {
    console.error('[tribe-suggest] failed:', e);
    return { ok: false, error: (e as Error)?.message || String(e) };
  }
}
