'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getOfferNote, saveOfferTerms, getEntityOffers, getAccountDetail,
  type AffiliateOffer, type OfferAccount, type OfferKind, type OfferFilters, type OffersView, type AccountDetail,
} from '@/lib/actions/offers';
import { useModalParam } from '@/lib/use-modal-param';
import {
  EmptyState, Drawer, ListToolbar, FilterChips, Pager, MultiSelect,
  DataTable, TextField, TextAreaField, SelectField, type DataColumn, type DataGroup,
} from './ui';

// Source label only (YDNI: no per-source colour — the name carries it; colour is reserved for status).
const KIND: Record<OfferKind, string> = { awin: 'Awin', cj: 'CJ', direct: 'Direct', own: 'Own product' };

// Where to log in to manage each network (drawer "↗ dashboard"). Keys = platform/network key.
const NETWORK_HOME: Record<string, string> = {
  tkglobal: 'https://pub.tkglobal.asia/', travelpayouts: 'https://app.travelpayouts.com/programs',
  adpia: 'https://newpub.adpia.vn/campaigns', ecomobi: 'https://affiliate.passio.eco/list-campaign',
  masoffer: 'https://ecom.masoffer.com/offer', accesstrade: 'https://pub2.accesstrade.vn/campaign-v2',
  vcommission: 'https://network.vcommission.com/publisher/v2/campaigns', clickbank: 'https://accounts.clickbank.com/marketplace.htm',
  rakuten: 'https://publisher.rakutenadvertising.com/advertisers', awin: 'https://ui.awin.com/', cj: 'https://members.cj.com/',
};
const netLabel = (o: AffiliateOffer) => o.network ?? (o.kind === 'awin' ? 'awin' : o.kind === 'cj' ? 'cj' : null);
const clickable: React.CSSProperties = { cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 };
// Account label is "network · handle"; the Network column already carries the network → the Account
// cell shows only the handle/login (YDNI: no duplicated network). Drawer header restores the full id.
const acctHandle = (label: string) => { const i = label.indexOf(' · '); return i >= 0 ? label.slice(i + 3) : label; };

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
  { key: 'dates', label: 'dates', color: '#e0a03c' },
];

// ISO → 06/08. Đủ để quét mắt theo cột; ngày đầy đủ nằm ở tooltip.
const day = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

const dim = { color: 'var(--fg-3)' };
const clip = (max: number): React.CSSProperties => ({ maxWidth: max, overflow: 'hidden', textOverflow: 'ellipsis' });

export function OffersPage(props: { view: OffersView; filters: OfferFilters; accounts: OfferAccount[] }) {
  // useSearchParams (filter + drawer url-state) needs a Suspense boundary at build. See scenes-page.
  return <Suspense fallback={null}><OffersInner {...props} /></Suspense>;
}
function OffersInner({ view, filters, accounts }: { view: OffersView; filters: OfferFilters; accounts: OfferAccount[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [nav, startNav] = useTransition();
  const { rows, counts, facets } = view;

  // Filters = URL params, applied SERVER-side (the list is ~5k remote rows — ui-conventions §5).
  // Every control writes the URL; the route re-renders with one page of rows.
  const go = (mut: (p: URLSearchParams) => void, keepPage = false) => {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    if (!keepPage) p.delete('page');   // any filter change → back to page 1
    const qs = p.toString();
    startNav(() => router.push(qs ? `/offers?${qs}` : '/offers', { scroll: false }));
  };
  const setOne = (k: string) => (v: string) => go((p) => { if (v && v !== 'all') p.set(k, v); else p.delete(k); });
  const setMulti = (k: string) => (v: string[]) => go((p) => { if (v.length) p.set(k, v.join(',')); else p.delete(k); });
  const active = Boolean(filters.q || filters.accounts.length || filters.verticals.length || filters.geos.length
    || [filters.kind, filters.status, filters.gap, filters.recurring].some((v) => v && v !== 'all'));

  // Search: type locally (instant), push to the URL after a pause — otherwise every keystroke
  // is a server roundtrip.
  const [q, setQ] = useState(filters.q);
  useEffect(() => { setQ(filters.q); }, [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => setOne('q')(q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Drawer = house url-state hook (?m=offer&mId=<id>) → shareable + survives F5.
  const modal = useModalParam();
  const sel = modal.is('offer') ? rows.find((o) => o.id === modal.id) ?? null : null;
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

  // Entity quick-view: click an account / network / brand cell → drawer with EVERY offer for that
  // entity (all networks) so you can compare who pays most for the same merchant.
  const [entity, setEntity] = useState<{ field: 'brand' | 'network'; value: string; label: string } | null>(null);
  const [entityRows, setEntityRows] = useState<AffiliateOffer[] | null>(null);
  useEffect(() => {
    setEntityRows(null);
    if (!entity) return;
    let live = true;
    getEntityOffers(entity.field, entity.value).then((r) => { if (live) setEntityRows(r); }).catch(() => {});
    return () => { live = false; };
  }, [entity]);
  const openEntity = (field: 'brand' | 'network', value: string | null, label: string) =>
    (e: React.MouseEvent) => { e.stopPropagation(); if (value) setEntity({ field, value, label }); };

  // Account is an IDENTITY, not a comparison → its OWN drawer (login / network / status / offers),
  // fetched lazily via getAccountDetail. Separate from the brand/network compare drawer.
  const [acctSel, setAcctSel] = useState<{ id: string; label: string } | null>(null);
  const [acct, setAcct] = useState<AccountDetail | null>(null);
  const [acctErr, setAcctErr] = useState(false);
  useEffect(() => {
    setAcct(null); setAcctErr(false);
    if (!acctSel) return;
    let live = true;
    getAccountDetail(acctSel.id).then((a) => { if (live) { setAcct(a); if (!a) setAcctErr(true); } }).catch(() => { if (live) setAcctErr(true); });
    return () => { live = false; };
  }, [acctSel]);
  const openAccount = (id: string | null, label: string) => (e: React.MouseEvent) => { e.stopPropagation(); if (id) setAcctSel({ id, label }); };

  const columns: DataColumn<AffiliateOffer>[] = [
    {
      key: 'name', sortValue: (o) => o.name, align: 'left', width: '100%', header: 'Offer',
      cellTitle: (o) => o.name,
      cell: (o) => <span style={{ fontWeight: 600, ...clip(300), display: 'inline-block', verticalAlign: 'bottom' }}>{o.name}</span>,
    },
    {
      key: 'brand', sortValue: (o) => o.brand, align: 'left', header: 'Brand', title: 'Merchant gọn (bỏ hậu tố CPS/Network/geo) → click để so sánh mọi net trả bao nhiêu cho cùng brand',
      cellTitle: (o) => o.brand,
      cell: (o) => <span style={{ ...clickable, ...clip(150), display: 'inline-block', verticalAlign: 'bottom' }} onClick={openEntity('brand', o.brand, o.brand)}>{o.brand}</span>,
    },
    {
      key: 'network', sortValue: (o) => netLabel(o), align: 'left', header: 'Network', title: 'Network cung cấp offer — click xem mọi offer của net này',
      cell: (o) => { const n = netLabel(o); return n ? <span style={clickable} onClick={openEntity('network', n, n)}>{n}</span> : <span style={dim}>—</span>; },
    },
    {
      key: 'account', sortValue: (o) => o.account ?? null, align: 'left', header: 'Account', title: 'Account của mình đã đăng ký / được duyệt offer này — click xem nhanh',
      cellTitle: (o) => o.account ?? undefined,
      cell: (o) => (o.account
        ? <span style={{ ...clickable, ...clip(190), display: 'inline-block', verticalAlign: 'bottom' }} onClick={openAccount(o.accountId, o.account)}>{acctHandle(o.account)}</span>
        : <span style={{ color: 'var(--neon-amber)' }}>chưa gán</span>),
    },
    {
      key: 'status', sortValue: (o) => o.status, align: 'left', header: 'Status',
      cell: (o) => <span style={{ color: statusColor(o.status) }}>● {o.status}</span>,
    },
    {
      key: 'commission', sortValue: (o) => o.commission ?? null, group: 'terms', align: 'right', header: '%', title: 'Commission rate',
      cell: (o) => o.commission ?? <span style={dim}>—</span>,
    },
    {
      key: 'recurring', sortValue: (o) => recurringOf(o) ?? null, group: 'terms', align: 'left', header: 'Recurring', title: 'Does the commission repeat, and for how long',
      cell: (o) => recurringOf(o) ?? <span style={dim}>one-time</span>,
    },
    {
      key: 'cookie', sortValue: (o) => o.cookie ?? null, group: 'terms', align: 'right', header: 'Cookie', title: 'Cookie lifetime',
      cell: (o) => o.cookie ?? <span style={dim}>—</span>,
    },
    {
      key: 'epc', sortValue: (o) => (o.epc ? parseFloat(o.epc.replace(/[^\d.]/g, '')) : null), group: 'terms', align: 'right', header: 'EPC', title: 'Earnings per click (network báo)',
      cell: (o) => o.epc ?? <span style={dim}>—</span>,
    },
    {
      key: 'cvr', sortValue: (o) => (o.cvr ? parseFloat(o.cvr.replace(/[^\d.]/g, '')) : null), group: 'terms', align: 'right', header: 'CVR', title: 'Conversion / approval rate',
      cell: (o) => o.cvr ?? <span style={dim}>—</span>,
    },
    {
      key: 'currency', sortValue: (o) => o.currency ?? null, group: 'meta', align: 'left', header: 'Cur', title: 'Payout currency',
      cell: (o) => o.currency ?? <span style={dim}>—</span>,
    },
    {
      key: 'rules', sortValue: (o) => rulesOf(o) ?? null, group: 'rules', align: 'left', header: 'Special rules', title: 'promotion_policy + reward_details',
      cellTitle: (o) => rulesOf(o) ?? undefined,
      cell: (o) => {
        const r = rulesOf(o);
        return r
          ? <span style={{ ...clip(280), display: 'inline-block', verticalAlign: 'bottom' }}>{r}</span>
          : <span style={dim}>—</span>;
      },
    },
    { key: 'type', sortValue: (o) => o.productType ?? null, group: 'meta', align: 'left', header: 'Type', cell: (o) => o.productType ?? <span style={dim}>—</span> },
    {
      key: 'vertical', sortValue: (o) => o.vertical ?? null, group: 'meta', align: 'left', header: 'Vertical',
      cellTitle: (o) => o.vertical ?? undefined,
      cell: (o) => <span style={{ ...clip(150), display: 'inline-block', verticalAlign: 'bottom' }}>{o.vertical ?? '—'}</span>,
    },
    { key: 'geo', sortValue: (o) => o.geos.join(' ') || null, group: 'meta', align: 'left', header: 'Geo', cell: (o) => o.geos.join(' ') || <span style={dim}>—</span> },
    {
      key: 'created', sortValue: (o) => o.createdAt, group: 'dates', align: 'right', header: 'Added', title: 'Lần đầu sync thấy offer này (không phải ngày merchant vào network)',
      cellTitle: (o) => o.createdAt,
      cell: (o) => <span style={dim}>{day(o.createdAt)}</span>,
    },
    {
      key: 'approved', sortValue: (o) => o.approvedAt ?? null, group: 'dates', align: 'right', header: 'Approved',
      title: 'Ngày sync THẤY offer chuyển sang duyệt. Trống = duyệt trước 2026-08-07 (network không trả về ngày duyệt nên không backfill được) hoặc chưa duyệt',
      cellTitle: (o) => o.approvedAt ?? undefined,
      cell: (o) => (o.approvedAt ? <span style={{ color: 'var(--neon-lime)' }}>{day(o.approvedAt)}</span> : <span style={dim}>—</span>),
    },
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
            {(counts['no-account'] ?? 0) > 0 && <span style={{ color: 'var(--neon-amber)' }}> · {counts['no-account']} chưa gán account</span>} · {counts.all} total
            {active && <span style={{ color: 'var(--neon-cyan)' }}> · đang lọc: {view.matched}</span>}
          </small>
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Offer affiliate <b>của người khác</b> (Directus <code>affiliate_programs</code>): CJ + Awin sync tự động; tkglobal · Travelpayouts · Adpia · Ecomobi · MasOffer · Accesstrade · vCommission · ClickBank kéo từ dashboard từng net.
          Click <b>Brand</b> để so sánh net nào trả cao nhất cho cùng merchant; click <b>Network/Account</b> để xem nhanh mọi offer của nó. Copy tracking link cho content/newsletter.
          Sản phẩm <b>tự bán</b> thuộc về <a href="/products" style={{ color: 'var(--neon-cyan)' }}>/products</a> — lọc <code>own</code>.
        </p>
      </div>

      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="tên / account / rule / tag…">
        <FilterChips value={filters.kind} onChange={setOne('kind')} counts={counts}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'awin', label: 'Awin' },
            { value: 'cj', label: 'CJ' },
            { value: 'direct', label: 'Direct', title: 'Program tự thêm tay, không qua network' },
            { value: 'own', label: 'Own', title: 'Sản phẩm mình tự bán — nên nằm ở /products' },
          ]} />
        <FilterChips value={filters.status} onChange={setOne('status')} counts={counts}
          options={[
            { value: 'all', label: 'all' },
            { value: 'approved', label: 'approved', title: 'Đã duyệt — dùng được ngay' },
            { value: 'pending', label: 'pending', title: 'Đã apply, chờ merchant duyệt' },
            { value: 'rejected', label: 'rejected', title: 'Awin báo bị từ chối (CJ không có API cho trạng thái này)' },
            { value: 'inactive', label: 'inactive', title: 'paused / suspended / đã rời programme' },
          ]} />
      </ListToolbar>

      {/* Hàng 2 = filter chi tiết: chọn nhiều giá trị (account/vertical/geo) + lọc theo cái CÒN THIẾU. */}
      <ListToolbar right={active
        ? <button type="button" onClick={() => go((p) => { for (const k of ['q', 'kind', 'status', 'account', 'vertical', 'geo', 'gap', 'recurring']) p.delete(k); })}
            style={{ padding: '3px 9px', fontSize: 11, fontFamily: 'var(--font-mono)', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' }}>
            ✕ bỏ lọc
          </button>
        : undefined}>
        <MultiSelect label="account" compact selected={filters.accounts} onChange={setMulti('account')}
          options={facets.accounts.map((f) => ({ value: f.value, label: f.label, count: f.count }))} />
        <MultiSelect label="vertical" compact selected={filters.verticals} onChange={setMulti('vertical')}
          options={facets.verticals.map((f) => ({ value: f.value, label: f.label, count: f.count }))} />
        <MultiSelect label="geo" compact selected={filters.geos} onChange={setMulti('geo')}
          options={facets.geos.map((f) => ({ value: f.value, label: f.label, count: f.count }))} />
        <FilterChips value={filters.recurring} onChange={setOne('recurring')}
          options={[
            { value: 'all', label: 'mọi payout' },
            { value: 'yes', label: `recurring ${counts.recurring ?? 0}`, title: 'Hoa hồng lặp lại (commission_time hoặc model ghi recurring)' },
            { value: 'no', label: 'one-time' },
          ]} />
        <FilterChips value={filters.gap} onChange={setOne('gap')} counts={counts}
          options={[
            { value: 'all', label: 'đủ/thiếu' },
            { value: 'no-terms', label: 'thiếu terms', title: 'Chưa có % / recurring / cookie / rule nào' },
            { value: 'no-account', label: 'chưa gán account' },
            { value: 'no-link', label: 'thiếu link', title: 'Chưa có tracking link' },
          ]} />
        <FilterChips value={filters.sort || 'default'} onChange={(v) => setOne('sort')(v === 'default' ? '' : v)}
          options={[
            { value: 'default', label: '↕ duyệt trước' },
            { value: 'new', label: `↓ mới thêm ${counts.new7 ?? 0}`, title: 'Sync mới thấy — số là 7 ngày gần nhất' },
            { value: 'approved', label: `↓ mới duyệt ${counts.approved7 ?? 0}`, title: 'Sync mới thấy chuyển sang duyệt — số là 7 ngày gần nhất' },
          ]} />
      </ListToolbar>

      <div style={{ opacity: nav ? 0.55 : 1, transition: 'opacity .12s' }}>
        {rows.length === 0 ? (
          <EmptyState icon="🔍" title="Không có offer khớp"
            description={filters.q ? `Không thấy gì cho "${filters.q}" với bộ lọc hiện tại.` : 'Đổi filter hoặc chờ sync CJ/Awin.'} />
        ) : (
          <DataTable rows={rows} columns={columns} groups={GROUPS} persistKey="offer_cols"
            getRowKey={(o) => o.id} onRowClick={(o) => modal.open('offer', o.id)} minWidth={900} />
        )}
      </div>
      <Pager page={view.page} pageCount={view.pageCount} total={view.matched} pageSize={view.pageSize}
        onPage={(p) => go((x) => { if (p > 0) x.set('page', String(p + 1)); else x.delete('page'); }, true)} />

      {sel && (
        <Drawer onClose={() => modal.close()} width={560}>
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
                {netLabel(sel) && <Field label="Network" value={netLabel(sel)!} />}
                <Field label="Brand" value={sel.brand} />
                <Field label="Vertical" value={sel.vertical ?? '—'} />
                <Field label="Geo" value={sel.geos.join(', ') || '—'} />
                {sel.currency && <Field label="Currency" value={sel.currency} />}
                {sel.epc && <Field label="EPC" value={sel.epc} />}
                {sel.cvr && <Field label="CVR / approval" value={sel.cvr} />}
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

      {entity && (
        <EntityDrawer entity={entity} rows={entityRows}
          onClose={() => setEntity(null)}
          onOpenOffer={(id) => { setEntity(null); modal.open('offer', id); }}
          onFilterBrand={entity.field === 'brand' ? () => { setEntity(null); setQ(entity.value); } : undefined} />
      )}

      {acctSel && (
        <AccountDrawer sel={acctSel} acct={acct} err={acctErr}
          onClose={() => setAcctSel(null)}
          onOpenOffer={(id) => { setAcctSel(null); modal.open('offer', id); }}
          onFilter={() => { const s = acctSel; setAcctSel(null); setMulti('account')([s.id]); }} />
      )}
    </div>
  );
}

// The Account cell's drawer: WHO this login is, not a bag of offers. Identity + health + a dashboard
// deep-link, then the offers under it. Reuses the house Drawer + Field/sectionLabel + NETWORK_HOME.
function AccountDrawer({ sel, acct, err, onClose, onOpenOffer, onFilter }: {
  sel: { id: string; label: string };
  acct: AccountDetail | null;
  err: boolean;
  onClose: () => void;
  onOpenOffer: (offerId: string) => void;
  onFilter: () => void;
}) {
  // Header renders INSTANTLY from the clicked label ("network · handle") — no wait on the vault fetch,
  // so it's unmistakably the ACCOUNT drawer even while detail loads (or if the vault call fails).
  const parts = sel.label.split(' · ');
  const net = parts[0] ?? sel.label;
  const handle = parts.slice(1).join(' · ') || net;
  const home = NETWORK_HOME[(acct?.platform ?? net).toLowerCase()];
  return (
    <Drawer onClose={onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>ACCOUNT · {(acct?.platform ?? net).toUpperCase()}</div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{acct?.handle || handle}</h2>
          {acct?.status && <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: statusColor(acct.status) }}>● {acct.status}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {home && <a href={home} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none' }}>↗ mở dashboard net</a>}
            <button type="button" onClick={onFilter} style={miniBtn}>⌕ lọc bảng theo account này</button>
          </div>
        </div>

        {!acct ? (
          <div style={{ color: err ? 'var(--neon-amber)' : 'var(--fg-3)', fontSize: 12 }}>{err ? 'Không tải được chi tiết account từ vault.' : 'Đang tải chi tiết…'}</div>
        ) : (
         <>
          <div>
            <div style={sectionLabel}>Identity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              <Field label="Network" value={acct.platform || '—'} />
              <Field label="Handle" value={acct.handle || '—'} />
              {acct.email && <Field label="Email" value={acct.email} />}
              {acct.authMethod && <Field label="Auth" value={acct.authMethod + (acct.has2fa ? ' · 2FA' : '')} />}
              {acct.valueTier && <Field label="Value tier" value={acct.valueTier} />}
              {acct.purpose && <Field label="Purpose" value={acct.purpose} />}
              {acct.monthlyCost != null && acct.monthlyCost > 0 && <Field label="Monthly cost" value={`$${acct.monthlyCost}`} />}
              {acct.lastVerifiedAt && <Field label="Last verified" value={acct.lastVerifiedAt.slice(0, 10)} />}
            </div>
            {acct.tags.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={labelStyle}>Tags</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {acct.tags.map((t) => <span key={t} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-2)', color: 'var(--fg-2)' }}>{t}</span>)}
                </div>
              </div>
            )}
            {acct.notes && <div style={{ marginTop: 12 }}><Field label="Notes" value={acct.notes} /></div>}
          </div>

          <div>
            <div style={sectionLabel}>Offers dưới account · {acct.offers.count}</div>
            {acct.offers.count === 0 ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Chưa có offer nào gán account này.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {acct.offers.rows.map((o) => (
                      <tr key={o.id} onClick={() => onOpenOffer(o.id)} style={{ cursor: 'pointer', borderTop: '1px solid var(--line)' }}>
                        <td style={{ ...td, ...clip(240) }} title={o.name}>{o.name}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{o.commission ?? '—'}</td>
                        <td style={{ ...td, color: statusColor(o.status), whiteSpace: 'nowrap' }}>● {o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {acct.offers.count > acct.offers.rows.length && <div style={{ color: 'var(--fg-3)', fontSize: 11, marginTop: 6 }}>+{acct.offers.count - acct.offers.rows.length} nữa — bấm "lọc bảng" để xem hết</div>}
              </div>
            )}
          </div>
         </>
        )}
      </div>
    </Drawer>
  );
}

// Quick-view drawer for a clicked entity (brand / network / account). Its whole point is the
// comparison table: the SAME brand across networks, so you see who pays most at a glance.
function EntityDrawer({ entity, rows, onClose, onOpenOffer, onFilterBrand }: {
  entity: { field: 'brand' | 'network'; value: string; label: string };
  rows: AffiliateOffer[] | null;
  onClose: () => void;
  onOpenOffer: (id: string) => void;
  onFilterBrand?: () => void;
}) {
  const kindWord = entity.field === 'brand' ? 'Brand' : entity.field === 'network' ? 'Network' : 'Account';
  const nets = rows ? new Set(rows.map((r) => netLabel(r)).filter(Boolean)).size : 0;
  const home = entity.field === 'network' ? NETWORK_HOME[entity.value] : undefined;
  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{kindWord.toUpperCase()}</div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{entity.label}</h2>
          {rows && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {rows.length} offer{entity.field === 'brand' && nets > 1 ? ` · ${nets} networks` : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {onFilterBrand && <button type="button" onClick={onFilterBrand} style={miniBtn}>⌕ lọc bảng theo brand này</button>}
            {home && <a href={home} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none' }}>↗ dashboard</a>}
          </div>
        </div>

        {!rows ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Đang tải…</div>
          : rows.length === 0 ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Không có offer.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                    {entity.field !== 'network' && <th style={th}>Network</th>}
                    <th style={th}>Offer</th>
                    <th style={{ ...th, textAlign: 'right' }}>%</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cookie</th>
                    <th style={{ ...th, textAlign: 'right' }}>EPC</th>
                    <th style={{ ...th, textAlign: 'right' }}>CVR</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} onClick={() => onOpenOffer(o.id)} style={{ cursor: 'pointer', borderTop: '1px solid var(--line)' }}>
                      {entity.field !== 'network' && <td style={td}>{netLabel(o) ?? '—'}</td>}
                      <td style={{ ...td, ...clip(200) }} title={o.name}>{o.name}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{o.commission ?? '—'}{o.currency && o.currency !== 'USD' ? <span style={{ color: 'var(--fg-3)', fontSize: 10 }}> {o.currency}</span> : ''}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{o.cookie ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{o.epc ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{o.cvr ?? '—'}</td>
                      <td style={{ ...td, color: statusColor(o.status) }}>● {o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </Drawer>
  );
}
const miniBtn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' };
const th: React.CSSProperties = { padding: '5px 8px', fontWeight: 700, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '5px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

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
