'use client';

// Catalog source / play editor. Shared by /plays (backlinks-page seed drawer) and /catalog (methods
// management). Create = upsert by canonical_url; edit targets the id. Template edits propagate to every
// seeded task via syncTasksFromSource (server-side). Kept standalone so the catalog route doesn't pull
// in the whole backlinks-page module.
import { useState, type CSSProperties } from 'react';
import { Drawer } from '@/components/ui';
import { upsertBacklinkSource, type BacklinkSource } from '@/lib/actions/backlink-catalog';

const CATEGORIES = ['community', 'editorial', 'pr', 'guest-post', 'directory', 'tool-dir', 'launch', 'qa', 'forum', 'wiki', 'reference', 'dev', 'listicle', 'social', 'edu-resource', 'haro', 'llms'];
const btn: CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };

export function SourceEditor({ initial, onClose, onSaved }: { initial: BacklinkSource | Record<string, never>; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const s = initial as Partial<BacklinkSource>;
  const [name, setName] = useState(s.name ?? '');
  const [url, setUrl] = useState(s.canonicalUrl ?? '');
  const [category, setCategory] = useState(s.category ?? '');
  const [dofollow, setDofollow] = useState(s.dofollow ?? '');
  const [da, setDa] = useState(s.da ?? '');
  const [traffic, setTraffic] = useState(s.traffic ?? '');
  const [aud, setAud] = useState((s.audienceTags ?? []).join(', '));
  const [platformKey, setPlatformKey] = useState(s.platformKey ?? '');
  const [gates, setGates] = useState(s.gates ?? '');
  const [tpl, setTpl] = useState(s.instructionTemplate ?? '');
  const [status, setStatus] = useState(s.sourceStatus ?? 'active');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const r = await upsertBacklinkSource({ id: s.id, canonicalUrl: url, name, category, dofollow, da, traffic, audienceTags: aud.split(',').map((x) => x.trim()).filter(Boolean), instructionTemplate: tpl, gates, platformKey, sourceStatus: status });
    setBusy(false);
    if (r.ok) await onSaved(); else setErr(r.error || 'lỗi');
  };
  const field: CSSProperties = { fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-0)', width: '100%', boxSizing: 'border-box' };
  const lbl: CSSProperties = { fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3, display: 'block' };
  return (
    <Drawer onClose={onClose} width={560} zIndex={300}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{s.id ? '✎ Sửa phương pháp' : '➕ Phương pháp mới'}</h2>
        <button type="button" onClick={onClose} style={{ ...btn, padding: '2px 9px' }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div><label style={lbl}>Tên *</label><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" style={field} /></div>
        <div><label style={lbl}>URL hành động *</label><input value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" placeholder="https://…/submit" style={field} /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Channel (kênh/loại post)</label>
            <select value={category ?? ''} onChange={(e) => setCategory(e.target.value)} style={field}>
              <option value="">—</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div style={{ flex: 1 }}><label style={lbl}>Dofollow</label>
            <select value={dofollow ?? ''} onChange={(e) => setDofollow(e.target.value)} style={field}>
              <option value="">—</option>{['dofollow', 'nofollow', 'mixed'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>DA</label><input value={da ?? ''} onChange={(e) => setDa(e.target.value)} autoComplete="off" style={field} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Traffic</label><input value={traffic ?? ''} onChange={(e) => setTraffic(e.target.value)} autoComplete="off" style={field} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Platform key</label><input value={platformKey ?? ''} onChange={(e) => setPlatformKey(e.target.value)} autoComplete="off" style={field} /></div>
        </div>
        <div><label style={lbl}>Tags — nhóm/niche/level (phẩy)</label><input value={aud} onChange={(e) => setAud(e.target.value)} autoComplete="off" placeholder="leads, level-1, universal, military… · 'play' = là phương pháp · 'universal' = mọi niche" style={field} /></div>
        <div><label style={lbl}>Gates / điều kiện</label><input value={gates ?? ''} onChange={(e) => setGates(e.target.value)} autoComplete="off" style={field} /></div>
        <div><label style={lbl}>Instruction template (chỗ trống {'{product}'} / {'{domain}'} / {'{link}'})</label><textarea value={tpl ?? ''} onChange={(e) => setTpl(e.target.value)} rows={9} style={{ ...field, fontFamily: 'var(--font-mono)', fontSize: 11.5, resize: 'vertical' }} /></div>
        <div><label style={lbl}>Trạng thái</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={field}>{['active', 'needs-review', 'broken', 'archived'].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
        <button type="button" onClick={save} disabled={busy || !name.trim() || !url.trim()} style={{ ...btn, background: 'var(--accent)', color: '#fff', borderColor: 'transparent', fontWeight: 700 }}>{busy ? '⏳ lưu…' : '💾 Lưu'}</button>
        {err && <span style={{ fontSize: 12, color: 'var(--bad,#ef4444)' }}>✗ {err}</span>}
      </div>
    </Drawer>
  );
}
