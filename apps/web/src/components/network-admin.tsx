'use client';

// Backend admin của network — 5 tab trong MỘT trang, không phải nhớ URL nào để đi đâu cả.
// Thứ tự tab theo thứ tự việc: xem tổng → dựng chiến dịch → quản người → duyệt & đặt giá → soi đơn.

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Offer, Publisher, Registration, UserOption, CatalogOffer } from '@/lib/network/data';
import type { NetworkReport } from '@/lib/network/report';
import type { RevenueDayRow } from '@/lib/revenue/by-day';
import { RevenueCalendar } from './revenue-calendar';
import { RevenueRange } from './revenue-range';
import { SETTLE_LABEL, SETTLE_COLOR } from '@/lib/network/status';
import { SUB_PARAM } from '@/lib/network/link';
import { readShallowParam, writeShallowParam } from '@/lib/url-shallow';
import {
  saveOffer, toggleOffer, deleteOffer, savePublisher, deletePublisher,
  decideRegistration, setRegistrationRate, grantOffer, type OfferInput, type PublisherInput,
} from '@/lib/actions/network';
import {
  Tabs, Section, SimpleTable, DataTable, StatsStrip, EmptyState, Pill, MultiSelect, Segmented,
  FormModal, FormModalFooter, TextField, SelectField, TextAreaField, ConfirmDeleteButton,
  type SimpleColumn, type DataColumn, type StatCard, type TabItem,
} from './ui';

const usd = (n: number) => (n >= 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const mono = { fontFamily: 'var(--font-mono)', fontSize: 11 } as const;
const dim = { color: 'var(--fg-3)' };

type Tab = 'tong-quan' | 'chien-dich' | 'danh-muc' | 'publisher' | 'duyet' | 'don-hang';
const TABS: Tab[] = ['tong-quan', 'chien-dich', 'danh-muc', 'publisher', 'duyet', 'don-hang'];

/** Chỉ network CÓ ô sub-id mới dựng được chiến dịch — không có ô thì click đi ra là mất dấu. */
const TRACKABLE = Object.entries(SUB_PARAM).filter(([, v]) => v !== null).map(([k]) => k);

const REG_LABEL: Record<string, string> = { approved: 'đang chạy', pending: 'chờ duyệt', rejected: 'từ chối' };
const REG_COLOR: Record<string, string> = { approved: 'var(--ok)', pending: 'var(--warn)', rejected: 'var(--fg-3)' };

export function NetworkAdmin({ offers, publishers, registrations, report, origin, users, catalog, days }: {
  offers: Offer[]; publishers: Publisher[]; registrations: Registration[];
  report: NetworkReport; origin: string; users: UserOption[];
  catalog: CatalogOffer[]; days: number;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [tab, setTab] = useState<Tab>('tong-quan');
  const [editOffer, setEditOffer] = useState<Offer | 'new' | { fromCatalog: CatalogOffer } | null>(null);
  const [editPub, setEditPub] = useState<Publisher | 'new' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Tab nằm trong URL để F5 / gửi link cho người khác vẫn về đúng chỗ — nhưng ghi NÔNG, không
  // router.replace: replace kích server render lại cả trang (gọi lại API CJ) chỉ để đổi tab.
  useEffect(() => {
    const t = readShallowParam('tab') as Tab | null;
    if (t && TABS.includes(t)) setTab(t);
  }, []);
  useEffect(() => { writeShallowParam('tab', tab === 'tong-quan' ? null : tab); }, [tab]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setErr(r.ok ? null : r.error ?? 'lỗi không rõ');
      if (r.ok) { setEditOffer(null); setEditPub(null); router.refresh(); }
    });

  const pending = registrations.filter((r) => r.status === 'pending');
  const items: TabItem<Tab>[] = [
    { key: 'tong-quan', label: 'Tổng quan' },
    { key: 'chien-dich', label: 'Chiến dịch', badge: String(offers.length) },
    { key: 'danh-muc', label: 'Danh mục offer', badge: String(catalog.length),
      title: 'Toàn bộ offer affiliate trong MOS2 — chọn một cái để dựng thành chiến dịch' },
    { key: 'publisher', label: 'Publisher', badge: String(publishers.length) },
    { key: 'duyet', label: 'Duyệt & giá', badge: pending.length ? String(pending.length) : undefined,
      title: 'Duyệt đăng ký + đặt giá riêng cho từng publisher' },
    { key: 'don-hang', label: 'Đơn hàng', badge: String(report.conversions.length) },
  ];

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">🕸 Network · admin<small>// backend</small></h1>
          <p className="page-sub">
            Publisher chạy link <code>{origin}/c/&lt;chiến-dịch&gt;?p=&lt;publisher&gt;</code>. Mã click nhét vào ô
            sub-id của network upstream; đơn về thì nối ngược ra publisher.
          </p>
        </div>
        <RevenueRange value={days} />
      </div>

      <Tabs items={items} value={tab} onChange={setTab} />

      {err && (
        <div style={{ margin: '0 0 10px', padding: '6px 10px', fontSize: 12, color: 'var(--warn)',
                      border: '1px solid var(--warn)', borderRadius: 4 }}>
          {err}
        </div>
      )}

      {tab === 'tong-quan' && <Overview offers={offers} publishers={publishers} report={report} days={days} />}

      {tab === 'chien-dich' && (
        <OfferTab offers={offers} origin={origin} busy={busy}
          onNew={() => setEditOffer('new')} onEdit={setEditOffer}
          onToggle={(o) => run(() => toggleOffer(o.id, !o.active))}
          onDelete={(o) => run(() => deleteOffer(o.id))} />
      )}

      {tab === 'danh-muc' && (
        <CatalogTab catalog={catalog} offers={offers} busy={busy}
          onBuild={(c) => setEditOffer({ fromCatalog: c })} />
      )}

      {tab === 'publisher' && (
        <PublisherTab publishers={publishers} users={users} report={report} busy={busy}
          onNew={() => setEditPub('new')} onEdit={setEditPub}
          onDelete={(p) => run(() => deletePublisher(p.id))} />
      )}

      {tab === 'duyet' && (
        <RegTab registrations={registrations} offers={offers} publishers={publishers} busy={busy}
          onDecide={(id, ok) => run(() => decideRegistration(id, ok))}
          onRate={(id, rate) => run(() => setRegistrationRate(id, rate))}
          onGrant={(p, o) => run(() => grantOffer(p, o))} />
      )}

      {tab === 'don-hang' && <OrderTab report={report} offers={offers} />}

      {editOffer && (
        <OfferForm
          offer={editOffer === 'new' || 'fromCatalog' in (editOffer as object) ? null : editOffer as Offer}
          seed={typeof editOffer === 'object' && editOffer && 'fromCatalog' in editOffer ? editOffer.fromCatalog : null}
          busy={busy} catalog={catalog}
          onClose={() => setEditOffer(null)} onSave={(v) => run(() => saveOffer(v))} />
      )}
      {editPub && (
        <PublisherForm pub={editPub === 'new' ? null : editPub} users={users} busy={busy}
          onClose={() => setEditPub(null)} onSave={(v) => run(() => savePublisher(v))} />
      )}
    </div>
  );
}

// ── Tổng quan ────────────────────────────────────────────────────────────────
/** Đơn của network → dòng doanh thu theo ngày, để dùng LẠI đúng cái lịch của /revenue thay vì vẽ
 *  một cái biểu đồ thứ hai nói cùng chuyện mà trông khác. group = publisher nên bộ lọc "bóc tách"
 *  của lịch tự thành bộ lọc theo publisher, không phải viết thêm gì. */
function toRevenueRows(report: NetworkReport): RevenueDayRow[] {
  return report.conversions.map((c) => ({
    date: c.date, source: 'affiliate' as const,
    group: c.publisher ?? 'chưa nối được',
    channel: c.advertiser,
    sub: c.utm.join(' · ') || undefined,
    amount: c.commission, gross: c.gross,
  }));
}

function Overview({ offers, publishers, report, days }: {
  offers: Offer[]; publishers: Publisher[]; report: NetworkReport; days: number;
}) {
  const clicks = report.pubs.reduce((t, p) => t + p.clicks, 0);
  const approved = report.pubs.reduce((t, p) => t + p.approved, 0);
  const holding = report.pubs.reduce((t, p) => t + p.holding, 0);
  const rows = useMemo(() => toRevenueRows(report), [report]);
  const cards: StatCard[] = [
    { key: 'pub', label: 'Publisher', value: String(publishers.filter((p) => p.status === 'active').length) },
    { key: 'off', label: 'Chiến dịch chạy', value: String(offers.filter((o) => o.active).length) },
    { key: 'clk', label: 'Click', value: String(clicks), color: 'var(--neon-cyan)' },
    { key: 'ord', label: 'Đơn', value: String(report.conversions.length) },
    { key: 'cr', label: 'CR', value: clicks ? `${((report.conversions.length / clicks) * 100).toFixed(1)}%` : '—',
      color: 'var(--neon-violet)', title: 'Đơn / click' },
    { key: 'epc', label: '$/click', value: clicks ? usd((approved + holding) / clicks) : '—',
      color: 'var(--neon-cyan)', title: 'Hoa hồng chia số click — so thẳng với giá thầu quảng cáo' },
    { key: 'ok', label: 'Được duyệt', value: usd(approved), color: 'var(--ok)',
      title: 'Đã đối soát xong — con số duy nhất dùng để trả tiền publisher' },
    { key: 'hold', label: 'Tạm duyệt', value: usd(holding), color: 'var(--warn)',
      title: 'Nhà cung cấp đã xác nhận nhưng chưa đối soát — còn đổi được' },
  ];
  const cols: SimpleColumn<NetworkReport['pubs'][number]>[] = [
    { key: 'p', header: 'Publisher', cell: (r) => <span style={{ color: 'var(--fg-0)' }}>{r.publisherName} <span style={{ ...mono, ...dim }}>{r.publisher}</span></span> },
    { key: 'c', header: 'Click', align: 'right', cell: (r) => <span style={mono}>{r.clicks}</span> },
    { key: 'o', header: 'Đơn', align: 'right', cell: (r) => <span style={mono}>{r.orders}</span> },
    { key: 'cr', header: 'CR', align: 'right', cell: (r) => <span style={{ ...mono, ...(r.clicks ? {} : dim) }}>{r.clicks ? `${((r.orders / r.clicks) * 100).toFixed(1)}%` : '—'}</span> },
    { key: 'epc', header: '$/click', align: 'right', title: 'Hoa hồng (đã duyệt + tạm duyệt) chia số click',
      cell: (r) => <span style={{ ...mono, ...(r.clicks ? {} : dim) }}>{r.clicks ? usd((r.approved + r.holding) / r.clicks) : '—'}</span> },
    { key: 'a', header: 'Được duyệt', align: 'right', cell: (r) => <span style={{ ...mono, color: r.approved ? 'var(--ok)' : 'var(--fg-3)' }}>{usd(r.approved)}</span> },
    { key: 'h', header: 'Tạm duyệt', align: 'right', cell: (r) => <span style={{ ...mono, color: r.holding ? 'var(--warn)' : 'var(--fg-3)' }}>{usd(r.holding)}</span> },
    { key: 'w', header: 'Chờ duyệt', align: 'right', cell: (r) => <span style={{ ...mono, ...dim }}>{usd(r.pending)}</span> },
  ];
  return (
    <>
      <StatsStrip cards={cards} />
      {report.errors.length > 0 && <div style={{ margin: '8px 0', fontSize: 11, color: 'var(--warn)' }}>{report.errors.join(' · ')}</div>}
      <Section title="Lịch hoa hồng" subtitle={`${days > 0 ? `${days} ngày gần nhất` : 'toàn bộ'} · bóc tách theo publisher`} defaultOpen>
        <RevenueCalendar rows={rows} errors={report.errors} scannedNetworks={['cj']} />
      </Section>
      <Section title="Theo publisher" defaultOpen>
        {report.pubs.length === 0
          ? <EmptyState icon="👥" compact title="Chưa có publisher nào" />
          : <SimpleTable rows={report.pubs} columns={cols} getRowKey={(r) => r.publisher} />}
      </Section>
    </>
  );
}

// ── Chiến dịch ───────────────────────────────────────────────────────────────
function OfferTab({ offers, origin, busy, onNew, onEdit, onToggle, onDelete }: {
  offers: Offer[]; origin: string; busy: boolean;
  onNew: () => void; onEdit: (o: Offer) => void; onToggle: (o: Offer) => void; onDelete: (o: Offer) => void;
}) {
  const cols: SimpleColumn<Offer>[] = [
    { key: 'n', header: 'Chiến dịch', cell: (o) => (
      <span>
        <span style={{ color: 'var(--fg-0)' }}>{o.name}</span> <span style={{ ...mono, ...dim }}>{o.slug}</span>
        {o.advertiser && <div style={{ ...dim, fontSize: 11 }}>{o.advertiser}</div>}
      </span>
    ) },
    { key: 'net', header: 'Network', cell: (o) => <span style={mono}>{o.network}</span> },
    { key: 'cat', header: 'Ngành', cell: (o) => <span style={dim}>{o.category ?? '—'}</span> },
    { key: 'up', header: 'Upstream trả mình', cell: (o) => <span style={mono}>{o.upstreamRate ?? '—'}</span> },
    { key: 'pr', header: 'Mình trả pub', cell: (o) => <span style={{ ...mono, ...(o.publisherRate ? {} : dim) }}>{o.publisherRate ?? 'chưa đặt'}</span> },
    { key: 'c', header: 'Click', align: 'right', cell: (o) => <span style={mono}>{o.clicks}</span> },
    { key: 'st', header: 'Bật/tắt', cell: (o) => (
      <Segmented<string>
        value={o.active ? 'on' : 'off'}
        onChange={() => onToggle(o)}
        options={[
          { value: 'on', label: 'Bật', title: 'Link đang nhận click' },
          { value: 'off', label: 'Tắt', title: 'Link trả 404 ngay, lịch sử giữ nguyên' },
        ]}
      />
    ) },
    { key: 'a', header: '', align: 'right', cell: (o) => (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <button type="button" disabled={busy} onClick={() => onEdit(o)} style={btn('var(--accent)')}>Sửa</button>
        <ConfirmDeleteButton onDelete={async () => onDelete(o)} disabled={busy}
          labelIdle="Xoá" labelArmed="⚠ Bấm lần nữa" className="" style={btn('var(--danger)')}
          title="Xoá chiến dịch / Bấm lần nữa để xoá" />
      </span>
    ) },
  ];
  return (
    <Section title="Chiến dịch" defaultOpen
      subtitle={`link gốc: ${origin}/c/<slug>?p=<publisher>`}
      headerRight={<button type="button" onClick={onNew} style={btn('var(--accent)')}>+ Chiến dịch mới</button>}>
      {offers.length === 0
        ? <EmptyState icon="📦" compact title="Chưa có chiến dịch nào" description="Bấm “Chiến dịch mới” để thêm link upstream đầu tiên." />
        : <SimpleTable rows={offers} columns={cols} getRowKey={(o) => o.slug} />}
    </Section>
  );
}

/** slug đề xuất từ tên: bỏ dấu, đ→d, gom ký tự lạ thành gạch. Vẫn sửa được trước khi lưu vì nó
 *  nằm trong link phát ra ngoài. */
function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function OfferForm({ offer, seed, busy, catalog, onClose, onSave }: {
  offer: Offer | null;
  /** Dòng danh mục MOS2 bấm 'Dựng chiến dịch' — điền sẵn form ngay lúc mở, khỏi phải chọn lại. */
  seed: CatalogOffer | null;
  busy: boolean; catalog: CatalogOffer[];
  onClose: () => void; onSave: (v: OfferInput) => void;
}) {
  const [pick, setPick] = useState<string[]>([]);
  const [v, setV] = useState<OfferInput>({
    id: offer?.id,
    slug: offer?.slug ?? (seed ? slugify(seed.name) : ''),
    name: offer?.name ?? seed?.name ?? '',
    // Network của danh mục chỉ dùng khi nó THEO DÕI ĐƯỢC; không thì để cj và admin tự đổi.
    network: offer?.network ?? (seed?.trackable ? seed.network : 'cj'),
    advertiser: offer?.advertiser ?? seed?.advertiser ?? '',
    category: offer?.category ?? seed?.vertical ?? '',
    upstreamUrl: offer?.upstreamUrl ?? seed?.url ?? '',
    upstreamRate: offer?.upstreamRate ?? seed?.rate ?? '',
    publisherRate: offer?.publisherRate ?? '',
    terms: offer?.terms ?? '', active: offer?.active ?? true,
  });
  const set = <K extends keyof OfferInput>(k: K, val: OfferInput[K]) => setV((s) => ({ ...s, [k]: val }));
  // `dirty` phải là ĐANG-SỬA-THẬT, không phải hằng số true. Đặt cứng thì mỗi lần bấm ra ngoài
  // hoặc Esc đều bị hỏi "bỏ thay đổi?" dù chưa gõ gì — drawer thành ra không đóng nổi.
  const [initial] = useState(() => JSON.stringify(v));
  const dirty = JSON.stringify(v) !== initial;

  // Lấy sẵn từ danh mục affiliate của MOS2 thay vì gõ lại tên/link/tỉ lệ. Danh mục chỉ chứa dòng
  // CÓ link và thuộc network có ô sub-id (lọc ở listCatalog) nên chọn phát nào cũng chạy được.
  const apply = (id: string) => {
    const c = catalog.find((x) => x.id === id);
    if (!c) return;
    setV((s) => ({
      ...s,
      name: s.name || c.name,
      // slug tự đề xuất từ tên; vẫn sửa được trước khi lưu vì nó nằm trong link phát ra ngoài.
      slug: s.slug || slugify(c.name),
      // Network của danh mục chỉ đè khi nó THEO DÕI ĐƯỢC; không thì giữ nguyên lựa chọn hiện tại
      // để admin tự chọn — đè bằng một network không có ô sub-id là đẩy họ vào lỗi lúc bấm Lưu.
      network: c.trackable ? c.network : s.network,
      advertiser: s.advertiser || c.advertiser,
      category: s.category || c.vertical || '',
      upstreamUrl: c.url,
      upstreamRate: s.upstreamRate || c.rate || '',
    }));
  };

  return (
    <FormModal kind="generic" action={offer ? 'edit' : 'create'} width="md" dirty={dirty}
      title={offer ? `Sửa · ${offer.name}` : seed ? `Dựng từ danh mục · ${seed.name}` : 'Chiến dịch mới'}
      onClose={onClose}>
      <div style={{ padding: 16, display: 'grid', gap: 10, overflowY: 'auto' }}>
        {!offer && catalog.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                        padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              Lấy từ danh mục MOS2 ({catalog.length}) — dấu ⚠ nghĩa là danh mục không có network theo dõi được, tự chọn ở ô Network bên dưới:
            </span>
            <MultiSelect<string> label="Chọn offer" compact selected={pick}
              onChange={(x) => { const last = x.slice(-1); setPick(last); if (last[0]) apply(last[0]); }}
              options={catalog.map((c) => ({
                value: c.id,
                // ⚠ = danh mục không nói được network theo dõi được → phải tự chọn ở ô Network.
                label: `${c.trackable ? '' : '⚠ '}${c.name}${c.network ? ` · ${c.network}` : ''}${c.rate ? ` · ${c.rate}` : ''}`,
              }))} />
          </div>
        )}
        <TextField label="Tên chiến dịch" required value={v.name} onChange={(e) => set('name', e.target.value)} />
        <TextField label="Slug" required mono value={v.slug} onChange={(e) => set('slug', e.target.value)}
          hint="Nằm trong link publisher đã dán ra ngoài — đổi sau là gãy mọi link đang chạy."
          disabled={!!offer} lockReason={offer ? 'Link đã phát ra ngoài mang slug này' : undefined} />
        <SelectField label="Network" required value={v.network} onChange={(e) => set('network', e.target.value)}
          hint="Chỉ liệt kê network có ô sub-id — không có ô thì click đi ra là mất dấu.">
          {TRACKABLE.map((k) => <option key={k} value={k}>{k} · ô {SUB_PARAM[k]}</option>)}
        </SelectField>
        <TextField label="Link upstream" required mono value={v.upstreamUrl} onChange={(e) => set('upstreamUrl', e.target.value)}
          hint="Link gốc từ network, CHƯA có tham số sub-id — hệ tự gắn mã click vào." />
        <TextField label="Advertiser" value={v.advertiser} onChange={(e) => set('advertiser', e.target.value)} />
        <TextField label="Ngành" value={v.category} onChange={(e) => set('category', e.target.value)} />
        <TextField label="Upstream trả mình" mono value={v.upstreamRate} onChange={(e) => set('upstreamRate', e.target.value)}
          hint='Viết tự do: "8%", "$12 CPA", "20-62.25%".' />
        <TextField label="Mình trả publisher" mono value={v.publisherRate} onChange={(e) => set('publisherRate', e.target.value)}
          hint="Mức chung. Đặt riêng cho từng publisher ở tab Duyệt &amp; giá." />
        <TextAreaField label="Điều kiện ghi nhận" rows={3} value={v.terms} onChange={(e) => set('terms', e.target.value)}
          hint="Publisher đọc cái này trước khi xin chạy." />
        <SelectField label="Bật/tắt" value={v.active ? 'on' : 'off'} onChange={(e) => set('active', e.target.value === 'on')}>
          <option value="on">Bật — đang nhận click</option>
          <option value="off">Tắt — link trả 404</option>
        </SelectField>
      </div>
      <FormModalFooter>
        <button type="button" onClick={onClose} style={btn('var(--fg-3)')}>Huỷ</button>
        <button type="button" disabled={busy} onClick={() => onSave(v)} style={btn('var(--ok)')}>
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

// ── Danh mục offer (MOS2) ────────────────────────────────────────────────────
// Toàn bộ offer affiliate đang có trong MOS2. Dùng <DataTable> chứ không SimpleTable: gần 3.000
// dòng thì phải có ô tìm + lọc theo cột + cắt trang, mà DataTable lo sẵn cả ba.
function CatalogTab({ catalog, offers, busy, onBuild }: {
  catalog: CatalogOffer[]; offers: Offer[]; busy: boolean; onBuild: (c: CatalogOffer) => void;
}) {
  // Offer đã dựng thành chiến dịch rồi thì đánh dấu, đừng để dựng trùng — trùng slug sẽ bị chặn ở
  // server nhưng lúc đó người ta đã điền xong cả form.
  const built = useMemo(() => new Set(offers.map((o) => o.upstreamUrl)), [offers]);
  const cols: DataColumn<CatalogOffer>[] = [
    { key: 'name', header: 'Offer', align: 'left', width: 320, sortValue: (c) => c.name,
      cell: (c) => (
        <span>
          <span style={{ color: 'var(--fg-0)' }}>{c.name}</span>
          {built.has(c.url) && <Pill label="đã dựng" color="var(--ok)" size="xs" tone="soft" />}
        </span>
      ) },
    { key: 'net', header: 'Network', align: 'left', sortValue: (c) => c.network || 'zz',
      cell: (c) => c.trackable
        ? <span style={mono}>{c.network}</span>
        : <Pill label={c.network || 'chưa rõ'} color="var(--warn)" size="xs" tone="soft"
            title="Network này không có ô sub-id (hoặc danh mục bỏ trống) — dựng chiến dịch thì phải tự chọn network theo dõi được" /> },
    { key: 'cat', header: 'Ngành', align: 'left', sortValue: (c) => c.vertical ?? '',
      cell: (c) => <span style={dim}>{c.vertical ?? '—'}</span> },
    { key: 'rate', header: 'Hoa hồng', align: 'left', sortValue: (c) => c.rate ?? '',
      cell: (c) => <span style={mono}>{c.rate ?? '—'}</span> },
    { key: 'url', header: 'Link', align: 'left', width: 260,
      cell: (c) => <a href={c.url} target="_blank" rel="noopener noreferrer"
        style={{ ...mono, ...dim, textDecoration: 'none', display: 'block', overflow: 'hidden',
                 textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 250 }}>{c.url}</a> },
    { key: 'act', header: '', align: 'right',
      cell: (c) => (
        <button type="button" disabled={busy} onClick={() => onBuild(c)} style={btn('var(--accent)')}>
          Dựng chiến dịch
        </button>
      ) },
  ];
  return (
    <Section title="Danh mục offer · MOS2" defaultOpen
      subtitle="mọi offer affiliate đang có trong MOS2 — bấm “Dựng chiến dịch” để biến một dòng thành chiến dịch của network">
      {catalog.length === 0 ? (
        <EmptyState icon="📚" compact title="Danh mục rỗng"
          description="Chỉ những offer CÓ affiliate_url mới vào đây — offer thiếu link thì dựng ra cũng không redirect đi đâu." />
      ) : (
        <DataTable rows={catalog} columns={cols} getRowKey={(c) => c.id}
          persistKey="net-catalog" pageSize={50} minWidth={1000}
          searchPlaceholder="Tìm theo tên offer…" />
      )}
    </Section>
  );
}

// ── Publisher ────────────────────────────────────────────────────────────────
function PublisherTab({ publishers, users, report, busy, onNew, onEdit, onDelete }: {
  publishers: Publisher[]; users: UserOption[]; report: NetworkReport; busy: boolean;
  onNew: () => void; onEdit: (p: Publisher) => void; onDelete: (p: Publisher) => void;
}) {
  const stat = new Map(report.pubs.map((p) => [p.publisher, p]));
  const cols: SimpleColumn<Publisher>[] = [
    { key: 'n', header: 'Publisher', cell: (p) => <span><span style={{ color: 'var(--fg-0)' }}>{p.name}</span> <span style={{ ...mono, ...dim }}>{p.slug}</span></span> },
    { key: 'k', header: 'Loại', cell: (p) => <span style={dim}>{p.kind}</span> },
    { key: 's', header: 'Trạng thái', cell: (p) => (
      <Pill label={p.status} size="xs" tone="soft"
        color={p.status === 'active' ? 'var(--ok)' : p.status === 'banned' ? 'var(--danger)' : 'var(--warn)'} />
    ) },
    { key: 'u', header: 'User đăng nhập', cell: (p) => (
      <span style={{ ...mono, ...(p.userId ? {} : dim) }}>
        {users.find((u) => u.id === p.userId)?.email ?? 'chưa gán'}
      </span>
    ) },
    { key: 'c', header: 'Click', align: 'right', cell: (p) => <span style={mono}>{stat.get(p.slug)?.clicks ?? 0}</span> },
    { key: 'a', header: 'Được duyệt', align: 'right', cell: (p) => <span style={{ ...mono, color: 'var(--ok)' }}>{usd(stat.get(p.slug)?.approved ?? 0)}</span> },
    { key: 'x', header: '', align: 'right', cell: (p) => (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <button type="button" disabled={busy} onClick={() => onEdit(p)} style={btn('var(--accent)')}>Sửa</button>
        <ConfirmDeleteButton onDelete={async () => onDelete(p)} disabled={busy}
          labelIdle="Xoá" labelArmed="⚠ Bấm lần nữa" className="" style={btn('var(--danger)')}
          title="Xoá publisher / Bấm lần nữa để xoá" />
      </span>
    ) },
  ];
  return (
    <Section title="Publisher" defaultOpen
      subtitle="có click rồi thì chuyển paused/banned, đừng xoá — xoá là click thành vô chủ"
      headerRight={<button type="button" onClick={onNew} style={btn('var(--accent)')}>+ Publisher mới</button>}>
      {publishers.length === 0
        ? <EmptyState icon="👥" compact title="Chưa có publisher nào" />
        : <SimpleTable rows={publishers} columns={cols} getRowKey={(p) => p.slug} />}
    </Section>
  );
}

function PublisherForm({ pub, users, busy, onClose, onSave }: {
  pub: Publisher | null; users: UserOption[]; busy: boolean; onClose: () => void; onSave: (v: PublisherInput) => void;
}) {
  const [v, setV] = useState<PublisherInput>({
    id: pub?.id, slug: pub?.slug ?? '', name: pub?.name ?? '',
    kind: pub?.kind ?? 'inhouse', status: pub?.status ?? 'active',
    note: pub?.note ?? '', userId: pub?.userId ?? null,
  });
  const set = <K extends keyof PublisherInput>(k: K, val: PublisherInput[K]) => setV((s) => ({ ...s, [k]: val }));
  const [initial] = useState(() => JSON.stringify(v));
  const dirty = JSON.stringify(v) !== initial;
  return (
    <FormModal kind="generic" action={pub ? 'edit' : 'create'} width="md" dirty={dirty}
      title={pub ? `Sửa · ${pub.name}` : 'Publisher mới'} onClose={onClose}>
      <div style={{ padding: 16, display: 'grid', gap: 10, overflowY: 'auto' }}>
        <TextField label="Tên" required value={v.name} onChange={(e) => set('name', e.target.value)} />
        <TextField label="Slug" required mono value={v.slug} onChange={(e) => set('slug', e.target.value)}
          hint="Nằm trong link (?p=slug) — đổi sau là gãy link đang chạy."
          disabled={!!pub} lockReason={pub ? 'Link đã phát ra ngoài mang slug này' : undefined} />
        <SelectField label="Loại" value={v.kind} onChange={(e) => set('kind', e.target.value)}>
          <option value="inhouse">inhouse — đội media buy của mình</option>
          <option value="external">external — publisher ngoài</option>
        </SelectField>
        <SelectField label="Trạng thái" value={v.status} onChange={(e) => set('status', e.target.value)}
          hint="paused/banned = link ngừng nhận click ngay, số liệu giữ nguyên.">
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="banned">banned</option>
        </SelectField>
        <SelectField label="User đăng nhập" value={v.userId ? String(v.userId) : ''}
          onChange={(e) => set('userId', e.target.value ? Number(e.target.value) : null)}
          hint="Chưa có user thì tạo ở /team rồi quay lại chọn. Mật khẩu do chính họ đặt.">
          <option value="">— chưa gán —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
        </SelectField>
        <TextAreaField label="Ghi chú" rows={2} value={v.note} onChange={(e) => set('note', e.target.value)} />
      </div>
      <FormModalFooter>
        <button type="button" onClick={onClose} style={btn('var(--fg-3)')}>Huỷ</button>
        <button type="button" disabled={busy} onClick={() => onSave(v)} style={btn('var(--ok)')}>
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

// ── Duyệt & giá riêng ────────────────────────────────────────────────────────
function RegTab({ registrations, offers, publishers, busy, onDecide, onRate, onGrant }: {
  registrations: Registration[]; offers: Offer[]; publishers: Publisher[]; busy: boolean;
  onDecide: (id: number, ok: boolean) => void;
  onRate: (id: number, rate: string) => void;
  onGrant: (publisherId: number, offerId: number) => void;
}) {
  const [pid, setPid] = useState<number[]>([]);
  const [oid, setOid] = useState<number[]>([]);
  const cols: SimpleColumn<Registration>[] = [
    { key: 'p', header: 'Publisher', cell: (r) => <span style={{ color: 'var(--fg-0)' }}>{r.publisherName}</span> },
    { key: 'o', header: 'Chiến dịch', cell: (r) => <span>{r.offerName} <span style={{ ...mono, ...dim }}>{r.offerSlug}</span></span> },
    { key: 's', header: 'Trạng thái', cell: (r) => <Pill label={REG_LABEL[r.status] ?? r.status} color={REG_COLOR[r.status] ?? 'var(--fg-3)'} size="xs" tone="soft" /> },
    { key: 'd', header: 'Xin ngày', cell: (r) => <span style={mono}>{r.requestedAt}</span> },
    // Ba cột cạnh nhau mới đọc được: upstream trả mình là TRẦN, mức chung là mặc định, giá riêng
    // là cái đè lên. Thiếu hai cột đầu thì ô "giá riêng" là con số lơ lửng không so với gì.
    { key: 'up', header: 'Upstream trả mình', title: 'Trần — mình không thể trả publisher hơn mức này mà còn lãi',
      cell: (r) => <span style={{ ...mono, ...dim }}>{r.offerUpstreamRate ?? '—'}</span> },
    { key: 'std', header: 'Mức chung', title: 'Mặc định của chiến dịch, áp cho mọi publisher chưa đặt riêng',
      cell: (r) => <span style={mono}>{r.offerPublisherRate ?? '—'}</span> },
    // Giá riêng: sửa tại chỗ, lưu khi rời ô. Bỏ trống = ăn theo mức chung của chiến dịch.
    { key: 'r', header: 'Giá riêng', cell: (r) => (
      <input defaultValue={r.publisherRate ?? ''} placeholder="theo mức chung" disabled={busy}
        onBlur={(e) => { if (e.target.value !== (r.publisherRate ?? '')) onRate(r.id, e.target.value); }}
        title={'Đè mức chung cho RIÊNG publisher này. Viết tự do: "6%", "$8 CPA".'}
        style={{ ...mono, width: 120, padding: '2px 6px', background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 4 }} />
    ) },
    { key: 'a', header: '', align: 'right', cell: (r) => (
      r.status === 'pending' ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button type="button" disabled={busy} onClick={() => onDecide(r.id, true)} style={btn('var(--ok)')}>Duyệt</button>
          <button type="button" disabled={busy} onClick={() => onDecide(r.id, false)} style={btn('var(--fg-3)')}>Từ chối</button>
        </span>
      ) : (
        <button type="button" disabled={busy} onClick={() => onDecide(r.id, r.status !== 'approved')}
          style={btn(r.status === 'approved' ? 'var(--fg-3)' : 'var(--ok)')}>
          {r.status === 'approved' ? 'Dừng' : 'Cho chạy'}
        </button>
      )
    ) },
  ];
  return (
    <>
      <Section title="Gán chiến dịch cho publisher" subtitle="đội in-house không cần xin — gán thẳng" defaultOpen>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <MultiSelect<number> label="Chọn publisher" compact selected={pid} onChange={(v) => setPid(v.slice(-1))}
            options={publishers.filter((p) => p.status === 'active').map((p) => ({ value: p.id, label: `${p.name} · ${p.slug}` }))} />
          <MultiSelect<number> label="Chọn chiến dịch" compact selected={oid} onChange={(v) => setOid(v.slice(-1))}
            options={offers.filter((o) => o.active).map((o) => ({ value: o.id, label: `${o.name} · ${o.slug}` }))} />
          <button type="button" disabled={busy || !pid.length || !oid.length}
            onClick={() => { onGrant(pid[0]!, oid[0]!); setPid([]); setOid([]); }}
            style={btn('var(--accent)')}>Gán &amp; duyệt luôn</button>
        </div>
      </Section>
      <Section title="Đăng ký &amp; giá riêng" defaultOpen>
        {registrations.length === 0
          ? <EmptyState icon="📝" compact title="Chưa có đăng ký nào" description="Gán ở khối trên, hoặc chờ publisher bấm “Xin chạy” trong portal." />
          : <SimpleTable rows={registrations} columns={cols} getRowKey={(r) => String(r.id)} />}
      </Section>
    </>
  );
}

// ── Đơn hàng ─────────────────────────────────────────────────────────────────
function OrderTab({ report, offers }: { report: NetworkReport; offers: Offer[] }) {
  // Phễu theo CHIẾN DỊCH — /revenue có phễu theo link, ở đây trục tương ứng là chiến dịch.
  const byOffer = useMemo(() => offers.map((o) => {
    const conv = report.conversions.filter((c) => c.offer === o.slug);
    const money = conv.reduce((t, c) => t + c.commission, 0);
    return { ...o, orders: conv.length, money };
  }).sort((a, b) => b.money - a.money || b.clicks - a.clicks), [offers, report.conversions]);
  const offerCols: SimpleColumn<(typeof byOffer)[number]>[] = [
    { key: 'n', header: 'Chiến dịch', cell: (o) => <span style={{ color: 'var(--fg-0)' }}>{o.name}</span> },
    { key: 'c', header: 'Click', align: 'right', cell: (o) => <span style={mono}>{o.clicks}</span> },
    { key: 'o', header: 'Đơn', align: 'right', cell: (o) => <span style={mono}>{o.orders}</span> },
    { key: 'cr', header: 'CR', align: 'right', cell: (o) => <span style={{ ...mono, ...(o.clicks ? {} : dim) }}>{o.clicks ? `${((o.orders / o.clicks) * 100).toFixed(1)}%` : '—'}</span> },
    { key: 'epc', header: '$/click', align: 'right', title: 'Hoa hồng chia số click — so thẳng với giá thầu quảng cáo',
      cell: (o) => <span style={{ ...mono, ...(o.clicks ? {} : dim) }}>{o.clicks ? usd(o.money / o.clicks) : '—'}</span> },
    { key: 'm', header: 'Hoa hồng', align: 'right', cell: (o) => <span style={{ ...mono, color: o.money ? 'var(--ok)' : 'var(--fg-3)' }}>{usd(o.money)}</span> },
  ];
  const cols: SimpleColumn<NetworkReport['conversions'][number]>[] = [
    { key: 'd', header: 'Ngày', cell: (r) => <span style={mono}>{r.date}</span> },
    { key: 'adv', header: 'Advertiser', cell: (r) => r.advertiser },
    { key: 'p', header: 'Publisher', cell: (r) => (
      r.publisher
        ? <span style={{ color: 'var(--fg-0)' }}>{r.publisherName}</span>
        : <Pill label="không nối được" color="var(--warn)" size="xs" tone="soft"
            title={`sid "${r.clickId ?? 'trống'}" không khớp click nào — đơn này không biết trả cho ai`} />
    ) },
    { key: 'u', header: 'Sub-id', cell: (r) => <span style={{ ...mono, ...dim }}>{r.utm.join(' · ') || '—'}</span> },
    { key: 's', header: 'Đối soát', cell: (r) => <Pill label={SETTLE_LABEL[r.state]} color={SETTLE_COLOR[r.state]} size="xs" tone="soft" /> },
    { key: 'g', header: 'Doanh số', align: 'right', cell: (r) => <span style={{ ...mono, ...dim }}>{usd(r.gross)}</span> },
    { key: 'c', header: 'Hoa hồng', align: 'right', cell: (r) => <span style={{ ...mono, color: 'var(--ok)' }}>{usd(r.commission)}</span> },
  ];
  return (
    <>
    <Section title="Phễu theo chiến dịch" subtitle="click → đơn → tiền" defaultOpen>
      {byOffer.length === 0
        ? <EmptyState icon="📦" compact title="Chưa có chiến dịch nào" />
        : <SimpleTable rows={byOffer} columns={offerCols} getRowKey={(o) => o.slug} />}
    </Section>
    <Section title={`Đơn về${report.unmatched ? ` · ${report.unmatched} không nối được` : ''}`}
      subtitle="đọc thẳng API CJ, nối về publisher theo mã click" defaultOpen>
      {report.conversions.length === 0
        ? <EmptyState icon="🧾" compact title="Chưa có đơn nào trong khoảng này" />
        : <SimpleTable rows={report.conversions} columns={cols} getRowKey={(r) => r.upstreamId} />}
    </Section>
    </>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
    background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 4, cursor: 'pointer',
  };
}
