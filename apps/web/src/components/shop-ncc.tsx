'use client';
// /shop › Nhà cung cấp — đi từ NCC xuống (anh chốt 01/10/2026), mọi tầng là CÂY (ui/cay.tsx):
//   1. Cây NCC: KÊNH (CJ · Alibaba · 1688 · AliExpress · xưởng) → NCC. CJ là MỘT NCC thật (mình mua/trả/khiếu nại với CJ; API không cho biết xưởng phía sau);
//      trên Alibaba/1688 mỗi nhà bán là một NCC. Chọn một NCC → thẻ NCC (liên hệ, số liệu).
//   2. Sản phẩm NCC: danh mục BÊN NCC dùng chung mọi shop — sản phẩm NCC → màu → biến thể NCC → shop nào đang dùng nó (chính / dự phòng).
//   3. Liên kết: cây của shop — sản phẩm → nguồn + màu → biến thể → các nguồn (shop-san-pham.tsx, chế độ lien_ket).
//   4. Biến động: phía NCC (giá, gỡ, ngừng bán, tồn thấp/hết — một dòng cho mọi shop) + phía shop (tự ẩn, mở lại, đổi nguồn).
//   5. Trao đổi: hồ sơ NCC (shop-ho-so.tsx).
// URL: ?ncc=<khoá> · ?nm=<mục> · ?nsp=<id,id> sản phẩm NCC đang mở.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cay, FilterChips, LaBang, LinkChip, NutCay, Panel, Pill, SimpleTable, StatsStrip, oLa, type CotLa } from '@/components/ui';
import { KENH_NCC, gio, tachBienThe, thuTuSize, tien } from '@/lib/shop/buoc';
import type { BienTheDong, CuaHangDong, DonDong, NccSpDong, SanPhamDong } from '@/lib/shop/doc';
import type { BienDongNcc, HoSoDong, LienHeNcc, NccDong } from '@/lib/shop/ho-so-doc';
import { shopDocLaiNcc, shopSoDuNcc } from '@/lib/actions/shop';
import { BangHoSo } from './shop-ho-so';
import { SuaNcc } from './shop-ncc-sua';
import { duoi, vaiNguon } from './shop-san-pham';

/** Cột danh mục NCC — độ rộng cố định để mọi nhóm màu thẳng cột (ui/cay LaBang). */
const COT_DM: CotLa[] = [{ h: 'Biến thể bên NCC', rong: 190 }, { h: 'SKU NCC', rong: 160 }, { h: 'Mã', rong: 90 }, { h: 'Giá NCC', rong: 75, phai: true },
  { h: 'Gợi ý bán', rong: 80, phai: true }, { h: 'Cân · kích thước', rong: 170 }, { h: 'Tồn theo kho', rong: 110 }, { h: 'Shop đang dùng' }];

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
const LOAI_BD: Record<string, [string, string]> = {
  gia: ['Giá NCC đổi', 'var(--warn)'], go: ['Gỡ khỏi NCC', 'var(--bad)'], ve_lai: ['Có lại trên NCC', 'var(--ok)'], ngung: ['NCC ngừng bán', 'var(--bad)'],
  ban_lai: ['NCC bán lại', 'var(--ok)'], ton_thap: ['Tồn thấp', 'var(--warn)'], het_ncc: ['NCC hết hàng', 'var(--bad)'],
  het: ['Tự ẩn', 'var(--bad)'], co_lai: ['Mở bán lại', 'var(--ok)'], doi_nguon: ['Đổi nguồn', 'var(--accent)'],
};
const docUrl = (k: string, mac: string) => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(k)) || mac;
function ghiUrl(k: string, v: string, mac: string) {
  const u = new URLSearchParams(window.location.search);
  if (v && v !== mac) u.set(k, v); else u.delete(k);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`);
}

/** Một biến thể shop đang lấy một biến thể NCC làm nguồn. */
type Dung = { b: BienTheDong; vai: string; dangDung: boolean; nguonId: number };

export function BangNcc({ lienKet, soNcc, ch, cuaHang, bienThe, danhMuc, bienDong, don, hoSo }: {
  lienKet: (ncc: string) => React.ReactNode; soNcc: NccDong[]; ch: string; cuaHang: CuaHangDong[]; sanPham: SanPhamDong[]; bienThe: BienTheDong[];
  danhMuc: NccSpDong[]; bienDong: BienDongNcc[]; don: DonDong[]; hoSo: HoSoDong[] }) {
  const router = useRouter();
  const shops = cuaHang.filter((c) => ch === 'all' || c.khoa === ch);
  const khoaShop = new Set(shops.map((c) => c.khoa));
  const bts = bienThe.filter((b) => khoaShop.has(b.cuaHang));
  // nccBtId → các biến thể shop (trong phạm vi) dùng nó làm nguồn
  const dungBt = useMemo(() => {
    const m = new Map<number, Dung[]>();
    for (const b of bts) for (const n of b.nguon) if (n.bat) m.set(n.nccBtId, [...(m.get(n.nccBtId) ?? []), { b, vai: vaiNguon(b, n), dangDung: n.id === b.nguonId, nguonId: n.id }]);
    return m;
  }, [bts]);
  const thongKe = (k: string) => {
    const sp = danhMuc.filter((s) => s.ncc === k), spDung = sp.filter((s) => s.bt.some((v) => dungBt.has(v.id)));
    const chinh = bts.filter((b) => b.nguon.find((n) => n.bat)?.ncc === k).length;
    const duPhong = bts.filter((b) => b.nguon.filter((n) => n.bat).slice(1).some((n) => n.ncc === k)).length;
    const dangDung = bts.filter((b) => b.nguon.find((n) => n.id === b.nguonId)?.ncc === k).length;
    const choShop = [...new Set(bts.filter((b) => b.nguon.some((n) => n.bat && n.ncc === k)).map((b) => b.cuaHang))];
    return { sp, spDung, chinh, duPhong, dangDung, choShop };
  };
  const macDinh = soNcc.find((n) => thongKe(n.khoa).choShop.length)?.khoa ?? soNcc[0]?.khoa ?? 'cj';
  const [ncc, setNcc] = useState(() => docUrl('ncc', macDinh));
  useEffect(() => ghiUrl('ncc', ncc, macDinh), [ncc]); // eslint-disable-line react-hooks/exhaustive-deps
  const [muc, setMuc] = useState(() => docUrl('nm', 'tong_quan'));
  useEffect(() => ghiUrl('nm', muc, 'tong_quan'), [muc]);
  const [soDu, setSoDu] = useState<number | null | undefined>(undefined);
  useEffect(() => { if (ncc === 'cj') shopSoDuNcc().then(setSoDu).catch(() => setSoDu(null)); }, [ncc]);
  const [sua, setSua] = useState<NccDong | null>(null);
  const [docLai, batDocLai] = useTransition();
  const [baoDoc, setBaoDoc] = useState<string | null>(null);

  const info = soNcc.find((x) => x.khoa === ncc) ?? { khoa: ncc, ten: ncc.toUpperCase(), kenh: 'khac', coApi: false, website: null, taiKhoan: null, links: [], lienHe: [], ghiChu: null, capNhat: '' };
  const tk = thongKe(ncc);
  const nguongTon = Math.max(50, ...shops.map((c) => c.cauHinh.ton_thap ?? 50));
  const btDung = tk.sp.flatMap((s) => s.bt).filter((v) => dungBt.has(v.id));
  const tonThap = btDung.filter((v) => v.ton != null && v.ton > 0 && v.ton < nguongTon).length, hetNcc = btDung.filter((v) => v.ton === 0 || v.mat).length;
  const dons = don.filter((d) => khoaShop.has(d.cuaHang) && d.ncc?.nha === ncc);
  const hs = hoSo.filter((h) => h.ben === 'ncc' && khoaShop.has(h.cuaHang));
  const bd = bienDong.filter((x) => x.ncc === ncc && (x.cuaHang ? khoaShop.has(x.cuaHang) : ch === 'all' || (x.nccBtId != null ? dungBt.has(x.nccBtId) : tk.spDung.some((s) => s.id === x.nccSpId))));
  const kenhCo = [...new Set(soNcc.map((n) => n.kenh))].sort((a, b) => Object.keys(KENH_NCC).indexOf(a) - Object.keys(KENH_NCC).indexOf(b));

  return (<>
    {/* 1. Cây NCC: kênh → NCC */}
    <Panel pad={0} title="Nhà cung cấp" subtitle="kênh → nhà cung cấp · bấm để xem"
      actions={<button className="btn ghost" onClick={() => setSua({ khoa: '', ten: '', kenh: 'alibaba', coApi: false, website: null, taiKhoan: null, links: [], lienHe: [], ghiChu: null, capNhat: '' })}>+ Thêm NCC</button>}>
      <Cay label="Nhà cung cấp theo kênh">
        {kenhCo.map((k) => {
          const ds = soNcc.filter((n) => n.kenh === k);
          return (
            <NutCay key={k} ten={<b>{KENH_NCC[k]?.ten ?? k}</b>} phu={<>{ds.length} nhà cung cấp{KENH_NCC[k]?.chu ? ` · ${KENH_NCC[k]!.chu}` : ''}</>}>
              {ds.map((n) => {
                const t = thongKe(n.khoa);
                return (
                  <NutCay key={n.khoa} chon={n.khoa === ncc} onChon={() => setNcc(n.khoa)} mo_nhat={!t.choShop.length}
                    ten={<><b style={{ fontWeight: n.khoa === ncc ? 600 : 500 }}>{n.ten}</b>
                      <Pill color={n.coApi ? 'var(--ok)' : 'var(--fg-3)'} label={n.coApi ? 'đã nối API' : 'đặt tay'} uppercase={false} mono={false} /></>}
                    phu={t.choShop.length ? <>{t.spDung.length} sản phẩm nguồn · chính cho {t.chinh} biến thể · dự phòng cho {t.duPhong} · đang dùng {t.dangDung} · cấp cho {t.choShop.map((k2) => cuaHang.find((c) => c.khoa === k2)?.ten ?? k2).join(', ')}</>
                      : <>{t.sp.length} sản phẩm trong danh mục · chưa cấp cho shop nào{ch !== 'all' ? ' (trong cửa hàng đang lọc)' : ''}</>} />
                );
              })}
            </NutCay>
          );
        })}
      </Cay>
    </Panel>

    {/* Thẻ NCC đang chọn */}
    <div style={{ height: 12 }} />
    <Panel pad={12} title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{info.ten}<Pill color={info.coApi ? 'var(--ok)' : 'var(--fg-3)'} label={info.coApi ? 'đã nối API' : 'đặt tay'} uppercase={false} mono={false} /></span>}
      subtitle={`${KENH_NCC[info.kenh]?.ten ?? info.kenh} · cấp cho: ${tk.choShop.map((k) => cuaHang.find((c) => c.khoa === k)?.ten ?? k).join(', ') || 'chưa shop nào'}`}
      actions={<button className="btn ghost" onClick={() => setSua(info)}>Sửa thông tin NCC</button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '5px 12px', fontSize: 13, marginBottom: 12 }}>
        <span style={phu}>Website</span><span>{info.website ? <LinkChip href={info.website} tone="neutral" size="xs">{info.website.replace(/^https?:\/\//, '')} ↗</LinkChip> : <span style={phu}>chưa có</span>}
          {info.links.map((l) => <span key={l.url} style={{ marginLeft: 6 }}><LinkChip href={l.url} tone="neutral" size="xs">{l.nhan} ↗</LinkChip></span>)}</span>
        <span style={phu}>Tài khoản mình</span><span>{info.taiKhoan ?? <span style={phu}>chưa ghi</span>}</span>
        <span style={phu}>Liên hệ</span>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {info.lienHe.length ? info.lienHe.map((l, i) => { const h = linkLienHe(l); return <span key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <span style={{ ...phu, fontSize: 11.5 }}>{NHAN_KENH[l.kenh] ?? l.kenh}{l.ten ? ` · ${l.ten}` : ''}:</span>
            {h ? <LinkChip href={h} tone="neutral" size="xs">{l.gia_tri}</LinkChip> : <span>{l.gia_tri}</span>}</span>; })
            : <span style={{ color: 'var(--warn)' }}>Chưa có người/kênh liên hệ — bấm "Sửa thông tin NCC" điền người phụ trách (tên, WhatsApp/Skype/email).</span>}
        </span>
        {info.ghiChu && <><span style={phu}>Ghi chú</span><span style={phu}>{info.ghiChu}</span></>}
      </div>
      <StatsStrip minColWidth={130} cards={[
        { key: 'sp', label: 'Sản phẩm nguồn', value: tk.spDung.length, sub: `${tk.sp.length} trong danh mục` },
        { key: 'bt', label: 'Biến thể đang cấp', value: tk.dangDung, sub: `chính ${tk.chinh} · dự phòng ${tk.duPhong}` },
        { key: 'don', label: 'Đơn đã đặt', value: dons.filter((d) => d.ncc?.maNcc).length },
        { key: 'tra', label: 'Chờ trả NCC', value: dons.filter((d) => d.buoc === 'cho_tra').length, color: dons.some((d) => d.buoc === 'cho_tra') ? 'var(--warn)' : undefined },
        { key: 'ton', label: 'Tồn thấp ở NCC', value: tonThap, color: tonThap ? 'var(--warn)' : undefined, sub: `< ${nguongTon} · ${hetNcc} hết/gỡ · đọc ${btDung.filter((v) => v.ton != null).length}/${btDung.length}` },
        { key: 'tre', label: 'Giao trễ', value: dons.filter((d) => d.buoc === 'tre').length, color: dons.some((d) => d.buoc === 'tre') ? 'var(--bad)' : undefined },
        ...(ncc === 'cj' ? [{ key: 'vi', label: 'Số dư ví CJ', value: soDu === undefined ? '…' : soDu === null ? '—' : tien(soDu) }] : []),
        { key: 'hs', label: 'Trao đổi đang mở', value: hs.filter((h) => h.trangThai !== 'xong').length, color: hs.some((h) => h.trangThai === 'moi') ? 'var(--warn)' : undefined },
      ]} />
    </Panel>

    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 8px', flexWrap: 'wrap' }}>
      <FilterChips urlKey="nm" value={muc} onChange={setMuc} allValue="tong_quan" counts={{ san_pham: tk.sp.length, bien_dong: bd.length, trao_doi: hs.filter((h) => h.trangThai !== 'xong').length }}
        options={[{ value: 'tong_quan', label: 'Tổng quan' }, { value: 'san_pham', label: 'Sản phẩm NCC', title: 'Danh mục BÊN NCC (dùng chung mọi shop): sản phẩm → màu → biến thể → shop nào đang dùng' },
          { value: 'lien_ket', label: 'Liên kết', title: 'Cây của shop: sản phẩm → nguồn + màu → biến thể → các nguồn (chính / dự phòng)' },
          { value: 'bien_dong', label: 'Biến động', title: 'Phía NCC: giá, gỡ, ngừng bán, tồn thấp · phía shop: tự ẩn, mở lại, đổi nguồn' }, { value: 'trao_doi', label: 'Trao đổi' }]} />
      <span style={{ flex: 1 }} />
      {baoDoc && <span style={{ fontSize: 12.5, ...phu }}>{baoDoc}</span>}
      {info.coApi && <button className="btn ghost" disabled={docLai} title="Đọc lại giá + biến thể + trạng thái từ NCC ngay; tồn kho từng biến thể đọc tiếp ở các nhịp 10 phút"
        onClick={() => batDocLai(async () => { const kq = await Promise.all([...new Set(tk.choShop)].map((k) => shopDocLaiNcc(k)));
          setBaoDoc(`Đã đọc ${kq.reduce((t, r) => t + ('doc' in r && r.doc ? r.doc.doc : 0), 0)} sản phẩm · tồn kho đọc tiếp trong các nhịp tới`); router.refresh(); })}>
        {docLai ? 'Đang đọc…' : 'Đọc lại NCC ngay'}</button>}
    </div>
    {muc === 'san_pham' && <DanhMucNcc sps={tk.sp} dungBt={dungBt} tenNcc={info.ten} nguongTon={nguongTon} cuaHang={cuaHang} />}
    {muc === 'lien_ket' && lienKet(ncc)}
    {muc === 'bien_dong' && <Panel pad={8}>{bd.length ? <SimpleTable rows={bd} getRowKey={(x) => String(x.id)} columns={[
      { key: 'l', header: 'Lúc', width: 96, cell: (x) => <span style={phu}>{gio(x.luc)}</span> },
      { key: 'k', header: 'Loại', width: 130, cell: (x) => <span style={{ color: LOAI_BD[x.loai]?.[1] }}>{LOAI_BD[x.loai]?.[0] ?? x.loai}</span> },
      { key: 'p', header: 'Phía', width: 120, cell: (x) => x.cuaHang ? <span>{cuaHang.find((c) => c.khoa === x.cuaHang)?.ten ?? x.cuaHang}</span> : <span style={phu}>{info.ten}</span> },
      { key: 's', header: 'Món', cell: (x) => x.cuaHang ? <span>{x.sanPham}<span style={phu}> · {x.bienThe}</span></span>
        : <span>{x.tenNccSp ?? '—'}{x.tenNccBt ? <span style={phu}> · {x.tenNccBt}</span> : null}</span> },
      { key: 'd', header: 'Thay đổi', cell: (x) => <span>{x.cu} → <b>{x.moi}</b></span> },
      { key: 'a', header: 'Ảnh hưởng', cell: (x) => { if (x.cuaHang || x.nccBtId == null) return <span style={phu}>—</span>; const d = dungBt.get(x.nccBtId) ?? [];
        return d.length ? <span title={d.map((y) => `${y.b.cuaHang} · ${y.b.sanPham} · ${y.b.ten} (${y.vai})`).join('\n')}>{d.length} biến thể shop{d.some((y) => y.dangDung) ? ' · đang dùng' : ' · chỉ dự phòng'}</span> : <span style={phu}>không shop nào dùng</span>; } },
    ]} /> : <div style={{ ...phu, fontSize: 12.5, padding: 6 }}>Chưa có biến động nào — máy ghi ở đây mỗi khi giá NCC đổi, biến thể hết/gỡ/có lại, shop tự ẩn hoặc đổi nguồn.</div>}</Panel>}
    {muc === 'trao_doi' && <BangHoSo ben="ncc" ch={ch} ds={hs} cuaHang={shops} />}
    {sua && <SuaNcc n={sua} onClose={() => setSua(null)} />}
  </>);
}

/** Danh mục BÊN NCC, dạng cây: sản phẩm NCC → (thông tin) + màu → biến thể NCC (tên/SKU/mã/giá/tồn theo kho) → shop nào đang dùng (chính/dự phòng).
 *  Danh mục dùng chung mọi shop (shop_ncc_sp/shop_ncc_bt, đọc mỗi ngày); tồn chỉ đọc cho biến thể đang làm nguồn. */
function DanhMucNcc({ sps, dungBt, tenNcc, nguongTon, cuaHang }: { sps: NccSpDong[]; dungBt: Map<number, Dung[]>; tenNcc: string; nguongTon: number; cuaHang: CuaHangDong[] }) {
  const [mo, setMo] = useState<Set<number>>(() => new Set(docUrl('nsp', '').split(',').filter(Boolean).map(Number)));
  useEffect(() => ghiUrl('nsp', [...mo].join(','), ''), [mo]);
  const [moTt, setMoTt] = useState<Set<number>>(new Set());
  const doi = (s: Set<number>, id: number) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; };
  const tenShop = (k: string) => cuaHang.find((c) => c.khoa === k)?.ten ?? k;
  const ds = [...sps].sort((a, b) => Number(b.bt.some((v) => dungBt.has(v.id))) - Number(a.bt.some((v) => dungBt.has(v.id))));
  if (!ds.length) return <div style={{ ...phu, padding: 8 }}>Chưa có sản phẩm nào của {tenNcc} trong danh mục — thêm nguồn ở drawer biến thể (tab Sản phẩm).</div>;
  return (
    <Panel pad={0}>
      <Cay label={`Danh mục ${tenNcc}`}>
        {ds.map((s) => {
          const gia = s.bt.map((v) => v.gia).filter((x): x is number => x != null);
          const dungO = [...new Map(s.bt.flatMap((v) => dungBt.get(v.id) ?? []).map((d) => [d.b.sanPhamId, d.b])).values()];
          const ton = s.bt.filter((v) => dungBt.has(v.id)).map((v) => v.ton).filter((x): x is number => x != null);
          const het = ton.filter((x) => x === 0).length, thap = ton.filter((x) => x > 0 && x < nguongTon).length;
          const anh = s.info.chi_tiet?.anh?.[0] ?? s.bt.find((v) => v.info.anh)?.info.anh ?? null;
          const nhom = new Map<string, typeof s.bt>();
          for (const v of s.bt) { const m = tachBienThe(v.ten ?? v.ma).mau || 'Khác'; nhom.set(m, [...(nhom.get(m) ?? []), v]); }
          const ct = s.info.chi_tiet;
          return (
            <NutCay key={s.id} mo={mo.has(s.id)} onDoi={() => setMo((x) => doi(x, s.id))} mo_nhat={!dungO.length}
              dau={anh ? <img src={anh} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ width: 40 }} />}
              ten={<><b style={{ fontSize: 14 }}>{s.ten ?? s.ma}</b>
                <Pill color={s.dangBan === false ? 'var(--bad)' : 'var(--ok)'} label={s.dangBan === false ? 'NCC ngừng bán' : 'NCC đang bán'} uppercase={false} mono={false} />
                {het > 0 && <Pill color="var(--bad)" label={`${het} hết`} uppercase={false} mono={false} />}
                {thap > 0 && <Pill color="var(--warn)" label={`${thap} tồn thấp`} uppercase={false} mono={false} />}
                {s.loi && <Pill color="var(--bad)" label={`đọc lỗi: ${s.loi.slice(0, 40)}`} uppercase={false} mono={false} />}</>}
              phu={<span style={{ fontFamily: 'var(--font-mono)' }}>{s.info.sku ? `SKU ${s.info.sku} · ` : ''}mã {s.ma} · {s.bt.length} biến thể · giá {gia.length ? `${tien(Math.min(...gia))}${Math.max(...gia) !== Math.min(...gia) ? `–${tien(Math.max(...gia))}` : ''}` : '—'}
                {s.info.listed != null ? ` · ${s.info.listed} shop khác bán` : ''} · đọc {gio(s.luc)}</span>}
              phai={dungO.length ? dungO.slice(0, 3).map((b) => <LinkChip key={b.sanPhamId} href={`/shop?tab=san_pham&ch=${b.cuaHang}&spm=${b.sanPhamId}`} tone="neutral" size="xs">{tenShop(b.cuaHang)} › {b.sanPham.slice(0, 28)} ↗</LinkChip>)
                : <span style={{ fontSize: 12, ...phu }}>chưa shop nào dùng</span>}>
              {ct && <NutCay mo={moTt.has(s.id)} onDoi={() => setMoTt((x) => doi(x, s.id))} ten={<span style={phu}>Thông tin sản phẩm bên NCC</span>}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, padding: '4px 12px 10px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 10px', fontSize: 12.5 }}>
                    {([['Danh mục', ct.danh_muc], ['Loại', ct.loai], ['Chất liệu', ct.chat_lieu], ['Đóng gói', ct.dong_goi],
                      ['Cân nặng', ct.can_nang ? `${ct.can_nang} g` : null], ['Cân đóng gói', ct.can_dong_goi ? `${ct.can_dong_goi} g` : null],
                      ['Giá NCC gợi ý bán', ct.gia_goi_y ? tien(ct.gia_goi_y) : null], ['Lên NCC từ', ct.tao_luc?.slice(0, 10) ?? null]] as [string, string | null][])
                      .map(([k, v]) => <span key={k} style={{ display: 'contents' }}><span style={phu}>{k}</span><span>{v ?? '—'}</span></span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignContent: 'flex-start' }}>
                    {ct.anh.map((a) => <a key={a} href={a} target="_blank" rel="noreferrer"><img src={a} alt="" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} /></a>)}
                  </div>
                  {ct.mo_ta && <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{ct.mo_ta}</p>}
                </div>
              </NutCay>}
              {[...nhom.entries()].map(([m, vs]) => {
                const soDung = vs.filter((v) => dungBt.has(v.id)).length;
                return (
                  <NutCay key={m} mo_nhat={!soDung}
                    dau={vs.find((v) => v.info.anh)?.info.anh ? <img src={vs.find((v) => v.info.anh)!.info.anh!} alt="" width={22} height={22} style={{ objectFit: 'cover', borderRadius: 11 }} /> : undefined}
                    ten={<><b>{m}</b><span style={phu}>{vs.length} biến thể · shop dùng {soDung}</span>{!soDung && <span style={{ color: 'var(--accent)', fontSize: 12 }}>chưa shop nào bán màu này</span>}</>}>
                    <LaBang cot={COT_DM}>
                        <tbody>{[...vs].sort((a, b) => thuTuSize(tachBienThe(a.ten ?? a.ma).co) - thuTuSize(tachBienThe(b.ten ?? b.ma).co)).map((v) => {
                          const d = dungBt.get(v.id) ?? [];
                          return (
                            <tr key={v.id} style={{ borderTop: '1px solid var(--line)', color: d.length ? undefined : 'var(--fg-3)', textDecoration: v.mat ? 'line-through' : undefined }}>
                              <td style={oLa()} title={v.ten ?? v.ma}>{v.ten ?? v.ma}</td>
                              <td style={{ ...oLa(), fontFamily: 'var(--font-mono)', fontSize: 11.5 }} title={v.sku ?? ''}>{v.sku || '—'}</td>
                              <td style={{ ...oLa(), fontFamily: 'var(--font-mono)', fontSize: 11.5 }} title={v.ma}>{duoi(v.ma)}</td>
                              <td style={oLa(true)}>{tien(v.gia)}</td>
                              <td style={{ ...oLa(true), ...phu }}>{tien(v.info.gia_goi_y ?? null)}</td>
                              <td style={{ ...oLa(), ...phu, fontSize: 11.5 }}>{[v.info.can ? `${v.info.can} g` : null, v.info.kich].filter(Boolean).join(' · ') || '—'}</td>
                              <td style={{ ...oLa(), color: v.ton === 0 ? 'var(--bad)' : v.ton != null && v.ton < nguongTon ? 'var(--warn)' : undefined }}
                                title={d.length ? undefined : 'Chỉ đọc tồn cho biến thể đang làm nguồn'}>
                                {v.ton == null ? '—' : v.tonKho.length ? v.tonKho.map((k) => `${k.nuoc || k.kho} ${k.so.toLocaleString('en-US')}`).join(' · ') : v.ton.toLocaleString('en-US')}
                                {v.ton != null && v.ton < nguongTon && <b>{v.ton === 0 ? ' · hết' : ' · thấp'}</b>}{v.mat && ' · không còn trên NCC'}</td>
                              <td style={oLa()}>{d.length ? d.map((y) => <div key={y.nguonId} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${tenShop(y.b.cuaHang)} · ${y.b.sanPham} · ${y.b.ten} · ${y.vai}`}>
                                <span style={{ color: y.dangDung ? 'var(--ok)' : undefined }}>{tenShop(y.b.cuaHang)} · {y.b.ten}</span>
                                <span style={phu}> · {y.vai}{y.dangDung ? ' · đang dùng' : ''}</span></div>) : 'chưa dùng'}</td>
                            </tr>
                          );
                        })}</tbody>
                    </LaBang>
                  </NutCay>
                );
              })}
            </NutCay>
          );
        })}
      </Cay>
    </Panel>
  );
}
