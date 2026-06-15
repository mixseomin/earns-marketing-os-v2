import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { StrategyTestsTable } from '@/components/strategy-tests-table';
import { getProject, getProjectMode, listProjects, listStrategyTests, listStrategyTestAssets, type StrategyAssetRow } from '@/lib/data';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function StrategyTestsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [, eff] = await Promise.all([getCurrentUser(), getEffectiveUser()]);
  const [mode, projects, rows, assetRows] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listStrategyTests(id),
    listStrategyTestAssets(),
  ]);
  const assetsByStrategy: Record<string, StrategyAssetRow[]> = {};
  assetRows.forEach((a) => { (assetsByStrategy[a.strategyName] ??= []).push(a); });

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
        <StrategyTestsTable rows={rows} assetsByStrategy={assetsByStrategy} />
      </div>
    </AppShell>
  );
}
