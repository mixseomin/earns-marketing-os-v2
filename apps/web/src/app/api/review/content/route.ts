// Read-only course content for the review portal. Reviewers (confined to user.on.tc)
// can't reach course.on.tc, so MOS2 fetches the CourseForge control-plane server-side
// (same box) and serves a trimmed, safe view (no render/cost controls).
//   GET /api/review/content?project=courseforge                      → courses + lectures
//   GET /api/review/content?project=courseforge&courseId=&lectureId= → one lecture's scenes
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CF_BASE = process.env.COURSEFORGE_URL || 'http://127.0.0.1:3820';

async function authed(req: NextRequest): Promise<boolean> {
  const tok = process.env.MOS2_AGENT_TOKEN;
  if (tok && req.headers.get('x-agent-token') === tok) return true;
  return !!(await getCurrentUser());
}

export async function GET(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const u = new URL(req.url);
  const project = u.searchParams.get('project') || 'courseforge';
  if (project !== 'courseforge') return NextResponse.json({ ok: false, error: 'unknown project' }, { status: 400 });

  let state: { courses?: Array<Record<string, unknown>> };
  try { state = await (await fetch(CF_BASE + '/api/state', { cache: 'no-store' })).json(); }
  catch { return NextResponse.json({ ok: false, error: 'course service unreachable' }, { status: 502 }); }

  const courseId = u.searchParams.get('courseId');
  const lectureId = u.searchParams.get('lectureId');
  const courses = (state.courses || []) as Array<{ id: string; title: string; subtitle?: string; lectures: Array<{ id: string; title: string; section?: string; status?: string; previewed?: boolean; previewDir?: string; spec?: { scenes?: unknown[] } }> }>;

  if (courseId && lectureId) {
    const c = courses.find((x) => x.id === courseId);
    const l = c?.lectures.find((x) => x.id === lectureId);
    if (!l) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    return NextResponse.json({
      ok: true, courseId, courseTitle: c?.title,
      lecture: { id: l.id, title: l.title, section: l.section, previewed: !!l.previewed, previewDir: l.previewDir, scenes: l.spec?.scenes || [] },
    });
  }

  return NextResponse.json({
    ok: true,
    courses: courses.map((c) => ({
      id: c.id, title: c.title, subtitle: c.subtitle,
      lectures: c.lectures.map((l) => ({ id: l.id, title: l.title, section: l.section, status: l.status, previewed: !!l.previewed, scenes: (l.spec?.scenes || []).length })),
    })),
  });
}
