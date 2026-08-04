import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getBacklinkSourceForTask } from '@/lib/actions/backlink-catalog';

// Lightweight GET for the drawer "📚 nguồn" panel. Was a Server Action → every open refetched the
// whole heavy /plays RSC tree (all portfolio tasks/media) = "lâu kinh khủng". A route handler returns
// just this one source + filled preview, no route re-render.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') return NextResponse.json({ ok: false, error: 'admin-only' }, { status: 403 });
  const { id } = await params;
  const projectId = new URL(req.url).searchParams.get('project') || '';
  const r = await getBacklinkSourceForTask(Number(id), projectId);
  return NextResponse.json(r);
}
