import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { resolveSelectors } from '@/lib/actions/habitat-selectors';
import { canonPlatformKey } from '@/lib/habitat-platform-map';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/ext/selectors/resolve?pageKind=composer&habitatId=&platformKey=&technologyKey=
// Trả selector resolved theo cascade habitat > platform > engine (resolveSelectors).
// Ext widget kéo về để build adapter.sel.* động (fallback hardcode khi field thiếu).
export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const p = new URL(req.url).searchParams;
  const pageKind = (p.get('pageKind') || '').trim();
  if (!pageKind) return errorResponse('pageKind required', 400);
  const habitatId = p.get('habitatId') ? Number(p.get('habitatId')) : null;
  // Ext gửi platformKey theo HOST ('x' trên x.com) nhưng selector lưu theo key
  // CANONICAL ('twitter'). Không canon → resolve rỗng → widget composer không build
  // được (bug lộ ra khi cache adapter bị xoá lúc bump version). canonPlatformKey x→twitter.
  const rawPlatformKey = p.get('platformKey') || null;
  const platformKey = rawPlatformKey ? canonPlatformKey(rawPlatformKey) : null;
  const technologyKey = p.get('technologyKey') || null;
  try {
    const map = await resolveSelectors({ habitatId, platformKey, technologyKey, pageKind });
    return NextResponse.json({ ok: true, pageKind, selectors: map });
  } catch (e) {
    return errorResponse((e as Error).message, 200);
  }
}
