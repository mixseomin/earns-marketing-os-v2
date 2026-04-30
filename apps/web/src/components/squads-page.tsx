'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Mode, Squad } from '@/lib/mock/types';
import { Donut } from './charts';
import { createSquad, updateSquad, deleteSquad, type SquadInput } from '@/lib/actions/squads';
import { TOOL_CATEGORIES } from '@/lib/tools-library';
import type { ToolRow, SkillRow } from '@/lib/actions/library';

const TRUST_LEVELS = [
  { l: 1, name: 'AUTO',     sub: 'Tự xử, không báo',
    desc: 'Việc lặp đi lặp lại, rủi ro thấp, không liên quan tiền lớn. Agent thực thi và quên.',
    examples: ['Trả comment thường', 'Crawl trend list', 'Tag chủ đề email', 'Đăng pre-approved'] },
  { l: 2, name: 'NOTIFY',   sub: 'Tự xử, log lại',
    desc: 'Việc đã pre-approve template/playbook. Agent làm rồi push log để bạn xem khi rảnh.',
    examples: ['Đăng bài approved template', 'Apply offer free', 'Tăng budget <500k', 'Cross-post đa kênh'] },
  { l: 3, name: 'APPROVE',  sub: 'Đề xuất, chờ duyệt',
    desc: 'Việc liên quan tiền lớn, ngành nhạy cảm hoặc mới. Agent đẩy card lên Command Board.',
    examples: ['Scale ads 500k–5tr', 'Nội dung sức khoẻ / tài chính', 'Apply offer exclusive', 'Claim mạnh'] },
  { l: 4, name: 'ESCALATE', sub: 'Báo động — dừng việc liên quan',
    desc: 'Khủng hoảng. Agent dừng mọi action liên quan, alert qua Telegram + Slack + on-screen.',
    examples: ['Nick chính bị flag/khoá', 'Brand complain / báo chí', 'Đối soát chênh >10%', 'Anomaly spend'] },
] as const;

const PRESET_ICONS = ['🔍', '✍️', '🎨', '📤', '💬', '📊', '💰', '🛡️', '🎬', '📧', '👥', '🏠', '🎤', '📈', '👕', '🤖'];
const PRESET_COLORS = ['#00e5ff', '#b6ff3c', '#ffb03c', '#9d6cff', '#ff3ca8', '#ff4d5e', '#3c9bff'];

const emptySquad = (): SquadInput => ({
  squadKey: '', name: '', vi: '', icon: '🤖',
  agents: 1, active: 1, color: '#00e5ff', descText: '',
  health: 'ok',
  config: { mission: '', skillsMd: '', tools: [], systemPrompt: '', model: 'gpt-4o-mini', trustLevel: 2 },
});

function SquadFormModal({ squad, projectId, onClose, availableModels, dbTools, dbSkills }: {
  squad: Squad | null; projectId: string; onClose: () => void;
  availableModels: Array<{ id: string; label: string; provider: string }>;
  dbTools: ToolRow[];
  dbSkills: SkillRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCreate = !squad;
  const [form, setForm] = useState<SquadInput>(() =>
    squad ? {
      squadKey: squad.id,
      name: squad.name,
      vi: squad.vi,
      icon: squad.icon,
      agents: squad.agents,
      active: squad.active,
      color: squad.color,
      descText: squad.desc,
      health: squad.health,
      config: {
        mission: squad.config?.mission ?? '',
        skillsMd: squad.config?.skillsMd ?? '',
        tools: squad.config?.tools ?? [],
        systemPrompt: squad.config?.systemPrompt ?? '',
        model: squad.config?.model ?? 'gpt-4o-mini',
        trustLevel: squad.config?.trustLevel ?? 2,
      },
    } : emptySquad()
  );
  const setF = <K extends keyof SquadInput>(k: K, v: SquadInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCfg = <K extends keyof NonNullable<SquadInput['config']>>(k: K, v: NonNullable<SquadInput['config']>[K]) =>
    setForm((f) => ({ ...f, config: { ...(f.config ?? {}), [k]: v } }));
  const cfg = form.config ?? {};
  const tools = cfg.tools ?? [];
  const toggleTool = (id: string) => {
    const next = tools.includes(id) ? tools.filter((t) => t !== id) : [...tools, id];
    setCfg('tools', next);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setError('Tên squad không được rỗng'); return; }
    startTransition(async () => {
      const res = isCreate
        ? await createSquad(projectId, form)
        : await updateSquad(projectId, squad!.id, form);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!squad) return;
    if (!confirm(`Xoá squad "${squad.name}"? Cards thuộc squad sẽ orphan (squad key vẫn lưu trong card).`)) return;
    startTransition(async () => {
      const res = await deleteSquad(projectId, squad.id);
      if (!res.ok) { alert(res.error); return; }
      router.refresh();
      onClose();
    });
  };

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{squad?.id ?? 'NEW SQUAD'}</div>
            <h2>{isCreate ? '+ New squad' : `Edit ${squad!.name}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>
        )}

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10 }}>
            <div>
              <span style={lbl}>Icon</span>
              <input style={{ ...fld, fontSize: 22, textAlign: 'center', padding: 4 }} maxLength={4}
                     value={form.icon} onChange={(e) => setF('icon', e.target.value)} />
            </div>
            <div>
              <span style={lbl}>Tên *</span>
              <input style={fld} placeholder="Research, Content, Creative..." value={form.name} onChange={(e) => setF('name', e.target.value)} />
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {PRESET_ICONS.map((i) => (
                <button key={i} type="button" onClick={() => setF('icon', i)}
                        style={{ padding: '4px 8px', background: form.icon === i ? 'var(--accent-soft)' : 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span style={lbl}>Tên VN</span>
            <input style={fld} placeholder="Nghiên cứu, Sản xuất Content..." value={form.vi} onChange={(e) => setF('vi', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Health</span>
            <select style={fld} value={form.health} onChange={(e) => setF('health', e.target.value as SquadInput['health'])}>
              <option value="ok">OK</option>
              <option value="warn">Warn</option>
              <option value="bad">Bad</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Agents (total)</span>
            <input style={fld} type="number" min={0} value={form.agents} onChange={(e) => setF('agents', Number(e.target.value))} />
          </div>
          <div>
            <span style={lbl}>Active</span>
            <input style={fld} type="number" min={0} value={form.active} onChange={(e) => setF('active', Number(e.target.value))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Mô tả</span>
            <input style={fld} placeholder="Crawl trend / spy đối thủ / phân tích offer" value={form.descText} onChange={(e) => setF('descText', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Color</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setF('color', c)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, cursor: 'pointer', background: c,
                          border: form.color === c ? '3px solid var(--fg-0)' : '1px solid var(--line-strong)',
                        }} />
              ))}
              <input type="color" value={form.color} onChange={(e) => setF('color', e.target.value)}
                     style={{ width: 32, height: 32, padding: 0, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
            </div>
          </div>

          {/* ── AI Config ─────────────────────────────────────────── */}
          <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 4 }}>
            <div style={{ ...lbl, marginBottom: 8, fontSize: 11, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              🤖 AI Config <span style={{ fontSize: 9, color: 'var(--fg-4)', textTransform: 'none', letterSpacing: 0 }}>// skill, tool, persona riêng cho squad này</span>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>Mission</span>
            <input style={fld} placeholder='vd: "Khám phá trend & ngách mới mỗi 24h"'
                   value={cfg.mission ?? ''} onChange={(e) => setCfg('mission', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>Skills <span style={{ color: 'var(--fg-4)' }}>(markdown — bullet, persona, expertise)</span></span>
              {dbSkills.length > 0 && (
                <select
                  style={{ ...fld, fontSize: 10, padding: '2px 6px', width: 'auto', maxWidth: 200, marginLeft: 'auto' }}
                  value=""
                  onChange={(e) => {
                    const picked = dbSkills.find((s) => s.slug === e.target.value);
                    if (!picked) return;
                    const merged = (cfg.skillsMd ?? '').trim();
                    const sep = merged ? '\n\n---\n\n' : '';
                    setCfg('skillsMd', `${merged}${sep}${picked.body}`);
                    e.target.value = '';
                  }}
                >
                  <option value="">+ Insert from library…</option>
                  {dbSkills.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
                </select>
              )}
            </div>
            <textarea
              style={{ ...fld, minHeight: 110, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6 }}
              placeholder={`# Persona\nResearch operator chuyên ngách affiliate.\n\n# Expertise\n- SEO keyword discovery\n- Hashtag clustering\n- Niche scoring (search vol × competition)\n\n# Constraints\n- Không suggest niche YMYL\n- Ưu tiên evergreen > trend ngắn\n\n→ Hoặc pick từ /library snippet ↑`}
              value={cfg.skillsMd ?? ''}
              onChange={(e) => setCfg('skillsMd', e.target.value)}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ ...lbl, marginBottom: 0 }}>
                Tools <span style={{ color: 'var(--fg-4)' }}>({tools.length} selected · từ <a href="/library" style={{ color: 'var(--accent)' }}>/library</a>)</span>
              </span>
            </div>
            <div style={{
              border: '1px solid var(--line)', borderRadius: 5, padding: 8, maxHeight: 220, overflow: 'auto',
              background: 'var(--bg-2)',
            }}>
              {dbTools.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center', padding: 12 }}>
                  Library trống. Tạo tool đầu tiên trong <a href="/library" style={{ color: 'var(--accent)' }}>/library</a>.
                </div>
              ) : TOOL_CATEGORIES.map((cat) => {
                const inCat = dbTools.filter((t) => t.category === cat.id);
                if (inCat.length === 0) return null;
                return (
                  <div key={cat.id} style={{ marginBottom: 8 }}>
                    <div style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', color: cat.color, textTransform: 'uppercase',
                      letterSpacing: '0.06em', marginBottom: 4,
                    }}>
                      {cat.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {inCat.map((t) => {
                        const on = tools.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTool(t.id)}
                            title={t.description + (t.requiresEnv ? ` · requires ${t.requiresEnv}` : '')}
                            className="chip"
                            data-active={on || undefined}
                            style={{
                              fontSize: 10, padding: '3px 8px', cursor: 'pointer',
                              background: on ? cat.color : undefined,
                              color: on ? '#000' : undefined,
                              borderColor: on ? cat.color : undefined,
                              opacity: on ? 1 : 0.85,
                            }}
                          >
                            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span style={lbl}>Model</span>
            {availableModels.length === 0 ? (
              <div style={{ ...fld, color: 'var(--warn)', fontSize: 11 }}>
                ⚠ Chưa có API configured. Vào <a href="/settings/api" style={{ color: 'var(--accent)' }}>/settings/api</a>.
              </div>
            ) : (
              <select style={fld} value={cfg.model ?? availableModels[0]!.id} onChange={(e) => setCfg('model', e.target.value)}>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label} · {m.provider}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <span style={lbl}>Trust level</span>
            <select style={fld} value={cfg.trustLevel ?? 2} onChange={(e) => setCfg('trustLevel', Number(e.target.value) as 1|2|3|4)}>
              <option value={1}>L1 · AUTO (tự xử)</option>
              <option value={2}>L2 · NOTIFY (log lại)</option>
              <option value={3}>L3 · APPROVE (chờ duyệt)</option>
              <option value={4}>L4 · ESCALATE (alert)</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>System prompt <span style={{ color: 'var(--fg-4)' }}>(persona cho AI runtime — phase 10)</span></span>
            <textarea style={{ ...fld, minHeight: 70, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      placeholder='vd: "Bạn là Research squad. Mục tiêu: phát hiện trend & cơ hội mới. Trả lời ngắn, action-driven, kèm nguồn."'
                      value={cfg.systemPrompt ?? ''} onChange={(e) => setCfg('systemPrompt', e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <div className="meta">{isCreate ? 'New squad' : 'Editing'}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={handleDelete}>🗑 Delete</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>{isCreate ? 'Create squad' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SquadsPage({ mode, projectId, availableModels, dbTools, dbSkills }: {
  mode: Mode;
  projectId: string;
  availableModels: Array<{ id: string; label: string; provider: string }>;
  dbTools: ToolRow[];
  dbSkills: SkillRow[];
}) {
  const [editing, setEditing] = useState<Squad | null>(null);
  const [creating, setCreating] = useState(false);
  const toolById = new Map(dbTools.map((t) => [t.id, t]));

  return (
    <div className="page squads-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {mode.squadsTitle}
            <small>// {mode.squads.length} squads • 4 trust tiers • {mode.label}</small>
          </h1>
          <p className="page-sub">Throughput = Σ (agent tự xử ở L1+L2). Bottleneck = tốc độ bạn duyệt L3.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setCreating(true)}>+ New squad</button>
        </div>
      </div>

      <div className="modal-section-title" style={{ padding: '8px 0', marginTop: 0 }}>Trust Levels</div>
      <div className="trust-grid">
        {TRUST_LEVELS.map((t) => (
          <div key={t.l} className="trust-card" data-l={t.l}>
            <div className="trust-card-head">
              <b>L{t.l} · {t.name}</b>
              <span>{t.sub}</span>
            </div>
            <p>{t.desc}</p>
            <ul>{t.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="modal-section-title" style={{ padding: '8px 0', marginTop: 16 }}>Squad detail · {mode.label}</div>

      {mode.squads.length === 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ padding: 32, textAlign: 'center', color: 'var(--fg-2)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
            <p style={{ margin: '0 0 12px', fontSize: 13 }}>Chưa có squad nào. Tạo squad đầu tiên để bắt đầu phân loại agent.</p>
            <button className="btn primary" onClick={() => setCreating(true)}>+ New squad</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {mode.squads.map((s) => {
            const utilization = s.agents > 0 ? Math.round((s.active / s.agents) * 100) : 0;
            return (
              <div key={s.id} className="panel" style={{ cursor: 'pointer' }} onClick={() => setEditing(s)}>
                <div className="panel-head">
                  <div className="panel-title">
                    <span className="squad-card-icon" style={{ width: 22, height: 22, fontSize: 11, borderColor: s.color, color: s.color }}>{s.icon}</span>
                    {s.name}
                    <small>// {s.vi}</small>
                  </div>
                  <div className="flex gap-2">
                    <span className="chip">{s.active}/{s.agents}</span>
                    <span className="chip" style={{
                      color: s.health === 'ok' ? 'var(--ok)' : s.health === 'warn' ? 'var(--warn)' : 'var(--bad)',
                      borderColor: s.health === 'ok' ? 'rgba(182,255,60,.3)' : s.health === 'warn' ? 'rgba(255,176,60,.3)' : 'rgba(255,77,94,.3)',
                    }}>{s.health.toUpperCase()}</span>
                    <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>✎</span>
                  </div>
                </div>
                <div className="panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Donut value={s.active} max={s.agents || 1} label="active" color={s.color} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.config?.mission && (
                      <div style={{ fontSize: 11, color: 'var(--fg-1)', fontStyle: 'italic' }}>"{s.config.mission}"</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{s.desc}</div>
                    {(() => {
                      // Skills preview: first non-heading line từ markdown.
                      const md = s.config?.skillsMd ?? '';
                      const firstLine = md.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) ?? '';
                      return firstLine && (
                        <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                          {firstLine.replace(/^[-*]\s*/, '· ').slice(0, 80)}{firstLine.length > 80 ? '…' : ''}
                        </div>
                      );
                    })()}
                    {(s.config?.tools?.length ?? 0) > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                        {s.config!.tools!.slice(0, 6).map((tid) => {
                          const t = toolById.get(tid);
                          if (!t) return <span key={tid} title={`Unknown tool: ${tid}`} style={{ fontSize: 11, color: 'var(--fg-4)' }}>?</span>;
                          return (
                            <span key={tid} title={`${t.name} — ${t.description}`}
                                  style={{ fontSize: 13, lineHeight: 1, padding: '1px 3px' }}>
                              {t.icon}
                            </span>
                          );
                        })}
                        {s.config!.tools!.length > 6 && (
                          <span style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>+{s.config!.tools!.length - 6}</span>
                        )}
                      </div>
                    )}
                    <div className="squad-card-stats" style={{ marginTop: 4 }}>
                      <div className="squad-stat"><span>Active</span><b>{s.active}/{s.agents}</b></div>
                      <div className="squad-stat"><span>Tasks/h</span><b>{Math.round(s.active * 4.2)}</b></div>
                      <div className="squad-stat"><span>Util</span><b className={utilization > 90 ? 'warn' : 'ok'}>{utilization}%</b></div>
                      {s.config?.trustLevel && (
                        <div className="squad-stat"><span>Trust</span><b style={{ color: s.color }}>L{s.config.trustLevel}</b></div>
                      )}
                      {s.config?.model && (
                        <div className="squad-stat"><span>Model</span><b style={{ fontSize: 10 }}>{s.config.model}</b></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <SquadFormModal
          squad={editing}
          projectId={projectId}
          availableModels={availableModels}
          dbTools={dbTools}
          dbSkills={dbSkills}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}
