'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// projectId null = shared template (catalog / "knowledge chung"); a slug = project-own item.
export async function createKnowledgeItem(data: {
  projectId: string | null;
  kind: string;
  title: string;
  content: string;
  tags: string[];
}) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    INSERT INTO knowledge_items (tenant_id, project_id, kind, title, content, tags)
    VALUES (${TENANT}, ${data.projectId}, ${data.kind}, ${data.title}, ${data.content}, ${JSON.stringify(data.tags)}::jsonb)
  `);
  if (data.projectId) revalidatePath(`/p/${data.projectId}/resources`);
  revalidatePath('/knowledge');
}

export async function updateKnowledgeItem(id: number, data: {
  kind: string; title: string; content: string; tags: string[];
}) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE knowledge_items
    SET kind = ${data.kind}, title = ${data.title}, content = ${data.content},
        tags = ${JSON.stringify(data.tags)}::jsonb, updated_at = now()
    WHERE id = ${id} AND tenant_id = ${TENANT}
  `);
  revalidatePath('/knowledge');
}

export async function deleteKnowledgeItem(id: number) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`DELETE FROM knowledge_items WHERE id = ${id} AND tenant_id = ${TENANT}`);
  revalidatePath('/knowledge');
}

// Reference a shared template into a project (pointer, not copy). overrides = per-project {{var}} values.
// Merge with || so the refs key is created/updated (mirrors setBacklinkSite's site_status merge).
export async function referenceKnowledge(projectId: string, itemId: number, overrides: Record<string, string> = {}) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE knowledge_items
    SET refs = COALESCE(refs, '{}'::jsonb) || jsonb_build_object(${projectId}::text, ${JSON.stringify(overrides)}::jsonb),
        updated_at = now()
    WHERE id = ${itemId} AND tenant_id = ${TENANT} AND project_id IS NULL
  `);
  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath('/knowledge');
}

export async function unreferenceKnowledge(projectId: string, itemId: number) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE knowledge_items SET refs = refs - ${projectId}::text, updated_at = now()
    WHERE id = ${itemId} AND tenant_id = ${TENANT} AND project_id IS NULL
  `);
  revalidatePath(`/p/${projectId}/resources`);
  revalidatePath('/knowledge');
}
