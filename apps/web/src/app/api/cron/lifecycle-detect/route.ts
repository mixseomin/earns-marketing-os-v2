// POST /api/cron/lifecycle-detect — auto-detect lifecycle của comment Reddit
// đã đăng. Cron 24h/lần, check cards có:
//   - post_url IS NOT NULL (đã post)
//   - archived_at IS NULL
//   - posted_at > NOW - 30 days (chỉ check posts gần đây)
//   - post_lifecycle IS NULL OR post_lifecycle_at < NOW - 24h (chưa check / stale)
//
// Detect logic via Reddit JSON API (anon, no cookie, no auth):
//   GET https://www.reddit.com/comments/by-id/t1_<id>.json?raw_json=1
//   → 404 = post_url invalid / deleted hard
//   → 200 + body == '[removed]' → removed-by-mod
//   → 200 + body == '[deleted]' → self-deleted
//   → 200 + author == '[deleted]' → ambiguous, fallback self-deleted
//   → 200 + score = 0 + replies = 0 + age > 48h → low-engagement
//   → 200 + score >= 1 OR replies >= 1 → live
//
// Reddit anon endpoint: chỉ trả comment nếu visible cho public (gồm anon
// viewer). Nếu user comment bị Reddit shadow-ban → comment vẫn tồn tại với
// chính tài khoản đó nhưng anon fetch trả 404 hoặc data rỗng → ghosted.
//
// Auth: header x-cron-secret match MOS2_CRON_SECRET.

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { updateCardLifecycle } from '@/lib/actions/brief-posts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BATCH_LIMIT = 50;          // tránh chạy quá lâu / hit Reddit rate limit
const REDDIT_USER_AGENT = 'MOS2-lifecycle-cron/1.0 (htuan82@gmail.com)';

interface DetectResult {
  cardId: number;
  thingId: string;
  lifecycle: 'live' | 'ghosted' | 'removed-by-mod' | 'self-deleted' | 'low-engagement' | null;
  reason: string;
}

function parseRedditThingId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.host.includes('reddit.com')) return null;
    const m = u.pathname.match(/\/comments\/[^/]+\/[^/]*\/([a-z0-9]+)\/?$/i);
    return m ? m[1] : null;
  } catch { return null; }
}

async function detectOne(card: { id: number; post_url: string; posted_at: Date | string }): Promise<DetectResult> {
  const thingId = parseRedditThingId(card.post_url);
  if (!thingId) {
    return { cardId: card.id, thingId: '', lifecycle: null, reason: 'not-reddit-or-no-thingid' };
  }
  try {
    const res = await fetch(`https://www.reddit.com/comments/by-id/t1_${thingId}.json?raw_json=1`, {
      headers: { 'Accept': 'application/json', 'User-Agent': REDDIT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      // Anon không thấy comment → ghosted (hoặc deleted hard, không phân biệt được)
      return { cardId: card.id, thingId, lifecycle: 'ghosted', reason: 'reddit-anon-404' };
    }
    if (!res.ok) {
      return { cardId: card.id, thingId, lifecycle: null, reason: `reddit-${res.status}` };
    }
    const json = await res.json();
    const d = json?.[0]?.data?.children?.[0]?.data;
    if (!d) {
      return { cardId: card.id, thingId, lifecycle: 'ghosted', reason: 'reddit-empty-data' };
    }
    const body = String(d.body ?? '').trim();
    const author = String(d.author ?? '').trim();
    if (body === '[removed]') {
      return { cardId: card.id, thingId, lifecycle: 'removed-by-mod', reason: 'body=[removed]' };
    }
    if (body === '[deleted]' || author === '[deleted]') {
      return { cardId: card.id, thingId, lifecycle: 'self-deleted', reason: 'body/author=[deleted]' };
    }
    const score = Number(d.score ?? 0);
    const replies = (d.replies && d.replies !== '' && d.replies.data?.children?.length) || 0;
    const ageMs = Date.now() - new Date(card.posted_at).getTime();
    const ageH = ageMs / (1000 * 60 * 60);
    if (score === 0 && replies === 0 && ageH > 48) {
      return { cardId: card.id, thingId, lifecycle: 'low-engagement', reason: `score=0 replies=0 age=${ageH.toFixed(1)}h` };
    }
    return { cardId: card.id, thingId, lifecycle: 'live', reason: `score=${score} replies=${replies}` };
  } catch (e) {
    return { cardId: card.id, thingId, lifecycle: null, reason: `fetch-error: ${(e as Error).message}` };
  }
}

export async function POST(req: Request) {
  const expected = process.env.MOS2_CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, error: 'MOS2_CRON_SECRET chưa set' }, { status: 503 });
  const supplied = req.headers.get('x-cron-secret');
  if (supplied !== expected) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db unavailable' }, { status: 503 });

  // Pick batch: posted_at > NOW - 30d (mới đủ relevance), post_lifecycle stale
  // (NULL hoặc fetched > 24h ago).
  const rows = await db.execute(sql`
    SELECT id, post_url, posted_at
      FROM cards
     WHERE post_url IS NOT NULL
       AND post_url LIKE '%reddit.com%'
       AND archived_at IS NULL
       AND posted_at IS NOT NULL
       AND posted_at > NOW() - INTERVAL '30 days'
       AND (
         post_lifecycle_at IS NULL
         OR post_lifecycle_at < NOW() - INTERVAL '24 hours'
       )
     ORDER BY post_lifecycle_at NULLS FIRST, posted_at DESC
     LIMIT ${BATCH_LIMIT}
  `);
  const candidates = rows as unknown as Array<{ id: number; post_url: string; posted_at: Date }>;

  const results: DetectResult[] = [];
  // Serial — Reddit rate limit anon ~60 req/min. 50 batch × ~500ms = ~25s.
  for (const c of candidates) {
    const r = await detectOne(c);
    results.push(r);
    if (r.lifecycle !== null) {
      await updateCardLifecycle(c.id, r.lifecycle, `auto-detect: ${r.reason}`);
    }
    // Throttle 500ms giữa requests để né rate limit
    await new Promise((res) => setTimeout(res, 500));
  }

  // Aggregate counts cho response
  const counts = {
    total: results.length,
    live: results.filter((r) => r.lifecycle === 'live').length,
    ghosted: results.filter((r) => r.lifecycle === 'ghosted').length,
    removedByMod: results.filter((r) => r.lifecycle === 'removed-by-mod').length,
    selfDeleted: results.filter((r) => r.lifecycle === 'self-deleted').length,
    lowEngagement: results.filter((r) => r.lifecycle === 'low-engagement').length,
    skipped: results.filter((r) => r.lifecycle === null).length,
  };

  return NextResponse.json({ ok: true, counts, results });
}
