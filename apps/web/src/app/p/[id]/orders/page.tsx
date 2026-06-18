import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { OrdersBlotter } from '@/components/orders-blotter';
import { getProject, getProjectMode, listProjects, listStrategyTrades, listStrategyTests, listStrategyForward, getBrokerNowMs } from '@/lib/data';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function OrdersRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [, eff] = await Promise.all([getCurrentUser(), getEffectiveUser()]);
  const [mode, projects, tradeRows, testRows, forwardRows, brokerNowMs] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listStrategyTrades(),
    listStrategyTests(id),
    listStrategyForward(),
    getBrokerNowMs(),
  ]);

  return (
    <AppShell
      mode={mode} project={project} projects={projects} tab="resources"
      currentUser={eff ? { id: eff.id, displayName: eff.displayName, email: eff.email, role: eff.role, specialty: eff.specialty } : undefined}
    >
      <div style={{ padding: '18px 22px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 19, margin: 0 }}>📋 Live Orders</h1>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>All forward-test orders across strategies — open now + recently closed.</span>
          <span style={{ flex: 1 }} />
          <Link href={`/p/${id}/strategy-tests`} style={{ fontSize: 12, color: 'var(--accent,#00e5ff)', textDecoration: 'none' }}>🔬 Strategy Tests →</Link>
        </div>
        <OrdersBlotter trades={tradeRows} tests={testRows} forward={forwardRows} brokerNowMs={brokerNowMs} />
      </div>
    </AppShell>
  );
}
