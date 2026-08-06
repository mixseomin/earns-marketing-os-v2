'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOfferNote, type AffiliateOffer } from '@/lib/actions/offers';
import { EmptyState, Drawer, ListToolbar, FilterChips, Pager, usePaged, MultiSelect } from './ui';

// Network label only (YDNI: no per-network colour — the name carries it; colour is reserved for status).
const NET: Record<string, string> = { awin: 'Awin', cj: 'CJ', other: 'Other' };
const netLabel = (n: string) => NET[n] ?? 'Other';

const APPROVED = new Set(['active', 'joined', 'approved']);
const isApproved = (s: string) => APPROVED.has(s.toLowerCase());
// Status = the ONE meaningful signal → the screen's colour: lime ok, amber pending, neutral otherwise.
const statusColor = (s: string) =>
  isApproved(s) ? 'var(--neon-lime)' : s.toLowerCase() === 'pending' ? 'var(--neon-amber)' : 'var(--fg-3)';

export function OffersPage({ offers }: { offers: AffiliateOffer[] }) {
  const [net, setNet] = useState('all');
  const [status, setStatus] = useState('all');
  const [geo, setGeo] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<AffiliateOffer | null>(null);
  // User note is kept out of the bulk list (Awin blob bloats every load) → fetch it lazily when
  // a specific offer's drawer opens. See offers.ts getOfferNote.
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setNote(null);
    if (!sel) return;
    let live = true;
    getOfferNote(sel.id).then((n) => { if (live) setNote(n); }).catch(() => {});
    return () => { live = false; };
  }, [sel]);

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
    if (geo.length && !geo.some((g) => o.geos.includes(g))) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!o.name.toLowerCase().includes(t) && !(o.vertical ?? '').toLowerCase().includes(t)
        && !o.tags.some((x) => x.toLowerCase().includes(t))) return false;
    }
    return true;
  }).sort((a, b) => (isApproved(a.status) ? 0 : 1) - (isApproved(b.status) ? 0 : 1) || a.name.localeCompare(b.name)),
  [offers, net, status, geo, q]);

  const { pageItems, ...pager } = usePaged(filtered);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          💸 Offers <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>// {counts.approved} approved · {counts.all} total</small>
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Offer affiliate đã duyệt từ CJ + Awin (Directus <code>affiliate_programs</code>). Đọc-tra để chọn cho content/newsletter — copy tracking link. Đồng bộ tự động từ network, không sửa tay ở đây.
        </p>
      </div>

      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="tìm tên / vertical / tag…"
        right={<MultiSelect label="geo" options={geos.map((g) => ({ value: g, label: g }))} selected={geo} onChange={setGeo} compact />}>
        <FilterChips value={net} onChange={setNet} counts={counts}
          options={[{ value: 'all', label: 'Tất cả' }, { value: 'awin', label: 'Awin' }, { value: 'cj', label: 'CJ' }, { value: 'other', label: 'Other' }]} />
        <FilterChips value={status} onChange={setStatus}
          options={[{ value: 'all', label: 'all' }, { value: 'approved', label: 'approved' }, { value: 'pending', label: 'pending' }, { value: 'paused', label: 'paused' }]} />
      </ListToolbar>

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
            {pageItems.map((o) => (
              <tr key={o.id} onClick={() => setSel(o)}
                style={{ borderTop: '1px solid rgba(127,127,127,.12)', cursor: 'pointer' }}>
                <td style={{ padding: '7px 8px', fontWeight: 600, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</td>
                <td style={{ padding: '7px 8px', color: 'var(--fg-2)', fontSize: 12 }}>{netLabel(o.network)}</td>
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
      <Pager {...pager} onPage={pager.setPage} />

      {sel && (
        <Drawer onClose={() => setSel(null)} width={520}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{netLabel(sel.network).toUpperCase()}</div>
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
            {note && <Field label="Notes" value={note} />}
            {sel.affiliateUrl && (
              <div>
                <div style={labelStyle}>Tracking link</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input readOnly value={sel.affiliateUrl} style={{ flex: 1, minWidth: 0, padding: '5px 9px', fontSize: 12, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-1)', outline: 'none' }} onFocus={(e) => e.currentTarget.select()} />
                  <button style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--neon-cyan)', color: '#0b0f14', fontWeight: 700 }}
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
