'use client';

import { Collapsible } from './ui';
import { NETWORK_PAYOUTS, payoutByNetwork } from '@/lib/affiliate-networks';

// "Network nào trả bao nhiêu, và mình đang có gì ở đó" — tầng TRÊN bảng offer.
// Cột Đã kiếm/Số dư là vị thế của TÀI KHOẢN mình; Ngưỡng/Lịch/Hình thức là điều khoản của
// network. Ô trống = chưa xác minh (không có credential API), KHÔNG phải bằng 0.
export function NetworkPayoutsPanel({ networks }: { networks: Array<{ key: string; total: number; approved: number; runnable: number }> }) {
  const byKey = new Map(networks.map((n) => [n.key, n]));
  // Network mình có tài khoản, xếp theo lượng offer đang cầm.
  const rows = NETWORK_PAYOUTS.map((n) => ({ ...n, stat: byKey.get(n.key) ?? null }))
    .sort((a, b) => (b.stat?.total ?? 0) - (a.stat?.total ?? 0));
  const earned = rows.reduce((s, r) => s + (r.earnedUsd ?? 0), 0);
  const unknown = rows.filter((r) => r.positionSource === null).length;

  const th: React.CSSProperties = { textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: 'var(--fg-2)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '5px 8px', borderTop: '1px solid var(--line)', verticalAlign: 'top' };
  const dim = { color: 'var(--fg-3)' };
  const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' };

  return (
    <Collapsible
      title="Thanh toán theo network"
      badge={`${rows.length} net · đã kiếm $${earned.toFixed(2)}`}
      hint={unknown ? `${unknown} net chưa xác minh được (không có API key trong vault)` : undefined}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th}>Network</th>
              <th style={th}>Tài khoản</th>
              <th style={{ ...th, textAlign: 'right' }}>Offer</th>
              <th style={{ ...th, textAlign: 'right' }}>Duyệt</th>
              <th style={{ ...th, textAlign: 'right' }}>Đã kiếm</th>
              <th style={{ ...th, textAlign: 'right' }}>Ngưỡng rút</th>
              <th style={th}>Lịch trả</th>
              <th style={th}>Hình thức</th>
              <th style={th}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={{ ...td, fontWeight: 600 }}>
                  {r.docUrl
                    ? <a href={r.docUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-cyan)' }}>{r.label}</a>
                    : r.label}
                </td>
                <td style={{ ...td, ...dim }}>{r.account ?? '—'}</td>
                <td style={num}>{r.stat?.total ?? <span style={dim}>—</span>}</td>
                <td style={num}>{r.stat ? r.stat.approved : <span style={dim}>—</span>}</td>
                <td style={num} title={r.positionNote ?? undefined}>
                  {r.earnedUsd == null
                    ? <span style={dim} title="Chưa xác minh — cần login dashboard">?</span>
                    : <span style={{ color: r.earnedUsd > 0 ? 'var(--neon-lime)' : undefined }}>${r.earnedUsd.toFixed(2)}</span>}
                </td>
                <td style={num} title={r.thresholdNote ?? undefined}>
                  {r.thresholdUsd == null ? <span style={dim}>—</span> : `$${r.thresholdUsd}`}
                  {r.thresholdNote ? <span style={dim}> *</span> : null}
                </td>
                <td style={td}>{r.schedule ?? <span style={dim}>—</span>}</td>
                <td style={td}>{r.methods ?? <span style={dim}>—</span>}</td>
                <td style={{ ...td, ...dim, maxWidth: 320 }}>{r.positionNote ?? r.thresholdNote ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '8px 2px 0', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
        <b>Đã kiếm</b> kéo từ API của chính network (Awin <code>/transactions</code> quét từng tháng,
        CJ <code>publisherCommissions</code>, Impact report earnings) — kiểm ngày 14/08/2026.
        Dấu <b>?</b> = chưa xác minh vì vault không có API key, phải mở dashboard mới biết;
        đừng đọc thành 0. Điều khoản lấy từ trang help của network (click tên net để mở nguồn).
      </p>
    </Collapsible>
  );
}
