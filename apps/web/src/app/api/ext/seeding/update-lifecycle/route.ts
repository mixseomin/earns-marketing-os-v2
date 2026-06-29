import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { updateCardLifecycle } from '@/lib/actions/brief-posts';
import { VALID_LIFECYCLE_VALUES } from '@/lib/lifecycle';
import { errorResponse } from '@/lib/ext-route';

// POST /api/ext/seeding/update-lifecycle
// Body: { cardId, lifecycle, note? }
//   lifecycle: null | 'pending-approval' | 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement'
//
// User mark manual khi xem post Reddit thấy bị remove/ghost; cron auto-detect
// (Phase D) gọi với "anon fetch returned [removed]"; HOẶC ext bắt 'pending-approval'
// NGAY trên trang confirm sau submit (forum bắt chờ mod duyệt).

const VALID_LIFECYCLES = new Set<string | null>(VALID_LIFECYCLE_VALUES);   // 1 source: lib/lifecycle.ts

export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    cardId?: number;
    lifecycle?: string | null;
    note?: string | null;
  };

  const cardId = Number(body.cardId ?? 0);
  if (!cardId) return errorResponse('cardId required', 400);

  const lifecycle = body.lifecycle === undefined ? null : body.lifecycle;
  if (!VALID_LIFECYCLES.has(lifecycle as unknown as null)) {
    return errorResponse(`Invalid lifecycle '${lifecycle}'. Valid: ${[...VALID_LIFECYCLES].filter(Boolean).join(', ')}, or null.`, 400);
  }

  const res = await updateCardLifecycle(
    cardId,
    lifecycle as 'pending-approval' | 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement' | null,
    body.note ?? null,
  );
  if (!res.ok) {
    return errorResponse(res.error, 404);
  }
  return NextResponse.json({ ok: true, cardId, lifecycle });
}
