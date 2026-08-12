'use client';

import { useState, useMemo, useTransition, useRef, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserProfile, updateBrowserProfile, archiveBrowserProfile,
  browserProfileAccounts, touchBrowserProfile,
  browserProfileProjects, assignBrowserProfileProject, unassignBrowserProfileProject,
  type BrowserProfileRow, type ProfileTool, type ProxyRow, type ProfileAccountRow,
} from '@/lib/actions/environments';
import { AIFormParser } from './ai-form-parser';
import { OwnerSelect } from './owner-select';
import { Drawer, ProjectAssign, EntityRef, SiteFavicon, usePaged, Pager, SearchInput } from './ui';
import { platformFaviconProps } from './ui/site-favicon';
import { AccountDrawer } from './account-drawer';
import { AccountStatChips } from './account-metrics';
import type { TeamMemberRow } from '@/lib/actions/team';
import { wrapExternalUrl } from '@/lib/external-url';
// Ngưỡng + màu + badge phiên: dùng chung với environments-page, không chép lại.
import { accountSession, sessionBadge, pendingBadge, idleOf } from '@/lib/session-health';
import { DEAD_STATUSES, type AccountStatus } from '@/lib/status-meta';

// href.li wrap for external links (per global rule).
const hl = wrapExternalUrl;

// ── Anti-detect tool catalog (shared: the drawer's Tool select + the profiles list rows) ────────
interface ToolMeta { label: string; icon: string; url?: string; desc?: string; pricing?: string; free?: boolean; os?: string; origin?: string; }

export const TOOL_META: Record<ProfileTool, ToolMeta> = {
  genlogin:    { label: 'GenLogin', icon: '🧬', url: 'https://genlogin.com', desc: 'Vietnamese-built anti-detect browser, popular ở SEA. Native Vietnamese support, hỗ trợ Telegram CSKH.', pricing: 'Free 2 profiles · Paid từ ~$5/mo', os: 'Windows · macOS', origin: '🇻🇳' },
  multilogin:  { label: 'Multilogin', icon: '🌀', url: 'https://multilogin.com', desc: 'Veteran enterprise-grade anti-detect, mature fingerprint engine (Stealthfox/Mimic).', pricing: 'Từ $99/mo (Solo) · $199/mo (Team)', os: 'Windows · macOS · Linux', origin: '🇪🇪' },
  adspower:    { label: 'AdsPower', icon: '⚡', url: 'https://www.adspower.com', desc: 'Free tier hào phóng (5 profiles), API mạnh, Local API cho automation.', pricing: 'Free 5 profiles · Pro từ $9/mo', free: true, os: 'Windows · macOS · Linux', origin: '🇨🇳' },
  kameleo:     { label: 'Kameleo', icon: '🦎', url: 'https://kameleo.io', desc: 'Mobile profile spoofing tốt, mobile fingerprint chính xác hơn Multilogin.', pricing: 'Từ $59/mo · Yearly discount', os: 'Windows · macOS · iOS', origin: '🇭🇺' },
  chrome:      { label: 'Chrome (native)', icon: '🌐', url: 'https://www.google.com/chrome/', desc: 'Chrome user profiles built-in (--profile-directory). Không có anti-detect, dùng cho non-sensitive accounts.', pricing: 'Free', free: true, os: 'All' },
  firefox:     { label: 'Firefox (native)', icon: '🦊', url: 'https://www.mozilla.org/firefox/', desc: 'Firefox profiles riêng (about:profiles). Multi-account containers extension hỗ trợ thêm.', pricing: 'Free', free: true, os: 'All' },
  other:       { label: 'Other', icon: '🔧', desc: 'Custom / less common tool — điền chi tiết vào notes.' },
};

// DB `tool` is free text (raw inserts can hold values outside the union, e.g. 'playwright') → never
// index TOOL_META blind or the whole tab crashes on `.icon`. Fall back to `other` for unknown tools.
export const toolMetaOf = (tool: string): ToolMeta => (TOOL_META as Record<string, ToolMeta | undefined>)[tool] ?? TOOL_META.other;

const TOOL_SUGGESTIONS: Array<{ name: string; icon: string; url: string; desc: string; pricing: string; origin: string }> = [
  { name: 'Dolphin{anty}', icon: '🐬', url: 'https://dolphin-anty.com', desc: 'Affiliate marketing favorite, free 10 profiles, có team plan.', pricing: 'Free 10 · từ $89/mo', origin: '🇪🇸' },
  { name: 'GoLogin',       icon: '🌍', url: 'https://gologin.com',     desc: 'Cloud profiles, Linken Sphere alternative, mạnh Cookie Robot.', pricing: 'Free 3 · từ $24/mo', origin: '🇺🇸' },
  { name: 'Octo Browser',  icon: '🐙', url: 'https://octobrowser.net', desc: 'Modern UI, fast, integrate proxy gateway built-in.', pricing: 'Từ $29/mo (10 profiles)', origin: '🇨🇾' },
  { name: 'Indigo Browser',icon: '🟣', url: 'https://indigobrowser.com', desc: 'Sister product Multilogin Mimic engine, focused on speed.', pricing: 'Từ $99/mo', origin: '🇪🇪' },
  { name: 'Linken Sphere', icon: '🌐', url: 'https://ls.tenebris.cc', desc: 'OG anti-detect (since 2017), được coi là gold standard cho serious operators.', pricing: 'Từ $100/mo', origin: '🇪🇸' },
  { name: 'VMLogin',       icon: '🪟', url: 'https://www.vmlogin.us',  desc: 'Cheap entry, basic feature set, được community Trung dùng nhiều.', pricing: 'Từ $39/mo', origin: '🇨🇳' },
];

function ToolInfoCard({ meta }: { meta: ToolMeta }) {
  if (!meta.desc && !meta.url) return null;
  return (
    <div style={{ padding: '8px 10px', marginTop: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.45 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <span style={{ fontWeight: 700, color: 'var(--fg-0)' }}>{meta.label}</span>
        {meta.origin && <span style={{ fontSize: 13 }}>{meta.origin}</span>}
        {meta.url && (
          <a href={hl(meta.url)} target="_blank" rel="noopener noreferrer" title={meta.url} onClick={(e) => e.stopPropagation()}
             style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--neon-cyan)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>↗ download</a>
        )}
      </div>
      {meta.desc && <div style={{ marginBottom: 3 }}>{meta.desc}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
        {meta.pricing && <span>💰 {meta.pricing}</span>}
        {meta.os && <span>💻 {meta.os}</span>}
      </div>
    </div>
  );
}

function ToolSuggestions() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ gridColumn: '1 / 3', marginTop: 4 }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', fontSize: 10.5, fontFamily: 'var(--font-mono)', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{open ? '▾' : '▸'}</span>
        <span>{open ? 'Hide' : 'Browse'} {TOOL_SUGGESTIONS.length} other anti-detect tools</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, marginTop: 4 }}>
          {TOOL_SUGGESTIONS.map((s) => (
            <a key={s.name} href={hl(s.url)} target="_blank" rel="noopener noreferrer" title={s.url}
              style={{ padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-0)' }}>{s.name}</span>
                <span style={{ fontSize: 11 }}>{s.origin}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 9, color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>↗</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg-2)', lineHeight: 1.4, marginBottom: 2 }}>{s.desc}</div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{s.pricing}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── The ONE browser-profile drawer ──────────────────────────────────────────────────────────────
// Single source used by BOTH /environments (profiles tab) AND the accounts-vault profile picker.
// profile=null → create mode (edit form only). Edit mode ALSO shows how to open the profile (local
// Playwright command + last-opened + mark-opened) and every account logged in inside it (🔑 manager).
export function BrowserProfileDrawer({ profile, proxies, teamMembers = [], onClose }: {
  profile: BrowserProfileRow | null; proxies: ProxyRow[]; teamMembers?: TeamMemberRow[]; onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !profile;
  const [form, setForm] = useState({
    label: profile?.label ?? '',
    tool: (profile?.tool ?? 'genlogin') as ProfileTool,
    externalId: profile?.externalId ?? '',
    userAgent: profile?.userAgent ?? '',
    defaultProxyId: profile?.defaultProxyId ?? null as number | null,
    notes: profile?.notes ?? '',
    ownerUserId: (profile as { ownerUserId?: number | null } | null)?.ownerUserId ?? null as number | null,
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const baselineRef = useRef<string>('');
  if (baselineRef.current === '') baselineRef.current = JSON.stringify(form);
  const dirty = JSON.stringify(form) !== baselineRef.current;

  // Edit-mode extras: accounts logged in inside + open/last-opened.
  const [inside, setInside] = useState<ProfileAccountRow[] | null>(null);
  const [openAcct, setOpenAcct] = useState<number | null>(null);   // account opened in-place (stacked drawer)
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState<string | null>(profile?.lastOpenedAt ?? null);
  // DS account trong 1 profile có thể rất dài (persona doanhedu ~128). Lọc + phân trang bằng primitive
  // CHUẨN usePaged/Pager/SearchInput (dùng chung mọi vault list) — KHÔNG render cả mảng.
  const [acctQuery, setAcctQuery] = useState('');
  const filteredAccts = useMemo(() => {
    const list = inside ?? [];
    const q = acctQuery.trim().toLowerCase();
    return q ? list.filter((a) => [a.handle, a.email, a.platformKey].some((v) => v && v.toLowerCase().includes(q))) : list;
  }, [inside, acctQuery]);
  const acctPage = usePaged(filteredAccts, 30);
  useEffect(() => {
    if (!profile) return;
    let live = true;
    browserProfileAccounts(profile.id).then((r) => { if (live) setInside(r); }).catch(() => { if (live) setInside([]); });
    return () => { live = false; };
  }, [profile]);

  // Edit-mode extras: projects this profile is assigned to (many-to-many).
  type ProjRef = { id: string; name: string; emoji: string | null };
  const [projAssigned, setProjAssigned] = useState<ProjRef[] | null>(null);
  const [projAll, setProjAll] = useState<ProjRef[]>([]);
  const loadProjects = async (id: number) => {
    try { const r = await browserProfileProjects(id); setProjAssigned(r.assigned); setProjAll(r.all); }
    catch { setProjAssigned([]); setProjAll([]); }
  };
  useEffect(() => {
    if (!profile) return;
    let live = true;
    browserProfileProjects(profile.id).then((r) => { if (live) { setProjAssigned(r.assigned); setProjAll(r.all); } }).catch(() => { if (live) { setProjAssigned([]); setProjAll([]); } });
    return () => { live = false; };
  }, [profile]);
  const assignProj = async (pid: string) => { if (!profile || !pid) return; await assignBrowserProfileProject(profile.id, pid); await loadProjects(profile.id); };
  const unassignProj = async (pid: string) => { if (!profile) return; await unassignBrowserProfileProject(profile.id, pid); await loadProjects(profile.id); };
  const profileIdle = idleOf(opened);   // cùng ngưỡng/màu với card ở /environments
  // Proxy gắn ở PROFILE (rig route cả profile qua 1 proxy — stealth.mjs đọc default_proxy_id), nên
  // mọi account bên trong đi chung. Lấy label từ selection HIỆN TẠI (form) để badge đổi ngay khi
  // đổi dropdown, không phải reload. Không có proxy = đi IP thật của máy, cũng cần nói rõ.
  const activeProxy = form.defaultProxyId ? proxies.find((p) => p.id === form.defaultProxyId) ?? null : null;
  const isLocalPath = (form.externalId ?? '').startsWith('/'); // Playwright dir → openable via login.mjs
  const openCmd = `CAPTURE_PROFILE='${form.externalId ?? ''}' NODE_PATH=/Users/htuan/Me/Earns/courseforge-demo/node_modules node /Users/htuan/Me/Earns/courseforge-demo/login.mjs`;
  const copyOpen = async () => { try { await navigator.clipboard.writeText(openCmd); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const markOpened = async () => { if (!profile) return; const r = await touchBrowserProfile(profile.id); if (r.ok) { setOpened(r.lastOpenedAt); router.refresh(); } };

  const fld: CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none' };
  const lbl: CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };
  const btnSm: CSSProperties = { fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', whiteSpace: 'nowrap' };

  const save = () => {
    startTransition(async () => {
      const payload = { ...form, externalId: form.externalId || null, userAgent: form.userAgent || null, notes: form.notes || null, defaultProxyId: form.defaultProxyId, ownerUserId: form.ownerUserId };
      const res = isCreate ? await createBrowserProfile(payload) : await updateBrowserProfile(profile!.id, payload);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };
  const archive = () => {
    if (!profile) return;
    if (!confirm(`Archive profile "${profile.label}"? Accounts đang link sẽ unlink.`)) return;
    startTransition(async () => { await archiveBrowserProfile(profile.id); router.refresh(); onClose(); });
  };

  return (
    <>
    {/* Account drawer stacks on top → this profile drawer auto-backgrounds (Drawer reads the stack). */}
    <Drawer onClose={onClose} width={560} dirty={dirty} padding={0}>
      <div className="modal-head">
        <div>
          <div className="id-line">{profile ? `profile #${profile.id}` : 'NEW PROFILE'}</div>
          <h2>{isCreate ? '+ New browser profile' : `Edit ${profile!.label}`}</h2>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

      {!isCreate && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Open the profile — server can't launch the operator's local Chrome, so hand over the command. */}
          <div>
            <span style={lbl}>🚀 Mở profile {isLocalPath ? '(máy có Playwright)' : ''} · <span style={{ textTransform: 'none', letterSpacing: 0, color: profileIdle.color }}>{opened ? `mở gần nhất ${opened.slice(0, 10)} (${profileIdle.days}d)${profileIdle.label ? ` ⚠ ${profileIdle.label}` : ''}` : 'chưa mở'}</span>
              {activeProxy && (
                <span title={`Mọi account trong profile này đi qua proxy: ${activeProxy.label}${activeProxy.location ? ` · ${activeProxy.location}` : ''} (${activeProxy.type}). IP thật của máy được che.`}
                  style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0, fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 7, padding: '0 5px' }}>
                  🛡 {activeProxy.location || activeProxy.label}
                </span>
              )}</span>
            {isLocalPath ? (
              <>
                <div style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 9px', wordBreak: 'break-all', color: 'var(--fg-2)', marginBottom: 6 }}>{openCmd}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={copyOpen} style={{ ...btnSm, color: copied ? '#10b981' : undefined, borderColor: copied ? 'rgba(16,185,129,.4)' : undefined }}>{copied ? '✓ Đã copy' : '📋 Copy lệnh'}</button>
                  <button type="button" onClick={markOpened} title="Bump last_opened_at sau khi đã mở (giữ session không hết hạn)" style={btnSm}>✓ Vừa mở</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Mở trong app <b>{form.tool}</b> (profile-id: {form.externalId || '—'}), rồi bấm ✓ Vừa mở. <button type="button" onClick={markOpened} style={{ ...btnSm, marginLeft: 6 }}>✓ Vừa mở</button></div>
            )}
          </div>
          {/* Accounts logged in INSIDE this profile — the managing Google login (🔑) + every app account. */}
          <div>
            <span style={lbl}>🔓 Đang login trong profile này {inside ? `(${filteredAccts.length}${acctQuery ? ` / ${inside.length}` : ''})` : ''}</span>
            {inside == null ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>…</div>
              : inside.length === 0 ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>— chưa có account nào gắn profile này —</div>
              : (
                <>
                  {inside.length > 10 && (
                    <div style={{ marginTop: 6 }}>
                      <SearchInput value={acctQuery} onChange={setAcctQuery} placeholder="Tìm handle / email / platform…" width={220} />
                    </div>
                  )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {acctPage.pageItems.map((a) => {
                    // Mất phiên (dead) hoặc account bị khoá (banned/suspended…) = KHÔNG active → mờ cả dòng.
                    const inactive = a.sessionState === 'dead' || DEAD_STATUSES.includes(a.status as AccountStatus);
                    // Account đi RIÊNG qua proxy (per-domain PAC, proxy_id) = viền đỏ để nhận ra ngay
                    // cái nào không đi IP thật. Thắng cả viền manager (accent) vì đây là cảnh báo định tuyến.
                    const proxied = a.proxyId != null;
                    const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '5px 8px', borderRadius: 6, background: a.isManager ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-2)', border: `1px solid ${proxied ? 'var(--bad)' : a.isManager ? 'var(--accent)' : 'var(--line)'}`, opacity: inactive ? 0.5 : 1 };
                    // Account = shared <EntityRef> (opens the standard account drawer IN-PLACE, stacked
                    // over this profile drawer — no page jump). Manager 🔑 + status stay as row decoration.
                    return (
                      <div key={a.id} style={rowStyle}>
                        {/* Favicon của CHÍNH site — icon chung 👤 lặp lại ở mọi dòng thì mắt không
                            phân biệt được dòng nào là site nào, phải đọc chữ mới biết. */}
                        <SiteFavicon {...platformFaviconProps(a.platformKey)} size={16} circle
                          glyph={a.isManager ? '🔑' : '👤'} title={a.isManager ? 'Gmail quản lý (base login)' : a.platformKey} />
                        {proxied
                          ? <span title={`Account này đi RIÊNG qua proxy ${a.proxyLabel ?? '#' + a.proxyId} (per-domain PAC — chỉ site này qua proxy, phần còn lại của profile đi DIRECT)`} style={{ flexShrink: 0, fontSize: 11, lineHeight: 1, color: 'var(--bad)' }}>🛡</span>
                          : activeProxy && <span title={`Cả profile đi qua proxy ${activeProxy.label}${activeProxy.location ? ` · ${activeProxy.location}` : ''} — IP thật được che`} style={{ flexShrink: 0, fontSize: 11, lineHeight: 1 }}>🛡</span>}
                        <EntityRef kind="account" id={a.id} label={a.handle || a.email || '(no handle)'} noIcon
                          onOpen={a.projectId ? () => setOpenAcct(a.id) : undefined} />
                        <span style={{ color: 'var(--fg-4)', flexShrink: 0 }}>· {a.platformKey}</span>
                        {a.isManager && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 7, padding: '0 5px', flexShrink: 0 }}>QUẢN LÝ</span>}
                        {(() => {
                          // Badge trạng thái PHIÊN, tách khỏi status vòng đời của account
                          // (active/warming/banned…): phiên rụng không có nghĩa account bị khoá.
                          // Chờ duyệt thắng badge phiên: account chưa được kích hoạt thì "rụng phiên"
                          // là kết luận sai, và người đọc cần thấy việc THẬT (chờ/đòi admin).
                          const b = pendingBadge(a) ?? sessionBadge(a.sessionState);
                          return b && (
                            <span title={b.title} style={{ fontSize: 9.5, fontWeight: 700, color: b.color,
                              border: `1px ${'dashed' in b && b.dashed ? 'dashed' : 'solid'} ${b.color}`, borderRadius: 7, padding: '0 5px', flexShrink: 0 }}>
                              {b.text}
                            </span>
                          );
                        })()}
                        {(() => {
                          const h = accountSession(a);
                          return <span title={h.tip} style={{ fontSize: 10, color: h.color, flexShrink: 0, fontWeight: h.bold ? 700 : 400 }}>{h.text}</span>;
                        })()}
                        <span style={{ fontSize: 10, color: 'var(--fg-4)', flexShrink: 0 }}>{a.status}</span>
                        {/* Chỉ số ext đã quét (karma/followers…) — ghim mép phải để hàng không xô lệch. */}
                        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
                          <AccountStatChips stats={a.accountStats} max={2} />
                        </span>
                      </div>
                    );
                  })}
                  {acctPage.pageItems.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>— không khớp tìm kiếm —</div>}
                </div>
                <Pager page={acctPage.page} pageCount={acctPage.pageCount} total={acctPage.total} pageSize={acctPage.pageSize} onPage={acctPage.setPage} />
                </>
              )}
          </div>
          {/* Projects this profile serves — many-to-many. Shared <ProjectAssign> (same as the account
              drawer, flat mode = no ★ primary). No hand-rolled <select> + chips. */}
          <div>
            <span style={lbl}>📁 Projects (gán nhiều được)</span>
            <ProjectAssign assigned={projAssigned} all={projAll} onJoin={assignProj} onLeave={unassignProj} collapsible={false} label="Projects (gán nhiều được)" />
          </div>
        </div>
      )}

      <AIFormParser
        currentValues={form}
        context="Browser profile form for anti-detect tools (GenLogin, Multilogin, AdsPower, Kameleo, Chrome, Firefox)."
        schema={[
          { key: 'label', label: 'Label', description: 'Short identifier like "GL-orit-medium-01"' },
          { key: 'tool', label: 'Tool', type: 'enum', enumValues: ['genlogin', 'multilogin', 'adspower', 'kameleo', 'chrome', 'firefox', 'other'] },
          { key: 'externalId', label: 'External profile ID/UUID' },
          { key: 'userAgent', label: 'User agent string' },
          { key: 'notes', label: 'Notes' },
        ]}
        onApply={(v) => {
          setForm((f) => ({
            ...f,
            label: typeof v.label === 'string' ? v.label : f.label,
            tool: (v.tool as ProfileTool) || f.tool,
            externalId: typeof v.externalId === 'string' ? v.externalId : f.externalId,
            userAgent: typeof v.userAgent === 'string' ? v.userAgent : f.userAgent,
            notes: typeof v.notes === 'string' ? v.notes : f.notes,
          }));
        }}
      />

      <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ gridColumn: '1 / 3' }}>
          <span style={lbl}>Label *</span>
          <input style={fld} placeholder="vd: GL-orit-medium-01" value={form.label} onChange={(e) => setF('label', e.target.value)} />
        </div>
        <div>
          <span style={lbl}>Tool *</span>
          <select style={fld} value={form.tool} onChange={(e) => setF('tool', e.target.value as ProfileTool)}>
            {(Object.entries(TOOL_META) as Array<[ProfileTool, ToolMeta]>).map(([k, m]) => (
              <option key={k} value={k}>{m.icon} {m.label}{m.free ? ' · free tier' : ''}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / 3' }}>
          <ToolInfoCard meta={toolMetaOf(form.tool)} />
        </div>
        <ToolSuggestions />
        <div>
          <span style={lbl}>External ID</span>
          <input style={fld} placeholder="UUID/ID trong tool hoặc /path/.capture-profile" value={form.externalId} onChange={(e) => setF('externalId', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / 3' }}>
          <span style={lbl}>Default proxy</span>
          <select style={fld} value={form.defaultProxyId ?? ''} onChange={(e) => setF('defaultProxyId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— none —</option>
            {proxies.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.type}{p.location ? ` · ${p.location}` : ''}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / 3' }}>
          <span style={lbl}>User agent (optional)</span>
          <input style={fld} placeholder="Mozilla/5.0..." value={form.userAgent} onChange={(e) => setF('userAgent', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / 3' }}>
          <span style={lbl}>Notes (session / login / recipe mở)</span>
          <textarea style={{ ...fld, minHeight: 60, fontFamily: 'var(--font-mono)' }} value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
        </div>
        {teamMembers.length > 0 && (
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>👤 Assigned to manage</span>
            <OwnerSelect members={teamMembers} value={form.ownerUserId} onChange={(uid) => setF('ownerUserId', uid)} fld={fld} />
          </div>
        )}
      </div>

      <div className="modal-foot">
        <div className="meta">{isCreate ? 'New' : `${profile!.accountsCount} accounts linked`}</div>
        <div className="modal-foot-actions">
          {!isCreate && <button className="btn danger" onClick={archive}>🗑 Archive</button>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>{isCreate ? 'Create' : 'Save'}</button>
        </div>
      </div>

    </Drawer>
    {/* AccountDrawer pushed as a top layer, sibling of the profile drawer. (Drawer portals to <body>
        since 2026-08-12, so it escapes this panel's pointer-events:none / transform regardless of
        nesting — sibling is just the clean structure.) Opened from the "đang login" list. */}
    {openAcct != null && <AccountDrawer accountId={openAcct} onClose={() => { setOpenAcct(null); if (profile) browserProfileAccounts(profile.id).then(setInside).catch(() => {}); }} />}
    </>
  );
}
