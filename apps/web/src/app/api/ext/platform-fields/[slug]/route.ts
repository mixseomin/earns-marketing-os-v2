import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, knowledgeItems } from '@mos2/db';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const fieldTitle = (slug: string, type: string) =>
  type === 'selectors' ? `ext-selectors-${slug}` : `ext-regkit-${slug}`;

// GET /api/ext/platform-fields/[slug]?type=selectors|fields
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ content: null });

  const { slug } = await params;
  const type = new URL(req.url).searchParams.get('type') ?? 'fields';
  const title = fieldTitle(slug, type);

  const [row] = await db
    .select({ id: knowledgeItems.id, content: knowledgeItems.content })
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.title, title), eq(knowledgeItems.kind, 'template')))
    .limit(1);

  return NextResponse.json({ content: row?.content ?? null });
}

// POST /api/ext/platform-fields/[slug] — upsert
// Body: { content: string, type?: 'selectors'|'fields' }
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const { slug } = await params;
  const body = await req.json() as { content: string; type?: string };
  const type = body.type ?? 'fields';
  const title = fieldTitle(slug, type);

  const [existing] = await db
    .select({ id: knowledgeItems.id })
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.title, title), eq(knowledgeItems.kind, 'template')))
    .limit(1);

  if (existing) {
    await db
      .update(knowledgeItems)
      .set({ content: body.content, updatedAt: new Date() })
      .where(eq(knowledgeItems.id, existing.id));
  } else {
    await db.insert(knowledgeItems).values({
      kind: 'template',
      title,
      content: body.content,
      tags: ['ext', 'regkit', slug],
    });
  }

  return NextResponse.json({ ok: true });
}
