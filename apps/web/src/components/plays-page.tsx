'use client';

// Unified per-project "Plays" board (/p/[id]/plays). ONE screen over ALL human_tasks for
// the project — every platform_key, every status incl. backlog — as a kanban + calendar,
// so the operator sees / assigns / follows every distribution play in one place. Existing
// tasks (backlink / community / inbox) already live in human_tasks; newly generated plays
// land here too. Click a card → detail drawer; "open native editor" deep-links to the
// task's own surface (backlink drawer / inbox). Reuses AssigneeCell for assignment and the
// house Drawer/MonthCalendar/Pill primitives — no new store, read-only union view.
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MonthCalendar, Pill, EmptyState, Drawer, type CalItem } from '@/components/ui';
import { AssigneeCell } from '@/components/assignee-chip';
import type { HumanTaskRow } from '@/lib/actions/inbox';

type Lane = 'backlog' | 'doing' | 'done' | 'live' | 'archive';
const LANE_COLOR: Record<Lane, string> = { backlog: '#8a92a3', doing: '#ffb03c', done: '#5badff', live: '#22c55e', archive: '#6b7280' };
const BASE_LANES: Array<{ key: Lane; label: string }> = [
  { key: 'backlog', label: 'Backlog · chưa giao' },
  { key: 'doing', label: 'Đang chạy' },
  { key: 'done', label: 'Đã đăng' },
  { key: 'live', label: 'Link sống ✓' },
];

const normPlatform = (p: string | null): string => (p === 'x' ? 'twitter' : (p || '—'));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const fmtDay = (iso: string | null): string => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }); } catch { return ''; } };

// Backlink tasks carry the real per-site lifecycle in prep_payload.site_status[projectId];
// every other platform uses human_tasks.status. Collapse both vocabularies to 5 real lanes.
function laneOf(t: HumanTaskRow, projectId: string): Lane {
  const ss = t.platformKey === 'backlink'
    ? (t.prepPayload?.site_status as Record<string, string> | undefined)?.[projectId]
    : undefined;
  const s = ss ?? t.status;
  switch (s) {
    case 'pending': return t.assignedUserId ? 'doing' : 'backlog';
    case 'claimed':
    case 'in_progress':
    case 'submitted':
    case 'broken': return 'doing';
    case 'completed': return 'done';
    case 'verified': return 'live';
    case 'failed':
    case 'cancelled': return 'archive';
    default: return 'backlog';
  }
}

const BTN: CSSProperties = { padding: '4px 9px', fontSize: 11, borderRadius: 6, border: '1px solid var(--line-2)', background: 'var(--bg-1)', color: 'var(--fg-2)', cursor: 'pointer' };
const chipStyle = (active: boolean, color = 'var(--accent)'): CSSProperties => ({
  padding: '3px 9px', fontSize: 11, borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${active ? color : 'var(--line-2)'}`,
  background: active ? `color-mix(in srgb, ${color} 16%, transparent)` : 'transparent',
  color: active ? color : 'var(--fg-3)',
});

type Row = { t: HumanTaskRow; lane: Lane; plat: string };

export function PlaysPage({ projectId, tasks }: { projectId: string; tasks: HumanTaskRow[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, start] = useTransition();

  // All view state initialises from the URL so filters/drawer are deep-linkable + refresh-safe.
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [pf, setPf] = useState(sp.get('pf') ?? '');
  const [unassignedOnly, setUnassignedOnly] = useState(sp.get('free') === '1');
  const [showArchive, setShowArchive] = useState(false);
  const [view, setView] = useState<'board' | 'calendar'>(sp.get('view') === 'calendar' ? 'calendar' : 'board');
  const [openId, setOpenId] = useState<number | null>(Number(sp.get('task')) || null);

  // Single source of URL truth — reflect every view-changing state (shallow, no refetch).
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string | number | null | undefined) => { if (v) u.searchParams.set(k, String(v)); else u.searchParams.delete(k); };
    set('q', q.trim());
    set('pf', pf);
    set('view', view === 'calendar' ? 'calendar' : '');
    set('free', unassignedOnly ? '1' : '');
    set('task', openId);
    window.history.replaceState(null, '', u);
  }, [q, pf, view, unassignedOnly, openId]);

  const platforms = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) s.add(normPlatform(t.platformKey));
    return [...s].sort();
  }, [tasks]);

  const rows: Row[] = useMemo(() => tasks.map((t) => ({ t, lane: laneOf(t, projectId), plat: normPlatform(t.platformKey) })), [tasks, projectId]);

  const filtered = useMemo(() => rows.filter(({ t, lane, plat }) => {
    if (!showArchive && lane === 'archive') return false;
    if (pf && plat !== pf) return false;
    if (unassignedOnly && t.assignedUserId != null) return false;
    if (q) {
      const hay = `${t.title} ${t.instructions} ${str(t.prepPayload?.surface)} ${str(t.prepPayload?.hook)}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [rows, showArchive, pf, unassignedOnly, q]);

  const byLane = useMemo(() => {
    const m: Record<Lane, Row[]> = { backlog: [], doing: [], done: [], live: [], archive: [] };
    for (const row of filtered) m[row.lane].push(row);
    return m;
  }, [filtered]);

  const lanes = useMemo(() => (showArchive ? [...BASE_LANES, { key: 'archive' as Lane, label: 'Archive' }] : BASE_LANES), [showArchive]);

  const calItems: CalItem[] = useMemo(() => filtered
    .filter(({ t }) => t.slaDueAt)
    .map(({ t, lane }) => ({ id: t.id, date: (t.slaDueAt as string).slice(0, 10), label: t.title, color: LANE_COLOR[lane], title: t.title })), [filtered]);

  const open = openId != null ? tasks.find((t) => t.id === openId) ?? null : null;

  const Card = ({ row }: { row: Row }) => {
    const { t, lane, plat } = row;
    const sub = str(t.prepPayload?.hook) || str(t.prepPayload?.surface) || t.instructions;
    return (
      <div onClick={() => setOpenId(t.id)} title="Xem chi tiết play"
        style={{ padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, borderLeft: `3px solid ${LANE_COLOR[lane]}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1.3 }}>{t.title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--fg-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sub}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#9d6cff', border: '1px solid color-mix(in srgb, #9d6cff 40%, transparent)', borderRadius: 4, padding: '0 5px' }}>{plat}</span>
          {t.slaDueAt && <span style={{ fontSize: 10, color: 'var(--fg-3)' }} title="Mốc / hạn">⏱ {fmtDay(t.slaDueAt)}</span>}
          {t.publishUrl && <span style={{ fontSize: 10, color: 'var(--ok)' }} title="Đã có URL đăng">● live</span>}
          <span style={{ marginLeft: 'auto' }}>
            <AssigneeCell taskId={t.id} name={t.assignedUserName || ''} assignedId={t.assignedUserId} onChange={() => start(() => router.refresh())} />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>🎯 Plays</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{filtered.length} play · mọi kênh phân phối của site này ở 1 màn</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" style={chipStyle(view === 'board')} onClick={() => setView('board')}>▦ Board</button>
          <button type="button" style={chipStyle(view === 'calendar')} onClick={() => setView('calendar')}>📅 Lịch</button>
        </div>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm play / surface / hook…" autoComplete="off"
          style={{ ...BTN, flex: '1 1 200px', minWidth: 160, cursor: 'text', background: 'var(--bg-1)' }} />
        {platforms.map((p) => <button key={p} type="button" style={chipStyle(pf === p, '#9d6cff')} onClick={() => setPf(pf === p ? '' : p)}>{p}</button>)}
        <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
        <button type="button" style={chipStyle(unassignedOnly, '#ffb03c')} onClick={() => setUnassignedOnly((v) => !v)}>chưa giao</button>
        <button type="button" style={chipStyle(showArchive, '#6b7280')} onClick={() => setShowArchive((v) => !v)}>hiện archive</button>
        {(q || pf || unassignedOnly) && <button type="button" style={BTN} onClick={() => { setQ(''); setPf(''); setUnassignedOnly(false); }}>Clear</button>}
      </div>

      {/* body */}
      {!filtered.length ? (
        <EmptyState icon="🎯" title="Chưa có play nào ở bộ lọc này" />
      ) : view === 'calendar' ? (
        <MonthCalendar items={calItems} onItemClick={(id) => setOpenId(Number(id))} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, alignItems: 'start' }}>
          {lanes.map((l) => (
            <div key={l.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: LANE_COLOR[l.key] }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: LANE_COLOR[l.key] }} />
                {l.label}<span style={{ color: 'var(--fg-4)', fontWeight: 600 }}>{byLane[l.key].length}</span>
              </div>
              {byLane[l.key].map((row) => <Card key={row.t.id} row={row} />)}
              {!byLane[l.key].length && <div style={{ fontSize: 11, color: 'var(--fg-4)', padding: '8px 2px' }}>—</div>}
            </div>
          ))}
        </div>
      )}

      {open && <PlayDrawer task={open} projectId={projectId} lane={laneOf(open, projectId)} onClose={() => setOpenId(null)} onChange={() => start(() => router.refresh())} />}
    </div>
  );
}

function PlayDrawer({ task, projectId, lane, onClose, onChange }: { task: HumanTaskRow; projectId: string; lane: Lane; onClose: () => void; onChange: () => void }) {
  const plat = normPlatform(task.platformKey);
  const isBacklink = task.platformKey === 'backlink';
  const nativeHref = isBacklink ? `/p/${projectId}/backlinks?task=${task.id}` : `/p/${projectId}/inbox`;
  const fields: Array<[string, string]> = [];
  for (const k of ['play_type', 'surface', 'action', 'hook', 'trigger', 'mechanism', 'source_url']) {
    const v = str(task.prepPayload?.[k]);
    if (v) fields.push([k, v]);
  }
  return (
    <Drawer onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Pill label={plat} color="#9d6cff" size="xs" />
          <Pill label={lane} color={LANE_COLOR[lane]} size="xs" />
          {task.slaDueAt && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>⏱ {fmtDay(task.slaDueAt)}</span>}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{task.title}</h2>
        {task.instructions && <div style={{ fontSize: 13, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{task.instructions}</div>}
        {fields.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
            {fields.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <span style={{ minWidth: 78, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{k}</span>
                <span style={{ color: 'var(--fg-1)', wordBreak: 'break-word' }}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Giao cho:</span>
          <AssigneeCell taskId={task.id} name={task.assignedUserName || ''} assignedId={task.assignedUserId} onChange={onChange} />
        </div>
        {task.publishUrl && <a href={task.publishUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>🔗 {task.publishUrl}</a>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <a href={nativeHref} style={{ ...BTN, textDecoration: 'none', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Mở editor gốc ↗</a>
        </div>
        <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: 0 }}>
          {isBacklink ? 'Editor gốc = tab Backlinks (đặt URL đã đăng, verify, mở Outreach).' : 'Nhân sự thực hiện ở /inbox: claim → làm → dán URL.'}
        </p>
      </div>
    </Drawer>
  );
}
