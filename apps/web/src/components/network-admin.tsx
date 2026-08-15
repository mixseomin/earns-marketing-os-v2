'use client';

// Backend admin của network. Bốn khối theo đúng thứ tự việc phải làm:
// duyệt đăng ký (việc tồn đọng) → publisher → chiến dịch → đơn về.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Offer, Publisher, Registration, UserOption } from '@/lib/network/data';
import type { NetworkReport } from '@/lib/network/report';
import { SETTLE_LABEL, SETTLE_COLOR } from '@/lib/network/status';
import { decideRegistration, linkPublisherUser } from '@/lib/actions/network';
import { Section, SimpleTable, StatsStrip, EmptyState, Pill, MultiSelect, type SimpleColumn, type StatCard } from './ui';

const usd = (n: number) => (n >= 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const mono = { fontFamily: 'var(--font-mono)', fontSize: 11 } as const;
const dim = { color: 'var(--fg-3)' };

export function NetworkAdmin({ offers, publishers, registrations, report, origin, users }: {
  offers: Offer[]; publishers: Publisher[]; registrations: Registration[];
  report: NetworkReport; origin: string; users: UserOption[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const pending = registrations.filter((r) => r.status === 'pending');

  const cards: StatCard[] = [
    { key: 'pub', label: 'Publisher', value: String(publishers.length), color: 'var(--fg-0)' },
    { key: 'off', label: 'Chiến dịch', value: String(offers.filter((o) => o.active).length), color: 'var(--fg-0)' },
    { key: 'clk', label: 'Click', value: String(report.pubs.reduce((t, p) => t + p.clicks, 0)), color: 'var(--neon-cyan)' },
    { key: 'ord', label: 'Đơn', value: String(report.conversions.length), color: 'var(--fg-0)' },
    { key: 'ok', label: 'Được duyệt', value: usd(report.pubs.reduce((t, p) => t + p.approved, 0)), color: 'var(--ok)',
      title: 'Đã đối soát xong — con số duy nhất dùng để trả tiền publisher' },
    { key: 'hold', label: 'Tạm duyệt', value: usd(report.pubs.reduce((t, p) => t + p.holding, 0)), color: 'var(--warn)',
      title: 'Nhà cung cấp đã xác nhận nhưng chưa đối soát — số này còn đổi được' },
  ];

  const pubCols: SimpleColumn<NetworkReport['pubs'][number]>[] = [
    { key: 'p', header: 'Publisher', cell: (r) => <span style={{ color: 'var(--fg-0)' }}>{r.publisherName} <span style={{ ...mono, ...dim }}>{r.publisher}</span></span> },
    { key: 'c', header: 'Click', align: 'right', cell: (r) => <span style={mono}>{r.clicks}</span> },
    { key: 'o', header: 'Đơn', align: 'right', cell: (r) => <span style={mono}>{r.orders}</span> },
    { key: 'cr', header: 'CR', align: 'right', cell: (r) => <span style={{ ...mono, ...(r.clicks ? {} : dim) }}>{r.clicks ? `${((r.orders / r.clicks) * 100).toFixed(1)}%` : '—'}</span> },
    { key: 'a', header: 'Được duyệt', align: 'right', cell: (r) => <span style={{ ...mono, color: r.approved ? 'var(--ok)' : 'var(--fg-3)' }}>{usd(r.approved)}</span> },
    { key: 'h', header: 'Tạm duyệt', align: 'right', cell: (r) => <span style={{ ...mono, color: r.holding ? 'var(--warn)' : 'var(--fg-3)' }}>{usd(r.holding)}</span> },
    { key: 'w', header: 'Chờ duyệt', align: 'right', cell: (r) => <span style={{ ...mono, ...dim }}>{usd(r.pending)}</span> },
  ];

  const convCols: SimpleColumn<NetworkReport['conversions'][number]>[] = [
    { key: 'd', header: 'Ngày', cell: (r) => <span style={mono}>{r.date}</span> },
    { key: 'adv', header: 'Advertiser', cell: (r) => r.advertiser },
    { key: 'p', header: 'Publisher', cell: (r) => (
      r.publisher
        ? <span style={{ color: 'var(--fg-0)' }}>{r.publisherName}</span>
        : <Pill label="không nối được" color="var(--warn)" size="xs" tone="soft" title={`sid "${r.clickId ?? 'trống'}" không khớp click nào — đơn này không biết trả cho ai`} />
    ) },
    { key: 'u', header: 'Sub-id', cell: (r) => <span style={{ ...mono, ...dim }}>{r.utm.join(' · ') || '—'}</span> },
    { key: 's', header: 'Trạng thái', cell: (r) => <Pill label={SETTLE_LABEL[r.state]} color={SETTLE_COLOR[r.state]} size="xs" tone="soft" /> },
    { key: 'g', header: 'Doanh số', align: 'right', cell: (r) => <span style={{ ...mono, ...dim }}>{usd(r.gross)}</span> },
    { key: 'c', header: 'Hoa hồng', align: 'right', cell: (r) => <span style={{ ...mono, color: 'var(--ok)' }}>{usd(r.commission)}</span> },
  ];

  const offerCols: SimpleColumn<Offer>[] = [
    { key: 'n', header: 'Chiến dịch', cell: (o) => (
      <span>
        <span style={{ color: 'var(--fg-0)' }}>{o.name}</span> <span style={{ ...mono, ...dim }}>{o.slug}</span>
        {!o.active && <Pill label="dừng" color="var(--fg-3)" size="xs" tone="soft" />}
      </span>
    ) },
    { key: 'net', header: 'Network', cell: (o) => <span style={mono}>{o.network}</span> },
    { key: 'cat', header: 'Ngành', cell: (o) => <span style={dim}>{o.category ?? '—'}</span> },
    { key: 'up', header: 'Upstream trả mình', cell: (o) => <span style={mono}>{o.upstreamRate ?? '—'}</span> },
    { key: 'pr', header: 'Mình trả pub', cell: (o) => <span style={{ ...mono, ...(o.publisherRate ? {} : dim) }}>{o.publisherRate ?? 'chưa đặt'}</span> },
    { key: 'c', header: 'Click', align: 'right', cell: (o) => <span style={mono}>{o.clicks}</span> },
    { key: 'l', header: 'Link gốc', cell: (o) => <a href={`${origin}/c/${o.slug}?p=<pub>`} style={{ ...mono, color: 'var(--accent)', textDecoration: 'none' }}>/c/{o.slug}</a> },
  ];

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">🕸 Network · admin<small>// backend</small></h1>
          <p className="page-sub">
            Publisher chạy link <code>/c/&lt;chiến-dịch&gt;?p=&lt;publisher&gt;</code>. Mã click nhét vào ô sub-id của
            network upstream, đơn về thì nối ngược ra publisher. Số liệu đọc thẳng API CJ, không có bảng đơn riêng.
          </p>
        </div>
      </div>

      <StatsStrip cards={cards} />

      {report.errors.length > 0 && (
        <div style={{ margin: '8px 0', fontSize: 11, color: 'var(--warn)' }}>{report.errors.join(' · ')}</div>
      )}

      <Section title={`Đăng ký chờ duyệt${pending.length ? ` (${pending.length})` : ''}`} defaultOpen>
        {pending.length === 0 ? (
          <EmptyState icon="✅" compact title="Không còn đăng ký nào chờ" />
        ) : (
          <SimpleTable
            rows={pending}
            getRowKey={(r) => String(r.id)}
            columns={[
              { key: 'p', header: 'Publisher', cell: (r) => r.publisherName },
              { key: 'o', header: 'Chiến dịch', cell: (r) => r.offerName },
              { key: 'd', header: 'Xin ngày', cell: (r) => <span style={mono}>{r.requestedAt}</span> },
              { key: 'a', header: '', align: 'right', cell: (r) => (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button type="button" disabled={busy}
                    onClick={() => start(async () => { await decideRegistration(r.id, true); router.refresh(); })}
                    style={btn('var(--ok)')}>Duyệt</button>
                  <button type="button" disabled={busy}
                    onClick={() => start(async () => { await decideRegistration(r.id, false); router.refresh(); })}
                    style={btn('var(--fg-3)')}>Từ chối</button>
                </span>
              ) },
            ]}
          />
        )}
      </Section>

      <Section title="Publisher" subtitle="click → đơn → tiền, tách theo trạng thái đối soát" defaultOpen>
        {report.pubs.length === 0
          ? <EmptyState icon="👥" compact title="Chưa có publisher nào" />
          : <SimpleTable rows={report.pubs} columns={pubCols} getRowKey={(r) => r.publisher} />}
      </Section>

      {/* Gán user để publisher đăng nhập được vào portal. Không có chỗ này thì portal chỉ hiện
          "chưa gắn publisher nào" và không ai làm gì được — một chỉ dẫn trỏ vào hư không. */}
      <Section title="Tài khoản đăng nhập" subtitle="user MOS2 nào vào portal thì thấy số của publisher nào" defaultOpen={false}>
        <SimpleTable
          rows={publishers}
          getRowKey={(p) => p.slug}
          columns={[
            { key: 'p', header: 'Publisher', cell: (p) => <span style={{ color: 'var(--fg-0)' }}>{p.name} <span style={{ ...mono, ...dim }}>{p.slug}</span></span> },
            { key: 'k', header: 'Loại', cell: (p) => <span style={dim}>{p.kind}</span> },
            { key: 'u', header: 'User đăng nhập', cell: (p) => (
              <MultiSelect<number>
                label="— chưa gán —"
                compact
                options={users.map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
                selected={p.userId ? [p.userId] : []}
                // Một publisher một user: lấy cái VỪA chọn (phần tử cuối), không phải cả mảng —
                // MultiSelect vốn là bộ lọc nhiều lựa chọn, ở đây dùng vì cần ô có tìm kiếm.
                onChange={(v) => {
                  const pick = v.length ? v[v.length - 1]! : null;
                  start(async () => { await linkPublisherUser(p.id, pick); router.refresh(); });
                }}
              />
            ) },
          ]}
        />
        <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
          Chưa có user cho người này thì tạo ở <a href="/team" style={{ color: 'var(--accent)' }}>/team</a> rồi quay lại chọn.
          Mật khẩu do chính họ đặt qua luồng reset của /team.
        </p>
      </Section>

      <Section title="Chiến dịch" defaultOpen>
        {offers.length === 0
          ? <EmptyState icon="📦" compact title="Chưa có chiến dịch nào" />
          : <SimpleTable rows={offers} columns={offerCols} getRowKey={(o) => o.slug} />}
      </Section>

      <Section
        title={`Đơn về${report.unmatched ? ` · ${report.unmatched} không nối được` : ''}`}
        subtitle="đọc thẳng CJ, nối về publisher theo mã click"
        defaultOpen
      >
        {report.conversions.length === 0
          ? <EmptyState icon="🧾" compact title="Chưa có đơn nào trong khoảng này" />
          : <SimpleTable rows={report.conversions} columns={convCols} getRowKey={(r) => r.upstreamId} />}
      </Section>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
    background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 4, cursor: 'pointer',
  };
}
