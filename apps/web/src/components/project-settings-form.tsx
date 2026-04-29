'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/mock/types';
import { updateProject, archiveProject, deleteProjectHard } from '@/lib/actions/projects';

const ACCENTS = ['cyan', 'lime', 'amber', 'violet', 'pink', 'red'] as const;
const COLORS: Record<string, string> = {
  cyan: '#00e5ff', lime: '#b6ff3c', amber: '#ffb03c',
  violet: '#9d6cff', pink: '#ff3ca8', red: '#ff4d5e', blue: '#3c9bff',
};

type Mode = { id: string; label: string; sub: string; accent: string };

export function ProjectSettingsForm({ project, allModes }: { project: Project; allModes: Mode[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: project.name,
    emoji: project.emoji,
    modeId: project.mode,
    agentsCore: project.agents.core,
    agentsShared: project.agents.shared,
    budget: project.budget,
    health: project.health,
    revenue: project.revenue,
    kpi: project.kpi,
    color: project.color,
  });

  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify({
    name: project.name, emoji: project.emoji, modeId: project.mode,
    agentsCore: project.agents.core, agentsShared: project.agents.shared,
    budget: project.budget, health: project.health, revenue: project.revenue,
    kpi: project.kpi, color: project.color,
  });

  const handleSave = async () => {
    setSaving(true); setError(null);
    const res = await updateProject(project.id, form);
    setSaving(false);
    if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
    setSavedAt(Date.now());
    router.refresh();
  };

  const handleArchive = async () => {
    if (!confirm(`Archive project "${project.name}"? Có thể restore qua DB sau.`)) return;
    startTransition(async () => {
      const res = await archiveProject(project.id);
      if (!res.ok) { alert(res.error); return; }
      router.push('/');
    });
  };

  const handleDelete = async () => {
    const c1 = confirm(`XOÁ HẲN project "${project.name}"? Tất cả squads/cards/alerts/feed sẽ bị xoá vĩnh viễn.`);
    if (!c1) return;
    const typed = prompt(`Gõ "${project.id}" để xác nhận xoá:`);
    if (typed !== project.id) { alert('Sai id, huỷ.'); return; }
    startTransition(async () => {
      const res = await deleteProjectHard(project.id);
      if (!res.ok) { alert(res.error); return; }
      router.push('/');
    });
  };

  const lbl = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, display: 'block' };
  const fld = { width: '100%', padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none' };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings <small>// {project.id}</small></h1>
          <p className="page-sub">Chỉnh sửa metadata project. Mode đổi → cấu trúc Board/Squads thay đổi nhưng card/squad đã tạo giữ nguyên.</p>
        </div>
        <div className="page-actions">
          {savedAt && <span style={{ color: 'var(--ok)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>✓ Đã lưu</span>}
          <button className="btn primary" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,77,94,.08)', border: '1px solid rgba(255,77,94,.3)', borderRadius: 8, color: 'var(--bad)', marginBottom: 12, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title"><span className="dot"></span>Identity</div>
        </div>
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 }}>
          <div>
            <span style={lbl}>Emoji</span>
            <input style={{ ...fld, fontSize: 28, textAlign: 'center', padding: 6 }} maxLength={4}
                   value={form.emoji} onChange={(e) => setF('emoji', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Tên project</span>
            <input style={fld} value={form.name} onChange={(e) => setF('name', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div className="panel-title"><span className="dot" style={{ background: 'var(--neon-violet)' }}></span>Mode (mục đích)</div>
        </div>
        <div className="panel-body">
          <span style={lbl}>Mode template — quy định columns Board, KPI shape, Squads default</span>
          <select style={fld} value={form.modeId} onChange={(e) => setF('modeId', e.target.value)}>
            {allModes.map((m) => (
              <option key={m.id} value={m.id}>{m.label} — {m.sub.replace('// ', '')}</option>
            ))}
          </select>
          {form.modeId !== project.mode && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255,176,60,.08)', border: '1px solid rgba(255,176,60,.3)', borderRadius: 6, color: 'var(--warn)', fontSize: 12 }}>
              ⚠ Đổi mode từ <b>{project.mode}</b> → <b>{form.modeId}</b>: cards trong cột không tồn tại ở mode mới sẽ ẩn. Squads giữ nguyên dù key không match.
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div className="panel-title"><span className="dot" style={{ background: 'var(--neon-lime)' }}></span>Capacity & metrics</div>
        </div>
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <span style={lbl}>Agents core</span>
            <input style={fld} type="number" min={0} value={form.agentsCore} onChange={(e) => setF('agentsCore', Number(e.target.value))} />
          </div>
          <div>
            <span style={lbl}>Agents shared</span>
            <input style={fld} type="number" min={0} value={form.agentsShared} onChange={(e) => setF('agentsShared', Number(e.target.value))} />
          </div>
          <div>
            <span style={lbl}>Budget (tr/ngày)</span>
            <input style={fld} type="number" min={0} value={form.budget} onChange={(e) => setF('budget', Number(e.target.value))} />
          </div>
          <div>
            <span style={lbl}>Health (0-100)</span>
            <input style={fld} type="number" min={0} max={100} value={form.health} onChange={(e) => setF('health', Number(e.target.value))} />
          </div>
          <div>
            <span style={lbl}>Revenue (display)</span>
            <input style={fld} placeholder="e.g. 45tr, 184tr MRR, $500-2k/mo" value={form.revenue} onChange={(e) => setF('revenue', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>KPI (display)</span>
            <input style={fld} placeholder="e.g. ROAS 2.8x, Churn 3.2%" value={form.kpi} onChange={(e) => setF('kpi', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <div className="panel-title"><span className="dot" style={{ background: 'var(--neon-amber)' }}></span>Color</div>
        </div>
        <div className="panel-body">
          <span style={lbl}>Accent color</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCENTS.map((k) => (
              <button key={k} type="button"
                      onClick={() => setF('color', COLORS[k]!)}
                      style={{
                        width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                        background: COLORS[k], border: form.color === COLORS[k] ? '3px solid var(--fg-0)' : '1px solid var(--line-strong)',
                      }}
                      title={k} />
            ))}
            <input type="color" value={form.color} onChange={(e) => setF('color', e.target.value)}
                   style={{ width: 36, height: 36, padding: 0, border: '1px solid var(--line-strong)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12, borderColor: 'rgba(255,77,94,.3)' }}>
        <div className="panel-head">
          <div className="panel-title" style={{ color: 'var(--bad)' }}>⚠ Danger zone</div>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handleArchive}>📦 Archive (ẩn khỏi Portfolio)</button>
          <button className="btn danger" onClick={handleDelete}>🗑 Delete forever</button>
        </div>
      </div>
    </div>
  );
}
