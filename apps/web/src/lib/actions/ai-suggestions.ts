'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, desc } from 'drizzle-orm';
import { getDb, aiSuggestions, projects, cards } from '@mos2/db';
import { generateSuggestions as runOpenAI, hashContext, type SuggestionContext, type AISuggestion } from '@/lib/ai/suggestions';
import { aiEnabled } from '@/lib/ai/openai';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface SuggestionsResult {
  ok: boolean;
  suggestions: AISuggestion[];
  generatedAt: string | null;
  model: string;
  fromCache: boolean;
  tokensUsed?: number;
  error?: string;
}

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured.');
  return db;
}

async function buildContext(projectId: string): Promise<SuggestionContext | null> {
  const db = ensureDb();

  const proj = await db.select().from(projects).where(and(eq(projects.tenantId, TENANT), eq(projects.id, projectId))).limit(1);
  if (proj.length === 0) return null;
  const p = proj[0]!;

  const projectCards = await db.select().from(cards).where(and(eq(cards.tenantId, TENANT), eq(cards.projectId, projectId)));
  const cardsByCol = new Map<string, number>();
  for (const c of projectCards) cardsByCol.set(c.col, (cardsByCol.get(c.col) ?? 0) + 1);

  const recent = projectCards
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, 10)
    .map((c) => c.title);

  return {
    project: {
      id: p.id, name: p.name, emoji: p.emoji, mode: p.modeId,
      agents: { core: p.agentsCore, shared: p.agentsShared },
      budget: p.budget, health: p.health, revenue: p.revenue, kpi: p.kpi,
      alerts: p.alerts, color: p.color, isDemo: p.isDemo,
      website: p.website, oneLiner: p.oneLiner, bio: p.bio,
      persona: p.persona, hashtags: p.hashtags,
    },
    cardsSummary: Array.from(cardsByCol.entries()).map(([col, count]) => ({ col, count })),
    recentCardTitles: recent,
    habitatCount: 0,  // TODO: pass real counts when cheap
    contactCount: 0,
  };
}

export async function getOrGenerateSuggestions(
  projectId: string,
  options?: { force?: boolean },
): Promise<SuggestionsResult> {
  if (!aiEnabled()) {
    return {
      ok: false, suggestions: [], generatedAt: null, model: '',
      fromCache: false, error: 'OPENAI_API_KEY not set',
    };
  }
  const force = options?.force === true;
  const db = ensureDb();

  // Check cache: latest row for this project < 1h old, same hash
  const latest = await db.select().from(aiSuggestions)
    .where(and(eq(aiSuggestions.tenantId, TENANT), eq(aiSuggestions.projectId, projectId)))
    .orderBy(desc(aiSuggestions.generatedAt))
    .limit(1);

  const ctx = await buildContext(projectId);
  if (!ctx) return { ok: false, suggestions: [], generatedAt: null, model: '', fromCache: false, error: 'project not found' };

  const ctxHash = hashContext(ctx);

  if (!force && latest.length > 0) {
    const row = latest[0]!;
    const ageMs = Date.now() - row.generatedAt.getTime();
    if (ageMs < CACHE_TTL_MS && row.promptHash === ctxHash) {
      return {
        ok: true,
        suggestions: row.suggestions as AISuggestion[],
        generatedAt: row.generatedAt.toISOString(),
        model: row.model,
        fromCache: true,
      };
    }
  }

  // Cache miss / forced — call OpenAI
  try {
    const result = await runOpenAI(ctx);
    if (!result) {
      return { ok: false, suggestions: [], generatedAt: null, model: '', fromCache: false, error: 'OpenAI client unavailable' };
    }

    const [inserted] = await db.insert(aiSuggestions).values({
      tenantId: TENANT,
      projectId,
      generatedAt: new Date(),
      model: result.model,
      suggestions: result.suggestions,
      promptHash: ctxHash,
      inputContext: { cardsSummary: ctx.cardsSummary, recent: ctx.recentCardTitles.length },
      tokensUsed: result.tokensUsed,
    }).returning({ generatedAt: aiSuggestions.generatedAt });

    revalidatePath(`/p/${projectId}`);

    return {
      ok: true,
      suggestions: result.suggestions,
      generatedAt: inserted!.generatedAt.toISOString(),
      model: result.model,
      fromCache: false,
      tokensUsed: result.tokensUsed,
    };
  } catch (e) {
    console.error('[ai-suggestions] OpenAI call failed:', e);
    // Fallback to last cached if any
    if (latest.length > 0) {
      const row = latest[0]!;
      return {
        ok: true,
        suggestions: row.suggestions as AISuggestion[],
        generatedAt: row.generatedAt.toISOString(),
        model: row.model,
        fromCache: true,
        error: `Generation failed, showing stale cache: ${(e as Error).message}`,
      };
    }
    return { ok: false, suggestions: [], generatedAt: null, model: '', fromCache: false, error: (e as Error).message };
  }
}
