'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, desc, gte, sql } from 'drizzle-orm';
import { getDb, aiSuggestions, projects, cards } from '@mos2/db';
import { generateSuggestions as runOpenAI, hashContext, type SuggestionContext, type AISuggestion } from '@/lib/ai/suggestions';
import { aiEnabled } from '@/lib/ai/openai';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DAILY_BUDGET_USD = Number(process.env.OPENAI_DAILY_BUDGET_USD ?? '5');
// gpt-4o-mini blended rate ~$0.30/1M tokens (input $0.15, output $0.60).
// Hơi overestimate cho budget cap an toàn.
const COST_PER_1K_TOKENS = 0.0003;

function estimateCostUsd(tokens: number): number {
  return (tokens / 1000) * COST_PER_1K_TOKENS;
}

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

// Per-project AI toggle.
export async function setProjectAIEnabled(projectId: string, enabled: boolean): Promise<{ ok: boolean }> {
  const db = ensureDb();
  await db.update(projects).set({ aiEnabled: enabled, updatedAt: new Date() }).where(eq(projects.id, projectId));
  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/settings`);
  revalidatePath('/ai-log');
  return { ok: true };
}

// Daily token usage (sum tokens_used today across all projects).
export async function getDailyTokenUsage(): Promise<{ tokens: number; cost: number; calls: number; budgetUsd: number; budgetUsedPct: number }> {
  const db = ensureDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${aiSuggestions.tokensUsed}), 0)::int`,
      calls: sql<number>`COUNT(*)::int`,
    })
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.tenantId, TENANT), gte(aiSuggestions.generatedAt, today)));
  const total = rows[0]?.total ?? 0;
  const calls = rows[0]?.calls ?? 0;
  const cost = estimateCostUsd(total);
  return {
    tokens: total, cost, calls,
    budgetUsd: DAILY_BUDGET_USD,
    budgetUsedPct: DAILY_BUDGET_USD > 0 ? Math.min(100, (cost / DAILY_BUDGET_USD) * 100) : 0,
  };
}

// AI activity log — last N suggestions across all projects.
export interface AILogEntry {
  id: number;
  projectId: string;
  projectName: string;
  generatedAt: string;
  model: string;
  tokens: number;
  cost: number;
  promptHash: string | null;
  suggestionsCount: number;
  suggestions: AISuggestion[];
  inputContext: Record<string, unknown>;
}

export async function listAILog(limit = 100): Promise<AILogEntry[]> {
  const db = ensureDb();
  const rows = await db
    .select({
      id: aiSuggestions.id,
      projectId: aiSuggestions.projectId,
      projectName: projects.name,
      generatedAt: aiSuggestions.generatedAt,
      model: aiSuggestions.model,
      tokens: aiSuggestions.tokensUsed,
      promptHash: aiSuggestions.promptHash,
      suggestions: aiSuggestions.suggestions,
      inputContext: aiSuggestions.inputContext,
    })
    .from(aiSuggestions)
    .leftJoin(projects, eq(aiSuggestions.projectId, projects.id))
    .where(eq(aiSuggestions.tenantId, TENANT))
    .orderBy(desc(aiSuggestions.generatedAt))
    .limit(limit);
  return rows.map((r) => {
    const suggArr = Array.isArray(r.suggestions) ? (r.suggestions as AISuggestion[]) : [];
    return {
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName ?? r.projectId,
      generatedAt: r.generatedAt.toISOString(),
      model: r.model,
      tokens: r.tokens,
      cost: estimateCostUsd(r.tokens),
      promptHash: r.promptHash,
      suggestionsCount: suggArr.length,
      suggestions: suggArr,
      inputContext: (r.inputContext as Record<string, unknown>) ?? {},
    };
  });
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

  // ── Control B: per-project AI toggle ──
  const proj = await db.select({ aiEnabled: projects.aiEnabled }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (proj.length > 0 && proj[0]!.aiEnabled === false) {
    return {
      ok: false, suggestions: [], generatedAt: null, model: '',
      fromCache: false, error: 'AI tắt cho project này (Settings → AI panel)',
    };
  }

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

  // ── Control C: daily budget cap ──
  const usage = await getDailyTokenUsage();
  if (usage.cost >= DAILY_BUDGET_USD) {
    if (latest.length > 0) {
      const row = latest[0]!;
      return {
        ok: true,
        suggestions: row.suggestions as AISuggestion[],
        generatedAt: row.generatedAt.toISOString(),
        model: row.model,
        fromCache: true,
        error: `Daily budget $${DAILY_BUDGET_USD} đã hết ($${usage.cost.toFixed(4)} dùng) — hiện stale cache.`,
      };
    }
    return {
      ok: false, suggestions: [], generatedAt: null, model: '', fromCache: false,
      error: `Daily budget $${DAILY_BUDGET_USD} đã hết ($${usage.cost.toFixed(4)} dùng). Nâng OPENAI_DAILY_BUDGET_USD env.`,
    };
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
