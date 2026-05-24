'use server';

// CRUD cho LLM-discovered selectors (lưu trong knowledge_items).
// Endpoint /api/ext/learn-selectors là entry point cho ext; action này
// là entry point cho MOS2 UI (HabitatSelectorsSection component).

import { getDb, knowledgeItems } from '@mos2/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export interface SelectorSpec {
  css: string;
  attr?: string;
  parse?: 'number' | 'date' | 'number-suffix' | 'enum';
  enum_values?: string[];
  notes?: string;
}

export type SelectorMap = Record<string, SelectorSpec>;

const SELECTOR_KEY = (platform: string, pageKind: string) =>
  `ext-habitat-selectors-${platform}-${pageKind}`;

export async function fetchHabitatSelectors(
  platformKey: string, pageKind: string,
): Promise<{ selectors: SelectorMap | null; updatedAt: string | null }> {
  const db = getDb();
  if (!db) return { selectors: null, updatedAt: null };
  const title = SELECTOR_KEY(platformKey, pageKind);
  const [row] = await db
    .select({ content: knowledgeItems.content, updatedAt: knowledgeItems.updatedAt })
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.title, title), eq(knowledgeItems.kind, 'template')))
    .limit(1);
  if (!row) return { selectors: null, updatedAt: null };
  let selectors: SelectorMap | null = null;
  try { selectors = JSON.parse(row.content); } catch { selectors = null; }
  return {
    selectors,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export async function saveHabitatSelectors(
  platformKey: string, pageKind: string, selectors: SelectorMap,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const title = SELECTOR_KEY(platformKey, pageKind);
  const content = JSON.stringify(selectors, null, 2);
  try {
    const [existing] = await db
      .select({ id: knowledgeItems.id })
      .from(knowledgeItems)
      .where(and(eq(knowledgeItems.title, title), eq(knowledgeItems.kind, 'template')))
      .limit(1);
    if (existing) {
      await db.update(knowledgeItems)
        .set({ content, updatedAt: new Date() })
        .where(eq(knowledgeItems.id, existing.id));
    } else {
      await db.insert(knowledgeItems).values({
        kind: 'template',
        title,
        content,
        tags: ['ext', 'habitat-selectors', platformKey, pageKind],
      });
    }
    revalidatePath('/platforms');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
