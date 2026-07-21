'use client';

// EntityPicker — canonical "choose an entity OR create/rename/delete inline" modal. One reusable primitive
// for any pick-with-CRUD surface (send-as identity, account, sender, tag owner…). Richer than <ResourcePicker>
// (which is pick-or-delegate-create only): this owns the full inline CRUD + rich rows (avatar · label · badge ·
// match ✓ · secondary line). The caller supplies data via async callbacks + an opaque `data` payload per option,
// so the primitive stays domain-agnostic. House modal classes → matches every other picker. See
// feedback_picker_inline_crud + feedback_reuse_house_drawer_primitives.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

export interface EntityOption {
  key: string;               // stable unique key (caller controls) — used for selection + edit/delete addressing
  label: string;
  sub?: string;              // secondary line (mono) — followers · url · platform · whatever the caller composes
  avatar?: string;           // image URL
  fallbackIcon?: string;     // shown when no avatar (default '•')
  badge?: string;            // small chip after the label (e.g. '⬇ Directus')
  badgeTitle?: string;
  match?: boolean;           // shows ✓ — the recommended/best option
  editable?: boolean;        // enables ✎ rename / ✕ delete (only if onRename/onDelete also provided)
  data?: unknown;            // opaque payload — the caller recovers its domain object here
}

export interface EntityPickerProps {
  title: string;
  hint?: string;
  load: () => Promise<EntityOption[]>;
  onPick: (o: EntityOption) => void | Promise<void>;   // parent typically closes; async → row shows busy
  onClose: () => void;
  onCreate?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onRename?: (o: EntityOption, name: string) => Promise<{ ok: boolean; error?: string }>;
  onDelete?: (o: EntityOption) => Promise<{ ok: boolean; error?: string }>;
  value?: { key?: string };          // currently-selected key → highlight
  createPlaceholder?: string;        // default 'Tạo mới…'
  emptyHint?: ReactNode;             // shown when the list is empty (no search)
  searchThreshold?: number;          // show the filter box when opts exceed this (default 6)
  zIndex?: number;                   // default 500 — above stacked drawers (z 320)
}

const avatarStyle: CSSProperties = { width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--bg-3)' };

export function EntityPicker({
  title, hint, load, onPick, onClose, onCreate, onRename, onDelete,
  value, createPlaceholder = 'Tạo mới…', emptyHint, searchThreshold = 6, zIndex = 500,
}: EntityPickerProps) {
  const [opts, setOpts] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const reload = async () => { setOpts(await load()); setLoading(false); };
  useEffect(() => { let live = true; load().then((o) => { if (live) { setOpts(o); setLoading(false); } }); return () => { live = false; }; }, [load]);
  // Intercept Escape in CAPTURE phase so it closes THIS picker, not the drawer underneath (whose document
  // keydown listener also handles Escape). Editing → cancel edit first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.stopPropagation(); setEditKey((cur) => { if (cur != null) return null; onClose(); return null; }); };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? opts.filter((o) => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(ql)) : opts;
  }, [opts, q]);

  const pick = async (o: EntityOption) => {
    setBusy('pick:' + o.key); setErr(null);
    try { await onPick(o); }               // parent decides (select + close, or adopt-then-select)
    catch (e) { setErr((e as Error).message || 'lỗi chọn'); setBusy(null); }
  };
  const create = async () => {
    const h = newName.trim(); if (!h || !onCreate) return;
    setBusy('create'); setErr(null);
    const r = await onCreate(h);
    setBusy(null);
    if (r.ok) { setNewName(''); await reload(); } else setErr(r.error || 'lỗi tạo');
  };
  const saveRename = async (o: EntityOption) => {
    const h = editName.trim(); if (!h || !onRename) { setEditKey(null); return; }
    setBusy('rename'); setErr(null);
    const r = await onRename(o, h);
    setBusy(null);
    if (r.ok) { setEditKey(null); await reload(); } else setErr(r.error || 'lỗi sửa');
  };
  const doDelete = async (o: EntityOption) => {
    if (!onDelete) return;
    setBusy('del'); setErr(null);
    const r = await onDelete(o);
    setBusy(null); setConfirmDel(null);
    if (r.ok) await reload(); else setErr(r.error || 'lỗi xoá');
  };

  const canEdit = (o: EntityOption) => o.editable && (!!onRename || !!onDelete);

  return (
    <div className="modal-backdrop" style={{ zIndex }} onClick={onClose}>
      <div className="modal" style={{ width: 'min(460px, 100%)', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
            {hint && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{hint}</div>}
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onCreate && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} placeholder={createPlaceholder} autoFocus
                style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
              <button type="button" className="btn primary" onClick={create} disabled={!newName.trim() || !!busy} style={{ padding: '6px 12px' }}>{busy === 'create' ? '…' : '＋ Tạo'}</button>
            </div>
          )}

          {opts.length > searchThreshold && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm…"
              style={{ padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
          )}

          {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>✗ {err}</div>}

          {loading ? <div style={{ padding: 12, color: 'var(--fg-3)', fontSize: 12 }}>Đang tải…</div>
            : filtered.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px dashed var(--line)' }}>
                {q.trim() ? <>Không match &ldquo;{q}&rdquo;.</> : (emptyHint || 'Chưa có mục nào.')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: '46vh', overflow: 'auto' }}>
                {filtered.map((o) => {
                  const selected = value?.key != null && value.key === o.key;
                  if (editKey === o.key) return (
                    <div key={o.key} style={{ display: 'flex', gap: 6, padding: '4px 6px' }}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(o); if (e.key === 'Escape') setEditKey(null); }} autoFocus
                        style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
                      <button type="button" className="btn primary" onClick={() => saveRename(o)} disabled={!!busy} style={{ padding: '4px 9px' }}>Lưu</button>
                      <button type="button" className="btn ghost" onClick={() => setEditKey(null)} style={{ padding: '4px 9px' }}>Huỷ</button>
                    </div>
                  );
                  const picking = busy === 'pick:' + o.key;
                  return (
                    <div key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: selected ? 'color-mix(in srgb, var(--neon-lime) 12%, transparent)' : 'transparent', border: '1px solid ' + (selected ? 'var(--neon-lime)' : 'transparent') }}>
                      <button type="button" onClick={() => pick(o)} disabled={!!busy} className="btn ghost" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', opacity: busy && !picking ? 0.5 : 1 }}>
                        {o.avatar ? <img src={o.avatar} alt="" style={avatarStyle} referrerPolicy="no-referrer" /> : <span style={{ ...avatarStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--fg-3)' }}>{o.fallbackIcon || '•'}</span>}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--fg-0)' }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                            {o.match && !o.badge && <span style={{ color: 'var(--neon-lime)', flexShrink: 0 }}>✓</span>}
                            {o.badge && <span title={o.badgeTitle} style={{ fontSize: 9, padding: '0 5px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-3)', flexShrink: 0 }}>{o.badge}</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picking ? '…' : (o.sub || '')}</span>
                        </span>
                      </button>
                      {canEdit(o) && (confirmDel === o.key ? (
                        <>
                          <button type="button" className="btn ghost" onClick={() => doDelete(o)} disabled={!!busy} style={{ padding: '2px 7px', fontSize: 11, color: 'var(--bad)' }}>Xoá thật</button>
                          <button type="button" className="btn ghost" onClick={() => setConfirmDel(null)} style={{ padding: '2px 7px', fontSize: 11 }}>Huỷ</button>
                        </>
                      ) : (
                        <>
                          {onRename && <button type="button" className="btn ghost" title="Đổi tên" onClick={() => { setEditKey(o.key); setEditName(o.label.replace(/^@/, '')); }} style={{ padding: '2px 6px', fontSize: 11 }}>✎</button>}
                          {onDelete && <button type="button" className="btn ghost" title="Xoá" onClick={() => setConfirmDel(o.key)} style={{ padding: '2px 6px', fontSize: 11, color: 'var(--fg-3)' }}>✕</button>}
                        </>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
