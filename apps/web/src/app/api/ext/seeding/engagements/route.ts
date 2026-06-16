import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';
import { listEngagementsByParentUrl } from '@/lib/actions/brief-posts';

// GET /api/ext/seeding/engagements?projectId=X&parentUrl=https://...
// Trả mọi attempts cross-brief/account cho 1 parent_url. Dùng cho ext side
// panel re-visit detect + brief modal Threads section (qua server action
// trực tiếp, không qua endpoint).

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const projectId = (url.searchParams.get('projectId') ?? '').trim();
  const parentUrl = (url.searchParams.get('parentUrl') ?? '').trim();
  if (!projectId || !parentUrl) {
    return errorResponse('projectId + parentUrl required', 400);
  }
  const summary = await listEngagementsByParentUrl(projectId, parentUrl);
  if (!summary) {
    return NextResponse.json({ ok: true, summary: null, count: 0 });
  }
  return NextResponse.json({ ok: true, summary, count: summary.totalAttempts });
}
