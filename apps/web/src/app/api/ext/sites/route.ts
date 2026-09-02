// GET /api/ext/sites — the portfolio site list, straight from BACKLINK_SITES (the
// single source of truth). box1 tooling (onboard-site, gsc_check) reads this instead
// of keeping its own parallel list, so declaring a site in backlink-sites.ts is enough.
// Domains aren't secret; we keep the ext auth only for consistency with sibling routes.
import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { BACKLINK_SITES } from '@/lib/backlink-sites';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  const sites = BACKLINK_SITES.map(({ slug, domain, label, niches }) => ({ slug, domain, label, niches }));
  return NextResponse.json({ sites, count: sites.length });
}
