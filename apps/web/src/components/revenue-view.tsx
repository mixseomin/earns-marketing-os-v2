// AdSense revenue dashboard view. Pure server-rendered (no charts library);
// uses CSS bars + tables for zero client JS cost.

import type { AdsenseSummary } from '@/lib/adsense/reports';
import type { GumroadSummary } from '@/lib/gumroad/products';

interface Props {
  summary: AdsenseSummary;
  scope?: 'project' | 'all';
  projectName?: string;
  /** Doanh thu sản phẩm mình bán (Gumroad/CodeCrate) — khác AdSense, khác /offers. */
  gumroad?: GumroadSummary;
}

function fmtUSD(n: number) {
  if (n >= 1000) return `$${n.toFixed(0)}`;
  if (n >= 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}
function fmtInt(n: number) { return n.toLocaleString('en-US'); }
function fmtRpm(n: number) { return `$${n.toFixed(2)}`; }

export function RevenueView({ summary, scope = 'all', projectName, gumroad }: Props) {
  const { totalEarnings, totalImpressions, totalClicks, totalPageViews, avgRpm,
          byDate, byDomain, byAccount, rows, windowDays } = summary;

  const maxDayEarnings = Math.max(1, ...byDate.map(d => d.earnings));
  const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1280 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Revenue {scope === 'project' && projectName ? `· ${projectName}` : ''}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
          AdSense: {windowDays} ngày gần nhất, pull 09:00 UTC (AdSense chỉnh lùi tới 48h).
          Gumroad: số cộng dồn trọn đời, đọc thẳng API, cache 5 phút.
        </p>
      </header>

      {/* KPI strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
        gap: 10, marginBottom: 24,
      }}>
        <Kpi label="Earnings" value={fmtUSD(totalEarnings)} />
        <Kpi label="Impressions" value={fmtInt(totalImpressions)} />
        <Kpi label="Clicks" value={fmtInt(totalClicks)} sub={`CTR ${ctr.toFixed(2)}%`} />
        <Kpi label="Page views" value={fmtInt(totalPageViews)} />
        <Kpi label="RPM (impressions)" value={fmtRpm(avgRpm)} />
      </div>

      {/* Gumroad — sản phẩm MÌNH bán. Khác AdSense (quảng cáo) và khác /offers (affiliate của network). */}
      {gumroad && <GumroadBlock g={gumroad} />}

      {/* By date bar chart (CSS only) */}
      <Section title="AdSense · earnings by day">
        {byDate.length === 0 ? (
          <Empty>No revenue rows in window. Run <code>node /opt/cgg-report/adsense_check.mjs</code> to backfill.</Empty>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '8px 0' }}>
            {byDate.map(d => {
              const h = Math.max(2, (d.earnings / maxDayEarnings) * 100);
              return (
                <div key={d.date} title={`${d.date}: ${fmtUSD(d.earnings)} (${fmtInt(d.impressions)} impr)`}
                  style={{ flex: 1, minWidth: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', height: `${h}%`,
                    background: d.earnings > 0 ? 'linear-gradient(180deg,#6366f1,#4f46e5)' : '#e2e8f0',
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* By domain table */}
      {byDomain.length > 0 && (
        <Section title="By site">
          <Table head={['Domain', 'Earnings', 'Impressions', 'RPM']}>
            {byDomain.map(d => (
              <tr key={d.domain}>
                <td style={{ fontWeight: 500 }}>{d.domain}</td>
                <td>{fmtUSD(d.earnings)}</td>
                <td>{fmtInt(d.impressions)}</td>
                <td>{fmtRpm(d.rpm)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {/* By account */}
      {scope === 'all' && byAccount.length > 0 && (
        <Section title="By AdSense account">
          <Table head={['Publisher ID', 'Earnings', 'Impressions']}>
            {byAccount.map(a => (
              <tr key={a.pubId}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.pubId}</td>
                <td>{fmtUSD(a.earnings)}</td>
                <td>{fmtInt(a.impressions)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {/* Recent raw rows */}
      <Section title="Recent rows (top 30)">
        <Table head={['Date', 'Site', 'Pub', 'Earn', 'Impr', 'Clk', 'PV', 'RPM']}>
          {rows.slice(0, 30).map((r, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.date}</td>
              <td>{r.siteDomain || <em style={{ color: '#94a3b8' }}>(account total)</em>}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{r.pubId.replace('pub-', '')}</td>
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
      <Section title="Sản phẩm bán ra · Gumroad (CodeCrate)">
        <Empty>Không đọc được Gumroad: {g.error ?? 'lỗi không rõ'}</Empty>
      </Section>
    );
  }
  return (
    <Section title="Sản phẩm bán ra · Gumroad (CodeCrate)">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 12 }}>
        <Kpi label="Doanh thu (trọn đời)" value={fmtUSD(g.totalUsd)} />
        <Kpi label="Đơn hàng" value={fmtInt(g.totalSales)} />
        <Kpi label="Đang bán" value={`${g.livePaid} trả phí`} sub={`+ ${g.liveFree} miễn phí (lead magnet)`} />
        <Kpi label="Thiếu Category/Tags" value={fmtInt(g.missingDiscover)} sub="không lên được Gumroad Discover" />
      </div>
      {g.products.length === 0 ? (
        <Empty>Chưa có sản phẩm nào trên store.</Empty>
      ) : (
        <Table head={['Sản phẩm', 'Giá', 'Đơn', 'Doanh thu', 'Discover']}>
          {g.products.map((p) => {
            const discoverReady = p.tags.length > 0 && !!p.category && p.category !== 'other';
            return (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>
                  {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>{p.name}</a> : p.name}
                  {!p.published && <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8' }}>(draft)</span>}
                </td>
                <td>{p.priceCents === 0 ? 'Free' : fmtUSD(p.priceCents / 100)}</td>
                <td>{fmtInt(p.salesCount)}</td>
                <td>{fmtUSD(p.salesUsdCents / 100)}</td>
                <td style={{ color: discoverReady ? '#16a34a' : '#d97706' }}>{discoverReady ? '✓' : '⚠ thiếu tag/category'}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </Section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 8,
      background: '#f8fafc', border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: '#475569', letterSpacing: 0.2 }}>{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="scroll-x" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
          {head.map(h => (
            <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody style={{}}>
        {children}
        <style>{`tbody td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }`}</style>
      </tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 18px', background: '#f8fafc', border: '1px dashed #e2e8f0',
      borderRadius: 8, color: '#64748b', fontSize: 13,
    }}>{children}</div>
  );
}
