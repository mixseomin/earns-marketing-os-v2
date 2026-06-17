import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { StrategyTestsTable } from '@/components/strategy-tests-table';
import { getProject, getProjectMode, listProjects, listStrategyTests, listStrategyTestAssets, listStrategyForward, listStrategyTrades, type StrategyAssetRow, type StrategyForwardRow, type StrategyTradeRow } from '@/lib/data';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StrategyTestsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [, eff] = await Promise.all([getCurrentUser(), getEffectiveUser()]);
  const [mode, projects, rows, assetRows, forwardRows, tradeRows] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listStrategyTests(id),
    listStrategyTestAssets(),
    listStrategyForward(),
    listStrategyTrades(),
  ]);
  const assetsByStrategy: Record<string, StrategyAssetRow[]> = {};
  assetRows.forEach((a) => { (assetsByStrategy[a.strategyName] ??= []).push(a); });
  const forwardByStrategy: Record<string, StrategyForwardRow[]> = {};
  forwardRows.forEach((f) => { (forwardByStrategy[f.strategy] ??= []).push(f); });
  const tradesByStrategy: Record<string, StrategyTradeRow[]> = {};
  tradeRows.forEach((t) => { (tradesByStrategy[t.strategy] ??= []).push(t); });

  return (
    <AppShell
      mode={mode} project={project} projects={projects} tab="resources"
      currentUser={eff ? { id: eff.id, displayName: eff.displayName, email: eff.email, role: eff.role, specialty: eff.specialty } : undefined}
    >
      <div style={{ padding: '18px 22px', maxWidth: 1320 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 19, margin: 0 }}>🔬 Strategy Tests</h1>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Honest real-data backtests of famous trading strategies — including the failures.</span>
        </div>
        <StrategyTestsTable rows={rows} assetsByStrategy={assetsByStrategy} forwardByStrategy={forwardByStrategy} tradesByStrategy={tradesByStrategy} />
      </div>
    </AppShell>
  );
}
