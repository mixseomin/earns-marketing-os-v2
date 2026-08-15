// Revenue dashboard: AdSense (quảng cáo) + Gumroad (sản phẩm MÌNH bán).
// Server-rendered, không chart lib — bar CSS + bảng.
//
// 2026-08-06: viết lại theo ui-conventions §0. Bản trước hardcode 17 mã màu light-theme
// (#f8fafc/#64748b/#4f46e5…) trong app dark → nhìn như trang lạ ghép vào. Giờ dùng token
// (--bg-*/--fg-*/--line/--ok/--warn/--accent) + primitive nhà (Section, StatsStrip,
// EmptyState, Pill, EntityRef). KHÔNG tự định nghĩa Kpi/Section/Empty cục bộ nữa.

import type { AdsenseSummary } from '@/lib/adsense/reports';
import type { GumroadSummary } from '@/lib/gumroad/products';
import type { RevenueByDay } from '@/lib/revenue/by-day';
import { RevenueCalendar } from './revenue-calendar';
import { AffiliatePerf } from './affiliate-perf';
import { RevenueRange } from './revenue-range';
import { Section, StatsStrip, EmptyState, Pill } from './ui';
import type { StatCard } from './ui/stats-strip';

interface Props {
  summary: AdsenseSummary;
  scope?: 'project' | 'all';
  projectName?: string;
  /** Doanh thu sản phẩm mình bán (Gumroad/CodeCrate) — khác AdSense, khác /offers. */
  gumroad?: GumroadSummary;
  /** Mọi nguồn quy về trục ngày, cho lịch doanh thu. */
  byDay?: RevenueByDay;
  /** Khung thời gian đang chọn; 0 = toàn bộ. Cùng giá trị với ?days=. */
  days?: number;
}

function fmtUSD(n: number) {
  if (n >= 1000) return `$${n.toFixed(0)}`;
  if (n >= 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}
function fmtInt(n: number) { return n.toLocaleString('en-US'); }
function fmtRpm(n: number) { return `$${n.toFixed(2)}`; }

export function RevenueView({ summary, scope = 'all', projectName, gumroad, byDay, days = 30 }: Props) {
  const { totalEarnings, totalImpressions, totalClicks, totalPageViews, avgRpm,
          byDate, byDomain, byAccount, rows } = summary;

  const maxDayEarnings = Math.max(1, ...byDate.map(d => d.earnings));
  const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;
  const rangeLabel = days > 0 ? `${days} ngày gần nhất` : 'toàn bộ lịch sử';

  const adsenseCards: StatCard[] = [
    { key: 'earn', label: 'Earnings', value: fmtUSD(totalEarnings), color: 'var(--ok)' },
    { key: 'pv', label: 'Page views', value: fmtInt(totalPageViews), color: 'var(--fg-0)', title: 'Lượt xem trang có quảng cáo' },
    { key: 'impr', label: 'Impressions', value: fmtInt(totalImpressions), color: 'var(--fg-0)', title: 'Số lần quảng cáo được hiển thị' },
    { key: 'clk', label: 'Clicks', value: fmtInt(totalClicks), color: 'var(--fg-0)' },
    { key: 'ctr', label: 'CTR', value: `${ctr.toFixed(2)}%`, color: 'var(--neon-violet)', title: 'Clicks / Impressions — thấp = vị trí quảng cáo kém' },
    { key: 'rpm', label: 'RPM', value: fmtRpm(avgRpm), color: 'var(--neon-cyan)', title: 'Doanh thu / 1000 impressions — thấp = niche/địa lý giá rẻ' },
  ];

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            💵 Revenue{scope === 'project' && projectName ? ` · ${projectName}` : ''}
            <small>// AdSense + Gumroad</small>
          </h1>
          <p className="page-sub">
            Khung thời gian áp cho cả trang: {rangeLabel}. AdSense pull 09:00 UTC (AdSense chỉnh lùi tới 48h).
            Gumroad: thẻ tổng là số trọn đời; lịch bên dưới theo đúng khung đang chọn.
          </p>
        </div>
        <RevenueRange value={days} />
      </div>

      {byDay && (
        <Section title="Lịch doanh thu · mọi nguồn" subtitle="AdSense · Sản phẩm/Affiliate · Gumroad">
          <RevenueCalendar rows={byDay.rows} errors={byDay.errors} scannedNetworks={byDay.scannedNetworks} />
        </Section>
      )}

      {/* Lịch trên chỉ có TIỀN. Link đốt click mà không ra đơn cũng $0 y như link chưa ai bấm —
          phễu này là chỗ tách hai chuyện đó ra. */}
      {byDay && (
        <Section title="Affiliate · phễu click → đơn" subtitle={`CJ · ${rangeLabel}`} defaultOpen={false}>
          <AffiliatePerf linkPerf={byDay.linkPerf} rows={byDay.rows} />
        </Section>
      )}

      {/* Gumroad = hàng MÌNH bán. Khác AdSense (quảng cáo), khác /offers (affiliate network khác). */}
      {gumroad && <GumroadBlock g={gumroad} />}

      <Section title="AdSense" subtitle={rangeLabel}>
        <StatsStrip cards={adsenseCards} />

        {byDate.length === 0 ? (
          <EmptyState icon="📉" compact title="Chưa có dòng doanh thu nào trong khoảng này"
            description={<>Backfill bằng <code>node /opt/cgg-report/adsense_check.mjs</code></>} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '8px 0' }}>
            {byDate.map(d => {
              const h = Math.max(2, (d.earnings / maxDayEarnings) * 100);
              return (
                <div key={d.date} title={`${d.date}: ${fmtUSD(d.earnings)} (${fmtInt(d.impressions)} impr)`}
                  style={{ flex: 1, minWidth: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', height: `${h}%`,
                    background: d.earnings > 0 ? 'var(--accent)' : 'var(--bg-3)',
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ fontSize: 9, color: 'var(--fg-3)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Funnel theo site: PV → Impr → Click → tiền. Cột nào tụt thì biết sửa gì:
          PV thấp = thiếu traffic (SEO) · CTR thấp = vị trí quảng cáo · RPM thấp = niche/địa lý. */}
      {byDomain.length > 0 && (
        <Section title="Theo site" subtitle="funnel: page views → impressions → clicks → tiền" defaultOpen>
          <Table head={['Domain', 'Page views', 'Impressions', 'Clicks', 'CTR', 'RPM', 'Earnings']}>
            {byDomain.map(d => (
              <tr key={d.domain}>
                <td style={{ fontWeight: 500, color: 'var(--fg-0)' }}>{d.domain}</td>
                <td>{fmtInt(d.pageViews)}</td>
                <td>{fmtInt(d.impressions)}</td>
                <td>{fmtInt(d.clicks)}</td>
                <td style={{ color: d.ctr > 0 ? 'var(--fg-1)' : 'var(--fg-3)' }}>{d.ctr.toFixed(2)}%</td>
                <td>{fmtRpm(d.rpm)}</td>
                <td style={{ color: 'var(--ok)' }}>{fmtUSD(d.earnings)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {scope === 'all' && byAccount.length > 0 && (
        <Section title="Theo AdSense account" defaultOpen={false}>
          <Table head={['Publisher ID', 'Earnings', 'Impressions']}>
            {byAccount.map(a => (
              <tr key={a.pubId}>
                <td style={mono}>{a.pubId}</td>
                <td>{fmtUSD(a.earnings)}</td>
                <td>{fmtInt(a.impressions)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section title="Dòng gần nhất (30)" defaultOpen={false}>
        <Table head={['Date', 'Site', 'Pub', 'Earn', 'Impr', 'Clk', 'PV', 'RPM']}>
          {rows.slice(0, 30).map((r, i) => (
            <tr key={i}>
              <td style={mono}>{r.date}</td>
              <td>{r.siteDomain || <em style={{ color: 'var(--fg-3)' }}>(account total)</em>}</td>
              <td style={{ ...mono, color: 'var(--fg-3)' }}>{r.pubId.replace('pub-', '')}</td>
              <td>{fmtUSD(r.earningsUsd)}</td>
              <td>{fmtInt(r.impressions)}</td>
              <td>{fmtInt(r.clicks)}</td>
              <td>{fmtInt(r.pageViews)}</td>
              <td>{fmtRpm(r.rpmUsd)}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}

// ── Gumroad ──────────────────────────────────────────────────────
function GumroadBlock({ g }: { g: GumroadSummary }) {
  if (!g.ok) {
    return (
      <Section title="Sản phẩm bán ra · Gumroad">
        <EmptyState icon="⚠" compact title="Không đọc được Gumroad" description={g.error ?? 'lỗi không rõ'} />
      </Section>
    );
  }
  const cards: StatCard[] = [
    { key: 'rev', label: 'Doanh số (trọn đời)', value: fmtUSD(g.totalUsd), color: 'var(--ok)',
      title: 'Giá bán cộng lại, TRƯỚC phí Gumroad (~10%) và phí thanh toán. Thực nhận thấp hơn.' },
    { key: 'ord', label: 'Đơn hàng', value: fmtInt(g.totalSales), color: 'var(--fg-0)' },
    { key: 'live', label: 'Đang bán', value: `${g.livePaid} + ${g.liveFree}`, color: 'var(--neon-cyan)', title: `${g.livePaid} trả phí + ${g.liveFree} miễn phí (lead magnet)` },
    { key: 'disc', label: 'Thiếu tag/category', value: fmtInt(g.missingDiscover), color: g.missingDiscover ? 'var(--warn)' : 'var(--ok)', title: 'Thiếu = không lên được Gumroad Discover' },
  ];
  // Nhiều store Gumroad = nhiều tài khoản riêng, mỗi cái một token. Liệt kê thẳng ra để
  // thấy trang này đang đọc được store NÀO — trước đây chỉ đọc 1 token nên store khác
  // vắng mặt mà không ai biết, trông như sản phẩm bị mất.
  const stores = g.stores ?? [];
  return (
    <Section title={`Sản phẩm bán ra · Gumroad${stores.length === 1 ? ` (${stores[0]!.handle})` : ''}`} subtitle="hàng mình bán, không phải affiliate">
      <StatsStrip cards={cards} />
      {stores.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, fontSize: 11 }}>
          <span style={{ color: 'var(--fg-4)' }}>Store đọc được:</span>
          {stores.map((s) => (
            <Pill key={s.handle + s.source} size="xs" tone="soft"
              color={s.error ? 'var(--warn)' : 'var(--fg-3)'}
              label={s.error ? `${s.handle} · lỗi` : `${s.handle} · ${s.products} SP`}
              title={s.error ? `${s.error} (token từ ${s.source})` : `${s.url} · token từ ${s.source === 'vault' ? 'vault' : 'env'}`} />
          ))}
        </div>
      )}
      {g.products.length === 0 ? (
        <EmptyState icon="📦" compact title="Store chưa có sản phẩm nào" />
      ) : (
        <Table head={['Sản phẩm', 'Giá', 'Đơn', 'Doanh thu', 'Discover']}>
          {g.products.map((p) => {
            const ready = p.tags.length > 0 && !!p.category && p.category !== 'other';
            return (
              <tr key={p.store + p.id}>
                <td style={{ fontWeight: 500 }}>
                  {p.url
                    ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{p.name}</a>
                    : <span style={{ color: 'var(--fg-0)' }}>{p.name}</span>}
                  {stores.length > 1 && <Pill label={p.store} color="var(--fg-4)" size="xs" tone="soft" />}
                  {!p.published && <Pill label="draft" color="var(--fg-3)" size="xs" tone="soft" />}
                </td>
                <td>{p.priceCents === 0 ? <Pill label="free" color="var(--neon-cyan)" size="xs" tone="soft" /> : fmtUSD(p.priceCents / 100)}</td>
                <td>{fmtInt(p.salesCount)}</td>
                <td>{fmtUSD(p.salesUsdCents / 100)}</td>
                <td>
                  <Pill label={ready ? 'sẵn sàng' : 'thiếu tag/category'} color={ready ? 'var(--ok)' : 'var(--warn)'} size="xs" tone="soft"
                    title={ready ? 'Có category + tags → lên được Gumroad Discover' : 'Bỏ trống = không vào Gumroad Discover, mất kênh traffic free'} />
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </Section>
  );
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11 };

// Bảng gọn dùng token nhà. (ui-conventions §5 `list-view` là cho page LIST có
// search/filter/phân trang — đây là bảng số read-only của dashboard.)
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {head.map(h => (
              <th key={h} style={{
                padding: '6px 10px', fontSize: 9.5, fontWeight: 600, color: 'var(--fg-3)',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em',
                textAlign: 'left', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          <style>{`tbody td { padding: 6px 10px; border-bottom: 1px solid var(--line); color: var(--fg-1); vertical-align: middle; }`}</style>
        </tbody>
      </table>
    </div>
  );
}
