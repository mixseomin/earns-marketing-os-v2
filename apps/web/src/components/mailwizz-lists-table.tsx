'use client';

// Bảng email-list dạng CLIENT — tách khỏi panel (async server component) vì DataTable là client
// component: không thể truyền `columns` (chứa hàm `cell`) qua ranh giới RSC. Panel chỉ đẩy sang đây
// dữ liệu serializable (rows + products + showOther); cột dựng TẠI ĐÂY, port nguyên markup từ SimpleTable.

import { useEffect, useState } from 'react';
import { DataTable, type DataColumn } from './ui/data-table';
import { Drawer } from './ui/drawer';
import type { MailwizzList, MailwizzNguoi } from '@/lib/mailwizz';
import { xemNguoiDangKy } from '@/lib/actions/mailwizz-xem';
import { useModalParam } from '@/lib/use-modal-param';

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

  // Bấm một list → ngăn kéo người đăng ký (chỉ xem). Khoá URL riêng ?mw=list&mwId=<uid> để không đụng ?m= của trang chứa (trang chủ / Social Traffic).
  const ngan = useModalParam('mw');
  const moUid = ngan.is('list') ? ngan.id : null;
  return (
    <>
      <DataTable
        rows={rows}
        columns={cols}
        getRowKey={(l) => l.uid}
        card
        defaultView="table"
        persistKey={persistKey}
        pageSize={25}
        onRowClick={(l) => ngan.open('list', l.uid)}
      />
      {moUid && <NganNguoiDangKy uid={moUid} ten={rows.find((l) => l.uid === moUid)?.name} onClose={() => ngan.close()} />}
    </>
  );
}

const NHAN_TT: Record<string, [string, string]> = { confirmed: ['var(--ok)', 'gửi được'], unsubscribed: ['var(--fg-3)', 'đã huỷ'], unconfirmed: ['var(--warn)', 'chưa xác nhận'], blacklisted: ['var(--bad)', 'chặn'], disabled: ['var(--fg-3)', 'tắt'] };

/** Ngăn kéo người đăng ký của một list — tự tải theo uid (F5 mở lại được), lỗi hiện trong ngăn. */
function NganNguoiDangKy({ uid, ten, onClose }: { uid: string; ten?: string; onClose: () => void }) {
  const [kq, setKq] = useState<Awaited<ReturnType<typeof xemNguoiDangKy>> | null>(null);
  useEffect(() => { let song = true; setKq(null); xemNguoiDangKy(uid).then((r) => song && setKq(r)).catch((e) => song && setKq({ ok: false, loi: String(e?.message ?? e) })); return () => { song = false; }; }, [uid]);
  const cot: DataColumn<MailwizzNguoi>[] = [
    { key: 'email', header: 'Email', align: 'left', sortValue: (n) => n.email, cell: (n) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{n.email}</span> },
    { key: 'tt', header: 'Trạng thái', sortValue: (n) => n.status, cell: (n) => { const [mau, chu] = NHAN_TT[n.status] ?? ['var(--fg-3)', n.status]; return <span style={{ color: mau, fontSize: 12 }}>{chu}</span>; } },
    { key: 'nguon', header: 'Nguồn', sortValue: (n) => n.source, cell: (n) => <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{n.source || '—'}</span> },
    { key: 'them', header: 'Ngày thêm', align: 'right', sortValue: (n) => n.added, cell: (n) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{n.added ? `${n.added.slice(0, 10)} · ${daysAgo(n.added)}` : '—'}</span> },
  ];
  return (
    <Drawer onClose={onClose} width={900}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{ten ?? uid}</h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{uid}</span>
          {kq?.ok && <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{num(kq.tong)} người{kq.tong > kq.nguoi.length ? ` · hiện ${num(kq.nguoi.length)} mới nhất` : ''}</span>}
        </div>
        {!kq ? <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải…</div>
          : !kq.ok ? <div style={{ fontSize: 12, color: 'var(--bad)' }}>Không đọc được MailWizz: {kq.loi}</div>
          : <DataTable rows={kq.nguoi} columns={cot} getRowKey={(n) => n.email} persistKey="mw_nguoi" pageSize={50} searchText={(n) => `${n.email} ${n.status} ${n.source}`} searchPlaceholder="Tìm email…" />}
      </div>
    </Drawer>
  );
}
