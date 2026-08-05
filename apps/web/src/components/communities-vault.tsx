'use client';

// Communities registry vault — central list of every habitat (subreddit/forum) with
// members · rules · link-gate thresholds · our standing. One component, two mounts:
// global /communities (no projectId → project filter shown) and the per-project view
// /communities?project=<id> (projectId fixed). Row → the canonical HabitatFormModal
// (full editor, reused) so gate/rules edits live in one place; the gate (link-readiness)
// reads the same habitats.min_* the operator tunes here.
import { useState, useMemo, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { HabitatFormModal } from './habitat-form-modal';
import { ListToolbar, Pager, usePaged, MultiSelect } from './ui';
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

  const shown = useMemo(() => rows.filter((r) =>
    (!proj.length || (r.projectId != null && proj.includes(r.projectId)))
    && (!plat.length || (r.platformKey != null && plat.includes(r.platformKey)))
    && (!q || `${r.name} ${r.url || ''} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase())),
  ), [rows, proj, plat, q]);
  const { pageItems, ...pager } = usePaged(shown);

  const kpis = useMemo(() => ({
    total: shown.length,
    gated: shown.filter((r) => r.platformKey && gateOn.has(r.platformKey)).length,
    joined: shown.reduce((s, r) => s + r.joined, 0),
    seeds: shown.reduce((s, r) => s + r.seeds, 0),
  }), [shown, gateOn]);

  const openEdit = async (r: CommunityRow) => {
    if (!r.projectId) return;
    setBusyId(r.id);
    const full = await getHabitatRowAction(r.projectId, r.id);
    setBusyId(null);
    if (full) setEdit({ row: full, projectId: r.projectId });
  };
  const createPid = (proj.length === 1 ? proj[0] : '') || projectId || '';
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
          <button type="button" onClick={() => createPid && setEdit({ row: null, projectId: createPid })} disabled={!createPid}
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
              <th style={th}>Community</th>
              <th style={th}>Platform</th>
              <th style={{ ...th, textAlign: 'right' }}>Members</th>
              <th style={th}>🔒 Gate (age·karma·seed)</th>
              <th style={th}>Links policy</th>
              <th style={th}>Standing</th>
              {!projectId && <th style={th}>Project</th>}
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
          onClose={() => { setEdit(null); start(() => router.refresh()); }}
          onCreated={() => { setEdit(null); start(() => router.refresh()); }}
        />
      )}
    </div>
  );
}
