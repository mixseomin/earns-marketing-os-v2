'use client';

// EntityPicker — canonical "choose an entity OR create/edit/delete" surface. One reusable primitive for any
// pick-with-CRUD list (send-as identity, account, sender, tag owner…). Built on the house <Drawer> (right
// slide-over, stacks via `backgrounded`) — NOT a bespoke modal. Richer than <ResourcePicker> (pick-or-delegate
// only): inline create, rich rows (avatar · label · badge · secondary line), the SELECTED row highlighted +
// auto-scrolled into view, and TWO edit modes:
//   • renderEditor(o, close) → open a stacked detail Drawer with the entity's full fields (rich entities).
//   • onRename(o, name)      → inline single-field rename (simple entities), used only when no renderEditor.
// Delete is OPT-IN (only shows when onDelete is passed) and always confirms. The caller supplies data via async
// callbacks + an opaque `data` payload per option. See feedback_picker_inline_crud + feedback_stacked_drawer.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Drawer } from './drawer';

export interface EntityOption {
  key: string;               // stable unique key (caller controls) — selection + edit/delete addressing
  label: string;
  sub?: string;              // secondary line (mono) — followers · url · platform · whatever the caller composes
  avatar?: string;           // image URL
  fallbackIcon?: string;     // shown when no avatar (default '•')
  badge?: string;            // small chip after the label (e.g. '⬇ Directus')
  badgeTitle?: string;
  match?: boolean;           // shows ✓ — a recommended option (leave false unless genuinely "best")
  editable?: boolean;        // enables edit (✎) / delete (✕) affordances for this row
  data?: unknown;            // opaque payload — the caller recovers its domain object here
}

export interface EntityPickerProps {
  title: string;
  hint?: string;
  load: () => Promise<EntityOption[]>;
  onPick: (o: EntityOption) => void | Promise<void>;   // parent typically closes; async → row shows busy
  onClose: () => void;
  onCreate?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Rich edit/create: open a stacked detail drawer for the whole entity. o=null → create a new one.
   *  Preferred for multi-field entities (the create button opens this instead of an inline name box). */
  renderEditor?: (o: EntityOption | null, close: () => void) => ReactNode;
  /** Inline single-field rename — used only when renderEditor is absent. */
  onRename?: (o: EntityOption, name: string) => Promise<{ ok: boolean; error?: string }>;
  /** OPT-IN delete (row shows ✕ only when this is passed). Always confirms before firing. */
  onDelete?: (o: EntityOption) => Promise<{ ok: boolean; error?: string }>;
  value?: { key?: string };          // currently-selected key → highlight + scroll into view
  createPlaceholder?: string;        // default 'Tạo mới…'
  emptyHint?: ReactNode;             // shown when the list is empty (no search)
  searchThreshold?: number;          // show the filter box when opts exceed this (default 6)
  zIndex?: number;                   // Drawer backdrop z (panel sits at z+1). Default 500 — above stacked drawers.
}

const avatarStyle: CSSProperties = { width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--bg-3)' };
const iconBtn: CSSProperties = { padding: '2px 6px', fontSize: 11 };

export function EntityPicker({
  title, hint, load, onPick, onClose, onCreate, renderEditor, onRename, onDelete,
  value, createPlaceholder = 'Tạo mới…', emptyHint, searchThreshold = 6, zIndex = 500,
}: EntityPickerProps) {
  const [opts, setOpts] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);     // inline rename target
  const [editName, setEditName] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null); // rich-editor target (edit existing)
  const [creating, setCreating] = useState(false);                  // rich-editor in create mode (o=null)
  const selRef = useRef<HTMLDivElement | null>(null);

  const reload = async () => { setOpts(await load()); setLoading(false); };
  useEffect(() => { let live = true; load().then((o) => { if (live) { setOpts(o); setLoading(false); } }); return () => { live = false; }; }, [load]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? opts.filter((o) => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(ql)) : opts;
  }, [opts, q]);

  // Bring the currently-selected row into view once the list is loaded — a selection near the bottom of a long
  // list was invisible otherwise (user report).
  useEffect(() => { if (!loading && value?.key && selRef.current) selRef.current.scrollIntoView({ block: 'nearest' }); }, [loading, value?.key, filtered.length]);

  const pick = async (o: EntityOption) => {
    setBusy('pick:' + o.key); setErr(null);
    try { await onPick(o); } catch (e) { setErr((e as Error).message || 'lỗi chọn'); setBusy(null); }
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
  const startEdit = (o: EntityOption) => {
    if (renderEditor) { setDetailKey(o.key); return; }        // rich edit → stacked detail drawer
    setEditKey(o.key); setEditName(o.label.replace(/^@/, '')); // inline rename fallback
  };

  const detailOpt = detailKey != null ? opts.find((o) => o.key === detailKey) : undefined;
  const editorOpen = creating || !!detailOpt;

  return (
    <>
      <Drawer onClose={onClose} width={440} zIndex={zIndex} backgrounded={editorOpen} closeOnOutside padding={0}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '16px 18px 12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--fg-0)' }}>{title}</h2>
              {hint && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>{hint}</div>}
            </div>
            <button className="btn ghost" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderEditor ? (
              // Rich entity → create opens the SAME detail drawer (empty) so the user fills all fields.
              <button type="button" className="btn primary" onClick={() => setCreating(true)} style={{ padding: '9px 12px', width: '100%', fontWeight: 700 }}>＋ Tạo mới</button>
            ) : onCreate ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} placeholder={createPlaceholder}
                  style={{ flex: 1, padding: '7px 9px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
                <button type="button" className="btn primary" onClick={create} disabled={!newName.trim() || !!busy} style={{ padding: '7px 13px' }}>{busy === 'create' ? '…' : '＋ Tạo'}</button>
              </div>
            ) : null}

            {opts.length > searchThreshold && (
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm…"
                style={{ padding: '7px 9px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
            )}

            {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>✗ {err}</div>}

            {loading ? <div style={{ padding: 14, color: 'var(--fg-3)', fontSize: 12 }}>Đang tải…</div>
              : filtered.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px dashed var(--line)' }}>
                  {q.trim() ? <>Không match &ldquo;{q}&rdquo;.</> : (emptyHint || 'Chưa có mục nào.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {filtered.map((o) => {
                    const selected = value?.key != null && value.key === o.key;
                    if (editKey === o.key) return (
                      <div key={o.key} style={{ display: 'flex', gap: 6, padding: '4px 6px' }}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(o); if (e.key === 'Escape') { e.nativeEvent.stopImmediatePropagation(); setEditKey(null); } }} autoFocus
                          style={{ flex: 1, padding: '6px 9px', background: 'var(--bg-2)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
                        <button type="button" className="btn primary" onClick={() => saveRename(o)} disabled={!!busy} style={{ padding: '5px 10px' }}>Lưu</button>
                        <button type="button" className="btn ghost" onClick={() => setEditKey(null)} style={{ padding: '5px 10px' }}>Huỷ</button>
                      </div>
                    );
                    const picking = busy === 'pick:' + o.key;
                    const canEdit = o.editable && (!!renderEditor || !!onRename);
                    const canDel = o.editable && !!onDelete;
                    return (
                      <div key={o.key} ref={selected ? selRef : undefined}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, background: selected ? 'color-mix(in srgb, var(--neon-lime) 12%, transparent)' : 'transparent', border: '1px solid ' + (selected ? 'var(--neon-lime)' : 'transparent') }}>
                        <button type="button" onClick={() => pick(o)} disabled={!!busy} className="btn ghost" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'none', opacity: busy && !picking ? 0.5 : 1 }}>
                          {o.avatar ? <img src={o.avatar} alt="" style={avatarStyle} referrerPolicy="no-referrer" /> : <span style={{ ...avatarStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--fg-3)' }}>{o.fallbackIcon || '•'}</span>}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--fg-0)' }}>
                              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                              {o.match && !o.badge && <span style={{ color: 'var(--neon-lime)', flexShrink: 0 }}>✓</span>}
                              {o.badge && <span title={o.badgeTitle} style={{ fontSize: 9, padding: '0 5px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-3)', flexShrink: 0 }}>{o.badge}</span>}
                            </span>
                            <span style={{ display: 'block', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{picking ? '…' : (o.sub || '')}</span>
                          </span>
                          {selected && <span style={{ fontSize: 9, color: 'var(--neon-lime)', flexShrink: 0, fontWeight: 700 }}>● đang chọn</span>}
                        </button>
                        {canEdit && confirmDel !== o.key && <button type="button" className="btn ghost" title="Sửa chi tiết" onClick={() => startEdit(o)} style={iconBtn}>✎</button>}
                        {canDel && (confirmDel === o.key ? (
                          <>
                            <button type="button" className="btn ghost" onClick={() => doDelete(o)} disabled={!!busy} style={{ ...iconBtn, color: 'var(--bad)' }}>Xoá thật</button>
                            <button type="button" className="btn ghost" onClick={() => setConfirmDel(null)} style={iconBtn}>Huỷ</button>
                          </>
                        ) : (
                          <button type="button" className="btn ghost" title="Xoá" onClick={() => setConfirmDel(o.key)} style={{ ...iconBtn, color: 'var(--fg-3)' }}>✕</button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      </Drawer>
      {editorOpen && renderEditor && renderEditor(creating ? null : (detailOpt as EntityOption), () => { setCreating(false); setDetailKey(null); reload(); })}
    </>
  );
}
