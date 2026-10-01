'use client';
// /shop › Nhà cung cấp — đi từ NCC xuống (anh chốt 01/10/2026): danh sách NCC (shop_cua_hang.ncc — hiện là CJ) → thẻ tổng quan NCC (sản
// phẩm nguồn, biến thể đã gắn/lỗi, đơn đã đặt/chờ trả/trễ, số dư ví, hồ sơ mở) → sản phẩm nguồn (mình bán gì ↔ món nào bên CJ, giá vốn,
// số biến thể, bao nhiêu shop khác cũng bán — ncc_info đọc mỗi ngày) → trao đổi (hồ sơ NCC, components/shop-ho-so.tsx).
// CJ không trả tên người bán thật phía sau (supplierName trống) nên NCC = CJ. URL: ?ncc=<khoá>.
import { useEffect, useMemo, useState } from 'react';
import { FilterChips, LinkChip, Panel, Pill, SimpleTable, StatsStrip } from '@/components/ui';
import { LINK_DS_CJ, gio, tien } from '@/lib/shop/buoc';
import type { BienTheDong, CuaHangDong, DonDong, SanPhamDong } from '@/lib/shop/doc';
import type { HoSoDong } from '@/lib/shop/ho-so-doc';
import { shopSoDuNcc } from '@/lib/actions/shop';
import { BangHoSo } from './shop-ho-so';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
/** Sổ NCC đã nối — thêm NCC mới (vd AliExpress, nhà máy riêng) = thêm một dòng ở đây + nhánh đặt đơn trong lib/shop/dong-bo.ts. */
const NCC: Record<string, { ten: string; mo_ta: string; link?: { nhan: string; url: string } }> = {
  cj: { ten: 'CJ Dropshipping', mo_ta: 'Đặt đơn, trả tiền, lấy vận đơn qua API CJ; khiếu nại (dispute) đọc mỗi 10 phút.', link: { nhan: 'Đơn trên CJ', url: LINK_DS_CJ } },
};

export function BangNcc({ ch, cuaHang, sanPham, bienThe, don, hoSo }: { ch: string; cuaHang: CuaHangDong[]; sanPham: SanPhamDong[]; bienThe: BienTheDong[]; don: DonDong[]; hoSo: HoSoDong[] }) {
  const shops = cuaHang.filter((c) => ch === 'all' || c.khoa === ch);
  const ds = [...new Set(shops.map((c) => c.ncc))];
  const [ncc, setNcc] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ncc')) || ds[0] || 'cj');
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (ncc !== ds[0]) u.set('ncc', ncc); else u.delete('ncc');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`);
  }, [ncc]); // eslint-disable-line react-hooks/exhaustive-deps
  const [soDu, setSoDu] = useState<number | null | undefined>(undefined);
  useEffect(() => { if (ncc === 'cj') shopSoDuNcc().then(setSoDu).catch(() => setSoDu(null)); }, [ncc]);

  const khoaShop = new Set(shops.filter((c) => c.ncc === ncc).map((c) => c.khoa));
  const sps = sanPham.filter((p) => khoaShop.has(p.cuaHang));
  const bts = bienThe.filter((b) => khoaShop.has(b.cuaHang));
  const dons = don.filter((d) => khoaShop.has(d.cuaHang) && d.ncc);
  const hs = hoSo.filter((h) => h.ben === 'ncc' && khoaShop.has(h.cuaHang));
  const loiBt = (b: BienTheDong) => { const p = sps.find((x) => x.id === b.sanPhamId); return !b.maNcc || b.giaVon === null || (!!p?.nccInfo?.vids?.length && !p.nccInfo.vids.includes(b.maNcc)); };
  const info = NCC[ncc] ?? { ten: ncc.toUpperCase(), mo_ta: '' };
  const nguon = useMemo(() => sps.map((p) => ({ p, gan: bts.filter((b) => b.sanPhamId === p.id && b.maNcc).length, tong: bts.filter((b) => b.sanPhamId === p.id).length,
    loi: bts.filter((b) => b.sanPhamId === p.id && loiBt(b)).length })), [sps, bts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (<>
    {ds.length > 1 && <div style={{ marginBottom: 8 }}><FilterChips urlKey="ncc" value={ncc} onChange={setNcc} options={ds.map((k) => ({ value: k, label: NCC[k]?.ten ?? k }))} /></div>}
    <Panel pad={12} title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{info.ten}<Pill color="var(--ok)" label="đã nối API" uppercase={false} mono={false} /></span>}
      subtitle={`${info.mo_ta} Cấp hàng cho: ${[...khoaShop].map((k) => cuaHang.find((c) => c.khoa === k)?.ten ?? k).join(', ')}`}
      actions={info.link ? <LinkChip href={info.link.url} tone="neutral">{info.link.nhan} ↗</LinkChip> : undefined}>
      <StatsStrip minColWidth={130} cards={[
        { key: 'sp', label: 'Sản phẩm nguồn', value: sps.filter((p) => p.maNcc).length, sub: `${sps.filter((p) => !p.maNcc).length} chưa gắn` },
        { key: 'bt', label: 'Biến thể đã gắn mã', value: `${bts.filter((b) => b.maNcc).length}/${bts.length}`, color: bts.some(loiBt) ? 'var(--warn)' : 'var(--ok)', sub: bts.some(loiBt) ? `${bts.filter(loiBt).length} lỗi` : 'đủ' },
        { key: 'don', label: 'Đơn đã đặt', value: dons.filter((d) => d.ncc?.maNcc).length },
        { key: 'tra', label: 'Chờ trả NCC', value: dons.filter((d) => d.buoc === 'cho_tra').length, color: dons.some((d) => d.buoc === 'cho_tra') ? 'var(--warn)' : undefined },
        { key: 'tre', label: 'Giao trễ', value: dons.filter((d) => d.buoc === 'tre').length, color: dons.some((d) => d.buoc === 'tre') ? 'var(--bad)' : undefined },
        ...(ncc === 'cj' ? [{ key: 'vi', label: 'Số dư ví CJ', value: soDu === undefined ? '…' : soDu === null ? '—' : tien(soDu) }] : []),
        { key: 'hs', label: 'Trao đổi đang mở', value: hs.filter((h) => h.trangThai !== 'xong').length, color: hs.some((h) => h.trangThai === 'moi') ? 'var(--warn)' : undefined },
      ]} />
    </Panel>

    <h3 style={{ margin: '16px 0 6px', fontSize: 14 }}>Sản phẩm nguồn <span style={{ ...phu, fontWeight: 400, fontSize: 12.5 }}>— mình bán gì ↔ món nào bên {info.ten}, đọc lại mỗi ngày</span></h3>
    <Panel pad={8}>
      <SimpleTable rows={nguon} getRowKey={(r) => String(r.p.id)} columns={[
        { key: 'sp', header: 'Sản phẩm của mình', cell: (r) => <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {r.p.anh && <img src={r.p.anh} alt="" width={28} height={28} style={{ objectFit: 'cover', borderRadius: 3 }} />}
          <span><b>{r.p.ten}</b><br /><span style={{ ...phu, fontSize: 11.5 }}>{r.p.cuaHang} · giá bán từ {tien(r.p.giaTu)}</span></span></span> },
        { key: 'cj', header: `Bên ${info.ten}`, cell: (r) => (r.p.nccInfo && !r.p.nccInfo.loi ? <span><span style={{ fontSize: 12.5 }}>{r.p.nccInfo.ten.slice(0, 70)}</span><br />
          <span style={{ ...phu, fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>SKU {r.p.nccInfo.sku} · pid {r.p.nccInfo.pid}</span></span>
          : r.p.maNcc ? <span style={phu}>{r.p.nccInfo?.loi ? `lỗi đọc: ${r.p.nccInfo.loi}` : 'chưa đọc — nhịp đồng bộ đọc trong 10 phút'}</span> : <span style={{ color: 'var(--bad)' }}>chưa gắn sản phẩm NCC</span>) },
        { key: 'von', header: 'Giá vốn NCC', align: 'right', cell: (r) => (r.p.nccInfo?.gia_tu != null ? `${tien(r.p.nccInfo.gia_tu)}${r.p.nccInfo.gia_den && r.p.nccInfo.gia_den !== r.p.nccInfo.gia_tu ? `–${tien(r.p.nccInfo.gia_den)}` : ''}` : '—') },
        { key: 'bt', header: 'Biến thể (gắn / NCC có)', align: 'right', cell: (r) => <span style={{ color: r.loi ? 'var(--bad)' : undefined }}>{r.gan}/{r.tong}{r.p.nccInfo ? ` · NCC ${r.p.nccInfo.so_bien_the}` : ''}{r.loi ? ` · ${r.loi} lỗi` : ''}</span> },
        { key: 'shop', header: 'Shop khác bán', align: 'right', cell: (r) => r.p.nccInfo?.listed ?? '—' },
        { key: 'luc', header: 'Đọc lúc', cell: (r) => <span style={phu}>{gio(r.p.nccLuc)}</span> },
        { key: 'mo', header: '', cell: (r) => <LinkChip href={`/shop?tab=san_pham&spm=${r.p.id}`} tone="neutral" size="xs">biến thể ↗</LinkChip> },
      ]} />
    </Panel>

    <h3 style={{ margin: '16px 0 6px', fontSize: 14 }}>Trao đổi với {info.ten}</h3>
    <BangHoSo ben="ncc" ch={ch} ds={hs} cuaHang={shops.filter((c) => c.ncc === ncc)} />
  </>);
}
