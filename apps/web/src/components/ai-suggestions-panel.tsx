'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOrGenerateSuggestions, setSuggestionFeedback } from '@/lib/actions/ai-suggestions';
import type { AISuggestion } from '@/lib/ai/suggestions';

type Decision = 'approved' | 'rejected';

const ICON_COLOR: Record<string, string> = {
  '↗': '#10b981', '✦': '#a78bfa', '✕': '#f87171', '⟲': '#fbbf24', '!': '#fb923c',
};

function fmtRelative(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function AISuggestionsPanel({ projectId }: { projectId: string }) {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<number | undefined>();
  const [rowId, setRowId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Decision>>({});

  const load = (force: boolean) => {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const res = await getOrGenerateSuggestions(projectId, { force });
      setLoading(false);
      if (!res.ok && res.suggestions.length === 0) {
        setError(res.error ?? 'Generation failed');
        return;
      }
      setSuggestions(res.suggestions);
      setGeneratedAt(res.generatedAt);
      setModel(res.model);
      setFromCache(res.fromCache);
      setTokens(res.tokensUsed);
      setRowId(res.rowId);
      setFeedback(res.feedback ?? {});
      if (res.error) setError(res.error);
    });
  };

  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [projectId]);

  // Optimistic toggle: nếu đang là decision đó → clear (back to pending), else set.
  const decide = (index: number, target: Decision) => {
    if (rowId === null) return;
    const key = String(index);
    const current = feedback[key];
    const next = current === target ? null : target;
    // Optimistic update
    setFeedback((f) => {
      const copy = { ...f };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    startTransition(async () => {
      const res = await setSuggestionFeedback(rowId, index, next);
      if (!res.ok) {
        // Rollback
        setFeedback((f) => {
          const copy = { ...f };
          if (current === undefined) delete copy[key];
          else copy[key] = current;
          return copy;
        });
        setError(res.error ?? 'Feedback save failed');
      }
    });
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="dot" style={{ background: 'var(--neon-violet)', boxShadow: '0 0 6px var(--neon-violet)' }}></span>
          AI Suggestions <small>// {model || 'gpt-4o-mini'} {fromCache ? '· cached' : '· fresh'}</small>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {generatedAt && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmtRelative(generatedAt)}</span>}
          <button onClick={() => load(true)} disabled={loading}
                  className="btn" style={{ fontSize: 10, padding: '3px 8px' }}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>
      <div className="panel-body dense">
        {loading && suggestions.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            🤖 Generating suggestions via {model || 'OpenAI'}…
          </div>
        )}
        {error && (
          <div style={{ padding: 10, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 5, color: 'var(--bad)', fontSize: 11, margin: 8 }}>
            ⚠ {error}
          </div>
        )}
        {!loading && !error && suggestions.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--fg-3)' }}>
            Chưa có suggestion nào. Bấm Refresh để generate.
          </div>
        )}
        <div className="sugg-list">
          {suggestions.map((s, i) => {
            const decision = feedback[String(i)];
            const isApproved = decision === 'approved';
            const isRejected = decision === 'rejected';
            return (
              <div key={i} className="sugg" style={{
                opacity: isRejected ? 0.45 : 1,
                background: isApproved ? 'rgba(16,185,129,.05)' : isRejected ? 'rgba(248,113,113,.04)' : undefined,
              }}>
                <div className="sugg-icon" style={{ color: ICON_COLOR[s.icon] || 'var(--fg-1)' }}>{s.icon}</div>
                <div className="sugg-body">
                  <div className="sugg-title" style={{ textDecoration: isRejected ? 'line-through' : undefined }}>
                    {s.title}
                    {isApproved && <span style={{ marginLeft: 6, color: 'var(--ok)', fontSize: 10 }}>✓ approved</span>}
                    {isRejected && <span style={{ marginLeft: 6, color: 'var(--bad)', fontSize: 10 }}>✕ rejected</span>}
                  </div>
                  <div className="sugg-meta">{s.meta} • <span style={{ color: 'var(--accent)' }}>{s.agent}</span></div>
                </div>
                <div className="sugg-actions">
                  <button
                    className="btn"
                    onClick={() => decide(i, 'approved')}
                    disabled={rowId === null}
                    title={isApproved ? 'Click để bỏ duyệt' : 'Đánh dấu hữu ích'}
                    style={{
                      background: isApproved ? 'var(--ok)' : undefined,
                      color: isApproved ? '#000' : undefined,
                      borderColor: isApproved ? 'var(--ok)' : undefined,
                    }}
                  >
                    {isApproved ? '✓ Approved' : 'Approve'}
                  </button>
                  <button
                    className="btn"
                    onClick={() => decide(i, 'rejected')}
                    disabled={rowId === null}
                    title={isRejected ? 'Click để bỏ reject' : 'Đánh dấu không hữu ích'}
                    style={{
                      background: isRejected ? 'var(--bad)' : undefined,
                      color: isRejected ? '#fff' : undefined,
                      borderColor: isRejected ? 'var(--bad)' : undefined,
                    }}
                  >
                    {isRejected ? '✕ Rejected' : 'Reject'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {tokens !== undefined && tokens > 0 && (
          <div style={{ padding: '4px 12px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>
            {tokens} tokens · ~${((tokens / 1000) * 0.00015).toFixed(5)} (gpt-4o-mini rate)
          </div>
        )}
      </div>
    </div>
  );
}
