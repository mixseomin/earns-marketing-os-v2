// Generate AI suggestions for a project's Dashboard.
// Input: project context (name, mode, brand, recent cards summary).
// Output: 4-5 actionable suggestions ranked by impact.
//
// Schema: each suggestion = { icon, title, meta, agent }
//   icon: '↗' (scale up), '✦' (test), '✕' (kill/pause), '⟲' (rotate/retry), '!' (urgent)
//   title: short imperative ("Tăng budget bài X", "Pause 3 creative ngách Y")
//   meta: 1-line metric/reason ("ROAS 4.2 stable 3 ngày • CR 2.8%")
//   agent: agent ref ('AI', 'RES-01', 'human')

import type { Project } from '@/lib/mock/types';
import { getOpenAI, DEFAULT_MODEL } from './openai';

export interface AISuggestion {
  icon: string;
  title: string;
  meta: string;
  agent: string;
}

export interface SuggestionContext {
  project: Project;
  cardsSummary: { col: string; count: number }[]; // cards grouped by column
  recentCardTitles: string[];                       // last 10 card titles
  habitatCount: number;
  contactCount: number;
}

const SYSTEM_PROMPT = `Bạn là AI ops co-pilot cho 1 marketing operations system.
Nhiệm vụ: nhìn project context → đề xuất 4-5 hành động actionable, ranked theo impact.

OUTPUT FORMAT (strict JSON, không markdown wrapper):
{
  "suggestions": [
    { "icon": "↗" | "✦" | "✕" | "⟲" | "!", "title": "...", "meta": "...", "agent": "AI" | "RES-01" | "CON-09" | "human" | "..." }
  ]
}

ICON SEMANTICS:
- ↗ = scale up / tăng spend / accelerate
- ✦ = test mới / experiment / opportunity
- ✕ = kill / pause / stop bleed
- ⟲ = rotate / retry / replace
- ! = urgent / risk / needs human

CONSTRAINTS:
- title NGẮN GỌN (≤ 60 chars), tiếng Việt khi context VN, tiếng Anh khi project english
- meta = 1 dòng metric hoặc lý do cụ thể (≤ 80 chars)
- agent = AI cho automation, RES-XX/CON-XX/ANA-XX/OPS-XX cho specific squad, human khi cần phán đoán
- Đa dạng icon (đừng all ↗). Mix scale + test + kill nếu có data
- Suggestions PHẢI cụ thể với project context — không chung chung`;

function buildUserPrompt(ctx: SuggestionContext): string {
  const { project, cardsSummary, recentCardTitles, habitatCount, contactCount } = ctx;
  const totalCards = cardsSummary.reduce((s, c) => s + c.count, 0);
  return `PROJECT: ${project.name} (${project.id})
MODE: ${project.mode}
ONE-LINER: ${project.oneLiner ?? '—'}
PERSONA: ${project.persona ?? '—'}
BIO: ${project.bio ?? '—'}
HASHTAGS: ${project.hashtags ?? '—'}
WEBSITE: ${project.website ?? '—'}
KPI HIỆN TẠI: ${project.kpi}
REVENUE: ${project.revenue}
HEALTH: ${project.health}/100
BUDGET: ${project.budget}tr/ngày

CARDS (${totalCards} total):
${cardsSummary.map((c) => `- ${c.col}: ${c.count}`).join('\n') || '- chưa có cards'}

RECENT CARD TITLES (mới nhất):
${recentCardTitles.slice(0, 10).map((t) => `- ${t}`).join('\n') || '- chưa có'}

OTHER:
- habitats: ${habitatCount}
- contacts: ${contactCount}

Hãy đề xuất 4-5 hành động cho user TODAY, dựa trên context trên.`;
}

export async function generateSuggestions(ctx: SuggestionContext): Promise<{
  suggestions: AISuggestion[];
  tokensUsed: number;
  model: string;
} | null> {
  const ai = getOpenAI();
  if (!ai) return null;

  const userPrompt = buildUserPrompt(ctx);

  const completion = await ai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 800,
  });

  const text = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { suggestions?: AISuggestion[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { suggestions: [] };
  }

  return {
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 6) : [],
    tokensUsed: completion.usage?.total_tokens ?? 0,
    model: DEFAULT_MODEL,
  };
}

export function hashContext(ctx: SuggestionContext): string {
  // Cheap hash — same context = same key. Used to skip regen on identical inputs.
  const s = JSON.stringify({
    p: ctx.project.id, m: ctx.project.mode, k: ctx.project.kpi,
    r: ctx.project.revenue, h: ctx.project.health,
    cs: ctx.cardsSummary, rc: ctx.recentCardTitles.slice(0, 5),
  });
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return hash.toString(36);
}
