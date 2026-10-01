'use client';
// /shop › Nhà cung cấp — đi từ NCC xuống (anh chốt 01/10/2026): danh sách NCC (shop_cua_hang.ncc — hiện là CJ) → thẻ tổng quan NCC (sản
// phẩm nguồn, biến thể đã gắn/lỗi, đơn đã đặt/chờ trả/trễ, số dư ví, hồ sơ mở) → sản phẩm nguồn (mình bán gì ↔ món nào bên CJ, giá vốn,
// số biến thể, bao nhiêu shop khác cũng bán — ncc_info đọc mỗi ngày) → trao đổi (hồ sơ NCC, components/shop-ho-so.tsx).
// CJ không trả tên người bán thật phía sau (supplierName trống) nên NCC = CJ. URL: ?ncc=<khoá>.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { FilterChips, LinkChip, Panel, Pill, SimpleTable, StatsStrip } from '@/components/ui';
import { gio, tien } from '@/lib/shop/buoc';
import type { BienTheDong, CuaHangDong, DonDong, SanPhamDong } from '@/lib/shop/doc';
import type { HoSoDong } from '@/lib/shop/ho-so-doc';
import { shopBienDongNcc, shopDocLaiNcc, shopSoDuNcc } from '@/lib/actions/shop';
import { BangHoSo } from './shop-ho-so';
import type { BienDongNcc, LienHeNcc, NccDong } from '@/lib/shop/ho-so-doc';
import { SuaNcc } from './shop-ncc-sua';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
/** Kênh liên hệ → link bấm được (mailto / wa.me / skype / t.me); kênh khác hiện chữ. */
function linkLienHe(l: LienHeNcc): string | null {
  const v = l.gia_tri.trim();
  if (/^https?:\/\//.test(v)) return v;
  if (l.kenh === 'email' && v.includes('@')) return `mailto:${v}`;
  if (l.kenh === 'whatsapp') { const so = v.replace(/[^\d]/g, ''); return so ? `https://wa.me/${so}` : null; }
  if (l.kenh === 'telegram') return `https://t.me/${v.replace(/^@/, '')}`;
  if (l.kenh === 'skype') return `skype:${v}?chat`;
  if (l.kenh === 'phone') return `tel:${v.replace(/\s/g, '')}`;
  return null;
}
const NHAN_KENH: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp', skype: 'Skype', telegram: 'Telegram', wechat: 'WeChat', chat: 'Chat', phone: 'Điện thoại', khac: 'Khác' };

export function BangNcc({ cayNcc, soNcc, ch, cuaHang, sanPham, bienThe, don, hoSo }: { cayNcc: React.ReactNode; soNcc: NccDong[]; ch: string; cuaHang: CuaHangDong[]; sanPham: SanPhamDong[]; bienThe: BienTheDong[]; don: DonDong[]; hoSo: HoSoDong[] }) {
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
  const info = soNcc.find((x) => x.khoa === ncc) ?? { khoa: ncc, ten: ncc.toUpperCase(), website: null, taiKhoan: null, links: [], lienHe: [], ghiChu: null, capNhat: '' };
  const [sua, setSua] = useState(false);
  const [muc, setMuc] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('nm')) || 'tong_quan');
  useEffect(() => { const u = new URLSearchParams(window.location.search); if (muc !== 'tong_quan') u.set('nm', muc); else u.delete('nm');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`); }, [muc]);
  const [bd, setBd] = useState<BienDongNcc[] | null>(null);
  useEffect(() => { shopBienDongNcc().then(setBd).catch(() => setBd([])); }, []);
  const [docLai, batDocLai] = useTransition();
  const [baoDoc, setBaoDoc] = useState<string | null>(null);
  const nguon = useMemo(() => sps.map((p) => ({ p, gan: bts.filter((b) => b.sanPhamId === p.id && b.maNcc).length, tong: bts.filter((b) => b.sanPhamId === p.id).length,
    loi: bts.filter((b) => b.sanPhamId === p.id && loiBt(b)).length })), [sps, bts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (<>
    {ds.length > 1 && <div style={{ marginBottom: 8 }}><FilterChips urlKey="ncc" value={ncc} onChange={setNcc} options={ds.map((k) => ({ value: k, label: soNcc.find((x) => x.khoa === k)?.ten ?? k }))} /></div>}
    <Panel pad={12} title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{info.ten}{ncc === 'cj' && <Pill color="var(--ok)" label="đã nối API" uppercase={false} mono={false} />}</span>}
      subtitle={`Cấp hàng cho: ${[...khoaShop].map((k) => cuaHang.find((c) => c.khoa === k)?.ten ?? k).join(', ')}`}
      actions={<button className="btn ghost" onClick={() => setSua(true)}>Sửa thông tin NCC</button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '5px 12px', fontSize: 13, marginBottom: 12 }}>
        <span style={phu}>Website</span><span>{info.website ? <LinkChip href={info.website} tone="neutral" size="xs">{info.website.replace(/^https?:\/\//, '')} ↗</LinkChip> : <span style={phu}>chưa có</span>}
          {info.links.map((l) => <span key={l.url} style={{ marginLeft: 6 }}><LinkChip href={l.url} tone="neutral" size="xs">{l.nhan} ↗</LinkChip></span>)}</span>
        <span style={phu}>Tài khoản mình</span><span>{info.taiKhoan ?? <span style={phu}>chưa ghi</span>}</span>
        <span style={phu}>Liên hệ</span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {info.lienHe.length ? info.lienHe.map((l, i) => { const h = linkLienHe(l); return <span key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <span style={{ ...phu, fontSize: 11.5 }}>{NHAN_KENH[l.kenh] ?? l.kenh}{l.ten ? ` · ${l.ten}` : ''}:</span>
            {h ? <LinkChip href={h} tone="neutral" size="xs">{l.gia_tri}</LinkChip> : <span>{l.gia_tri}</span>}</span>; })
            : <span style={{ color: 'var(--warn)' }}>Chưa có người/kênh liên hệ — bấm "Sửa thông tin NCC" điền agent phụ trách (tên, WhatsApp/Skype/email).</span>}
        </span>
        {info.ghiChu && <><span style={phu}>Ghi chú</span><span style={phu}>{info.ghiChu}</span></>}
      </div>
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

    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 8px', flexWrap: 'wrap' }}>
      <FilterChips urlKey="nm" value={muc} onChange={setMuc} allValue="tong_quan" counts={{ bien_dong: (bd ?? []).filter((x) => khoaShop.has(x.cuaHang)).length, trao_doi: hs.filter((h) => h.trangThai !== 'xong').length }}
        options={[{ value: 'tong_quan', label: 'Tổng quan' }, { value: 'san_pham', label: 'Sản phẩm NCC', title: 'Cây sản phẩm nhìn từ phía NCC: giá CJ, tồn CJ, tự ẩn, khách chờ có hàng' },
          { value: 'bien_dong', label: 'Biến động', title: 'Giá CJ đổi, biến thể hết/gỡ/có lại — máy ghi mỗi lần đọc' }, { value: 'trao_doi', label: 'Trao đổi' }]} />
      <span style={{ flex: 1 }} />
      {baoDoc && <span style={{ fontSize: 12.5, ...phu }}>{baoDoc}</span>}
      {ncc === 'cj' && <button className="btn ghost" disabled={docLai} title="Đọc lại giá + trạng thái từ CJ ngay; tồn kho từng biến thể đọc tiếp ở các nhịp 10 phút"
        onClick={() => batDocLai(async () => { const kq = await Promise.all([...khoaShop].map((k) => shopDocLaiNcc(k))); setBaoDoc(`Đã đọc ${kq.reduce((t, r) => t + ('doc' in r && r.doc ? r.doc.doc : 0), 0)} sản phẩm · tồn kho đọc tiếp trong các nhịp tới`); setBd(await shopBienDongNcc()); })}>
        {docLai ? 'Đang đọc CJ…' : 'Đọc lại NCC ngay'}</button>}
    </div>
    {muc === 'san_pham' && cayNcc}
    {muc === 'bien_dong' && <Panel pad={8}>{!bd ? <span style={phu}>Đang tải…</span> : <SimpleTable rows={bd.filter((x) => khoaShop.has(x.cuaHang))} getRowKey={(x) => String(x.id)} columns={[
      { key: 'l', header: 'Lúc', width: 96, cell: (x) => <span style={phu}>{gio(x.luc)}</span> },
      { key: 'k', header: 'Loại', width: 120, cell: (x) => <span style={{ color: ({ gia: 'var(--warn)', het: 'var(--bad)', go: 'var(--bad)', co_lai: 'var(--ok)', ve_lai: 'var(--ok)' } as Record<string, string>)[x.loai] }}>
        {({ gia: 'Giá CJ đổi', het: 'Tự ẩn', go: 'Gỡ khỏi CJ', co_lai: 'Mở bán lại', ve_lai: 'Có lại trên CJ' } as Record<string, string>)[x.loai] ?? x.loai}</span> },
      { key: 's', header: 'Sản phẩm · biến thể', cell: (x) => <span>{x.sanPham}<span style={phu}> · {x.bienThe}</span></span> },
      { key: 'd', header: 'Thay đổi', cell: (x) => <span>{x.cu} → <b>{x.moi}</b></span> },
    ]} />}{bd && !bd.some((x) => khoaShop.has(x.cuaHang)) && <div style={{ ...phu, fontSize: 12.5, padding: 6 }}>Chưa có biến động nào — máy ghi ở đây mỗi khi giá CJ đổi, biến thể hết/gỡ/có lại.</div>}</Panel>}
    {muc === 'tong_quan' && <>
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

    </>}
    {muc === 'trao_doi' && <BangHoSo ben="ncc" ch={ch} ds={hs} cuaHang={shops.filter((c) => c.ncc === ncc)} />}
    {sua && <SuaNcc n={info} onClose={() => setSua(false)} />}
  </>);
}
