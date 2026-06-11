import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { updateCardLifecycle } from '@/lib/actions/brief-posts';
import { VALID_LIFECYCLE_VALUES } from '@/lib/lifecycle';

// POST /api/ext/seeding/update-lifecycle
// Body: { cardId, lifecycle, note? }
//   lifecycle: null | 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement'
//
// User mark manual khi xem post Reddit thấy bị remove/ghost; hoặc cron
// auto-detect (Phase D) gọi với context "anon fetch returned [removed]".

const VALID_LIFECYCLES = new Set<string | null>(VALID_LIFECYCLE_VALUES);   // 1 source: lib/lifecycle.ts

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as {
    cardId?: number;
    lifecycle?: string | null;
    note?: string | null;
  };

  const cardId = Number(body.cardId ?? 0);
  if (!cardId) return NextResponse.json({ ok: false, error: 'cardId required' }, { status: 400 });

  const lifecycle = body.lifecycle === undefined ? null : body.lifecycle;
  if (!VALID_LIFECYCLES.has(lifecycle as unknown as null)) {
    return NextResponse.json({
      ok: false,
      error: `Invalid lifecycle '${lifecycle}'. Valid: ${[...VALID_LIFECYCLES].filter(Boolean).join(', ')}, or null.`,
    }, { status: 400 });
  }

  const res = await updateCardLifecycle(
    cardId,
    lifecycle as 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement' | null,
    body.note ?? null,
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true, cardId, lifecycle });
}
