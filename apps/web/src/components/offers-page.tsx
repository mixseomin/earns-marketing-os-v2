'use client';

import { useMemo, useState } from 'react';
import type { AffiliateOffer } from '@/lib/actions/offers';
import { EmptyState, Drawer } from './ui';

const OTHER = { label: 'Other', color: '#64748b' };
const NET: Record<string, { label: string; color: string }> = {
  awin: { label: 'Awin', color: '#f97316' },
  cj: { label: 'CJ', color: '#22c55e' },
  other: OTHER,
};
const netMeta = (n: string) => NET[n] ?? OTHER;

const APPROVED = new Set(['active', 'joined', 'approved']);
const isApproved = (s: string) => APPROVED.has(s.toLowerCase());
const statusColor = (s: string) =>
  isApproved(s) ? 'var(--neon-lime)' : s.toLowerCase() === 'pending' ? 'var(--neon-amber)' : 'var(--fg-3)';

const chip = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
  border: '1px solid rgba(127,127,127,.25)', fontFamily: 'var(--font-mono)',
  background: active ? 'var(--neon-cyan)' : 'transparent',
  color: active ? '#0b0f14' : 'var(--fg-2)', fontWeight: active ? 700 : 400,
});
const inputStyle: React.CSSProperties = {
  padding: '5px 9px', fontSize: 12, borderRadius: 6, background: 'var(--bg-2)',
  border: '1px solid rgba(127,127,127,.25)', color: 'var(--fg-1)', minWidth: 180,
};

export function OffersPage({ offers }: { offers: AffiliateOffer[] }) {
  const [net, setNet] = useState('all');
  const [status, setStatus] = useState('all');
  const [geo, setGeo] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<AffiliateOffer | null>(null);

  const geos = useMemo(() => Array.from(new Set(offers.flatMap((o) => o.geos))).sort(), [offers]);
  const counts = useMemo(() => ({
    all: offers.length,
    awin: offers.filter((o) => o.network === 'awin').length,
    cj: offers.filter((o) => o.network === 'cj').length,
    other: offers.filter((o) => o.network === 'other').length,
    approved: offers.filter((o) => isApproved(o.status)).length,
  }), [offers]);

  const filtered = useMemo(() => offers.filter((o) => {
    if (net !== 'all' && o.network !== net) return false;
    const s = o.status.toLowerCase();
    if (status === 'approved' && !isApproved(s)) return false;
    if (status === 'pending' && s !== 'pending') return false;
    if (status === 'paused' && s !== 'paused') return false;
    if (geo !== 'all' && !o.geos.includes(geo)) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!o.name.toLowerCase().includes(t) && !(o.vertical ?? '').toLowerCase().includes(t)
        && !o.tags.some((x) => x.toLowerCase().includes(t))) return false;
    }
    return true;
  }).sort((a, b) => (isApproved(a.status) ? 0 : 1) - (isApproved(b.status) ? 0 : 1) || a.name.localeCompare(b.name)),
  [offers, net, status, geo, q]);

  return (
    <div style={{ padding: '16px 20px 60px' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          💸 Offers <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>// {counts.approved} approved · {counts.all} total</small>
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Offer affiliate đã duyệt từ CJ + Awin (Directus <code>affiliate_programs</code>). Đọc-tra để chọn cho content/newsletter — copy tracking link. Đồng bộ tự động từ network, không sửa tay ở đây.
        </p>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {(['all', 'awin', 'cj', 'other'] as const).map((n) => (
          <button key={n} style={chip(net === n)} onClick={() => setNet(n)}>
            {n === 'all' ? `Tất cả ${counts.all}` : `${netMeta(n).label} ${counts[n] ?? 0}`}
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: 'rgba(127,127,127,.25)', margin: '0 4px' }} />
        {(['all', 'approved', 'pending', 'paused'] as const).map((s) => (
          <button key={s} style={chip(status === s)} onClick={() => setStatus(s)}>{s}</button>
        ))}
        <span style={{ flex: 1 }} />
        <select value={geo} onChange={(e) => setGeo(e.target.value)} style={{ ...inputStyle, minWidth: 90 }}>
          <option value="all">geo: all</option>
          {geos.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm tên / vertical / tag…" style={inputStyle} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Không có offer khớp" description="Đổi filter hoặc chờ sync CJ/Awin." />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <th style={{ padding: '6px 8px' }}>Offer</th>
              <th style={{ padding: '6px 8px' }}>Network</th>
              <th style={{ padding: '6px 8px' }}>Status</th>
              <th style={{ padding: '6px 8px' }}>Vertical</th>
              <th style={{ padding: '6px 8px' }}>Geo</th>
              <th style={{ padding: '6px 8px' }}>Link</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} onClick={() => setSel(o)}
                style={{ borderTop: '1px solid rgba(127,127,127,.12)', cursor: 'pointer' }}>
                <td style={{ padding: '7px 8px', fontWeight: 600, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</td>
                <td style={{ padding: '7px 8px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: netMeta(o.network).color }}>{netMeta(o.network).label}</span>
                </td>
                <td style={{ padding: '7px 8px' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: statusColor(o.status) }}>● {o.status}</span>
                </td>
                <td style={{ padding: '7px 8px', color: 'var(--fg-2)', fontSize: 12 }}>{o.vertical ?? '—'}</td>
                <td style={{ padding: '7px 8px', color: 'var(--fg-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{o.geos.join(' ') || '—'}</td>
                <td style={{ padding: '7px 8px' }}>{o.affiliateUrl ? '🔗' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sel && (
        <Drawer onClose={() => setSel(null)} width={520}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: netMeta(sel.network).color, marginBottom: 4 }}>{netMeta(sel.network).label.toUpperCase()}</div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{sel.name}</h2>
              <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: statusColor(sel.status) }}>● {sel.status}</div>
            </div>
            <Field label="Vertical" value={sel.vertical ?? '—'} />
            <Field label="Geo" value={sel.geos.join(', ') || '—'} />
            {sel.tags.length > 0 && (
              <div>
                <div style={labelStyle}>Tags</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {sel.tags.map((t) => <span key={t} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-2)' }}>{t}</span>)}
                </div>
              </div>
            )}
            {sel.note && <Field label="Notes" value={sel.note} />}
            {sel.affiliateUrl && (
              <div>
                <div style={labelStyle}>Tracking link</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input readOnly value={sel.affiliateUrl} style={{ ...inputStyle, flex: 1, minWidth: 0 }} onFocus={(e) => e.currentTarget.select()} />
                  <button style={{ ...chip(false), background: 'var(--neon-cyan)', color: '#0b0f14', fontWeight: 700 }}
                    onClick={() => navigator.clipboard?.writeText(sel.affiliateUrl ?? '')}>Copy</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {sel.affiliateUrl && <a href={sel.affiliateUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--neon-cyan)' }}>↗ Mở link</a>}
              {sel.previewUrl && <a href={sel.previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-3)' }}>↗ Preview</a>}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em' };
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}
