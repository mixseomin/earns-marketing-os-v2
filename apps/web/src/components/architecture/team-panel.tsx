'use client';
import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { listTeamMembers, createTeamMember, updateTeamMember, setMemberExtStatus, type TeamMemberRow, type MemberRole, type Specialty } from '@/lib/actions/team';
import { getMemberAssignments, assignAccountsToMember, setProjectMembership, listProjectAccountsForAssignment, listAllProjectsForAssignment, setEntityOwner, projectAccountCounts, type MemberAssignmentSummary } from '@/lib/actions/assignments';
import { listBrowserProfiles, listProxies, type BrowserProfileRow, type ProxyRow } from '@/lib/actions/environments';
import type { OpenFn } from '@/components/content-value-page';
import { SiteFavicon, platformFaviconProps } from '@/components/ui/site-favicon';

// Node Team — quản lý nhân sự + ASSIGN project/account/browser/proxy (mô hình staff seeding).
// Drive từ getMemberAssignments (membership THẬT). Trình bày CHIP + dropdown-thêm, KHÔNG list phẳng.
const ROLES = ['admin', 'operator', 'viewer'] as const;
const SPECIALTIES = ['founder', 'writer', 'community', 'designer', 'video', 'outreach', 'analytics', 'ops', 'marketing-lead', 'other'] as const;
// Bàn giao Crew ext (thủ công tới khi token per-user của Pha 2 có). login/last-seen/usage thật của ext
// sẽ derive từ ext_call_log khi Pha 2 ship; giờ surface tín hiệu có thật: login web + hoạt động task.
const EXT_STATES = ['none', 'handed', 'active', 'revoked'] as const;
const EXT_META: Record<string, { label: string; color: string }> = {
  none: { label: 'chưa cấp', color: 'var(--fg-4)' }, handed: { label: 'đã giao', color: 'var(--neon-cyan)' },
  active: { label: 'đang dùng', color: 'var(--neon-lime)' }, revoked: { label: 'thu hồi', color: 'var(--bad)' },
};
const extMeta = (s: string | null | undefined) => EXT_META[s || 'none'] ?? EXT_META.none!;
type Grouped = { userId: number; name: string; email: string; role: string; specialty: string; active: boolean; extStatus: string | null; lastLoginAt: string | null };
type EditForm = { name: string; email: string; role: string; specialty: string; active: boolean };

export function TeamPanel({ onOpen }: { onOpen?: OpenFn }) {
  const [rows, setRows] = useState<TeamMemberRow[] | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<BrowserProfileRow[]>([]);
  const [proxies, setProxies] = useState<ProxyRow[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, MemberAssignmentSummary | 'loading'>>({});
  const [busy, setBusy] = useState(false);
  const [nu, setNu] = useState({ email: '', name: '', role: 'operator' as string });
  const [mgr, setMgr] = useState<{ userId: number; projectId: string; accts: { id: number; handle: string | null; platformKey: string; ownerUserId: number | null }[]; checked: Set<number> } | null>(null);
  const [acctCounts, setAcctCounts] = useState<Record<string, number>>({});
  const [ef, setEf] = useState<Record<number, EditForm>>({});

  const reloadLists = () => { listBrowserProfiles().then(setProfiles); listProxies().then(setProxies); };
  useEffect(() => {
    listTeamMembers().then(setRows);
    listAllProjectsForAssignment().then((p) => setProjects((p as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name }))));
    projectAccountCounts().then(setAcctCounts);
    reloadLists();
  }, []);

  const grouped: Grouped[] = (() => {
    if (!rows) return [];
    const m = new Map<number, Grouped>();
    for (const r of rows) { if (!m.has(r.userId)) m.set(r.userId, { userId: r.userId, name: r.name, email: r.email, role: r.role, specialty: r.specialty, active: r.active, extStatus: r.extStatus, lastLoginAt: r.lastLoginAt }); }
    return [...m.values()];
  })();

  const loadDetail = (uid: number) => { setDetail((d) => ({ ...d, [uid]: 'loading' })); getMemberAssignments(uid).then((s) => setDetail((d) => ({ ...d, [uid]: s }))); };
  const toggle = (uid: number) => {
    if (open === uid) { setOpen(null); return; }
    setOpen(uid); setMgr(null);
    const gg = grouped.find((x) => x.userId === uid);
    if (gg) setEf((f) => ({ ...f, [uid]: { name: gg.name, email: gg.email, role: gg.role, specialty: gg.specialty, active: gg.active } }));
    if (!detail[uid]) loadDetail(uid);
  };

  const addMember = async () => { if (!nu.email.trim() || !nu.name.trim()) return; setBusy(true); await createTeamMember({ email: nu.email.trim(), name: nu.name.trim(), role: nu.role as 'operator' }); setNu({ email: '', name: '', role: 'operator' }); listTeamMembers().then(setRows); setBusy(false); };
  const saveMember = async (uid: number) => { const f = ef[uid]; if (!f || !f.name.trim() || !f.email.trim()) return; setBusy(true); await updateTeamMember(uid, { name: f.name.trim(), email: f.email.trim(), role: f.role as MemberRole, specialty: f.specialty as Specialty, active: f.active }); await new Promise<void>((r) => listTeamMembers().then((x) => { setRows(x); r(); })); setBusy(false); };
  const saveExt = async (uid: number, status: string) => { setBusy(true); await setMemberExtStatus(uid, status); await new Promise<void>((r) => listTeamMembers().then((x) => { setRows(x); r(); })); setBusy(false); };
  const addProject = async (uid: string | number, pid: string) => { if (!pid) return; setBusy(true); await setProjectMembership(Number(uid), pid, true, 'operator'); loadDetail(Number(uid)); setBusy(false); };
  const removeProject = async (uid: number, pid: string) => { setBusy(true); await setProjectMembership(uid, pid, false); loadDetail(uid); setBusy(false); };
  const openMgr = async (uid: number, projectId: string) => { setBusy(true); const accts = await listProjectAccountsForAssignment(projectId); setMgr({ userId: uid, projectId, accts, checked: new Set(accts.filter((a) => a.ownerUserId === uid).map((a) => a.id)) }); setBusy(false); };
  const saveMgr = async () => { if (!mgr) return; setBusy(true); await assignAccountsToMember(mgr.userId, [...mgr.checked], mgr.projectId); const uid = mgr.userId; setMgr(null); loadDetail(uid); setBusy(false); };
  const assignEntity = async (uid: number, type: 'browser_profile' | 'proxy', id: number | null, owner: number | null) => { if (id == null) return; setBusy(true); await setEntityOwner(type, id, owner); loadDetail(uid); reloadLists(); setBusy(false); };

  if (!rows) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải team…</div>;
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)', verticalAlign: 'middle' };
  const inp: CSSProperties = { fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btn = (c: string): CSSProperties => ({ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: `1px solid ${c}`, background: 'transparent', color: c, cursor: 'pointer' });
  const chip = (c = 'var(--bg-3)'): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 5px 2px 9px', borderRadius: 99, border: `1px solid ${c}`, background: 'var(--bg-0)' });
  const xbtn: CSSProperties = { cursor: 'pointer', color: 'var(--fg-3)', border: 0, background: 'transparent', fontSize: 13, lineHeight: 1, padding: '0 2px' };
  const projName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  return (
    <div style={{ opacity: busy ? 0.7 : 1 }}>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 10px' }}>
        {grouped.length} nhân sự · click 1 dòng → assign <b>project · account · browser/proxy</b> bằng chip + dropdown. Operator nhận việc qua /inbox.
      </p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, fontSize: 11, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--fg-3)' }}>＋ Thành viên:</span>
        <input value={nu.name} onChange={(e) => setNu((s) => ({ ...s, name: e.target.value }))} placeholder="tên" style={{ ...inp, width: 110 }} />
        <input value={nu.email} onChange={(e) => setNu((s) => ({ ...s, email: e.target.value }))} placeholder="email" style={{ ...inp, width: 150 }} />
        <select value={nu.role} onChange={(e) => setNu((s) => ({ ...s, role: e.target.value }))} style={inp}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <button onClick={addMember} disabled={busy} style={btn('var(--neon-cyan)')}>tạo</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...th, width: 22 }} /><th style={th}>Tên</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Chuyên</th><th style={th}>Ext</th></tr></thead>
        <tbody>
          {grouped.map((g) => {
            const isOpen = open === g.userId;
            const d = detail[g.userId];
            const dd = (d && d !== 'loading') ? d : null;
            const memberIds = new Set(dd?.projects.map((p) => p.projectId));
            return (
              <Fragment key={g.userId}>
                <tr onClick={() => toggle(g.userId)} style={{ cursor: 'pointer', background: isOpen ? 'var(--bg-1)' : undefined, opacity: g.active ? 1 : 0.5 }}>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--fg-3)' }}>{isOpen ? '▾' : '▸'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{g.name}</td>
                  <td style={{ ...td, color: 'var(--fg-3)' }}>{g.email}</td>
                  <td style={td}><span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, border: `1px solid ${g.role === 'admin' ? 'var(--neon-violet)' : 'var(--bg-3)'}`, color: g.role === 'admin' ? 'var(--neon-violet)' : 'var(--fg-2)' }}>{g.role}</span></td>
                  <td style={{ ...td, color: 'var(--fg-2)' }}>{g.specialty}</td>
                  <td style={td}>{(() => { const m = extMeta(g.extStatus); return <span title="trạng thái bàn giao Crew ext" style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, border: `1px solid ${m.color}`, color: m.color }}>{m.label}</span>; })()}</td>
                </tr>
                {isOpen && (
                  <tr><td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--bg-3)' }}>
                    <div style={{ padding: '12px 14px 14px 34px', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!dd ? <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải phân công…</span> : (
                        <>
                          {/* SỬA member: tên + email + role + chuyên + active */}
                          {(() => { const f = ef[g.userId] ?? { name: g.name, email: g.email, role: g.role, specialty: g.specialty, active: g.active }; const set = (patch: Partial<EditForm>) => setEf((s) => ({ ...s, [g.userId]: { ...f, ...patch } })); return (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, paddingBottom: 9, borderBottom: '1px solid var(--bg-2)' }}>
                              <span style={{ color: 'var(--fg-3)', fontWeight: 700 }}>Sửa:</span>
                              <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="tên" style={{ ...inp, width: 160 }} />
                              <input value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="email" style={{ ...inp, width: 190 }} />
                              <select value={f.role} onChange={(e) => set({ role: e.target.value })} title="role" style={inp}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                              <select value={f.specialty} onChange={(e) => set({ specialty: e.target.value })} title="chuyên môn" style={inp}>{SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                              <label style={{ display: 'flex', gap: 4, alignItems: 'center', color: 'var(--fg-2)', cursor: 'pointer' }}><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> active</label>
                              <button onClick={() => saveMember(g.userId)} disabled={busy || !f.name.trim() || !f.email.trim()} style={btn('var(--neon-lime)')}>Lưu</button>
                              <span style={{ width: 1, height: 16, background: 'var(--bg-3)' }} />
                              <span style={{ color: 'var(--fg-3)' }}>Ext:</span>
                              <select value={g.extStatus ?? 'none'} onChange={(e) => saveExt(g.userId, e.target.value)} disabled={busy} title="bàn giao Crew ext" style={inp}>{EXT_STATES.map((s) => <option key={s} value={s}>{extMeta(s).label}</option>)}</select>
                            </div>
                          ); })()}
                          {/* HIỆU SUẤT: xong / tổng + 7 ngày + tỉ lệ + gần nhất */}
                          <div style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span>✓ <b style={{ color: 'var(--neon-lime)' }}>{dd.doneTasks}</b>/{dd.totalTasks} xong{dd.totalTasks > 0 && <span style={{ color: 'var(--fg-3)' }}> ({Math.round((dd.doneTasks / dd.totalTasks) * 100)}%)</span>}</span>
                            <span><b style={{ color: 'var(--neon-cyan)' }}>{dd.done7d}</b> xong 7 ngày</span>
                            <span><b style={{ color: 'var(--neon-amber)' }}>{dd.pendingTasks}</b> chờ · <b style={{ color: 'var(--neon-cyan)' }}>{dd.inProgressTasks}</b> đang làm{dd.failedTasks > 0 && <span style={{ color: 'var(--bad)' }}> · {dd.failedTasks} fail</span>}</span>
                            {dd.lastDone && <span style={{ color: 'var(--fg-3)' }}>việc gần nhất {new Date(dd.lastDone).toLocaleDateString('vi-VN')}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span>🌐 Ext: <b style={{ color: extMeta(g.extStatus).color }}>{extMeta(g.extStatus).label}</b></span>
                            <span>login web cuối: {g.lastLoginAt ? new Date(g.lastLoginAt).toLocaleString('vi-VN') : '—'}</span>
                            <span style={{ color: 'var(--fg-4)' }}>· login/last-seen/usage thật của ext sẽ có khi ext bản nhân sự (Pha 2, token per-user) ship</span>
                          </div>

                          {/* PROJECT: chip + dropdown thêm (ko list phẳng 25 cái) */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '0 0 5px' }}>Project phụ trách ({dd.projects.length})</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {dd.projects.map((p) => (
                                <span key={p.projectId} style={chip('var(--neon-cyan)')}>
                                  {onOpen ? <a role="button" onClick={() => onOpen('project', p.projectId, p.projectName)} style={{ color: 'var(--fg-0)', cursor: 'pointer', textDecoration: 'none' }}>{p.projectName}</a> : p.projectName}
                                  <button onClick={() => removeProject(g.userId, p.projectId)} disabled={busy} title="bỏ phụ trách" style={xbtn}>×</button>
                                </span>
                              ))}
                              <select value="" onChange={(e) => addProject(g.userId, e.target.value)} disabled={busy} style={{ ...inp, maxWidth: 170 }}>
                                <option value="">＋ thêm project…</option>
                                {projects.filter((p) => !memberIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* ACCOUNT: table thẳng hàng (Project · đã giao · pool · giao); picker bung full-width dưới dòng */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '0 0 5px' }}>Account được giao ({dd.accounts.length})</div>
                            {dd.projects.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Thêm project trước để giao account.</div> : (
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr><th style={th}>Project</th><th style={th}>Account đã giao</th><th style={{ ...th, textAlign: 'right' }}>Pool</th><th style={{ ...th, width: 64 }} /></tr></thead>
                                <tbody>
                                  {dd.projects.map((p) => {
                                    const accs = dd.accounts.filter((a) => a.projectId === p.projectId);
                                    const showMgr = !!mgr && mgr.userId === g.userId && mgr.projectId === p.projectId;
                                    const pool = acctCounts[p.projectId] ?? 0;
                                    return (
                                      <Fragment key={p.projectId}>
                                        <tr style={{ background: showMgr ? 'var(--bg-2)' : undefined }}>
                                          <td style={{ ...td, fontWeight: 600 }}>{onOpen ? <a role="button" onClick={() => onOpen('project', p.projectId, p.projectName)} style={{ color: 'var(--fg-1)', cursor: 'pointer', textDecoration: 'none' }}>{p.projectName}</a> : p.projectName}</td>
                                          <td style={td}>{accs.length === 0 ? <span style={{ color: 'var(--fg-4)' }}>—</span> : <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{accs.map((a) => (
                                            <span key={a.id} style={chip()}>
                                              {onOpen ? <a role="button" onClick={() => onOpen('platform', a.platformKey, a.platformLabel)} title={a.platformLabel} style={{ display: 'inline-flex', cursor: 'pointer' }}><SiteFavicon {...platformFaviconProps(a.platformKey)} size={12} title={a.platformLabel} /></a> : <SiteFavicon {...platformFaviconProps(a.platformKey)} size={12} />}
                                              {onOpen ? <a role="button" onClick={() => onOpen('account', a.id, a.handle)} style={{ color: 'var(--fg-1)', cursor: 'pointer', textDecoration: 'none' }}>{a.handle}</a> : a.handle}
                                            </span>
                                          ))}</span>}</td>
                                          <td style={{ ...td, textAlign: 'right' }}><span title={`${pool} account trong project`} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, border: `1px solid ${pool > 0 ? 'var(--neon-cyan)' : 'var(--bg-3)'}`, color: pool > 0 ? 'var(--neon-cyan)' : 'var(--fg-4)' }}>{pool}</span></td>
                                          <td style={{ ...td, textAlign: 'right' }}><button onClick={() => showMgr ? setMgr(null) : openMgr(g.userId, p.projectId)} disabled={busy || (pool === 0 && !showMgr)} title={pool === 0 ? 'project chưa có account' : 'giao account'} style={{ ...btn(showMgr ? 'var(--fg-3)' : 'var(--neon-cyan)'), opacity: (pool === 0 && !showMgr) ? 0.4 : 1 }}>{showMgr ? 'đóng' : 'giao'}</button></td>
                                        </tr>
                                        {showMgr && (
                                          <tr><td colSpan={4} style={{ padding: 0 }}>
                                            <div style={{ border: '1px solid var(--neon-cyan)', borderRadius: 8, padding: 10, background: 'var(--bg-0)', margin: '2px 0 6px' }}>
                                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Account của {p.projectName} → tick để giao cho {g.name} (tick acc của người khác = chuyển chủ):</div>
                                              {mgr!.accts.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 8 }}>Project này chưa có account nào.</div> : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                                                  <thead><tr><th style={{ ...th, width: 26 }} /><th style={th}>Account</th><th style={th}>Platform</th><th style={th}>Chủ hiện tại</th></tr></thead>
                                                  <tbody>
                                                    {mgr!.accts.map((a) => {
                                                      const mine = a.ownerUserId === g.userId;
                                                      const other = a.ownerUserId != null && !mine;
                                                      const checked = mgr!.checked.has(a.id);
                                                      return (
                                                        <tr key={a.id} style={{ background: checked ? 'color-mix(in srgb, var(--neon-lime) 10%, transparent)' : undefined }}>
                                                          <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={checked} onChange={(e) => setMgr((m) => m ? ({ ...m, checked: (() => { const s = new Set(m.checked); if (e.target.checked) s.add(a.id); else s.delete(a.id); return s; })() }) : m)} style={{ cursor: 'pointer' }} /></td>
                                                          <td style={td}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><SiteFavicon {...platformFaviconProps(a.platformKey)} size={13} title={a.platformKey} />{onOpen ? <a role="button" onClick={() => onOpen('account', a.id, a.handle || String(a.id))} title="mở account" style={{ color: 'var(--fg-0)', cursor: 'pointer', textDecoration: 'none' }}>{a.handle || '(no handle)'}</a> : (a.handle || '(no handle)')}</span></td>
                                                          <td style={{ ...td, color: 'var(--fg-3)' }}>{onOpen ? <a role="button" onClick={() => onOpen('platform', a.platformKey, a.platformKey)} style={{ color: 'var(--fg-3)', cursor: 'pointer', textDecoration: 'none' }}>{a.platformKey}</a> : a.platformKey}</td>
                                                          <td style={td}>{(() => {
                                                            if (!mine && !other) return <span style={{ color: 'var(--fg-4)' }}>— chưa giao —</span>;
                                                            const oid = mine ? g.userId : a.ownerUserId!;
                                                            const ow = grouped.find((x) => x.userId === oid);
                                                            const nm = mine ? g.name : (ow?.name ?? `#${oid}`);
                                                            const tip = `${ow?.email ?? ''}${other ? ` · tick để chuyển sang ${g.name}` : ''}`.trim();
                                                            const col = mine ? 'var(--neon-lime)' : 'var(--neon-amber)';
                                                            return onOpen
                                                              ? <a role="button" onClick={() => onOpen('teamUser', oid, nm)} title={tip || 'mở thành viên'} style={{ color: col, cursor: 'pointer', textDecoration: 'none' }}>{mine ? '✓ ' : ''}{nm}</a>
                                                              : <span style={{ color: col }} title={tip}>{mine ? '✓ ' : ''}{nm}</span>;
                                                          })()}</td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              )}
                                              <button onClick={saveMgr} disabled={busy} style={btn('var(--neon-lime)')}>Lưu giao việc</button>
                                              <button onClick={() => setMgr(null)} style={{ ...btn('var(--fg-3)'), marginLeft: 6 }}>huỷ</button>
                                            </div>
                                          </td></tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* BROWSER & PROXY: chip + dropdown thêm */}
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '0 0 5px' }}>Browser profile ({dd.profiles.length})</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {dd.profiles.map((p) => <span key={p.id} style={chip()}>{onOpen ? <a role="button" onClick={() => onOpen('browserProfile', p.id, p.label)} style={{ color: 'var(--fg-1)', cursor: 'pointer', textDecoration: 'none' }}>{p.label}</a> : p.label} <span style={{ color: 'var(--fg-4)' }}>{p.tool}</span><button onClick={() => assignEntity(g.userId, 'browser_profile', p.id, null)} disabled={busy} title="bỏ gán" style={xbtn}>×</button></span>)}
                                <select value="" onChange={(e) => assignEntity(g.userId, 'browser_profile', e.target.value ? Number(e.target.value) : null, g.userId)} disabled={busy} style={{ ...inp, maxWidth: 150 }}>
                                  <option value="">＋ gán browser…</option>
                                  {profiles.filter((p) => !dd.profiles.some((x) => x.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.label} ({p.tool})</option>)}
                                </select>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '0 0 5px' }}>Proxy ({dd.proxies.length})</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {dd.proxies.map((p) => <span key={p.id} style={chip()}>{onOpen ? <a role="button" onClick={() => onOpen('proxy', p.id, p.label)} style={{ color: 'var(--fg-1)', cursor: 'pointer', textDecoration: 'none' }}>{p.label}</a> : p.label} <span style={{ color: 'var(--fg-4)' }}>{p.type}</span><button onClick={() => assignEntity(g.userId, 'proxy', p.id, null)} disabled={busy} title="bỏ gán" style={xbtn}>×</button></span>)}
                                <select value="" onChange={(e) => assignEntity(g.userId, 'proxy', e.target.value ? Number(e.target.value) : null, g.userId)} disabled={busy} style={{ ...inp, maxWidth: 150 }}>
                                  <option value="">＋ gán proxy…</option>
                                  {proxies.filter((p) => !dd.proxies.some((x) => x.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.label} ({p.type})</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
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
