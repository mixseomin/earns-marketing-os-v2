// DB-backed Tribes view cho real projects (isDemo=false).
// Mock 5-tribe / 32-habitat design ở tribes-page.tsx vẫn dùng cho demo.

'use client';

import { useState, useMemo } from 'react';
import type { TribeRow, HabitatRow } from '@/lib/data';
import { Pill, EmptyState } from './ui';

const KIND_GLYPH: Record<string, string> = {
  subreddit: '🔴', reddit: '🔴',
  'fb-group': '🔵', facebook: '🔵', 'fb_group': '🔵',
  discord: '💜',
  twitter: '🐦', x: '🐦',
  forum: '💬',
  hashtag: '#',
  slack: '💼',
  telegram: '✈️',
  youtube: '▶️',
};

const HEALTH_COLOR = { ok: '#10b981', warn: '#fbbf24', bad: '#f87171' } as const;

export function TribesRealPage({ tribes, habitats, projectName }: {
  tribes: TribeRow[];
  habitats: HabitatRow[];
  projectName: string;
}) {
  const [activeTribe, setActiveTribe] = useState<number | 'all'>(tribes[0]?.id ?? 'all');
  const [search, setSearch] = useState('');

  const visibleHabitats = useMemo(() => {
    let list = habitats;
    if (activeTribe !== 'all') list = list.filter((h) => h.tribeId === activeTribe);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q) || h.kind.toLowerCase().includes(q));
    }
    return list;
  }, [habitats, activeTribe, search]);

  const totalMembers = habitats.reduce((s, h) => s + (h.members || 0), 0);

  if (tribes.length === 0 && habitats.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <EmptyState
          icon="◍"
          title={`Tribes — chưa có data cho ${projectName}`}
          description={
            <>
              Project này chưa có tribe/habitat nào. Chạy <code>npm run sync-from-directus</code> để pull
              từ as.on.tc, hoặc tạo tribe đầu tiên qua UI (CRUD form sẽ ship phase tới).
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            ◍ Tribes
            <small>// {tribes.length} tribes · {habitats.length} habitats · {totalMembers.toLocaleString()} members</small>
          </h1>
          <p className="page-sub">
            Layer 1 (Habitats: subreddit, FB group, hashtag) + Layer 2 (Tribes: audience identity).
            Data sync từ <a href="https://as.on.tc/admin/content/communities" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>as.on.tc Directus communities</a>.
          </p>
        </div>
      </div>

      {/* Tribe selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="chip" data-active={activeTribe === 'all' || undefined} onClick={() => setActiveTribe('all')}>
          All habitats <span style={{ opacity: 0.6, marginLeft: 4 }}>{habitats.length}</span>
        </span>
        {tribes.map((t) => {
          const count = habitats.filter((h) => h.tribeId === t.id).length;
          return (
            <span key={t.id} className="chip" data-active={activeTribe === t.id || undefined} onClick={() => setActiveTribe(t.id)}>
              ◍ {t.name} <span style={{ opacity: 0.6, marginLeft: 4 }}>{count}</span>
            </span>
          );
        })}
        <span style={{ flex: 1 }} />
        <input
          placeholder="Search habitat name / kind…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 200 }}
        />
      </div>

      {/* Active tribe panel */}
      {activeTribe !== 'all' && (() => {
        const tribe = tribes.find((t) => t.id === activeTribe);
        if (!tribe) return null;
        return (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-head">
              <div className="panel-title"><span className="dot"></span>Tribe identity · {tribe.name}</div>
            </div>
            <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Lifecycle</div>
                <div style={{ fontSize: 13, color: 'var(--fg-0)', marginTop: 2 }}>{tribe.lifecycle}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Sentiment</div>
                <div style={{ fontSize: 13, color: tribe.sentiment > 0 ? 'var(--ok)' : tribe.sentiment < 0 ? 'var(--bad)' : 'var(--fg-1)', marginTop: 2 }}>
                  {tribe.sentiment > 0 ? '+' : ''}{tribe.sentiment}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Habitats</div>
                <div style={{ fontSize: 13, color: 'var(--fg-0)', marginTop: 2 }}>{habitats.filter((h) => h.tribeId === tribe.id).length}</div>
              </div>
              {tribe.descText && (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--fg-1)' }}>{tribe.descText}</div>
              )}
              {tribe.signal && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>Signal</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{tribe.signal}</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Habitats grid */}
      {visibleHabitats.length === 0 ? (
        <EmptyState icon="🔍" title="Không có habitat match filter" compact />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {visibleHabitats.map((h) => {
            const tribe = tribes.find((t) => t.id === h.tribeId);
            return (
              <div key={h.id} className="panel">
                <div className="panel-head" style={{ padding: '8px 12px' }}>
                  <div className="panel-title" style={{ fontSize: 12, gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{KIND_GLYPH[h.kind] || '📎'}</span>
                    {h.url ? <a href={h.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-0)', textDecoration: 'none' }}>{h.name}</a> : h.name}
                  </div>
                  <Pill color={HEALTH_COLOR[h.health as keyof typeof HEALTH_COLOR] ?? 'var(--fg-3)'} label={h.health} size="xs" />
                </div>
                <div className="panel-body" style={{ padding: '8px 12px', fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div>kind · <span style={{ color: 'var(--fg-1)' }}>{h.kind}</span></div>
                  {h.members > 0 && <div>members · <span style={{ color: 'var(--fg-1)' }}>{h.members.toLocaleString()}</span></div>}
                  <div>scrape · <span style={{ color: 'var(--fg-1)' }}>{h.scrapeFrequency}</span></div>
                  {tribe && activeTribe === 'all' && <div>tribe · <span style={{ color: 'var(--fg-1)' }}>{tribe.name}</span></div>}
                  {h.importedFrom && <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>{h.importedFrom.slice(0, 30)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
