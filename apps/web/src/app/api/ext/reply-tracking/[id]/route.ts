import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, contentPieces } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { addPublication } from '@/lib/actions/publications';

export const dynamic = 'force-dynamic';

// PATCH /api/ext/reply-tracking/[id]
// Body: { publishUrl?, bodyMd?, status? }
// Updates the draft reply piece. When status='published' AND publishUrl set,
// also inserts into the `publications` table so the URL is auto-tracked
// (cron checks engagement metrics) and visible on /p/[id]/publications.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const { id } = await params;
  const pieceId = Number(id);
  const body = await req.json() as {
    publishUrl?: string;
    bodyMd?: string;
    status?: 'draft' | 'published' | 'archived';
  };

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.publishUrl !== undefined) set.publishUrl = body.publishUrl;
  if (body.bodyMd !== undefined) set.bodyMd = body.bodyMd;
  const publishedNow = body.status === 'published';
  if (body.status !== undefined) {
    set.status = body.status;
    if (publishedNow) set.publishedAt = new Date();
  }

  await db.update(contentPieces).set(set).where(eq(contentPieces.id, pieceId));

  // When marking posted with a URL, also create a Publication record for tracking
  let publicationId: number | null = null;
  if (publishedNow && body.publishUrl) {
    const [piece] = await db
      .select({
        projectId: contentPieces.projectId,
        title: contentPieces.title,
        tags: contentPieces.tags,
        aiNotes: contentPieces.aiNotes,
      })
      .from(contentPieces)
      .where(eq(contentPieces.id, pieceId))
      .limit(1);

    if (piece) {
      // Pull platform key from tags (saved as 'platform:KEY')
      const tags = (piece.tags as string[]) ?? [];
      const platformTag = tags.find((t) => t.startsWith('platform:'));
      const platformKey = platformTag ? platformTag.slice('platform:'.length) : undefined;

      const res = await addPublication({
        projectId: piece.projectId,
        url: body.publishUrl,
        platformKey,
        title: piece.title,
        publishedAt: new Date().toISOString(),
      });
      if (res.ok) publicationId = res.id ?? null;
    }
  }

  return NextResponse.json({ ok: true, publicationId });
}
