'use client';

// /products — toàn bộ hàng mình bán, và nền tảng nào thực sự ra tiền.
//
// YDNI: bề mặt mặc định trả lời đúng một câu — "công sức nên đổ vào đâu". Nên phần
// đầu là bảng NỀN TẢNG (ít dòng, quyết định được), danh sách 32 sản phẩm nằm dưới và
// gập lại. Màu chỉ ở cột thực nhận; nền tảng $0 để xám, không tô đỏ — không bán được
// không phải lỗi, chỉ là dữ kiện.

import { useMemo, useState } from 'react';
import type { ProductsView, ProductRow } from '@/lib/products/data';
import { Section, StatsStrip, ListToolbar, FilterChips, EmptyState, Pill } from './ui';
import type { StatCard } from './ui/stats-strip';

const usd = (n: number) => n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(0)}` : n > 0 ? `$${n.toFixed(2)}` : '—';

export function ProductsPage({ view }: { view: ProductsView }) {
  const { rows, platforms, windowDays } = view;
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState('all');

  const live = rows.filter((r) => r.status === 'published').length;
  const earning = rows.filter((r) => r.net > 0).length;
  const totalNet = rows.reduce((a, r) => a + r.net, 0);
  const best = platforms[0];

  const cards: StatCard[] = [
    { key: 'n', label: 'Sản phẩm', value: String(rows.length), color: 'var(--fg-0)',
      title: `${live} đang bán trên ${platforms.length} nền tảng` },
    { key: 'earn', label: `Có ra tiền (${windowDays}n)`, value: `${earning}/${rows.length}`,
      color: earning ? 'var(--ok)' : 'var(--warn)', title: 'Số sản phẩm thực sự phát sinh doanh thu trong cửa sổ' },
    { key: 'net', label: `Thực nhận (${windowDays}n)`, value: usd(totalNet), color: 'var(--ok)' },
    { key: 'top', label: 'Nền tảng ra tiền nhất', value: best ? best.platform : '—',
      color: 'var(--neon-cyan)', title: best ? `${usd(best.net)} từ ${best.products} sản phẩm` : '' },
  ];

  const filtered = useMemo(() => rows.filter((r) => {
    if (plat !== 'all' && r.platform !== plat) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, plat, q]);

  return (
    <div style={{ padding: '16px 20px 60px' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          📦 Products <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>
            // {rows.length} sản phẩm · {platforms.length} nền tảng</small>
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Mọi thứ mình bán, gộp từ Directus <code>products</code> + <code>product_stats</code>.
          Tiền là <strong style={{ color: 'var(--fg-1)' }}>thực nhận</strong> trong {windowDays} ngày, không phải doanh số gộp.
        </p>
      </div>

      <StatsStrip cards={cards} />

      {/* Bề mặt quyết định: nền tảng nào đáng đổ công. */}
      <Section title="Theo nền tảng" subtitle="thực nhận trên MỖI sản phẩm — số để so nền tảng với nhau">
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              {['Nền tảng', 'Sản phẩm', 'Đang bán', `Thực nhận ${windowDays}n`, '$/sản phẩm'].map((h, i) => (
                <th key={h} style={{ padding: '6px 10px', fontSize: 9.5, fontWeight: 600, color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em',
                  textAlign: i ? 'right' : 'left', borderBottom: '1px solid var(--line)' }}>{h}</th>))}
            </tr></thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.platform}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', color: 'var(--fg-0)' }}>{p.platform}</td>
                  <Td>{p.products}</Td>
                  <Td>{p.live}</Td>
                  <Td style={{ color: p.net > 0 ? 'var(--ok)' : 'var(--fg-3)', fontWeight: p.net > 0 ? 600 : 400 }}>{usd(p.net)}</Td>
                  <Td style={{ color: 'var(--fg-2)' }}>{usd(p.perProduct)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Tất cả sản phẩm (${rows.length})`} defaultOpen={false}>
        <ListToolbar search={q} onSearch={setQ} searchPlaceholder="Tìm sản phẩm…">
          <FilterChips value={plat} onChange={setPlat}
            options={[{ value: 'all', label: 'Mọi nền tảng' },
              ...platforms.map((p) => ({ value: p.platform, label: p.platform }))]} />
        </ListToolbar>
        {filtered.length === 0 ? <EmptyState icon="📦" compact title="Không có sản phẩm khớp bộ lọc" /> : (
          <div className="panel" style={{ padding: 0 }}>
            {filtered.map((r) => <Row key={r.id} r={r} />)}
          </div>
        )}
      </Section>
    </div>
  );
}

function Row({ r }: { r: ProductRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--line)' }}>
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}>{r.title}</a> : r.title}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', minWidth: 84 }}>{r.platform}</span>
      {r.status !== 'published' && <Pill label={r.status ?? 'draft'} color="var(--fg-3)" size="xs" tone="soft" />}
      {r.rating != null && <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
        {r.rating.toFixed(2)}★{r.reviews ? ` ${r.reviews}` : ''}</span>}
      <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', minWidth: 44, textAlign: 'right' }}>
        {r.price ? `$${r.price}` : ''}</span>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', minWidth: 62, textAlign: 'right',
        color: r.net > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{usd(r.net)}</span>
    </div>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right',
    fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', ...style }}>{children}</td>;
}
