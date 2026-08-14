'use client';

// Bảng email-list dạng CLIENT — tách khỏi panel (async server component) vì DataTable là client
// component: không thể truyền `columns` (chứa hàm `cell`) qua ranh giới RSC. Panel chỉ đẩy sang đây
// dữ liệu serializable (rows + products + showOther); cột dựng TẠI ĐÂY, port nguyên markup từ SimpleTable.

import { DataTable, type DataColumn } from './ui/data-table';
import { type MailwizzList } from '@/lib/mailwizz';

const num = (n: number) => n.toLocaleString('en-US');
const daysAgo = (iso: string | null) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'hôm nay' : `${d} ngày trước`;
};

export function MailwizzListsTable({
  rows, products, showOther, persistKey,
}: {
  rows: MailwizzList[];
  products: Record<string, string>;
  showOther: boolean;
  persistKey: string;   // live/dead mount cùng component → PHẢI khác key, không thì sort/view đè lên nhau
}) {
  const cols: DataColumn<MailwizzList>[] = [
    {
      key: 'list', header: 'List', align: 'left',
      sortValue: (l) => l.name.toLowerCase(),
      cell: (l) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{l.name}</span>
            {products[l.uid] && (
              <span title="list gắn với một sản phẩm" style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--accent)', border: '1px solid var(--line)', borderRadius: 4, padding: '0 5px' }}>
                📕 {products[l.uid]}
              </span>
            )}
            {l.status !== 'active' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--fg-3)' }}>[{l.status}]</span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{l.uid}</div>
        </div>
      ),
    },
    {
      key: 'confirmed', header: 'Gửi được', align: 'right',
      sortValue: (l) => l.confirmed,
      cell: (l) => <span style={{ fontVariantNumeric: 'tabular-nums', color: l.confirmed ? undefined : 'var(--fg-3)' }}>{num(l.confirmed)}</span>,
    },
    {
      key: 'unsub', header: 'Đã huỷ', align: 'right',
      sortValue: (l) => l.unsubscribed,
      cell: (l) => <span style={{ fontVariantNumeric: 'tabular-nums', color: l.unsubscribed ? undefined : 'var(--fg-3)' }}>{num(l.unsubscribed)}</span>,
    },
    // Cột chỉ xuất hiện khi có số — hôm nay mọi list đều 0, in ra một cột toàn số 0 là nhiễu.
    ...(showOther ? [{
      key: 'other', header: 'Khác', align: 'right' as const,
      title: 'unconfirmed / blacklisted / disabled — chưa gửi được nhưng cũng chưa huỷ',
      sortValue: (l: MailwizzList) => l.other,
      cell: (l: MailwizzList) => <span style={{ fontVariantNumeric: 'tabular-nums', color: l.other ? undefined : 'var(--fg-3)' }}>{num(l.other)}</span>,
    }] : []),
    {
      key: 'last', header: 'Người mới gần nhất', align: 'right',
      sortValue: (l) => l.last,
      cell: (l) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{l.last ? `${l.last.slice(0, 10)} · ${daysAgo(l.last)}` : '—'}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={cols}
      getRowKey={(l) => l.uid}
      card
      defaultView="table"
      persistKey={persistKey}
      pageSize={25}
    />
  );
}
