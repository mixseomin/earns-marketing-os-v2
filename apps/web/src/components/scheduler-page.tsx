'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CronJob, CronRun, WorkerNode } from '@/lib/actions/scheduler';
import {
  listCronJobsAction,
  listCronRunsAction,
  updateCronJobAction,
  triggerJobNowAction,
  listWorkerNodes,
} from '@/lib/actions/scheduler';

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return `${Math.round(abs / 1000)}s ago`;
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ago`;
  return `${Math.round(abs / 86_400_000)}d ago`;
}

function countdown(iso: string | null, intervalMin: number): { label: string; overdue: boolean } {
  if (!iso) return { label: '—', overdue: false };
  const diff = new Date(iso).getTime() - Date.now();
  const overdueThr = intervalMin * 60_000 * 2; // overdue if 2x interval past
  if (diff <= 0) {
    const late = Math.abs(diff);
    return { label: late > overdueThr ? `overdue ${Math.round(late / 60_000)}m` : 'due now', overdue: late > overdueThr };
  }
  const s = Math.round(diff / 1000);
  if (s < 60) return { label: `in ${s}s`, overdue: false };
  return { label: `in ${Math.round(s / 60)}m`, overdue: false };
}

function statusColor(status: string): string {
  if (status === 'ok') return 'var(--neon-lime)';
  if (status === 'running') return 'var(--neon-amber)';
  if (status === 'error') return 'var(--neon-red, #ff4757)';
  return 'var(--fg-4)'; // never / disabled
}

function StatusDot({ status, enabled }: { status: string; enabled: boolean }) {
  const color = !enabled ? 'var(--fg-4)' : statusColor(status);
  const pulse = status === 'running' && enabled;
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: pulse ? `0 0 6px 2px ${color}` : undefined,
        animation: pulse ? 'scheduler-pulse 1.2s ease-in-out infinite' : undefined,
      }}
      title={enabled ? status : 'disabled'}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 4,
        border: `1px solid ${color}`,
        color,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

const INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30, 60, 120, 240];

// ── RunHistoryRow ─────────────────────────────────────────────────────────────
function RunHistoryTable({ jobId }: { jobId: string }) {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listCronRunsAction(jobId, 20).then((r) => {
      if (!cancelled) { setRuns(r); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return (
      <div style={{ padding: '12px 16px', color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        loading history…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div style={{ padding: '12px 16px', color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        no runs recorded yet
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)' }}>
            {['started', 'duration', 'status', 'report', 'error'].map((h) => (
              <th key={h} style={{ padding: '4px 12px', textAlign: 'left', color: 'var(--fg-4)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const reportStr = Object.keys(r.report).length > 0
              ? Object.entries(r.report)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(' ')
              : '—';
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(127,127,127,.06)' }}>
                <td style={{ padding: '4px 12px', color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{relativeTime(r.startedAt)}</td>
                <td style={{ padding: '4px 12px', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                  {r.durationMs != null ? `${r.durationMs}ms` : '—'}
                </td>
                <td style={{ padding: '4px 12px', whiteSpace: 'nowrap' }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: '4px 12px', color: 'var(--fg-3)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {reportStr}
                </td>
                <td style={{ padding: '4px 12px', color: 'var(--neon-red, #ff4757)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.errorMsg ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── JobRow ────────────────────────────────────────────────────────────────────
function JobRow({ job, onRefresh }: { job: CronJob; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);
  const [runState, setRunState] = useState<'idle' | 'queued'>('idle');
  const [toggling, setToggling] = useState(false);

  const { label: nextLabel, overdue } = countdown(job.nextRunAt, job.intervalMinutes);

  const handleIntervalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = Number(e.target.value);
    await updateCronJobAction(job.id, { intervalMinutes: v });
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
    onRefresh();
  };

  const handleToggle = async () => {
    setToggling(true);
    await updateCronJobAction(job.id, { enabled: !job.enabled });
    setToggling(false);
    onRefresh();
  };

  const handleRunNow = async () => {
    setRunState('queued');
    await triggerJobNowAction(job.id);
    setTimeout(() => { setRunState('idle'); onRefresh(); }, 3000);
  };

  const rowBg = expanded ? 'rgba(255,255,255,.03)' : undefined;

  return (
    <>
      <tr
        style={{ borderBottom: '1px solid var(--line)', background: rowBg, cursor: 'pointer' }}
        onClick={() => setExpanded((x) => !x)}
      >
        {/* expand arrow + status dot */}
        <td style={{ padding: '10px 8px 10px 12px', width: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--fg-4)', lineHeight: 1 }}>{expanded ? '▾' : '▸'}</span>
            <StatusDot status={job.lastStatus} enabled={job.enabled} />
          </div>
        </td>

        {/* label + description */}
        <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{job.label}</span>
            {job.description && (
              <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {job.description}
              </span>
            )}
          </div>
        </td>

        {/* interval selector */}
        <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={job.intervalMinutes}
              onChange={handleIntervalChange}
              style={{
                background: 'var(--bg-2, #1a1a2e)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                color: 'var(--fg-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '2px 4px',
                cursor: 'pointer',
              }}
              title="Change interval — saves immediately"
            >
              {INTERVAL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}m</option>
              ))}
            </select>
            {savedBadge && (
              <span style={{ fontSize: 10, color: 'var(--neon-lime)', fontFamily: 'var(--font-mono)' }}>✓ saved</span>
            )}
          </div>
        </td>

        {/* enabled toggle */}
        <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={job.enabled ? 'Click to disable' : 'Click to enable'}
            style={{
              background: job.enabled ? 'var(--neon-lime)' : 'var(--line)',
              border: 'none',
              borderRadius: 10,
              width: 34,
              height: 18,
              cursor: toggling ? 'wait' : 'pointer',
              position: 'relative',
              transition: 'background .15s',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: job.enabled ? 18 : 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left .15s',
              }}
            />
          </button>
        </td>

        {/* last run */}
        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ color: 'var(--fg-2)' }}>{relativeTime(job.lastRunAt)}</span>
            {job.lastStatus !== 'never' && <StatusBadge status={job.lastStatus} />}
          </div>
        </td>

        {/* next run */}
        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span style={{ color: overdue ? 'var(--neon-red, #ff4757)' : 'var(--fg-2)' }}>
            {job.enabled ? nextLabel : '—'}
          </span>
        </td>

        {/* actions */}
        <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleRunNow}
            disabled={runState === 'queued'}
            title="Reset next_run_at to NOW() — systemd timer will pick up within 1-2 min"
            style={{
              background: 'transparent',
              border: `1px solid ${runState === 'queued' ? 'var(--neon-amber)' : 'var(--line)'}`,
              borderRadius: 4,
              color: runState === 'queued' ? 'var(--neon-amber)' : 'var(--fg-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '3px 8px',
              cursor: runState === 'queued' ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'border-color .15s, color .15s',
            }}
          >
            {runState === 'queued' ? '⏳ queued' : '▶ Run now'}
          </button>
        </td>
      </tr>

      {/* expandable history */}
      {expanded && (
        <tr style={{ background: 'rgba(0,0,0,.25)' }}>
          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--line)' }}>
            <div style={{ padding: '0 0 8px 0' }}>
              <div style={{
                padding: '8px 16px 6px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-4)',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                borderBottom: '1px solid rgba(127,127,127,.08)',
              }}>
                Last 20 runs · {job.label}
              </div>
              <RunHistoryTable jobId={job.id} />
              {runState === 'queued' && (
                <div style={{ padding: '6px 16px', fontSize: 10.5, color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)' }}>
                  ⏳ Queued — systemd timer fires within 1-2 min and will pick this up.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── StatStrip ─────────────────────────────────────────────────────────────────
function StatStrip({ jobs }: { jobs: CronJob[] }) {
  const total = jobs.length;
  const active = jobs.filter((j) => j.enabled).length;
  const running = jobs.filter((j) => j.lastStatus === 'running').length;
  const hasError = jobs.filter((j) => j.lastStatus === 'error').length;

  const stats = [
    { label: 'Total jobs', value: total, color: 'var(--fg-2)' },
    { label: 'Active', value: active, color: 'var(--neon-lime)' },
    { label: 'Running now', value: running, color: 'var(--neon-amber)' },
    { label: 'Last error', value: hasError, color: hasError > 0 ? 'var(--neon-red, #ff4757)' : 'var(--fg-4)' },
  ];

  return (
    <div style={{ display: 'flex', gap: 1, marginBottom: 20 }}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            flex: 1,
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: i === 0 ? '6px 0 0 6px' : i === stats.length - 1 ? '0 6px 6px 0' : 0,
            borderLeft: i > 0 ? 'none' : undefined,
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Worker Nodes section ──────────────────────────────────────────────────────
function WorkerNodesPanel({ nodes }: { nodes: WorkerNode[] }) {
  const nodeStatusColor = (s: string, heartbeat: string | null) => {
    if (!heartbeat) return 'var(--fg-4)';
    const age = Date.now() - new Date(heartbeat).getTime();
    if (age > 10 * 60_000) return 'var(--fg-4)'; // offline: no heartbeat >10min
    if (s === 'running') return 'var(--neon-amber)';
    if (s === 'error') return 'var(--neon-red,#ff4757)';
    return 'var(--neon-lime)';
  };
  const isOnline = (n: WorkerNode) => !!n.lastHeartbeat && Date.now() - new Date(n.lastHeartbeat).getTime() < 10 * 60_000;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        ⚙ Worker Nodes
        <span style={{ marginLeft: 8, color: 'var(--fg-4)', fontWeight: 400, textTransform: 'none' }}>
          — mỗi node tự đăng ký khi chạy; offline = heartbeat &gt;10min
        </span>
      </div>
      {nodes.length === 0 ? (
        <div style={{ padding: '16px', border: '1px dashed var(--line)', borderRadius: 6, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          Chưa có worker node nào register. Worker sẽ tự đăng ký khi chạy lần đầu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {nodes.map((n) => {
            const color = nodeStatusColor(n.status, n.lastHeartbeat);
            const online = isOnline(n);
            const report = n.lastCycleReport as { processed?: number; skipped?: number; failed?: number };
            return (
              <div key={n.id} style={{
                background: 'var(--bg-1)', border: `1px solid ${online ? color : 'var(--line)'}`,
                borderRadius: 8, padding: '12px 16px', minWidth: 220, flex: '1 1 220px',
                opacity: online ? 1 : 0.55,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{n.label ?? n.id}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'var(--font-mono)', color: online ? color : 'var(--fg-4)' }}>
                    {online ? n.status : 'offline'}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>heartbeat: {n.lastHeartbeat ? relativeTime(n.lastHeartbeat) : '—'}</span>
                  <span>last cycle: {n.lastCycleAt ? relativeTime(n.lastCycleAt) : '—'}</span>
                  {(report.processed != null || report.failed != null) && (
                    <span style={{ color: report.failed ? 'var(--neon-amber)' : 'var(--fg-3)' }}>
                      ✓ {report.processed ?? 0} · ✗ {report.failed ?? 0} · skip {report.skipped ?? 0}
                    </span>
                  )}
                  {n.squadsFilter.length > 0 && (
                    <span>squads: {n.squadsFilter.join(', ')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function SchedulerPage({ jobs: initialJobs, nodes: initialNodes }: { jobs: CronJob[]; nodes: WorkerNode[] }) {
  const [jobs, setJobs] = useState<CronJob[]>(initialJobs);
  const [nodes, setNodes] = useState<WorkerNode[]>(initialNodes);

  const refresh = useCallback(() => {
    listCronJobsAction().then((j) => setJobs(j)).catch(() => {});
    listWorkerNodes().then((n) => setNodes(n)).catch(() => {});
  }, []);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      {/* pulse animation for running dots */}
      <style>{`
        @keyframes scheduler-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .35; }
        }
      `}</style>

      {/* header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, color: 'var(--neon-lime)' }}>⏱</span>
            Scheduler
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            Configure and monitor all cron jobs · auto-refresh every 10s
          </p>
        </div>
        <button
          onClick={refresh}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 5,
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
          title="Refresh job list"
        >
          ↺ refresh
        </button>
      </div>

      {/* stats strip */}
      <StatStrip jobs={jobs} />

      {/* hint */}
      <div style={{
        marginBottom: 16,
        padding: '8px 14px',
        background: 'rgba(255,200,0,.06)',
        border: '1px solid rgba(255,200,0,.15)',
        borderRadius: 5,
        fontSize: 11,
        color: 'var(--fg-3)',
        fontFamily: 'var(--font-mono)',
      }}>
        <strong style={{ color: 'var(--neon-amber)' }}>Soft-throttle</strong>
        {' — systemd timers call endpoints every 1-5 min; endpoints check '}
        <code style={{ fontSize: 10.5 }}>next_run_at</code>
        {' and skip early calls. Change interval here — no SSH needed.'}
      </div>

      {/* jobs table */}
      {jobs.length === 0 ? (
        <div style={{
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--fg-4)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}>
          No cron jobs found — run the migration to seed initial jobs.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.02)', borderBottom: '1px solid var(--line)' }}>
                {[
                  { label: '', w: 28 },
                  { label: 'Job', w: undefined },
                  { label: 'Interval', w: 120 },
                  { label: 'Enabled', w: 80 },
                  { label: 'Last run', w: 130 },
                  { label: 'Next run', w: 110 },
                  { label: 'Actions', w: 110 },
                ].map((h) => (
                  <th
                    key={h.label}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 500,
                      color: 'var(--fg-4)',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      whiteSpace: 'nowrap',
                      width: h.w,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} onRefresh={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* worker nodes */}
      <WorkerNodesPanel nodes={nodes} />

      {/* footer note */}
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        Click a row to expand run history · Interval changes take effect on the next systemd timer fire
      </div>
    </div>
  );
}
