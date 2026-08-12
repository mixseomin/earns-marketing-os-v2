// SẢN PHẨM MÌNH BÁN — một dòng một sản phẩm, đủ views · orders · doanh thu · giá · trạng thái.
//
// Đặt ngay dưới SEO Sites Overview vì hai bảng trả lời hai nửa của cùng một câu: có ai đi ngang
// không, và có ai mua không. Trước đây doanh thu nằm ở /revenue còn lượt xem thì chỉ đọc được bằng
// cách mở tay giao diện Gumroad — không nhìn cạnh nhau được, nên không thấy chỗ gãy.
//
// HAI NGUỒN, và phải nói rõ nguồn nào cho cột nào, không thì số 0 gây hiểu nhầm:
//   · orders/doanh thu/giá  ← Gumroad API v2, cộng dồn TRỌN ĐỜI, luôn tươi.
//   · views                  ← bảng product_daily, do job trình duyệt local đẩy hằng ngày.
//     API v2 không có trường này. Job chưa chạy thì cột views là "—", KHÔNG phải 0.
import { Panel } from './ui/panel';
import { getGumroadSummary } from '@/lib/gumroad/products';
import { loadProductViews } from '@/lib/gumroad/daily';

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export async function ProductsPanel() {
  const [sum, views] = await Promise.all([getGumroadSummary(), loadProductViews()]);

  if (!sum.ok) {
    return (
      <Panel title="Products Overview">
        <p style={{ color: 'var(--fg-3)', fontSize: 12, margin: 0 }}>Không đọc được Gumroad — {sum.error}</p>
      </Panel>
    );
  }

  const rows = sum.products.filter((p) => p.published)
    .map((p) => ({ ...p, v: views.byProduct[`${p.store}:${p.id}`] ?? null }));
  const totalViews7 = rows.reduce((s, r) => s + (r.v?.views7d ?? 0), 0);
  const anyViews = rows.some((r) => r.v);

  const cell: React.CSSProperties = { padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' };
  const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 };
  const left: React.CSSProperties = { ...cell, textAlign: 'left', whiteSpace: 'normal' };

  return (
    <Panel
      title="Products Overview"
      subtitle={`${rows.length} sản phẩm đang bán · ${sum.stores.length} store · ${sum.totalSales} đơn · $${sum.totalUsd.toLocaleString('en-US')} trọn đời${views.lastSync ? ` · views tới ${views.lastSync}` : ' · views CHƯA có'}`}
      actions={<a href="/revenue" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-2)', textDecoration: 'none', background: 'var(--bg-2)' }}>💵 Revenue</a>}
    >
      <div style={{ overflowX: 'auto', margin: '0 -8px' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>Sản phẩm</th>
              <th style={{ ...head, textAlign: 'left' }}>Store</th>
              <th style={head} title="Lượt xem 7 ngày — job trình duyệt đọc từ Gumroad Analytics">Views 7d</th>
              <th style={head} title="Lượt xem 30 ngày">30d</th>
              <th style={head} title="Số đơn cộng dồn trọn đời (API v2)">Đơn</th>
              <th style={head}>Doanh thu</th>
              <th style={head}>Giá</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={`${p.store}:${p.id}`}>
                <td style={left}>
                  <a href={p.url} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-1)', textDecoration: 'none' }}>{p.name}</a>
                  {/* Thiếu category/tag = tự cắt mình khỏi Gumroad Discover. Nhắc ngay tại dòng. */}
                  {(!p.tags.length || !p.category) && <span title="Thiếu category/tag → không lên Discover được" style={{ color: 'var(--warn,#f59e0b)', marginLeft: 6 }}>⚠</span>}
                </td>
                <td style={{ ...left, color: 'var(--fg-3)', fontSize: 11 }}>{p.store}</td>
                <td style={{ ...cell, color: p.v?.views7d ? 'var(--fg-1)' : 'var(--fg-4)' }}>{p.v ? p.v.views7d : '—'}</td>
                <td style={{ ...cell, color: 'var(--fg-3)' }}>{p.v ? p.v.views30d : '—'}</td>
                <td style={{ ...cell, color: p.salesCount ? 'var(--ok)' : 'var(--fg-4)' }}>{p.salesCount}</td>
                <td style={{ ...cell, color: p.salesUsdCents ? 'var(--ok)' : 'var(--fg-4)' }}>{p.salesUsdCents ? usd(p.salesUsdCents) : '—'}</td>
                <td style={{ ...cell, color: 'var(--fg-2)' }}>{p.priceCents ? usd(p.priceCents) : 'free'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td style={left} colSpan={7}>Chưa có sản phẩm nào đang bán.</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...left, fontWeight: 700 }}>TỔNG ({rows.length})</td>
              <td style={left} />
              <td style={{ ...cell, fontWeight: 700 }}>{anyViews ? totalViews7 : '—'}</td>
              <td style={cell} />
              <td style={{ ...cell, fontWeight: 700 }}>{sum.totalSales}</td>
              <td style={{ ...cell, fontWeight: 700 }}>${sum.totalUsd.toLocaleString('en-US')}</td>
              <td style={cell} />
            </tr>
          </tfoot>
        </table>
      </div>
      {!anyViews && (
        <p style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', margin: '10px 0 0' }}>
          Cột views trống vì job đọc Gumroad Analytics chưa chạy lần nào — chạy tay: <code>~/bin/gumroad-views</code>
        </p>
      )}
    </Panel>
  );
}
