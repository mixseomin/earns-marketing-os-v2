'use client';

import { useState, useMemo, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { KnowledgeRow } from '@/lib/data';
import { Pill, EmptyState, Drawer, ListToolbar, FilterChips, Pager, usePaged } from './ui';
import { useModalParam } from '@/lib/use-modal-param';
import { detectTemplateVars } from '@/lib/knowledge-vars';
import {
  createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem,
  referenceKnowledge, unreferenceKnowledge,
} from '@/lib/actions/knowledge';

const KIND_COLOR: Record<string, string> = {
  playbook: '#fbbf24', prompt: '#a78bfa', template: '#10b981', lesson: '#38bdf8', gotcha: '#f87171',
};
const KINDS = ['playbook', 'prompt', 'template', 'lesson', 'gotcha'];

function fmtDate(d: Date): string {
  const day = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (day < 1) return 'today';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return new Date(d).toLocaleDateString();
}

export function KnowledgeVault({ items, sharedCatalog, projectName, projectId }: {
  items: KnowledgeRow[]; sharedCatalog: KnowledgeRow[]; projectName: string; projectId: string;
}) {
  const [filterKind, setFilterKind] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<KnowledgeRow | null>(null);
  const [editItem, setEditItem] = useState<KnowledgeRow | 'new' | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const modal = useModalParam();   // ?m=knowledge-view|knowledge-edit&mId=<id> | ?m=knowledge-new — house URL-sync standard

  const kinds = useMemo(() => Array.from(new Set(items.map((i) => i.kind))), [items]);
  const filtered = useMemo(() => items.filter((i) => {
    if (filterKind !== 'all' && i.kind !== filterKind) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${i.title} ${i.rendered ?? i.content}`.toLowerCase();
      if (!hay.includes(q) && !i.tags.some((t) => t.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [items, filterKind, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[i.kind] = (c[i.kind] ?? 0) + 1;
    return c;
  }, [items]);
  const chipOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...kinds.map((k) => ({ value: k, label: k }))],
    [kinds],
  );
  const { pageItems, ...pager } = usePaged(filtered);

  // All open/close for the item drawers routes through these so the URL (useModalParam)
  // always mirrors which drawer is open; F5 / share-link reopens it (restore effect below).
  const openView = (k: KnowledgeRow) => { setOpenItem(k); modal.open('knowledge-view', k.id); };
  const openNew = () => { setEditItem('new'); modal.open('knowledge-new'); };
  const openEdit = (k: KnowledgeRow) => { setOpenItem(null); setEditItem(k); modal.open('knowledge-edit', k.id); };
  const closeView = () => { setOpenItem(null); modal.close(); };
  const closeEdit = () => { setEditItem(null); modal.close(); };

  // Deep-link restore on mount: ?m=knowledge-view|knowledge-edit&mId=<id> reopens that drawer, knowledge-new opens create.
  useEffect(() => {
    if (modal.is('knowledge-new')) { setEditItem('new'); return; }
    if (modal.is('knowledge-edit') && modal.id) { const k = items.find((i) => String(i.id) === modal.id && !i.isRef); if (k) setEditItem(k); return; }
    if (modal.is('knowledge-view') && modal.id) { const k = items.find((i) => String(i.id) === modal.id); if (k) setOpenItem(k); }
  }, []);   // mount only — restore the drawer the URL points at

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            📚 Knowledge <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>// {items.length} items · {projectName}</small>
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-3)' }}>
            Knowledge riêng của project + template chung đã tham khảo (📎, biến điền theo project).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost" onClick={() => setShowPicker(true)} title="Tham khảo template từ Knowledge chung">📎 Tham khảo từ chung</button>
          <button className="btn ghost" onClick={openNew} title="Tạo knowledge riêng cho project này">➕ Riêng</button>
        </div>
      </div>

      <ListToolbar search={search} onSearch={setSearch} searchPlaceholder="Search title/content/tag…">
        <FilterChips value={filterKind} onChange={setFilterKind} counts={counts} options={chipOptions} />
      </ListToolbar>

      {items.length === 0 ? (
        <EmptyState icon="📚" title={`Chưa có knowledge cho ${projectName}`}
          description="Bấm 📎 Tham khảo từ chung để dùng template dùng chung (biến điền theo project), hoặc ➕ Riêng để tạo knowledge riêng." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Không có knowledge match filter" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {pageItems.map((k) => {
            const isFresh = (Date.now() - new Date(k.updatedAt).getTime()) < 5 * 60_000;
            return (
              <div key={`${k.isRef ? 'ref' : 'own'}-${k.id}`} className="panel" style={{
                cursor: 'pointer',
                borderLeft: isFresh ? '3px solid var(--ok)' : undefined,
              }} onClick={() => openView(k)}>
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Pill color="var(--fg-3)" label={k.kind} size="xs" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {k.isRef && <span style={{ color: 'var(--fg-3)', marginRight: 5 }} title="Tham khảo từ Knowledge chung">📎</span>}
                      {k.title}
                      {isFresh && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>● NEW</span>}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{k.isRef ? 'shared template' : 'riêng'}</span>
                      <span>·</span>
                      <span>{fmtDate(k.updatedAt)}</span>
                      {k.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>▸</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pager {...pager} onPage={pager.setPage} />

      {openItem && <KnowledgeModal item={openItem} projectId={projectId}
        onClose={closeView}
        onEdit={openItem.isRef ? undefined : () => openEdit(openItem)} />}
      {editItem && <OwnEditor item={editItem === 'new' ? null : editItem} projectId={projectId} onClose={closeEdit} />}
      {showPicker && <SharedPicker catalog={sharedCatalog} projectId={projectId} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

// Drawer: browse the shared catalog, reference/unreference into this project.
function SharedPicker({ catalog, projectId, onClose }: { catalog: KnowledgeRow[]; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const shown = useMemo(() => catalog.filter((c) => !q || `${c.title} ${c.content} ${c.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())), [catalog, q]);

  const toggle = (item: KnowledgeRow, isOn: boolean) => start(async () => {
    setBusyId(item.id);
    if (isOn) await unreferenceKnowledge(projectId, item.id);
    else await referenceKnowledge(projectId, item.id, {});
    setBusyId(null);
    router.refresh();
  });

  return (
    <Drawer onClose={onClose} width={640}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📎 Tham khảo từ Knowledge chung</h2>
        <a href="/knowledge" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>↗ Quản lý catalog</a>
      </div>
      <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '0 0 10px' }}>Chọn template chung để dùng cho project này. Biến <code>{'{{product}}'}</code>… tự điền theo project. Đây là con trỏ — sửa template gốc ở /knowledge là mọi nơi cập nhật.</p>
      <input placeholder="tìm template…" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', marginBottom: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '68vh', overflowY: 'auto' }}>
        {shown.length === 0 ? <div style={{ fontSize: 12, color: 'var(--fg-4)', textAlign: 'center', padding: 16 }}>Không có template chung nào khớp.</div>
          : shown.map((c) => {
            const isOn = !!(c.refs && c.refs[projectId]);
            const vars = detectTemplateVars(c.content);
            return (
              <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', border: '1px solid var(--line)', borderRadius: 8, background: isOn ? 'color-mix(in srgb, var(--neon-violet) 10%, transparent)' : 'var(--bg-1)', padding: '8px 10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-1)' }}>
                    <span style={{ color: KIND_COLOR[c.kind] ?? 'var(--fg-3)', fontSize: 10, fontFamily: 'var(--font-mono)', marginRight: 6 }}>{c.kind}</span>{c.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {vars.length > 0 && <span style={{ color: 'var(--neon-violet)', fontFamily: 'var(--font-mono)' }}>{'{{'}{vars.join('}} {{')}{'}}'}</span>}
                    {c.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                  </div>
                </div>
                <button className="btn ghost" disabled={pending && busyId === c.id} onClick={() => toggle(c, isOn)}
                  style={{ flexShrink: 0, color: isOn ? 'var(--fg-3)' : 'var(--accent)' }}>
                  {busyId === c.id ? '…' : isOn ? '✓ đang dùng' : '＋ Dùng'}
                </button>
              </div>
            );
          })}
      </div>
    </Drawer>
  );
}

function KnowledgeModal({ item, projectId, onClose, onEdit }: { item: KnowledgeRow; projectId: string; onClose: () => void; onEdit?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const drop = () => start(async () => { await unreferenceKnowledge(projectId, item.id); onClose(); router.refresh(); });
  const body = item.isRef ? (item.rendered ?? item.content) : item.content;

  return (
    <Drawer onClose={onClose} width={720} padding={0}>
        <div className="modal-head">
          <div>
            <div className="id-line">{item.kind} · {item.isRef ? '📎 shared template' : 'riêng'}</div>
            <h2>{item.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {item.tags.length > 0 && (
            <div style={{ marginBottom: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {item.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}
          {item.isRef && <div style={{ fontSize: 10, color: 'var(--neon-violet)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>📎 Template chung — biến đã điền theo project. Sửa nội dung gốc ở <a href="/knowledge" style={{ color: 'var(--accent)' }}>/knowledge</a>.</div>}
          <pre style={{ margin: 0, padding: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, lineHeight: 1.6, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--fg-1)', maxHeight: 480, overflow: 'auto' }}>{body || '(empty)'}</pre>
        </div>
        <div className="modal-foot">
          <div className="meta">{item.importedFrom ?? (item.isRef ? 'reference' : 'manual')}</div>
          <div className="modal-foot-actions">
            {item.isRef && <button className="btn ghost" onClick={drop} disabled={pending} style={{ color: 'var(--bad,#ef4444)' }}>Bỏ tham khảo</button>}
            {onEdit && <button className="btn ghost" onClick={onEdit}>✎ Sửa</button>}
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
    </Drawer>
  );
}

// Create/edit a project-OWN knowledge item.
function OwnEditor({ item, projectId, onClose }: { item: KnowledgeRow | null; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState(item?.kind ?? 'playbook');
  const [title, setTitle] = useState(item?.title ?? '');
  const [content, setContent] = useState(item?.content ?? '');
  const [tagsStr, setTagsStr] = useState((item?.tags ?? []).join(', '));
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none' };
  const baselineRef = useRef<string>('');
  const snap = JSON.stringify({ kind, title, content, tagsStr });
  if (baselineRef.current === '') baselineRef.current = snap;
  const dirty = snap !== baselineRef.current;

  const save = () => start(async () => {
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    if (item) await updateKnowledgeItem(item.id, { kind, title, content, tags });
    else await createKnowledgeItem({ projectId, kind, title, content, tags });
    onClose(); router.refresh();
  });
  const del = () => start(async () => { if (item) await deleteKnowledgeItem(item.id); onClose(); router.refresh(); });

  return (
    <Drawer onClose={onClose} width={680} dirty={dirty} padding={0}>
        <div className="modal-head">
          <div>
            <div className="id-line">riêng · {projectId}{item ? ` · #${item.id}` : ''}</div>
            <h2>{item ? '✎ Sửa knowledge' : '➕ Knowledge riêng'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...field, width: 140, cursor: 'pointer' }}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} style={field} />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} placeholder="Nội dung knowledge riêng của project này."
            style={{ ...field, fontFamily: 'var(--font-mono)', lineHeight: 1.6, resize: 'vertical' }} />
          <input placeholder="tags (phẩy)" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} style={field} />
        </div>
        <div className="modal-foot">
          <div className="meta">
            {item && (confirmDel
              ? <button className="btn ghost" style={{ color: 'var(--bad,#ef4444)' }} onClick={del} disabled={pending}>⚠ Xoá thật?</button>
              : <button className="btn ghost" onClick={() => setConfirmDel(true)}>🗑 Xoá</button>)}
          </div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={save} disabled={pending || !title.trim()}>{pending ? 'Saving…' : item ? 'Lưu' : 'Tạo'}</button>
          </div>
        </div>
    </Drawer>
  );
}
