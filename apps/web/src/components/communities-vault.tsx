'use client';

// Communities registry vault — central list of every habitat (subreddit/forum) with
// members · rules · link-gate thresholds · our standing. One component, two mounts:
// global /communities (no projectId → project filter shown) and the per-project view
// /communities?project=<id> (projectId fixed). Row → the canonical HabitatFormModal
// (full editor, reused) so gate/rules edits live in one place; the gate (link-readiness)
// reads the same habitats.min_* the operator tunes here.
import { useState, useMemo, useTransition, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { HabitatFormModal } from './habitat-form-modal';
import { ListToolbar, Pager, usePaged, MultiSelect } from './ui';
import { useTableSort, SortArrow, type SortableCol } from './ui/use-table-sort';
import { useModalParam } from '@/lib/use-modal-param';
import { getHabitatRowAction } from '@/lib/actions/community-briefs';
import type { HabitatRow, TribeRow, PlatformRow } from '@/lib/data';
import type { CommunityRow } from '@/lib/actions/communities';

const cell: CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--line)', fontSize: 12, verticalAlign: 'top' };
const th: CSSProperties = { padding: '8px 10px', background: 'var(--bg-2)', color: 'var(--fg-3)', fontWeight: 500, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '.06em', borderBottom: '1px solid var(--line)', textAlign: 'left', whiteSpace: 'nowrap' };
const inp: CSSProperties = { padding: '5px 9px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12 };
// Neutral badge (YDNI): type/attribute markers carry meaning in their LABEL, not a unique colour.
const badge: CSSProperties = { fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap', color: 'var(--fg-2)', border: '1px solid var(--line)', background: 'var(--bg-2)' };
// Coloured pill reserved for the ONE glanceable signal here: links policy severity (banned=red, caveat=amber).
const pill = (c: string): CSSProperties => ({ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap', color: c, border: `1px solid ${c}55`, background: `${c}14` });

// Does this community BAN links outright? (mirror of link-readiness regex, for display only.)
function linksBanned(s: string): boolean {
  const v = (s || '').trim().toLowerCase();
  return v === 'never' || v === 'no' || /banned|no self|self.?promo|no link|not allow/.test(v);
}

export function CommunitiesVault({ projectId, rows, platforms, projects, tribes, gatedKeys }: {
  projectId?: string;
  rows: CommunityRow[];
  platforms: PlatformRow[];
  projects: { id: string; name: string; emoji?: string | null }[];
  tribes: TribeRow[];
  gatedKeys: string[];   // platform keys with link_gate_enabled → 🌱 community-seed class
}) {
  const router = useRouter();
  const modal = useModalParam();   // ?m=habitat-edit&mId=<id> | ?m=habitat-new&mId=<projectId> (house standard)
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState<string[]>([]);
  const [proj, setProj] = useState<string[]>(projectId ? [projectId] : []);
  const [edit, setEdit] = useState<{ row: HabitatRow | null; projectId: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const gateOn = useMemo(() => new Set(gatedKeys), [gatedKeys]);
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const platLabel = useMemo(() => new Map(platforms.map((p) => [p.key, p.label])), [platforms]);
  const platKeys = useMemo(() => [...new Set(rows.map((r) => r.platformKey).filter(Boolean))] as string[], [rows]);

  // Sort spec — one sortValue per data column. Composite/derived columns (gate, links, standing) pick a
  // representative signal; unknown/untracked → null so they sort last. platLabel/projName/gateOn are
  // component-scope Maps, so COLS lives here (memoised → useTableSort's sort memo stays stable).
  const COLS = useMemo<SortableCol<CommunityRow>[]>(() => [
    { key: 'community', sortValue: (r) => r.name.toLowerCase() },
    { key: 'platform', sortValue: (r) => (r.platformKey ? (platLabel.get(r.platformKey) || r.platformKey).toLowerCase() : null) },
    { key: 'members', sortValue: (r) => r.members || null },
    { key: 'gate', sortValue: (r) => (r.platformKey && gateOn.has(r.platformKey) ? (r.minAgeDays || 14) : null) },
    { key: 'links', sortValue: (r) => (r.linksAllowedAfter ? (linksBanned(r.linksAllowedAfter) ? 2 : 1) : null) },
    { key: 'standing', sortValue: (r) => (r.briefs ? r.seeds : null) },
    { key: 'project', sortValue: (r) => (r.projectId ? (projName.get(r.projectId) || r.projectId).toLowerCase() : null) },
  ], [platLabel, projName, gateOn]);

  const shown = useMemo(() => rows.filter((r) =>
    (!proj.length || (r.projectId != null && proj.includes(r.projectId)))
    && (!plat.length || (r.platformKey != null && plat.includes(r.platformKey)))
    && (!q || `${r.name} ${r.url || ''} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase())),
  ), [rows, proj, plat, q]);
  const s = useTableSort(shown, COLS, 'communities');
  const { pageItems, ...pager } = usePaged(s.sorted);

  const kpis = useMemo(() => ({
    total: shown.length,
    gated: shown.filter((r) => r.platformKey && gateOn.has(r.platformKey)).length,
    joined: shown.reduce((s, r) => s + r.joined, 0),
    seeds: shown.reduce((s, r) => s + r.seeds, 0),
  }), [shown, gateOn]);

  // All open/close routes through these so the URL (useModalParam) always mirrors the drawer state.
  // edit → mId=<habitatId>; create → mId=<projectId> (habitat has no id yet).
  const openHabitat = (row: HabitatRow | null, pid: string) => { setEdit({ row, projectId: pid }); modal.open(row ? 'habitat-edit' : 'habitat-new', row ? row.id : pid); };
  const closeHabitat = () => { setEdit(null); modal.close(); };
  const openEdit = async (r: CommunityRow) => {
    if (!r.projectId) return;
    setBusyId(r.id);
    const full = await getHabitatRowAction(r.projectId, r.id);
    setBusyId(null);
    if (full) openHabitat(full, r.projectId);
  };
  const createPid = (proj.length === 1 ? proj[0] : '') || projectId || '';

  // Deep-link restore on mount: ?m=habitat-edit&mId=<id> reopens that editor, habitat-new opens create.
  useEffect(() => {
    if (modal.is('habitat-new')) { const pid = modal.id || createPid; if (pid) setEdit({ row: null, projectId: pid }); return; }
    if (modal.is('habitat-edit') && modal.id) { const row = rows.find((r) => String(r.id) === modal.id); if (row) openEdit(row); }
  }, []);   // mount only — restore the drawer the URL points at
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏘 Communities</h2>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>subreddit/forum · rules · link-gate · standing</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[['Communities', kpis.total], ['🌱 gated', kpis.gated], ['joined', kpis.joined], ['seeds landed', kpis.seeds]].map(([l, v]) => (
          <div key={l as string} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, minWidth: 92 }}>
            <div style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v as number}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="tên / url / mô tả…"
        right={
          <button type="button" onClick={() => createPid && openHabitat(null, createPid)} disabled={!createPid}
            title={createPid ? 'Thêm community mới' : 'Chọn 1 project để thêm'}
            style={{ ...inp, cursor: createPid ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: createPid ? 1 : 0.5 }}>+ Community</button>
        }>
        {!projectId && (
          <MultiSelect label="project" compact selected={proj} onChange={setProj}
            options={projects.map((p) => ({ value: p.id, label: `${p.emoji ? `${p.emoji} ` : ''}${p.name}` }))} />
        )}
        <MultiSelect label="platform" compact selected={plat} onChange={setPlat}
          options={platKeys.map((k) => ({ value: k, label: `${platLabel.get(k) || k}${gateOn.has(k) ? ' 🌱' : ''}` }))} />
      </ListToolbar>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr>
              <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('community').onClick}>Community <SortArrow spec={s.thProps('community')} /></th>
              <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('platform').onClick}>Platform <SortArrow spec={s.thProps('platform')} /></th>
              <th style={{ ...th, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('members').onClick}>Members <SortArrow spec={s.thProps('members')} /></th>
              <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('gate').onClick}>🔒 Gate (age·karma·seed) <SortArrow spec={s.thProps('gate')} /></th>
              <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('links').onClick}>Links policy <SortArrow spec={s.thProps('links')} /></th>
              <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('standing').onClick}>Standing <SortArrow spec={s.thProps('standing')} /></th>
              {!projectId && <th style={{ ...th, cursor: 'pointer', userSelect: 'none' }} onClick={s.thProps('project').onClick}>Project <SortArrow spec={s.thProps('project')} /></th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => {
              const banned = linksBanned(r.linksAllowedAfter);
              const isGated = !!(r.platformKey && gateOn.has(r.platformKey));
              return (
                <tr key={r.id} onClick={() => openEdit(r)} style={{ cursor: 'pointer', opacity: busyId === r.id ? 0.5 : 1 }}
                  title="Mở editor (rules · gate · standing)">
                  <td style={cell}>
                    <div style={{ fontWeight: 700, color: 'var(--fg-0)' }}>{r.name}{r.privacy === 'private' && <span style={{ marginLeft: 6, ...badge }}>private</span>}</div>
                    {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 10.5, color: 'var(--fg-3)', textDecoration: 'underline dotted' }}>↗ {r.url.replace(/^https?:\/\/(www\.)?/, '')}</a>}
                  </td>
                  <td style={cell}>{r.platformKey ? <span style={badge}>{isGated ? '🌱 ' : ''}{platLabel.get(r.platformKey) || r.platformKey}</span> : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.members ? fmt(r.members) : '—'}</td>
                  <td style={cell}>
                    {isGated
                      ? <span style={{ color: 'var(--fg-2)' }}>{r.minAgeDays || 14}d · {r.minKarma || 20}k · {r.minPosts || 2} seed{(r.minAgeDays || r.minKarma || r.minPosts) ? '' : ' (default)'}</span>
                      : <span style={{ color: 'var(--fg-4)' }}>no gate</span>}
                  </td>
                  <td style={cell}>
                    {r.linksAllowedAfter
                      ? <span title={r.linksAllowedAfter} style={pill(banned ? '#ef4444' : '#ffb03c')}>{banned ? '⛔ no link' : `⚠ ${r.linksAllowedAfter.slice(0, 22)}${r.linksAllowedAfter.length > 22 ? '…' : ''}`}</span>
                      : <span style={{ color: 'var(--fg-4)' }}>—</span>}
                  </td>
                  <td style={{ ...cell, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>
                    {r.briefs ? `${r.joined}/${r.briefs} joined · 🌱${r.seeds}` : <span style={{ color: 'var(--fg-4)' }}>chưa track</span>}
                  </td>
                  {!projectId && <td style={{ ...cell, color: 'var(--fg-3)' }}>{r.projectId ? (projName.get(r.projectId) || r.projectId) : '—'}</td>}
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={projectId ? 6 : 7} style={{ ...cell, textAlign: 'center', color: 'var(--fg-3)', padding: 24 }}>Chưa có community nào khớp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...pager} onPage={pager.setPage} />

      {edit && (
        <HabitatFormModal
          projectId={edit.projectId} habitat={edit.row} tribes={tribes} platforms={platforms}
          onClose={() => { closeHabitat(); start(() => router.refresh()); }}
          onCreated={() => { closeHabitat(); start(() => router.refresh()); }}
        />
      )}
    </div>
  );
}
