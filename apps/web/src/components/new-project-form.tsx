'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/actions/projects';

const COLORS = [
  { name: 'cyan',   hex: '#00e5ff' },
  { name: 'lime',   hex: '#b6ff3c' },
  { name: 'amber',  hex: '#ffb03c' },
  { name: 'violet', hex: '#9d6cff' },
  { name: 'pink',   hex: '#ff3ca8' },
  { name: 'red',    hex: '#ff4d5e' },
  { name: 'blue',   hex: '#3c9bff' },
];

type Mode = { id: string; label: string; sub: string; accent: string };

export function NewProjectForm({ allModes }: { allModes: Mode[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    emoji: '📦',
    modeId: allModes[0]?.id ?? 'affiliate',
    agentsCore: 0,
    agentsShared: 0,
    budget: 0,
    health: 100,
    revenue: '—',
    kpi: '',
    color: '#00e5ff',
  });

  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Tên project không được rỗng'); return; }
    setSaving(true); setError(null);
    const res = await createProject(form);
    setSaving(false);
    if (!res.ok || !res.id) { setError(res.error || 'Tạo thất bại'); return; }
    router.push(`/p/${res.id}/settings`);
    router.refresh();
  };

  const lbl = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, display: 'block' };
  const fld = { width: '100%', padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">+ New Project</h1>
          <p className="page-sub">Bắt đầu với template (mode), tinh chỉnh chi tiết sau ở Settings.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => router.push('/')}>Cancel</button>
          <button className="btn primary" disabled={saving || !form.name.trim()} onClick={handleCreate}>
            {saving ? 'Creating…' : 'Create project →'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,77,94,.08)', border: '1px solid rgba(255,77,94,.3)', borderRadius: 8, color: 'var(--bad)', marginBottom: 12, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><div className="panel-title"><span className="dot"></span>Identity</div></div>
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 }}>
          <div>
            <span style={lbl}>Emoji</span>
            <input style={{ ...fld, fontSize: 28, textAlign: 'center', padding: 6 }} maxLength={4}
                   value={form.emoji} onChange={(e) => setF('emoji', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Tên project *</span>
            <input style={fld} placeholder="e.g. Newsletter Lab, Indie Saas Y" autoFocus
                   value={form.name} onChange={(e) => setF('name', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head"><div className="panel-title"><span className="dot" style={{ background: 'var(--neon-violet)' }}></span>Mode (mục đích)</div></div>
        <div className="panel-body">
          <span style={lbl}>Template — quy định columns Board, KPI shape, Squads default</span>
          <select style={fld} value={form.modeId} onChange={(e) => setF('modeId', e.target.value)}>
            {allModes.map((m) => (
              <option key={m.id} value={m.id}>{m.label} — {m.sub.replace('// ', '')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head"><div className="panel-title"><span className="dot" style={{ background: 'var(--neon-amber)' }}></span>Color</div></div>
        <div className="panel-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button key={c.name} type="button" onClick={() => setF('color', c.hex)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, cursor: 'pointer', background: c.hex,
                      border: form.color === c.hex ? '3px solid var(--fg-0)' : '1px solid var(--line-strong)',
                    }}
                    title={c.name} />
          ))}
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        Project bắt đầu blank — agents 0, budget 0, health 100. Có thể chỉnh ở Settings sau khi tạo.
      </p>
    </div>
  );
}
