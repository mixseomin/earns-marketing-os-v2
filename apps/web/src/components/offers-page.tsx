'use client';

import { Suspense, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getOfferNote, getOffer, saveOfferTerms, getEntityOffers,
  type AffiliateOffer, type OfferAccount, type OfferKind, type OfferFilters, type OffersView, type OfferTerms,
} from '@/lib/actions/offers';
import { useModalParam } from '@/lib/use-modal-param';
import {
  EmptyState, Drawer, ListToolbar, FilterChips, Pager, MultiSelect, EntityRef, StatusBadge, Pill,
  SearchInput,
  DataTable, TextField, TextAreaField, SelectField, type DataColumn, type DataGroup,
} from './ui';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { offerStatusMeta } from '@/lib/status-meta';

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
// Account label from the vault is "network · handle"; the Network column already carries the network →
// the Account chip shows only the handle/login (YDNI: no duplicated network).
const acctHandle = (label: string) => { const i = label.indexOf(' · '); return i >= 0 ? label.slice(i + 3) : label; };

// Status renders through the house <StatusBadge meta={offerStatusMeta(...)} /> (lib/status-meta.ts) —
// one drift-free source for the status→label→colour mapping, same as accounts/seeding/tools.
const statusMeta = (s: string) => offerStatusMeta(s.toLowerCase());

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
    || [filters.kind, filters.status, filters.gap, filters.recurring, filters.paid, filters.cash].some((v) => v && v !== 'all'));

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
  const inPage = modal.is('offer') ? rows.find((o) => o.id === modal.id) ?? null : null;
  // Deep-link / F5 to an offer that isn't on THIS server page → rows.find misses it. Fetch that one
  // offer by id (from the cached full list) so ANY ?m=offer link reopens, not just page-1 offers.
  const [fetched, setFetched] = useState<AffiliateOffer | null>(null);
  useEffect(() => {
    if (!modal.is('offer') || !modal.id || inPage) { setFetched(null); return; }
    let live = true;
    getOffer(modal.id).then((o) => { if (live) setFetched(o); }).catch(() => {});
    return () => { live = false; };
  }, [modal.id, modal.is('offer'), inPage]);
  const sel = inPage ?? fetched;
  // User note is kept out of the bulk list (Awin blob bloats every load) → fetch it lazily when
  // a specific offer's drawer opens. Key on sel?.id (not the object) so a parent refresh doesn't refetch.
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setNote(null);
    if (!sel?.id) return;
    let live = true;
    getOfferNote(sel.id).then((n) => { if (live) setNote(n); }).catch(() => {});
    return () => { live = false; };
  }, [sel?.id]);

  // Entity quick-view (brand / network / account) — SAME house url-state convention as the offer drawer
  // above, on a nested slot ('v'): ?v=brand|net|acct & vId=<brand|networkKey>. Shareable + survives F5.
  // brand → compare a merchant across networks; net → a network's offers; acct → an account's offers
  // (account ↔ network 1:1, so keyed by the network; the real account is derived from the loaded rows).
  const qv = useModalParam('v');
  const entityField: 'brand' | 'network' | null =
    qv.value === 'brand' ? 'brand' : (qv.value === 'net' || qv.value === 'acct') ? 'network' : null;
  const [entityRows, setEntityRows] = useState<AffiliateOffer[] | null>(null);
  useEffect(() => {
    setEntityRows(null);
    if (!entityField || !qv.id) return;
    let live = true;
    getEntityOffers(entityField, qv.id).then((r) => { if (live) setEntityRows(r); }).catch(() => {});
    return () => { live = false; };
  }, [entityField, qv.id]);
  const openEntity = (mode: 'brand' | 'net', value: string | null) =>
    (e: React.MouseEvent) => { e.stopPropagation(); if (value) qv.open(mode, value); };

  const columns: DataColumn<AffiliateOffer>[] = [
    {
      key: 'name', sortValue: (o) => o.name, align: 'left', width: '100%', header: 'Offer',
      cellTitle: (o) => o.name,
      cell: (o) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...clip(340) }}>
          <span style={{ fontWeight: 600, ...clip(300) }}>{o.name}</span>
          {o.selfReferral && <Pill color="var(--neon-amber)" tone="soft" size="xs" uppercase={false} mono={false} label="↻ tự giới thiệu" title="Chương trình giới thiệu của CHÍNH network — không phải offer merchant" />}
        </span>
      ),
    },
    {
      key: 'brand', sortValue: (o) => o.brand, align: 'left', header: 'Brand', title: 'Merchant gọn (bỏ hậu tố CPS/Network/geo) → click để so sánh mọi net trả bao nhiêu cho cùng brand',
      cellTitle: (o) => o.brand,
      cell: (o) => <span style={{ ...clickable, ...clip(150), display: 'inline-block', verticalAlign: 'bottom' }} onClick={openEntity('brand', o.brand)}>{o.brand}</span>,
    },
    {
      key: 'network', sortValue: (o) => netLabel(o), align: 'left', header: 'Network', title: 'Network cung cấp offer — click xem mọi offer của net này',
      cell: (o) => { const n = netLabel(o); return n ? <span style={clickable} onClick={openEntity('net', n)}>{n}</span> : <span style={dim}>—</span>; },
    },
    {
      key: 'account', sortValue: (o) => o.account ?? null, align: 'left', header: 'Account', title: 'Account (login) đã được duyệt — click xem mọi offer dưới account; trong drawer bấm "mở account đầy đủ" để xem identity/vault',
      cellTitle: (o) => o.account ?? undefined,
      // House <EntityRef> chip (same as environments) — kind=account so it reads as the real MOS2 account
      // entity. Tier 1: onOpen → the account's offers quick-view; Tier 2: a button in that drawer opens
      // the canonical account drawer for identity/vault. EntityRef handles stopPropagation itself.
      cell: (o) => (o.mosAccountId
        ? <EntityRef kind="account" id={o.mosAccountId} noIcon
            label={o.account ? acctHandle(o.account) : (o.network ?? `#${o.mosAccountId}`)}
            onOpen={() => { if (o.network) qv.open('acct', o.network); }} />
        : <span style={{ color: 'var(--neon-amber)' }}>chưa gán</span>),
    },
    {
      key: 'status', sortValue: (o) => o.status, align: 'left', header: 'Status',
      cell: (o) => <StatusBadge meta={statusMeta(o.status)} />,
    },
    {
      key: 'commission', sortValue: (o) => o.commission ?? null, group: 'terms', align: 'right', header: '%', title: 'Commission rate (nguyên văn net báo)',
      cell: (o) => o.commission ?? <span style={dim}>—</span>,
    },
    {
      key: 'payout', sortValue: (o) => o.payoutUsd, group: 'terms', align: 'right', header: '$ real',
      title: 'Tiền THẬT/lần chuyển đổi, quy USD (xấp xỉ) — chỉ offer trả CỐ ĐỊNH ($/CPA/CPL). Offer % để trống vì tiền = %×giá đơn, mà giá đơn net không cung cấp. Sort để xếp offer trả $ cao nhất.',
      cell: (o) => o.payoutUsd != null ? <span style={{ fontWeight: 600, color: 'var(--neon-lime)' }}>${o.payoutUsd}</span> : <span style={dim}>—</span>,
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
      // Đứng trước "Special rules": mua traffic thì câu hỏi đầu tiên là có được chạy ads không.
      key: 'ppc', sortValue: (o) => o.paidTraffic, group: 'rules', align: 'center', header: 'PPC',
      title: 'Merchant có cho chạy paid search không (cào từ program rules)',
      cell: (o) => o.paidTraffic === 'ban'
        ? <span title="Cấm PPC/paid search" style={{ color: 'var(--danger, #e05c5c)', fontWeight: 600 }}>⛔</span>
        : o.paidTraffic === 'ok'
          ? <span title="Program ghi rõ cho chạy paid search" style={{ color: 'var(--neon-lime)', fontWeight: 600 }}>✅</span>
          : <span title="Program không nêu rule PPC — không đồng nghĩa được phép" style={dim}>—</span>,
    },
    {
      // Payout alone oversells an offer. Net = payout × duyệt%, i.e. the money that survives the
      // advertiser's validation - a 25%-approval program at $100 is really a $25 program.
      key: 'net', sortValue: (o) => o.netPayoutUsd, group: 'terms', align: 'right', header: 'Net/conv',
      title: 'Payout × duyệt% = tiền thực nhận mỗi conversion (USD)',
      cell: (o) => o.netPayoutUsd == null
        ? <span style={dim}>—</span>
        : <span title={`payout $${o.payoutUsd} × duyệt ${o.approvalPct}%`}>${o.netPayoutUsd.toLocaleString()}</span>,
    },
    {
      key: 'approval', sortValue: (o) => o.approvalPct, group: 'terms', align: 'right', header: 'Duyệt%',
      title: 'Tỉ lệ conversion được advertiser duyệt. Thấp = mất doanh thu đã trả tiền ads',
      cell: (o) => o.approvalPct == null
        ? <span style={dim}>—</span>
        : <span style={{ color: o.approvalPct < 60 ? 'var(--danger, #e05c5c)' : undefined }}>{o.approvalPct}%</span>,
    },
    {
      // The axis that decides how hard we can scale: money out today, money back in N days.
      key: 'cash', sortValue: (o) => o.cashDays, group: 'terms', align: 'right', header: 'Tiền về',
      title: 'Số ngày từ conversion tới lúc nhận tiền (Awin averagePaymentTime, fallback hold)',
      cell: (o) => o.cashDays == null
        ? <span style={dim}>—</span>
        : <span style={{ color: o.cashDays > 90 ? 'var(--danger, #e05c5c)' : undefined }}>{o.cashDays}d</span>,
    },
    {
      key: 'aov', sortValue: (o) => o.aovUsd, group: 'terms', align: 'right', header: 'AOV',
      title: 'Giá trị đơn trung bình (USD) — suy từ EPC / (rate × CVR)',
      cell: (o) => o.aovUsd == null ? <span style={dim}>—</span> : <span>${o.aovUsd.toLocaleString()}</span>,
    },
    {
      key: 'track', sortValue: (o) => o.trackingCaps.join(','), group: 'rules', align: 'center', header: 'Track',
      title: 's2s = có postback (đẩy được conversion về Google/Meta) · dl = cho deep link',
      cell: (o) => o.trackingCaps.length
        ? <span title={`${o.trackingCaps.join(' + ')}${o.subidScheme ? ` · sub-id: ${o.subidScheme}` : ''}`}>
            {o.trackingCaps.includes('s2s') ? '🔁' : ''}{o.trackingCaps.includes('deeplink') ? '🔗' : ''}
          </span>
        : <span style={dim}>—</span>,
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
        ? <button type="button" onClick={() => go((p) => { for (const k of ['q', 'kind', 'status', 'account', 'vertical', 'geo', 'gap', 'recurring', 'paid', 'cash']) p.delete(k); })}
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
        {/* Media buy: cái đầu tiên phải biết là offer có CHO chạy quảng cáo trả tiền không. */}
        <FilterChips value={filters.paid} onChange={setOne('paid')} counts={counts}
          options={[
            { value: 'all', label: 'mọi rule' },
            { value: 'runnable', label: 'chạy ads được', title: 'Merchant KHÔNG cấm PPC (gồm cả offer không nêu rule)' },
            { value: 'paid-ok', label: 'PPC ghi rõ OK', title: 'Program nói thẳng là cho chạy paid search' },
            { value: 'paid-ban', label: '⛔ cấm PPC', title: 'Merchant cấm PPC/paid search — đừng mua traffic cho offer này' },
          ]} />
        {/* Trục dòng tiền: trả tiền ads hôm nay, tiền về sau bao lâu. Quyết định scale được tới đâu. */}
        <FilterChips value={filters.cash} onChange={setOne('cash')} counts={counts}
          options={[
            { value: 'all', label: 'mọi kỳ hạn' },
            { value: 'fast', label: 'tiền về <45d', title: 'Vòng vốn nhanh — scale được bằng tiền trả sau của Google/Meta' },
            { value: 'mid', label: '45-90d' },
            { value: 'slow', label: '>90d', title: 'Kẹt vốn lâu — payout đẹp mấy cũng chỉ chạy nhỏ' },
          ]} />
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
          <DataTable rows={rows} columns={columns} groups={GROUPS} persistKey="offer_cols" sliced
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
                <div style={{ marginTop: 6 }}><StatusBadge meta={statusMeta(sel.status)} /></div>
                {sel.selfReferral && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--neon-amber)' }}>
                    ↻ Đây là chương trình <b>giới thiệu của chính {netLabel(sel) ?? 'network'}</b> (refer-a-friend), không phải offer merchant. Vẫn kiếm tiền được nhưng khác bản chất offer thường.
                  </div>
                )}
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

            {/* Rules the network dictates (read-only; commission/cookie/policy/reward are edited in the form
                above). Only rendered when the sync captured them. */}
            {(sel.payoutThreshold || sel.payoutMethods || sel.trafficSources.length > 0 || sel.policy || sel.reward) && (
              <div>
                <div style={sectionLabel}>Rules &amp; payout</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sel.policy && <Field label="Promotion policy" value={sel.policy} />}
                  {sel.reward && <Field label="Reward detail" value={sel.reward} />}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                    {sel.payoutThreshold && <Field label="Payout threshold" value={sel.payoutThreshold} />}
                    {sel.payoutMethods && <Field label="Payout methods" value={sel.payoutMethods} />}
                    {sel.trafficSources.length > 0 && <Field label="Traffic sources" value={sel.trafficSources.join(', ')} />}
                  </div>
                </div>
              </div>
            )}

            {/* Support / media — supporting links the sync has, plus where to grab creatives (the network
                panel). Actual banner/creative IMAGES aren't synced into the DB → we point at the panel. */}
            <div>
              <div style={sectionLabel}>Support / media</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {sel.promoteUrl && <a href={sel.promoteUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--neon-cyan)' }}>↗ Creative / landing</a>}
                {sel.panelUrl && <a href={sel.panelUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-2)' }}>↗ Offer trên network</a>}
                {sel.previewUrl && <a href={sel.previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-3)' }}>↗ Preview</a>}
                {netLabel(sel) && NETWORK_HOME[netLabel(sel)!] && <a href={NETWORK_HOME[netLabel(sel)!]} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-3)' }}>↗ Panel {netLabel(sel)}</a>}
              </div>
              <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--fg-4)' }}>Ảnh creative/banner chưa sync về đây — lấy trực tiếp ở panel network qua link trên.</div>
            </div>

            {sel.affiliateUrl && (
              <div>
                <div style={sectionLabel}>Tracking link</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input readOnly value={sel.affiliateUrl} style={{ flex: 1, minWidth: 0, padding: '5px 9px', fontSize: 12, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-1)', outline: 'none' }} onFocus={(e) => e.currentTarget.select()} />
                  <button style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--neon-cyan)', color: '#0b0f14', fontWeight: 700 }}
                    onClick={() => navigator.clipboard?.writeText(sel.affiliateUrl ?? '')}>Copy</button>
                </div>
                <a href={sel.affiliateUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: 'var(--neon-cyan)' }}>↗ Mở link</a>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {entityField && qv.id && (
        <EntityDrawer mode={qv.value as 'brand' | 'net' | 'acct'} value={qv.id} rows={entityRows}
          onClose={() => qv.close()}
          onOpenOffer={(id) => { qv.close(); modal.open('offer', id); }}
          onFilterBrand={qv.value === 'brand' ? () => { const v = qv.id!; qv.close(); setQ(v); } : undefined} />
      )}
    </div>
  );
}

// Quick-view drawer for a clicked entity (brand / network / account). Its whole point is the
// comparison table: the SAME brand across networks, so you see who pays most at a glance.
function EntityDrawer({ mode, value, rows, onClose, onOpenOffer, onFilterBrand }: {
  mode: 'brand' | 'net' | 'acct';
  value: string;               // brand name (brand) or network key (net/acct)
  rows: AffiliateOffer[] | null;
  onClose: () => void;
  onOpenOffer: (id: string) => void;
  onFilterBrand?: () => void;
}) {
  const field: 'brand' | 'network' = mode === 'brand' ? 'brand' : 'network';
  const isAccount = mode === 'acct';
  const kindWord = mode === 'brand' ? 'Brand' : isAccount ? 'Account' : 'Network';
  // Account view: the real account (numeric id + handle) is derived from the loaded rows (account ↔
  // network 1:1) — the URL only carries the network key, so identity/label reconstruct from the data.
  const acctRow = isAccount && rows ? rows.find((r) => r.mosAccountId != null) : null;
  const label = isAccount ? (acctRow?.account ? acctHandle(acctRow.account) : value) : value;
  const onOpenAccount = isAccount && acctRow?.mosAccountId != null ? () => openEntityDrawer('account', acctRow.mosAccountId!) : undefined;
  const nets = rows ? new Set(rows.map((r) => netLabel(r)).filter(Boolean)).size : 0;
  const home = field === 'network' ? NETWORK_HOME[value] : undefined;
  // Same house <DataTable> primitive as the main list (not a second hand-rolled <table>). Network column
  // dropped when the whole view is one network. Status via the same <StatusBadge> → no drift.
  const quickCols: DataColumn<AffiliateOffer>[] = ([
    { key: 'net', header: 'Network', align: 'left', sortValue: (o) => netLabel(o), cell: (o) => netLabel(o) ?? <span style={dim}>—</span> },
    { key: 'name', header: 'Offer', align: 'left', width: '100%', cellTitle: (o) => o.name, sortValue: (o) => o.name, cell: (o) => <span style={clip(220) as React.CSSProperties}>{o.name}</span> },
    { key: 'commission', header: '%', align: 'right', sortValue: (o) => o.commission ?? null, cell: (o) => o.commission ?? <span style={dim}>—</span> },
    { key: 'payout', header: '$ real', align: 'right', sortValue: (o) => o.payoutUsd, cell: (o) => o.payoutUsd != null ? <span style={{ fontWeight: 600, color: 'var(--neon-lime)' }}>${o.payoutUsd}</span> : <span style={dim}>—</span> },
    { key: 'cookie', header: 'Cookie', align: 'right', cell: (o) => o.cookie ?? <span style={dim}>—</span> },
    { key: 'epc', header: 'EPC', align: 'right', sortValue: (o) => (o.epc ? parseFloat(o.epc) : null), cell: (o) => o.epc ?? <span style={dim}>—</span> },
    { key: 'cvr', header: 'CVR', align: 'right', cell: (o) => o.cvr ?? <span style={dim}>—</span> },
    { key: 'status', header: 'Status', align: 'left', sortValue: (o) => o.status, cell: (o) => <StatusBadge meta={statusMeta(o.status)} /> },
  ] as DataColumn<AffiliateOffer>[]).filter((c) => c.key !== 'net' || field !== 'network');
  // Lọc ở ngoài (ô tìm riêng của drawer) rồi đưa ĐỦ dòng đã lọc vào bảng; bảng tự cắt trang 50.
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !rows) return rows ?? [];
    return rows.filter((o) => [o.name, o.brand, o.network, o.commission, o.vertical].some((v) => v?.toLowerCase().includes(s)));
  }, [rows, q]);
  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{kindWord.toUpperCase()}</div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{label}</h2>
          {rows && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {q.trim() ? `${filtered.length}/${rows.length}` : rows.length} offer{mode === 'brand' && nets > 1 ? ` · ${nets} networks` : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {onOpenAccount && <button type="button" onClick={onOpenAccount} style={{ ...miniBtn, borderColor: 'var(--neon-lime)', color: 'var(--neon-lime)' }}>↗ mở account đầy đủ</button>}
            {onFilterBrand && <button type="button" onClick={onFilterBrand} style={miniBtn}>⌕ lọc bảng theo brand này</button>}
            {home && <a href={home} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none' }}>↗ dashboard</a>}
          </div>
        </div>

        {!rows ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Đang tải…</div>
          : rows.length === 0 ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Không có offer.</div>
          : (
            <>
              <SearchInput value={q} onChange={setQ} placeholder="Tìm trong offers (tên/brand/net/%)…" width={280} />
              {filtered.length === 0
                ? <div style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 10 }}>Không khớp “{q}”.</div>
                : <div style={{ marginTop: 10 }}><DataTable rows={filtered} columns={quickCols} getRowKey={(o) => o.id} onRowClick={(o) => onOpenOffer(o.id)} minWidth={560} pageSize={50} /></div>}
            </>
          )}
      </div>
    </Drawer>
  );
}
const miniBtn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' };

// Deal terms the network never sends (Awin/CJ sync writes other columns only → safe to edit here).
// account_id IS written by the Awin sync, but only for its own rows — editing a direct offer's
// account is safe; re-picking an Awin row's account just gets reset on the next nightly sync.
function TermsForm({ offer, accounts }: { offer: AffiliateOffer; accounts: OfferAccount[] }) {
  const router = useRouter();
  const [t, setT] = useState<OfferTerms>({
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
