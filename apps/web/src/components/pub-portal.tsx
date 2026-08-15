'use client';

// Portal publisher — bố cục theo đúng nếp net VN (AccessTrade/Adpia): Tổng quan · Chiến dịch ·
// Công cụ tạo link · Báo cáo. Publisher chỉ thấy số của CHÍNH MÌNH.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Offer } from '@/lib/network/data';
import type { NetworkReport } from '@/lib/network/report';
import { SETTLE_LABEL, SETTLE_COLOR } from '@/lib/network/status';
import { trackingUrl, UTM_SLOTS, type Utm } from '@/lib/network/link';
import { requestOffer } from '@/lib/actions/network';
import { Section, SimpleTable, StatsStrip, EmptyState, Pill, Segmented, type SimpleColumn, type StatCard } from './ui';

const usd = (n: number) => (n >= 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);
const mono = { fontFamily: 'var(--font-mono)', fontSize: 11 } as const;
const dim = { color: 'var(--fg-3)' };

type OfferReg = Offer & { regStatus: string | null };

const REG_LABEL: Record<string, string> = { approved: 'đang chạy', pending: 'chờ duyệt', rejected: 'bị từ chối' };
const REG_COLOR: Record<string, string> = { approved: 'var(--ok)', pending: 'var(--warn)', rejected: 'var(--fg-3)' };

export function PubPortal({ pubSlug, pubName, offers, report, origin }: {
  pubSlug: string; pubName: string; offers: OfferReg[]; report: NetworkReport; origin: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const approved = offers.filter((o) => o.regStatus === 'approved');
  const [sel, setSel] = useState(approved[0]?.slug ?? '');
  const [utm, setUtm] = useState<Utm>({});
  const me = report.pubs.find((p) => p.publisher === pubSlug);
  const mine = useMemo(() => report.conversions.filter((c) => c.publisher === pubSlug), [report.conversions, pubSlug]);

  const link = sel ? trackingUrl(origin, sel, pubSlug, utm) : '';

  const cards: StatCard[] = [
    { key: 'c', label: 'Click', value: String(me?.clicks ?? 0), color: 'var(--neon-cyan)' },
    { key: 'o', label: 'Đơn', value: String(me?.orders ?? 0), color: 'var(--fg-0)' },
    { key: 'a', label: 'Hoa hồng được duyệt', value: usd(me?.approved ?? 0), color: 'var(--ok)',
      title: 'Đã đối soát xong — số này không đổi nữa' },
    { key: 'h', label: 'Tạm duyệt', value: usd(me?.holding ?? 0), color: 'var(--warn)',
      title: 'Nhà cung cấp đã xác nhận nhưng chưa đối soát. Số này CÒN ĐỔI ĐƯỢC, đừng tính là tiền đã có.' },
    { key: 'w', label: 'Chờ duyệt', value: usd(me?.pending ?? 0), color: 'var(--fg-2)',
      title: 'Mới ghi nhận, nhà cung cấp chưa xác nhận' },
  ];

  const offerCols: SimpleColumn<OfferReg>[] = [
    { key: 'n', header: 'Chiến dịch', cell: (o) => (
      <span><span style={{ color: 'var(--fg-0)' }}>{o.name}</span>{o.advertiser && <span style={dim}> · {o.advertiser}</span>}</span>
    ) },
    { key: 'cat', header: 'Ngành', cell: (o) => <span style={dim}>{o.category ?? '—'}</span> },
    { key: 'r', header: 'Hoa hồng', cell: (o) => <span style={mono}>{o.publisherRate ?? o.upstreamRate ?? '—'}</span> },
    { key: 't', header: 'Điều kiện ghi nhận', cell: (o) => <span style={{ ...dim, fontSize: 11 }}>{o.terms ?? '—'}</span> },
    { key: 's', header: 'Trạng thái', cell: (o) => (
      o.regStatus
        ? <Pill label={REG_LABEL[o.regStatus] ?? o.regStatus} color={REG_COLOR[o.regStatus] ?? 'var(--fg-3)'} size="xs" tone="soft" />
        : <button type="button" disabled={busy}
            onClick={() => start(async () => { await requestOffer(o.id); router.refresh(); })}
            style={{ padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', background: 'transparent',
                     color: 'var(--accent)', border: '1px solid var(--accent-line)', borderRadius: 4, cursor: 'pointer' }}>
            Xin chạy
          </button>
    ) },
  ];

  const convCols: SimpleColumn<NetworkReport['conversions'][number]>[] = [
    { key: 'd', header: 'Ngày', cell: (r) => <span style={mono}>{r.date}</span> },
    { key: 'o', header: 'Chiến dịch', cell: (r) => r.advertiser },
    { key: 'u', header: 'Sub-id của bạn', cell: (r) => <span style={{ ...mono, ...dim }}>{r.utm.join(' · ') || '—'}</span> },
    { key: 's', header: 'Trạng thái', cell: (r) => <Pill label={SETTLE_LABEL[r.state]} color={SETTLE_COLOR[r.state]} size="xs" tone="soft" /> },
    { key: 'g', header: 'Giá trị đơn', align: 'right', cell: (r) => <span style={{ ...mono, ...dim }}>{usd(r.gross)}</span> },
    { key: 'c', header: 'Hoa hồng', align: 'right', cell: (r) => <span style={{ ...mono, color: 'var(--ok)' }}>{usd(r.commission)}</span> },
  ];

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">📈 {pubName}<small>// publisher</small></h1>
          <p className="page-sub">
            Hoa hồng <b>tạm duyệt</b> là số nhà cung cấp đã xác nhận nhưng chưa đối soát — còn đổi được.
            Chỉ <b>được duyệt</b> mới là tiền chốt.
          </p>
        </div>
      </div>

      <StatsStrip cards={cards} />

      <Section title="Tạo link" subtitle="dán link này vào quảng cáo/bài viết" defaultOpen>
        {approved.length === 0 ? (
          <EmptyState icon="🔗" compact title="Chưa có chiến dịch nào được duyệt"
            description="Xin chạy một chiến dịch ở khối bên dưới, được duyệt thì link hiện ra ở đây." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <Segmented<string>
                value={sel} onChange={setSel}
                options={approved.map((o) => ({ value: o.slug, label: o.name, title: o.terms ?? undefined }))}
              />
              {UTM_SLOTS.map((k) => (
                <input key={k} value={utm[k] ?? ''} placeholder={k}
                  onChange={(e) => setUtm((u) => ({ ...u, [k]: e.target.value }))}
                  style={{ ...mono, width: 130, padding: '3px 6px', background: 'var(--bg-2)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 4 }} />
              ))}
            </div>
            {/* Ô đọc-được-chọn-được, không phải nút "copy" — nút copy hỏng lặng lẽ khi trang không
                chạy https hoặc trình duyệt chặn clipboard, mà người dùng lại tưởng đã copy. */}
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
              style={{ ...mono, width: '100%', padding: '6px 8px', background: 'var(--bg-2)', color: 'var(--accent)', border: '1px solid var(--line)', borderRadius: 4 }} />
            <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
              Bốn ô <code>utm_*</code> là của bạn — tự chia chiến dịch/mẫu quảng cáo tuỳ ý, chúng quay về nguyên văn trong báo cáo.
            </p>
          </>
        )}
      </Section>

      <Section title="Chiến dịch" subtitle="đăng ký rồi được duyệt mới tạo được link" defaultOpen>
        {offers.length === 0
          ? <EmptyState icon="📦" compact title="Chưa có chiến dịch nào" />
          : <SimpleTable rows={offers} columns={offerCols} getRowKey={(o) => o.slug} />}
      </Section>

      <Section title="Báo cáo đơn hàng" defaultOpen>
        {mine.length === 0
          ? <EmptyState icon="🧾" compact title="Chưa có đơn nào" description="Đơn hiện ở đây sau khi nhà cung cấp ghi nhận (thường vài giờ tới vài ngày)." />
          : <SimpleTable rows={mine} columns={convCols} getRowKey={(r) => r.upstreamId} />}
      </Section>
    </div>
  );
}
