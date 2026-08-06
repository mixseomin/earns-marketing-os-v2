'use client';

import { Suspense, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getOfferNote, saveOfferTerms, type AffiliateOffer, type OfferAccount, type OfferKind } from '@/lib/actions/offers';
import {
  EmptyState, Drawer, ListToolbar, FilterChips, Pager, usePaged, MultiSelect,
  DataTable, TextField, TextAreaField, SelectField, type DataColumn, type DataGroup,
} from './ui';

// Source label only (YDNI: no per-source colour — the name carries it; colour is reserved for status).
const KIND: Record<OfferKind, string> = { awin: 'Awin', cj: 'CJ', direct: 'Direct', own: 'Own product' };

const APPROVED = new Set(['active', 'joined', 'approved']);
const isApproved = (s: string) => APPROVED.has(s.toLowerCase());
// Status = the ONE meaningful signal → the screen's colour: lime ok, amber pending, neutral otherwise.
const statusColor = (s: string) =>
  isApproved(s) ? 'var(--neon-lime)' : s.toLowerCase() === 'pending' ? 'var(--neon-amber)' : 'var(--fg-3)';

// commission_time is the authoritative "does it keep paying" column; older rows only encoded it
// inside commission_model text ("recurring (lifetime)") → fall back to that.
const RECUR: Record<string, string> = { forever: '♾ forever', '2_years': '2 years', '1_year': '1 year', '6_months': '6 months' };
function recurringOf(o: AffiliateOffer): string | null {
  if (o.recurring) return RECUR[o.recurring] ?? o.recurring.replace(/_/g, ' ');
  const m = o.model?.match(/recurring\s*\(([^)]+)\)/i);
  if (m?.[1]) return m[1];
  return /recurring/i.test(o.model ?? '') ? 'recurring' : null;
}
const rulesOf = (o: AffiliateOffer) => [o.policy, o.reward].filter(Boolean).join(' · ') || null;

const GROUPS: DataGroup[] = [
  { key: 'terms', label: 'terms', color: '#3c9bff' },
  { key: 'rules', label: 'rules', color: '#9d6cff' },
  { key: 'meta', label: 'meta', color: '#7d8899' },
];

const dim = { color: 'var(--fg-3)' };
const clip = (max: number): React.CSSProperties => ({ maxWidth: max, overflow: 'hidden', textOverflow: 'ellipsis' });

export function OffersPage(props: { offers: AffiliateOffer[]; accounts: OfferAccount[] }) {
  // useSearchParams (drawer deep-link) needs a Suspense boundary at build. See scenes-page.
  return <Suspense fallback={null}><OffersInner {...props} /></Suspense>;
}
function OffersInner({ offers, accounts }: { offers: AffiliateOffer[]; accounts: OfferAccount[] }) {
  const sp = useSearchParams();
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [geo, setGeo] = useState<string[]>([]);
  const [q, setQ] = useState('');
  // Drawer selection lives in the URL (?o=<id>) so a specific offer's drawer is shareable and
  // survives F5. Init from the URL on mount, mirror on change (house url-state pattern).
  const [sel, setSel] = useState<AffiliateOffer | null>(() => offers.find((o) => o.id === sp.get('o')) ?? null);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (sel) u.searchParams.set('o', sel.id); else u.searchParams.delete('o');
    window.history.replaceState(null, '', u);
  }, [sel]);
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
    awin: offers.filter((o) => o.kind === 'awin').length,
    cj: offers.filter((o) => o.kind === 'cj').length,
    direct: offers.filter((o) => o.kind === 'direct').length,
    own: offers.filter((o) => o.kind === 'own').length,
    approved: offers.filter((o) => isApproved(o.status)).length,
    terms: offers.filter((o) => o.commission).length,
    noAccount: offers.filter((o) => !o.accountId).length,
  }), [offers]);

  const filtered = useMemo(() => offers.filter((o) => {
    if (kind !== 'all' && o.kind !== kind) return false;
    const s = o.status.toLowerCase();
    if (status === 'approved' && !isApproved(s)) return false;
    if (status === 'pending' && s !== 'pending') return false;
    if (status === 'paused' && s !== 'paused') return false;
    if (geo.length && !geo.some((g) => o.geos.includes(g))) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!o.name.toLowerCase().includes(t) && !(o.vertical ?? '').toLowerCase().includes(t)
        && !(o.account ?? '').toLowerCase().includes(t)
        && !o.tags.some((x) => x.toLowerCase().includes(t))) return false;
    }
    return true;
  }).sort((a, b) => (isApproved(a.status) ? 0 : 1) - (isApproved(b.status) ? 0 : 1) || a.name.localeCompare(b.name)),
  [offers, kind, status, geo, q]);

  const { pageItems, ...pager } = usePaged(filtered);

  const columns: DataColumn<AffiliateOffer>[] = [
    {
      key: 'name', align: 'left', width: '100%', header: 'Offer',
      cellTitle: (o) => o.name,
      cell: (o) => <span style={{ fontWeight: 600, ...clip(300), display: 'inline-block', verticalAlign: 'bottom' }}>{o.name}</span>,
    },
    { key: 'kind', align: 'left', header: 'Source', cell: (o) => <span style={dim}>{KIND[o.kind]}</span> },
    {
      key: 'account', align: 'left', header: 'Account', title: 'Account của mình đã đăng ký / được duyệt offer này',
      cellTitle: (o) => o.account ?? undefined,
      cell: (o) => (o.account
        ? <span style={{ ...clip(190), display: 'inline-block', verticalAlign: 'bottom' }}>{o.account}</span>
        : <span style={{ color: 'var(--neon-amber)' }}>chưa gán</span>),
    },
    {
      key: 'status', align: 'left', header: 'Status',
      cell: (o) => <span style={{ color: statusColor(o.status) }}>● {o.status}</span>,
    },
    {
      key: 'commission', group: 'terms', align: 'right', header: '%', title: 'Commission rate',
      cell: (o) => o.commission ?? <span style={dim}>—</span>,
    },
    {
      key: 'recurring', group: 'terms', align: 'left', header: 'Recurring', title: 'Does the commission repeat, and for how long',
      cell: (o) => recurringOf(o) ?? <span style={dim}>one-time</span>,
    },
    {
      key: 'cookie', group: 'terms', align: 'right', header: 'Cookie', title: 'Cookie lifetime',
      cell: (o) => o.cookie ?? <span style={dim}>—</span>,
    },
    {
      key: 'rules', group: 'rules', align: 'left', header: 'Special rules', title: 'promotion_policy + reward_details',
      cellTitle: (o) => rulesOf(o) ?? undefined,
      cell: (o) => {
        const r = rulesOf(o);
        return r
          ? <span style={{ ...clip(280), display: 'inline-block', verticalAlign: 'bottom' }}>{r}</span>
          : <span style={dim}>—</span>;
      },
    },
    { key: 'type', group: 'meta', align: 'left', header: 'Type', cell: (o) => o.productType ?? <span style={dim}>—</span> },
    {
      key: 'vertical', group: 'meta', align: 'left', header: 'Vertical',
      cellTitle: (o) => o.vertical ?? undefined,
      cell: (o) => <span style={{ ...clip(150), display: 'inline-block', verticalAlign: 'bottom' }}>{o.vertical ?? '—'}</span>,
    },
    { key: 'geo', group: 'meta', align: 'left', header: 'Geo', cell: (o) => o.geos.join(' ') || <span style={dim}>—</span> },
    {
      key: 'link', align: 'center', header: '↗', title: 'Tracking link',
      cell: (o) => (o.affiliateUrl
        ? <a href={o.affiliateUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={o.affiliateUrl}>🔗</a>
        : <span style={dim}>—</span>),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          💸 Offers <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>
            // {counts.approved} approved · {counts.terms} có deal terms
            {counts.noAccount > 0 && <span style={{ color: 'var(--neon-amber)' }}> · {counts.noAccount} chưa gán account</span>} · {counts.all} total
          </small>
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Offer affiliate <b>của người khác</b> (Directus <code>affiliate_programs</code>): CJ + Awin sync tự động, Direct = tự thêm tay.
          Chọn cho content/newsletter — copy tracking link. Deal terms (% · recurring · cookie · rule riêng) sửa được ngay trong drawer;
          network sync không đụng mấy cột đó. Sản phẩm <b>tự bán</b> thuộc về <a href="/products" style={{ color: 'var(--neon-cyan)' }}>/products</a> — lọc <code>own</code> để thấy row nào đang lọt vào đây.
        </p>
      </div>

      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="tìm tên / vertical / tag…"
        right={<MultiSelect label="geo" options={geos.map((g) => ({ value: g, label: g }))} selected={geo} onChange={setGeo} compact />}>
        <FilterChips value={kind} onChange={setKind} counts={counts}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'awin', label: 'Awin' },
            { value: 'cj', label: 'CJ' },
            { value: 'direct', label: 'Direct', title: 'Program tự thêm tay, không qua network' },
            { value: 'own', label: 'Own', title: 'Sản phẩm mình tự bán — nên nằm ở /products' },
          ]} />
        <FilterChips value={status} onChange={setStatus}
          options={[{ value: 'all', label: 'all' }, { value: 'approved', label: 'approved' }, { value: 'pending', label: 'pending' }, { value: 'paused', label: 'paused' }]} />
      </ListToolbar>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Không có offer khớp" description="Đổi filter hoặc chờ sync CJ/Awin." />
      ) : (
        <DataTable rows={pageItems} columns={columns} groups={GROUPS} persistKey="offer_cols"
          getRowKey={(o) => o.id} onRowClick={(o) => setSel(o)} minWidth={900} />
      )}
      <Pager {...pager} onPage={pager.setPage} />

      {sel && (
        <Drawer onClose={() => setSel(null)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{KIND[sel.kind].toUpperCase()}</div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{sel.name}</h2>
                <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: statusColor(sel.status) }}>● {sel.status}</div>
                {sel.kind === 'own' && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--neon-amber)' }}>
                    ⚠ Trùng tên với 1 sản phẩm tự bán → chỗ của nó là <a href="/products" style={{ color: 'var(--neon-cyan)' }}>/products</a>, không phải offer affiliate.
                  </div>
                )}
              </div>
              <CopyLinkBtn />
            </div>

            <TermsForm key={sel.id} offer={sel} accounts={accounts} />

            <div>
              <div style={sectionLabel}>Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <Field label="Vertical" value={sel.vertical ?? '—'} />
                <Field label="Geo" value={sel.geos.join(', ') || '—'} />
                {sel.model && <Field label="Commission model" value={sel.model} />}
              </div>
              {sel.tags.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={labelStyle}>Tags</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {sel.tags.map((t) => <span key={t} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-2)' }}>{t}</span>)}
                  </div>
                </div>
              )}
              {note && <div style={{ marginTop: 12 }}><Field label="Notes" value={note} /></div>}
            </div>

            {sel.affiliateUrl ? (
              <div>
                <div style={sectionLabel}>Tracking link</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input readOnly value={sel.affiliateUrl} style={{ flex: 1, minWidth: 0, padding: '5px 9px', fontSize: 12, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-1)', outline: 'none' }} onFocus={(e) => e.currentTarget.select()} />
                  <button style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--neon-cyan)', color: '#0b0f14', fontWeight: 700 }}
                    onClick={() => navigator.clipboard?.writeText(sel.affiliateUrl ?? '')}>Copy</button>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                  <a href={sel.affiliateUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--neon-cyan)' }}>↗ Mở link</a>
                  {sel.previewUrl && <a href={sel.previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-3)' }}>↗ Preview</a>}
                </div>
              </div>
            ) : sel.previewUrl && (
              <a href={sel.previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-3)' }}>↗ Preview</a>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}

// Deal terms the network never sends (Awin/CJ sync writes other columns only → safe to edit here).
// account_id IS written by the Awin sync, but only for its own rows — editing a direct offer's
// account is safe; re-picking an Awin row's account just gets reset on the next nightly sync.
function TermsForm({ offer, accounts }: { offer: AffiliateOffer; accounts: OfferAccount[] }) {
  const router = useRouter();
  const [t, setT] = useState({
    commission: offer.commission ?? '', recurring: offer.recurring ?? '',
    cookie: offer.cookie ?? '', policy: offer.policy ?? '', reward: offer.reward ?? '',
    accountId: offer.accountId ?? '',
  });
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const set = (k: keyof typeof t) => (e: { target: { value: string } }) => setT((p) => ({ ...p, [k]: e.target.value }));

  const save = () => start(async () => {
    const r = await saveOfferTerms(offer.id, t);
    setMsg(r.ok ? '✓ đã lưu' : `⚠ ${r.error}`);
    if (r.ok) router.refresh();
  });

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Deal terms</div>
      <SelectField label="Account" size="sm" mono value={t.accountId} onChange={set('accountId')}
        hint={t.accountId ? undefined : 'Offer nào cũng phải gắn account đã đăng ký'}>
        <option value="">— chưa gán —</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </SelectField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <TextField label="Commission" size="sm" mono value={t.commission} onChange={set('commission')} placeholder="30% / $1" />
        <SelectField label="Recurring" size="sm" mono value={t.recurring} onChange={set('recurring')}>
          <option value="">one-time</option>
          <option value="6_months">6 months</option>
          <option value="1_year">1 year</option>
          <option value="2_years">2 years</option>
          <option value="forever">forever</option>
        </SelectField>
        <TextField label="Cookie" size="sm" mono value={t.cookie} onChange={set('cookie')} placeholder="60 days" />
      </div>
      <TextAreaField label="Special rules" size="sm" rows={2} value={t.policy} onChange={set('policy')}
        placeholder="traffic được phép, cấm brand bidding, coupon policy…" style={{ minHeight: 44 }} />
      <TextAreaField label="Reward details" size="sm" rows={2} value={t.reward} onChange={set('reward')}
        placeholder="bonus tier, payout đặc biệt…" style={{ minHeight: 44 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={save} disabled={pending}
          style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: pending ? 'default' : 'pointer', background: 'var(--neon-cyan)', color: '#0b0f14', fontWeight: 700, opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Đang lưu…' : 'Lưu terms'}
        </button>
        {msg && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: msg.startsWith('✓') ? 'var(--neon-lime)' : 'var(--bad)' }}>{msg}</span>}
      </div>
    </div>
  );
}

function CopyLinkBtn() {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" title="Copy link tới offer này"
      onClick={() => { navigator.clipboard?.writeText(window.location.href); setOk(true); setTimeout(() => setOk(false), 1200); }}
      style={{ flexShrink: 0, padding: '3px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: ok ? 'var(--neon-lime)' : 'var(--fg-2)', cursor: 'pointer' }}>
      {ok ? '✓ copied' : '🔗 link'}
    </button>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.04em' };
// Section heading inside the detail drawer: same mono micro-label, but with a divider so
// read-only groups (Details / Tracking) read as deliberate sections, not a loose stack.
const sectionLabel: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, paddingBottom: 6, marginBottom: 10, borderBottom: '1px solid var(--line)' };
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--fg-1)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}
