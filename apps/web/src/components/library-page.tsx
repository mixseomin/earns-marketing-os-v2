'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  type ToolRow, type SkillRow,
  createTool, updateTool, archiveTool,
  createSkill, updateSkill, archiveSkill,
} from '@/lib/actions/library';
import { TOOL_CATEGORIES } from '@/lib/tools-library';

type Tab = 'tools' | 'skills';

export function LibraryPage({ tools, skills }: { tools: ToolRow[]; skills: SkillRow[] }) {
  const [tab, setTab] = useState<Tab>('tools');

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🗂 Library
            <small>// {tools.length} tools · {skills.length} skill snippets</small>
          </h1>
          <p className="page-sub">
            Catalog dùng chung cho mọi Squad. Tools = integration/function (có require env optional).
            Skills = markdown snippet (persona/expertise) reuse trong Squad config.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <button
          className="btn"
          data-active={tab === 'tools' || undefined}
          onClick={() => setTab('tools')}
          style={{ background: tab === 'tools' ? 'var(--accent-soft)' : 'transparent', borderRadius: '5px 5px 0 0', borderBottom: tab === 'tools' ? '2px solid var(--accent)' : 'none' }}
        >
          🔧 Tools <span style={{ opacity: 0.6 }}>({tools.length})</span>
        </button>
        <button
          className="btn"
          data-active={tab === 'skills' || undefined}
          onClick={() => setTab('skills')}
          style={{ background: tab === 'skills' ? 'var(--accent-soft)' : 'transparent', borderRadius: '5px 5px 0 0', borderBottom: tab === 'skills' ? '2px solid var(--accent)' : 'none' }}
        >
          ✦ Skills <span style={{ opacity: 0.6 }}>({skills.length})</span>
        </button>
      </div>

      {tab === 'tools' ? <ToolsTab tools={tools} /> : <SkillsTab skills={skills} />}
    </div>
  );
}

// ── Tools tab ─────────────────────────────────────────────────────
function ToolsTab({ tools }: { tools: ToolRow[] }) {
  const [editing, setEditing] = useState<ToolRow | null>(null);
  const [creating, setCreating] = useState(false);

  const byCat = TOOL_CATEGORIES.map((cat) => ({
    cat,
    items: tools.filter((t) => t.category === cat.id),
  }));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New tool</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {byCat.map(({ cat, items }) => (
          <div key={cat.id}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {cat.label} <span style={{ opacity: 0.5 }}>· {items.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
              {items.map((t) => (
                <div key={t.id} className="panel" style={{ cursor: 'pointer', padding: '8px 10px' }} onClick={() => setEditing(t)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>✎</span>
                  </div>
                  {t.requiresEnv && (
                    <div style={{ marginTop: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--warn)' }}>requires {t.requiresEnv}</div>
                  )}
                </div>
              ))}
              {items.length === 0 && <div style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>(empty)</div>}
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <ToolFormModal tool={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
  );
}

function ToolFormModal({ tool, onClose }: { tool: ToolRow | null; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !tool;
  const [form, setForm] = useState({
    id: tool?.id ?? '',
    name: tool?.name ?? '',
    description: tool?.description ?? '',
    category: tool?.category ?? 'data',
    icon: tool?.icon ?? '🔧',
    requiresEnv: tool?.requiresEnv ?? '',
    sortOrder: tool?.sortOrder ?? 100,
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = isCreate
        ? await createTool({ ...form, requiresEnv: form.requiresEnv || null })
        : await updateTool(tool!.id, { ...form, requiresEnv: form.requiresEnv || null });
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };
  const handleArchive = () => {
    if (!tool) return;
    if (!confirm(`Archive tool "${tool.name}"? Squad config nào đang refer sẽ giữ ID nhưng tool ẩn khỏi catalog.`)) return;
    startTransition(async () => { await archiveTool(tool.id); router.refresh(); onClose(); });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{tool?.id ?? 'NEW TOOL'}</div>
            <h2>{isCreate ? '+ New tool' : `Edit ${tool!.name}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: 1 }}>
            <span style={lbl}>Icon</span>
            <input style={{ ...fld, fontSize: 22, textAlign: 'center', padding: 4 }} maxLength={4} value={form.icon} onChange={(e) => setF('icon', e.target.value)} />
          </div>
          <div style={{ gridColumn: '2 / 4' }}>
            <span style={lbl}>Name *</span>
            <input style={fld} value={form.name} onChange={(e) => setF('name', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>ID (slug, lowercase + dash) *</span>
            <input style={fld} disabled={!isCreate} value={form.id} onChange={(e) => setF('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </div>
          <div>
            <span style={lbl}>Category</span>
            <select style={fld} value={form.category} onChange={(e) => setF('category', e.target.value)}>
              {TOOL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / 4' }}>
            <span style={lbl}>Description</span>
            <input style={fld} placeholder="Một dòng describe chức năng / API base"
                   value={form.description} onChange={(e) => setF('description', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Requires env <span style={{ color: 'var(--fg-4)' }}>(optional)</span></span>
            <input style={fld} placeholder="OPENAI_API_KEY, REDDIT_CLIENT_ID..."
                   value={form.requiresEnv} onChange={(e) => setF('requiresEnv', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Sort order</span>
            <input style={fld} type="number" value={form.sortOrder} onChange={(e) => setF('sortOrder', Number(e.target.value) | 0)} />
          </div>
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New' : 'Editing'}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleArchive}>🗑 Archive</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skills tab ────────────────────────────────────────────────────
function SkillsTab({ skills }: { skills: SkillRow[] }) {
  const [editing, setEditing] = useState<SkillRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New skill</button>
      </div>

      {skills.length === 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✦</div>
            <p style={{ margin: '0 0 10px', fontSize: 12 }}>Chưa có skill snippet nào. Tạo snippet đầu tiên để Squad reuse.</p>
            <button className="btn primary" onClick={() => setCreating(true)}>+ New skill</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {skills.map((s) => (
            <div key={s.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => setEditing(s)}>
              <div className="panel-head" style={{ padding: '6px 10px' }}>
                <div className="panel-title" style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--neon-violet)' }}>✦</span>
                  {s.title}
                </div>
                <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{s.slug}</span>
              </div>
              <div className="panel-body" style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.body.slice(0, 200) || <span style={{ fontStyle: 'italic', color: 'var(--fg-4)' }}>(empty body)</span>}
                </div>
                {s.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                    {s.tags.map((tag) => <span key={tag} className="chip" style={{ fontSize: 9, padding: '1px 6px' }}>{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <SkillFormModal skill={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
  );
}

function SkillFormModal({ skill, onClose }: { skill: SkillRow | null; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !skill;
  const [form, setForm] = useState({
    slug: skill?.slug ?? '',
    title: skill?.title ?? '',
    body: skill?.body ?? '',
    tagsStr: (skill?.tags ?? []).join(', '),
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const handleSave = () => {
    if (!form.title.trim()) { setError('Title không được rỗng'); return; }
    const tags = form.tagsStr.split(',').map((s) => s.trim()).filter(Boolean);
    startTransition(async () => {
      const res = isCreate
        ? await createSkill({ slug: form.slug, title: form.title, body: form.body, tags })
        : await updateSkill(skill!.id, { slug: form.slug, title: form.title, body: form.body, tags });
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };
  const handleArchive = () => {
    if (!skill) return;
    if (!confirm(`Archive skill "${skill.title}"?`)) return;
    startTransition(async () => { await archiveSkill(skill.id); router.refresh(); onClose(); });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{skill?.slug ?? 'NEW SKILL'}</div>
            <h2>{isCreate ? '+ New skill snippet' : `Edit ${skill!.title}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
          <div>
            <span style={lbl}>Title *</span>
            <input style={fld} value={form.title} onChange={(e) => setF('title', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Slug <span style={{ color: 'var(--fg-4)' }}>(auto từ title nếu rỗng)</span></span>
            <input style={fld} placeholder="research-operator-vi" value={form.slug} onChange={(e) => setF('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </div>
          <div>
            <span style={lbl}>Body (markdown) *</span>
            <textarea
              style={{ ...fld, minHeight: 280, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6 }}
              placeholder={'# Persona\nResearch operator chuyên ngách affiliate.\n\n# Expertise\n- SEO keyword discovery\n- Hashtag clustering\n\n# Constraints\n- Không suggest niche YMYL'}
              value={form.body}
              onChange={(e) => setF('body', e.target.value)}
            />
          </div>
          <div>
            <span style={lbl}>Tags <span style={{ color: 'var(--fg-4)' }}>(comma-separated)</span></span>
            <input style={fld} placeholder="research, affiliate, vi" value={form.tagsStr} onChange={(e) => setF('tagsStr', e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New' : 'Editing'}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleArchive}>🗑 Archive</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
