'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  type AgentKindStats, type RecentAgentRun, type ReasoningSquad, type SystemFlags,
  type EligibleCard,
  resetAgentBreaker, setSoloReasoningSquad, toggleSquadReasoning, triggerWorkerNow,
} from '@/lib/actions/agents-admin';
import { Pill, StatsStrip, EmptyState, type StatCard } from './ui';

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--fg-3)', running: 'var(--neon-cyan)',
  completed: 'var(--ok)', failed: 'var(--bad)',
  timed_out: 'var(--warn)', rejected: 'var(--neon-amber)',
};

function fmtCost(c: number): string { return c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`; }
function fmtDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}
function fmtRel(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function AgentsAdminPage({ kindStats, recentRuns, reasoningSquads, flags, eligibleCards }: {
  kindStats: AgentKindStats[];
  recentRuns: RecentAgentRun[];
  reasoningSquads: ReasoningSquad[];
  flags: SystemFlags;
  eligibleCards: EligibleCard[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [soloBusy, setSoloBusy] = useState(false);
  const [soloMsg, setSoloMsg] = useState<string | null>(null);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerReport, setWorkerReport] = useState<Awaited<ReturnType<typeof triggerWorkerNow>> | null>(null);

  const totalRuns = kindStats.reduce((s, k) => s + k.totalRuns, 0);
  const totalCost = kindStats.reduce((s, k) => s + k.totalCostCents, 0);
  const totalFailed = kindStats.reduce((s, k) => s + k.failedRuns + k.timedOutRuns, 0);
  const activeSquads = reasoningSquads.filter((s) => s.useAgentLoop).length;

  const stats: StatCard[] = [
    { key: 'runs', label: 'Runs 24h', value: totalRuns, color: 'var(--fg-0)' },
    { key: 'failed', label: 'Failed', value: totalFailed, color: totalFailed > 0 ? 'var(--bad)' : 'var(--fg-3)' },
    { key: 'cost', label: 'Cost 24h', value: fmtCost(totalCost), color: 'var(--neon-amber)' },
    { key: 'kinds', label: 'Active kinds', value: kindStats.length, color: 'var(--neon-violet)' },
    { key: 'reasoning', label: 'Active / Configured', value: `${activeSquads} / ${reasoningSquads.length}`, color: activeSquads > 1 ? 'var(--warn)' : activeSquads === 1 ? 'var(--ok)' : 'var(--fg-3)' },
    { key: 'kill', label: 'Kill switch', value: flags.killSwitchActive ? 'ON' : 'off', color: flags.killSwitchActive ? 'var(--bad)' : 'var(--fg-3)' },
  ];

  const handlePauseAll = () => {
    if (!confirm('Pause TẤT CẢ reasoning squads? Agents sẽ ngừng nhận card mới qua worker.')) return;
    setSoloBusy(true);
    startTransition(async () => {
      const res = await setSoloReasoningSquad('', '');
      setSoloBusy(false);
      setSoloMsg(`Paused ${res.paused} squads.`);
      router.refresh();
    });
  };

  const handleRunWorker = () => {
    setWorkerBusy(true); setWorkerReport(null);
    startTransition(async () => {
      const r = await triggerWorkerNow(5);
      setWorkerBusy(false);
      setWorkerReport(r);
      router.refresh();
    });
  };

  const handleSoloActivate = (projectId: string, squadKey: string, squadName: string) => {
    if (!confirm(`Solo-mode: chỉ "${squadName}" reasoning ON, tất cả squad khác pause. Continue?`)) return;
    setSoloBusy(true);
    startTransition(async () => {
      const res = await setSoloReasoningSquad(projectId, squadKey);
      setSoloBusy(false);
      setSoloMsg(`Activated 1, paused ${res.paused} others.`);
      router.refresh();
    });
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🤖 Agents Admin
            <small>// {totalRuns} runs · {kindStats.length} kinds · {activeSquads}/{reasoningSquads.length} active</small>
          </h1>
          <p className="page-sub">
            Live agent execution monitor + control. Pause/reset breaker, solo-mode squad activation, kill switch status.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn primary"
            onClick={handleRunWorker}
            disabled={workerBusy || flags.killSwitchActive || eligibleCards.length === 0}
            title={
              flags.killSwitchActive ? 'Kill switch ON — disable env trước' :
              eligibleCards.length === 0 ? 'Không có card nào eligible (cần dispatch_ready=true + agent_kind set + squad reasoning ON)' :
              `Run ${eligibleCards.length} eligible card${eligibleCards.length > 1 ? 's' : ''}`
            }
          >
            {workerBusy
              ? `⟲ running… (${eligibleCards.length} eligible)`
              : `▶ Run worker (${eligibleCards.length})`}
          </button>
        </div>
      </div>

      {/* Eligible cards preview — show user trước khi click Run worker */}
      {eligibleCards.length > 0 && (
        <div style={{
          padding: '8px 12px', marginTop: 10, borderRadius: 6,
          background: 'rgba(157,108,255,.06)', border: '1px solid rgba(157,108,255,.25)',
          fontSize: 11.5,
        }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neon-violet)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            ▸ Will be processed next cycle ({eligibleCards.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {eligibleCards.map((c) => (
              <div key={c.cardId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', minWidth: 70 }}>{c.cardRef}</span>
                <a href={`/p/${c.projectId}/board`} style={{ flex: 1, color: 'var(--fg-1)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.title}
                </a>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{c.agentKind}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>· {c.squadKey}</span>
                {!c.reasoningEnabled && (
                  <span style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>⚠ squad off</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {workerReport && (
        <div style={{
          padding: '8px 12px', marginBottom: 10, borderRadius: 6,
          background: workerReport.failed > 0 ? 'rgba(255,77,94,.06)' : 'rgba(16,185,129,.06)',
          border: `1px solid ${workerReport.failed > 0 ? 'var(--bad)' : 'var(--ok)'}`,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <b>Last cycle:</b>
            <span style={{ color: 'var(--ok)' }}>{workerReport.processed} processed</span>
            <span>·</span>
            <span style={{ color: 'var(--fg-3)' }}>{workerReport.skipped} skipped</span>
            <span>·</span>
            <span style={{ color: workerReport.failed > 0 ? 'var(--bad)' : 'var(--fg-3)' }}>{workerReport.failed} failed</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: 10 }}>
              {workerReport.durationMs}ms · {new Date(workerReport.startedAt).toLocaleTimeString()}
            </span>
          </div>
          {workerReport.details.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              No cards in 'approved' col với agent_kind set + squad reasoning ON. Tạo card qua /board.
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {workerReport.details.map((d, i) => (
                <li key={i} style={{ color: d.status === 'ok' ? 'var(--ok)' : d.status === 'failed' ? 'var(--bad)' : 'var(--fg-3)' }}>
                  [{d.status}] {d.cardRef} {d.reason ? `— ${d.reason}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <StatsStrip cards={stats} />

      {/* Warnings */}
      {flags.killSwitchActive && (
        <div style={{ padding: 12, marginTop: 10, background: 'rgba(255,77,94,.12)', border: '1px solid var(--bad)', borderRadius: 6, color: 'var(--bad)' }}>
          🛑 <b>KILL SWITCH ACTIVE</b> — mọi agent runtime call DENY. Unset env <code>MOS2_KILL_SWITCH</code> trên server để resume.
        </div>
      )}
      {activeSquads > 1 && (
        <div style={{ padding: 12, marginTop: 10, background: 'rgba(255,176,60,.10)', border: '1px solid var(--warn)', borderRadius: 6, color: 'var(--fg-1)' }}>
          ⚠ <b>{activeSquads} squads đang active</b>. Khi pilot/test khuyến nghị chỉ 1 squad reasoning ON. Click "Solo activate" cạnh 1 squad bất kỳ để auto-pause các squad còn lại.
        </div>
      )}
      {soloMsg && (
        <div style={{ padding: 8, marginTop: 8, fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{soloMsg}</div>
      )}

      {/* Reasoning squads list */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '6px 0', marginBottom: 8,
          borderBottom: '1px solid var(--line)',
        }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
            🧠 Configured squads
          </h3>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
            {activeSquads} active · {reasoningSquads.length - activeSquads} paused
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="btn danger"
            onClick={handlePauseAll}
            disabled={soloBusy || activeSquads === 0}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            🛑 Pause all
          </button>
        </div>
        {reasoningSquads.length === 0 ? (
          <EmptyState icon="🧠" title="Chưa có squad nào configured" description="Vào /p/<id>/squads → mở 1 squad → set tools/skills + bật '🧠 Enable agent reasoning loop'." compact />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
            {reasoningSquads.map((s) => (
              <div key={`${s.projectId}-${s.squadKey}`} className="panel" style={{
                padding: '8px 10px',
                opacity: s.useAgentLoop ? 1 : 0.6,
                borderLeft: s.useAgentLoop ? '3px solid var(--neon-violet)' : '3px solid var(--fg-4)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.squadName}</span>
                  <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {s.projectName}</span>
                  <span style={{ flex: 1 }} />
                  <Pill
                    color={s.useAgentLoop ? 'var(--neon-violet)' : 'var(--fg-4)'}
                    label={s.useAgentLoop ? '● active' : '○ paused'}
                    size="xs"
                  />
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span>{s.model ?? 'no-model'}</span>
                  <span>· L{s.trustLevel ?? '?'}</span>
                  <span>· {s.toolsCount} tools</span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                  <a href={`/p/${s.projectId}/squads?edit=${encodeURIComponent(s.squadKey)}`} className="btn ghost" style={{ fontSize: 10, padding: '2px 6px' }} title="Open squad edit modal">Edit ↗</a>
                  {s.useAgentLoop ? (
                    <button
                      className="btn"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => startTransition(async () => { await toggleSquadReasoning(s.projectId, s.squadKey, false); router.refresh(); })}
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => startTransition(async () => { await toggleSquadReasoning(s.projectId, s.squadKey, true); router.refresh(); })}
                    >
                      ▶ Activate
                    </button>
                  )}
                  <button className="btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => handleSoloActivate(s.projectId, s.squadKey, s.squadName)}>
                    Solo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-kind stats */}
      <div style={{ marginTop: 18 }}>
        <div className="modal-section-title">Per agent_kind stats (24h)</div>
        {kindStats.length === 0 ? (
          <EmptyState icon="📊" title="No agent runs yet" description="Worker daemon chưa picked up card nào với agent_kind set + squad reasoning ON." compact />
        ) : (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Kind</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>OK / Fail / Timeout / Rejected</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Avg cost</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Total cost</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>Avg dur</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {kindStats.map((k) => (
                  <tr key={k.agentKind} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{k.agentKind}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{k.totalRuns}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ color: 'var(--ok)' }}>{k.completedRuns}</span>
                      <span style={{ color: 'var(--fg-4)' }}> / </span>
                      <span style={{ color: 'var(--bad)' }}>{k.failedRuns}</span>
                      <span style={{ color: 'var(--fg-4)' }}> / </span>
                      <span style={{ color: 'var(--warn)' }}>{k.timedOutRuns}</span>
                      <span style={{ color: 'var(--fg-4)' }}> / </span>
                      <span style={{ color: 'var(--neon-amber)' }}>{k.rejectedRuns}</span>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtCost(k.avgCostCents)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neon-amber)' }}>{fmtCost(k.totalCostCents)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtDuration(k.avgDurationMs)}</td>
                    <td style={{ padding: '6px 10px' }}>
                      {k.paused ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Pill color="var(--bad)" label="paused" size="xs" />
                          <button className="btn" style={{ fontSize: 9, padding: '1px 5px' }}
                            onClick={() => startTransition(async () => { await resetAgentBreaker(k.agentKind); router.refresh(); })}>
                            ↻ Reset
                          </button>
                        </div>
                      ) : k.recentFailures > 0 ? (
                        <Pill color="var(--warn)" label={`${k.recentFailures} fail/10m`} size="xs" />
                      ) : (
                        <Pill color="var(--ok)" label="active" size="xs" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div style={{ marginTop: 18 }}>
        <div className="modal-section-title">Recent runs (last 50)</div>
        {recentRuns.length === 0 ? (
          <EmptyState icon="📜" title="No runs yet" description="Trigger 1 agent_kind=claude-haiku-4-5 card với squad useAgentLoop=true để xem activity." compact />
        ) : (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'auto', maxHeight: 480 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10, position: 'sticky', top: 0 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>When</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Kind</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Project</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Tokens (in/out)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cost</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Dur</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmtRel(r.startedAt)}</td>
                    <td style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)' }}>{r.agentKind}{r.agentRef ? ` ${r.agentRef}` : ''}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <Pill color={STATUS_COLOR[r.status] ?? 'var(--fg-3)'} label={r.status} size="xs" />
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--fg-2)' }}>{r.projectId ?? '—'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.tokensIn}/{r.tokensOut}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--neon-amber)' }}>{fmtCost(r.costUsdCents)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtDuration(r.durationMs)}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--bad)', fontSize: 10, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error ?? ''}>{r.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Worker / system info */}
      <div style={{ marginTop: 18 }}>
        <div className="modal-section-title">System status</div>
        <div style={{ padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
          <div>OPENAI_API_KEY: <span style={{ color: flags.openaiConfigured ? 'var(--ok)' : 'var(--bad)' }}>{flags.openaiConfigured ? '● set' : '○ missing'}</span></div>
          <div>ANTHROPIC_API_KEY: <span style={{ color: flags.anthropicConfigured ? 'var(--ok)' : 'var(--bad)' }}>{flags.anthropicConfigured ? '● set' : '○ missing'}</span></div>
          <div>MOS2_CRON_SECRET: <span style={{ color: flags.cronSecretConfigured ? 'var(--ok)' : 'var(--bad)' }}>{flags.cronSecretConfigured ? '● set' : '○ missing'}</span></div>
          <div>MOS2_AGENT_TOKEN: <span style={{ color: flags.agentTokenConfigured ? 'var(--ok)' : 'var(--bad)' }}>{flags.agentTokenConfigured ? '● set' : '○ missing'}</span></div>
          <div>Kill switch: <span style={{ color: flags.killSwitchActive ? 'var(--bad)' : 'var(--ok)' }}>{flags.killSwitchActive ? 'ON (DENY all)' : 'off'}</span></div>
          <div style={{ marginTop: 6, color: 'var(--fg-3)' }}>{flags.workerHint}</div>
        </div>
      </div>
    </div>
  );
}
