import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OffersPage } from '@/components/offers-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getOffersView, listOfferAccounts, type OfferFilters } from '@/lib/actions/offers';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

// Filters live in the URL (shareable + survives F5) and are applied SERVER-side — see the
// filtering block in lib/actions/offers.ts for why this list can't be filtered in the browser.
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined, fallback = '') => (Array.isArray(v) ? v[0] : v) ?? fallback;
const many = (v: string | string[] | undefined) => one(v).split(',').map((s) => s.trim()).filter(Boolean);

export default async function OffersRoute({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/offers');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const sp = await searchParams;
  const filters: OfferFilters = {
    q: one(sp.q),
    kind: one(sp.kind, 'all'),
    status: one(sp.status, 'all'),
    accounts: many(sp.account),
    verticals: many(sp.vertical),
    geos: many(sp.geo),
    gap: one(sp.gap, 'all'),
    recurring: one(sp.recurring, 'all'),
    page: Math.max(0, Number(one(sp.page, '1')) - 1) || 0,   // URL is 1-based, view is 0-based
  };

  const [projects, lastProject, fallbackMode, view, accounts] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    getOffersView(filters),
    listOfferAccounts(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <OffersPage view={view} filters={filters} accounts={accounts} />
    </AppShell>
  );
}
