import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { reconcileMyPosts } from '@/lib/actions/seeding';
import { errorResponse } from '@/lib/ext-route';

// POST /api/ext/seeding/reconcile-mypost
// Body: { posts: [{ permalink, body }] }
//
// Ext quét trang "my posts" (phpBB egosearch: search.php?search_id=egosearch) → gửi mọi
// row {permalink, full body} lên. Server match theo BODY với card chưa-track / 'pending-approval'
// → mark-posted (tự clear pending → live). Trả matched để ext badge từng row "✅ tracked #id".
// Idempotent: chỉ chạm card chưa có post_url (hoặc pending) → quét lại nhiều lần an toàn.

export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({})) as { posts?: Array<{ permalink?: string; body?: string }> };
  const posts = (body.posts ?? [])
    .map((p) => ({ permalink: String(p?.permalink ?? ''), body: String(p?.body ?? '') }))
    .filter((p) => p.permalink && p.body)
    .slice(0, 200);
  if (!posts.length) return NextResponse.json({ ok: true, matched: [], scanned: 0 });

  try {
    const res = await reconcileMyPosts(posts);
    return NextResponse.json(res);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'reconcile failed', 500);
  }
}
