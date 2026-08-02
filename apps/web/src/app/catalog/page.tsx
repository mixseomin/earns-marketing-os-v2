import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CatalogPage } from '@/components/catalog-page';
import { getMode, listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { listBacklinkSources } from '@/lib/actions/backlink-catalog';

export const dynamic = 'force-dynamic';

// Manage the shared method/play catalog (backlink_sources), separate from /plays (task instances).
export default async function CatalogRoute() {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect('/');

  const [mode, projects, sources] = await Promise.all([
    getMode('affiliate'),
    listProjects(),
    listBacklinkSources({ status: 'active' }),
  ]);

  return (
    <AppShell
      mode={mode}
      projects={projects}
      isPortfolio
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <CatalogPage initialSources={sources} />
    </AppShell>
  );
}
