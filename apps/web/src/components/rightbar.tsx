'use client';

import { useState, useTransition } from 'react';
import type { Mode } from '@/lib/mock/types';
import { dismissAlert } from '@/lib/actions/alerts';

export function RightBar({ mode, projectId }: { mode?: Mode; projectId?: string }) {
  const [tab, setTab] = useState<'alerts' | 'feed'>('alerts');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const allAlerts = (mode?.alerts ?? []).filter((a) => !dismissed.has(a.id));
  const badCount = allAlerts.filter((a) => a.tone === 'bad').length;

  const handleDismiss = (alertId: string) => {
    if (!projectId) return;
    setDismissed((s) => new Set([...s, alertId]));
    startTransition(async () => {
      const res = await dismissAlert(projectId, alertId);
      if (!res.ok) {
        console.warn('dismissAlert failed:', res.error);
        setDismissed((s) => { const n = new Set(s); n.delete(alertId); return n; });
      }
    });
  };

  return (
    <aside className="rightbar">
      <div className="rightbar-tabs">
        <button data-active={tab === 'alerts' || undefined} onClick={() => setTab('alerts')}>
          🚨 Alerts <span className="count-pill" data-tone="bad">{badCount}</span>
        </button>
        <button data-active={tab === 'feed' || undefined} onClick={() => setTab('feed')}>
          ⌁ Activity <span className="count-pill">live</span>
        </button>
      </div>
      <div className="rightbar-body">
        {tab === 'alerts' && (
          <div>
            {allAlerts.map((a) => (
              <div key={a.id} className="alert-item" data-tone={a.tone}>
                <div className="alert-head">
                  <div className="alert-title">{a.title}</div>
                  <div className="alert-time">{a.time}</div>
                </div>
                <div className="alert-body">{a.body}</div>
                <div className="alert-tags">
                  {a.tags.map((t, i) => <span key={i} className="alert-tag">{t}</span>)}
                </div>
                <div className="alert-actions">
                  <button className="primary">Open</button>
                  <button onClick={() => handleDismiss(a.id)} disabled={!projectId}>Dismiss</button>
                  <button>Assign</button>
                </div>
              </div>
            ))}
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>— end of alerts —</div>
          </div>
        )}
        {tab === 'feed' && (
          <div>
            {(mode?.feed ?? []).map((f, i) => (
              <div key={i} className="feed-item" data-new={f.new || undefined}>
                <div className="feed-time">{f.t}</div>
                <div className="feed-content">
                  <div className="feed-line">
                    <span className="feed-agent">{f.agent}</span>
                    <span className="feed-action">{f.action}</span>
                  </div>
                  <div className="feed-target">{f.target}</div>
                  <div className="feed-meta">
                    <span className="lv" data-l={f.lvl}>L{f.lvl}</span>
                    <span>{f.lvl === 4 ? 'ESCALATED' : f.lvl === 3 ? 'QUEUED' : f.lvl === 2 ? 'AUTO+LOG' : 'AUTO'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
