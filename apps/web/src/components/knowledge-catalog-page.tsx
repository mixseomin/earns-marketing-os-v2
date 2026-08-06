'use client';

import { useState, useMemo, useRef, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useModalParam } from '@/lib/use-modal-param';
import type { KnowledgeRow } from '@/lib/data';
import { detectTemplateVars } from '@/lib/knowledge-vars';
import { createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from '@/lib/actions/knowledge';
import { EmptyState, Drawer } from './ui';

const KIND_COLOR: Record<string, string> = {
  playbook: '#fbbf24', prompt: '#a78bfa', template: '#10b981', lesson: '#38bdf8', gotcha: '#f87171', source: '#22d3ee',
};
const KINDS = ['playbook', 'prompt', 'template', 'lesson', 'gotcha', 'source'];

type Proj = { id: string; name: string; emoji: string };

export function KnowledgeCatalogPage({ items, projects }: { items: KnowledgeRow[]; projects: Proj[] }) {
  const sp = useSearchParams();
  const [filterKind, setFilterKind] = useState(sp.get('kind') || 'all');
  const [search, setSearch] = useState('');
  // URL is source-of-truth for the editor drawer → F5 / share reopens it.
  // ?m=template-edit&mId=<id> (full row lives in `items`, no fetch) | ?m=template-new.
  const modal = useModalParam();
  const editing: KnowledgeRow | 'new' | null =
    modal.is('template-new') ? 'new'
      : modal.is('template-edit') ? (items.find((i) => i.id === modal.numId) ?? null)
        : null;
  const projName = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const kinds = useMemo(() => Array.from(new Set(items.map((i) => i.kind))), [items]);
  const filtered = useMemo(() => items.filter((i) => {
    if (filterKind !== 'all' && i.kind !== filterKind) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.content.toLowerCase().includes(q) && !i.tags.some((t) => t.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [items, filterKind, search]);

  return (
    <div style={{ padding: '16px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📚 Knowledge chung <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>// {items.length} shared templates</small></h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
            Template dùng chung cho mọi project. Hỗ trợ biến <code>{'{{product}}'}</code> <code>{'{{domain}}'}</code> <code>{'{{website}}'}</code> <code>{'{{one-liner}}'}</code>… — điền tự động khi 1 project tham khảo. Project chỉ thấy template nó tham khảo, không tràn mặc định.
          </p>
        </div>
        <button className="btn" onClick={() => modal.open('template-new')}>➕ Template mới</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="chip" data-active={filterKind === 'all' || undefined} onClick={() => setFilterKind('all')}>All</span>
        {kinds.map((k) => (
          <span key={k} className="chip" data-active={filterKind === k || undefined} onClick={() => setFilterKind(k)} style={{ color: KIND_COLOR[k] }}>
            {k} <span style={{ opacity: 0.6, marginLeft: 4 }}>{items.filter((i) => i.kind === k).length}</span>
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <input placeholder="Search title/content/tag…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 220 }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📚" title="Chưa có template chung" description="Bấm ➕ Template mới để tạo. Dùng {{biến}} để linh hoạt theo từng project." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filtered.map((k) => {
            const refIds = Object.keys(k.refs ?? {});
            const vars = detectTemplateVars(k.content);
            return (
              <div key={k.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => modal.open('template-edit', k.id)}>
                <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="tag" style={{ color: KIND_COLOR[k.kind] ?? 'var(--fg-3)', borderColor: 'currentColor' }}>{k.kind}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.title}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {vars.length > 0 && <span style={{ color: 'var(--neon-violet)' }}>{'{{'}{vars.join('}} {{')}{'}}'}</span>}
                      {k.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} title={refIds.length ? `Referenced by: ${refIds.map((id) => projName[id]?.name ?? id).join(', ')}` : 'Chưa project nào tham khảo'}>
                    {refIds.length === 0 ? <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>0 refs</span>
                      : refIds.slice(0, 5).map((id) => <span key={id} style={{ fontSize: 13 }}>{projName[id]?.emoji ?? '•'}</span>)}
                    {refIds.length > 5 && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>+{refIds.length - 5}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TemplateEditor item={editing === 'new' ? null : editing} projName={projName} onClose={() => modal.close()} />
      )}
    </div>
  );
}

function TemplateEditor({ item, projName, onClose }: { item: KnowledgeRow | null; projName: Record<string, Proj>; onClose: () => void }) {
  const [kind, setKind] = useState(item?.kind ?? 'playbook');
  const [title, setTitle] = useState(item?.title ?? '');
  const [content, setContent] = useState(item?.content ?? '');
  const [tagsStr, setTagsStr] = useState((item?.tags ?? []).join(', '));
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const vars = detectTemplateVars(content);
  const refIds = Object.keys(item?.refs ?? {});

  const form = { kind, title, content, tagsStr };
  const baselineRef = useRef<string>('');
  if (baselineRef.current === '') baselineRef.current = JSON.stringify(form);
  const dirty = JSON.stringify(form) !== baselineRef.current;

  const save = () => start(async () => {
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    if (item) await updateKnowledgeItem(item.id, { kind, title, content, tags });
    else await createKnowledgeItem({ projectId: null, kind, title, content, tags });
    onClose();
  });
  const del = () => start(async () => { if (item) await deleteKnowledgeItem(item.id); onClose(); });

  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none' };

  return (
    <Drawer onClose={onClose} width={720} dirty={dirty} padding={0}>
        <div className="modal-head">
          <div>
            <div className="id-line">shared template{item ? ` · #${item.id}` : ' · new'}</div>
            <h2>{item ? '✎ Sửa template' : '➕ Template mới'}</h2>
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
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} placeholder="Nội dung template. Dùng {{product}} {{domain}} {{website}} {{one-liner}} {{bio}} {{persona}} {{hashtags}} — điền theo project khi tham khảo."
            style={{ ...field, fontFamily: 'var(--font-mono)', lineHeight: 1.6, resize: 'vertical' }} />
          <input placeholder="tags (phẩy)" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} style={field} />
          <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 9 }}>Biến dùng:</span>
            {vars.length ? vars.map((v) => <span key={v} className="tag" style={{ color: 'var(--neon-violet)' }}>{'{{'}{v}{'}}'}</span>) : <span style={{ color: 'var(--fg-4)' }}>chưa có biến — thêm {'{{product}}'} để linh hoạt theo project</span>}
          </div>
          {refIds.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 9 }}>Đang tham khảo ({refIds.length}):</span>
              {refIds.map((id) => <span key={id} className="tag">{projName[id]?.emoji ?? '•'} {projName[id]?.name ?? id}</span>)}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <div className="meta">{item ? (confirmDel ? '' : '') : 'projectId = null (shared)'}
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
