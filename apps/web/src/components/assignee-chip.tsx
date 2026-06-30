'use client';

// Assign a human_task to a team member (human_tasks.assigned_user_id). The staff member
// then sees it in the Crew ext via /api/ext/my-tasks. Shared by the backlink task surface
// and (read paths) elsewhere. Chip + portal popover (searchable, shows workload).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { listTeamMembers, assignTaskToUser, type TeamMemberRow } from '@/lib/actions/team';

// Team members cached once across all cells — avoid N fetches.
let _teamMembersP: Promise<TeamMemberRow[]> | null = null;
const getTeamMembers = () => (_teamMembersP ??= listTeamMembers());

export function AssigneeCell({ taskId, name, assignedId, onChange }: {
  taskId: number; name: string; assignedId: number | null;
  onChange?: (userId: number | null, name: string) => void;
}) {
  const [cur, setCur] = useState<{ id: number | null; name: string }>({ id: assignedId, name });
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [members, setMembers] = useState<TeamMemberRow[] | null>(null);
  const [qf, setQf] = useState('');
  const [busy, setBusy] = useState(false);
  const sig = `${assignedId}|${name}`;
  useEffect(() => { setCur({ id: assignedId, name }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sig]);
  useEffect(() => { if (!at) return; const c = () => setAt(null); window.addEventListener('scroll', c, true); return () => window.removeEventListener('scroll', c, true); }, [at]);
  const open = (e: React.MouseEvent) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setAt({ x: r.left, y: r.bottom + 4 }); if (members == null) getTeamMembers().then(setMembers).catch(() => setMembers([])); };
  const pick = (m: TeamMemberRow) => { setAt(null); const nm = m.displayName || m.name; setCur({ id: m.userId, name: nm }); setBusy(true); assignTaskToUser(taskId, m.userId).finally(() => setBusy(false)); onChange?.(m.userId, nm); };
  const clear = () => { setAt(null); setCur({ id: null, name: '' }); setBusy(true); assignTaskToUser(taskId, null).finally(() => setBusy(false)); onChange?.(null, ''); };
  const list = (members || []).filter((m) => m.active && (!qf || (m.displayName || m.name).toLowerCase().includes(qf.toLowerCase())));
  return (
    <span style={{ display: 'inline-flex', minWidth: 0 }}>
      <span role="button" onClick={open} title={cur.id ? `Giao cho ${cur.name} — click đổi` : 'Giao cho team user'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, cursor: 'pointer', maxWidth: '100%',
          background: cur.id ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent', color: cur.id ? 'var(--accent)' : 'var(--fg-3)', border: cur.id ? '1px solid var(--accent-line)' : '1px dashed var(--line-2)' }}>
        {busy ? '…' : cur.id ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👤 {cur.name}</span> : '+ giao'}
      </span>
      {at && createPortal(
        <>
          <div onMouseDown={() => setAt(null)} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
          <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', left: at.x, top: at.y, zIndex: 300, background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,.55)', padding: 4, width: 210, maxHeight: '60vh', overflowY: 'auto' }}>
            <input value={qf} onChange={(e) => setQf(e.target.value)} placeholder="tìm nhân sự…" autoComplete="off"
              style={{ width: '100%', padding: '4px 7px', marginBottom: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-0)', fontSize: 11, boxSizing: 'border-box' }} />
            {members == null && <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--fg-4)' }}>loading…</div>}
            {cur.id != null && <button type="button" onClick={clear} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}>✕ Bỏ giao</button>}
            {list.map((m) => (
              <button key={m.userId} type="button" onClick={() => pick(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', color: m.userId === cur.id ? 'var(--accent)' : 'var(--fg-1)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                👤 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName || m.name}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--fg-4)', fontSize: 9 }}>{m.pendingTasksCount + m.inProgressTasksCount || ''}</span>
              </button>
            ))}
            {members != null && !list.length && <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--fg-4)' }}>không có nhân sự</div>}
          </div>
        </>, document.body)}
    </span>
  );
}
