import { AppShell } from '@/components/app-shell';
import { PortfolioView } from '@/components/portfolio-view';
import { getMode, listProjects } from '@/lib/data';

export default async function PortfolioPage() {
  const [projects, mode] = await Promise.all([listProjects(), getMode('affiliate')]);
  return (
    <AppShell mode={mode} isPortfolio>
      <PortfolioView projects={projects} />
    </AppShell>
  );
}
