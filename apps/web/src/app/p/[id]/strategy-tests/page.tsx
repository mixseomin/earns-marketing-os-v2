import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getProject, getProjectMode, listProjects, listStrategyTests } from '@/lib/data';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VERDICT_COLOR: Record<string, string> = {
  dead: '#ff5470', marginal: '#f5a623', 'gold-only': '#d4af37', edge: '#2ecc71', queued: '#7a8699', testing: '#00b8d4',
};
const dash = (v: string | number | null) => (v === null || v === '' || v === undefined ? '—' : String(v));

export default async function StrategyTestsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [, eff] = await Promise.all([getCurrentUser(), getEffectiveUser()]);
  const [mode, projects, rows] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listStrategyTests(id),
  ]);

  const TH: React.CSSProperties = { padding: '7px 9px', fontSize: 11, textAlign: 'left', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const TD: React.CSSProperties = { padding: '7px 9px', fontSize: 12, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const numCell = (v: string | null, badGood?: 'pf'): React.CSSProperties => {
    const base = { ...TD, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' };
    if (badGood === 'pf' && v != null && v !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return { ...base, color: n >= 1.3 ? '#2ecc71' : n >= 1.0 ? '#f5a623' : '#ff5470' };
    }
    return base;
  };

  return (
    <AppShell
      mode={mode} project={project} projects={projects} tab="resources"
      currentUser={eff ? { id: eff.id, displayName: eff.displayName, email: eff.email, role: eff.role, specialty: eff.specialty } : undefined}
    >
      <div style={{ padding: '18px 22px', maxWidth: 1280 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>🔬 Strategy Tests</h1>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rows.length} methods · real-data backtests (incl. failures)</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px', maxWidth: 760, lineHeight: 1.5 }}>
          Honest verdicts. Candle backtest (cost-subtracted) is a generous first filter; survivors get MT5 Model=4 real-tick.
          PF = profit factor. IS/OOS = in-sample / out-of-sample. Fade-at-level on FX dies; momentum only lives on the right asset class.
        </p>

        {rows.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--line)', borderRadius: 8 }}>
            No tested strategies for this project yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={TH}>Strategy</th>
                  <th style={TH}>Asset</th>
                  <th style={TH}>TF</th>
                  <th style={TH}>Code</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Trades</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Win%</th>
                  <th style={{ ...TH, textAlign: 'right' }}>PF</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Net</th>
                  <th style={{ ...TH, textAlign: 'right' }}>IS</th>
                  <th style={{ ...TH, textAlign: 'right' }}>OOS</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Real-tick</th>
                  <th style={TH}>Verdict</th>
                  <th style={TH}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={TD}>
                      <div style={{ fontWeight: 600 }}>
                        {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--fg)', textDecoration: 'none' }}>{r.name}</a> : r.name}
                      </div>
                      {r.variant ? <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r.variant}</div> : null}
                    </td>
                    <td style={TD}>{dash(r.asset)}</td>
                    <td style={TD}>{dash(r.timeframe)}</td>
                    <td style={{ ...TD, color: r.codability === 'none' ? '#ff5470' : r.codability === 'partial' ? '#f5a623' : 'var(--muted)' }}>{dash(r.codability)}</td>
                    <td style={numCell(r.trades != null ? String(r.trades) : null)}>{dash(r.trades)}</td>
                    <td style={numCell(r.winPct)}>{dash(r.winPct)}</td>
                    <td style={numCell(r.pf, 'pf')}>{dash(r.pf)}</td>
                    <td style={numCell(r.net)}>{r.net != null && r.net !== '' ? `${r.net}${r.netUnit ? ' ' + r.netUnit : ''}` : '—'}</td>
                    <td style={numCell(r.isPf, 'pf')}>{dash(r.isPf)}</td>
                    <td style={numCell(r.oosPf, 'pf')}>{dash(r.oosPf)}</td>
                    <td style={numCell(r.realtickPf, 'pf')}>{dash(r.realtickPf)}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, color: '#fff', background: VERDICT_COLOR[r.verdict ?? ''] ?? '#7a8699' }}>
                        {dash(r.verdict)}
                      </span>
                    </td>
                    <td style={{ ...TD, whiteSpace: 'normal', maxWidth: 280, color: 'var(--muted)', fontSize: 11 }}>{dash(r.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
