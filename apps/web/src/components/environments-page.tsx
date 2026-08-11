'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useModalParam } from '@/lib/use-modal-param';
import { useUrlParam, useUrlState } from '@/lib/use-url-param';
import {
  type ProxyRow, type ProxyType, type ProxyHealth,
  type BrowserProfileRow, type ProfileTool, type GlobalAccountRow,
  createProxy, updateProxy, archiveProxy,
  testProxyEndpoint, testAndSaveProxy, type ProxyTestResult,
} from '@/lib/actions/environments';
import { accountStatusMeta } from '@/lib/status-meta';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { StatusBadge } from './ui/status-badge';
// Filter bar = primitive nhà MultiSelect (search + count + multi), KHÔNG phải <select> thường.
import { MultiSelect } from './ui/multi-select';
// Ngưỡng + màu + cách đọc sessionState: MỘT nguồn, dùng chung với browser-profile-drawer.
import { STALE_D, TONE, idleOf, bucketOf } from '@/lib/session-health';
import { DEAD_STATUSES, type AccountStatus } from '@/lib/status-meta';
import { AIFormParser } from './ai-form-parser';
import { OwnerSelect } from './owner-select';
import { BrowserProfileDrawer, toolMetaOf } from './browser-profile-drawer';
import { Drawer, EntityRef, SiteFavicon } from './ui';
import { platformFaviconProps } from './ui/site-favicon';
import type { TeamMemberRow } from '@/lib/actions/team';

type Tab = 'proxies' | 'profiles' | 'accounts';

const HEALTH_META: Record<ProxyHealth, { label: string; color: string }> = {
  ok:        { label: 'ok',        color: 'var(--ok)' },
  degraded:  { label: 'degraded',  color: 'var(--warn)' },
  down:      { label: 'down',      color: 'var(--bad)' },
  unknown:   { label: 'unknown',   color: 'var(--fg-3)' },
};

const PROXY_TYPE_META: Record<ProxyType, { label: string; color: string }> = {
  mobile:      { label: 'mobile',      color: 'var(--neon-lime)' },
  residential: { label: 'residential', color: 'var(--neon-cyan)' },
  datacenter:  { label: 'datacenter',  color: 'var(--fg-2)' },
  isp:         { label: 'isp',         color: 'var(--neon-amber)' },
};

export function EnvironmentsPage({ proxies, profiles, accounts = [], teamMembers = [] }: { proxies: ProxyRow[]; profiles: BrowserProfileRow[]; accounts?: GlobalAccountRow[]; teamMembers?: TeamMemberRow[] }) {
  const [tabRaw, setTabRaw] = useUrlParam('tab', 'proxies');
  const tab: Tab = tabRaw === 'profiles' ? 'profiles' : tabRaw === 'accounts' ? 'accounts' : 'proxies';
  // Badge trên tab: tab mặc định là Proxies, không cảnh báo ở đây thì session hết hạn không ai thấy.
  const staleCount = profiles.filter((p) => idleOf(p.lastOpenedAt).tone !== 'fresh' && idleOf(p.lastOpenedAt).tone !== 'warn').length;

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🛰 Environments
            <small>// {proxies.length} proxies · {profiles.length} browser profiles · {accounts.length} accounts</small>
          </h1>
          <p className="page-sub">
            Tenant-level pool. Share cross-project. Account vault link tới proxy/profile để mỗi tài khoản có anti-detect setup riêng.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <button className="btn"
          onClick={() => setTabRaw('proxies')}
          style={{ background: tab === 'proxies' ? 'var(--accent-soft)' : 'transparent', borderRadius: '5px 5px 0 0', borderBottom: tab === 'proxies' ? '2px solid var(--accent)' : 'none' }}>
          🔌 Proxies <span style={{ opacity: 0.6 }}>({proxies.length})</span>
        </button>
        <button className="btn"
          onClick={() => setTabRaw('profiles')}
          style={{ background: tab === 'profiles' ? 'var(--accent-soft)' : 'transparent', borderRadius: '5px 5px 0 0', borderBottom: tab === 'profiles' ? '2px solid var(--accent)' : 'none' }}>
          🧬 Browser Profiles <span style={{ opacity: 0.6 }}>({profiles.length})</span>
          {staleCount > 0 && <span title={`${staleCount} profile chưa mở ≥${STALE_D} ngày`} style={{ marginLeft: 5, color: TONE.bad, fontWeight: 700 }}>⚠️{staleCount}</span>}
        </button>
        <button className="btn"
          onClick={() => setTabRaw('accounts')}
          style={{ background: tab === 'accounts' ? 'var(--accent-soft)' : 'transparent', borderRadius: '5px 5px 0 0', borderBottom: tab === 'accounts' ? '2px solid var(--accent)' : 'none' }}>
          🔐 Accounts <span style={{ opacity: 0.6 }}>({accounts.length})</span>
        </button>
      </div>

      {tab === 'proxies' ? <ProxiesTab proxies={proxies} teamMembers={teamMembers} />
        : tab === 'profiles' ? <ProfilesTab profiles={profiles} proxies={proxies} teamMembers={teamMembers} />
        : <AccountsTab accounts={accounts} />}
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isStale(iso: string | null, hours = 6): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > hours * 3600_000;
}

// ── Proxies tab ───────────────────────────────────────────────────
function ProxiesTab({ proxies, teamMembers = [] }: { proxies: ProxyRow[]; teamMembers?: TeamMemberRow[] }) {
  const router = useRouter();
  const modal = useModalParam("proxy");
  const editing = modal.is("edit") ? proxies.find((x) => x.id === modal.numId) ?? null : null;
  const creating = modal.is("new");
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, ProxyTestResult>>({});

  const runQuickTest = async (e: React.MouseEvent, p: ProxyRow) => {
    e.stopPropagation();
    setTestingId(p.id);
    try {
      const res = await testAndSaveProxy(p.id);
      setTestResults((m) => ({ ...m, [p.id]: res }));
      router.refresh();
    } finally {
      setTestingId(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn primary" onClick={() => modal.open("new")}>+ New proxy</button>
      </div>

      {proxies.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🔌</div>
          <p style={{ margin: '0 0 12px', fontSize: 12 }}>Chưa có proxy. Add 1 để dùng cho mobile/residential rotation.</p>
          <button className="btn primary" onClick={() => modal.open("new")}>+ Add first proxy</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {proxies.map((p) => {
            // Lookup CÓ fallback (như toolMetaOf) — dict thiếu 1 giá trị không được
            // phép giết cả trang; reader đã chuẩn hoá, đây là lưới thứ hai.
            const tm = PROXY_TYPE_META[p.type] ?? PROXY_TYPE_META.datacenter;
            const hm = HEALTH_META[p.health] ?? HEALTH_META.unknown;
            const lastChecked = relativeTime(p.lastCheckAt);
            const stale = isStale(p.lastCheckAt);
            const recent = testResults[p.id];
            const isTesting = testingId === p.id;
            return (
              <div key={p.id} className="panel" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => modal.open("edit", p.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.label}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: tm.color, padding: '1px 5px', border: `1px solid ${tm.color}`, borderRadius: 3 }}>{tm.label}</span>
                  <span title={`Health: ${hm.label}${p.lastCheckAt ? ` · checked ${lastChecked}` : ' · never tested'}`} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: hm.color }}>● {hm.label}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {p.endpoint.replace(/[^@]+@/, '***@')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', alignItems: 'center' }}>
                  {p.location && <span>📍 {p.location}</span>}
                  <span>· {p.accountsCount} acc</span>
                  {p.costPerGbCents > 0 && <span>· ${(p.costPerGbCents / 100).toFixed(2)}/GB</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ color: stale ? 'var(--warn)' : 'var(--fg-3)' }} title={p.lastCheckAt ?? 'never tested'}>
                    🕐 {lastChecked}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => runQuickTest(e, p)}
                    disabled={isTesting}
                    title="Re-test proxy now"
                    style={{
                      padding: '2px 6px', fontSize: 9, fontWeight: 600,
                      background: isTesting ? 'var(--bg-3)' : 'transparent',
                      border: `1px solid ${stale ? 'var(--warn)' : 'var(--neon-cyan)'}`,
                      color: isTesting ? 'var(--fg-3)' : (stale ? 'var(--warn)' : 'var(--neon-cyan)'),
                      borderRadius: 3, cursor: isTesting ? 'wait' : 'pointer',
                    }}
                  >
                    {isTesting ? '◌' : '⚡'} Test
                  </button>
                </div>
                {recent && (
                  <div style={{
                    marginTop: 5, padding: '3px 6px', borderRadius: 3, fontSize: 9.5,
                    fontFamily: 'var(--font-mono)',
                    background: recent.ok ? 'rgba(16,185,129,0.08)' : 'rgba(255,77,94,0.08)',
                    color: recent.ok ? 'var(--ok)' : 'var(--bad)',
                  }}>
                    {recent.ok
                      ? `✓ ${recent.ip}${recent.country ? ` · ${recent.country}` : ''} · ${recent.latencyMs}ms`
                      : `✗ ${recent.error}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <ProxyFormModal proxy={editing} teamMembers={teamMembers} onClose={() => modal.close()} />
      )}
    </>
  );
}

export function ProxyFormModal({ proxy, onClose, teamMembers = [] }: { proxy: ProxyRow | null; onClose: () => void; teamMembers?: TeamMemberRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !proxy;
  const [form, setForm] = useState({
    label: proxy?.label ?? '',
    type: (proxy?.type ?? 'datacenter') as ProxyType,
    endpoint: proxy?.endpoint ?? '',
    location: proxy?.location ?? '',
    health: (proxy?.health ?? 'unknown') as ProxyHealth,
    costPerGbCents: proxy?.costPerGbCents ?? 0,
    notes: proxy?.notes ?? '',
    ownerUserId: (proxy as { ownerUserId?: number | null } | null)?.ownerUserId ?? null as number | null,
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const baselineRef = useRef<string>('');
  if (baselineRef.current === '') baselineRef.current = JSON.stringify(form);
  const dirty = JSON.stringify(form) !== baselineRef.current;

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setError(null);
    setTestResult(null);
    if (!form.endpoint.trim()) {
      setError('Endpoint required to test');
      return;
    }
    setTesting(true);
    try {
      const result = proxy
        ? await testAndSaveProxy(proxy.id)   // saved proxy → also updates health
        : await testProxyEndpoint(form.endpoint);
      setTestResult(result);
      if (result.ok) {
        // Auto-set health to ok in form
        setForm((f) => ({ ...f, health: 'ok' as ProxyHealth }));
      }
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    startTransition(async () => {
      const payload = { ...form, location: form.location || null, notes: form.notes || null, ownerUserId: form.ownerUserId };
      const res = isCreate ? await createProxy(payload) : await updateProxy(proxy!.id, payload);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };
  const archive = () => {
    if (!proxy) return;
    if (!confirm(`Archive proxy "${proxy.label}"? Accounts đang dùng sẽ unlink.`)) return;
    startTransition(async () => { await archiveProxy(proxy.id); router.refresh(); onClose(); });
  };

  return (
    <Drawer onClose={onClose} width={560} dirty={dirty} padding={0}>
        <div className="modal-head">
          <div>
            <div className="id-line">{proxy ? `proxy #${proxy.id}` : 'NEW PROXY'}</div>
            <h2>{isCreate ? '+ New proxy' : `Edit ${proxy!.label}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          currentValues={form}
          context="Proxy form. Endpoint format: user:pass@host:port or socks5://user:pass@host:port. Type is mobile/residential/datacenter/isp."
          schema={[
            { key: 'label', label: 'Label', description: 'Short identifier like "SG-mobile-3" or "US-resi-1"' },
            { key: 'type', label: 'Proxy type', type: 'enum', enumValues: ['mobile', 'residential', 'datacenter', 'isp'] },
            { key: 'endpoint', label: 'Endpoint', description: 'Full proxy URL: user:pass@host:port or socks5://...' },
            { key: 'location', label: 'Location', description: 'Country/region like "SG-Singapore" or "US-NY"' },
            { key: 'costPerGbCents', label: 'Cost per GB in cents', type: 'number' },
            { key: 'notes', label: 'Notes' },
          ]}
          onApply={(v) => {
            setForm((f) => ({
              ...f,
              label: typeof v.label === 'string' ? v.label : f.label,
              type: (v.type as ProxyType) || f.type,
              endpoint: typeof v.endpoint === 'string' ? v.endpoint : f.endpoint,
              location: typeof v.location === 'string' ? v.location : f.location,
              costPerGbCents: typeof v.costPerGbCents === 'number' ? v.costPerGbCents : f.costPerGbCents,
              notes: typeof v.notes === 'string' ? v.notes : f.notes,
            }));
          }}
        />

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Label *</span>
            <input style={fld} placeholder="vd: SG-mobile-3, US-resi-1"
                   value={form.label} onChange={(e) => setF('label', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Type</span>
            <select style={fld} value={form.type} onChange={(e) => setF('type', e.target.value as ProxyType)}>
              <option value="datacenter">datacenter</option>
              <option value="residential">residential</option>
              <option value="mobile">mobile</option>
              <option value="isp">isp</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Health</span>
            <select style={fld} value={form.health} onChange={(e) => setF('health', e.target.value as ProxyHealth)}>
              <option value="unknown">unknown</option>
              <option value="ok">ok</option>
              <option value="degraded">degraded</option>
              <option value="down">down</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Endpoint *</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...fld, flex: 1 }} placeholder="user:pass@host:port hoặc socks5://..."
                     value={form.endpoint} onChange={(e) => setF('endpoint', e.target.value)} />
              <button
                type="button"
                onClick={runTest}
                disabled={testing || !form.endpoint.trim()}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  background: testing ? 'var(--bg-3)' : 'var(--neon-cyan)',
                  border: 'none', borderRadius: 5,
                  color: testing ? 'var(--fg-3)' : 'var(--bg-0)',
                  cursor: testing ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {testing ? '◌ testing…' : '⚡ Test'}
              </button>
            </div>
            {testResult && (
              <div style={{
                marginTop: 6, padding: '6px 8px', borderRadius: 4, fontSize: 10.5,
                fontFamily: 'var(--font-mono)',
                background: testResult.ok ? 'rgba(16,185,129,0.08)' : 'rgba(255,77,94,0.08)',
                border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.4)' : 'rgba(255,77,94,0.4)'}`,
                color: testResult.ok ? 'var(--ok)' : 'var(--bad)',
              }}>
                {testResult.ok ? (
                  <>
                    ✓ <b>{testResult.ip}</b>
                    {testResult.country && ` · ${testResult.country}`}
                    {testResult.city && ` ${testResult.city}`}
                    {testResult.asn && <span style={{ color: 'var(--fg-3)' }}> · {testResult.asn}</span>}
                    <span style={{ float: 'right', color: 'var(--fg-3)' }}>
                      {testResult.latencyMs}ms · {testResult.proxyType}
                    </span>
                  </>
                ) : (
                  <>✗ {testResult.error}{testResult.latencyMs ? ` (${testResult.latencyMs}ms)` : ''}</>
                )}
              </div>
            )}
          </div>
          <div>
            <span style={lbl}>Location</span>
            <input style={fld} placeholder="SG-Singapore, US-NY..."
                   value={form.location} onChange={(e) => setF('location', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Cost / GB (cents)</span>
            <input style={fld} type="number" value={form.costPerGbCents} onChange={(e) => setF('costPerGbCents', Number(e.target.value) | 0)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Notes</span>
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
          <div className="meta">{isCreate ? 'New' : `${proxy!.accountsCount} accounts linked`}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={archive}>🗑 Archive</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
    </Drawer>
  );
}

// ── Profiles tab ──────────────────────────────────────────────────
// Session-maintenance: profile để lâu không mở = login hết hạn âm thầm, chỉ phát hiện lúc cần dùng
// (đúng lúc không kịp sửa). Nên idle phải hiện NGAY trên card + xếp cũ-nhất-lên-đầu.
// ponytail: tính client-side từ lastOpenedAt đã có sẵn trong payload — không cron, không cột mới.
function ProfilesTab({ profiles, proxies, teamMembers = [] }: { profiles: BrowserProfileRow[]; proxies: ProxyRow[]; teamMembers?: TeamMemberRow[] }) {
  const modal = useModalParam("profile");
  const editing = modal.is("edit") ? profiles.find((x) => x.id === modal.numId) ?? null : null;
  const creating = modal.is("new");
  // Bộ lọc ở url-state: gửi link "cho tôi xem mấy account saashub đang rụng phiên" được, và F5 không mất.
  // Multi-select (không phải 1-of-N) vì lọc thật hay là "saashub + f6s", "rụng phiên + chưa đo".
  const [q, setQ] = useUrlParam('acct', '');
  const [platRaw, setPlatRaw] = useUrlParam('plat', '');
  const [sessRaw, setSessRaw] = useUrlParam('sess', '');
  const csv = (s: string) => s.split(',').filter(Boolean);
  const plats = csv(platRaw); const sessions = csv(sessRaw);
  const allAccounts = profiles.flatMap((p) => p.accounts);
  const platOptions = [...new Set(allAccounts.map((a) => a.platformKey))].sort()
    .map((k) => ({ value: k, label: k, count: allAccounts.filter((a) => a.platformKey === k).length }));
  const sessOf = (a: BrowserProfileRow['accounts'][number]) => bucketOf(a.sessionState);
  const sessOptions = [
    { value: 'alive', label: '✓ còn login', count: allAccounts.filter((a) => sessOf(a) === 'alive').length },
    { value: 'dead', label: '⚠ rụng phiên', count: allAccounts.filter((a) => sessOf(a) === 'dead').length },
    { value: 'unknown', label: '? chưa đo / chưa rõ', count: allAccounts.filter((a) => sessOf(a) === 'unknown').length },
  ];
  const acctOptions = [...new Set(allAccounts.map((a) => a.handle).filter(Boolean))].sort()
    .map((h) => ({ value: h, label: h }));
  const accts = csv(q);
  const matches = (a: BrowserProfileRow['accounts'][number]) => {
    if (accts.length && !accts.includes(a.handle)) return false;
    if (plats.length && !plats.includes(a.platformKey)) return false;
    if (sessions.length && !sessions.includes(sessOf(a))) return false;
    return true;
  };
  const filtering = accts.length + plats.length + sessions.length > 0;
  const { patch: patchUrl } = useUrlState();
  const clearAll = () => patchUrl({ acct: '', plat: '', sess: '' });   // MỘT lần ghi URL, xoá cả 3
  // Lọc theo ACCOUNT nhưng vẫn hiện theo PROFILE — profile là thứ mình mở để xử, account chỉ là lý do.
  const shown = filtering ? profiles.filter((p) => p.accounts.some(matches)) : profiles;
  // Cũ nhất lên đầu — cái cần chăm là cái phải nhìn thấy trước.
  const ordered = [...shown].sort((a, b) =>
    (a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0) - (b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0));
  // Tên account cụ thể — banner nói "1 account" mà không nói CÁI NÀO thì vẫn phải mở từng drawer ra dò.
  const nameOf = (p: BrowserProfileRow, a: BrowserProfileRow['accounts'][number]) => `${a.platformKey}/${a.handle || a.id}`;
  const deadList = ordered.flatMap((p) => p.accounts.filter((a) => a.sessionState === 'dead' && a.status !== 'pending').map((a) => nameOf(p, a)));
  const unknownList = ordered.flatMap((p) => p.accounts.filter((a) => a.sessionState !== 'alive' && a.sessionState !== 'dead'
    && a.status !== 'pending' && !DEAD_STATUSES.includes(a.status as AccountStatus)).map((a) => nameOf(p, a)));
  const needCare = ordered.filter((p) => idleOf(p.lastOpenedAt).tone === 'stale' || idleOf(p.lastOpenedAt).tone === 'never');

  return (
    <>
      {/* Bộ lọc account / platform / trạng thái phiên — url-state (share link + F5 giữ nguyên). State +
          logic vẫn còn nguyên; JSX từng bị gỡ LẪN trong commit dọn banner (6f9b949) nên "tự nhiên mất".
          Khôi phục lại — block này cũng chứa nút + New profile của tab. */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <MultiSelect<string> label="Account" options={acctOptions} selected={accts}
          onChange={(v) => setQ(v.join(','))} searchPlaceholder="Tìm handle…" />
        <MultiSelect<string> label="Platform" options={platOptions} selected={plats}
          onChange={(v) => setPlatRaw(v.join(','))} />
        <MultiSelect<string> label="Trạng thái phiên" options={sessOptions} selected={sessions}
          onChange={(v) => setSessRaw(v.join(','))} />
        {filtering && (
          <button type="button" className="btn" style={{ fontSize: 11 }} onClick={clearAll}>✕ bỏ lọc</button>
        )}
        {filtering && <small style={{ color: 'var(--fg-3)' }}>{ordered.length}/{profiles.length} profile</small>}
        <span style={{ flex: 1 }} />
        <button className="btn primary" onClick={() => modal.open("new")}>+ New profile</button>
      </div>
      {/* YDNI: banner chỉ nói CÁI GÌ + Ở ĐÂU (tên account). Cách xử nằm sau 1 click — nó chỉ cần
          khi bắt tay vào sửa, không cần chiếm 3 dòng thường trực trên mọi lượt xem. */}
      {(deadList.length > 0 || unknownList.length > 0) && (
        <div className="panel" style={{ padding: '7px 11px', marginBottom: 8, borderLeft: `3px solid ${deadList.length ? TONE.bad : TONE.warn}`, fontSize: 11.5, color: 'var(--fg-1)' }}>
          {deadList.length > 0 && (
            <div>🔒 <strong style={{ color: TONE.bad }}>{deadList.length} rụng phiên</strong>: {deadList.join(' · ')}</div>
          )}
          {unknownList.length > 0 && (
            <div style={{ marginTop: deadList.length ? 3 : 0 }}>❓ <strong style={{ color: TONE.warn }}>{unknownList.length} chưa đo</strong>: {unknownList.join(' · ')}</div>
          )}
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--fg-3)', fontSize: 10.5 }}>cách xử</summary>
            <div style={{ marginTop: 3, color: 'var(--fg-2)', fontSize: 10.5, lineHeight: 1.5 }}>
              <code style={{ fontFamily: 'var(--font-mono)' }}>browsers-refresh --idle 0</code> — thử login lại tự động (password trong vault trước, SSO sau).
              Không tự vào được thì mở profile login tay; account vẫn &quot;chưa đo&quot; là <code style={{ fontFamily: 'var(--font-mono)' }}>platforms.session_check_url</code> trỏ sai (ảnh ở <code style={{ fontFamily: 'var(--font-mono)' }}>/tmp/session-unsure-*.png</code>).
              Account <strong>chờ duyệt</strong> không nằm ở đây — dùng <code style={{ fontFamily: 'var(--font-mono)' }}>account-waiting</code>.
            </div>
          </details>
        </div>
      )}
      {needCare.length > 0 && (
        <div className="panel" style={{ padding: '7px 11px', marginBottom: 8, borderLeft: `3px solid ${TONE.bad}`, fontSize: 11.5, color: 'var(--fg-1)' }}>
          ⏳ <strong style={{ color: TONE.bad }}>{needCare.length} profile chưa mở ≥{STALE_D}d</strong>: {needCare.map((p) => p.label).join(' · ')}
          <span title={`Mở lại rồi bấm "✓ Vừa mở" trong drawer, hoặc chạy: browsers open <id>`} style={{ marginLeft: 6, color: 'var(--fg-3)', cursor: 'help' }}>ⓘ</span>
        </div>
      )}
      {ordered.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🧬</div>
          {filtering ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 12 }}>Không profile nào khớp bộ lọc.</p>
              <button className="btn" onClick={clearAll}>✕ Bỏ lọc</button>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 12 }}>Chưa có browser profile. Add từ GenLogin / Multilogin / Chrome native để link với account.</p>
              <button className="btn primary" onClick={() => modal.open("new")}>+ Add first profile</button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {ordered.map((p) => {
            const tm = toolMetaOf(p.tool);
            const idle = idleOf(p.lastOpenedAt);
            return (
              <div key={p.id} className="panel" style={{ padding: '10px 12px', cursor: 'pointer', borderLeft: idle.tone === 'fresh' ? undefined : `3px solid ${idle.color}` }} onClick={() => modal.open("edit", p.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{tm.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.label}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', padding: '1px 5px', border: '1px solid var(--line)', borderRadius: 3 }}>{tm.label}</span>
                </div>
                {p.manager && <div style={{ fontSize: 10, color: 'var(--fg-2)', marginTop: 1 }}>🔑 {p.manager}</div>}
                {p.projects.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {p.projects.map((pid) => (
                      <span key={pid} style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-1)' }}>📁 {pid}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                  {p.defaultProxyLabel && <EntityRef kind="proxy" id={p.defaultProxyId} label={p.defaultProxyLabel} size="sm" />}
                  <span>· {p.accountsCount} accounts</span>
                  {/* Tổng quan ngay trên card: profile mở đều nhưng vẫn có account bị đăng xuất là
                      chuyện thường (phiên rụng theo từng site) — không hiện ở đây thì phải mở drawer
                      từng cái mới biết. */}
                  {p.deadSessions > 0 && (
                    <span title={`${p.deadSessions} account trong profile này đã bị đăng xuất (browsers-refresh xác minh)`}
                      style={{ color: TONE.bad, fontWeight: 700 }}>· ⚠ {p.deadSessions} rụng phiên</span>
                  )}
                  {/* "Chưa đo" KHÔNG phải "ổn" — nó là vùng mù. Không hiện thì mặc định người đọc
                      cho là đã kiểm và đang tốt, rồi phát hiện ra lúc cần dùng. */}
                  {p.unknownSessions > 0 && (
                    <span title={`${p.unknownSessions} account chưa xác minh được phiên (chưa đo lần nào, hoặc đo ra chưa rõ / kẹt Cloudflare). Chưa biết ≠ đang tốt.`}
                      style={{ color: TONE.warn, fontWeight: 700 }}>· ? {p.unknownSessions} chưa đo</span>
                  )}
                  <span title={p.lastOpenedAt ? `Mở lần cuối: ${new Date(p.lastOpenedAt).toLocaleString()}` : 'Chưa từng ghi nhận mở'} style={{ color: idle.color, fontWeight: idle.tone === 'fresh' ? 400 : 600 }}>
                    · {idle.days === null ? '⚠️ chưa mở' : `${idle.days}d idle`}{idle.label && ` · ${idle.label}`}
                  </span>
                  {p.externalId && <span>· {p.externalId.split('/').pop()}</span>}
                </div>
                {/* Favicon TRÒN của từng account trong profile — nhìn 1 phát biết có những site nào,
                    khỏi mở drawer. Mất phiên / account bị khoá (KHÔNG active) thì để MỜ + xám. */}
                {p.accounts.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.accounts.map((a) => {
                      const inactive = a.sessionState === 'dead' || DEAD_STATUSES.includes(a.status as AccountStatus);
                      return (
                        <SiteFavicon key={a.id} {...platformFaviconProps(a.platformKey)} size={18} circle glyph="👤"
                          title={`${a.platformKey}/${a.handle || a.id} · phiên: ${a.sessionState ?? 'chưa đo'} · ${a.status}${inactive ? ' · ⚠ KHÔNG ACTIVE' : ''}`}
                          style={inactive ? { opacity: 0.3, filter: 'grayscale(1)' } : undefined} />
                      );
                    })}
                  </div>
                )}
                {/* Đang lọc thì phải chỉ ra ACCOUNT nào khớp — nếu không, card chỉ nói "profile này có
                    thứ gì đó khớp" và vẫn phải mở drawer ra dò, tức là bộ lọc chưa tiết kiệm được gì. */}
                {filtering && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {p.accounts.filter(matches).map((a) => {
                      const c = { alive: TONE.quiet, dead: TONE.bad, unknown: TONE.warn }[bucketOf(a.sessionState)];
                      return (
                        <span key={a.id} title={`${a.platformKey} · phiên: ${a.sessionState ?? 'chưa đo'} · account: ${a.status}`}
                          style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, border: `1px solid ${c}`, color: c, fontFamily: 'var(--font-mono)' }}>
                          {a.platformKey}/{a.handle || a.id}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <BrowserProfileDrawer profile={editing} proxies={proxies} teamMembers={teamMembers} onClose={() => modal.close()} />
      )}
    </>
  );
}

// ── Accounts tab (global) ─────────────────────────────────────────
// Mọi account cross-project trong 1 bảng. Đọc + tìm + nhảy tới chỗ sửa
// (accounts vault của project). Không clone form vault — 1 nguồn edit duy nhất.
function AccountsTab({ accounts }: { accounts: GlobalAccountRow[] }) {
  // Mọi entity chip ở đây mở drawer IN-PLACE qua <EntityDrawerHost> toàn cục
  // (lib/entity-drawer) — page này KHÔNG tự mount drawer, KHÔNG điều hướng.
  const [q, setQ] = useUrlParam('q', '');
  const [project, setProject] = useUrlParam('proj', 'all');
  const [platform, setPlatform] = useUrlParam('plat', 'all');
  const [status, setStatus] = useUrlParam('st', 'all');

  const projectOpts = Array.from(new Set(accounts.map((a) => a.projectId ?? '(unmapped)'))).sort();
  const platformOpts = Array.from(new Set(accounts.map((a) => a.platformKey))).sort();
  const statusOpts = Array.from(new Set(accounts.map((a) => a.status))).sort();

  const needle = q.trim().toLowerCase();
  const rows = accounts.filter((a) => {
    if (project !== 'all' && (a.projectId ?? '(unmapped)') !== project) return false;
    if (platform !== 'all' && a.platformKey !== platform) return false;
    if (status !== 'all' && a.status !== status) return false;
    if (!needle) return true;
    return [a.handle, a.email, a.platformKey, a.projectId, a.browserLabel, a.proxyLabel, a.ownerName, String(a.id)]
      .some((v) => v && v.toLowerCase().includes(needle));
  });

  const sel: React.CSSProperties = {
    padding: '5px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none',
  };
  const td: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--line)', fontSize: 11.5, verticalAlign: 'middle' };
  const th: React.CSSProperties = { ...td, fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', whiteSpace: 'nowrap' };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm handle / email / platform / project…"
          style={{ ...sel, flex: 1, minWidth: 220 }} />
        <select value={project} onChange={(e) => setProject(e.target.value)} style={sel}>
          <option value="all">📁 Mọi project</option>
          {projectOpts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={sel}>
          <option value="all">🌐 Mọi platform</option>
          {platformOpts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}>
          <option value="all">● Mọi status</option>
          {statusOpts.map((s) => <option key={s} value={s}>{accountStatusMeta(s).label}</option>)}
        </select>
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{rows.length}/{accounts.length}</span>
      </div>

      {rows.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🔐</div>
          <p style={{ margin: 0, fontSize: 12 }}>Không có account khớp bộ lọc.</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Platform</th>
                <th style={th}>Account</th>
                <th style={th}>Project</th>
                <th style={th}>Status</th>
                <th style={th}>Browser</th>
                <th style={th}>Proxy</th>
                <th style={th}>Owner</th>
                <th style={th}>Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openEntityDrawer('account', a.id)}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{a.id}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{a.platformKey}</td>
                  <td style={td}>
                    <EntityRef kind="account" id={a.id} label={a.handle || a.email || '(no handle)'} noIcon />
                    {a.email && a.handle && <span style={{ color: 'var(--fg-3)', fontSize: 10.5 }}> · {a.email}</span>}
                    {a.hasPassword && <span title="Có password lưu (encrypted)" style={{ marginLeft: 4 }}>🔑</span>}
                    {a.has2fa && <span title="2FA bật" style={{ marginLeft: 3 }}>🛡</span>}
                  </td>
                  <td style={td}>
                    {a.projectId
                      ? <EntityRef kind="project" id={a.projectId} label={a.projectId} size="sm"
                          title={`Lọc bảng theo project ${a.projectId}`}
                          onOpen={() => setProject(a.projectId!)} />
                      : <span style={{ fontSize: 10, color: 'var(--warn)' }}>⚠ unmapped</span>}
                  </td>
                  <td style={td}><StatusBadge meta={accountStatusMeta(a.status)} /></td>
                  <td style={td}>
                    {a.browserLabel
                      ? <EntityRef kind="browser-profile" id={a.browserProfileId} label={a.browserLabel} size="sm" />
                      : <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>—</span>}
                  </td>
                  <td style={td}>
                    {a.proxyLabel
                      ? <EntityRef kind="proxy" id={a.proxyId} label={a.proxyLabel} size="sm" />
                      : <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize: 10.5, color: 'var(--fg-2)' }}>{a.ownerName ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{relativeTime(a.lastUsedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </>
  );
}
