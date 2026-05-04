'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export async function createKnowledgeItem(data: {
  projectId: string;
  kind: string;
  title: string;
  content: string;
  tags: string[];
}) {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');

  await db.execute(sql`
    INSERT INTO knowledge_items (tenant_id, project_id, kind, title, content, tags)
    VALUES (
      ${TENANT},
      ${data.projectId},
      ${data.kind},
      ${data.title},
      ${data.content},
      ${JSON.stringify(data.tags)}::jsonb
    )
  `);

  revalidatePath(`/p/${data.projectId}/resources`);
}
