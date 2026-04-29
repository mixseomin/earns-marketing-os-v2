import { AppShell } from '@/components/app-shell';
import { PortfolioView } from '@/components/portfolio-view';
import { getMode, listProjects } from '@/lib/data';

// Read DB at request time, not build time — server isn't migrated yet on first deploy.
export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const [projects, mode] = await Promise.all([listProjects(), getMode('affiliate')]);
  return (
    <AppShell mode={mode} isPortfolio>
      <PortfolioView projects={projects} />
    </AppShell>
  );
}
