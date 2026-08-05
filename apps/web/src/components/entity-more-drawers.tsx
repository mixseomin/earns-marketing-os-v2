'use client';

// More self-loading drawers for <EntityDrawerHost>: agent (reuses AgentDetailModal) + a real
// team-member editor (none existed — team-page edited inline). Open by id from any page.

import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Drawer } from './ui';
import { AgentDetailModal } from './agent-detail-modal';
import { agentDrawerBundle } from '@/lib/actions/agents-detail';
import { listTeamMembers, updateTeamMember, type TeamMemberRow, type MemberRole, type Specialty } from '@/lib/actions/team';
import { mediaById, contactById } from '@/lib/actions/entity-drawer-loaders';
import { updateMediaAsset } from '@/lib/actions/vaults';

function Placeholder({ onClose, label, bad }: { onClose: () => void; label: string; bad?: boolean }) {
  return (
    <Drawer onClose={onClose} width={460} zIndex={300}>
      <div style={{ padding: 24, fontSize: 13, color: bad ? 'var(--bad)' : 'var(--fg-4)' }}>{label}</div>
    </Drawer>
  );
}

export function AgentDrawer({ agentId, onClose }: { agentId: number; onClose: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof agentDrawerBundle>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    agentDrawerBundle(agentId).then((r) => { if (live) setD(r); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [agentId]);
  if (d === 'loading') return <Placeholder onClose={onClose} label={`Đang tải agent #${agentId}…`} />;
  if (!d) return <Placeholder onClose={onClose} label={`Không tìm thấy agent #${agentId}.`} bad />;
  return <AgentDetailModal agent={d.agent} squadName={d.squadName} onClose={onClose} />;
}

const ROLES: MemberRole[] = ['admin', 'operator', 'viewer'];
const SPECIALTIES: Specialty[] = ['founder', 'writer', 'community', 'designer', 'video', 'outreach', 'analytics', 'ops', 'marketing-lead', 'other'];
const fld: CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };

// Real team-member editor (there was none — members were only editable inline on the team page).
export function TeamMemberDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [m, setM] = useState<TeamMemberRow | null | 'loading'>('loading');
  const [form, setForm] = useState({ displayName: '', role: 'operator' as MemberRole, specialty: 'other' as Specialty, bio: '', active: true });
  const baselineRef = useRef('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    listTeamMembers().then((rows) => {
      if (!live) return;
      const row = rows.find((x) => x.userId === userId) ?? null;
      setM(row);
      if (row) {
        const f = { displayName: row.displayName || row.name, role: row.role, specialty: row.specialty, bio: row.bio ?? '', active: row.active };
        setForm(f); baselineRef.current = JSON.stringify(f);
      }
    }).catch(() => { if (live) setM(null); });
    return () => { live = false; };
  }, [userId]);
  const dirty = JSON.stringify(form) !== baselineRef.current;
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((s) => ({ ...s, [k]: v }));

  if (m === 'loading') return <Placeholder onClose={onClose} label={`Đang tải member #${userId}…`} />;
  if (!m) return <Placeholder onClose={onClose} label={`Không tìm thấy team member #${userId}.`} bad />;

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await updateTeamMember(userId, { displayName: form.displayName, role: form.role, specialty: form.specialty, bio: form.bio || null, active: form.active });
    setBusy(false);
    if (!r.ok) { setErr(r.error || 'Lưu thất bại'); return; }
    onClose();
  };

  return (
    <Drawer onClose={onClose} width={480} zIndex={300} dirty={dirty} padding={0}>
      <div className="modal-head">
        <div>
          <div className="id-line">team member #{m.memberId}</div>
          <h2>🧑 {m.displayName || m.name}</h2>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      {err && <div style={{ padding: '8px 14px', color: 'var(--bad)', fontSize: 12 }}>⚠ {err}</div>}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{m.email}{m.lastLoginAt ? ` · login ${m.lastLoginAt.slice(0, 10)}` : ' · chưa đăng nhập'}</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--fg-4)' }}>
          <span>📋 {m.pendingTasksCount} chờ</span><span>▶ {m.inProgressTasksCount} đang làm</span>
          {m.extTokenIssuedAt && <span title="đã cấp token ext">🔑 ext</span>}
        </div>
        <div><span style={lbl}>Tên hiển thị</span><input style={fld} value={form.displayName} onChange={(e) => setF('displayName', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>Vai trò</span>
            <select style={fld} value={form.role} onChange={(e) => setF('role', e.target.value as MemberRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></div>
          <div><span style={lbl}>Chuyên môn</span>
            <select style={fld} value={form.specialty} onChange={(e) => setF('specialty', e.target.value as Specialty)}>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </div>
        <div><span style={lbl}>Bio</span><textarea style={{ ...fld, minHeight: 60 }} value={form.bio} onChange={(e) => setF('bio', e.target.value)} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setF('active', e.target.checked)} /> Đang hoạt động
        </label>
      </div>
      <div className="modal-foot">
        <div className="modal-foot-actions">
          <button className="btn ghost" onClick={onClose}>Huỷ</button>
          <button className="btn primary" onClick={save} disabled={busy || !dirty}>{busy ? '…' : 'Lưu'}</button>
        </div>
      </div>
    </Drawer>
  );
}

// Media asset — preview + edit tags/notes/hot (updateMediaAsset). Replaces the mock MediaPreviewDrawer.
export function MediaDrawer({ mediaId, onClose }: { mediaId: number; onClose: () => void }) {
  const [a, setA] = useState<Awaited<ReturnType<typeof mediaById>> | 'loading'>('loading');
  const [form, setForm] = useState({ tags: '', notes: '', hot: false });
  const baselineRef = useRef('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    mediaById(mediaId).then((r) => {
      if (!live) return; setA(r);
      if (r) { const f = { tags: (r.tags || []).join(', '), notes: r.notes ?? '', hot: r.hot }; setForm(f); baselineRef.current = JSON.stringify(f); }
    }).catch(() => { if (live) setA(null); });
    return () => { live = false; };
  }, [mediaId]);
  const dirty = JSON.stringify(form) !== baselineRef.current;
  if (a === 'loading') return <Placeholder onClose={onClose} label={`Đang tải media #${mediaId}…`} />;
  if (!a) return <Placeholder onClose={onClose} label={`Không tìm thấy media #${mediaId}.`} bad />;
  const save = async () => {
    setBusy(true);
    await updateMediaAsset(mediaId, { tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), notes: form.notes || null, hot: form.hot });
    setBusy(false); onClose();
  };
  return (
    <Drawer onClose={onClose} width={560} zIndex={300} dirty={dirty} padding={0}>
      <div className="modal-head">
        <div><div className="id-line">media #{a.id} · {a.kind}</div><h2>🖼️ {a.filename}</h2></div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {a.kind === 'image'
          ? <img src={a.url} alt={a.filename} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, border: '1px solid var(--line)', objectFit: 'contain' }} />
          : <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>↗ {a.url}</a>}
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-4)', flexWrap: 'wrap' }}>
          {a.mimeType && <span>{a.mimeType}</span>}
          {a.sizeBytes > 0 && <span>{Math.round(a.sizeBytes / 1024)} KB</span>}
          {a.width && a.height && <span>{a.width}×{a.height}</span>}
          {a.durationSec && <span>{a.durationSec}s</span>}
        </div>
        <div><span style={lbl}>Tags (phân cách dấu phẩy)</span><input style={fld} value={form.tags} onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))} /></div>
        <div><span style={lbl}>Ghi chú</span><textarea style={{ ...fld, minHeight: 56 }} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.hot} onChange={(e) => setForm((s) => ({ ...s, hot: e.target.checked }))} /> ⭐ Hot (ưu tiên dùng)
        </label>
      </div>
      <div className="modal-foot"><div className="modal-foot-actions">
        <button className="btn ghost" onClick={onClose}>Huỷ</button>
        <button className="btn primary" onClick={save} disabled={busy || !dirty}>{busy ? '…' : 'Lưu'}</button>
      </div></div>
    </Drawer>
  );
}

// Contact — read-only detail (no CRUD action exists for CRM contacts). Shows all fields + socials.
export function ContactDrawer({ contactId, onClose }: { contactId: number; onClose: () => void }) {
  const [c, setC] = useState<Awaited<ReturnType<typeof contactById>> | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    contactById(contactId).then((r) => { if (live) setC(r); }).catch(() => { if (live) setC(null); });
    return () => { live = false; };
  }, [contactId]);
  if (c === 'loading') return <Placeholder onClose={onClose} label={`Đang tải contact #${contactId}…`} />;
  if (!c) return <Placeholder onClose={onClose} label={`Không tìm thấy contact #${contactId}.`} bad />;
  const row = (k: string, v: ReactNode) => v ? <div style={{ display: 'flex', gap: 8, fontSize: 13 }}><span style={{ color: 'var(--fg-4)', minWidth: 84 }}>{k}</span><span style={{ color: 'var(--fg-1)' }}>{v}</span></div> : null;
  const socials = Object.entries(c.socialHandles || {});
  return (
    <Drawer onClose={onClose} width={460} zIndex={300} padding={0}>
      <div className="modal-head">
        <div><div className="id-line">contact #{c.id}</div><h2>📇 {c.name}</h2></div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {row('Email', c.email && <a href={`mailto:${c.email}`} style={{ color: 'var(--accent)' }}>{c.email}</a>)}
        {row('Vai trò', c.role)}
        {row('Công ty', c.company)}
        {socials.map(([k, v]) => row(k, v))}
        {row('Tags', c.tags?.length ? c.tags.join(', ') : null)}
        {c.notes && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{c.notes}</div>}
      </div>
    </Drawer>
  );
}
