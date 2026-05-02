'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  type ProxyRow, type ProxyType, type ProxyHealth,
  type BrowserProfileRow, type ProfileTool,
  createProxy, updateProxy, archiveProxy,
  createBrowserProfile, updateBrowserProfile, archiveBrowserProfile,
} from '@/lib/actions/environments';

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

const TOOL_META: Record<ProfileTool, { label: string; icon: string }> = {
  genlogin:    { label: 'GenLogin',    icon: '🧬' },
  multilogin:  { label: 'Multilogin',  icon: '🌀' },
  adspower:    { label: 'AdsPower',    icon: '⚡' },
  kameleo:     { label: 'Kameleo',     icon: '🦎' },
  chrome:      { label: 'Chrome',      icon: '🌐' },
  firefox:     { label: 'Firefox',     icon: '🦊' },
  other:       { label: 'Other',       icon: '🔧' },
};

const PROXY_TYPE_META: Record<ProxyType, { label: string; color: string }> = {
  mobile:      { label: 'mobile',      color: 'var(--neon-lime)' },
  residential: { label: 'residential', color: 'var(--neon-cyan)' },
  datacenter:  { label: 'datacenter',  color: 'var(--fg-2)' },
  isp:         { label: 'isp',         color: 'var(--neon-amber)' },
};

export function EnvironmentsPage({ proxies, profiles }: { proxies: ProxyRow[]; profiles: BrowserProfileRow[] }) {
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

      {tab === 'proxies' ? <ProxiesTab proxies={proxies} /> : <ProfilesTab profiles={profiles} proxies={proxies} />}
    </div>
  );
}

// ── Proxies tab ───────────────────────────────────────────────────
function ProxiesTab({ proxies }: { proxies: ProxyRow[] }) {
  const [editing, setEditing] = useState<ProxyRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New proxy</button>
      </div>

      {proxies.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🔌</div>
          <p style={{ margin: '0 0 12px', fontSize: 12 }}>Chưa có proxy. Add 1 để dùng cho mobile/residential rotation.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Add first proxy</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {proxies.map((p) => {
            const tm = PROXY_TYPE_META[p.type];
            const hm = HEALTH_META[p.health];
            return (
              <div key={p.id} className="panel" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => setEditing(p)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.label}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: tm.color, padding: '1px 5px', border: `1px solid ${tm.color}`, borderRadius: 3 }}>{tm.label}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: hm.color }}>● {hm.label}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {p.endpoint.replace(/[^@]+@/, '***@')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  {p.location && <span>📍 {p.location}</span>}
                  <span>· {p.accountsCount} accounts</span>
                  {p.costPerGbCents > 0 && <span>· ${(p.costPerGbCents / 100).toFixed(2)}/GB</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <ProxyFormModal proxy={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
  );
}

function ProxyFormModal({ proxy, onClose }: { proxy: ProxyRow | null; onClose: () => void }) {
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
      const payload = { ...form, location: form.location || null, notes: form.notes || null };
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{proxy ? `proxy #${proxy.id}` : 'NEW PROXY'}</div>
            <h2>{isCreate ? '+ New proxy' : `Edit ${proxy!.label}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

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
            <input style={fld} placeholder="user:pass@host:port hoặc socks5://..."
                   value={form.endpoint} onChange={(e) => setF('endpoint', e.target.value)} />
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
function ProfilesTab({ profiles, proxies }: { profiles: BrowserProfileRow[]; proxies: ProxyRow[] }) {
  const [editing, setEditing] = useState<BrowserProfileRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New profile</button>
      </div>

      {profiles.length === 0 ? (
        <div className="panel" style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🧬</div>
          <p style={{ margin: '0 0 12px', fontSize: 12 }}>Chưa có browser profile. Add từ GenLogin / Multilogin / Chrome native để link với account.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Add first profile</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {profiles.map((p) => {
            const tm = TOOL_META[p.tool];
            return (
              <div key={p.id} className="panel" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => setEditing(p)}>
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
        <ProfileFormModal profile={editing} proxies={proxies} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </>
  );
}

function ProfileFormModal({ profile, proxies, onClose }: { profile: BrowserProfileRow | null; proxies: ProxyRow[]; onClose: () => void }) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{profile ? `profile #${profile.id}` : 'NEW PROFILE'}</div>
            <h2>{isCreate ? '+ New browser profile' : `Edit ${profile!.label}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Label *</span>
            <input style={fld} placeholder="vd: GL-orit-medium-01"
                   value={form.label} onChange={(e) => setF('label', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Tool *</span>
            <select style={fld} value={form.tool} onChange={(e) => setF('tool', e.target.value as ProfileTool)}>
              {(Object.entries(TOOL_META) as Array<[ProfileTool, { label: string }]>).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </div>
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
