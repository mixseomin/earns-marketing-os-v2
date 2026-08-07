import { checkAuth } from '../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { listFollowups, getFollowup, createFollowup } from '@/lib/actions/followups';

export const dynamic = 'force-dynamic';

// Follow-ups ext API (used by ~/bin/followup). Logic lives in lib/actions/followups (shared with the
// drawer UI) — these handlers are just auth + HTTP shape.
//
// GET /api/ext/followups?project=<slug>&due=1   → { items: Followup[] }  (due=1 = open + due today-or-earlier)
// GET /api/ext/followups?id=<n>                 → { items: [Followup] }   (one task, full record — resume it)
export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const u = new URL(req.url);
  const id = (u.searchParams.get('id') ?? '').trim();
  if (id) { const f = await getFollowup(Number(id)); return okResponse({ items: f ? [f] : [] }); }
  const project = (u.searchParams.get('project') ?? '').trim();
  const items = await listFollowups(project || undefined, u.searchParams.get('due') === '1');
  return okResponse({ items });
}

// POST /api/ext/followups  { projectId, title, detail?, due?, status? }
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const b = (await req.json().catch(() => ({}))) as { projectId?: string; title?: string; detail?: string; due?: string; status?: string };
  const r = await createFollowup(b);
  if (!r.ok) return errorResponse(r.error, 400);
  return okResponse({ id: r.id });
}
