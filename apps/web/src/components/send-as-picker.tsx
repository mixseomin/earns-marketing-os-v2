'use client';

// SendAsPicker — reusable "comment/DM as" identity picker with full CRUD. Choose from the list (search),
// create new inline, rename or delete (global accounts only). One shared object instead of an ad-hoc
// select + text box. Uses the house modal classes so it matches every other picker. See feedback_picker_inline_crud.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { listSendAs, addSendAsAccount, renameSendAsAccount, deleteSendAsAccount, type SendAsOption, type SentAs } from '@/lib/actions/outreach-touches';

const optKey = (o: SendAsOption) => `${o.kind}:${o.id}`;
const avatarStyle: CSSProperties = { width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--bg-3)' };

export function SendAsPicker({ projectId, channel, value, onPick, onClose }: {
  projectId: string; channel: string; value?: SentAs; onPick: (sa: SentAs) => void; onClose: () => void;
}) {
  const [opts, setOpts] = useState<SendAsOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const reload = async () => { setOpts(await listSendAs(projectId, channel)); setLoading(false); };
  useEffect(() => { let live = true; listSendAs(projectId, channel).then((o) => { if (live) { setOpts(o); setLoading(false); } }); return () => { live = false; }; }, [projectId, channel]);
  // Intercept Escape in CAPTURE phase so it closes THIS picker, not the drawer underneath (whose document
  // keydown listener also handles Escape). Editing → cancel edit first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; e.stopPropagation(); setEditId((cur) => { if (cur != null) return null; onClose(); return null; }); };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? opts.filter((o) => (o.label + ' ' + o.sub).toLowerCase().includes(ql)) : opts;
  }, [opts, q]);

  const pick = (o: SendAsOption) => onPick({ kind: o.kind, id: o.id, label: o.label });
  const create = async () => {
    const h = newName.trim(); if (!h) return;
    setBusy('create'); setErr(null);
    const r = await addSendAsAccount(projectId, channel, h);
    setBusy(null);
    if (r.ok && r.option) { setNewName(''); await reload(); }   // stays open → xem/sửa/chọn
    else setErr(r.error || 'lỗi tạo');
  };
  const saveRename = async (id: number) => {
    const h = editName.trim(); if (!h) { setEditId(null); return; }
    setBusy('rename'); setErr(null);
    const r = await renameSendAsAccount(id, h);
    setBusy(null);
    if (r.ok) { setEditId(null); await reload(); } else setErr(r.error || 'lỗi sửa');
  };
  const doDelete = async (id: number) => {
    setBusy('del'); setErr(null);
    const r = await deleteSendAsAccount(id);
    setBusy(null); setConfirmDel(null);
    if (r.ok) await reload(); else setErr(r.error || 'lỗi xoá');
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 500 }} onClick={onClose}>{/* above the stacked Outreach drawer (z 320) */}
      <div className="modal" style={{ width: 'min(460px, 100%)', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>Gửi bằng — chọn danh tính</h2>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Page/account bạn sở hữu (dùng chung mọi dự án). Chọn, tạo mới, sửa hoặc xoá.</div>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* CREATE (proactive add) */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} placeholder="Tạo mới: nhập tên Page/account…" autoFocus
              style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
            <button type="button" className="btn primary" onClick={create} disabled={!newName.trim() || !!busy} style={{ padding: '6px 12px' }}>{busy === 'create' ? '…' : '＋ Tạo'}</button>
          </div>

          {/* SEARCH */}
          {opts.length > 6 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm…"
              style={{ padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
          )}

          {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>✗ {err}</div>}

          {/* LIST */}
          {loading ? <div style={{ padding: 12, color: 'var(--fg-3)', fontSize: 12 }}>Đang tải…</div>
            : filtered.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px dashed var(--line)' }}>
                {q.trim() ? <>Không match &ldquo;{q}&rdquo;.</> : <>Chưa có danh tính. Tạo mới ở trên, hoặc nhập hàng loạt bằng nút <b>⬇ Nhập Pages</b> của ext trên facebook.com.</>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: '46vh', overflow: 'auto' }}>
                {filtered.map((o) => {
                  const selected = value?.kind === o.kind && value?.id === o.id;
                  if (editId === o.id) return (
                    <div key={optKey(o)} style={{ display: 'flex', gap: 6, padding: '4px 6px' }}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(o.id); if (e.key === 'Escape') setEditId(null); }} autoFocus
                        style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none' }} />
                      <button type="button" className="btn primary" onClick={() => saveRename(o.id)} disabled={!!busy} style={{ padding: '4px 9px' }}>Lưu</button>
                      <button type="button" className="btn ghost" onClick={() => setEditId(null)} style={{ padding: '4px 9px' }}>Huỷ</button>
                    </div>
                  );
                  return (
                    <div key={optKey(o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: selected ? 'color-mix(in srgb, var(--neon-lime) 12%, transparent)' : 'transparent', border: '1px solid ' + (selected ? 'var(--neon-lime)' : 'transparent') }}>
                      <button type="button" onClick={() => pick(o)} className="btn ghost" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none' }}>
                        {o.avatar ? <img src={o.avatar} alt="" style={avatarStyle} referrerPolicy="no-referrer" /> : <span style={{ ...avatarStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--fg-3)' }}>{o.kind === 'identity' ? '👤' : '•'}</span>}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}{o.match ? ' ✓' : ''}</span>
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{o.sub}</span>
                        </span>
                      </button>
                      {o.editable && (confirmDel === o.id ? (
                        <>
                          <button type="button" className="btn ghost" onClick={() => doDelete(o.id)} disabled={!!busy} style={{ padding: '2px 7px', fontSize: 11, color: 'var(--bad)' }}>Xoá thật</button>
                          <button type="button" className="btn ghost" onClick={() => setConfirmDel(null)} style={{ padding: '2px 7px', fontSize: 11 }}>Huỷ</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn ghost" title="Đổi tên" onClick={() => { setEditId(o.id); setEditName(o.label.replace(/^@/, '')); }} style={{ padding: '2px 6px', fontSize: 11 }}>✎</button>
                          <button type="button" className="btn ghost" title="Xoá" onClick={() => setConfirmDel(o.id)} style={{ padding: '2px 6px', fontSize: 11, color: 'var(--fg-3)' }}>✕</button>
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
