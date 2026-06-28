'use client';
import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { listTeamMembers, createTeamMember, type TeamMemberRow } from '@/lib/actions/team';
import { getMemberAssignments, assignAccountsToMember, setProjectMembership, listProjectAccountsForAssignment, listAllProjectsForAssignment, type MemberAssignmentSummary } from '@/lib/actions/assignments';
import type { OpenFn } from '@/components/content-value-page';

// Node Team — quản lý nhân sự + ASSIGN nhóm project/account (mô hình staff seeding).
// NHÚNG drawer node `teamUser`. Tái dùng team.ts + assignments.ts. KHÔNG page riêng.
type Grouped = { userId: number; name: string; email: string; role: string; specialty: string; active: boolean; projects: { projectId: string; role: string }[] };
const ROLES = ['admin', 'operator', 'viewer'] as const;

export function TeamPanel({ onOpen }: { onOpen?: OpenFn }) {
  const [rows, setRows] = useState<TeamMemberRow[] | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string; emoji?: string | null }[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, MemberAssignmentSummary | 'loading'>>({});
  const [busy, setBusy] = useState(false);
  const [nu, setNu] = useState({ email: '', name: '', role: 'operator' as string });
  // account assignment manager state: which (userId,projectId) open + its account list + checked set
  const [mgr, setMgr] = useState<{ userId: number; projectId: string; accts: { id: number; handle: string | null; platformKey: string; ownerUserId: number | null }[]; checked: Set<number> } | null>(null);

  const reload = () => { listTeamMembers().then(setRows); };
  useEffect(() => { reload(); listAllProjectsForAssignment().then((p) => setProjects(p as { id: string; name: string }[])); }, []);

  const grouped: Grouped[] = (() => {
    if (!rows) return [];
    const m = new Map<number, Grouped>();
    for (const r of rows) {
      let g = m.get(r.userId);
      if (!g) { g = { userId: r.userId, name: r.name, email: r.email, role: r.role, specialty: r.specialty, active: r.active, projects: [] }; m.set(r.userId, g); }
      if (r.projectId == null) { g.role = r.role; g.specialty = r.specialty; g.active = r.active; }
      else g.projects.push({ projectId: r.projectId, role: r.role });
    }
    return [...m.values()];
  })();

  const toggle = (uid: number) => {
    if (open === uid) { setOpen(null); return; }
    setOpen(uid); setMgr(null);
    if (!detail[uid]) { setDetail((d) => ({ ...d, [uid]: 'loading' })); getMemberAssignments(uid).then((s) => setDetail((d) => ({ ...d, [uid]: s }))); }
  };
  const refreshMember = (uid: number) => { setDetail((d) => ({ ...d, [uid]: 'loading' })); getMemberAssignments(uid).then((s) => setDetail((d) => ({ ...d, [uid]: s }))); };

  const addMember = async () => { if (!nu.email.trim() || !nu.name.trim()) return; setBusy(true); await createTeamMember({ email: nu.email.trim(), name: nu.name.trim(), role: nu.role as 'operator' }); setNu({ email: '', name: '', role: 'operator' }); reload(); setBusy(false); };
  const toggleProject = async (uid: number, projectId: string, isMember: boolean) => { setBusy(true); await setProjectMembership(uid, projectId, isMember, 'operator'); reload(); refreshMember(uid); setBusy(false); };
  const openMgr = async (uid: number, projectId: string) => {
    setBusy(true);
    const accts = await listProjectAccountsForAssignment(projectId);
    setMgr({ userId: uid, projectId, accts, checked: new Set(accts.filter((a) => a.ownerUserId === uid).map((a) => a.id)) });
    setBusy(false);
  };
  const saveMgr = async () => { if (!mgr) return; setBusy(true); await assignAccountsToMember(mgr.userId, [...mgr.checked], mgr.projectId); setMgr(null); refreshMember(mgr.userId); reload(); setBusy(false); };

  if (!rows) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải team…</div>;
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)', verticalAlign: 'middle' };
  const inp: CSSProperties = { fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btn = (c: string): CSSProperties => ({ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: `1px solid ${c}`, background: 'transparent', color: c, cursor: 'pointer' });
  const projName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  return (
    <div style={{ opacity: busy ? 0.7 : 1 }}>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 10px' }}>
        {grouped.length} nhân sự · click 1 dòng để xem phân công + <b>assign nhóm project/account</b>. Operator tự bị chặn route admin; nhận việc qua /inbox.
      </p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, fontSize: 11, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--fg-3)' }}>＋ Thành viên:</span>
        <input value={nu.name} onChange={(e) => setNu((s) => ({ ...s, name: e.target.value }))} placeholder="tên" style={{ ...inp, width: 110 }} />
        <input value={nu.email} onChange={(e) => setNu((s) => ({ ...s, email: e.target.value }))} placeholder="email" style={{ ...inp, width: 150 }} />
        <select value={nu.role} onChange={(e) => setNu((s) => ({ ...s, role: e.target.value }))} style={inp}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <button onClick={addMember} disabled={busy} style={btn('var(--neon-cyan)')}>tạo</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...th, width: 22 }} /><th style={th}>Tên</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Chuyên</th><th style={{ ...th, textAlign: 'right' }}>Project</th></tr></thead>
        <tbody>
          {grouped.map((g) => {
            const isOpen = open === g.userId;
            const d = detail[g.userId];
            return (
              <Fragment key={g.userId}>
                <tr onClick={() => toggle(g.userId)} style={{ cursor: 'pointer', background: isOpen ? 'var(--bg-1)' : undefined, opacity: g.active ? 1 : 0.5 }}>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--fg-3)' }}>{isOpen ? '▾' : '▸'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{g.name}</td>
                  <td style={{ ...td, color: 'var(--fg-3)' }}>{g.email}</td>
                  <td style={td}><span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, border: `1px solid ${g.role === 'admin' ? 'var(--neon-violet)' : 'var(--bg-3)'}`, color: g.role === 'admin' ? 'var(--neon-violet)' : 'var(--fg-2)' }}>{g.role}</span></td>
                  <td style={{ ...td, color: 'var(--fg-2)' }}>{g.specialty}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{g.projects.length}</td>
                </tr>
                {isOpen && (
                  <tr><td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--bg-3)' }}>
                    <div style={{ padding: '10px 14px 14px 34px', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {d === 'loading' || !d ? <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải phân công…</span> : (
                        <>
                          <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                            Việc: <b style={{ color: 'var(--neon-amber)' }}>{d.pendingTasks}</b> pending · <b style={{ color: 'var(--neon-cyan)' }}>{d.inProgressTasks}</b> đang làm ·
                            <b style={{ color: 'var(--fg-1)', marginLeft: 4 }}>{d.accounts.length}</b> account · {d.proxies.length} proxy · {d.profiles.length} browser
                          </div>
                          {/* assign project membership + account */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '2px 0 5px' }}>Project phụ trách (✓ = member) + account được giao:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {projects.map((p) => {
                                const member = g.projects.find((x) => x.projectId === p.id);
                                const accts = d.accounts.filter((a) => a.projectId === p.id);
                                return (
                                  <div key={p.id} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', minWidth: 170 }}>
                                      <input type="checkbox" checked={!!member} onChange={(e) => toggleProject(g.userId, p.id, e.target.checked)} />
                                      <span style={{ color: member ? 'var(--fg-0)' : 'var(--fg-3)' }}>{p.name}</span>
                                    </label>
                                    {member && <>
                                      <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{accts.length ? accts.map((a) => a.handle).join(', ') : 'chưa account'}</span>
                                      <button onClick={() => openMgr(g.userId, p.id)} disabled={busy} style={btn('var(--neon-cyan)')}>assign account</button>
                                    </>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* account checkbox manager */}
                          {mgr && mgr.userId === g.userId && (
                            <div style={{ border: '1px solid var(--neon-cyan)', borderRadius: 8, padding: 10, background: 'var(--bg-0)' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Account của {projName(mgr.projectId)} → giao cho {g.name}:</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 4, marginBottom: 8 }}>
                                {mgr.accts.map((a) => {
                                  const otherOwner = a.ownerUserId != null && a.ownerUserId !== g.userId;
                                  return (
                                    <label key={a.id} title={otherOwner ? 'đang thuộc người khác' : ''} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, cursor: 'pointer', color: otherOwner ? 'var(--neon-amber)' : 'var(--fg-1)' }}>
                                      <input type="checkbox" checked={mgr.checked.has(a.id)} onChange={(e) => setMgr((m) => m ? ({ ...m, checked: (() => { const s = new Set(m.checked); if (e.target.checked) s.add(a.id); else s.delete(a.id); return s; })() }) : m)} />
                                      {a.handle || '(no handle)'} <span style={{ color: 'var(--fg-4)' }}>{a.platformKey}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              <button onClick={saveMgr} disabled={busy} style={btn('var(--neon-lime)')}>Lưu giao việc</button>
                              <button onClick={() => setMgr(null)} style={{ ...btn('var(--fg-3)'), marginLeft: 6 }}>huỷ</button>
                            </div>
                          )}
                          {/* quick open account nodes */}
                          {onOpen && d.accounts.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Account: {d.accounts.map((a) => <a key={a.id} role="button" onClick={() => onOpen('account', a.id, a.handle)} style={{ color: 'var(--fg-1)', cursor: 'pointer', marginRight: 8, textDecoration: 'none' }}>{a.handle}</a>)}</div>
                          )}
                        </>
                      )}
                    </div>
                  </td></tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
