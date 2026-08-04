'use client';

// Manage the shared METHOD/play catalog (backlink_sources) — separate from /plays (which manages seeded
// TASK instances). Grouped Nhóm → Level → method, so "Kéo leads" (or any niche) reads as a group with its
// levels inside. Reuses SourceEditor for add/edit; archive via setBacklinkSourceStatus.
import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { listBacklinkSources, setBacklinkSourceStatus, queueMethodFanout, type BacklinkSource } from '@/lib/actions/backlink-catalog';
import { SourceEditor } from './source-editor';

const CATEGORY = new Set(['community', 'editorial', 'pr', 'guest-post', 'directory', 'tool-dir', 'launch', 'qa', 'forum', 'wiki', 'reference', 'dev', 'listicle', 'social', 'edu-resource', 'haro', 'llms']);
const NOISE = new Set(['play', 'universal', 'general']);          // markers, not a Nhóm
const LEVEL_RE = /^level-/;
const LEVEL_LABEL: Record<string, string> = { 'level-1': 'NGAY', 'level-2': 'NHANH', 'level-3': 'TRUNG', 'level-4': 'TRẢ TIỀN' };
const LEVEL_ORDER = ['level-1', 'level-2', 'level-3', 'level-4', ''];

const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };
const chip = (on: boolean, c = 'var(--accent)'): CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${on ? c : 'var(--line)'}`, background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'transparent', color: on ? c : 'var(--fg-3)' });
const badge: CSSProperties = { fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-3)', whiteSpace: 'nowrap' };

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
  // Selected project lives in the URL (?gen=…) so it survives reload / is shareable, and a soft nav
  // refreshes the `fanouts` prop → badge updates after Claude fulfills. (feedback_url_state)
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
    if (r.ok) router.refresh();   // persist: reload DB fanout status so the badge shows on any machine
  };

  const reload = async (nextArchived = archived) => setSources(await listBacklinkSources({ status: nextArchived ? 'archived' : 'active' }));
  const toggleArchived = async () => { const v = !archived; setArchived(v); await reload(v); };
  const setStatus = async (id: number, to: string) => { setBusy(id); await setBacklinkSourceStatus(id, to); await reload(); setBusy(null); };

  const base = useMemo(() => sources.filter((s) => (playOnly ? s.audienceTags.includes('play') : true)), [sources, playOnly]);
  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    return base.filter((src) => !s || `${src.name} ${src.canonicalUrl} ${src.category || ''} ${src.mechanism || ''} ${src.audienceTags.join(' ')} ${src.instructionTemplate || ''}`.toLowerCase().includes(s));
  }, [base, q]);
  const list = useMemo(() => searched.filter((s) => !nhom || groupsOf(s).includes(nhom)), [searched, nhom]);

  const nhomCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of searched) { const g = primaryGroup(s); m.set(g, (m.get(g) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => (a[0] === 'leads' ? -1 : b[0] === 'leads' ? 1 : b[1] - a[1]));
  }, [searched]);

  const sections = useMemo(() => {
    const m = new Map<string, BacklinkSource[]>();
    if (nhom) {                                    // one Nhóm selected → sections by LEVEL
      for (const s of list) { const lv = levelOf(s); (m.get(lv) ?? m.set(lv, []).get(lv)!).push(s); }
      return LEVEL_ORDER.filter((lv) => m.has(lv)).map((lv) => ({ key: lv || 'nolevel', label: lv ? LEVEL_LABEL[lv] ?? lv : '(chưa gắn level)', items: m.get(lv)!.sort((a, b) => a.name.localeCompare(b.name)) }));
    }
    for (const s of list) { const g = primaryGroup(s); (m.get(g) ?? m.set(g, []).get(g)!).push(s); }   // all → sections by Nhóm
    return [...m.entries()].sort((a, b) => (a[0] === 'leads' ? -1 : b[0] === 'leads' ? 1 : b[1].length - a[1].length))
      .map(([g, items]) => ({ key: g, label: groupLabel(g), items: items.sort((a, b) => (LEVEL_ORDER.indexOf(levelOf(a)) - LEVEL_ORDER.indexOf(levelOf(b))) || a.name.localeCompare(b.name)) }));
  }, [list, nhom]);

  const row = (s: BacklinkSource) => {
    const lv = levelOf(s);
    const gm = genMsg[s.id];
    const fo = genProject ? fanoutMap[`${s.id}:${genProject}`] : undefined;
    const extraTags = s.audienceTags.filter((t) => !NOISE.has(t) && !LEVEL_RE.test(t) && t !== primaryGroup(s));
    return (
      <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', padding: '7px 10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setEdit(s)} style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--fg-1)', cursor: 'pointer', textAlign: 'left' }}>{s.name}</button>
            {lv && <span style={{ ...badge, color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }} title="Level">{LEVEL_LABEL[lv] ?? lv}</span>}
            {s.category && <span style={badge}>{s.category}</span>}
            {s.dofollow && <span style={{ ...badge, color: s.dofollow === 'dofollow' ? 'var(--good,#39c07a)' : 'var(--fg-4)' }}>{s.dofollow}</span>}
            {s.da && <span style={badge}>DA {s.da}</span>}
            {s.usageCount > 0 && <span style={{ ...badge, color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }} title="Số dự án đang dùng">{s.usageCount} dự án</span>}
            {s.lastRunAt
              ? <span style={{ ...badge, color: 'var(--good,#39c07a)', borderColor: 'color-mix(in srgb, var(--good,#39c07a) 30%, transparent)' }} title={`Đã chạy thật qua browser ${String(s.lastRunAt).slice(0, 10)} → ${s.lastRunOutcome || '?'}${s.automation ? ' · ' + s.automation : ''}`}>🔎 {browserAgo(s.lastRunAt)}{s.lastRunOutcome ? ' · ' + s.lastRunOutcome : ''}</span>
              : <span style={{ ...badge, color: 'var(--fg-4)' }} title="Chưa chạy thực tế qua browser lần nào">○ chưa qua browser</span>}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/^https?:\/\//.test(s.canonicalUrl)
              ? <a href={s.canonicalUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-3)', textDecoration: 'none' }} title={s.canonicalUrl}>↗ {s.canonicalUrl.replace(/^https?:\/\//, '').slice(0, 52)}</a>
              : <span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }} title={s.canonicalUrl}>· method (không có URL riêng — xem hướng dẫn)</span>}
            {extraTags.length > 0 && <span>{extraTags.join(' · ')}</span>}
          </div>
        </div>
        {genProject && s.audienceTags.includes('play') && (
          <button type="button" disabled={genBusy === s.id} onClick={() => queueFanout(s.id)} style={{ ...btn, padding: '3px 8px', color: 'var(--accent)' }} title={`Sinh fan-out method này cho project đã chọn — Claude research target thật, tạo draft chờ duyệt`}>{genBusy === s.id ? '⏳' : '🎯'}</button>
        )}
        {gm
          ? <span style={{ fontSize: 9, color: gm.startsWith('✗') ? 'var(--bad,#ef4444)' : 'var(--good,#39c07a)', maxWidth: 120, lineHeight: 1.2 }}>{gm}</span>
          : fo?.status === 'queued' ? <span style={{ ...badge, color: 'var(--warn,#ffb03c)', borderColor: 'color-mix(in srgb, var(--warn,#ffb03c) 35%, transparent)' }} title="Đã queue — Claude sẽ research & tạo draft ở plays của project">⏳ đã xếp hàng</span>
          : fo?.status === 'done' ? <a href={`/p/${genProject}/plays`} style={{ ...badge, color: 'var(--good,#39c07a)', borderColor: 'color-mix(in srgb, var(--good,#39c07a) 35%, transparent)', textDecoration: 'none' }} title="Đã sinh — mở plays của project để duyệt các draft fan-out">✓ {fo.count} draft → duyệt</a>
          : null}
        <button type="button" onClick={() => setEdit(s)} style={{ ...btn, padding: '3px 8px' }} title="Sửa">✎</button>
        {archived
          ? <button type="button" disabled={busy === s.id} onClick={() => setStatus(s.id, 'active')} style={{ ...btn, padding: '3px 8px' }} title="Khôi phục">♻</button>
          : <button type="button" disabled={busy === s.id} onClick={() => setStatus(s.id, 'archived')} style={{ ...btn, padding: '3px 8px' }} title="Lưu kho (archived)">🗄</button>}
      </div>
    );
  };

  return (
    <div style={{ padding: '12px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Phương pháp <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginLeft: 8 }}>// catalog · {list.length}{archived ? ' (kho lưu)' : ''}</small></h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href="/plays" style={{ ...btn, textDecoration: 'none' }} title="Về bảng quản lý task">← Plays (task)</a>
          <button type="button" onClick={() => setEdit({})} style={{ ...btn, color: 'var(--accent)', fontWeight: 700 }}>➕ Thêm phương pháp</button>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.5 }}>
        Kho <b>phương pháp dùng chung</b> (mẫu). Vào 1 project → Plays → “Seed từ catalog” để biến 1 phương pháp thành task. Sửa template ở đây <b>lan xuống mọi task đã seed</b>.
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 tìm tên / URL / tag / template…" autoComplete="off" style={{ ...btn, flex: '1 1 220px', minWidth: 160, cursor: 'text', background: 'var(--bg-1)' }} />
        <button type="button" onClick={() => setPlayOnly((v) => !v)} style={chip(playOnly)} title="Chỉ phương pháp (tag 'play'). Tắt = xem cả nguồn backlink lẻ.">chỉ phương pháp</button>
        <button type="button" onClick={toggleArchived} style={chip(archived, 'var(--fg-2)')} title="Xem kho lưu (archived)">🗄 kho lưu</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)' }}>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600 }}>🎯 Sinh fan-out cho project:</span>
        <select value={genProject} onChange={(e) => setGenProject(e.target.value)} style={{ ...btn, cursor: 'pointer', padding: '4px 8px', background: 'var(--bg-2)' }}>
          <option value="">— chọn project —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.emoji ? p.emoji + ' ' : ''}{p.name}</option>)}
        </select>
        {genProject
          ? <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>→ bấm 🎯 ở method → Claude research target THẬT → draft chờ duyệt ở <code>/p/{genProject}/plays</code></span>
          : <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>chọn project để bật nút 🎯 sinh trên từng method</span>}
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 2 }}>Nhóm</span>
        <button type="button" onClick={() => setNhom('')} style={chip(!nhom)}>tất cả</button>
        {nhomCounts.map(([g, n]) => <button key={g} type="button" onClick={() => setNhom(nhom === g ? '' : g)} style={chip(nhom === g)}>{groupLabel(g)} <span style={{ opacity: 0.6 }}>{n}</span></button>)}
      </div>

      {nhom === 'leads' && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginBottom: 8 }}>NGAY = harvest tay (ra lead sớm, proof) · NHANH = organic (Pinterest/pSEO) · TRUNG = authority (Digital-PR/email) · TRẢ TIỀN = ads (gated)</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
        {sections.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Không có phương pháp nào khớp.</div>}
        {sections.map((sec) => (
          <div key={sec.key}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-2)', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
              {sec.label} <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>{sec.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{sec.items.map(row)}</div>
          </div>
        ))}
      </div>

      {edit && <SourceEditor initial={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await reload(); }} />}
    </div>
  );
}
