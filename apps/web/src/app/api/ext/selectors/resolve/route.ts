import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { resolveSelectors } from '@/lib/actions/habitat-selectors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/selectors/resolve?pageKind=composer&habitatId=&platformKey=&technologyKey=
// Trả selector resolved theo cascade habitat > platform > engine (resolveSelectors).
// Ext widget kéo về để build adapter.sel.* động (fallback hardcode khi field thiếu).
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const p = new URL(req.url).searchParams;
  const pageKind = (p.get('pageKind') || '').trim();
  if (!pageKind) return NextResponse.json({ ok: false, error: 'pageKind required' }, { status: 400 });
  const habitatId = p.get('habitatId') ? Number(p.get('habitatId')) : null;
  const platformKey = p.get('platformKey') || null;
  const technologyKey = p.get('technologyKey') || null;
  try {
    const map = await resolveSelectors({ habitatId, platformKey, technologyKey, pageKind });
    return NextResponse.json({ ok: true, pageKind, selectors: map });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 200 });
  }
}
