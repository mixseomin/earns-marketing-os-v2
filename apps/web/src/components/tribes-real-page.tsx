// DB-backed Tribes view cho real projects (isDemo=false).
// Mock 5-tribe / 32-habitat design ở tribes-page.tsx vẫn dùng cho demo.

'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { TribeRow, HabitatRow, PlatformRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import { Pill, EmptyState, Spinner } from './ui';
import { resolveHabitatPlatformKey } from '@/lib/habitat-platform-map';
import {
  listBriefsForHabitat,
  type BriefForHabitat,
} from '@/lib/actions/community-briefs';
import { BriefEditModal } from './brief-edit-modal';
import { TribeFormModal } from './tribe-form-modal';
import { HabitatFormModal } from './habitat-form-modal';
import { AccountFormModal } from './accounts-vault';
import { syncHabitatPlatformsFromDirectus, updateHabitat, updateTribe } from '@/lib/actions/tribes-crud';

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

interface BriefCounts {
  byTribe: Record<number, number>;
  byHabitat: Record<number, number>;
  allHabitats: number;
  untrackedTribe: number;
}

export function TribesRealPage({ projectId, project, tribes, habitats, platforms, briefCounts, projectName }: {
  projectId: string;
  project: Project;
  tribes: TribeRow[];
  habitats: HabitatRow[];
  platforms: PlatformRow[];
  briefCounts: BriefCounts;
  projectName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeTribe, setActiveTribe] = useState<number | 'all'>(tribes[0]?.id ?? 'all');
  const [search, setSearch] = useState('');
  const [showDefunct, setShowDefunct] = useState(false);
  const [openHabitat, setOpenHabitat] = useState<HabitatRow | null>(null);
  // CRUD modal state
  const [editingTribe, setEditingTribe] = useState<TribeRow | null>(null);
  const [creatingTribe, setCreatingTribe] = useState(false);
  const [editingHabitat, setEditingHabitat] = useState<HabitatRow | null>(null);
  const [creatingHabitat, setCreatingHabitat] = useState(false);

  const activeTribes = useMemo(() => tribes.filter((t) => t.lifecycle !== 'defunct'), [tribes]);
  const defunctTribes = useMemo(() => tribes.filter((t) => t.lifecycle === 'defunct'), [tribes]);
  const defunctHabitats = useMemo(() => habitats.filter((h) => h.status === 'defunct'), [habitats]);
  // Confirm-pending IDs — 2-click pattern: first click arms, 3s timeout disarms
  const [confirmHabitat, setConfirmHabitat] = useState<number | null>(null);
  const [confirmTribe, setConfirmTribe] = useState<number | null>(null);

  const visibleHabitats = useMemo(() => {
    let list = showDefunct ? habitats : habitats.filter((h) => h.status !== 'defunct');
    if (activeTribe !== 'all') list = list.filter((h) => h.tribeId === activeTribe);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q) || h.kind.toLowerCase().includes(q));
    }
    return list;
  }, [habitats, activeTribe, search, showDefunct]);

  const quickDefunctHabitat = (h: HabitatRow) => {
    if (h.status === 'defunct') {
      // Restore: instant, no confirm needed
      startTransition(async () => { await updateHabitat(h.projectId, h.id, { status: 'target' }); router.refresh(); });
      return;
    }
    if (confirmHabitat === h.id) {
      // Second click: execute
      setConfirmHabitat(null);
      startTransition(async () => { await updateHabitat(h.projectId, h.id, { status: 'defunct' }); router.refresh(); });
    } else {
      // First click: arm confirm, auto-disarm after 3s
      setConfirmHabitat(h.id);
      setTimeout(() => setConfirmHabitat((cur) => cur === h.id ? null : cur), 3000);
    }
  };

  const quickDefunctTribe = (t: TribeRow) => {
    if (t.lifecycle === 'defunct') {
      startTransition(async () => { await updateTribe(t.projectId, t.id, { lifecycle: 'discovery' }); router.refresh(); });
      return;
    }
    if (confirmTribe === t.id) {
      setConfirmTribe(null);
      startTransition(async () => { await updateTribe(t.projectId, t.id, { lifecycle: 'defunct' }); router.refresh(); });
    } else {
      setConfirmTribe(t.id);
      setTimeout(() => setConfirmTribe((cur) => cur === t.id ? null : cur), 3000);
    }
  };

  const totalMembers = habitats.reduce((s, h) => s + (h.members || 0), 0);

  if (tribes.length === 0 && habitats.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <EmptyState
          icon="◍"
          title={`Tribes — chưa có data cho ${projectName}`}
          description="Tạo tribe đầu tiên (audience cluster), rồi add habitat (community cụ thể: subreddit, FB group, Discord)."
          action={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => setCreatingTribe(true)}>+ New tribe</button>
              <button className="btn" onClick={() => setCreatingHabitat(true)}>+ New habitat</button>
            </div>
          }
        />
        {creatingTribe && (
          <TribeFormModal projectId={projectId} tribe={null} onClose={() => setCreatingTribe(false)} />
        )}
        {creatingHabitat && (
          <HabitatFormModal projectId={projectId} habitat={null} tribes={tribes} platforms={platforms}
                            onClose={() => setCreatingHabitat(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            ◍ Tribes
            <small>// {activeTribes.length} tribes · {habitats.length - defunctHabitats.length} habitats · {totalMembers.toLocaleString()} members
              {(defunctTribes.length > 0 || defunctHabitats.length > 0) && (
                <span style={{ color: 'var(--warn)', marginLeft: 6 }}>
                  · {defunctTribes.length + defunctHabitats.length} defunct
                </span>
              )}
            </small>
          </h1>
          <p className="page-sub">
            Layer 1 (Habitats: subreddit, FB group, hashtag) + Layer 2 (Tribes: audience identity).
            Click 1 habitat để xem briefs theo account.
          </p>
        </div>
        <div className="page-actions">
          <SyncHabitatPlatformsButton />
          <button className="btn" onClick={() => setCreatingTribe(true)}>+ New tribe</button>
          <button className="btn primary" onClick={() => setCreatingHabitat(true)}>+ New habitat</button>
        </div>
      </div>

      {/* Tribe selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="chip" data-active={activeTribe === 'all' || undefined} onClick={() => setActiveTribe('all')}
              title={`${habitats.length} habitats · ${briefCounts.allHabitats} accounts có brief`}>
          All habitats <span style={{ opacity: 0.6, marginLeft: 4 }}>{habitats.length}</span>
          {briefCounts.allHabitats > 0 && (
            <span style={{ marginLeft: 4, padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 8, border: '1px solid var(--accent-line)' }}>
              👤 {briefCounts.allHabitats}
            </span>
          )}
        </span>
        {(showDefunct ? tribes : activeTribes).map((t) => {
          const habCount = habitats.filter((h) => h.tribeId === t.id && (showDefunct || h.status !== 'defunct')).length;
          const accCount = briefCounts.byTribe[t.id] ?? 0;
          const isDefunct = t.lifecycle === 'defunct';
          return (
            <span key={t.id} className="chip" data-active={activeTribe === t.id || undefined} onClick={() => setActiveTribe(t.id)}
                  title={`${habCount} habitats · ${accCount} accounts có brief${isDefunct ? ' · DEFUNCT' : ''}`}
                  style={isDefunct ? { opacity: 0.5, borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}>
              {isDefunct && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', marginRight: 3 }}>[defunct]</span>}
              ◍ {t.name} <span style={{ opacity: 0.6, marginLeft: 4 }}>{habCount}</span>
              {accCount > 0 && (
                <span style={{ marginLeft: 4, padding: '0 5px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 8, border: '1px solid var(--accent-line)' }}>
                  👤 {accCount}
                </span>
              )}
            </span>
          );
        })}
        {defunctTribes.length > 0 && !showDefunct && (
          <span className="chip" onClick={() => setShowDefunct(true)}
                style={{ color: 'var(--warn)', borderColor: 'rgba(255,180,0,.3)', opacity: 0.7, fontSize: 11 }}
                title="Show defunct tribes and habitats">
            🗃 {defunctTribes.length} defunct tribe{defunctTribes.length > 1 ? 's' : ''}
          </span>
        )}
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
            <div className="panel-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="panel-title" style={{ flex: 1 }}>
                <span className="dot"></span>Tribe identity · {tribe.name}
                {tribe.lifecycle === 'defunct' && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,180,0,.12)', color: 'var(--warn)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}>DEFUNCT</span>
                )}
              </div>
              <button className="btn ghost" onClick={() => quickDefunctTribe(tribe)}
                      title={
                        tribe.lifecycle === 'defunct' ? 'Khôi phục tribe (lifecycle → discovery)' :
                        confirmTribe === tribe.id ? 'Click lần nữa để xác nhận defunct' :
                        'Đánh dấu defunct — tribe không còn tồn tại. Click 2 lần để xác nhận.'
                      }
                      style={{
                        fontSize: 11, padding: '4px 8px',
                        color: confirmTribe === tribe.id ? '#0d1117' : tribe.lifecycle === 'defunct' ? 'var(--accent)' : 'var(--warn)',
                        background: confirmTribe === tribe.id ? 'var(--warn)' : undefined,
                        animation: confirmTribe === tribe.id ? 'pulseDanger 1s ease-in-out infinite' : undefined,
                      }}>
                {tribe.lifecycle === 'defunct' ? '↺ Restore' : confirmTribe === tribe.id ? '⚠ Confirm defunct' : '🗃 Defunct'}
              </button>
              <button className="btn" onClick={() => setEditingTribe(tribe)} style={{ fontSize: 11, padding: '4px 10px' }}>✎ Edit tribe</button>
            </div>
            <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Accounts có brief</div>
                <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>👤 {briefCounts.byTribe[tribe.id] ?? 0}</div>
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
              <div key={h.id} className="panel"
                   onClick={() => setOpenHabitat(h)}
                   style={{ cursor: 'pointer', opacity: h.status === 'defunct' ? 0.55 : 1, borderColor: h.status === 'defunct' ? 'var(--warn)' : undefined }}>
                <div className="panel-head" style={{ padding: '8px 12px' }}>
                  <div className="panel-title" style={{ fontSize: 12, gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{KIND_GLYPH[h.kind] || '📎'}</span>
                    {h.status === 'defunct' && (
                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,180,0,.12)', color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>defunct</span>
                    )}
                    {h.url
                      ? <a href={h.url} target="_blank" rel="noopener noreferrer"
                           onClick={(e) => e.stopPropagation()}
                           style={{ color: h.status === 'defunct' ? 'var(--fg-3)' : 'var(--fg-0)', textDecoration: h.status === 'defunct' ? 'line-through' : 'none' }}>{h.name}</a>
                      : <span style={{ textDecoration: h.status === 'defunct' ? 'line-through' : 'none' }}>{h.name}</span>}
                  </div>
                  {(briefCounts.byHabitat[h.id] ?? 0) > 0 && (
                    <span title={`${briefCounts.byHabitat[h.id]} accounts có brief cho habitat này`}
                          style={{ padding: '0 6px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 8, border: '1px solid var(--accent-line)' }}>
                      👤 {briefCounts.byHabitat[h.id]}
                    </span>
                  )}
                  {h.language && (
                    <Pill color="var(--fg-2)" label={h.language} size="xs" tone="ghost" uppercase={false} mono title={`Language: ${h.language}`} />
                  )}
                  {h.modStrictness && (
                    <Pill color={h.modStrictness === 'high' ? 'var(--bad)' : h.modStrictness === 'medium' ? 'var(--warn)' : 'var(--ok)'}
                          label={`mod ${h.modStrictness}`} size="xs" tone="soft"
                          title={`Mod strictness: ${h.modStrictness}`} />
                  )}
                  <Pill color={HEALTH_COLOR[h.health as keyof typeof HEALTH_COLOR] ?? 'var(--fg-3)'} label={h.health} size="xs" />
                  <button type="button" className="btn ghost"
                          title={
                            h.status === 'defunct' ? 'Khôi phục habitat (status → target)' :
                            confirmHabitat === h.id ? 'Click lần nữa để xác nhận defunct' :
                            'Đánh dấu defunct — community không còn tồn tại. Click 2 lần.'
                          }
                          onClick={(e) => { e.stopPropagation(); quickDefunctHabitat(h); }}
                          style={{
                            fontSize: 10, padding: '2px 6px',
                            color: confirmHabitat === h.id ? '#0d1117' : h.status === 'defunct' ? 'var(--accent)' : 'var(--warn)',
                            background: confirmHabitat === h.id ? 'var(--warn)' : undefined,
                            animation: confirmHabitat === h.id ? 'pulseDanger 1s ease-in-out infinite' : undefined,
                          }}>
                    {h.status === 'defunct' ? '↺' : confirmHabitat === h.id ? '⚠' : '🗃'}
                  </button>
                  <button type="button" className="btn ghost" title="Edit habitat"
                          onClick={(e) => { e.stopPropagation(); setEditingHabitat(h); }}
                          style={{ fontSize: 11, padding: '2px 6px', color: 'var(--fg-3)' }}>✎</button>
                </div>
                <div className="panel-body" style={{ padding: '8px 12px', fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(() => {
                    const resolved = resolveHabitatPlatformKey({ kind: h.kind, platformKey: h.platformKey });
                    const platformLabel = resolved ? (platforms.find((p) => p.key === resolved)?.label ?? resolved) : null;
                    if (resolved) {
                      return (
                        <div>platform · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{platformLabel}</span>
                          {!h.platformKey && (
                            <span title={`Suy từ kind=${h.kind}. ✎ edit để lock cứng.`}
                                  style={{ marginLeft: 4, fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'var(--bg-3)', color: 'var(--fg-3)' }}>
                              from kind
                            </span>
                          )}
                        </div>
                      );
                    }
                    return <div style={{ color: 'var(--warn)' }}>platform · <span style={{ color: 'var(--warn)' }}>chưa link — ✎ edit để chọn</span></div>;
                  })()}
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

      {!showDefunct && defunctHabitats.length > 0 && (
        <button onClick={() => setShowDefunct(true)}
                style={{ marginTop: 8, width: '100%', padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
                         background: 'transparent', border: '1px dashed rgba(255,180,0,.3)',
                         color: 'var(--warn)', borderRadius: 6, cursor: 'pointer', textAlign: 'center' }}>
          🗃 Show {defunctHabitats.length} defunct habitat{defunctHabitats.length > 1 ? 's' : ''}
        </button>
      )}
      {showDefunct && (
        <button onClick={() => setShowDefunct(false)}
                style={{ marginTop: 8, width: '100%', padding: '6px 12px', fontSize: 11, fontFamily: 'var(--font-mono)',
                         background: 'transparent', border: '1px dashed var(--line)',
                         color: 'var(--fg-3)', borderRadius: 6, cursor: 'pointer', textAlign: 'center' }}>
          Hide defunct
        </button>
      )}

      {openHabitat && (
        <HabitatBriefsDrawer
          projectId={projectId}
          project={project}
          platforms={platforms}
          habitat={openHabitat}
          onClose={() => setOpenHabitat(null)}
        />
      )}

      {(editingTribe || creatingTribe) && (
        <TribeFormModal
          projectId={projectId}
          tribe={editingTribe}
          onClose={() => { setEditingTribe(null); setCreatingTribe(false); }}
        />
      )}

      {(editingHabitat || creatingHabitat) && (
        <HabitatFormModal
          projectId={projectId}
          habitat={editingHabitat}
          tribes={tribes}
          platforms={platforms}
          presetTribeId={creatingHabitat && activeTribe !== 'all' ? activeTribe : null}
          onClose={() => { setEditingHabitat(null); setCreatingHabitat(false); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// HabitatBriefsDrawer — modal showing all (account, brief) for one
// habitat. Add/edit/remove briefs from here.
// ──────────────────────────────────────────────────────────────────
function HabitatBriefsDrawer({
  projectId, project, platforms, habitat, onClose,
}: {
  projectId: string;
  project: Project;
  platforms: PlatformRow[];
  habitat: HabitatRow;
  onClose: () => void;
}) {
  const [briefs, setBriefs] = useState<BriefForHabitat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BriefForHabitat | null>(null);
  const [creatingAccountId, setCreatingAccountId] = useState<number | null>(null);
  const [creatingAccountLabel, setCreatingAccountLabel] = useState('');
  const [bumpKey, setBumpKey] = useState(0);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBriefsForHabitat(habitat.id).then((rows) => {
      if (!cancelled) { setBriefs(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [habitat.id, bumpKey]);

  const refresh = () => setBumpKey((n) => n + 1);

  const presetPlatformKey = useMemo(
    () => resolveHabitatPlatformKey({ kind: habitat.kind, platformKey: habitat.platformKey }),
    [habitat.kind, habitat.platformKey],
  );

  const habitatLabel = `${habitat.name} · ${habitat.kind}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(820px, 100%)', maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">
              {KIND_GLYPH[habitat.kind] || '📎'} {habitat.kind} · habitat #{habitat.id}
            </div>
            <h2 style={{ fontSize: 15 }}>{habitat.name}</h2>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap', fontFamily: 'var(--font-mono)' }}>
              {habitat.members > 0 && <span>👥 {habitat.members.toLocaleString()}</span>}
              <span>scrape: {habitat.scrapeFrequency}</span>
              {habitat.url && <a href={habitat.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>↗ open</a>}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600 }}>
              🎯 Phương án tiếp cận theo account
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {briefs.length} brief{briefs.length === 1 ? '' : 's'}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn primary" type="button"
                    onClick={() => setShowAccountModal(true)}
                    title={presetPlatformKey
                      ? `Mở Account modal (platform pre-selected: ${presetPlatformKey})`
                      : 'Mở Account modal'}
                    style={{ fontSize: 11, padding: '4px 10px' }}>+ Add account</button>
          </div>

          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)' }}>
              <Spinner size="sm" /> <span style={{ marginLeft: 6, fontSize: 11 }}>Loading…</span>
            </div>
          ) : briefs.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--fg-3)', borderRadius: 6, background: 'var(--bg-2)', border: '1px dashed var(--line)', textAlign: 'center' }}>
              Chưa có account nào có brief cho community này.<br />
              Click <strong>+ Add account</strong> để mở account modal{presetPlatformKey ? ` (platform ${presetPlatformKey} pre-selected)` : ''}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {briefs.map((b) => (
                <div key={b.id}
                     onClick={() => setEditing(b)}
                     style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, cursor: 'pointer', alignItems: 'center' }}
                     title="Click để edit">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>
                        @{b.accountHandle || 'no-handle'}
                      </span>
                      <Pill color="var(--fg-3)" label={b.platformLabel} size="xs" tone="ghost" />
                      <Pill color={b.accountStatus === 'active' ? 'var(--ok)' : 'var(--fg-3)'}
                            label={b.accountStatus} size="xs" tone="soft" />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.approachMd ? b.approachMd.split('\n')[0] : <em style={{ color: 'var(--fg-4)' }}>chưa viết approach</em>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {b.cadence && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title="Cadence">⏱ {b.cadence}</span>}
                    {b.tone && <span style={{ fontSize: 10, color: 'var(--fg-3)' }} title={`Tone: ${b.tone}`}>🎵</span>}
                    {b.templates.length > 0 && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title={`${b.templates.length} templates`}>📝 {b.templates.length}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAccountModal && (
        <AccountFormModal
          account={null}
          project={project}
          projectId={projectId}
          platforms={platforms}
          presetPlatformKey={presetPlatformKey ?? undefined}
          pickContextHabitatId={habitat.id}
          onClose={() => setShowAccountModal(false)}
          onCreated={(newAccountId) => {
            // Auto-pick the just-created (or just-picked) account → BriefEditModal opens next
            setCreatingAccountId(newAccountId);
            setCreatingAccountLabel(`@picked · ${presetPlatformKey ?? 'account'}`);
          }}
        />
      )}

      {editing && (
        <BriefEditModal
          projectId={projectId}
          accountId={editing.accountId}
          habitatId={habitat.id}
          accountLabel={`@${editing.accountHandle || 'no-handle'} · ${editing.platformLabel}`}
          habitatLabel={habitatLabel}
          existing={editing}
          onClose={() => { setEditing(null); refresh(); }}
        />
      )}

      {creatingAccountId != null && (
        <BriefEditModal
          projectId={projectId}
          accountId={creatingAccountId}
          habitatId={habitat.id}
          accountLabel={creatingAccountLabel}
          habitatLabel={habitatLabel}
          existing={null}
          onClose={() => { setCreatingAccountId(null); refresh(); }}
        />
      )}
    </div>
  );
}


// Back-fill habitats.platform_key from Directus communities.platform for
// imported rows that lost the platform link (pre-platform_key column data).
function SyncHabitatPlatformsButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ linked: number; skipped: number; missing: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setBusy(true); setError(null); setResult(null);
    startTransition(async () => {
      const res = await syncHabitatPlatformsFromDirectus();
      setBusy(false);
      if (!res.ok) { setError(res.error ?? "sync failed"); return; }
      setResult({ linked: res.linked, skipped: res.skipped, missing: res.missing });
      setTimeout(() => setResult(null), 8000);
      router.refresh();
    });
  };

  return (
    <button type="button" className="btn"
            onClick={handleClick} disabled={busy}
            title="Back-fill platform_key cho habitats imported từ Directus communities (đọc community.platform string → match MOS2 platforms)."
            style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {busy
        ? <><Spinner size="xs" /> Linking</>
        : result
          ? <span style={{ color: "var(--ok)" }} title={result.missing.length ? `Missing platforms: ${result.missing.join(", ")}` : undefined}>
              ✓ +{result.linked} linked{result.missing.length ? ` (${result.missing.length} missing)` : ""}
            </span>
          : error
            ? <span style={{ color: "var(--bad)" }} title={error}>⚠ Sync failed</span>
            : <>↓ Link habitat platforms</>}
    </button>
  );
}


