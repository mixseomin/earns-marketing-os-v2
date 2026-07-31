import { AppShell } from '@/components/app-shell';
import { PortfolioView } from '@/components/portfolio-view';
import { AiUsageCard } from '@/components/ai-usage-card';
import { getMode, listProjects, getAiUsageSummary } from '@/lib/data';

// Read DB at request time, not build time — server isn't migrated yet on first deploy.
export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const [projects, mode, aiUsage] = await Promise.all([listProjects(), getMode('affiliate'), getAiUsageSummary()]);
  return (
    <AppShell mode={mode} projects={projects} isPortfolio>
      <AiUsageCard usage={aiUsage} />
      <PortfolioView projects={projects} />
    </AppShell>
  );
}
