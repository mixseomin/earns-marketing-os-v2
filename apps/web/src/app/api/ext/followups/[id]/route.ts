import { checkAuth } from '../../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { updateFollowup, deleteFollowup } from '@/lib/actions/followups';

export const dynamic = 'force-dynamic';

// POST /api/ext/followups/[id]  { status?, due?, note?, title? } — any subset (logic in lib/actions/followups).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const id = Number((await params).id);
  const b = (await req.json().catch(() => ({}))) as { status?: string; due?: string; note?: string; title?: string };
  const r = await updateFollowup(id, b);
  if (!r.ok) return errorResponse(r.error, r.error === 'not a follow-up' ? 404 : 400);
  return okResponse({ id });
}

// DELETE /api/ext/followups/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const id = Number((await params).id);
  const r = await deleteFollowup(id);
  if (!r.ok) return errorResponse(r.error, 404);
  return okResponse({ id, deleted: true });
}
