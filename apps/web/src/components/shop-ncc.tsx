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

export function BangNcc({ lienKet, soNcc, ch, cuaHang, sanPham, bienThe, don, hoSo }: { lienKet: React.ReactNode; soNcc: NccDong[]; ch: string; cuaHang: CuaHangDong[]; sanPham: SanPhamDong[]; bienThe: BienTheDong[]; don: DonDong[]; hoSo: HoSoDong[] }) {
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
  const [chonSp, setChonSp] = useState(0);
  const nguongTon = shops.find((c) => c.ncc === ncc)?.cauHinh.ton_thap ?? 50;
  const tonThap = bts.filter((b) => b.tonNcc != null && b.tonNcc > 0 && b.tonNcc < nguongTon).length, hetNcc = bts.filter((b) => b.tonNcc === 0 || b.nccMat).length;
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
        { key: 'ton', label: 'Tồn thấp ở NCC', value: tonThap, color: tonThap ? 'var(--warn)' : undefined, sub: `< ${nguongTon} · ${hetNcc} hết/gỡ · đọc ${bts.filter((b) => b.tonNcc != null).length}/${bts.filter((b) => b.maNcc).length}` },
        { key: 'tre', label: 'Giao trễ', value: dons.filter((d) => d.buoc === 'tre').length, color: dons.some((d) => d.buoc === 'tre') ? 'var(--bad)' : undefined },
        ...(ncc === 'cj' ? [{ key: 'vi', label: 'Số dư ví CJ', value: soDu === undefined ? '…' : soDu === null ? '—' : tien(soDu) }] : []),
        { key: 'hs', label: 'Trao đổi đang mở', value: hs.filter((h) => h.trangThai !== 'xong').length, color: hs.some((h) => h.trangThai === 'moi') ? 'var(--warn)' : undefined },
      ]} />
    </Panel>

    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 8px', flexWrap: 'wrap' }}>
      <FilterChips urlKey="nm" value={muc} onChange={setMuc} allValue="tong_quan" counts={{ bien_dong: (bd ?? []).filter((x) => khoaShop.has(x.cuaHang)).length, trao_doi: hs.filter((h) => h.trangThai !== 'xong').length }}
        options={[{ value: 'tong_quan', label: 'Tổng quan' }, { value: 'san_pham', label: 'Sản phẩm NCC', title: 'Danh mục BÊN NCC: sản phẩm + biến thể theo tên/mã/giá/tồn của CJ' },
          { value: 'lien_ket', label: 'Liên kết', title: 'Sản phẩm/biến thể của shop ↔ sản phẩm/biến thể NCC — soát đúng màu/size, giá, tồn' },
          { value: 'bien_dong', label: 'Biến động', title: 'Giá CJ đổi, biến thể hết/gỡ/có lại — máy ghi mỗi lần đọc' }, { value: 'trao_doi', label: 'Trao đổi' }]} />
      <span style={{ flex: 1 }} />
      {baoDoc && <span style={{ fontSize: 12.5, ...phu }}>{baoDoc}</span>}
      {ncc === 'cj' && <button className="btn ghost" disabled={docLai} title="Đọc lại giá + trạng thái từ CJ ngay; tồn kho từng biến thể đọc tiếp ở các nhịp 10 phút"
        onClick={() => batDocLai(async () => { const kq = await Promise.all([...khoaShop].map((k) => shopDocLaiNcc(k))); setBaoDoc(`Đã đọc ${kq.reduce((t, r) => t + ('doc' in r && r.doc ? r.doc.doc : 0), 0)} sản phẩm · tồn kho đọc tiếp trong các nhịp tới`); setBd(await shopBienDongNcc()); })}>
        {docLai ? 'Đang đọc CJ…' : 'Đọc lại NCC ngay'}</button>}
    </div>
    {muc === 'san_pham' && <DanhMucNcc sps={sps} bts={bts} tenNcc={info.ten} nguongTon={nguongTon} />}
    {muc === 'lien_ket' && <>
      <CapLienKet sps={sps} bts={bts} tenNcc={info.ten} nguongTon={nguongTon} chon={(id) => {
        const u = new URLSearchParams(window.location.search); u.set('spm', String(id)); window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`);
        setChonSp(id); setTimeout(() => document.getElementById('lien-ket-cay')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
      }} />
      <h3 id="lien-ket-cay" style={{ margin: '16px 0 6px', fontSize: 14 }}>Từng biến thể <span style={{ ...phu, fontWeight: 400, fontSize: 12.5 }}>— biến thể shop ↔ biến thể {info.ten}</span></h3>
      <div key={chonSp}>{lienKet}</div>
    </>}
    {muc === 'bien_dong' && <Panel pad={8}>{!bd ? <span style={phu}>Đang tải…</span> : <SimpleTable rows={bd.filter((x) => khoaShop.has(x.cuaHang))} getRowKey={(x) => String(x.id)} columns={[
      { key: 'l', header: 'Lúc', width: 96, cell: (x) => <span style={phu}>{gio(x.luc)}</span> },
      { key: 'k', header: 'Loại', width: 120, cell: (x) => <span style={{ color: ({ gia: 'var(--warn)', het: 'var(--bad)', go: 'var(--bad)', co_lai: 'var(--ok)', ve_lai: 'var(--ok)', ton_thap: 'var(--warn)' } as Record<string, string>)[x.loai] }}>
        {({ gia: 'Giá CJ đổi', het: 'Tự ẩn', go: 'Gỡ khỏi CJ', co_lai: 'Mở bán lại', ve_lai: 'Có lại trên CJ', ton_thap: 'Tồn thấp' } as Record<string, string>)[x.loai] ?? x.loai}</span> },
      { key: 's', header: 'Sản phẩm · biến thể', cell: (x) => <span>{x.sanPham}<span style={phu}> · {x.bienThe}</span></span> },
      { key: 'd', header: 'Thay đổi', cell: (x) => <span>{x.cu} → <b>{x.moi}</b></span> },
    ]} />}{bd && !bd.some((x) => khoaShop.has(x.cuaHang)) && <div style={{ ...phu, fontSize: 12.5, padding: 6 }}>Chưa có biến động nào — máy ghi ở đây mỗi khi giá CJ đổi, biến thể hết/gỡ/có lại.</div>}</Panel>}
    {muc === 'trao_doi' && <BangHoSo ben="ncc" ch={ch} ds={hs} cuaHang={shops.filter((c) => c.ncc === ncc)} />}
    {sua && <SuaNcc n={info} onClose={() => setSua(false)} />}
  </>);
}

/** Danh mục BÊN NCC (anh chốt 01/10/2026): sản phẩm theo tên/SKU/mã CJ → biến thể CJ (tên, SKU, mã, giá, tồn) + biến thể nào của shop đang dùng nó.
 *  Nguồn: shop_san_pham.ncc_info (dongBoThongTinNcc, mỗi ngày); tồn chỉ có cho biến thể đang dùng (đọc theo vid). */
function DanhMucNcc({ sps, bts, tenNcc, nguongTon }: { sps: SanPhamDong[]; bts: BienTheDong[]; tenNcc: string; nguongTon: number }) {
  const [mo, setMo] = useState<Set<string>>(new Set());
  const ds = sps.filter((p) => p.nccInfo && !p.nccInfo.loi);
  const dung = new Map<string, BienTheDong[]>();
  for (const b of bts) if (b.maNcc) dung.set(b.maNcc, [...(dung.get(b.maNcc) ?? []), b]);
  if (!ds.length) return <div style={{ ...phu, padding: 8 }}>Chưa đọc được sản phẩm nào từ {tenNcc} — bấm "Đọc lại NCC ngay".</div>;
  return (
    <Panel pad={0}>
      {ds.map((p) => {
        const n = p.nccInfo!, k = n.pid, dangMo = mo.has(k);
        const bt = n.bien_the ?? [];
        const daDung = bt.filter((v) => dung.has(v.vid)).length;
        return (
          <div key={k} style={{ borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer', background: dangMo ? 'var(--bg-2)' : undefined }}
              onClick={() => setMo((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; })}>
              <span aria-hidden style={{ width: 14, ...phu }}>{dangMo ? '▾' : '▸'}</span>
              {bt.find((v) => v.anh)?.anh ? <img src={bt.find((v) => v.anh)!.anh!} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ width: 40 }} />}
              <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <b style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.ten}</b>
                  <Pill color={p.nccDangBan === false ? 'var(--bad)' : 'var(--ok)'} label={p.nccDangBan === false ? 'NCC ngừng bán' : 'NCC đang bán'} uppercase={false} mono={false} />
                </span>
                <span style={{ fontSize: 12, ...phu, fontFamily: 'var(--font-mono)' }}>
                  SKU {n.sku} · pid {n.pid} · {n.so_bien_the} biến thể · giá {tien(n.gia_tu)}{n.gia_den && n.gia_den !== n.gia_tu ? `–${tien(n.gia_den)}` : ''} · {n.listed ?? '—'} shop khác bán · đọc {gio(p.nccLuc)}
                </span>
              </div>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                {(() => { const ton = bt.map((v) => dung.get(v.vid)?.find((x) => x.tonNcc != null)?.tonNcc).filter((x): x is number => x != null);
                  const thap = ton.filter((x) => x > 0 && x < nguongTon).length, het = ton.filter((x) => x === 0).length;
                  return <>{het > 0 && <Pill color="var(--bad)" label={`${het} hết`} uppercase={false} mono={false} />}{thap > 0 && <Pill color="var(--warn)" label={`${thap} tồn thấp`} uppercase={false} mono={false} />}</>; })()}
                <span style={{ fontSize: 12, ...phu }}>shop dùng {daDung}/{bt.length} biến thể</span>
                <span onClick={(e) => e.stopPropagation()}><LinkChip href={`/shop?tab=san_pham&spm=${p.id}`} tone="neutral" size="xs">đang bán thành: {p.ten.slice(0, 40)} ↗</LinkChip></span>
              </span>
            </div>
            {dangMo && <div style={{ padding: '0 12px 12px 36px', display: 'grid', gap: 10 }}>
              {n.chi_tiet && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 10px', fontSize: 12.5 }}>
                  {([['Danh mục', n.chi_tiet.danh_muc], ['Loại', n.chi_tiet.loai], ['Chất liệu', n.chi_tiet.chat_lieu], ['Đóng gói', n.chi_tiet.dong_goi],
                    ['Cân nặng', n.chi_tiet.can_nang ? `${n.chi_tiet.can_nang} g` : null], ['Cân đóng gói', n.chi_tiet.can_dong_goi ? `${n.chi_tiet.can_dong_goi} g` : null],
                    ['Giá NCC gợi ý bán', n.chi_tiet.gia_goi_y ? tien(n.chi_tiet.gia_goi_y) : null], ['Lên NCC từ', n.chi_tiet.tao_luc?.slice(0, 10) ?? null]] as [string, string | null][])
                    .map(([k, v]) => <span key={k} style={{ display: 'contents' }}><span style={phu}>{k}</span><span>{v ?? '—'}</span></span>)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignContent: 'flex-start' }}>
                  {n.chi_tiet.anh.map((a) => <a key={a} href={a} target="_blank" rel="noreferrer"><img src={a} alt="" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} /></a>)}
                </div>
                {n.chi_tiet.mo_ta && <details style={{ gridColumn: '1 / -1', fontSize: 12.5 }}><summary style={{ cursor: 'pointer', ...phu }}>Mô tả bên NCC</summary><p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{n.chi_tiet.mo_ta}</p></details>}
              </div>}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ ...phu, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {['Biến thể bên NCC', 'SKU NCC', 'Mã (vid)', 'Giá NCC', 'Gợi ý bán', 'Cân · kích thước', 'Tồn theo kho', 'Shop đang dùng cho'].map((h, i) => <th key={h} style={{ textAlign: i === 3 || i === 4 ? 'right' : 'left', padding: '5px 10px', fontWeight: 500 }}>{h}</th>)}
                </tr></thead>
                <tbody>{bt.map((v) => {
                  const ds2 = dung.get(v.vid) ?? [], dau = ds2.find((x) => x.tonNcc != null), ton = dau?.tonNcc;
                  return (
                    <tr key={v.vid} style={{ borderTop: '1px solid var(--line)', color: ds2.length ? undefined : 'var(--fg-3)' }}>
                      <td style={{ padding: '5px 10px' }}>{v.ten}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{v.sku || '—'}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 11.5 }} title={v.vid}>…{v.vid.slice(-8)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tien(v.gia)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...phu }}>{tien(v.gia_goi_y ?? null)}</td>
                      <td style={{ padding: '5px 10px', ...phu, fontSize: 11.5 }}>{[v.can ? `${v.can} g` : null, v.kich].filter(Boolean).join(' · ') || '—'}</td>
                      <td style={{ padding: '5px 10px', fontVariantNumeric: 'tabular-nums', color: ton === 0 ? 'var(--bad)' : ton != null && ton < nguongTon ? 'var(--warn)' : undefined }}
                        title={ds2.length ? undefined : 'Chỉ đọc tồn cho biến thể shop đang dùng'}>
                        {ton == null ? '—' : (dau?.tonKho ?? []).length ? dau!.tonKho.map((k) => `${k.nuoc || k.kho} ${k.so.toLocaleString('en-US')}`).join(' · ') : ton.toLocaleString('en-US')}
                        {ton != null && ton < nguongTon && <b>{ton === 0 ? ' · hết' : ' · thấp'}</b>}</td>
                      <td style={{ padding: '5px 10px' }}>{ds2.length ? ds2.map((x) => x.ten).join(' · ') : 'chưa dùng'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              {!bt.length && <div style={{ ...phu, padding: 6 }}>Chưa có danh mục biến thể — lần đọc CJ kế sẽ lấy.</div>}
            </div>}
          </div>
        );
      })}
    </Panel>
  );
}

/** Màu bên CJ: tên biến thể dạng "Dark Gray-36" → "Dark Gray". */
const mauCj = (ten: string) => ten.replace(/[-_ ]\s*[\w.]+$/, '').trim();
const mauShop = (ten: string) => { const i = ten.indexOf(' / '); return (i < 0 ? ten : ten.slice(0, i)).trim(); };

/** Mối nối MỨC SẢN PHẨM (anh chốt 01/10/2026): sản phẩm đang bán ⇄ sản phẩm NCC đặt hai bên, giữa là sức khoẻ của mối nối — nối đủ chưa,
 *  màu NCC có mà shop chưa bán, giá vốn → giá bán → biên, tồn thấp nhất, trạng thái hai bên. Bấm một cặp → bảng từng biến thể của cặp đó. */
function CapLienKet({ sps, bts, tenNcc, nguongTon, chon }: { sps: SanPhamDong[]; bts: BienTheDong[]; tenNcc: string; nguongTon: number; chon: (spId: number) => void }) {
  return (
    <Panel pad={0}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px minmax(0, 1fr)', fontSize: 10.5, ...phu, textTransform: 'uppercase', letterSpacing: '.05em', padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
        <span>Đang bán trên shop</span><span style={{ textAlign: 'center' }}>Mối nối</span><span>Sản phẩm {tenNcc}</span>
      </div>
      {sps.map((p) => {
        const n = p.nccInfo && !p.nccInfo.loi ? p.nccInfo : null;
        const mine = bts.filter((b) => b.sanPhamId === p.id);
        const noi = mine.filter((b) => b.maNcc && (!n?.vids?.length || n.vids.includes(b.maNcc))).length;
        const loi = mine.length - noi;
        const von = mine.map((b) => b.giaVon).filter((x): x is number => x != null), ban = mine.map((b) => b.giaBan).filter((x): x is number => x != null);
        const bien = mine.map((b) => (b.giaBan && b.giaVon != null ? Math.round(((b.giaBan - b.giaVon) / b.giaBan) * 100) : null)).filter((x): x is number => x != null);
        const ton = mine.map((b) => b.tonNcc).filter((x): x is number => x != null);
        const tonMin = ton.length ? Math.min(...ton) : null;
        const mauNcc = [...new Set((n?.bien_the ?? []).map((v) => mauCj(v.ten)))], mauBan = new Set(mine.map((b) => mauShop(b.ten).toLowerCase()));
        const mauThieu = mauNcc.filter((m) => !mauBan.has(m.toLowerCase()));
        const anhNcc = n?.chi_tiet?.anh?.[0] ?? n?.bien_the?.find((v) => v.anh)?.anh ?? null;
        const mau = !n ? 'var(--bad)' : loi ? 'var(--bad)' : (tonMin != null && tonMin < nguongTon) || p.nccDangBan === false ? 'var(--warn)' : 'var(--ok)';
        return (
          <div key={p.id} role="button" tabIndex={0} onClick={() => chon(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') chon(p.id); }} title="Bấm để xem từng biến thể của cặp này"
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px minmax(0, 1fr)', gap: 10, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
              {p.anh && <img src={p.anh} alt="" width={44} height={44} style={{ objectFit: 'cover', borderRadius: 4, flex: 'none' }} />}
              <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                <b style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.ten}</b>
                <span style={{ fontSize: 12, ...phu }}>{p.cuaHang} · {mauBan.size} màu · {mine.length} biến thể · bán {tien(ban.length ? Math.min(...ban) : null)}{ban.length && Math.max(...ban) !== Math.min(...ban) ? `–${tien(Math.max(...ban))}` : ''}</span>
                <span><Pill color={p.hien ? 'var(--ok)' : 'var(--fg-3)'} label={p.hien ? 'đang bán' : 'ẩn'} uppercase={false} mono={false} /></span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 4, justifyItems: 'center', textAlign: 'center', fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <span style={{ flex: 1, height: 2, background: mau }} /><b style={{ color: mau, fontSize: 12.5, whiteSpace: 'nowrap' }}>{!n ? 'chưa nối' : loi ? `${loi} biến thể lệch` : `nối ${noi}/${mine.length}`}</b><span style={{ flex: 1, height: 2, background: mau }} />
              </span>
              {n && <span style={phu}>vốn {tien(von.length ? Math.min(...von) : null)} → bán {tien(ban.length ? Math.min(...ban) : null)} · biên {bien.length ? (Math.min(...bien) === Math.max(...bien) ? `${Math.min(...bien)}%` : `${Math.min(...bien)}–${Math.max(...bien)}%`) : '—'}</span>}
              {n && <span style={{ color: tonMin === 0 ? 'var(--bad)' : tonMin != null && tonMin < nguongTon ? 'var(--warn)' : 'var(--fg-3)' }}>tồn NCC thấp nhất {tonMin == null ? '—' : tonMin.toLocaleString('en-US')}{tonMin != null && tonMin < nguongTon ? ' · thấp' : ''}</span>}
              {mauThieu.length > 0 && <span style={{ color: 'var(--accent)' }} title="NCC có nhưng shop chưa bán — có thể thêm vào mặt tiền">NCC còn {mauThieu.length} màu chưa bán: {mauThieu.slice(0, 3).join(', ')}{mauThieu.length > 3 ? '…' : ''}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
              {anhNcc ? <img src={anhNcc} alt="" width={44} height={44} style={{ objectFit: 'cover', borderRadius: 4, flex: 'none' }} /> : <span style={{ width: 44 }} />}
              {n ? <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                <b style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.ten}</b>
                <span style={{ fontSize: 12, ...phu, fontFamily: 'var(--font-mono)' }}>SKU {n.sku} · {mauNcc.length} màu · {n.so_bien_the} biến thể · CJ {tien(n.gia_tu)}{n.gia_den && n.gia_den !== n.gia_tu ? `–${tien(n.gia_den)}` : ''}</span>
                <span><Pill color={p.nccDangBan === false ? 'var(--bad)' : 'var(--ok)'} label={p.nccDangBan === false ? 'NCC ngừng bán' : 'NCC đang bán'} uppercase={false} mono={false} /></span>
              </div> : <span style={{ color: 'var(--bad)', fontSize: 13 }}>{p.maNcc ? 'chưa đọc được từ NCC' : 'chưa nối sản phẩm NCC — gắn mã CJ ở tab Sản phẩm'}</span>}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
