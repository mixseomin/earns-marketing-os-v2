import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { listContentPillars } from '@/lib/actions/content-pillars';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// Content pillars (nhóm chủ đề) của project → composer pick nhanh theo khung nội dung.
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const projectId = (new URL(req.url).searchParams.get('projectId') ?? '').trim();
  if (!projectId) return errorResponse('projectId required', 400);
  const rows = await listContentPillars(projectId);
  const pillars = (rows || [])
    .filter((p) => (p as { status?: string }).status !== 'archived')
    .map((p) => ({ id: p.id, name: p.name, tagline: p.tagline, keyMessages: p.keyMessages, slug: p.slug }));
  return NextResponse.json({ ok: true, pillars });
}
