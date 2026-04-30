'use client';

import { useState, useMemo } from 'react';
import type { AILogEntry } from '@/lib/actions/ai-suggestions';
import { Pill, EmptyState, StatsStrip, type StatCard } from './ui';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
}

export function AILogPage({ log, dailyUsage }: {
  log: AILogEntry[];
  dailyUsage: { tokens: number; cost: number; calls: number; budgetUsd: number; budgetUsedPct: number };
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterModel, setFilterModel] = useState<string>('all');

  const projects = useMemo(() => Array.from(new Set(log.map((e) => e.projectId))), [log]);
  const models = useMemo(() => Array.from(new Set(log.map((e) => e.model))), [log]);

  const filtered = useMemo(() => log.filter((e) => {
    if (filterProject !== 'all' && e.projectId !== filterProject) return false;
    if (filterModel !== 'all' && e.model !== filterModel) return false;
    return true;
  }), [log, filterProject, filterModel]);

  const totalCost = log.reduce((s, e) => s + e.cost, 0);
  const totalTokens = log.reduce((s, e) => s + e.tokens, 0);
  const overBudget = dailyUsage.budgetUsedPct >= 100;

  const toggle = (id: number) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🤖 AI Activity
            <small>// {log.length} calls · oversight cho OpenAI usage</small>
          </h1>
          <p className="page-sub">
            Mọi AI call (gpt-4o-mini suggestions) log tại đây. Cache hits không vào log (chỉ generation thật).
            Budget control qua env <code>OPENAI_DAILY_BUDGET_USD</code> (hiện ${dailyUsage.budgetUsd}).
          </p>
        </div>
      </div>

      {/* Today usage strip */}
      <StatsStrip
        cards={[
          { key: 'today-cost', label: 'Today cost', value: `$${dailyUsage.cost.toFixed(4)}`, color: overBudget ? '#f87171' : 'var(--ok)' },
          { key: 'today-tokens', label: 'Today tokens', value: dailyUsage.tokens.toLocaleString(), color: 'var(--fg-0)' },
          { key: 'today-calls', label: 'Today calls', value: dailyUsage.calls, color: 'var(--neon-cyan)' },
          { key: 'budget', label: 'Daily budget', value: `$${dailyUsage.budgetUsd}`, color: 'var(--neon-amber)' },
          { key: 'used-pct', label: 'Used %', value: `${dailyUsage.budgetUsedPct.toFixed(1)}%`, color: overBudget ? '#f87171' : dailyUsage.budgetUsedPct > 75 ? 'var(--warn)' : 'var(--ok)' },
          { key: 'all-cost', label: 'All-time cost', value: `$${totalCost.toFixed(4)}`, color: 'var(--fg-2)' },
          { key: 'all-tokens', label: 'All-time tokens', value: totalTokens.toLocaleString(), color: 'var(--fg-2)' },
        ] satisfies StatCard[]}
      />

      {overBudget && (
        <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.4)', borderRadius: 6, color: 'var(--bad)', fontSize: 12, marginBottom: 12 }}>
          ⚠ Daily budget exceeded. AI calls đã pause; UI rơi về stale cache. Nâng env <code>OPENAI_DAILY_BUDGET_USD</code> để unblock.
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="chip" data-active={filterProject === 'all' || undefined} onClick={() => setFilterProject('all')}>All projects</span>
        {projects.map((p) => (
          <span key={p} className="chip" data-active={filterProject === p || undefined} onClick={() => setFilterProject(p)}>{p}</span>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
        <span className="chip" data-active={filterModel === 'all' || undefined} onClick={() => setFilterModel('all')}>All models</span>
        {models.map((m) => (
          <span key={m} className="chip" data-active={filterModel === m || undefined} onClick={() => setFilterModel(m)}>{m}</span>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🤖" title="Không có AI call nào" description="Mở dashboard 1 project real để trigger lần đầu, hoặc bấm Refresh." compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filtered.map((e) => {
            const isOpen = expanded.has(e.id);
            return (
              <div key={e.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => toggle(e.id)}>
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmtTime(e.generatedAt)}</span>
                      <Pill color="var(--neon-violet)" label={e.model} size="xs" />
                      <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{e.projectName}</span>
                      <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>· {e.suggestionsCount} sugg</span>
                      <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>· {e.tokens} tok</span>
                      <span style={{ color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>· ${e.cost.toFixed(5)}</span>
                      {e.approvedCount > 0 && <span style={{ color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>· ✓{e.approvedCount}</span>}
                      {e.rejectedCount > 0 && <span style={{ color: 'var(--bad)', fontFamily: 'var(--font-mono)' }}>· ✕{e.rejectedCount}</span>}
                      {e.promptHash && <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>#{e.promptHash}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>{isOpen ? '▾' : '▸'}</span>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--line)' }}>
                    <div className="modal-section-title">Suggestions output</div>
                    {e.suggestions.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', fontStyle: 'italic' }}>(empty)</div>
                    ) : (
                      <ol style={{ margin: 0, paddingLeft: 22, fontSize: 12, color: 'var(--fg-1)' }}>
                        {e.suggestions.map((s, i) => {
                          const fb = e.feedback[String(i)];
                          return (
                            <li key={i} style={{
                              marginBottom: 4,
                              opacity: fb === 'rejected' ? 0.5 : 1,
                              textDecoration: fb === 'rejected' ? 'line-through' : undefined,
                            }}>
                              <span style={{ marginRight: 6 }}>{s.icon}</span>
                              <b>{s.title}</b>
                              {fb === 'approved' && <span style={{ marginLeft: 6, color: 'var(--ok)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>✓ approved</span>}
                              {fb === 'rejected' && <span style={{ marginLeft: 6, color: 'var(--bad)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>✕ rejected</span>}
                              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{s.meta} · agent {s.agent}</div>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    <div className="modal-section-title">Input context</div>
                    <pre style={{
                      margin: 0, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)',
                      borderRadius: 5, fontSize: 11, lineHeight: 1.5, fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--fg-1)',
                      maxHeight: 240, overflow: 'auto',
                    }}>{JSON.stringify(e.inputContext, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
