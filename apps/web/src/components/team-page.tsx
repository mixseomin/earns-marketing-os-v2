'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  type TeamMemberRow, type Specialty, type MemberRole,
  createTeamMember, updateTeamMember, archiveTeamMember,
} from '@/lib/actions/team';
import { generateMagicLink, logoutAction } from '@/lib/actions/auth';
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
  const [linkModal, setLinkModal] = useState<{ url: string; member: TeamMemberRow } | null>(null);
  const isAdmin = currentRole === 'admin';

  const visible = members.filter((m) => showInactive || m.active);
  const counts = {
    total: members.length,
    active: members.filter((m) => m.active).length,
    inactive: members.filter((m) => !m.active).length,
  };

  const handleGenLink = (m: TeamMemberRow) => {
    startTransition(async () => {
      const res = await generateMagicLink(m.userId);
      if (!res.ok || !res.url) {
        alert(`Lỗi: ${res.error ?? 'không tạo được link'}`);
        return;
      }
      setLinkModal({ url: res.url, member: m });
    });
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
                  {isAdmin && m.active && m.userId !== currentUserId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenLink(m); }}
                      title="Generate magic link 24h cho member này"
                      style={{
                        padding: '2px 6px', fontSize: 9, fontWeight: 600,
                        background: 'transparent', color: 'var(--neon-cyan)',
                        border: '1px solid var(--neon-cyan)', borderRadius: 3,
                        cursor: 'pointer',
                      }}>
                      🔑 Login link
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

      {linkModal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLinkModal(null); }}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="id-line">MAGIC LINK · {linkModal.member.email}</div>
                <h2>🔑 Login link cho {linkModal.member.displayName}</h2>
              </div>
              <button className="modal-close" onClick={() => setLinkModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                Link một-lần dưới đây có hiệu lực <b>24 giờ</b>. Member click vào sẽ được login + session 30 ngày.
                Copy + gửi cho member qua Telegram/WhatsApp/email.
              </p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input readOnly value={linkModal.url}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1, padding: '8px 10px', fontSize: 12,
                    background: 'var(--bg-2)', border: '1px solid var(--neon-cyan)', borderRadius: 5,
                    color: 'var(--fg-0)', fontFamily: 'var(--font-mono)',
                  }} />
                <button className="btn primary"
                  onClick={() => navigator.clipboard.writeText(linkModal.url).catch(() => {})}>
                  📋 Copy
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 10.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                ⚠ Link là one-time-use. Sau khi member dùng → invalidated. Tạo link mới nếu cần.
              </p>
            </div>
            <div className="modal-foot">
              <div className="meta">expires in 24h</div>
              <div className="modal-foot-actions">
                <button className="btn primary" onClick={() => setLinkModal(null)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
