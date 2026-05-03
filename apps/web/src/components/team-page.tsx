'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  type TeamMemberRow, type Specialty, type MemberRole,
  createTeamMember, updateTeamMember, archiveTeamMember,
} from '@/lib/actions/team';
import { setPasswordAction, logoutAction } from '@/lib/actions/auth';
import { listMemberProjects, setProjectMembership, getMemberAssignments, listMemberActivity, type MemberProjectRow, type MemberAssignmentSummary, type MemberActivityEvent } from '@/lib/actions/assignments';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';

const SPECIALTY_META: Record<Specialty, { label: string; icon: string; color: string }> = {
  founder:        { label: 'Founder',        icon: '👑', color: 'var(--neon-amber)' },
  'marketing-lead': { label: 'Marketing Lead', icon: '🎯', color: 'var(--neon-violet)' },
  writer:         { label: 'Content Writer', icon: '✍️', color: 'var(--neon-cyan)' },
  community:      { label: 'Community',      icon: '💬', color: 'var(--neon-lime)' },
  designer:       { label: 'Designer',       icon: '🎨', color: '#ff3ca8' },
  video:          { label: 'Video Editor',   icon: '🎬', color: '#3c9bff' },
  outreach:       { label: 'Outreach',       icon: '🤝', color: 'var(--neon-amber)' },
  analytics:      { label: 'Analytics',      icon: '📊', color: '#3c9bff' },
  ops:            { label: 'Ops',            icon: '⚙', color: 'var(--fg-2)' },
  other:          { label: 'Other',          icon: '👤', color: 'var(--fg-3)' },
};

const ROLE_META: Record<MemberRole, { label: string; color: string }> = {
  admin:    { label: 'Admin',    color: 'var(--neon-violet)' },
  operator: { label: 'Operator', color: 'var(--neon-cyan)' },
  viewer:   { label: 'Viewer',   color: 'var(--fg-3)' },
};

export function TeamPage({ members, currentUserId, currentRole }: { members: TeamMemberRow[]; currentUserId: number | null; currentRole?: 'admin' | 'operator' | 'viewer' }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [pwModal, setPwModal] = useState<TeamMemberRow | null>(null);
  const isAdmin = currentRole === 'admin';

  const visible = members.filter((m) => showInactive || m.active);
  const counts = {
    total: members.length,
    active: members.filter((m) => m.active).length,
    inactive: members.filter((m) => !m.active).length,
  };

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            👥 Team
            <small>// {counts.active} active · {counts.inactive} inactive</small>
          </h1>
          <p className="page-sub">
            Quản lý nhân sự + chuyên môn. AI Drafter route task vào đúng người dựa trên specialty. Inbox cá nhân / Team / Unassigned.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setCreating(true)}>+ New member</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {currentUserId && (
          <span style={{
            padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)',
            background: 'var(--accent-soft)', color: 'var(--accent)',
            border: '1px solid var(--accent)', borderRadius: 5,
          }}>
            👤 You: {members.find((m) => m.userId === currentUserId)?.displayName ?? `user #${currentUserId}`}
            {currentRole && ` · ${currentRole}`}
          </span>
        )}
        <button onClick={handleLogout}
          style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-2)', color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 5, cursor: 'pointer' }}>
          ↪ Logout
        </button>
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          show inactive ({counts.inactive})
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>Chưa có member nào.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Invite first member</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
          {visible.map((m) => {
            const sm = SPECIALTY_META[m.specialty] ?? SPECIALTY_META.other;
            const rm = ROLE_META[m.role] ?? ROLE_META.viewer;
            const isMe = m.userId === currentUserId;
            return (
              <div key={m.userId} className="panel"
                   style={{ padding: '12px 14px', cursor: 'pointer', opacity: m.active ? 1 : 0.5,
                            border: isMe ? '1px solid var(--accent)' : undefined }}
                   onClick={() => setEditing(m)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: sm.color, color: 'var(--bg-0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>{sm.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.displayName}
                      {isMe && <span style={{ fontSize: 9, padding: '1px 5px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>YOU</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                      {m.email}
                    </div>
                  </div>
                  {!m.active && <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>inactive</span>}
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: sm.color, padding: '1px 6px', border: `1px solid ${sm.color}`, borderRadius: 3 }}>
                    {sm.label}
                  </span>
                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: rm.color, padding: '1px 6px', border: `1px solid ${rm.color}`, borderRadius: 3 }}>
                    {rm.label}
                  </span>
                </div>

                {m.bio && (
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.45, marginBottom: 6 }}>
                    {m.bio}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', alignItems: 'center' }}>
                  <span title="Pending tasks">📥 {m.pendingTasksCount} pending</span>
                  <span title="In progress">⏳ {m.inProgressTasksCount} active</span>
                  <span style={{ flex: 1 }} />
                  {isAdmin && m.active && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPwModal(m); }}
                      title="Set hoặc reset password cho member này"
                      style={{
                        padding: '2px 6px', fontSize: 9, fontWeight: 600,
                        background: 'transparent', color: 'var(--neon-cyan)',
                        border: '1px solid var(--neon-cyan)', borderRadius: 3,
                        cursor: 'pointer',
                      }}>
                      🔑 Set password
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <MemberFormModal member={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}

      {pwModal && (
        <SetPasswordModal member={pwModal} onClose={() => setPwModal(null)} />
      )}
    </div>
  );
}

// ── Set/reset password modal ──────────────────────────────────────
function SetPasswordModal({ member, onClose }: { member: TeamMemberRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = () => {
    setError(null); setOkMessage(null);
    if (password.length < 8) { setError('Password tối thiểu 8 ký tự'); return; }
    if (password !== confirm) { setError('Password không khớp'); return; }
    setBusy(true);
    startTransition(async () => {
      const res = await setPasswordAction(member.userId, password);
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Set password thất bại'); return; }
      setOkMessage(`Đã set password cho ${member.displayName} (${member.email}). Chia sẻ password mới qua kênh secure.`);
      setPassword(''); setConfirm('');
    });
  };

  // Generate random strong password
  const generate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let p = '';
    for (let i = 0; i < 14; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p); setConfirm(p);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{member.email}</div>
            <h2>🔑 Set password — {member.displayName}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}
        {okMessage && <div style={{ padding: '8px 14px', background: 'rgba(16,185,129,.08)', borderBottom: '1px solid rgba(16,185,129,.3)', color: 'var(--ok)', fontSize: 12 }}>✓ {okMessage}</div>}
        <div className="modal-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-2)' }}>
            Member sẽ login tại <code>/login</code> bằng email <b>{member.email}</b> + password này. Session 30 ngày.
          </p>
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>New password</label>
            <input type="text" autoComplete="off" value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: '6px 8px', fontSize: 13,
                background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
                color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirm</label>
            <input type="text" autoComplete="off" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ width: '100%', marginTop: 4, padding: '6px 8px', fontSize: 13,
                background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
                color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={generate}
              style={{ padding: '6px 12px', fontSize: 11, background: 'transparent', color: 'var(--neon-cyan)', border: '1px solid var(--neon-cyan)', borderRadius: 4, cursor: 'pointer' }}>
              ✦ Generate strong (14 chars)
            </button>
            {password && (
              <button onClick={() => navigator.clipboard.writeText(password).catch(() => {})}
                style={{ padding: '6px 10px', fontSize: 11, background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer' }}>
                📋 Copy password
              </button>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <div className="meta">{member.displayName} · {member.specialty}</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Close</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? '...' : 'Set password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Form modal ────────────────────────────────────────────────────
function MemberFormModal({ member, onClose }: { member: TeamMemberRow | null; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !member;
  const [form, setForm] = useState({
    email: member?.email ?? '',
    name: member?.name ?? '',
    displayName: member?.displayName ?? '',
    role: (member?.role ?? 'operator') as MemberRole,
    specialty: (member?.specialty ?? 'other') as Specialty,
    bio: member?.bio ?? '',
    avatarUrl: member?.avatarUrl ?? '',
    active: member?.active ?? true,
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

  const save = () => {
    setError(null);
    if (!form.email.trim() || !form.name.trim()) {
      setError('Email và name bắt buộc');
      return;
    }
    startTransition(async () => {
      const payload = {
        ...form,
        avatarUrl: form.avatarUrl || null,
        bio: form.bio || null,
      };
      const res = isCreate
        ? await createTeamMember(payload)
        : await updateTeamMember(member!.userId, payload);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };
  const archive = () => {
    if (!member) return;
    if (!confirm(`Archive "${member.displayName}"? Member sẽ inactive nhưng task đã assign vẫn giữ.`)) return;
    startTransition(async () => { await archiveTeamMember(member.userId); router.refresh(); onClose(); });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{member ? `user #${member.userId}` : 'NEW MEMBER'}</div>
            <h2>{isCreate ? '+ New team member' : `Edit ${member!.displayName}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          context="Team member profile. Parse from a LinkedIn URL, signature email, About-Us page section, or paste team member intro."
          currentValues={{
            email: form.email,
            name: form.name,
            displayName: form.displayName,
            role: form.role,
            specialty: form.specialty,
            bio: form.bio,
            avatarUrl: form.avatarUrl,
          }}
          schema={[
            { key: 'email', label: 'Email address' },
            { key: 'name', label: 'Full real name' },
            { key: 'displayName', label: 'Display name (public-facing)' },
            { key: 'role', label: 'System role', type: 'enum', enumValues: ['admin', 'operator', 'viewer'] },
            { key: 'specialty', label: 'Job specialty', type: 'enum', enumValues: Object.keys(SPECIALTY_META) },
            { key: 'bio', label: 'Short bio / personal voice description (1-3 sentences)' },
            { key: 'avatarUrl', label: 'Avatar image URL' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            email: typeof v.email === 'string' ? v.email : f.email,
            name: typeof v.name === 'string' ? v.name : f.name,
            displayName: typeof v.displayName === 'string' ? v.displayName : f.displayName,
            role: (v.role as MemberRole) || f.role,
            specialty: (v.specialty as Specialty) || f.specialty,
            bio: typeof v.bio === 'string' ? v.bio : f.bio,
            avatarUrl: typeof v.avatarUrl === 'string' ? v.avatarUrl : f.avatarUrl,
          }))}
        />

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={lbl}>Email *</span>
            <NoFillInput type="text" style={fld} placeholder="member@team.com"
                         value={form.email} onChange={(e) => setF('email', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Real name *</span>
            <NoFillInput style={fld} placeholder="Nguyễn Văn A"
                         value={form.name} onChange={(e) => setF('name', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Display name</span>
            <NoFillInput style={fld} placeholder="Public name (default = real name)"
                         value={form.displayName} onChange={(e) => setF('displayName', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Role</span>
            <select style={fld} value={form.role} onChange={(e) => setF('role', e.target.value as MemberRole)}>
              {(Object.entries(ROLE_META) as Array<[MemberRole, { label: string }]>).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={lbl}>Specialty</span>
            <select style={fld} value={form.specialty} onChange={(e) => setF('specialty', e.target.value as Specialty)}>
              {(Object.entries(SPECIALTY_META) as Array<[Specialty, { label: string; icon: string }]>).map(([k, m]) => (
                <option key={k} value={k}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={lbl}>Avatar URL</span>
            <NoFillInput type="url" style={fld} placeholder="https://..."
                         value={form.avatarUrl} onChange={(e) => setF('avatarUrl', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Bio / voice description</span>
            <textarea style={{ ...fld, minHeight: 60, fontFamily: 'inherit', resize: 'vertical' }}
                      placeholder="Casual, dùng emoji, focus dev tools, response thân thiện..."
                      value={form.bio} onChange={(e) => setF('bio', e.target.value)} />
          </div>
          {!isCreate && (
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-1)' }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setF('active', e.target.checked)} />
                Active member (uncheck to hide from inbox routing)
              </label>
            </div>
          )}
          {!isCreate && member && (
            <>
              <div style={{ gridColumn: '1 / 3' }}>
                <ProjectAccessSection userId={member.userId} userName={member.displayName} />
              </div>
              <div style={{ gridColumn: '1 / 3' }}>
                <AssignmentInventory userId={member.userId} userName={member.displayName} />
              </div>
              <div style={{ gridColumn: '1 / 3' }}>
                <ActivityTimeline userId={member.userId} userName={member.displayName} />
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {member ? `Joined ${new Date(member.createdAt).toLocaleDateString('vi-VN')}` : 'New team member'}
          </div>
          <div className="modal-foot-actions">
            {!isCreate && member!.active && <button className="btn danger" onClick={archive}>🗑 Archive</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isCreate ? 'Invite' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project access for a member (admin only) ──────────────────────
function ProjectAccessSection({ userId, userName }: { userId: number; userName: string }) {
  const [rows, setRows] = useState<MemberProjectRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listMemberProjects(userId).then((r) => { if (!cancelled) setRows(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const toggle = (projectId: string, isMember: boolean) => {
    setBusyId(projectId);
    startTransition(async () => {
      const res = await setProjectMembership(userId, projectId, isMember);
      if (res.ok) {
        setRows((prev) => prev ? prev.map((r) => r.projectId === projectId ? { ...r, isMember } : r) : prev);
      }
      setBusyId(null);
    });
  };

  if (!rows) return <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 8 }}>Loading projects...</div>;
  const memberCount = rows.filter((r) => r.isMember).length;
  return (
    <div style={{
      marginTop: 6, padding: 10,
      background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6,
    }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📁 Project access</span>
        <span style={{ color: 'var(--fg-2)', textTransform: 'none', letterSpacing: 0 }}>· {userName} có thể vào {memberCount}/{rows.length} projects</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4 }}>
        {rows.map((r) => (
          <label key={r.projectId} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
            background: r.isMember ? 'var(--accent-soft)' : 'transparent',
            border: `1px solid ${r.isMember ? 'var(--accent)' : 'var(--line)'}`,
            borderRadius: 4, fontSize: 11,
            cursor: busyId === r.projectId ? 'wait' : 'pointer',
            opacity: busyId === r.projectId ? 0.5 : 1,
          }}>
            <input type="checkbox" checked={r.isMember}
              disabled={busyId === r.projectId}
              onChange={(e) => toggle(r.projectId, e.target.checked)} />
            <span style={{ flex: 1, color: r.isMember ? 'var(--accent)' : 'var(--fg-1)', fontWeight: r.isMember ? 600 : 400 }}>
              {r.projectName}
            </span>
            {r.role && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{r.role}</span>}
          </label>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        Operator chỉ thấy projects được tick. Admin luôn thấy tất cả.
      </div>
    </div>
  );
}

// ── Assignment inventory: what entities member owns ───────────────
function AssignmentInventory({ userId, userName }: { userId: number; userName: string }) {
  const [data, setData] = useState<MemberAssignmentSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMemberAssignments(userId).then((d) => { if (!cancelled) setData(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);
  if (!data) return null;
  const total = data.accounts.length + data.proxies.length + data.profiles.length + data.tribes.length;
  if (total === 0 && data.pendingTasks === 0 && data.inProgressTasks === 0) {
    return (
      <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px dashed var(--line)', borderRadius: 6, fontSize: 11, color: 'var(--fg-3)' }}>
        🧹 {userName} chưa được assign account/proxy/profile/tribe nào. Vào /p/[id]/resources hoặc /environments để assign.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        🔐 Assigned entities — {userName} quản lý
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 11 }}>
        <InventoryGroup label="Accounts" icon="🔐" count={data.accounts.length}
          items={data.accounts.map((a) => `@${a.handle} · ${a.platformLabel} (${a.projectId})`)} />
        <InventoryGroup label="Proxies" icon="🔌" count={data.proxies.length}
          items={data.proxies.map((p) => `${p.label} · ${p.type}`)} />
        <InventoryGroup label="Browser profiles" icon="🧬" count={data.profiles.length}
          items={data.profiles.map((p) => `${p.label} · ${p.tool}`)} />
        <InventoryGroup label="Tribes" icon="🏘" count={data.tribes.length}
          items={data.tribes.map((t) => `${t.label} (${t.projectId})`)} />
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        📥 {data.pendingTasks} pending · ⏳ {data.inProgressTasks} in progress
      </div>
    </div>
  );
}

function InventoryGroup({ label, icon, count, items }: { label: string; icon: string; count: number; items: string[] }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '6px 8px' }}>
      <div style={{ fontSize: 10.5, color: count > 0 ? 'var(--fg-1)' : 'var(--fg-4)', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{icon}</span>
        <span>{label}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          color: count > 0 ? 'var(--ok)' : 'var(--fg-4)',
          marginLeft: 'auto', fontSize: 10,
        }}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>chưa có</div>
      ) : (
        <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>
          {items.slice(0, 5).map((it, i) => <li key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it}</li>)}
          {items.length > 5 && <li style={{ color: 'var(--fg-3)', fontStyle: 'italic' }}>+{items.length - 5} more...</li>}
        </ul>
      )}
    </div>
  );
}

// ── Activity timeline: what member is/was doing ──────────────────
function ActivityTimeline({ userId, userName }: { userId: number; userName: string }) {
  const [events, setEvents] = useState<MemberActivityEvent[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listMemberActivity(userId, 25).then((d) => { if (!cancelled) setEvents(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);
  if (!events) return null;
  if (events.length === 0) {
    return (
      <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px dashed var(--line)', borderRadius: 6, fontSize: 11, color: 'var(--fg-3)' }}>
        📊 Chưa có activity. {userName} chưa login hoặc chưa nhận task.
      </div>
    );
  }
  const fmtRel = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
    return `${Math.floor(ms / 86_400_000)}d`;
  };
  const ICON: Record<MemberActivityEvent['type'], string> = {
    task_assigned: '📥', task_claimed: '👆', task_completed: '✓',
    task_published: '🚀', login: '🔓',
  };
  const COLOR: Record<MemberActivityEvent['type'], string> = {
    task_assigned: 'var(--fg-3)', task_claimed: 'var(--neon-cyan)',
    task_completed: 'var(--neon-violet)', task_published: 'var(--ok)',
    login: 'var(--neon-amber)',
  };
  const LABEL: Record<MemberActivityEvent['type'], string> = {
    task_assigned: 'Task assigned', task_claimed: 'Claimed',
    task_completed: 'Completed', task_published: 'Published', login: 'Logged in',
  };
  return (
    <div style={{ marginTop: 6, padding: 10, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        📊 Activity timeline (last {events.length})
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {events.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 6px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 4,
            fontSize: 11,
          }}>
            <span style={{ fontSize: 13, color: COLOR[e.type], width: 18, textAlign: 'center', flexShrink: 0 }}>{ICON[e.type]}</span>
            <span style={{ color: 'var(--fg-2)', minWidth: 90, fontWeight: 500 }}>{LABEL[e.type]}</span>
            <span style={{ flex: 1, color: 'var(--fg-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {e.taskTitle ? `#${e.taskId} ${e.taskTitle}` : ''}
              {e.feedbackType && e.feedbackType !== 'success' && (
                <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)' }}>· {e.feedbackType}</span>
              )}
            </span>
            {e.projectId && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{e.projectId}</span>}
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>{fmtRel(e.at)}</span>
            {e.publishUrl && (
              <a href={`https://href.li/?${e.publishUrl}`} target="_blank" rel="noopener noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                style={{ fontSize: 9, color: 'var(--neon-cyan)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>↗</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
