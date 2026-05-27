// DB-backed Tribes view cho real projects (isDemo=false).
// Mock 5-tribe / 32-habitat design ở tribes-page.tsx vẫn dùng cho demo.

'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { TribeRow, HabitatRow, PlatformRow } from '@/lib/data';
import type { Project } from '@/lib/mock/types';
import { Pill, EmptyState, Spinner, Segmented, SiteFavicon } from './ui';
import { resolveHabitatPlatformKey } from '@/lib/habitat-platform-map';
import { useModalParam } from '@/lib/use-modal-param';
import {
  listBriefsForHabitat,
  type BriefForHabitat,
  type BriefTreeTribe,
} from '@/lib/actions/community-briefs';
import {
  type Phase, type PhaseEntry, PHASE_LABEL, PHASE_COLOR, PHASE_DESCRIPTION,
  PLANNED_PHASES, archetypeFor, defaultPhasePlanFor,
} from '@/lib/phase-plan';
import { BriefEditModal } from './brief-edit-modal';
import { TribeFormModal } from './tribe-form-modal';
import { AITribesModal } from './ai-tribes-modal';
import { AIHabitatTribesModal } from './ai-habitat-tribes-modal';
import { ScheduleEditModal } from './schedule-edit-modal';
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

// Shallow URL sync cho view-mode (grid|tree). replaceState → F5/share giữ
// nguyên view, không RSC roundtrip. Local state là source of truth (UI tức
// thì); URL chỉ là side-effect. Cùng convention với modal (use-modal-param).
function useUrlParam(key: string, def: string): [string, (v: string) => void] {
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(() => params.get(key) ?? def);
  const set = (v: string) => {
    setValue(v);
    if (typeof window === 'undefined') return;
    const next = new URLSearchParams(window.location.search);
    if (!v || v === def) next.delete(key); else next.set(key, v);
    const qs = next.toString();
    window.history.replaceState({}, '', qs ? `${pathname}?${qs}` : pathname);
  };
  return [value, set];
}

interface BriefCounts {
  byTribe: Record<number, number>;
  byHabitat: Record<number, number>;
  allHabitats: number;
  untrackedTribe: number;
}

export function TribesRealPage({ projectId, project, tribes, habitats, platforms, briefCounts, habitatPhases, briefTree, projectName }: {
  projectId: string;
  project: Project;
  tribes: TribeRow[];
  habitats: HabitatRow[];
  platforms: PlatformRow[];
  briefCounts: BriefCounts;
  habitatPhases: Record<number, Phase>;
  briefTree: BriefTreeTribe[];
  projectName: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useUrlParam('view', 'grid'); // grid | tree
  const [activeTribe, setActiveTribe] = useState<number | 'all'>(tribes[0]?.id ?? 'all');
  const [search, setSearch] = useState('');
  const [showDefunct, setShowDefunct] = useState(false);
  // URL-synced modal state (DEFAULT pattern, xem lib/use-modal-param.ts).
  // F5 / share link → mở lại đúng modal. Không dùng useState cho open/close.
  //   ?m=habitat-briefs&mId=<habitatId>  → HabitatBriefsDrawer
  //   ?m=tribe-new                        → tạo tribe
  //   ?m=tribe-edit&mId=<tribeId>         → sửa tribe
  //   ?m=habitat-new                      → tạo habitat
  //   ?m=habitat-edit&mId=<habitatId>     → sửa habitat
  const modal = useModalParam('m');
  const openHabitat = modal.is('habitat-briefs')
    ? habitats.find((h) => h.id === modal.numId) ?? null : null;
  const editingTribe = modal.is('tribe-edit')
    ? tribes.find((t) => t.id === modal.numId) ?? null : null;
  const creatingTribe = modal.is('tribe-new');
  const editingHabitat = modal.is('habitat-edit')
    ? habitats.find((h) => h.id === modal.numId) ?? null : null;
  const creatingHabitat = modal.is('habitat-new');

  const activeTribes = useMemo(() => tribes.filter((t) => t.lifecycle !== 'defunct'), [tribes]);
  const defunctTribes = useMemo(() => tribes.filter((t) => t.lifecycle === 'defunct'), [tribes]);
  const defunctHabitats = useMemo(() => habitats.filter((h) => h.status === 'defunct'), [habitats]);
  // Confirm-pending IDs — 2-click pattern: first click arms, 3s timeout disarms
  const [confirmHabitat, setConfirmHabitat] = useState<number | null>(null);
  const [confirmTribe, setConfirmTribe] = useState<number | null>(null);

  const visibleHabitats = useMemo(() => {
    let list = showDefunct ? habitats : habitats.filter((h) => h.status !== 'defunct');
    if (activeTribe !== 'all') list = list.filter((h) =>
      (h.tribeIds.length ? h.tribeIds.includes(activeTribe) : h.tribeId === activeTribe));
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
              <button className="btn primary" onClick={() => modal.open("ai-tribes")}>✨ AI gợi ý Tribes</button>
              <button className="btn" onClick={() => modal.open("tribe-new")}>+ New tribe</button>
              <button className="btn" onClick={() => modal.open("habitat-new")}>+ New habitat</button>
            </div>
          }
        />
        {modal.is('ai-tribes') && (
          <AITribesModal projectId={projectId} existingNames={tribes.map((t) => t.name)}
                         onClose={() => modal.close()} onCreated={() => router.refresh()} />
        )}
        {creatingTribe && (
          <TribeFormModal projectId={projectId} tribe={null} onClose={() => modal.close()} />
        )}
        {creatingHabitat && (
          <HabitatFormModal projectId={projectId} habitat={null} tribes={tribes} platforms={platforms}
                            onClose={() => modal.close()} />
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
        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Segmented
            options={[
              { value: 'grid', label: '▦ Lưới', title: 'Lưới habitat (mặc định)' },
              { value: 'tree', label: '⌖ Cây', title: 'Cây phân cấp Tribe → Habitat → Account-brief' },
            ]}
            value={view}
            onChange={setView}
          />
          <SyncHabitatPlatformsButton />
          <button className="btn" onClick={() => modal.open("ai-tribes")}
                  title="AI suy nhóm khán giả từ context dự án, review rồi tạo hàng loạt">✨ AI Tribes</button>
          <button className="btn" onClick={() => modal.open("ai-habitat-tribes")}
                  title="AI phân loại habitat vào tribe phù hợp, review rồi gán hàng loạt">✨ AI gán tribe</button>
          <button className="btn" onClick={() => modal.open("tribe-new")}>+ New tribe</button>
          <button className="btn primary" onClick={() => modal.open("habitat-new")}>+ New habitat</button>
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
          const habCount = habitats.filter((h) => (h.tribeIds.length ? h.tribeIds.includes(t.id) : h.tribeId === t.id) && (showDefunct || h.status !== 'defunct')).length;
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

      {view === 'tree' ? (
        <TribeHierarchyTree
          briefTree={briefTree}
          activeTribe={activeTribe}
          search={search}
          onOpenHabitat={(hid) => modal.open('habitat-briefs', hid)}
          onOpenSchedule={(bid) => modal.open('schedule', bid)}
        />
      ) : (
      <>

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
              <button className="btn" onClick={() => modal.open("tribe-edit", tribe.id)} style={{ fontSize: 11, padding: '4px 10px' }}>✎ Edit tribe</button>
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
                   onClick={() => modal.open("habitat-briefs", h.id)}
                   style={{ cursor: 'pointer', opacity: h.status === 'defunct' ? 0.55 : 1, borderColor: h.status === 'defunct' ? 'var(--warn)' : undefined }}>
                <div className="panel-head" style={{ padding: '8px 12px' }}>
                  <div className="panel-title" style={{ fontSize: 12, gap: 6 }}>
                    <SiteFavicon url={h.url} kind={h.kind} glyph={KIND_GLYPH[h.kind] || '📎'} size={16} title={h.kind} />
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
                          onClick={(e) => { e.stopPropagation(); modal.open("habitat-edit", h.id); }}
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
                  {habitatPhases[h.id] && (() => {
                    const ph = habitatPhases[h.id]!;
                    return (
                      <div title={`${PHASE_LABEL[ph]} - ${PHASE_DESCRIPTION[ph]}`}>
                        phase ·{' '}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '0 6px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                          background: PHASE_COLOR[ph] + '22', color: PHASE_COLOR[ph],
                          border: `1px solid ${PHASE_COLOR[ph]}66`, borderRadius: 3,
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: 3, background: PHASE_COLOR[ph] }} />
                          {PHASE_LABEL[ph]}
                        </span>
                      </div>
                    );
                  })()}
                  {tribe && activeTribe === 'all' && (
                    <div>tribe · <span style={{ color: 'var(--fg-1)' }}>{tribe.name}</span>
                      {h.tribeIds.length > 1 && (
                        <span title={`Thuộc ${h.tribeIds.length} tribe`}
                              style={{ marginLeft: 4, fontSize: 9, padding: '0 4px', borderRadius: 3,
                                       background: 'var(--bg-3)', color: 'var(--fg-3)' }}>
                          +{h.tribeIds.length - 1}
                        </span>
                      )}
                    </div>
                  )}
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

      </>
      )}

      {openHabitat && (
        <HabitatBriefsDrawer
          projectId={projectId}
          project={project}
          platforms={platforms}
          habitat={openHabitat}
          onClose={() => modal.close()}
        />
      )}

      {modal.is('ai-tribes') && (
        <AITribesModal
          projectId={projectId}
          existingNames={tribes.map((t) => t.name)}
          onClose={() => modal.close()}
          onCreated={() => router.refresh()}
        />
      )}

      {modal.is('ai-habitat-tribes') && (
        <AIHabitatTribesModal
          projectId={projectId}
          tribes={tribes}
          onClose={() => modal.close()}
          onAssigned={() => router.refresh()}
        />
      )}

      {modal.is('schedule') && modal.numId != null && (
        <ScheduleEditModal
          projectId={projectId}
          briefId={modal.numId}
          onClose={() => modal.close()}
          onSaved={() => { modal.close(); router.refresh(); }}
        />
      )}

      {(editingTribe || creatingTribe) && (
        <TribeFormModal
          projectId={projectId}
          tribe={editingTribe}
          onClose={() => modal.close()}
        />
      )}

      {(editingHabitat || creatingHabitat) && (
        <HabitatFormModal
          projectId={projectId}
          habitat={editingHabitat}
          tribes={tribes}
          platforms={platforms}
          presetTribeId={creatingHabitat && activeTribe !== 'all' ? activeTribe : null}
          onClose={() => modal.close()}
          onOpenBrief={(briefId) => {
            // Deep-link sang Seeding page với Brief modal mở. Tribes page
            // không host BriefEditModal trực tiếp vì cần load BriefRow ctx
            // (accountId/habitatId/etc) — Seeding page có sẵn loader.
            window.location.assign(`/p/${projectId}/seeding?m=brief&mId=${briefId}`);
          }}
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
  const [bumpKey, setBumpKey] = useState(0);

  // Nested modal trong drawer dùng key 'sub' (key 'm' đã do parent giữ cho
  // drawer này). F5 với ?m=habitat-briefs&mId=12&sub=brief&subId=7 → mở lại
  // drawer habitat 12 + BriefEditModal account 7.
  //   ?sub=account                 → AccountFormModal (+ Add account)
  //   ?sub=brief&subId=<accountId> → BriefEditModal sửa brief account đó
  //   ?sub=brief-new&subId=<accId> → BriefEditModal cho account vừa tạo
  const sub = useModalParam('sub');

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

  // Derived modal state từ URL (không useState cho open/close).
  const showAccountModal = sub.is('account');
  const editing = sub.is('brief')
    ? briefs.find((b) => b.accountId === sub.numId) ?? null : null;
  const creatingAccountId = sub.is('brief-new') ? sub.numId : null;
  const creatingAccountLabel = `@picked · ${presetPlatformKey ?? 'account'}`;

  // Đóng drawer = clear cả sub modal lồng bên trong (tránh ?sub= mồ côi).
  const closeDrawer = () => { sub.close(); onClose(); };

  const habitatLabel = `${habitat.name} · ${habitat.kind}`;

  return (
    <div className="modal-backdrop" onClick={closeDrawer}>
      <div className="modal" style={{ width: 'min(820px, 100%)', maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <SiteFavicon url={habitat.url} kind={habitat.kind} glyph={KIND_GLYPH[habitat.kind] || '📎'} size={15} title={habitat.kind} />
              {habitat.kind} · habitat #{habitat.id}
            </div>
            <h2 style={{ fontSize: 15 }}>{habitat.name}</h2>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap', fontFamily: 'var(--font-mono)' }}>
              {habitat.members > 0 && <span>👥 {habitat.members.toLocaleString()}</span>}
              <span>scrape: {habitat.scrapeFrequency}</span>
              {habitat.url && <a href={habitat.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>↗ open</a>}
            </div>
          </div>
          <button className="btn ghost" onClick={closeDrawer}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Default phase strategy for this habitat archetype - reference
              card shown REGARDLESS of brief count. Helps user understand the
              recommended approach for the community type before customizing. */}
          <DefaultStrategyPreview habitat={habitat} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600 }}>
              🎯 Phương án tiếp cận theo account
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {briefs.length} brief{briefs.length === 1 ? '' : 's'}
            </span>
            <span style={{ flex: 1 }} />
            <button className="btn primary" type="button"
                    onClick={() => sub.open("account")}
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
                     onClick={() => sub.open("brief", b.accountId)}
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
                      <span title={`Phase: ${PHASE_LABEL[b.currentPhase]} - ${PHASE_DESCRIPTION[b.currentPhase]}`}
                            style={{
                              padding: '0 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              background: PHASE_COLOR[b.currentPhase] + '22',
                              color: PHASE_COLOR[b.currentPhase],
                              border: `1px solid ${PHASE_COLOR[b.currentPhase]}66`,
                              borderRadius: 3, textTransform: 'uppercase',
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}>
                        <span style={{ width: 4, height: 4, borderRadius: 2, background: PHASE_COLOR[b.currentPhase] }} />
                        {PHASE_LABEL[b.currentPhase]}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.approachMd ? b.approachMd.split('\n')[0] : <em style={{ color: 'var(--fg-4)' }}>chưa viết approach</em>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {b.cadence && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }} title="Tần suất">⏱ {b.cadence}</span>}
                    {b.tone && <span style={{ fontSize: 10, color: 'var(--fg-3)' }} title={`Giọng: ${b.tone}`}>🎵</span>}
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
          onClose={() => sub.close()}
          onCreated={(newAccountId) => {
            // Auto-pick the just-created (or just-picked) account → BriefEditModal
            // opens next (?sub=brief-new&subId=<id>) — F5 vẫn giữ flow này.
            sub.open('brief-new', newAccountId);
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
          habitatUrl={habitat.url}
          existing={editing}
          onClose={() => { sub.close(); refresh(); }}
        />
      )}

      {creatingAccountId != null && (
        <BriefEditModal
          projectId={projectId}
          accountId={creatingAccountId}
          habitatId={habitat.id}
          accountLabel={creatingAccountLabel}
          habitatLabel={habitatLabel}
          habitatUrl={habitat.url}
          existing={null}
          onClose={() => { sub.close(); refresh(); }}
        />
      )}
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────
// DefaultStrategyPreview - 5 mini phase cards showing the recommended
// approach for this habitat's archetype. Shown in HabitatBriefsDrawer
// REGARDLESS of how many briefs exist - acts as reference for the
// community type's playbook. User can expand each card to read full
// goal/do/dont/cadence; click an entry to copy into clipboard.
// ──────────────────────────────────────────────────────────────────
function DefaultStrategyPreview({ habitat }: { habitat: HabitatRow }) {
  const [open, setOpen] = useState<Phase | null>(null);
  const archetype = useMemo(() => archetypeFor({
    kind: habitat.kind,
    modStrictness: habitat.modStrictness,
    language: habitat.language,
    members: habitat.members,
  }), [habitat.kind, habitat.modStrictness, habitat.language, habitat.members]);
  const plan = useMemo(() => defaultPhasePlanFor({
    kind: habitat.kind,
    modStrictness: habitat.modStrictness,
    language: habitat.language,
    members: habitat.members,
  }), [habitat.kind, habitat.modStrictness, habitat.language, habitat.members]);

  const openEntry = open ? plan.find((p) => p.phase === open) : null;

  return (
    <div style={{
      padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600 }}>
          📚 Chiến lược mặc định
        </span>
        <span style={{
          padding: '1px 6px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
          background: 'var(--accent-soft)', color: 'var(--accent)',
          border: '1px solid var(--accent-line)', borderRadius: 3, textTransform: 'uppercase',
        }}>archetype: {archetype}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          click 1 phase để xem chi tiết
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {PLANNED_PHASES.map((p) => {
          const entry = plan.find((e) => e.phase === p);
          const active = open === p;
          return (
            <button key={p} type="button" onClick={() => setOpen(active ? null : p)}
                    title={entry?.goal}
                    style={{
                      padding: '6px 6px', cursor: 'pointer',
                      background: active ? PHASE_COLOR[p] + '22' : 'var(--bg-1)',
                      color: PHASE_COLOR[p],
                      border: `1px solid ${active ? PHASE_COLOR[p] : 'var(--line)'}`,
                      borderRadius: 4, textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
                    }}>
              <div style={{
                fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: PHASE_COLOR[p] }} />
                {PHASE_LABEL[p]}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ~{entry?.estimatedPosts ?? '?'} posts
              </div>
              <div style={{
                fontSize: 10, color: 'var(--fg-2)', fontFamily: 'var(--font-sans)',
                lineHeight: 1.3, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {entry?.cadence}
              </div>
            </button>
          );
        })}
      </div>

      {openEntry && (
        <div style={{
          padding: 10, background: 'var(--bg-1)',
          border: `1px solid ${PHASE_COLOR[openEntry.phase]}66`, borderRadius: 5,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>
            <strong style={{ color: PHASE_COLOR[openEntry.phase] }}>{PHASE_LABEL[openEntry.phase]}</strong>
            {' · '}<span style={{ color: 'var(--fg-2)' }}>{openEntry.goal}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>Trigger bắt đầu</div>
              <div style={{ color: 'var(--fg-1)' }}>{openEntry.startTrigger}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>Trigger kết thúc</div>
              <div style={{ color: 'var(--fg-1)' }}>{openEntry.endTrigger}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>Tần suất</div>
              <div style={{ color: 'var(--fg-1)' }}>{openEntry.cadence}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>Giọng</div>
              <div style={{ color: 'var(--fg-1)' }}>{openEntry.tone}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ok)', textTransform: 'uppercase', marginBottom: 2 }}>✅ NÊN</div>
              <pre style={{ margin: 0, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{openEntry.doMd}</pre>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--bad)', textTransform: 'uppercase', marginBottom: 2 }}>🚫 KHÔNG</div>
              <pre style={{ margin: 0, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{openEntry.dontMd}</pre>
            </div>
          </div>
        </div>
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

// ──────────────────────────────────────────────────────────────────
// TribeHierarchyTree — view-mode 'tree'. Cây phân cấp
//   ◍ Tribe  →  # Habitat [phase] 👤N  →  @account [cur→next] 📝posts
// Mặc định expand hết để F5 thấy toàn cảnh; có nút gập/mở tất cả.
// Click habitat / account → mở HabitatBriefsDrawer (URL-synced sẵn).
// ──────────────────────────────────────────────────────────────────
const PHASE_ORDER: Record<string, number> = { 'warm-up': 0, value: 1, bridge: 2, seed: 3, direct: 4 };

function PhaseChip({ phase, small }: { phase: Phase; small?: boolean }) {
  return (
    <span title={`${PHASE_LABEL[phase]} — ${PHASE_DESCRIPTION[phase]}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: small ? '0 5px' : '0 6px',
            fontSize: small ? 9 : 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
            background: PHASE_COLOR[phase] + '22', color: PHASE_COLOR[phase],
            border: `1px solid ${PHASE_COLOR[phase]}66`, borderRadius: 3,
            textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>
      <span style={{ width: 4, height: 4, borderRadius: 2, background: PHASE_COLOR[phase] }} />
      {PHASE_LABEL[phase]}
    </span>
  );
}

const SEED_STATUS_META: Record<string, { label: string; color: string }> = {
  overdue: { label: 'quá hạn', color: 'var(--bad)' },
  due: { label: 'đến hạn', color: 'var(--warn)' },
  upcoming: { label: 'lịch', color: 'var(--fg-3)' },
  'off-phase': { label: 'ngoài phase', color: 'var(--fg-4)' },
  paused: { label: 'tạm dừng', color: 'var(--fg-4)' },
};

function TribeHierarchyTree({
  briefTree, activeTribe, search, onOpenHabitat, onOpenSchedule,
}: {
  briefTree: BriefTreeTribe[];
  activeTribe: number | 'all';
  search: string;
  onOpenHabitat: (habitatId: number) => void;
  onOpenSchedule: (briefId: number) => void;
}) {
  // collapsed keys: `t:<id|none>` cho tribe, `h:<id>` cho habitat.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });

  const q = search.trim().toLowerCase();
  const data = useMemo(() => {
    return briefTree
      .filter((t) => activeTribe === 'all' || t.id === activeTribe)
      .map((t) => {
        const habitats = t.habitats
          .map((h) => {
            if (!q) return h;
            const hitH = h.name.toLowerCase().includes(q) || h.kind.toLowerCase().includes(q);
            if (hitH) return h;
            const accts = h.accounts.filter((a) =>
              a.handle.toLowerCase().includes(q) || a.platformLabel.toLowerCase().includes(q));
            return accts.length ? { ...h, accounts: accts } : null;
          })
          .filter((h): h is BriefTreeTribe['habitats'][number] => h != null);
        return { ...t, habitats };
      })
      .filter((t) => t.habitats.length > 0);
  }, [briefTree, activeTribe, q]);

  const allKeys = useMemo(() => {
    const ks: string[] = [];
    for (const t of data) {
      ks.push(`t:${t.id ?? 'none'}`);
      for (const h of t.habitats) ks.push(`h:${h.id}`);
    }
    return ks;
  }, [data]);
  const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsed.has(k));

  if (data.length === 0) {
    return <EmptyState icon="⌖" title="Không có tribe/habitat match filter" compact />;
  }

  const totalAcc = data.reduce((s, t) => s + t.habitats.reduce((x, h) => x + h.accounts.length, 0), 0);

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div className="panel-head" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <span className="panel-title" style={{ flex: 1, fontSize: 12 }}>
          <span className="dot" />⌖ Cây phân cấp
          <small style={{ marginLeft: 6, color: 'var(--fg-3)' }}>
            // {data.length} tribe · {data.reduce((s, t) => s + t.habitats.length, 0)} habitat · 👤 {totalAcc} brief
          </small>
        </span>
        <button type="button" className="btn ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allKeys))}
                title={allCollapsed ? 'Mở tất cả' : 'Gập tất cả'}>
          {allCollapsed ? '⊞ Mở tất cả' : '⊟ Gập tất cả'}
        </button>
      </div>

      <div style={{ padding: '6px 4px 10px' }}>
        {data.map((t) => {
          const tKey = `t:${t.id ?? 'none'}`;
          const tCollapsed = collapsed.has(tKey);
          const accCount = t.habitats.reduce((s, h) => s + h.accounts.length, 0);
          const tDefunct = t.lifecycle === 'defunct';
          return (
            <div key={tKey} style={{ marginBottom: 2 }}>
              {/* Tribe row */}
              <div onClick={() => toggle(tKey)}
                   style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px',
                            cursor: 'pointer', borderRadius: 5, opacity: tDefunct ? 0.55 : 1,
                            background: 'var(--bg-2)' }}>
                <span style={{ width: 12, color: 'var(--fg-3)', fontSize: 10 }}>{tCollapsed ? '▸' : '▾'}</span>
                <span style={{ fontSize: 13 }}>◍</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{t.name}</span>
                {tDefunct && (
                  <span style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(255,180,0,.12)', color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>defunct</span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  {t.habitats.length} hab · 👤 {accCount}
                </span>
              </div>

              {!tCollapsed && (
                <div style={{ marginLeft: 14, borderLeft: '1px solid var(--line)', paddingLeft: 8, marginTop: 2 }}>
                  {t.habitats.map((h) => {
                    const hKey = `h:${h.id}`;
                    const hCollapsed = collapsed.has(hKey);
                    const hDefunct = h.status === 'defunct';
                    // aggregate phase = lowest (most cautious) trong các account
                    const first = h.accounts[0];
                    const aggPhase = first
                      ? h.accounts.reduce<Phase>((min, a) =>
                          (PHASE_ORDER[a.currentPhase] ?? 99) < (PHASE_ORDER[min] ?? 99) ? a.currentPhase : min,
                          first.currentPhase)
                      : null;
                    return (
                      <div key={hKey} style={{ marginTop: 3 }}>
                        {/* Habitat row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                                      borderRadius: 5, opacity: hDefunct ? 0.55 : 1 }}>
                          <span onClick={() => toggle(hKey)}
                                style={{ width: 12, color: 'var(--fg-3)', fontSize: 10, cursor: 'pointer' }}
                                title={hCollapsed ? 'Mở account' : 'Gập account'}>
                            {h.accounts.length ? (hCollapsed ? '▸' : '▾') : '·'}
                          </span>
                          <SiteFavicon url={h.url} kind={h.kind} glyph={KIND_GLYPH[h.kind] || '📎'} size={15} title={h.kind} />
                          <span onClick={() => onOpenHabitat(h.id)}
                                title="Mở brief drawer cho habitat này"
                                style={{ fontSize: 12, color: 'var(--fg-0)', cursor: 'pointer',
                                         textDecoration: hDefunct ? 'line-through' : 'none' }}>
                            {h.name}
                          </span>
                          <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{h.kind}</span>
                          {aggPhase && <PhaseChip phase={aggPhase} small />}
                          {h.otherTribeNames.length > 0 && (
                            <span title={`Cũng thuộc tribe: ${h.otherTribeNames.join(', ')}`}
                                  style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                           padding: '0 5px', borderRadius: 3, whiteSpace: 'nowrap',
                                           background: 'var(--bg-3)', color: 'var(--fg-3)', border: '1px solid var(--line)' }}>
                              +{h.otherTribeNames.length} tribe
                            </span>
                          )}
                          <span style={{ flex: 1 }} />
                          {h.accounts.length > 0 && (
                            <span style={{ padding: '0 6px', fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                           background: 'var(--accent-soft)', color: 'var(--accent)',
                                           borderRadius: 8, border: '1px solid var(--accent-line)' }}>
                              👤 {h.accounts.length}
                            </span>
                          )}
                        </div>

                        {!hCollapsed && h.accounts.length > 0 && (
                          <div style={{ marginLeft: 14, borderLeft: '1px dashed var(--line)', paddingLeft: 8 }}>
                            {h.accounts.map((a) => (
                              <div key={a.briefId}
                                   onClick={() => onOpenHabitat(h.id)}
                                   title="Click → mở drawer, chọn brief để sửa / tạo bài"
                                   style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                                            cursor: 'pointer', borderRadius: 4, fontSize: 11.5 }}
                                   onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                                   onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ color: 'var(--fg-4)', fontSize: 10 }}>└</span>
                                <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>@{a.handle}</span>
                                <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{a.platformLabel}</span>
                                <PhaseChip phase={a.currentPhase} small />
                                {a.nextPhase && (
                                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}
                                        title={`Phase kế hoạch tiếp theo: ${PHASE_LABEL[a.nextPhase]}`}>
                                    → {PHASE_LABEL[a.nextPhase]}
                                  </span>
                                )}
                                <span style={{ flex: 1 }} />
                                {a.seeding ? (
                                  <span onClick={(e) => { e.stopPropagation(); onOpenSchedule(a.briefId); }}
                                        title={`Lịch seeding: ${SEED_STATUS_META[a.seeding.status]?.label} · mỗi ${a.seeding.frequencyDays}d · ${a.seeding.daysUntilDue < 0 ? `quá ${-a.seeding.daysUntilDue}d` : a.seeding.daysUntilDue === 0 ? 'hôm nay' : `còn ${a.seeding.daysUntilDue}d`}. Click để sửa.`}
                                        style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                                 padding: '0 5px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
                                                 color: SEED_STATUS_META[a.seeding.status]?.color,
                                                 border: `1px solid ${SEED_STATUS_META[a.seeding.status]?.color}66`,
                                                 background: `${SEED_STATUS_META[a.seeding.status]?.color}1f` }}>
                                    ⏱ {a.seeding.daysUntilDue < 0 ? `quá ${-a.seeding.daysUntilDue}d` : a.seeding.daysUntilDue === 0 ? 'nay' : `${a.seeding.daysUntilDue}d`}
                                  </span>
                                ) : (
                                  <span onClick={(e) => { e.stopPropagation(); onOpenSchedule(a.briefId); }}
                                        title="Chưa có lịch seeding — click để tạo nhịp định kỳ"
                                        style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '0 5px',
                                                 borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
                                                 color: 'var(--fg-4)', border: '1px dashed var(--line)' }}>
                                    ⏱ + lịch
                                  </span>
                                )}
                                <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)',
                                               color: a.postCount > 0 ? 'var(--fg-2)' : 'var(--fg-4)' }}
                                      title={`${a.postCount} bài viết đã tạo cho brief này`}>
                                  📝 {a.postCount}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


