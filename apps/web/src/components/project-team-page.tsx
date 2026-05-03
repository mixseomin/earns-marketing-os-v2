'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectMemberRow } from '@/lib/actions/assignments';
import { setProjectMembership } from '@/lib/actions/assignments';
import type { TeamMemberRow } from '@/lib/actions/team';

const ROLE_COLOR: Record<string, string> = {
  admin: 'var(--neon-violet)',
  operator: 'var(--neon-cyan)',
  viewer: 'var(--fg-3)',
};

const SPECIALTY_ICON: Record<string, string> = {
  founder: '👑', 'marketing-lead': '🎯', writer: '✍️', community: '💬',
  designer: '🎨', video: '🎬', outreach: '🤝', analytics: '📊', ops: '⚙', other: '👤',
};

export function ProjectTeamPage({
  projectId, projectName, members, allMembers, currentUserId, currentRole,
}: {
  projectId: string;
  projectName: string;
  members: ProjectMemberRow[];
  allMembers: TeamMemberRow[];
  currentUserId: number;
  currentRole: 'admin' | 'operator' | 'viewer';
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const isAdmin = currentRole === 'admin';

  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = allMembers.filter((m) => m.active && !memberIds.has(m.userId));

  const grant = (userId: number) => {
    setBusyId(userId);
    startTransition(async () => {
      await setProjectMembership(userId, projectId, true, 'operator');
      router.refresh();
      setBusyId(null);
    });
  };
  const revoke = (userId: number) => {
    if (!confirm('Revoke quyền truy cập project cho member này?')) return;
    setBusyId(userId);
    startTransition(async () => {
      await setProjectMembership(userId, projectId, false);
      router.refresh();
      setBusyId(null);
    });
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            👥 Project Team
            <small>// {members.length} member{members.length !== 1 ? 's' : ''} có quyền vào {projectName}</small>
          </h1>
          <p className="page-sub">
            Member trong project này. Operator chỉ thấy entities (accounts/proxies/profiles) được assign cho họ.
          </p>
        </div>
      </div>

      <div className="modal-section-title">Members</div>
      {members.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <p style={{ margin: 0, fontSize: 12 }}>Chưa có member nào assigned. {isAdmin ? 'Add từ list bên dưới.' : 'Liên hệ admin.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {members.map((m) => {
            const isMe = m.userId === currentUserId;
            const roleColor = ROLE_COLOR[m.role] ?? 'var(--fg-3)';
            return (
              <div key={m.userId} className="panel" style={{ padding: '10px 12px', border: isMe ? '1px solid var(--accent)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, background: roleColor,
                    color: 'var(--bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>{SPECIALTY_ICON[m.specialty] ?? '👤'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>
                      {m.displayName}{isMe && <span style={{ fontSize: 9, marginLeft: 6, padding: '1px 5px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>YOU</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{m.email}</div>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: roleColor, padding: '1px 5px', border: `1px solid ${roleColor}`, borderRadius: 3 }}>
                    {m.role}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  <span>🔐 {m.accountsCount} accounts owned</span>
                  <span>📥 {m.pendingTasks} pending</span>
                  {!m.active && <span style={{ color: 'var(--bad)' }}>· inactive</span>}
                </div>
                {isAdmin && m.role !== 'admin' && (
                  <div style={{ marginTop: 6 }}>
                    <button onClick={() => revoke(m.userId)} disabled={busyId === m.userId}
                      style={{
                        padding: '3px 8px', fontSize: 10, fontWeight: 600,
                        background: 'transparent', color: 'var(--bad)',
                        border: '1px solid var(--bad)', borderRadius: 3,
                        cursor: busyId === m.userId ? 'wait' : 'pointer',
                      }}>
                      {busyId === m.userId ? '...' : '✕ Revoke access'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && candidates.length > 0 && (
        <>
          <div className="modal-section-title" style={{ marginTop: 16 }}>Add member to {projectName}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {candidates.map((m) => (
              <div key={m.userId} className="panel" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{SPECIALTY_ICON[m.specialty] ?? '👤'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{m.displayName}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{m.email} · {m.specialty}</div>
                </div>
                <button onClick={() => grant(m.userId)} disabled={busyId === m.userId}
                  className="btn primary"
                  style={{ fontSize: 10, padding: '3px 8px' }}>
                  {busyId === m.userId ? '...' : '+ Grant'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <div style={{ marginTop: 14, padding: 10, background: 'rgba(255,176,60,.06)', border: '1px solid rgba(255,176,60,.3)', borderRadius: 6, fontSize: 11, color: 'var(--fg-2)' }}>
          💡 Sau khi add member: vào /p/{projectId}/resources?vault=accounts để assign account cho họ; vào /environments để assign proxy/profile.
        </div>
      )}
    </div>
  );
}
