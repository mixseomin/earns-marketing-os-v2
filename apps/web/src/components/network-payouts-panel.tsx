'use client';

import { Collapsible, DataTable, EntityRef, type DataColumn } from './ui';
import { NETWORK_PAYOUTS, type NetworkPayout } from '@/lib/affiliate-networks';
import type { NetworkStat } from '@/lib/actions/offers';

// "Network nào trả bao nhiêu, và mình đang có gì ở đó" — tầng TRÊN bảng offer.
// Đã kiếm/Ngưỡng là chuyện của TÀI KHOẢN + điều khoản network; Offer/Duyệt tính live từ danh
// sách offer thật. Ô trống = chưa xác minh (vault không có API key), KHÔNG phải bằng 0.

type Row = NetworkPayout & { stat: NetworkStat | null };

const dim = { color: 'var(--fg-3)' };
const clickable: React.CSSProperties = { cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2 };
const money = (v: number | null) => (v == null ? null : `$${v.toFixed(2)}`);

export function NetworkPayoutsPanel({ networks, onNetwork }: { networks: NetworkStat[]; onNetwork: (key: string) => void }) {
  const byKey = new Map(networks.map((n) => [n.key, n]));
  const rows: Row[] = NETWORK_PAYOUTS.map((n) => ({ ...n, stat: byKey.get(n.key) ?? null }))
    .sort((a, b) => (b.stat?.total ?? 0) - (a.stat?.total ?? 0));
  const earned = rows.reduce((s, r) => s + (r.earnedUsd ?? 0), 0);
  const unknown = rows.filter((r) => r.positionSource === null).length;

  const columns: DataColumn<Row>[] = [
    {
      key: 'net', align: 'left', header: 'Network', sortValue: (r) => r.label,
      title: 'Click để xem mọi offer của net này (cùng quick-view với cột Network ở bảng dưới)',
      cell: (r) => <span style={clickable} onClick={() => onNetwork(r.key)}>{r.label}</span>,
    },
    {
      // Cùng chip <EntityRef kind="account"> như bảng offer → click mở drawer account thật
      // (identity + vault), không phải chữ chết. Id + handle đều từ vault, không gõ tay: net chưa
      // có offer nào (Impact, Rakuten) vẫn bấm được, vì account nằm ở vault chứ không nằm ở offer.
      key: 'acct', align: 'left', header: 'Account', sortValue: (r) => r.stat?.account ?? null,
      cell: (r) => (r.stat?.mosAccountId
        ? <EntityRef kind="account" id={r.stat.mosAccountId} noIcon label={handleOf(r.stat.account) ?? r.key} />
        : <span style={dim} title="Chưa có account nào platform_key này trong vault">—</span>),
    },
    {
      key: 'offers', align: 'right', header: 'Offer', sortValue: (r) => r.stat?.total ?? null,
      cell: (r) => r.stat?.total ?? <span style={dim}>—</span>,
      total: (rs) => rs.reduce((s, r) => s + (r.stat?.total ?? 0), 0),
    },
    {
      key: 'approved', align: 'right', header: 'Duyệt', title: 'Offer đã được duyệt — dùng được ngay',
      sortValue: (r) => r.stat?.approved ?? null,
      cell: (r) => r.stat?.approved ?? <span style={dim}>—</span>,
      total: (rs) => rs.reduce((s, r) => s + (r.stat?.approved ?? 0), 0),
    },
    {
      key: 'earned', align: 'right', header: 'Đã kiếm', title: 'Kéo từ API của chính network',
      sortValue: (r) => r.earnedUsd,
      cellTitle: (r) => r.positionNote ?? undefined,
      cell: (r) => (r.earnedUsd == null
        ? <span style={dim} title="Chưa xác minh — vault không có API key">?</span>
        : <span style={r.earnedUsd > 0 ? { color: 'var(--neon-lime)' } : undefined}>{money(r.earnedUsd)}</span>),
      total: (rs) => `$${rs.reduce((s, r) => s + (r.earnedUsd ?? 0), 0).toFixed(2)}`,
    },
    {
      key: 'threshold', align: 'right', header: 'Ngưỡng rút', sortValue: (r) => r.thresholdUsd,
      cellTitle: (r) => r.thresholdNote ?? undefined,
      cell: (r) => (r.thresholdUsd == null
        ? <span style={dim}>—</span>
        : <>{money(r.thresholdUsd)}{r.thresholdNote ? <span style={dim}> *</span> : null}</>),
    },
    {
      key: 'schedule', align: 'left', header: 'Lịch trả', sortValue: (r) => r.schedule,
      cellTitle: (r) => r.schedule ?? undefined,
      cell: (r) => r.schedule ?? <span style={dim}>—</span>,
    },
    {
      key: 'methods', align: 'left', header: 'Hình thức', sortValue: (r) => r.methods,
      cell: (r) => r.methods ?? <span style={dim}>—</span>,
    },
    {
      key: 'src', align: 'center', header: 'Nguồn', title: 'Nguồn của điều khoản — click mở trang help của network',
      sortValue: (r) => r.source,
      cell: (r) => (r.docUrl
        ? <a href={r.docUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--neon-cyan)' }}>docs ↗</a>
        : <span style={dim}>—</span>),
    },
    {
      key: 'note', align: 'left', header: 'Ghi chú', sortValue: (r) => r.positionNote ?? r.thresholdNote,
      cellTitle: (r) => r.positionNote ?? r.thresholdNote ?? undefined,
      cell: (r) => {
        const t = r.positionNote ?? r.thresholdNote;
        return t ? <span style={{ ...dim, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', verticalAlign: 'bottom' }}>{t}</span> : <span style={dim}>—</span>;
      },
    },
  ];

  return (
    <Collapsible
      title="Thanh toán theo network"
      badge={`${rows.length} net · đã kiếm $${earned.toFixed(2)}`}
      hint={unknown ? `${unknown} net chưa xác minh được (vault không có API key)` : undefined}
    >
      <DataTable rows={rows} columns={columns} getRowKey={(r) => r.key} persistKey="network-payouts" minWidth={900} />
      <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
        <b>Đã kiếm</b> kéo từ API của chính network (Awin <code>/transactions</code> quét từng tháng,
        CJ <code>commission-detail v3</code>, Impact report earnings) — kiểm 14/08/2026.
        Dấu <b>?</b> = chưa xác minh vì vault không có API key, phải mở dashboard mới biết — đừng đọc thành 0.
      </p>
    </Collapsible>
  );
}

// Nhãn account trong vault là "network · handle"; cột Network đã mang network rồi (YDNI).
function handleOf(label: string | null): string | null {
  if (!label) return null;
  const i = label.indexOf(' · ');
  return i >= 0 ? label.slice(i + 3) : label;
}
