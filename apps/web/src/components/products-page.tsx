'use client';

// /products — toàn bộ hàng mình bán, và nền tảng nào thực sự ra tiền.
//
// YDNI: bề mặt mặc định trả lời đúng một câu — "công sức nên đổ vào đâu". Nên phần
// đầu là bảng NỀN TẢNG (ít dòng, quyết định được), danh sách sản phẩm nằm dưới và gập
// lại. Màu chỉ ở cột thực nhận.
//
// Ô "chưa đo" KHÔNG được hiển thị giống $0. Bản trước quy hết về 0 nên bảng đọc ra
// "36 sản phẩm chỉ 1 cái ra tiền", trong khi sự thật là 6/7 nền tảng chưa có collector
// nào chạy. Xem lib/products/data.ts.

import { useMemo, useState } from 'react';
import type { ProductsView, ProductRow } from '@/lib/products/data';
import { Section, StatsStrip, ListToolbar, FilterChips, EmptyState, Pill } from './ui';
import type { StatCard } from './ui/stats-strip';

const usd = (n: number) => n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(0)}` : n > 0 ? `$${n.toFixed(2)}` : '$0';

/** Ba trạng thái khác nhau, ba cách hiện: có tiền · đo được và bằng 0 · chưa đo. */
function Money({ n, bold }: { n: number | null; bold?: boolean }) {
  if (n == null) return <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontStyle: 'italic' }}>chưa đo</span>;
  return <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)', fontWeight: bold && n > 0 ? 600 : 400 }}>{usd(n)}</span>;
}

const daysAgo = (d: string | null) => {
  if (!d) return null;
  return Math.round((Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86400_000);
};

export function ProductsPage({ view }: { view: ProductsView }) {
  const { rows, platforms, windowDays } = view;
  const [q, setQ] = useState('');
  const [plat, setPlat] = useState('all');

  const live = rows.filter((r) => r.status === 'published').length;
  const measured = platforms.filter((p) => p.measured > 0);
  const blind = platforms.filter((p) => p.measured === 0);
  const totalNet = measured.reduce((a, p) => a + (p.net ?? 0), 0);
  const blindProducts = blind.reduce((a, p) => a + p.products, 0);
  const best = platforms[0];

  const cards: StatCard[] = [
    { key: 'n', label: 'Sản phẩm', value: String(rows.length), color: 'var(--fg-0)',
      title: `${live} đang bán trên ${platforms.length} nền tảng` },
    { key: 'cov', label: 'Nền tảng đo được', value: `${measured.length}/${platforms.length}`,
      color: blind.length ? 'var(--warn)' : 'var(--ok)',
      title: blind.length ? `Chưa có nguồn doanh thu: ${blind.map((p) => p.platform).join(', ')}` : 'Đủ nguồn' },
    { key: 'net', label: `Thực nhận (${windowDays}n)`, value: usd(totalNet), color: 'var(--ok)',
      title: `Chỉ cộng từ ${measured.length} nền tảng có số thật` },
    { key: 'top', label: 'Nền tảng ra tiền nhất', value: best?.net ? best.platform : '—',
      color: 'var(--neon-cyan)', title: best?.net ? `${usd(best.net)} từ ${best.measured} sản phẩm đo được` : '' },
  ];

  const filtered = useMemo(() => rows.filter((r) => {
    if (plat !== 'all' && r.platform !== plat) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, plat, q]);

  // Giữ đúng thứ tự nền tảng của bảng trên (nhiều tiền trước) để hai phần khớp nhau.
  const groups = useMemo(() => platforms
    .map((p) => ({ platform: p.platform, net: p.net, rows: filtered.filter((r) => r.platform === p.platform) }))
    .filter((g) => g.rows.length), [platforms, filtered]);

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

      {blind.length > 0 && (
        <div style={{ margin: '10px 0 0', padding: '7px 10px', fontSize: 11.5, lineHeight: 1.5,
          border: '1px solid var(--warn)', borderRadius: 6, color: 'var(--fg-2)', background: 'transparent' }}>
          <strong style={{ color: 'var(--warn)' }}>{blindProducts} sản phẩm chưa đo được doanh thu</strong>{' '}
          ({blind.map((p) => p.platform).join(', ')}) — ô ghi <em>chưa đo</em> nghĩa là chưa có nguồn số,
          không phải bán được $0.
        </div>
      )}

      {/* Bề mặt quyết định: nền tảng nào đáng đổ công. */}
      <Section title="Theo nền tảng" subtitle="thực nhận trên MỖI sản phẩm ĐO ĐƯỢC — số để so nền tảng với nhau">
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              {['Nền tảng', 'Sản phẩm', 'Đang bán', 'Đo được', `Thực nhận ${windowDays}n`, '$/sản phẩm', 'Số liệu mới nhất'].map((h, i) => (
                <th key={h} style={{ padding: '6px 10px', fontSize: 9.5, fontWeight: 600, color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em',
                  textAlign: i ? 'right' : 'left', borderBottom: '1px solid var(--line)' }}>{h}</th>))}
            </tr></thead>
            <tbody>
              {platforms.map((p) => {
                const age = daysAgo(p.lastStat);
                return (
                  <tr key={p.platform}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', color: 'var(--fg-0)' }}>{p.platform}</td>
                    <Td>{p.products}</Td>
                    <Td>{p.live}</Td>
                    {/* Nền tảng chỉ chia tiền ở mức tài khoản thì nói thẳng, đừng ghi 0/20
                        cạnh một con số tiền có thật — đọc ra thành mâu thuẫn. */}
                    <Td style={{ color: p.measured || p.platformOnly ? 'var(--fg-1)' : 'var(--fg-3)', fontSize: p.platformOnly ? 10.5 : undefined }}
                      title={p.platformOnly ? 'Nền tảng chỉ trả doanh thu cho cả tài khoản, không tách theo từng sản phẩm' : undefined}>
                      {p.platformOnly ? 'mức tài khoản' : `${p.measured}/${p.products}`}
                    </Td>
                    <Td><Money n={p.net} bold /></Td>
                    <Td style={{ color: 'var(--fg-2)' }}>{p.perProduct == null ? '—' : usd(p.perProduct)}</Td>
                    <Td style={{ color: age != null && age > 7 ? 'var(--warn)' : 'var(--fg-3)', fontSize: 11 }}>
                      {p.lastStat ? (age === 0 ? 'hôm nay' : `${age}n trước`) : 'chưa từng'}
                    </Td>
                  </tr>
                );
              })}
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
            {groups.map((g) => <Group key={g.platform} g={g} />)}
          </div>
        )}
      </Section>
    </div>
  );
}

/**
 * Gộp theo nền tảng thay vì liệt kê phẳng. Hai lý do, đều là YDNI:
 *  - Cột thẳng hàng: mỗi dòng là grid CHUNG một template, không phải flex tự co.
 *  - Hết lặp: nền tảng chưa đo được thì nói MỘT lần ở đầu nhóm, không phải in
 *    "chưa đo" 35 dòng liên tiếp. Nhóm nào chưa đo thì bỏ hẳn cột tiền.
 */
const COLS = (money: boolean) => `1fr 60px 56px 74px 46px${money ? ' 62px' : ''}`;

function Group({ g }: { g: { platform: string; rows: ProductRow[]; net: number | null } }) {
  const money = g.net != null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 10px 5px',
        borderBottom: '1px solid var(--line)', background: 'var(--bg-1)' }}>
        <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
          textTransform: 'uppercase', letterSpacing: '.06em' }}>{g.platform}</span>
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{g.rows.length} sản phẩm</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {money ? <Money n={g.net} bold />
            : <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontStyle: 'italic' }}>chưa đo được doanh thu</span>}
        </span>
      </div>
      {g.rows.map((r) => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS(money), alignItems: 'center',
          gap: 10, padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}>{r.title}</a> : r.title}
          </span>
          <span>{r.status !== 'published' && <Pill label={r.status ?? 'draft'} color="var(--fg-3)" size="xs" tone="soft" />}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}
            title={r.students != null ? 'người đã ghi danh' : undefined}>
            {r.students ? r.students.toLocaleString('en-US') : ''}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            {r.rating != null ? `${r.rating.toFixed(2)}★${r.reviews ? ` ${r.reviews}` : ''}` : ''}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            {r.price ? `$${r.price}` : ''}</span>
          {money && <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
            <Money n={r.net} /></span>}
        </div>
      ))}
    </div>
  );
}

function Td({ children, style, title }: { children: React.ReactNode; style?: React.CSSProperties; title?: string }) {
  return <td title={title} style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right',
    fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', ...style }}>{children}</td>;
}
