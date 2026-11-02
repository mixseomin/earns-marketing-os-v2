'use client';
// Panel "📺 Kênh nội dung" của tab Tài sản (anh 02/11/2026: kênh nội dung là SẢN PHẨM — video full, social short đổ traffic về sau).
// Một kênh một dòng: tập đã làm / chờ đăng / đã đăng, người đăng ký, lượt xem cộng dồn + 7 ngày. Số từ lib/tai-san/kenh-sp.ts (may-dung.mts --so-kenh ghi).
import { DataTable, Panel, type DataColumn } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import type { KenhSp } from '@/lib/tai-san/kenh-sp-tinh';
import { cotSocial, nhomSocial } from './tai-san-social';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
const mo: React.CSSProperties = { color: 'var(--fg-4)' };
const tang = (n: number | null) => (n == null ? <span style={mo}>–</span> : <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{n > 0 ? '+' : ''}{so(n)}</span>);

export function TaiSanKenhSp({ kenh, kySocial = 7 }: { kenh: KenhSp[]; kySocial?: number }) {
  if (!kenh.length) return null;
  const cot: DataColumn<KenhSp>[] = [
    { key: 'kenh', header: 'Kênh', align: 'left', width: 240, sortValue: (k) => k.ten,
      cell: (k) => <span style={{ fontFamily: 'var(--font-sans)' }}>
        {k.kenhUrl ? <a {...extLinkProps(k.kenhUrl)} style={{ fontWeight: 700, color: 'inherit' }}>{k.ten}</a> : <b>{k.ten}</b>}
        <span style={{ color: k.chay ? 'var(--ok)' : 'var(--fg-4)', fontSize: 11, marginLeft: 6 }}>{k.chay ? 'đang chạy' : 'chưa bật đăng'}</span></span> },
    ...cotSocial<KenhSp>((k) => k.social, kySocial),
    { key: 'tap', header: 'Tập', width: 64, sortValue: (k) => k.tap, cellTitle: (k) => `${k.tap} tập đã làm (không tính bản cất)`, cell: (k) => so(k.tap) },
    { key: 'cho', header: 'Chờ đăng', width: 84, sortValue: (k) => k.choDang, cell: (k) => (k.choDang ? <b style={{ color: 'var(--warn)' }}>{k.choDang}</b> : <span style={mo}>0</span>) },
    { key: 'da', header: 'Đã đăng', width: 76, sortValue: (k) => k.daDang, cell: (k) => so(k.daDang) },
    { key: 'dk', header: 'Người đăng ký', width: 116, sortValue: (k) => k.nguoiDk, cell: (k) => <b style={{ fontVariantNumeric: 'tabular-nums' }}>{so(k.nguoiDk)}</b> },
    { key: 'dk7', header: 'ĐK 7 ngày', width: 88, sortValue: (k) => k.nguoiDk7, cell: (k) => tang(k.nguoiDk7) },
    { key: 'xem', header: 'Lượt xem', width: 96, sortValue: (k) => k.xem, cellTitle: () => 'cộng dồn mọi video đã đăng', cell: (k) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{so(k.xem)}</span> },
    { key: 'xem7', header: 'Xem 7 ngày', width: 96, sortValue: (k) => k.xem7, cell: (k) => tang(k.xem7) },
    { key: 'dang', header: 'Đăng cuối', width: 84, sortValue: (k) => k.dangCuoi, cell: (k) => ngayVn(k.dangCuoi) },
    { key: 'so', header: 'Số tới', width: 72, sortValue: (k) => k.ngaySo, cell: (k) => (k.ngaySo ? ngayVn(k.ngaySo) : <span style={mo}>chưa đo</span>) },
  ];
  return (
    <Panel title="📺 Kênh nội dung" subtitle={'kênh nội dung là sản phẩm (video trọn chuyện) · "–" = chưa đo (khác 0) · số đọc hằng ngày từ trang YouTube công khai'}>
      <DataTable rows={kenh} columns={cot} groups={[nhomSocial(kySocial)]} getRowKey={(k) => k.ma} persistKey="tai-san-kenh-sp" fixedLayout minWidth={240 + 260 + 64 + 84 + 76 + 116 + 88 + 96 + 96 + 84 + 72} card />
    </Panel>
  );
}
