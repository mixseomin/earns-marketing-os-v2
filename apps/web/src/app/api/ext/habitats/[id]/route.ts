import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, habitats, platforms } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// PATCH /api/ext/habitats/[id] { platform_key?, kind?, isOwn? }
// Đổi platform map cho habitat đã tồn tại (Req#1 — habitat đã map muốn chọn
// platform khác). Ensure platform tồn tại trước (FK), create nếu mới.
// isOwn = đánh dấu "site của tôi" → tắt tracking (scene/WHO-THEM/scanner).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = checkAuth(req);
  if (err) return err;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { platform_key?: string; kind?: string; isOwn?: boolean };

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.platform_key) {
    const pk = body.platform_key.trim();
    // Ensure platform tồn tại (FK habitats_platform_key_fkey).
    const exists = await db.select({ key: platforms.key }).from(platforms).where(eq(platforms.key, pk)).limit(1);
    if (exists.length === 0) {
      await db.insert(platforms).values({
        key: pk,
        label: pk,
        signupUrl: '',
        priority: 'medium',
      }).onConflictDoNothing();
    }
    patch.platformKey = pk;
  }
  if (body.kind) patch.kind = body.kind.trim();
  if (typeof body.isOwn === 'boolean') patch.isOwn = body.isOwn;

  if (Object.keys(patch).length <= 1) {
    return errorResponse('nothing to update', 400);
  }

  await db.update(habitats).set(patch).where(eq(habitats.id, Number(id)));
  return NextResponse.json({ ok: true });
}
