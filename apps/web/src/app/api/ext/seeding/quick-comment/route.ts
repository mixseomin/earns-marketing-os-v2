import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';
import { composeCommentCard, type ComposeCommentInput } from '@/lib/actions/quick-comment';

// POST /api/ext/seeding/quick-comment — người đang mở một thread, bấm "soạn comment".
// Logic thật nằm ở lib/actions/quick-comment (dùng chung với /api/ext/plan/run, nơi máy TỰ chọn
// thread theo kế hoạch đã lên lịch). Route này chỉ còn auth + parse.
export async function POST(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const body = await req.json().catch(() => ({})) as ComposeCommentInput;
  const res = await composeCommentCard(body);
  if (!res.ok) return errorResponse(res.error, res.status);
  return NextResponse.json(res);
}
