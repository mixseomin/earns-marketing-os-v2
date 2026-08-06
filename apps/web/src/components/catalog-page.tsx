'use client';

// Manage the shared METHOD/play catalog (backlink_sources) — separate from /plays (which manages seeded
// TASK instances). Grouped Nhóm → Level → method. Reuses SourceEditor for add/edit; archive via
// setBacklinkSourceStatus. YDNI: each row shows only name + the few glanceable signals (dofollow / ran-
// through-browser / status); everything else (level, tags, DA, URL, template) lives one click inside the
// editor. Colour = signal only (green value/ok · amber attention · red broken); the rest is neutral.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useModalParam } from '@/lib/use-modal-param';
import { listBacklinkSources, setBacklinkSourceStatus, queueMethodFanout, type BacklinkSource } from '@/lib/actions/backlink-catalog';
import { ListToolbar, FilterChips, Pager, usePaged } from './ui';
import { SourceEditor } from './source-editor';

const CATEGORY = new Set(['community', 'editorial', 'pr', 'guest-post', 'directory', 'tool-dir', 'launch', 'qa', 'forum', 'wiki', 'reference', 'dev', 'listicle', 'social', 'edu-resource', 'haro', 'llms']);
const NOISE = new Set(['play', 'universal', 'general']);          // markers, not a Nhóm
const LEVEL_RE = /^level-/;
const LEVEL_LABEL: Record<string, string> = { 'level-1': 'NGAY', 'level-2': 'NHANH', 'level-3': 'TRUNG', 'level-4': 'TRẢ TIỀN' };
const LEVEL_ORDER = ['level-1', 'level-2', 'level-3', 'level-4', ''];

const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };
const badge: CSSProperties = { fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-3)', whiteSpace: 'nowrap' };
// Colour = signal only (YDNI colour discipline): green=value/ok, amber=needs-attention, red=broken. Rest neutral.
const GOOD = 'var(--good,#39c07a)', WARN = 'var(--warn,#ffb03c)', BAD = 'var(--bad,#ef4444)';
const sig = (color: string): CSSProperties => ({ ...badge, color, borderColor: `color-mix(in srgb, ${color} 32%, transparent)` });
const iconBtn: CSSProperties = { fontSize: 12, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-3)', cursor: 'pointer', whiteSpace: 'nowrap' };

const levelOf = (s: BacklinkSource) => s.audienceTags.find((t) => LEVEL_RE.test(t)) ?? '';
const groupsOf = (s: BacklinkSource) => s.audienceTags.filter((t) => !NOISE.has(t) && !CATEGORY.has(t) && !LEVEL_RE.test(t));
const primaryGroup = (s: BacklinkSource) => (s.audienceTags.includes('leads') ? 'leads' : (groupsOf(s)[0] ?? '(chung)'));
const groupLabel = (g: string) => (g === 'leads' ? '🎯 Kéo leads' : g === '(chung)' ? '📦 Chung / universal' : g);

// "how long since this source was last actually run through a browser" (last_run_at, set by reportSourceOutcome)
function browserAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d}d trước` : h > 0 ? `${h}h trước` : m > 0 ? `${m}m trước` : 'vừa xong';
}

export function CatalogPage({ initialSources, projects, fanouts }: { initialSources: BacklinkSource[]; projects: Array<{ id: string; name: string; emoji?: string }>; fanouts: Array<{ sourceId: number; projectId: string; status: string; taskCount: number }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = useModalParam();   // ?m=source-edit&mId=<id> | ?m=source-new (house standard)
  const genProject = searchParams.get('gen') ?? '';
  const setGenProject = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (id) p.set('gen', id); else p.delete('gen');
    const qs = p.toString();
    router.replace(qs ? `/catalog?${qs}` : '/catalog', { scroll: false });
  };
  const fanoutMap = useMemo(() => { const m: Record<string, { status: string; count: number }> = {}; for (const f of fanouts) m[`${f.sourceId}:${f.projectId}`] = { status: f.status, count: f.taskCount }; return m; }, [fanouts]);
  const [sources, setSources] = useState(initialSources);
  const [q, setQ] = useState('');
  const [nhom, setNhom] = useState('');
  const [playOnly, setPlayOnly] = useState(true);
  const [archived, setArchived] = useState(false);
  const [showFanout, setShowFanout] = useState(!!genProject); // occasional power action → hidden until opened (YDNI)
  const [edit, setEdit] = useState<BacklinkSource | Record<string, never> | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [genBusy, setGenBusy] = useState<number | null>(null);
  const [genMsg, setGenMsg] = useState<Record<number, string>>({});
  const queueFanout = async (sourceId: number) => {
    if (!genProject) return;
    setGenBusy(sourceId);
    const r = await queueMethodFanout(sourceId, genProject);
    setGenBusy(null);
    setGenMsg((m) => ({ ...m, [sourceId]: r.ok ? (r.already ? '⏳ đã xếp hàng rồi' : '✓ đã xếp hàng → Claude research') : `✗ ${r.error}` }));
    if (r.ok) router.refresh();
  };

  const reload = async (nextArchived = archived) => setSources(await listBacklinkSources({ status: nextArchived ? 'archived' : 'active' }));
  const toggleArchived = async () => { const v = !archived; setArchived(v); await reload(v); };
  const setStatus = async (id: number, to: string) => { setBusy(id); await setBacklinkSourceStatus(id, to); await reload(); setBusy(null); };

  // All open/close of the editor routes through these so the URL (useModalParam) always mirrors the drawer state.
  // existing source → ?m=source-edit&mId=<id>; new → ?m=source-new (no id yet).
  const openEditor = (s: BacklinkSource | Record<string, never>) => {
    setEdit(s);
    if ('id' in s && typeof s.id === 'number') modal.open('source-edit', s.id);
    else modal.open('source-new');
  };
  const closeEditor = () => { setEdit(null); modal.close(); };

  // Deep-link restore on mount: ?m=source-edit&mId=<id> reopens that editor; source-new opens the add form.
  useEffect(() => {
    if (modal.is('source-new')) { setEdit({}); return; }
    if (modal.is('source-edit') && modal.numId != null) { const s = sources.find((x) => x.id === modal.numId); if (s) setEdit(s); }
  }, []);   // mount only — restore the drawer the URL points at

  // When searching, IGNORE the "chỉ phương pháp" toggle so search always surfaces the match (e.g. SaaSHub
  // isn't 'play'-tagged and would otherwise stay hidden). Search must show what you look for. (H1 fix)
  const base = useMemo(() => (playOnly && !q.trim() ? sources.filter((s) => s.audienceTags.includes('play')) : sources), [sources, playOnly, q]);
  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    return base.filter((src) => !s || `${src.name} ${src.canonicalUrl} ${src.category || ''} ${src.mechanism || ''} ${src.audienceTags.join(' ')} ${src.instructionTemplate || ''}`.toLowerCase().includes(s));
  }, [base, q]);
  const list = useMemo(() => searched.filter((s) => !nhom || groupsOf(s).includes(nhom)), [searched, nhom]);
  const { pageItems, ...pager } = usePaged(list);

  const nhomCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of searched) { const g = primaryGroup(s); m.set(g, (m.get(g) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => (a[0] === 'leads' ? -1 : b[0] === 'leads' ? 1 : b[1] - a[1]));
  }, [searched]);

  const sections = useMemo(() => {
    const m = new Map<string, BacklinkSource[]>();
    if (nhom) {                                    // one Nhóm selected → sections by LEVEL
      for (const s of pageItems) { const lv = levelOf(s); (m.get(lv) ?? m.set(lv, []).get(lv)!).push(s); }
      return LEVEL_ORDER.filter((lv) => m.has(lv)).map((lv) => ({ key: lv || 'nolevel', label: lv ? LEVEL_LABEL[lv] ?? lv : '(chưa gắn level)', items: m.get(lv)!.sort((a, b) => a.name.localeCompare(b.name)) }));
    }
    for (const s of pageItems) { const g = primaryGroup(s); (m.get(g) ?? m.set(g, []).get(g)!).push(s); }   // all → sections by Nhóm
    return [...m.entries()].sort((a, b) => (a[0] === 'leads' ? -1 : b[0] === 'leads' ? 1 : b[1].length - a[1].length))
      .map(([g, items]) => ({ key: g, label: groupLabel(g), items: items.sort((a, b) => (LEVEL_ORDER.indexOf(levelOf(a)) - LEVEL_ORDER.indexOf(levelOf(b))) || a.name.localeCompare(b.name)) }));
  }, [pageItems, nhom]);

  // One row = name + only the glanceable signals; the whole row is the edit trigger. Secondary metadata
  // (what it does / DA / usage) sits on a muted second line; everything else is inside the editor.
  const row = (s: BacklinkSource) => {
    const fo = genProject ? fanoutMap[`${s.id}:${genProject}`] : undefined;
    const gm = genMsg[s.id];
    const st = s.sourceStatus === 'needs-review' ? { t: '⚠ cần review', c: WARN } : s.sourceStatus === 'broken' ? { t: '⚠ hỏng', c: BAD } : null;
    const meta = [s.mechanism || s.category, s.da ? `DA ${s.da}` : '', s.usageCount > 0 ? `${s.usageCount} dự án` : ''].filter(Boolean).join('  ·  ');
    return (
      <div key={s.id} onClick={() => openEditor(s)} title="Bấm để sửa" style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '8px 11px', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-1)' }}>{s.name}</span>
            {s.dofollow === 'dofollow' && <span style={sig(GOOD)}>dofollow</span>}
            {st && <span style={sig(st.c)}>{st.t}</span>}
            {s.lastRunAt
              ? <span style={sig(GOOD)} title={`Đã chạy thật qua browser ${String(s.lastRunAt).slice(0, 10)} → ${s.lastRunOutcome || '?'}${s.automation ? ' · ' + s.automation : ''}`}>🔎 {browserAgo(s.lastRunAt)}</span>
              : <span style={{ ...badge, color: 'var(--fg-4)' }} title="Chưa chạy thực tế qua browser lần nào">○ chưa chạy</span>}
          </div>
          {meta && <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          {genProject && s.audienceTags.includes('play') && !fo && (
            gm ? <span style={{ fontSize: 9, color: gm.startsWith('✗') ? BAD : GOOD, maxWidth: 110, lineHeight: 1.2 }}>{gm}</span>
              : <button type="button" disabled={genBusy === s.id} onClick={() => queueFanout(s.id)} style={{ ...iconBtn, color: 'var(--accent)' }} title="Sinh fan-out method này cho project đã chọn — Claude research target thật, tạo draft chờ duyệt">{genBusy === s.id ? '⏳' : '🎯'}</button>
          )}
          {fo?.status === 'queued' && <span style={sig(WARN)} title="Đã queue — Claude sẽ research & tạo draft ở plays">⏳ xếp hàng</span>}
          {fo?.status === 'done' && <a href={`/p/${genProject}/plays`} onClick={(e) => e.stopPropagation()} style={{ ...sig(GOOD), textDecoration: 'none' }} title="Đã sinh — mở plays để duyệt">✓ {fo.count} → duyệt</a>}
          <button type="button" onClick={() => openEditor(s)} style={iconBtn} title="Sửa">✎</button>
          {archived
            ? <button type="button" disabled={busy === s.id} onClick={() => setStatus(s.id, 'active')} style={iconBtn} title="Khôi phục">♻</button>
            : <button type="button" disabled={busy === s.id} onClick={() => setStatus(s.id, 'archived')} style={iconBtn} title="Lưu kho (archived)">🗄</button>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '12px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Phương pháp <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 8 }}>// catalog · {list.length}{archived ? ' (kho lưu)' : ''}</small></h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href="/plays" style={{ ...btn, textDecoration: 'none' }} title="Về bảng quản lý task">← Plays (task)</a>
          <button type="button" onClick={() => openEditor({})} style={{ ...btn, color: 'var(--accent)', fontWeight: 700 }}>➕ Thêm phương pháp</button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 10 }}>
        Kho <b>phương pháp</b> dùng chung — bấm 1 dòng để sửa; sửa 1 method <b>lan xuống mọi task đã seed</b>.{' '}
        <span title="Vào 1 project → /plays → 'Seed từ catalog' để biến 1 method thành task">ⓘ seed thành task ở /plays</span>
      </div>

      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="tìm tên / URL / tag / template… (bỏ qua mọi lọc)">
        <FilterChips value={playOnly ? 'play' : 'all'} onChange={(v) => setPlayOnly(v === 'play')}
          options={[{ value: 'play', label: 'chỉ phương pháp' }, { value: 'all', label: 'tất cả nguồn' }]} />
        <FilterChips value={archived ? 'archived' : 'active'} onChange={(v) => { if ((v === 'archived') !== archived) toggleArchived(); }}
          options={[{ value: 'active', label: 'đang dùng' }, { value: 'archived', label: '🗄 kho lưu' }]} />
        <FilterChips value={nhom} onChange={setNhom}
          counts={{ '': searched.length, ...Object.fromEntries(nhomCounts) }}
          options={[{ value: '', label: 'tất cả' }, ...nhomCounts.map(([g]) => ({ value: g, label: groupLabel(g) }))]} />
      </ListToolbar>

      {nhom === 'leads' && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginBottom: 8 }}>NGAY = harvest tay (ra lead sớm, proof) · NHANH = organic (Pinterest/pSEO) · TRUNG = authority (Digital-PR/email) · TRẢ TIỀN = ads (gated)</div>}

      {/* fan-out = occasional power action → collapsed by default (YDNI) */}
      <div style={{ marginBottom: 10 }}>
        <button type="button" onClick={() => setShowFanout((v) => !v)} style={{ ...iconBtn, fontSize: 11, fontWeight: 600, color: genProject ? 'var(--accent)' : 'var(--fg-3)' }} title="Sinh hàng loạt task từ 1 method cho 1 project (Claude research target thật)">
          {showFanout ? '▾' : '▸'} 🎯 Sinh fan-out cho project{genProject ? `: ${projects.find((p) => p.id === genProject)?.name ?? genProject}` : ''}
        </button>
        {showFanout && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap', padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)' }}>
            <select value={genProject} onChange={(e) => setGenProject(e.target.value)} style={{ ...btn, cursor: 'pointer', padding: '4px 8px', background: 'var(--bg-2)' }}>
              <option value="">— chọn project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.emoji ? p.emoji + ' ' : ''}{p.name}</option>)}
            </select>
            <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>{genProject ? <>→ bấm 🎯 ở method → draft chờ duyệt ở <code>/p/{genProject}/plays</code></> : 'chọn project để bật nút 🎯 trên từng method'}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
        {sections.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Không có phương pháp nào khớp{q.trim() ? ` "${q.trim()}"` : ''}.</div>}
        {sections.map((sec) => (
          <div key={sec.key}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-2)', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
              {sec.label} <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>{sec.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{sec.items.map(row)}</div>
          </div>
        ))}
      </div>
      <Pager {...pager} onPage={pager.setPage} />

      {edit && <SourceEditor initial={edit} onClose={closeEditor} onSaved={async () => { closeEditor(); await reload(); }} />}
    </div>
  );
}
