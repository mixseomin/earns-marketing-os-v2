// Proxy CourseForge preview images so they load inside the confined user.on.tc portal
// (reviewers can't hit course.on.tc directly). Session/token gated.
//   GET /api/review/content/media?f=<courseId>/<lectureId>/preview/s1.png
import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CF_BASE = process.env.COURSEFORGE_URL || 'http://127.0.0.1:3820';

export async function GET(req: NextRequest) {
  const tok = process.env.MOS2_AGENT_TOKEN;
  const ok = (tok && req.headers.get('x-agent-token') === tok) || !!(await getCurrentUser());
  if (!ok) return new Response(null, { status: 401 });
  const f = new URL(req.url).searchParams.get('f');
  if (!f) return new Response(null, { status: 400 });
  let r: Response;
  try { r = await fetch(CF_BASE + '/media?f=' + encodeURIComponent(f)); }
  catch { return new Response(null, { status: 502 }); }
  if (!r.ok) return new Response(null, { status: r.status });
  return new Response(r.body, { status: 200, headers: { 'Content-Type': r.headers.get('content-type') || 'image/png', 'Cache-Control': 'private, max-age=60' } });
}
