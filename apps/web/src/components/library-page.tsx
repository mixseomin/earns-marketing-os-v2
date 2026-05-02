'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  type ToolRow, type SkillRow, type ToolStatus,
  createTool, updateTool, archiveTool,
  createSkill, updateSkill, archiveSkill,
} from '@/lib/actions/library';
import { TOOL_CATEGORIES } from '@/lib/tools-library';
import { AIFormParser } from './ai-form-parser';

// Read+write a single URL search param. Replace navigation (no scroll, no history bloat).
function useUrlParam(key: string, defaultValue: string): [string, (v: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === defaultValue) next.delete(key);
    else next.set(key, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [value, set];
}

// Status meta — re-used in Library + Squad form preview.
export const TOOL_STATUS_META: Record<ToolStatus, { label: string; color: string; bg: string; desc: string }> = {
  mock:       { label: 'mock',       color: 'var(--fg-3)',     bg: 'rgba(127,127,127,.12)',  desc: 'Chỉ là metadata trong catalog. Chưa wire executable code — Squad không thể call thực tế.' },
  planned:    { label: 'planned',    color: 'var(--neon-amber)', bg: 'rgba(255,176,60,.10)', desc: 'Wire-up đang lên kế hoạch (phase 10 Agent runtime).' },
  integrated: { label: 'integrated', color: 'var(--ok)',       bg: 'rgba(16,185,129,.12)',   desc: 'Đã có function/MCP server hoạt động. Squad có thể call khi runtime ON.' },
};

type Tab = 'tools' | 'skills';

export function LibraryPage({ tools, skills }: { tools: ToolRow[]; skills: SkillRow[] }) {
  const [tabRaw, setTabRaw] = useUrlParam('tab', 'tools');
  const tab: Tab = tabRaw === 'skills' ? 'skills' : 'tools';
  const setTab = (t: Tab) => setTabRaw(t);

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
  const counts = {
    mock: tools.filter((t) => t.status === 'mock').length,
    planned: tools.filter((t) => t.status === 'planned').length,
    integrated: tools.filter((t) => t.status === 'integrated').length,
  };

  return (
    <>
      <div style={{
        padding: '8px 10px', marginBottom: 10, borderRadius: 5,
        background: 'rgba(255,176,60,.06)', border: '1px solid rgba(255,176,60,.25)',
        fontSize: 11, color: 'var(--fg-1)',
      }}>
        ⚠ <b>Trạng thái thật:</b> {counts.integrated} integrated · {counts.planned} planned · <b>{counts.mock} mock</b> (chỉ là metadata catalog).
        Khi gắn vào Squad, mock tool KHÔNG thực sự call được — chỉ cho AI runtime tương lai (phase 10) biết squad có "quyền truy cập" gì.
        Để biến thành integrated: cần build MCP server hoặc function endpoint tương ứng + đổi status.
      </div>
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
              {items.map((t) => {
                const sm = TOOL_STATUS_META[t.status];
                return (
                  <div key={t.id} className="panel" style={{ cursor: 'pointer', padding: '8px 10px' }} onClick={() => setEditing(t)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                      </div>
                      <span title={sm.desc} style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: 3,
                        color: sm.color, background: sm.bg, border: `1px solid ${sm.color}`, opacity: 0.7,
                      }}>{sm.label}</span>
                    </div>
                    {t.requiresEnv && (
                      <div style={{ marginTop: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--warn)' }}>requires {t.requiresEnv}</div>
                    )}
                  </div>
                );
              })}
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
    status: tool?.status ?? ('mock' as ToolStatus),
    sourceUrl: tool?.sourceUrl ?? '',
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
      const payload = {
        ...form,
        requiresEnv: form.requiresEnv || null,
        sourceUrl: form.sourceUrl || null,
      };
      const res = isCreate ? await createTool(payload) : await updateTool(tool!.id, payload);
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
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{tool?.id ?? 'NEW TOOL'}</div>
            <h2>{isCreate ? '+ New tool' : `Edit ${tool!.name}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          currentValues={form}
          context="Tool catalog entry. Parse from API docs URL, README, vendor page, or paste tool description."
          schema={[
            { key: 'id', label: 'Slug ID (lowercase + dashes, e.g. "stripe-api")' },
            { key: 'name', label: 'Display name' },
            { key: 'description', label: 'One-line description' },
            { key: 'category', label: 'Category', type: 'enum', enumValues: TOOL_CATEGORIES.map((c) => c.id) },
            { key: 'icon', label: 'Emoji icon (single character)' },
            { key: 'requiresEnv', label: 'Required env var name (e.g. STRIPE_API_KEY)' },
            { key: 'sourceUrl', label: 'API docs / repo URL' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            id: typeof v.id === 'string' && !tool ? v.id : f.id,    // only set on create
            name: typeof v.name === 'string' ? v.name : f.name,
            description: typeof v.description === 'string' ? v.description : f.description,
            category: typeof v.category === 'string' ? v.category : f.category,
            icon: typeof v.icon === 'string' ? v.icon : f.icon,
            requiresEnv: typeof v.requiresEnv === 'string' ? v.requiresEnv : f.requiresEnv,
            sourceUrl: typeof v.sourceUrl === 'string' ? v.sourceUrl : f.sourceUrl,
          }))}
        />

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
          <div style={{ gridColumn: '1 / 4' }}>
            <span style={lbl}>Status</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <select style={{ ...fld, width: 'auto', minWidth: 180 }} value={form.status} onChange={(e) => setF('status', e.target.value as ToolStatus)}>
                <option value="mock">mock — chỉ catalog</option>
                <option value="planned">planned — đang lên kế hoạch</option>
                <option value="integrated">integrated — đã wire</option>
              </select>
              <div style={{ fontSize: 10, color: TOOL_STATUS_META[form.status].color, fontFamily: 'var(--font-mono)', lineHeight: 1.4, paddingTop: 6 }}>
                {TOOL_STATUS_META[form.status].desc}
              </div>
            </div>
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
          <div style={{ gridColumn: '1 / 4' }}>
            <span style={lbl}>Source URL <span style={{ color: 'var(--fg-4)' }}>(API docs / repo, optional)</span></span>
            <input style={fld} type="url" placeholder="https://..."
                   value={form.sourceUrl} onChange={(e) => setF('sourceUrl', e.target.value)} />
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
  const [q, setQ] = useUrlParam('q', '');
  const [cat, setCat] = useUrlParam('cat', 'all');

  // Group by first tag. Keep deterministic ordering (alphabetical by category name).
  const groups = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    for (const s of skills) {
      const key = s.tags[0] ?? 'misc';
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
  }, [skills]);

  // Filter: search query (title/body/tags) + active category
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return skills.filter((s) => {
      if (cat !== 'all' && (s.tags[0] ?? 'misc') !== cat) return false;
      if (!ql) return true;
      return (s.title + ' ' + s.tags.join(' ') + ' ' + s.body).toLowerCase().includes(ql);
    });
  }, [skills, q, cat]);

  const filteredByGroup = useMemo(() => {
    const map = new Map<string, SkillRow[]>();
    for (const s of filtered) {
      const key = s.tags[0] ?? 'misc';
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Filter skills (title, tag, body)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            flex: 1, minWidth: 220, padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 5, fontSize: 12, color: 'var(--fg-0)', outline: 'none',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{filtered.length} / {skills.length}</span>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New skill</button>
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        <span className="chip" data-active={cat === 'all' || undefined} onClick={() => setCat('all')}
              style={{ cursor: 'pointer', fontSize: 10 }}>
          all <span style={{ opacity: 0.6 }}>{skills.length}</span>
        </span>
        {groups.map((g) => (
          <span key={g.key} className="chip" data-active={cat === g.key || undefined} onClick={() => setCat(g.key)}
                style={{ cursor: 'pointer', fontSize: 10 }}>
            {g.key} <span style={{ opacity: 0.6 }}>{g.items.length}</span>
          </span>
        ))}
      </div>

      {skills.length === 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✦</div>
            <p style={{ margin: '0 0 10px', fontSize: 12 }}>Chưa có skill snippet nào. Tạo snippet đầu tiên để Squad reuse.</p>
            <button className="btn primary" onClick={() => setCreating(true)}>+ New skill</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
            (no match) — clear filter để xem lại tất cả.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredByGroup.map(([groupKey, items]) => (
            <div key={groupKey}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--neon-violet)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>✦ {groupKey}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ opacity: 0.6 }}>{items.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {items.map((s) => (
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6, alignItems: 'center' }}>
                        {s.tags.slice(0, 4).map((tag) => <span key={tag} className="chip" style={{ fontSize: 9, padding: '1px 6px' }}>{tag}</span>)}
                        {s.source && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', marginLeft: 'auto' }}>
                            📎 {s.source}{s.license ? ` · ${s.license}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
    source: skill?.source ?? '',
    sourceUrl: skill?.sourceUrl ?? '',
    license: skill?.license ?? 'curated',
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
    const payload = {
      slug: form.slug, title: form.title, body: form.body, tags,
      source: form.source || null,
      sourceUrl: form.sourceUrl || null,
      license: form.license || null,
    };
    startTransition(async () => {
      const res = isCreate ? await createSkill(payload) : await updateSkill(skill!.id, payload);
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
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{skill?.slug ?? 'NEW SKILL'}</div>
            <h2>{isCreate ? '+ New skill snippet' : `Edit ${skill!.title}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          currentValues={form}
          context="Skill snippet — markdown persona/playbook for squads. Parse from URL article, paste markdown, or screenshot of guide."
          schema={[
            { key: 'title', label: 'Skill title' },
            { key: 'body', label: 'Body markdown content (full text)' },
            { key: 'tagsStr', label: 'Comma-separated tags (e.g. "writing, copywriting, b2b")' },
            { key: 'source', label: 'Source name (e.g. "Stripe Atlas Guide")' },
            { key: 'sourceUrl', label: 'Source URL' },
            { key: 'license', label: 'License', type: 'enum', enumValues: ['curated', 'cc-by', 'cc-by-sa', 'public-domain', 'proprietary', 'mit'] },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            title: typeof v.title === 'string' ? v.title : f.title,
            body: typeof v.body === 'string' ? v.body : f.body,
            tagsStr: typeof v.tagsStr === 'string' ? v.tagsStr : f.tagsStr,
            source: typeof v.source === 'string' ? v.source : f.source,
            sourceUrl: typeof v.sourceUrl === 'string' ? v.sourceUrl : f.sourceUrl,
            license: typeof v.license === 'string' ? v.license : f.license,
          }))}
        />

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <span style={lbl}>Source <span style={{ color: 'var(--fg-4)' }}>(repo/site)</span></span>
              <input style={fld} placeholder="awesome-chatgpt-prompts" value={form.source} onChange={(e) => setF('source', e.target.value)} />
            </div>
            <div>
              <span style={lbl}>Source URL</span>
              <input style={fld} type="url" placeholder="https://github.com/..." value={form.sourceUrl} onChange={(e) => setF('sourceUrl', e.target.value)} />
            </div>
            <div>
              <span style={lbl}>License</span>
              <select style={fld} value={form.license} onChange={(e) => setF('license', e.target.value)}>
                <option value="curated">curated (own)</option>
                <option value="CC0">CC0</option>
                <option value="MIT">MIT</option>
                <option value="public-domain">public-domain</option>
                <option value="apache-2.0">apache-2.0</option>
                <option value="other">other</option>
              </select>
            </div>
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
