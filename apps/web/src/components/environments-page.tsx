'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useModalParam } from '@/lib/use-modal-param';
import {
  type ProxyRow, type ProxyType, type ProxyHealth,
  type BrowserProfileRow, type ProfileTool,
  createProxy, updateProxy, archiveProxy,
  createBrowserProfile, updateBrowserProfile, archiveBrowserProfile,
  testProxyEndpoint, testAndSaveProxy, type ProxyTestResult,
} from '@/lib/actions/environments';
import { AIFormParser, type FormFieldSchema } from './ai-form-parser';
import { OwnerSelect } from './owner-select';
import type { TeamMemberRow } from '@/lib/actions/team';

// Wrap external URLs through href.li to strip referrer (per global rule).
const hl = (url: string) => `https://href.li/?${url}`;

type Tab = 'proxies' | 'profiles';

function useUrlParam(key: string, defaultValue: string): [string, (v: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? defaultValue;
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === defaultValue) next.delete(key);
    else next.set(key, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [value, set];
}

const HEALTH_META: Record<ProxyHealth, { label: string; color: string }> = {
  ok:        { label: 'ok',        color: 'var(--ok)' },
  degraded:  { label: 'degraded',  color: 'var(--warn)' },
  down:      { label: 'down',      color: 'var(--bad)' },
  unknown:   { label: 'unknown',   color: 'var(--fg-3)' },
};

interface ToolMeta {
  label: string;
  icon: string;
  url?: string;
  desc?: string;
  pricing?: string;
  free?: boolean;
  os?: string;
  origin?: string;
}

const TOOL_META: Record<ProfileTool, ToolMeta> = {
  genlogin:    {
    label: 'GenLogin', icon: '🧬',
    url: 'https://genlogin.com',
    desc: 'Vietnamese-built anti-detect browser, popular ở SEA. Native Vietnamese support, hỗ trợ Telegram CSKH.',
    pricing: 'Free 2 profiles · Paid từ ~$5/mo',
    os: 'Windows · macOS', origin: '🇻🇳',
  },
  multilogin:  {
    label: 'Multilogin', icon: '🌀',
    url: 'https://multilogin.com',
    desc: 'Veteran enterprise-grade anti-detect, mature fingerprint engine (Stealthfox/Mimic).',
    pricing: 'Từ $99/mo (Solo) · $199/mo (Team)',
    os: 'Windows · macOS · Linux', origin: '🇪🇪',
  },
  adspower:    {
    label: 'AdsPower', icon: '⚡',
    url: 'https://www.adspower.com',
    desc: 'Free tier hào phóng (5 profiles), API mạnh, Local API cho automation.',
    pricing: 'Free 5 profiles · Pro từ $9/mo', free: true,
    os: 'Windows · macOS · Linux', origin: '🇨🇳',
  },
  kameleo:     {
    label: 'Kameleo', icon: '🦎',
    url: 'https://kameleo.io',
    desc: 'Mobile profile spoofing tốt, mobile fingerprint chính xác hơn Multilogin.',
    pricing: 'Từ $59/mo · Yearly discount',
    os: 'Windows · macOS · iOS', origin: '🇭🇺',
  },
  chrome:      {
    label: 'Chrome (native)', icon: '🌐',
    url: 'https://www.google.com/chrome/',
    desc: 'Chrome user profiles built-in (--profile-directory). Không có anti-detect, dùng cho non-sensitive accounts.',
    pricing: 'Free', free: true,
    os: 'All',
  },
  firefox:     {
    label: 'Firefox (native)', icon: '🦊',
    url: 'https://www.mozilla.org/firefox/',
    desc: 'Firefox profiles riêng (about:profiles). Multi-account containers extension hỗ trợ thêm.',
    pricing: 'Free', free: true,
    os: 'All',
  },
  other:       { label: 'Other', icon: '🔧', desc: 'Custom / less common tool — điền chi tiết vào notes.' },
};

// Suggested alternative tools — UI hint user có thể tham khảo (chưa làm enum option, vì cần migration)
const TOOL_SUGGESTIONS: Array<{ name: string; icon: string; url: string; desc: string; pricing: string; origin: string }> = [
  { name: 'Dolphin{anty}', icon: '🐬', url: 'https://dolphin-anty.com', desc: 'Affiliate marketing favorite, free 10 profiles, có team plan.', pricing: 'Free 10 · từ $89/mo', origin: '🇪🇸' },
  { name: 'GoLogin',       icon: '🌍', url: 'https://gologin.com',     desc: 'Cloud profiles, Linken Sphere alternative, mạnh Cookie Robot.', pricing: 'Free 3 · từ $24/mo', origin: '🇺🇸' },
  { name: 'Octo Browser',  icon: '🐙', url: 'https://octobrowser.net', desc: 'Modern UI, fast, integrate proxy gateway built-in.', pricing: 'Từ $29/mo (10 profiles)', origin: '🇨🇾' },
  { name: 'Indigo Browser',icon: '🟣', url: 'https://indigobrowser.com', desc: 'Sister product Multilogin Mimic engine, focused on speed.', pricing: 'Từ $99/mo', origin: '🇪🇪' },
  { name: 'Linken Sphere', icon: '🌐', url: 'https://ls.tenebris.cc', desc: 'OG anti-detect (since 2017), được coi là gold standard cho serious operators.', pricing: 'Từ $100/mo', origin: '🇪🇸' },
  { name: 'VMLogin',       icon: '🪟', url: 'https://www.vmlogin.us',  desc: 'Cheap entry, basic feature set, được community Trung dùng nhiều.', pricing: 'Từ $39/mo', origin: '🇨🇳' },
];

const PROXY_TYPE_META: Record<ProxyType, { label: string; color: string }> = {
  mobile:      { label: 'mobile',      color: 'var(--neon-lime)' },
  residential: { label: 'residential', color: 'var(--neon-cyan)' },
  datacenter:  { label: 'datacenter',  color: 'var(--fg-2)' },
  isp:         { label: 'isp',         color: 'var(--neon-amber)' },
};

export function EnvironmentsPage({ proxies, profiles, teamMembers = [] }: { proxies: ProxyRow[]; profiles: BrowserProfileRow[]; teamMembers?: TeamMemberRow[] }) {
  const [tabRaw, setTabRaw] = useUrlParam('tab', 'proxies');
  const tab: Tab = tabRaw === 'profiles' ? 'profiles' : 'proxies';

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🛰 Environments
            <small>// {proxies.length} proxies · {profiles.length} browser profiles</small>
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
        </button>
      </div>

      {tab === 'proxies' ? <ProxiesTab proxies={proxies} teamMembers={teamMembers} /> : <ProfilesTab profiles={profiles} proxies={proxies} teamMembers={teamMembers} />}
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
            const tm = PROXY_TYPE_META[p.type];
            const hm = HEALTH_META[p.health];
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

function ProxyFormModal({ proxy, onClose, teamMembers = [] }: { proxy: ProxyRow | null; onClose: () => void; teamMembers?: TeamMemberRow[] }) {
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
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

// ── Profiles tab ──────────────────────────────────────────────────
function ProfilesTab({ profiles, proxies, teamMembers = [] }: { profiles: BrowserProfileRow[]; proxies: ProxyRow[]; teamMembers?: TeamMemberRow[] }) {
  const modal = useModalParam("profile");
  const editing = modal.is("edit") ? profiles.find((x) => x.id === modal.numId) ?? null : null;
  const creating = modal.is("new");

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn primary" onClick={() => modal.open("new")}>+ New profile</button>
      </div>

      {profiles.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🧬</div>
          <p style={{ margin: '0 0 12px', fontSize: 12 }}>Chưa có browser profile. Add từ GenLogin / Multilogin / Chrome native để link với account.</p>
          <button className="btn primary" onClick={() => modal.open("new")}>+ Add first profile</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {profiles.map((p) => {
            const tm = TOOL_META[p.tool];
            return (
              <div key={p.id} className="panel" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => modal.open("edit", p.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{tm.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.label}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', padding: '1px 5px', border: '1px solid var(--line)', borderRadius: 3 }}>{tm.label}</span>
                </div>
                {p.externalId && <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>id: {p.externalId}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                  {p.defaultProxyLabel && <span>🔌 {p.defaultProxyLabel}</span>}
                  <span>· {p.accountsCount} accounts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <ProfileFormModal profile={editing} proxies={proxies} teamMembers={teamMembers} onClose={() => modal.close()} />
      )}
    </>
  );
}

function ToolInfoCard({ meta }: { meta: ToolMeta }) {
  if (!meta.desc && !meta.url) return null;
  return (
    <div style={{
      padding: '8px 10px', marginTop: 4,
      background: 'var(--bg-2)', border: '1px solid var(--line)',
      borderRadius: 5, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.45,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <span style={{ fontWeight: 700, color: 'var(--fg-0)' }}>{meta.label}</span>
        {meta.origin && <span style={{ fontSize: 13 }}>{meta.origin}</span>}
        {meta.url && (
          <a href={hl(meta.url)} target="_blank" rel="noopener noreferrer" title={meta.url} onClick={(e) => e.stopPropagation()}
             style={{ fontSize: 10, marginLeft: 'auto', color: 'var(--neon-cyan)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
            ↗ download
          </a>
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'transparent', border: 'none', color: 'var(--fg-3)',
          fontSize: 10.5, fontFamily: 'var(--font-mono)', cursor: 'pointer',
          padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{open ? 'Hide' : 'Browse'} {TOOL_SUGGESTIONS.length} other anti-detect tools</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, marginTop: 4 }}>
          {TOOL_SUGGESTIONS.map((s) => (
            <a key={s.name} href={hl(s.url)} target="_blank" rel="noopener noreferrer" title={s.url}
              style={{
                padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 4, textDecoration: 'none', color: 'inherit',
              }}>
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

function ProfileFormModal({ profile, proxies, onClose, teamMembers = [] }: { profile: BrowserProfileRow | null; proxies: ProxyRow[]; onClose: () => void; teamMembers?: TeamMemberRow[] }) {
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

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const save = () => {
    startTransition(async () => {
      const payload = {
        ...form,
        externalId: form.externalId || null,
        userAgent: form.userAgent || null,
        notes: form.notes || null,
        defaultProxyId: form.defaultProxyId,
        ownerUserId: form.ownerUserId,
      };
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
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{profile ? `profile #${profile.id}` : 'NEW PROFILE'}</div>
            <h2>{isCreate ? '+ New browser profile' : `Edit ${profile!.label}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

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
            <input style={fld} placeholder="vd: GL-orit-medium-01"
                   value={form.label} onChange={(e) => setF('label', e.target.value)} />
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
            <ToolInfoCard meta={TOOL_META[form.tool]} />
          </div>
          <ToolSuggestions />
          <div>
            <span style={lbl}>External ID</span>
            <input style={fld} placeholder="UUID/ID trong tool"
                   value={form.externalId} onChange={(e) => setF('externalId', e.target.value)} />
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
            <input style={fld} placeholder="Mozilla/5.0..."
                   value={form.userAgent} onChange={(e) => setF('userAgent', e.target.value)} />
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
          <div className="meta">{isCreate ? 'New' : `${profile!.accountsCount} accounts linked`}</div>
          <div className="modal-foot-actions">
            {!isCreate && <button className="btn danger" onClick={archive}>🗑 Archive</button>}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
