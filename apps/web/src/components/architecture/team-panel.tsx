'use client';
import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { listTeamMembers, createTeamMember, type TeamMemberRow } from '@/lib/actions/team';
import { getMemberAssignments, assignAccountsToMember, setProjectMembership, listProjectAccountsForAssignment, listAllProjectsForAssignment, setEntityOwner, type MemberAssignmentSummary } from '@/lib/actions/assignments';
import { listBrowserProfiles, listProxies, type BrowserProfileRow, type ProxyRow } from '@/lib/actions/environments';
import type { OpenFn } from '@/components/content-value-page';
import { SiteFavicon, platformFaviconProps } from '@/components/ui/site-favicon';

// platform: favicon + click mở node Platform (label hiển thị; key để favicon + drawer)
function PlatformTag({ pkey, label, onOpen }: { pkey: string; label?: string; onOpen?: OpenFn }) {
  if (!pkey) return null;
  const inner = <><SiteFavicon {...platformFaviconProps(pkey)} size={12} title={pkey} /> {label || pkey}</>;
  return onOpen
    ? <a role="button" onClick={() => onOpen('platform', pkey, label || pkey)} title="mở platform" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--fg-4)', cursor: 'pointer', textDecoration: 'none' }}>{inner}</a>
    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--fg-4)' }}>{inner}</span>;
}

// Node Team — quản lý nhân sự + ASSIGN project/account/browser/proxy (mô hình staff seeding).
// Drive từ getMemberAssignments (membership THẬT). Trình bày CHIP + dropdown-thêm, KHÔNG list phẳng.
const ROLES = ['admin', 'operator', 'viewer'] as const;
type Grouped = { userId: number; name: string; email: string; role: string; specialty: string; active: boolean };

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

  const reloadLists = () => { listBrowserProfiles().then(setProfiles); listProxies().then(setProxies); };
  useEffect(() => {
    listTeamMembers().then(setRows);
    listAllProjectsForAssignment().then((p) => setProjects((p as { id: string; name: string }[]).map((x) => ({ id: x.id, name: x.name }))));
    reloadLists();
  }, []);

  const grouped: Grouped[] = (() => {
    if (!rows) return [];
    const m = new Map<number, Grouped>();
    for (const r of rows) { if (!m.has(r.userId)) m.set(r.userId, { userId: r.userId, name: r.name, email: r.email, role: r.role, specialty: r.specialty, active: r.active }); }
    return [...m.values()];
  })();

  const loadDetail = (uid: number) => { setDetail((d) => ({ ...d, [uid]: 'loading' })); getMemberAssignments(uid).then((s) => setDetail((d) => ({ ...d, [uid]: s }))); };
  const toggle = (uid: number) => { if (open === uid) { setOpen(null); return; } setOpen(uid); setMgr(null); if (!detail[uid]) loadDetail(uid); };

  const addMember = async () => { if (!nu.email.trim() || !nu.name.trim()) return; setBusy(true); await createTeamMember({ email: nu.email.trim(), name: nu.name.trim(), role: nu.role as 'operator' }); setNu({ email: '', name: '', role: 'operator' }); listTeamMembers().then(setRows); setBusy(false); };
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
        <thead><tr><th style={{ ...th, width: 22 }} /><th style={th}>Tên</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Chuyên</th></tr></thead>
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
                </tr>
                {isOpen && (
                  <tr><td colSpan={5} style={{ padding: 0, borderBottom: '1px solid var(--bg-3)' }}>
                    <div style={{ padding: '12px 14px 14px 34px', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!dd ? <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải phân công…</span> : (
                        <>
                          <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Việc: <b style={{ color: 'var(--neon-amber)' }}>{dd.pendingTasks}</b> pending · <b style={{ color: 'var(--neon-cyan)' }}>{dd.inProgressTasks}</b> đang làm</div>

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

                          {/* ACCOUNT: theo từng project phụ trách; picker hiện NGAY DƯỚI dòng bấm */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '0 0 5px' }}>Account được giao ({dd.accounts.length})</div>
                            {dd.projects.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Thêm project trước để giao account.</div> : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {dd.projects.map((p) => {
                                  const accs = dd.accounts.filter((a) => a.projectId === p.projectId);
                                  const showMgr = !!mgr && mgr.userId === g.userId && mgr.projectId === p.projectId;
                                  // CHỈ account của project này + chưa thuộc ai HOẶC đã của chính người này (ẩn acc người khác)
                                  const assignable = mgr ? mgr.accts.filter((a) => a.ownerUserId == null || a.ownerUserId === g.userId) : [];
                                  const otherCnt = mgr ? mgr.accts.length - assignable.length : 0;
                                  return (
                                    <Fragment key={p.projectId}>
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
                                        <span style={{ minWidth: 120 }}>{onOpen ? <a role="button" onClick={() => onOpen('project', p.projectId, p.projectName)} style={{ color: 'var(--fg-2)', cursor: 'pointer', textDecoration: 'none' }}>{p.projectName}</a> : <span style={{ color: 'var(--fg-3)' }}>{p.projectName}</span>}<span style={{ color: 'var(--fg-3)' }}>:</span></span>
                                        {accs.length === 0 && <span style={{ color: 'var(--fg-4)' }}>chưa account</span>}
                                        {accs.map((a) => <span key={a.id} style={chip()}>{onOpen ? <a role="button" onClick={() => onOpen('account', a.id, a.handle)} style={{ color: 'var(--fg-1)', cursor: 'pointer', textDecoration: 'none' }}>{a.handle}</a> : a.handle}<PlatformTag pkey={a.platformKey} label={a.platformLabel} onOpen={onOpen} /></span>)}
                                        <button onClick={() => showMgr ? setMgr(null) : openMgr(g.userId, p.projectId)} disabled={busy} style={btn(showMgr ? 'var(--fg-3)' : 'var(--neon-cyan)')}>{showMgr ? 'đóng' : 'giao'}</button>
                                      </div>
                                      {showMgr && (
                                        <div style={{ border: '1px solid var(--neon-cyan)', borderRadius: 8, padding: 10, background: 'var(--bg-0)', margin: '2px 0 4px' }}>
                                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Account của {p.projectName} (chưa giao ai / của {g.name}) → tick để giao:</div>
                                          {assignable.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 8 }}>Không có account trống trong project này.</div> : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 4, marginBottom: 8 }}>
                                              {assignable.map((a) => (
                                                <span key={a.id} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
                                                  <input type="checkbox" id={`acc-${g.userId}-${a.id}`} checked={mgr!.checked.has(a.id)} onChange={(e) => setMgr((m) => m ? ({ ...m, checked: (() => { const s = new Set(m.checked); if (e.target.checked) s.add(a.id); else s.delete(a.id); return s; })() }) : m)} style={{ cursor: 'pointer' }} />
                                                  {onOpen ? <a role="button" onClick={() => onOpen('account', a.id, a.handle || String(a.id))} title="mở account" style={{ color: 'var(--fg-1)', cursor: 'pointer', textDecoration: 'none' }}>{a.handle || '(no handle)'}</a> : <label htmlFor={`acc-${g.userId}-${a.id}`} style={{ cursor: 'pointer' }}>{a.handle || '(no handle)'}</label>}
                                                  <PlatformTag pkey={a.platformKey} onOpen={onOpen} />
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          {otherCnt > 0 && <div style={{ fontSize: 10, color: 'var(--fg-4)', marginBottom: 6 }}>· {otherCnt} account đang thuộc người khác (ẩn)</div>}
                                          <button onClick={saveMgr} disabled={busy} style={btn('var(--neon-lime)')}>Lưu giao việc</button>
                                          <button onClick={() => setMgr(null)} style={{ ...btn('var(--fg-3)'), marginLeft: 6 }}>huỷ</button>
                                        </div>
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </div>
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
