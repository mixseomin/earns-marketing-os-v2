import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
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

  // filter state from cookie so SSR renders the saved filter -> no localStorage flash on F5
  let initialFilter = { range: '24h', grouped: true, hideClosed: false };
  try { const slf = (await cookies()).get('slf')?.value; if (slf) initialFilter = { ...initialFilter, ...JSON.parse(decodeURIComponent(slf)) }; } catch { /* ignore */ }

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
      <div className="lo-wrap" style={{ padding: '18px 22px', maxWidth: 1100 }}>
        <style>{`@media (max-width:640px){.lo-wrap{padding:10px 12px!important}.lo-sub{display:none!important}.lo-head{margin-bottom:8px!important}.lo-head h1{font-size:16px!important}}`}</style>
        <div className="lo-head" style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 19, margin: 0 }}>📋 Live Orders</h1>
          <span className="lo-sub" style={{ fontSize: 12.5, color: 'var(--muted)' }}>All forward-test orders across strategies — open now + recently closed.</span>
          <span style={{ flex: 1 }} />
          <Link href={`/p/${id}/strategy-tests`} style={{ fontSize: 12, color: 'var(--accent,#00e5ff)', textDecoration: 'none', whiteSpace: 'nowrap' }}>🔬 Strategy Tests →</Link>
        </div>
        <OrdersBlotter trades={tradeRows} tests={testRows} forward={forwardRows} brokerNowMs={brokerNowMs} initial={initialFilter} />
      </div>
    </AppShell>
  );
}
