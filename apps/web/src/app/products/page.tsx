import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ProductsPage } from '@/components/products-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { getProductsView } from '@/lib/products/data';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function ProductsRoute({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/products');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, view] = await Promise.all([
    listProjects(), getLastProject(), getMode('affiliate'), getProductsView(days),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <ProductsPage view={view} />
    </AppShell>
  );
}
