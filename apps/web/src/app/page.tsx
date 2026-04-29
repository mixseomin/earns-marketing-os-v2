import { AppShell } from '@/components/app-shell';
import { PortfolioView } from '@/components/portfolio-view';
import { getMode } from '@/lib/mock/modes';

export default function PortfolioPage() {
  const mode = getMode('affiliate');
  return (
    <AppShell mode={mode} isPortfolio>
      <PortfolioView />
    </AppShell>
  );
}
