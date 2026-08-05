import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OffersPage } from '@/components/offers-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listAffiliateOffers } from '@/lib/actions/offers';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function OffersRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/offers');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, offers] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listAffiliateOffers(),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <OffersPage offers={offers} />
    </AppShell>
  );
}
