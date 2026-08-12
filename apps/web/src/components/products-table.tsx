'use client';

// Bảng sản phẩm — dựng trên `ui.DataTable`, KHÔNG tự chế <table>.
//
// Bản đầu em hand-roll thẻ <table> ngay trong panel: mất nhóm cột bật/tắt, mất sắp xếp, mất ô lọc,
// và pad lệch so với bảng SEO ngay bên trên. Đúng cái mà convention của repo đã chốt (ui-conventions
// mục "Bảng NHIỀU DATA mà KHÔNG tràn = <DataTable>"). Đây là file client mỏng để build `columns`
// (cell là hàm, không đi qua ranh giới server → client được), panel bên ngoài vẫn là server comp.

import { DataTable, type DataColumn, type DataGroup } from './ui/data-table';

export interface ProductRow {
  key: string;
  name: string;
  store: string;
  url: string;
  price: number;          // cents
  sales: number;
  usdCents: number;
  views7d: number | null; // null = job đọc lượt xem chưa chạy cho store này
  views30d: number | null;
  missingDiscover: boolean;
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const dim = { color: 'var(--fg-4)' };

const GROUPS: DataGroup[] = [
  { key: 'traffic', label: 'Views', color: '#6ea8fe' },
  { key: 'money', label: 'Doanh thu', color: '#22c55e' },
  { key: 'meta', label: 'Meta', color: '#a78bfa', defaultOn: false },
];

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const columns: DataColumn<ProductRow>[] = [
    {
      key: 'name', header: 'Sản phẩm', align: 'left', sortValue: (r) => r.name,
      cell: (r) => (
        <span style={{ whiteSpace: 'normal' }}>
          <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-1)', textDecoration: 'none' }}>{r.name}</a>
          {/* Thiếu category/tag = tự cắt mình khỏi Gumroad Discover. Nhắc ngay tại dòng. */}
          {r.missingDiscover && <span title="Thiếu category/tag → không lên Discover được" style={{ color: 'var(--warn,#f59e0b)', marginLeft: 6 }}>⚠</span>}
        </span>
      ),
      total: (rs) => `TỔNG (${rs.length})`,
    },
    { key: 'store', header: 'Store', align: 'left', sortValue: (r) => r.store, cell: (r) => <span style={{ color: 'var(--fg-3)' }}>{r.store}</span> },

    {
      key: 'v7', group: 'traffic', header: '7d', title: 'Lượt xem 7 ngày — job trình duyệt đọc từ Gumroad Analytics',
      sortValue: (r) => r.views7d ?? -1,
      cell: (r) => (r.views7d === null ? <span style={dim}>—</span> : <span style={r.views7d ? undefined : dim}>{r.views7d}</span>),
      total: (rs) => rs.reduce((s, r) => s + (r.views7d ?? 0), 0),
    },
    {
      key: 'v30', group: 'traffic', header: '30d', title: 'Lượt xem 30 ngày',
      sortValue: (r) => r.views30d ?? -1,
      cell: (r) => (r.views30d === null ? <span style={dim}>—</span> : <span style={{ color: 'var(--fg-3)' }}>{r.views30d}</span>),
      total: (rs) => rs.reduce((s, r) => s + (r.views30d ?? 0), 0),
    },

    {
      key: 'sales', group: 'money', header: 'Đơn', title: 'Số đơn cộng dồn trọn đời (Gumroad API v2)',
      sortValue: (r) => r.sales,
      cell: (r) => <span style={r.sales ? { color: 'var(--ok)' } : dim}>{r.sales}</span>,
      total: (rs) => rs.reduce((s, r) => s + r.sales, 0),
    },
    {
      key: 'rev', group: 'money', header: 'Doanh thu', sortValue: (r) => r.usdCents,
      cell: (r) => (r.usdCents ? <span style={{ color: 'var(--ok)' }}>{usd(r.usdCents)}</span> : <span style={dim}>—</span>),
      total: (rs) => usd(rs.reduce((s, r) => s + r.usdCents, 0)),
    },
    {
      key: 'price', group: 'money', header: 'Giá', sortValue: (r) => r.price,
      cell: (r) => (r.price ? <span style={{ color: 'var(--fg-2)' }}>{usd(r.price)}</span> : <span style={dim}>free</span>),
    },

    {
      key: 'discover', group: 'meta', header: 'Discover', title: 'Đã điền category + tag chưa (thiếu = không lên Discover)',
      sortValue: (r) => (r.missingDiscover ? 0 : 1),
      cell: (r) => (r.missingDiscover ? <span style={{ color: 'var(--warn,#f59e0b)' }}>thiếu</span> : <span style={{ color: 'var(--ok)' }}>đủ</span>),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      groups={GROUPS}
      persistKey="mos2-products-cols"
      getRowKey={(r) => r.key}
      minWidth={720}
      searchText={(r) => `${r.name} ${r.store}`}
      searchPlaceholder="lọc sản phẩm / store…"
    />
  );
}
