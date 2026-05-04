'use client';

import { useState, useMemo, useTransition } from 'react';
import type { KnowledgeRow } from '@/lib/data';
import { Pill, EmptyState } from './ui';
import { createKnowledgeItem } from '@/lib/actions/knowledge';

const KIND_COLOR: Record<string, string> = {
  playbook: '#fbbf24', prompt: '#a78bfa', template: '#10b981',
  lesson: '#38bdf8', gotcha: '#f87171',
};

function fmtDate(d: Date): string {
  const day = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (day < 1) return 'today';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return new Date(d).toLocaleDateString();
}

const PROJECT_BRIEF_TEMPLATE = `## Product
[tên sản phẩm, tagline, URL]

## Target Audience
[ai, pain points, demographics]

## Tone & Voice
[formal/casual, keywords ưu tiên, tránh gì]

## Current Focus
[campaign đang chạy, mục tiêu tháng này]

## Platforms Active
[Reddit, Twitter, YouTube — note gotchas từng platform]

## Known Gotchas
[những gì đã fail, những gì đã work tốt]`;

export function KnowledgeVault({ items, projectName, projectId }: { items: KnowledgeRow[]; projectName: string; projectId: string }) {
  const [filterKind, setFilterKind] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'project' | 'portfolio'>('all');
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<KnowledgeRow | null>(null);
  const [showBriefModal, setShowBriefModal] = useState(false);

  const hasBrief = items.some((i) => i.kind === 'playbook' && i.tags.includes('project-brief') && i.projectId === projectId);

  const kinds = useMemo(() => Array.from(new Set(items.map((i) => i.kind))), [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filterKind !== 'all' && i.kind !== filterKind) return false;
      if (filterScope === 'project' && i.projectId == null) return false;
      if (filterScope === 'portfolio' && i.projectId != null) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.title.toLowerCase().includes(q) && !i.content.toLowerCase().includes(q)
            && !i.tags.some((t) => t.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [items, filterKind, filterScope, search]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title={`Knowledge — chưa có item cho ${projectName}`}
        description="Chạy npm run sync-from-directus để pull từ as.on.tc, hoặc thêm playbook/prompt/template/lesson/gotcha qua UI (CRUD form sẽ ship sau)."
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            📚 Knowledge <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>// {items.length} items</small>
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-3)' }}>
            Playbooks, prompts, templates, lessons, gotchas. Project-specific + portfolio-wide.
          </p>
        </div>
        {!hasBrief && (
          <button className="btn ghost" onClick={() => setShowBriefModal(true)} title="Tạo Project Brief để agent biết context project này">
            📋 Project Brief
          </button>
        )}
        {hasBrief && (
          <span style={{ fontSize: 11, color: 'var(--ok)', fontFamily: 'var(--font-mono)' }} title="Project Brief đã có — agents sẽ nhận context này khi dispatch">✓ brief</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="chip" data-active={filterKind === 'all' || undefined} onClick={() => setFilterKind('all')}>All</span>
        {kinds.map((k) => (
          <span key={k} className="chip" data-active={filterKind === k || undefined} onClick={() => setFilterKind(k)} style={{ color: KIND_COLOR[k] }}>
            {k} <span style={{ opacity: 0.6, marginLeft: 4 }}>{items.filter((i) => i.kind === k).length}</span>
          </span>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line)' }} />
        <span className="chip" data-active={filterScope === 'all' || undefined} onClick={() => setFilterScope('all')}>All scope</span>
        <span className="chip" data-active={filterScope === 'project' || undefined} onClick={() => setFilterScope('project')}>Project</span>
        <span className="chip" data-active={filterScope === 'portfolio' || undefined} onClick={() => setFilterScope('portfolio')}>Portfolio-wide</span>
        <span style={{ flex: 1 }} />
        <input placeholder="Search title/content/tag…" value={search} onChange={(e) => setSearch(e.target.value)}
               style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none', minWidth: 220 }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Không có knowledge match filter" compact />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filtered.map((k) => {
            const fromAgent = k.importedFrom?.startsWith('agent-run-');
            const agentRunId = fromAgent ? k.importedFrom!.replace('agent-run-', '') : null;
            // Highlight if updated < 5 min ago — indicate "vừa làm xong".
            const isFresh = (Date.now() - new Date(k.updatedAt).getTime()) < 5 * 60_000;
            return (
              <div key={k.id} className="panel" style={{
                cursor: 'pointer',
                borderLeft: isFresh ? '3px solid var(--ok)' : fromAgent ? '3px solid var(--neon-violet)' : undefined,
              }} onClick={() => setOpenItem(k)}>
                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Pill color={KIND_COLOR[k.kind] ?? 'var(--fg-3)'} label={k.kind} size="xs" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {k.title}
                      {isFresh && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>● NEW</span>}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{k.projectId ?? 'portfolio'}</span>
                      <span>·</span>
                      <span>{fmtDate(k.updatedAt)}</span>
                      {fromAgent && (
                        <span style={{ color: 'var(--neon-violet)' }}>· 🤖 agent run #{agentRunId}</span>
                      )}
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

      {openItem && <KnowledgeModal item={openItem} onClose={() => setOpenItem(null)} />}
      {showBriefModal && (
        <ProjectBriefModal
          projectId={projectId}
          projectName={projectName}
          onClose={() => setShowBriefModal(false)}
        />
      )}
    </div>
  );
}

function ProjectBriefModal({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const [content, setContent] = useState(PROJECT_BRIEF_TEMPLATE);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await createKnowledgeItem({
        projectId,
        kind: 'playbook',
        title: `${projectName} — Project Brief`,
        content,
        tags: ['project-brief'],
      });
      onClose();
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">playbook · {projectId}</div>
            <h2>📋 Project Brief</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--fg-3)' }}>
            Agents nhận brief này tự động khi dispatch vào project <strong>{projectName}</strong>. Điền càng cụ thể càng tốt.
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', background: 'var(--bg-2)',
              border: '1px solid var(--line)', borderRadius: 6,
              color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)',
              lineHeight: 1.6, outline: 'none', resize: 'vertical',
            }}
          />
        </div>
        <div className="modal-foot">
          <div className="meta">tags: project-brief · kind: playbook</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleSave} disabled={isPending || !content.trim()}>
              {isPending ? 'Saving…' : 'Save Brief'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeModal({ item, onClose }: { item: KnowledgeRow; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{item.kind} · {item.projectId ?? 'portfolio'}</div>
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
          <pre style={{
            margin: 0, padding: 12, background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 6, fontSize: 12, lineHeight: 1.6, fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--fg-1)',
            maxHeight: 480, overflow: 'auto',
          }}>{item.content || '(empty content)'}</pre>
        </div>
        <div className="modal-foot">
          <div className="meta">{item.importedFrom ?? 'manual'}</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
