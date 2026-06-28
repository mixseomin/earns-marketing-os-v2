'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { accountsInfraMatrix, updateAccountEnvironment, createBrowserProfile, createProxy, type AccountInfraRow, type BrowserProfileRow, type ProxyRow, type ProfileTool, type ProxyType } from '@/lib/actions/environments';
import type { OpenFn } from '@/components/content-value-page';

// "Setup node Account" — gán BROWSER PROFILE + PROXY cho từng account (mọi thứ để đăng an toàn).
// NHÚNG drawer node `account`. Account chưa gắn đủ lên đầu. Tạo nhanh profile/proxy ngay tại chỗ.
const TOOLS: ProfileTool[] = ['adspower', 'genlogin', 'multilogin', 'kameleo', 'chrome', 'firefox', 'other'];
const PXTYPES: ProxyType[] = ['mobile', 'residential', 'datacenter', 'isp'];

export function AccountInfraPanel({ onOpen }: { onOpen?: OpenFn }) {
  const [data, setData] = useState<{ accounts: AccountInfraRow[]; browserProfiles: BrowserProfileRow[]; proxies: ProxyRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newBp, setNewBp] = useState({ label: '', tool: 'adspower' as ProfileTool });
  const [newPx, setNewPx] = useState({ label: '', type: 'residential' as ProxyType, endpoint: '' });
  const reload = () => accountsInfraMatrix().then(setData);
  useEffect(() => { reload(); }, []);

  const setBrowser = async (id: number, v: string) => { setBusy(true); await updateAccountEnvironment(id, { browserProfileId: v ? Number(v) : null }); await reload(); setBusy(false); };
  const setProxy = async (id: number, v: string) => { setBusy(true); await updateAccountEnvironment(id, { proxyId: v ? Number(v) : null }); await reload(); setBusy(false); };
  const addBp = async () => { if (!newBp.label.trim()) return; setBusy(true); await createBrowserProfile({ label: newBp.label.trim(), tool: newBp.tool }); setNewBp({ label: '', tool: newBp.tool }); await reload(); setBusy(false); };
  const addPx = async () => { if (!newPx.label.trim() || !newPx.endpoint.trim()) return; setBusy(true); await createProxy({ label: newPx.label.trim(), type: newPx.type, endpoint: newPx.endpoint.trim() }); setNewPx({ label: '', type: newPx.type, endpoint: '' }); await reload(); setBusy(false); };

  if (!data) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải account…</div>;
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)', verticalAlign: 'middle' };
  const sel: CSSProperties = { fontSize: 11, padding: '2px 5px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-0)', color: 'var(--fg-0)', maxWidth: 150 };
  const inp: CSSProperties = { fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-0)', color: 'var(--fg-0)' };
  const btn = (c: string): CSSProperties => ({ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: `1px solid ${c}`, background: 'transparent', color: c, cursor: 'pointer' });
  const noBp = data.accounts.filter((a) => a.browserProfileId == null).length;
  const noPx = data.accounts.filter((a) => a.proxyId == null).length;

  return (
    <div style={{ opacity: busy ? 0.6 : 1 }}>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 10px' }}>
        {data.accounts.length} account · <b style={{ color: noBp ? 'var(--neon-amber)' : 'var(--neon-lime)' }}>{noBp} chưa gắn browser</b>, <b style={{ color: noPx ? 'var(--neon-amber)' : 'var(--neon-lime)' }}>{noPx} chưa gắn proxy</b>. Gắn để mỗi account đăng từ 1 browser-profile + IP riêng (chống liên kết tài khoản).
      </p>

      {/* tạo nhanh profile + proxy */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: 11 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ color: 'var(--fg-3)' }}>＋ Browser:</span>
          <input value={newBp.label} onChange={(e) => setNewBp((s) => ({ ...s, label: e.target.value }))} placeholder="label" style={{ ...inp, width: 110 }} />
          <select value={newBp.tool} onChange={(e) => setNewBp((s) => ({ ...s, tool: e.target.value as ProfileTool }))} style={sel}>{TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <button onClick={addBp} disabled={busy} style={btn('var(--neon-cyan)')}>tạo</button>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ color: 'var(--fg-3)' }}>＋ Proxy:</span>
          <input value={newPx.label} onChange={(e) => setNewPx((s) => ({ ...s, label: e.target.value }))} placeholder="label" style={{ ...inp, width: 90 }} />
          <select value={newPx.type} onChange={(e) => setNewPx((s) => ({ ...s, type: e.target.value as ProxyType }))} style={sel}>{PXTYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <input value={newPx.endpoint} onChange={(e) => setNewPx((s) => ({ ...s, endpoint: e.target.value }))} placeholder="host:port" style={{ ...inp, width: 120 }} />
          <button onClick={addPx} disabled={busy} style={btn('var(--neon-cyan)')}>tạo</button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Account</th><th style={th}>Platform</th><th style={th}>Status</th><th style={th}>Browser profile</th><th style={th}>Proxy</th></tr></thead>
        <tbody>
          {data.accounts.map((a) => (
            <tr key={a.id} style={{ background: (a.browserProfileId == null || a.proxyId == null) ? 'color-mix(in srgb, var(--neon-amber) 7%, transparent)' : undefined }}>
              <td style={{ ...td, fontWeight: 600 }}>{onOpen ? <a role="button" onClick={(e) => { e.preventDefault(); onOpen('account', a.id, a.handle); }} style={{ color: 'var(--fg-0)', textDecoration: 'none', cursor: 'pointer' }}>{a.handle}</a> : a.handle}</td>
              <td style={{ ...td, color: 'var(--fg-2)' }}>{a.platformKey || '—'}</td>
              <td style={{ ...td, color: 'var(--fg-3)' }}>{a.status || '—'}</td>
              <td style={td}>
                <select value={a.browserProfileId ?? ''} onChange={(e) => setBrowser(a.id, e.target.value)} style={{ ...sel, borderColor: a.browserProfileId == null ? 'var(--neon-amber)' : 'var(--bg-3)' }}>
                  <option value="">— chưa gắn —</option>
                  {data.browserProfiles.map((b) => <option key={b.id} value={b.id}>{b.label} ({b.tool})</option>)}
                </select>
              </td>
              <td style={td}>
                <select value={a.proxyId ?? ''} onChange={(e) => setProxy(a.id, e.target.value)} style={{ ...sel, borderColor: a.proxyId == null ? 'var(--neon-amber)' : 'var(--bg-3)' }}>
                  <option value="">— chưa gắn —</option>
                  {data.proxies.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.type})</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
