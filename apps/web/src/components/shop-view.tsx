'use client';
// /shop — backend vận hành cửa hàng (mellowstep…): Đơn hàng · Vận chuyển · Sản phẩm↔NCC · Cửa hàng.
// Trạng thái màn nằm trọn trong URL (?tab, ?b bước, ?ch cửa hàng, ?m=don&mId= drawer) — F5/share giữ nguyên.
// Toàn bộ dựng trên primitive nhà (DataTable · Drawer · Tabs · FilterChips · StatsStrip · Panel · SimpleTable · LinkChip · TextField ·
// EmptyState · Pill). Định dạng tiền/giờ/link vận đơn: lib/shop/buoc.ts (một bản cho cả máy chủ + trình duyệt).
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DaiLuong, DataTable, Drawer, SelectField, ThanhChang, type NutLuong, EmptyState, FilterChips, LinkChip, Panel, Pill, SimpleTable, StatsStrip, Tabs, TextAreaField, TextField, type DataColumn,
} from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { useShallowParam, writeShallowParam } from '@/lib/url-shallow';
import { hrefTab, tabCua } from '@/lib/tab-trang';
import { KhachTrucTiep } from './shop-truc-tiep';
import { BangTuVan } from './shop-tu-van';
import { CaySanPham } from './shop-san-pham';
import { BangNcc } from './shop-ncc';
import { DrawerCaiDat, TheCuaHang } from './shop-cau-hinh';
import { BangHoSo } from './shop-ho-so';
import type { BienDongNcc, HoSoDong, NccDong } from '@/lib/shop/ho-so-doc';
import { DrawerNguon } from './shop-nguon';
import { CHANG, type HanhTrinh, type KhoaChang } from '@mos2/shop/hanh-trinh';
import { BUOC, LINK_DS_CJ, NHAN_BUOC, gio, isoCua, linkVanDon, soNgayTu, tien, type Buoc } from '@/lib/shop/buoc';
import type { BienTheDong, ChiTietDon, CuaHangDong, DanhGiaDong, DonDong, NccSpDong, SanPhamDong } from '@/lib/shop/doc';
import type { DoiThuDong } from '@/lib/shop/doi-thu-doc';
import { BangDoiThu } from './shop-doi-thu';
import { BangCong, soCongCanXem } from './shop-cong';
import { LOAI_XIN_HOAN, MAU_MUC, tomTtDon } from '@/lib/shop/tt-don-luat';
import { KhachDon, MonDon, TienDon } from './shop-don-chi-tiet';
import type { CongDong, PhapNhanDong } from '@/lib/shop/cong-luat';
import { BangHaTang } from './shop-ha-tang';
import type { CheDo } from '@/lib/shop/che-do';
import { shopMoHoSo, shopSoDuNcc, shopTienNcc } from '@/lib/actions/shop';
import { shopChiTietDon, shopDongBo, shopDuyetDanhGia, shopGhiChu, shopSangNcc, shopSuaSanPham, shopTraNcc } from '@/lib/actions/shop';

type Tab = 'don' | 'tu_van' | 'truc_tiep' | 'khach_ph' | 'ncc' | 'san_pham' | 'doi_thu' | 'danh_gia' | 'cua_hang' | 'thanh_toan' | 'ha_tang';
/** Chặng vận chuyển: lọc tới đây thì bảng đơn đổi sang cột vận đơn (tab Vận chuyển cũ gộp vào Đơn hàng 02/10/2026). */
const BUOC_VC = new Set<string>(['ncc_xu_ly', 'dang_giao', 'tre', 'da_giao']);
// Màu bước = tín hiệu: amber chờ người, đỏ lỗi/trễ, xanh đã giao; bước đang chạy bình thường để trung tính.
const MAU: Record<string, string> = { muted: 'var(--fg-3)', warn: 'var(--warn)', bad: 'var(--bad)', ok: 'var(--ok)' };
const MAU_BUOC = Object.fromEntries(BUOC.map((b) => [b.key, MAU[b.mau]])) as Record<Buoc, string>;
const CHU_BUOC = Object.fromEntries(BUOC.map((b) => [b.key, b.chuThich])) as Record<Buoc, string>;
const mauTien = (x: number | null) => (x === null ? undefined : x >= 0 ? 'var(--ok)' : 'var(--bad)');
const linkWoo = (d: { domain: string; maNgoai: string }) => `https://${d.domain}/wp-admin/admin.php?page=wc-orders&action=edit&id=${d.maNgoai}`;
const phu: React.CSSProperties = { color: 'var(--fg-3)' };

function BuocPill({ b }: { b: Buoc }) {
  return <Pill color={MAU_BUOC[b]} label={NHAN_BUOC[b]} title={CHU_BUOC[b]} uppercase={false} mono={false} />;
}
const VanDon = ({ ma }: { ma: string }) => <LinkChip href={linkVanDon(ma)} tone="neutral" size="xs" onClick={(e) => e.stopPropagation()}>{ma} ↗</LinkChip>;

export function ShopView({ don, bienThe, cuaHang, sanPham, danhGia, hoSo, ncc, danhMuc, bienDong, doiThu, cong, phapNhan, cheDo, dsCh }: { cheDo: CheDo; /** khoá các cửa hàng thuộc chế độ đang xem — tab tự tải dữ liệu lọc theo đây */ dsCh: string[]; don: DonDong[]; bienThe: BienTheDong[]; cuaHang: CuaHangDong[]; sanPham: SanPhamDong[]; danhGia: DanhGiaDong[]; hoSo: HoSoDong[]; ncc: NccDong[]; danhMuc: NccSpDong[]; bienDong: BienDongNcc[]; doiThu: DoiThuDong[]; cong: CongDong[]; phapNhan: PhapNhanDong[] }) {
  const [tabUrl, datTab] = useShallowParam('tab', 'don');
  const tab = tabUrl as Tab, setTab = (t: Tab) => datTab(t);
  const [buoc, setBuoc] = useShallowParam('b', 'all');
  const [chUrl, setCh] = useShallowParam('ch', 'all');
  // ?ch trỏ sang cửa hàng của chế độ kia (link cũ) = coi như mọi cửa hàng
  const ch = chUrl === 'all' || dsCh.includes(chUrl) ? chUrl : 'all';
  const router = useRouter();
  // đổi chế độ = tải lại dữ liệu ở máy chủ (page.tsx lọc); bỏ ?ch + drawer đang mở vì thuộc chế độ cũ
  const hrefCheDo = (v: CheDo) => {
    if (typeof window === 'undefined') return null;
    const u = new URL(window.location.href);
    for (const k of ['ch', 'm', 'mId']) u.searchParams.delete(k);
    if (v === 'demo') u.searchParams.set('du_lieu', 'demo'); else u.searchParams.delete('du_lieu');
    return `${u.pathname}${u.search}`;
  };
  const [ht, setHt] = useShallowParam('ht', '');
  // link cũ ?tab=van_chuyen (tab đã gộp vào Đơn hàng) → Đơn hàng lọc "Đang giao"
  useEffect(() => { if (tabUrl === 'van_chuyen') { setTab('don'); if (buoc === 'all') setBuoc('dang_giao'); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const modal = useModalParam();
  const [dangChay, batDau] = useTransition();
  const [bao, setBao] = useState<string | null>(null);


  const theoCh = useMemo(() => don.filter((d) => ch === 'all' || d.cuaHang === ch), [don, ch]);
  const dem = useMemo(() => { const c: Partial<Record<string, number>> = { all: theoCh.length }; for (const d of theoCh) c[d.buoc] = (c[d.buoc] ?? 0) + 1; return c; }, [theoCh]);
  const dsDon = useMemo(() => theoCh.filter((d) => (buoc === 'all' || d.buoc === buoc) && (!ht || (ht === 'ngoai' ? !d.ht : d.ht?.chang[d.ht.hienTai]?.key === ht))), [theoCh, buoc, ht]);
  const bt = useMemo(() => bienThe.filter((b) => ch === 'all' || b.cuaHang === ch), [bienThe, ch]);
  const sps = useMemo(() => sanPham.filter((p) => ch === 'all' || p.cuaHang === ch), [sanPham, ch]);
  const dgs = useMemo(() => danhGia.filter((g) => ch === 'all' || g.cuaHang === ch), [danhGia, ch]);
  const choDuyet = dgs.filter((g) => g.trangThai === 'cho').length;
  // badge hồ sơ = việc mình phải đụng: Mới + Đang xử lý (Chờ bên kia không tính)
  const canLam = (ben: 'khach' | 'ncc') => hoSo.filter((h) => h.ben === ben && h.loai !== 'tu_van' && (ch === 'all' || h.cuaHang === ch) && (h.trangThai === 'moi' || h.trangThai === 'dang_xu_ly')).length;
  const choChat = hoSo.filter((h) => h.loai === 'tu_van' && h.trangThai === 'moi' && (ch === 'all' || h.cuaHang === ch)).length;
  const canXuLy = (dem.cho_ncc ?? 0) + (dem.loi_ncc ?? 0) + (dem.cho_tra ?? 0) + (dem.tre ?? 0);

  // KPI 30 ngày: đơn đã trả tiền (bỏ chưa trả + huỷ), doanh thu sau hoàn, lãi ước (đơn đủ giá vốn), đơn cần xử lý
  const kpi = useMemo(() => {
    const tu = Date.now() - 30 * 86_400_000;
    const tra = theoCh.filter((d) => d.buoc !== 'cho_tt' && d.buoc !== 'huy' && new Date(isoCua(d.taoLuc)).getTime() > tu);
    const coLai = tra.filter((d) => d.lai !== null);
    // Đo "khách có yên tâm không": hồ sơ khách hỏi/khiếu nại (không tính dispute) trên 100 đơn, và dispute 90 ngày — cùng sổ hồ sơ
    const hs = hoSo.filter((h) => h.ben === 'khach' && (ch === 'all' || h.cuaHang === ch));
    const hoi = hs.filter((h) => h.loai !== 'dispute' && (h.loai !== 'tu_van' || h.donId != null) && new Date(isoCua(h.taoLuc)).getTime() > tu).length;   // chat trước khi mua không phải "hỏi đơn"
    const dispute = hs.filter((h) => h.loai === 'dispute' && new Date(isoCua(h.taoLuc)).getTime() > Date.now() - 90 * 86_400_000).length;
    return { don: tra.length, dt: tra.reduce((t, d) => t + d.tong - d.hoan, 0), lai: coLai.reduce((t, d) => t + (d.lai ?? 0), 0), thieuLai: tra.length - coLai.length, hoi, dispute };
  }, [theoCh, hoSo, ch]);

  const dongBo = () => batDau(async () => {
    setBao(null);
    const r = await shopDongBo(ch === 'all' ? undefined : ch).catch((e) => ({ ok: false, loi: (e as Error).message }));
    setBao(r.ok ? 'Đã đồng bộ' : `Lỗi: ${r.loi}`);
  });

  // đơn có hồ sơ khách đang mở loại hoàn tiền / đổi trả = khách đòi lại tiền giữa chừng
  const xinHoan = (donId: number) => hoSo.some((h) => h.ben === 'khach' && h.donId === donId && LOAI_XIN_HOAN.includes(h.loai) && h.trangThai !== 'xong');
  const cotDon: DataColumn<DonDong>[] = [
    { key: 'so', header: 'Đơn', align: 'left', cell: (d) => <b>#{d.soDon}</b>, sortValue: (d) => Number(d.soDon) || 0 },
    { key: 'luc', header: 'Lúc', align: 'left', cell: (d) => gio(d.taoLuc), sortValue: (d) => d.taoLuc },
    { key: 'buoc', header: 'Bước', align: 'left', cell: (d) => <BuocPill b={d.buoc} />, sortValue: (d) => BUOC.findIndex((b) => b.key === d.buoc) },
    { key: 'ht', header: 'Hành trình', align: 'left', cell: (d) => <ThanhHanhTrinh ht={d.ht} />, sortValue: (d) => d.ht?.pct ?? -1 },
    { key: 'khach', header: 'Khách', align: 'left', cell: (d) => <>{d.khach || '—'} <span style={phu}>{d.bang ? `${d.bang}, ` : ''}{d.nuoc}</span></> },
    { key: 'mon', header: 'Món', align: 'left', cell: (d) => <span style={{ display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{d.tenMon}</span>, cellTitle: (d) => d.tenMon },
    { key: 'tong', header: 'Tổng', cell: (d) => tien(d.tong), sortValue: (d) => d.tong, total: (r) => tien(r.reduce((t, d) => t + d.tong, 0)) },
    { key: 'tt', header: 'Thanh toán', align: 'left', title: 'Khách trả qua cổng nào · tiền về tới đâu (giữ / khả dụng / đã rút) · có hoàn, dispute, cảnh báo gian lận, khách xin hoàn không',
      cell: (d) => { const t = tomTtDon(d.tt, d.congTt, xinHoan(d.id)); return <span style={{ color: MAU_MUC[t.muc], whiteSpace: 'nowrap' }} title={t.chi_tiet.join('\n')}>{t.nhan}</span>; },
      sortValue: (d) => ({ do: 0, vang: 1, nhat: 2, tot: 3 } as const)[tomTtDon(d.tt, d.congTt, xinHoan(d.id)).muc] },
    { key: 'lai', header: 'Lãi ước', title: 'Tổng − hoàn − giá vốn NCC − ship NCC − phí cổng (Stripe thật, chưa có thì 2.9% + 30¢). — = thiếu giá vốn.',
      cell: (d) => <span style={{ color: mauTien(d.lai) }}>{tien(d.lai)}</span>, sortValue: (d) => d.lai, total: (r) => tien(r.reduce((t, d) => t + (d.lai ?? 0), 0)) },
    { key: 'ncc', header: 'NCC', align: 'left', cell: (d) => d.ncc?.maNcc ? <span title={d.ncc.tuyen ?? ''}>{d.ncc.trangThai}{d.ncc.daTra ? '' : ' · chưa trả'}</span> : '—' },
    { key: 'vd', header: 'Vận đơn', align: 'left', cell: (d) => (d.ncc?.maVanDon ? <VanDon ma={d.ncc.maVanDon} /> : '—') },
    { key: 'nguon', header: 'Nguồn', align: 'left', group: 'them', cell: (d) => d.sid ?? '—' },
    { key: 'ch', header: 'Cửa hàng', align: 'left', group: 'them', cell: (d) => d.cuaHang },
  ];

  const cotVc: DataColumn<DonDong>[] = [
    { key: 'so', header: 'Đơn', align: 'left', cell: (d) => <b>#{d.soDon}</b> },
    { key: 'buoc', header: 'Bước', align: 'left', cell: (d) => <BuocPill b={d.buoc} /> },
    { key: 'ht', header: 'Hành trình', align: 'left', cell: (d) => <ThanhHanhTrinh ht={d.ht} />, sortValue: (d) => d.ht?.pct ?? -1 },
    { key: 'khach', header: 'Khách', align: 'left', cell: (d) => <>{d.khach || '—'} <span style={phu}>{d.bang ? `${d.bang}, ` : ''}{d.nuoc}</span></> },
    { key: 'tuyen', header: 'Tuyến', align: 'left', cell: (d) => (d.ncc?.tuyen ? `${d.ncc.tuyen} · ${d.ncc.soNgay} ngày` : '—') },
    { key: 'vd', header: 'Mã vận đơn', align: 'left', cell: (d) => (d.ncc?.maVanDon ? <VanDon ma={d.ncc.maVanDon} /> : '—') },
    { key: 'hang', header: 'Hãng', align: 'left', cell: (d) => d.ncc?.hang ?? '—' },
    { key: 'gui', header: 'Gửi', align: 'left', cell: (d) => gio(d.ncc?.guiLuc), sortValue: (d) => d.ncc?.guiLuc ?? '' },
    { key: 'ngay', header: 'Số ngày', title: 'Số ngày từ lúc có mã vận đơn.',
      cell: (d) => { const n = soNgayTu(d.ncc?.guiLuc); return n === null ? '—' : <span style={{ color: d.buoc === 'tre' ? 'var(--bad)' : undefined }}>{n}</span>; },
      sortValue: (d) => soNgayTu(d.ncc?.guiLuc) },
    { key: 'hanh_trinh', header: 'Hãng báo', align: 'left', cell: (d) => d.ncc?.vanDon ?? '—' },
    { key: 'giao', header: 'Giao', align: 'left', cell: (d) => gio(d.ncc?.giaoLuc) },
  ];

  const thieuMa = bt.filter((b) => !b.maNcc || b.giaVon === null).length;
  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Shop</h1>
        <span className="page-sub">Sau khi khách trả tiền: đặt NCC → trả NCC → vận đơn → giao. Mặt tiền + thu tiền: Woo hoặc mặt tiền MOS (theo cửa hàng).</span>
        <span style={{ flex: 1 }} />
        <FilterChips<CheDo> value={cheDo} onChange={(v) => { const h = hrefCheDo(v); if (h) router.push(h); }} hrefFor={hrefCheDo}
          options={[{ value: 'that', label: 'Dữ liệu thật', title: 'Chỉ cửa hàng + NCC thật' }, { value: 'demo', label: 'Demo', title: 'Chỉ cửa hàng + NCC giả để xem thử khi vận hành' }]} />
        {cuaHang.length > 1 && (
          <FilterChips urlKey="ch" value={ch} onChange={setCh}
            options={[{ value: 'all', label: 'Mọi cửa hàng' }, ...cuaHang.map((c) => ({ value: c.khoa, label: c.ten }))]} />
        )}
        <Link className="btn ghost" href={`/report2?f.du_an=${encodeURIComponent(ch === 'all' ? cuaHang[0]?.khoa ?? '' : ch)}`}>Báo cáo</Link>
        <button className="btn" disabled={dangChay} onClick={dongBo}>{dangChay ? 'Đang chạy…' : 'Đồng bộ ngay'}</button>
      </div>
      {cheDo === 'demo' && <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 6, fontSize: 12.5, background: 'color-mix(in srgb, var(--warn) 14%, transparent)', color: 'var(--warn)' }}>
        Đang xem DỮ LIỆU DEMO ({cuaHang.map((c) => c.ten).join(', ') || 'chưa có cửa hàng demo'}) — đơn, sản phẩm, NCC ở đây là giả, không dính số thật.</div>}
      {bao && <div style={{ marginBottom: 8, fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</div>}


      <Tabs<Tab> value={tab} onChange={setTab} hrefFor={(k) => hrefTab('/shop', k)}
        items={tabCua<Tab>('/shop', { don: canXuLy || undefined, thanh_toan: soCongCanXem(cong.filter((g) => ch === 'all' || g.shops.includes(ch))) || undefined, san_pham: thieuMa || undefined, danh_gia: choDuyet || undefined,
          tu_van: choChat || undefined, khach_ph: canLam('khach') || undefined, ncc: canLam('ncc') || undefined })} />

      <div style={{ marginTop: 10 }}>
        {/* số đơn chỉ thuộc màn đơn — tab khác không phải gánh nửa màn số không liên quan */}
        {tab === 'don' && <div style={{ marginBottom: 10 }}>
        <StatsStrip minColWidth={150} cards={[
          { key: 'don', label: 'Đơn 30 ngày', value: kpi.don },
          { key: 'dt', label: 'Doanh thu 30 ngày', value: tien(kpi.dt), sub: 'đã trừ hoàn' },
          { key: 'lai', label: 'Lãi ước 30 ngày', value: tien(kpi.lai), color: kpi.don ? mauTien(kpi.lai) : undefined, sub: kpi.thieuLai ? `${kpi.thieuLai} đơn thiếu giá vốn` : undefined },
          { key: 'hoi', label: 'Khách hỏi / 100 đơn', value: kpi.don ? Math.round((kpi.hoi / kpi.don) * 100) : '—', sub: `${kpi.hoi} hồ sơ hỏi/khiếu nại · 30 ngày`,
          title: 'Hồ sơ khách (liên hệ, khiếu nại, đổi trả, hoàn tiền) trên 100 đơn đã trả trong 30 ngày — càng thấp càng tốt: khách thấy đơn chạy thì không phải hỏi.' },
        { key: 'dp', label: 'Dispute 90 ngày', value: kpi.dispute, color: kpi.dispute ? 'var(--bad)' : undefined, sub: 'khách khiếu nại qua ngân hàng' },
        { key: 'xl', label: 'Cần xử lý', value: canXuLy, color: canXuLy ? 'var(--warn)' : undefined, sub: 'chờ/lỗi NCC · chờ trả · trễ',
            onClick: canXuLy ? () => { setTab('don'); setBuoc(dem.loi_ncc ? 'loi_ncc' : dem.cho_tra ? 'cho_tra' : dem.tre ? 'tre' : 'cho_ncc'); } : undefined },
        ]} />
        </div>}
        {tab === 'don' && (<>
          <LuongDon don={theoCh} value={ht} onChange={(v) => setHt(v === ht ? '' : v)} />
          <div style={{ marginBottom: 8 }}>
            <FilterChips urlKey="b" value={buoc} onChange={setBuoc} counts={dem}
              options={[{ value: 'all', label: 'Tất cả' }, ...BUOC.map((b) => ({ value: b.key, label: b.nhan, title: b.chuThich }))]} />
          </div>
          {dsDon.length ? (
            <Panel pad={8}>{BUOC_VC.has(buoc) && <div style={{ fontSize: 12, ...phu, margin: '0 0 6px 4px' }}>Chặng vận chuyển — bảng hiện tuyến, mã vận đơn, hãng, số ngày.</div>}
              <DataTable key={BUOC_VC.has(buoc) ? 'vc' : 'don'} rows={dsDon} columns={BUOC_VC.has(buoc) ? cotVc : cotDon} getRowKey={(d) => String(d.id)}
              persistKey={BUOC_VC.has(buoc) ? 'shop-vc' : 'shop-don'} minWidth={980}
              groups={BUOC_VC.has(buoc) ? undefined : [{ key: 'them', label: 'Nguồn + cửa hàng', defaultOn: false }]}
              searchText={(d) => `${d.soDon} ${d.khach} ${d.email} ${d.tenMon} ${d.ncc?.maNcc ?? ''} ${d.ncc?.maVanDon ?? ''}`} searchPlaceholder="Tìm số đơn, khách, email, mã CJ, vận đơn…"
              onRowClick={(d) => modal.open('don', d.id)} /></Panel>
          ) : (
            <EmptyState icon="🛒" compact title={don.length ? `Không có đơn ở bước "${NHAN_BUOC[buoc as Buoc] ?? buoc}"` : 'Chưa có đơn nào'}
              description={don.length ? undefined : 'Đơn Woo vào đây ngay khi khách trả tiền.'}
              action={buoc !== 'all' ? <button className="btn ghost" onClick={() => setBuoc('all')}>Xem tất cả</button> : undefined} />
          )}
        </>)}

        {tab === 'tu_van' && <BangTuVan ch={ch} dsCh={dsCh} />}
        {tab === 'truc_tiep' && <KhachTrucTiep ch={ch} dsCh={dsCh} />}
        {tab === 'khach_ph' && <BangHoSo key={tab} ben="khach" ch={ch} ds={hoSo.filter((h) => h.loai !== 'tu_van')} cuaHang={cuaHang} />}
        {tab === 'ncc' && <BangNcc soNcc={ncc} ch={ch} cuaHang={cuaHang} sanPham={sanPham} bienThe={bienThe} danhMuc={danhMuc} bienDong={bienDong} don={don} hoSo={hoSo}
          lienKet={(k) => <BangSanPham bienThe={bt} danhMuc={danhMuc} soNcc={ncc} cuaHang={cuaHang} cheDo="lien_ket"
            sanPham={sps.filter((p) => !p.nguonSp.length || p.nguonSp.some((s) => s.ncc === k))} />} />}
        {tab === 'san_pham' && <BangSanPham bienThe={bt} sanPham={sps} danhMuc={danhMuc} soNcc={ncc} cuaHang={cuaHang} />}
        {tab === 'doi_thu' && <BangDoiThu ds={doiThu} sanPham={sanPham} bienThe={bienThe} ch={ch} />}
        {tab === 'danh_gia' && <BangDanhGia ds={dgs} />}
        {tab === 'thanh_toan' && <BangCong ds={cong} phapNhan={phapNhan} cuaHang={cuaHang} ch={ch} />}
        {tab === 'ha_tang' && <BangHaTang ch={ch} dsCh={dsCh} />}
        {tab === 'cua_hang' && <div style={{ display: 'grid', gap: 12 }}>{cuaHang.filter((c) => ch === 'all' || c.khoa === ch).map((c) => (
          <TheCuaHang key={c.id} c={c} moCaiDat={(muc) => { if (muc) writeShallowParam('cs', muc); modal.open('cai-dat', c.id); }} />))}</div>}
      </div>

      {modal.is('cai-dat') && modal.numId != null && cuaHang.some((c) => c.id === modal.numId) && <DrawerCaiDat c={cuaHang.find((c) => c.id === modal.numId)!} onClose={() => modal.close()} />}
      {modal.is('don') && modal.numId != null && <DrawerDon id={modal.numId} hoSo={hoSo.filter((h) => h.donId === modal.numId)} onClose={() => modal.close()} />}
    </div>
  );
}

/* ── Hành trình đơn (@mos2/shop/hanh-trinh — cùng hàm với trang theo dõi của khách) ─────────────────── */
const TEN_CHANG = Object.fromEntries(CHANG.map((c) => [c.key, c])) as Record<KhoaChang, (typeof CHANG)[number]>;

/** Luồng đơn toàn cảnh: mỗi chặng đếm số đơn đang đứng ở đó + đơn kẹt (lỗi/trễ đỏ, chờ mình vàng); ngoài luồng = chưa trả tiền / huỷ. */
function LuongDon({ don, value, onChange }: { don: DonDong[]; value: string; onChange: (v: string) => void }) {
  const theo = new Map<string, DonDong[]>();
  for (const d of don) { const k = d.ht ? d.ht.chang[d.ht.hienTai]!.key : 'ngoai'; theo.set(k, [...(theo.get(k) ?? []), d]); }
  const nut = (key: string, nhan: string, phuDe: string, title: string): NutLuong => {
    const ds = theo.get(key) ?? [];
    return { key, nhan, phuDe, title, so: ds.length, dau: [
      { n: ds.filter((d) => d.buoc === 'loi_ncc' || d.buoc === 'tre').length, nhan: 'lỗi/trễ', mau: 'var(--bad)' },
      { n: ds.filter((d) => d.buoc === 'cho_ncc' || d.buoc === 'cho_tra').length, nhan: 'chờ mình', mau: 'var(--warn)' },
    ] };
  };
  return <DaiLuong urlKey="ht" value={value} onChange={onChange} nut={CHANG.map((c) => nut(c.key, c.nhan, `${c.pct}%`, c.chuThich))}
    ngoai={nut('ngoai', 'Chưa trả / huỷ', '', 'Đơn chưa thanh toán xong hoặc đã huỷ/hoàn — không đi trên luồng.')} />;
}

function ThanhHanhTrinh({ ht }: { ht: HanhTrinh | null }) {
  if (!ht) return <span style={phu}>—</span>;
  const c = ht.chang[ht.hienTai]!;
  return <ThanhChang so={ht.chang.length} i={ht.hienTai} nhan={c.nhan} phuDe={`${ht.pct}%`} title={`${c.nhan} · ~${ht.pct}% quãng đường${c.luc ? ` · ${gio(c.luc)}` : ''}`} />;
}

/** Bảng chặng trong drawer đơn: từng chặng · lúc (mốc thật) · nơi/chi tiết; chặng đang đứng tô đậm. */
function BangHanhTrinh({ ht, soNgay, guiLuc }: { ht: HanhTrinh; soNgay: string | null; guiLuc: string | null }) {
  const n = soNgayTu(guiLuc), toiDa = soNgay ? Math.max(...(soNgay.match(/\d+/g) ?? ['0']).map(Number)) : null;
  return (
    <Panel pad={8} title={`Hành trình · ${TEN_CHANG[ht.chang[ht.hienTai]!.key].nhan} · ~${ht.pct}% quãng đường`}
      subtitle={n !== null && ht.pct < 100 ? `Ngày thứ ${n}${toiDa ? ` / tuyến ${soNgay} ngày` : ''} kể từ lúc gửi` : undefined}>
      <SimpleTable rows={ht.chang} getRowKey={(c) => c.key}
        rowStyle={(c) => (ht.chang[ht.hienTai]!.key === c.key ? { fontWeight: 700 } : !c.xong ? { color: 'var(--fg-3)' } : undefined)} columns={[
          { key: 'd', header: '', width: 22, cell: (c) => (ht.chang[ht.hienTai]!.key === c.key ? <span style={{ color: 'var(--accent)' }}>●</span> : c.xong ? <span style={{ color: 'var(--ok)' }}>✓</span> : '○') },
          { key: 'n', header: 'Chặng', cell: (c) => <span title={TEN_CHANG[c.key].chuThich}>{c.nhan}</span> },
          { key: 'p', header: '%', width: 44, align: 'right', cell: (c) => `${c.pct}%` },
          { key: 'l', header: 'Lúc', width: 96, cell: (c) => (c.luc ? gio(c.luc) : c.xong ? <span style={phu}>đã qua</span> : '—') },
          { key: 'c', header: 'Nơi / chi tiết', cell: (c) => <span style={phu}>{c.chiTiet ?? ''}</span> },
        ]} />
    </Panel>
  );
}

/* ── Drawer một đơn: đầu ghim (số đơn · bước · hành động) + 2 tab Đơn | Nhật ký ─────────────────── */
function DrawerDon({ id, hoSo, onClose }: { id: number; hoSo: HoSoDong[]; onClose: () => void }) {
  const [ct, setCt] = useState<ChiTietDon | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const [xacNhanTra, setXacNhanTra] = useState(false);
  const [ghiChu, setGhiChu] = useState('');
  const [tab, setTab] = useState<'don' | 'nhat_ky'>('don');
  useEffect(() => { shopChiTietDon(id).then(setCt).catch((e) => setLoi((e as Error).message)); }, [id]);
  const lam = (f: () => Promise<{ ok: boolean; loi?: string }>) => batDau(async () => {
    setLoi(null); setXacNhanTra(false);
    const r = await f().catch((e) => ({ ok: false, loi: (e as Error).message }));
    if (!r.ok || r.loi) setLoi(r.loi ?? 'lỗi');
    setCt(await shopChiTietDon(id));
  });
  const d = ct?.don;
  // Số sẽ trừ ví: tiền hàng CJ báo cho đúng đơn này + ship; chưa có (đơn cũ) mới rơi về ước theo giá vốn sổ
  const theoCj = d?.ncc?.tienHang != null;
  const traDuKien = d ? (theoCj ? d.ncc!.tienHang! : d.giaVon ?? 0) + (d.shipNcc ?? 0) : 0;
  const [soDu, setSoDu] = useState<number | null | undefined>(undefined);
  // số đọc lại từ CJ lúc bấm Trả (undefined = đang đọc, null = CJ không trả lời → dùng số đã lưu)
  const [tienMoi, setTienMoi] = useState<{ tong: number; cu: number | null; doi: boolean } | null | undefined>(undefined);
  const soTra = tienMoi ? tienMoi.tong : traDuKien;
  const NHAN_TT: Record<string, string> = { processing: 'khách đã trả', completed: 'đã gửi hàng', pending: 'chưa trả tiền', 'on-hold': 'tạm giữ', cancelled: 'đã huỷ', refunded: 'đã hoàn', failed: 'trả lỗi' };
  const dong = (nhan: string, giaTri: ReactNode) => (<><span style={phu}>{nhan}</span><span>{giaTri}</span></>);
  return (
    <Drawer onClose={onClose} width={1000}>
      {!ct ? <div style={phu}>{loi ?? 'Đang tải…'}</div> : !d ? <div>Không thấy đơn.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Đơn #{d.soDon}</h2>
            <BuocPill b={d.buoc} />
            <span style={{ ...phu, fontSize: 12.5 }}>{gio(d.taoLuc)} · {d.nenTang === 'woo' ? `Woo ${d.trangThaiShop}` : NHAN_TT[d.trangThaiShop] ?? d.trangThaiShop} · {tien(d.tong)}</span>
          </div>
          {/* Hành động theo bước — chỉ nút hợp lệ với bước hiện tại; link ngoài là chip trung tính */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(d.buoc === 'cho_ncc' || d.buoc === 'loi_ncc') && (
              <button className="btn primary" disabled={dangChay} onClick={() => lam(() => shopSangNcc(id))}>{d.buoc === 'loi_ncc' ? 'Đặt lại sang CJ' : 'Sang CJ'}</button>
            )}
            {d.buoc === 'cho_tra' && (xacNhanTra ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
                {tienMoi === undefined ? <span style={phu}>Đang đọc lại số tiền từ CJ…</span> : <>
                Trừ ví CJ {tien(soTra)}{tienMoi ? ' (CJ báo lúc này)' : theoCj ? ' (số CJ báo lúc tạo đơn — không đọc lại được)' : ' (ước theo giá vốn sổ)'}?
                {tienMoi?.doi && <span style={{ color: 'var(--warn)' }}>CJ đã đổi từ {tien(tienMoi.cu)}</span>}</>}
                <span style={{ color: soDu != null && soDu < soTra ? 'var(--bad)' : 'var(--fg-3)' }}>Ví CJ: {soDu === undefined ? '…' : soDu === null ? 'không đọc được' : tien(soDu)}</span>
                {soDu != null && soDu < soTra
                  ? <><span style={{ color: 'var(--bad)' }}>không đủ — nạp ví hoặc trả bằng thẻ trên CJ</span><LinkChip href={LINK_DS_CJ} tone="neutral" size="xs">Mở đơn trên CJ ↗</LinkChip></>
                  : <button className="btn danger" disabled={dangChay || soDu === undefined || tienMoi === undefined} onClick={() => lam(() => shopTraNcc(id))}>Trả</button>}
                <button className="btn ghost" onClick={() => setXacNhanTra(false)}>Thôi</button>
              </span>
            ) : <button className="btn primary" disabled={dangChay} onClick={() => { setXacNhanTra(true); setSoDu(undefined); setTienMoi(undefined); shopSoDuNcc().then(setSoDu).catch(() => setSoDu(null)); shopTienNcc(id).then(setTienMoi).catch(() => setTienMoi(null)); }}>Trả CJ {tien(traDuKien)}</button>)}
            {dangChay && <span style={{ ...phu, fontSize: 12.5 }}>Đang chạy…</span>}
            <span style={{ flex: 1 }} />
            {d.nenTang === 'woo' && <LinkChip href={linkWoo(d)} tone="neutral">Woo ↗</LinkChip>}
            {d.ncc?.maNcc && <LinkChip href={LINK_DS_CJ} tone="neutral">CJ ↗</LinkChip>}
            {d.ncc?.maVanDon && <LinkChip href={linkVanDon(d.ncc.maVanDon)} tone="neutral">Vận đơn ↗</LinkChip>}
          </div>
          {(loi || d.ncc?.loi) && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi ?? d.ncc?.loi}</div>}
          {/* Hồ sơ trao đổi của đơn này (khách / NCC) — mở mới ngay từ đơn, bấm hồ sơ để vào luồng tin */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
            <span style={phu}>Hồ sơ:</span>
            {hoSo.map((h) => <LinkChip key={h.id} href={`/shop?tab=${h.ben === 'ncc' ? 'ncc' : 'khach_ph'}&m=ho-so&mId=${h.id}`} tone="neutral" size="xs">
              #{h.id} {h.ben === 'ncc' ? 'NCC' : 'khách'} · {h.tieuDe.slice(0, 40)}</LinkChip>)}
            {(['khach', 'ncc'] as const).map((ben) => (
              <button key={ben} className="btn ghost" disabled={dangChay} onClick={() => batDau(async () => {
                const r = await shopMoHoSo({ khoa: d.cuaHang, ben, loai: ben === 'ncc' ? 'hoi' : 'khieu_nai', tieuDe: `Đơn #${d.soDon}`, soDon: d.soDon });
                if (r.ok && r.id) window.location.href = `/shop?tab=${ben === 'ncc' ? 'ncc' : 'khach_ph'}&m=ho-so&mId=${r.id}`; else setLoi(r.loi ?? 'lỗi');
              })}>+ Hồ sơ {ben === 'ncc' ? 'NCC' : 'khách'}</button>
            ))}
          </div>

          <Tabs<'don' | 'nhat_ky'> value={tab} onChange={setTab} items={[
            { key: 'don', label: 'Đơn' },
            { key: 'nhat_ky', label: 'Nhật ký', badge: ct.suKien.length || undefined },
          ]} />

          {tab === 'don' && (<>
            {/* hai cột như trang đơn Shopdy: trái = đơn (món · tiền · thanh toán · NCC/vận chuyển), phải = khách (liên hệ · hành trình mua · thiết bị · nguồn · rủi ro) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <MonDon mon={ct.mon} />
            <TienDon ct={ct} d={d} />
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '4px 10px', fontSize: 13 }}>
              {dong('Đơn NCC', d.ncc?.maNcc ? `CJ ${d.ncc.maNcc} · ${d.ncc.trangThai} · ${d.ncc.daTra ? 'đã trả' : 'chưa trả'}${d.ncc.tuyen ? ` · ${d.ncc.tuyen} ${d.ncc.soNgay} ngày` : ''}` : '—')}
              {(() => { const t = tomTtDon(d.tt, d.congTt, hoSo.some((h) => h.ben === 'khach' && LOAI_XIN_HOAN.includes(h.loai) && h.trangThai !== 'xong'));
                return dong('Thanh toán', <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ color: MAU_MUC[t.muc], fontWeight: 600 }}>{t.nhan}</b>
                    {d.tt?.pi && d.tt.cong === 'Stripe' && <LinkChip href={`https://dashboard.stripe.com/payments/${d.tt.pi}`} tone="neutral" size="xs">xem trên Stripe ↗</LinkChip>}
                    {d.tt?.luc && <span style={{ ...phu, fontSize: 12 }}>đọc {gio(d.tt.luc)}</span>}</span>
                  {t.chi_tiet.map((x, i) => <span key={i} style={{ fontSize: 12.5, color: /GIAN LẬN|Dispute|xin hoàn/.test(x) ? 'var(--warn)' : 'var(--fg-2)' }}>{x}</span>)}
                  {d.ttLoi && <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>Lần đọc cổng gần nhất lỗi: {d.ttLoi}</span>}
                  {!d.tt && !d.congTt && <span style={{ ...phu, fontSize: 12.5 }}>Đơn không có mã giao dịch của cổng (đơn Woo cũ / đơn demo)</span>}
                </span>); })()}
              {d.ncc?.maVanDon && dong('Vận đơn', `${d.ncc.maVanDon}${d.ncc.hang ? ` · ${d.ncc.hang}` : ''}${d.ncc.vanDon ? ` · ${d.ncc.vanDon}` : ''}`)}
              {ct.changCuoi && dong('Chặng cuối', ct.changCuoi)}
              {d.ncc?.maVanDon && dong('Khách xem', <LinkChip href={`https://${d.domain}/track-order/?order=${encodeURIComponent(d.soDon)}`} tone="neutral" size="xs">trang theo dõi ↗</LinkChip>)}
            </div>
            {d.ht && <BangHanhTrinh ht={d.ht} soNgay={d.ncc?.soNgay ?? null} guiLuc={d.ncc?.guiLuc ?? null} />}
            {ct.moc.length > 0 && (
              <SimpleTable rows={ct.moc} getRowKey={(m, i) => `${m.ts}${i}`} columns={[
                { key: 'ts', header: 'Mốc hãng báo', width: 92, cell: (m) => <span style={phu}>{gio(m.ts)}</span> },
                { key: 'noi', header: '', width: 140, cell: (m) => <span style={phu}>{m.noi}{m.nuoc ? ` · ${m.nuoc}` : ''}</span> },
                { key: 'mo', header: '', cell: (m) => m.mo_ta },
              ]} />
            )}
            </div>
            <KhachDon ct={ct} d={d} />
            </div>
          </>)}

          {tab === 'nhat_ky' && (<>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <TextField id={`shop-ghi-chu-${id}`} size="sm" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú nội bộ (khách nhắn, đổi size…)" />
              </div>
              <button className="btn" disabled={!ghiChu.trim() || dangChay} onClick={() => lam(async () => { const r = await shopGhiChu(id, ghiChu); setGhiChu(''); return r; })}>Ghi</button>
            </div>
            <SimpleTable hideHeader rows={ct.suKien} getRowKey={(_, i) => String(i)}
              rowStyle={(s) => (s.loi ? { color: 'var(--bad)' } : undefined)} columns={[
                { key: 'ts', header: '', width: 92, cell: (s) => <span style={phu}>{gio(s.ts)}</span> },
                { key: 'nguon', header: '', width: 50, cell: (s) => <span style={phu}>{s.nguon === 'ncc' ? 'NCC' : s.nguon === 'woo' ? 'Woo' : s.nguon === 'nguoi' ? 'Người' : 'Máy'}</span> },
                { key: 'nd', header: '', cell: (s) => <span style={{ whiteSpace: 'pre-wrap' }}>{s.noiDung}</span> },
              ]} />
          </>)}
        </div>
      )}
    </Drawer>
  );
}

/* ── Sản phẩm ↔ NCC ─────────────────────────────────────────────────────── */
/** Sản phẩm = CÂY sản phẩm mặt tiền → [nguồn] + màu → biến thể (components/shop-san-pham.tsx); bấm biến thể → drawer nguồn (shop-nguon.tsx).
 *  Drawer giữ theo ID (?m=bt&mId=) và đọc lại biến thể từ props mới mỗi lần — thao tác nguồn xong, trang nạp lại là drawer thấy ngay số mới. */
function BangSanPham({ bienThe, sanPham, danhMuc, soNcc, cuaHang, cheDo = 'mat_tien' }: { bienThe: BienTheDong[]; sanPham: SanPhamDong[]; danhMuc: NccSpDong[]; soNcc: NccDong[];
  cuaHang: CuaHangDong[]; cheDo?: 'mat_tien' | 'lien_ket' }) {
  const modal = useModalParam();
  const [suaSp, setSuaSp] = useState<SanPhamDong | null>(null);
  const sua = modal.is('bt') && modal.numId != null ? bienThe.find((b) => b.id === modal.numId) ?? null : null;
  const nguongTon = (k: string) => cuaHang.find((c) => c.khoa === k)?.cauHinh.ton_thap ?? 50;
  return (<>
    <CaySanPham bienThe={bienThe} sanPham={sanPham} danhMuc={danhMuc} suaSp={setSuaSp} suaBt={(b) => modal.open('bt', b.id)} cheDo={cheDo}
      nguongBien={(k) => cuaHang.find((c) => c.khoa === k)?.cauHinh.bien_toi_thieu ?? 60} nguongTon={nguongTon}
      tenNcc={(k) => soNcc.find((n) => n.khoa === k)?.ten ?? k} />
    {sua && <DrawerNguon b={sua} danhMuc={danhMuc} soNcc={soNcc} nguongTon={nguongTon(sua.cuaHang)} onClose={() => modal.close()} />}
    {suaSp && <SuaSanPham p={suaSp} onClose={() => setSuaSp(null)} />}
  </>);
}

function SuaSanPham({ p, onClose }: { p: SanPhamDong; onClose: () => void }) {
  const [td, setTd] = useState(p.tieuDe ?? '');
  const [goc, setGoc] = useState(p.giaGoc === null ? '' : String(p.giaGoc));
  const [hien, setHien] = useState(p.hien);
  const [vid, setVid] = useState(p.video.join('\n'));
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const dirty = td !== (p.tieuDe ?? '') || goc !== (p.giaGoc === null ? '' : String(p.giaGoc)) || hien !== p.hien || vid !== p.video.join('\n');
  return (
    <Drawer onClose={onClose} width={520} dirty={dirty}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{p.ten}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, ...phu }}>
            giá từ {tien(p.giaTu)} · {p.soBienThe} biến thể{p.slug && <LinkChip href={`https://${p.domain}/${p.slug}`} tone="neutral" size="xs">trang shop ↗</LinkChip>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <span>{p.soDoiThu ? `${p.soDoiThu} đối thủ đang bán cùng/gần mẫu` : <span style={{ color: 'var(--warn)' }}>Chưa ghi đối thủ nào</span>}</span>
          <LinkChip href="/shop?tab=doi_thu" tone="neutral" size="xs">tab Đối thủ ↗</LinkChip>
        </div>
        <TextAreaField id="shop-sp-td" label="Tiêu đề bán (H1 trang sản phẩm)" hint="Trống = dùng tên sản phẩm. Chỉ ghi lợi ích/ưu đãi có thật." rows={3} value={td} onChange={(e) => setTd(e.target.value)} />
        <TextField id="shop-sp-goc" label="Giá gạch (USD)" hint="Giá trước giảm CÓ THẬT (đã bán ở mức đó). Trống = không gạch giá." inputMode="decimal" value={goc} onChange={(e) => setGoc(e.target.value)} />
        <TextAreaField id="shop-sp-video" label="Video trong mô tả" rows={2} value={vid} onChange={(e) => setVid(e.target.value)}
          hint="Mỗi dòng một link (.mp4 hoặc YouTube). Trang NCC có video thì máy tự điền lần đầu; trống = không hiện." />
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={hien} onChange={(e) => setHien(e.target.checked)} /> Đang bán trên mặt tiền
        </label>
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={!dirty || dangChay} onClick={() => batDau(async () => {
            const r = await shopSuaSanPham(p.id, { tieuDe: td || null, giaGoc: goc.trim() === '' ? null : Number(goc), hien, video: vid.split('\n') });
            if (r.ok) onClose(); else setLoi(r.loi ?? 'lỗi');
          })}>{dangChay ? 'Đang lưu…' : 'Lưu'}</button>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Đánh giá thật của khách (form "Write your review" trên mặt tiền) ───────────── */
function BangDanhGia({ ds }: { ds: DanhGiaDong[] }) {
  const [dangChay, batDau] = useTransition();
  const [loc, setLoc] = useState<string>('cho');
  const dem = { all: ds.length, cho: ds.filter((g) => g.trangThai === 'cho').length, hien: ds.filter((g) => g.trangThai === 'hien').length, an: ds.filter((g) => g.trangThai === 'an').length };
  const rows = loc === 'all' ? ds : ds.filter((g) => g.trangThai === loc);
  const doi = (id: number, tt: 'hien' | 'an') => batDau(async () => { await shopDuyetDanhGia(id, tt); });
  const cot: DataColumn<DanhGiaDong>[] = [
    { key: 'luc', header: 'Lúc', align: 'left', cell: (g) => gio(g.taoLuc), sortValue: (g) => g.taoLuc },
    { key: 'sao', header: 'Sao', cell: (g) => <span style={{ color: g.sao >= 4 ? 'var(--ok)' : g.sao <= 2 ? 'var(--bad)' : undefined }}>{g.sao}★</span>, sortValue: (g) => g.sao },
    { key: 'sp', header: 'Sản phẩm', align: 'left', cell: (g) => g.sanPham },
    { key: 'ten', header: 'Khách', align: 'left', cell: (g) => <>{g.ten} {g.daMua ? <Pill color="var(--ok)" label="đã mua" /> : <span style={phu}>chưa khớp đơn</span>}</>, cellTitle: (g) => g.email ?? '' },
    { key: 'nd', header: 'Nội dung', align: 'left', cell: (g) => <span style={{ display: 'inline-block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
      {g.tieuDe ? <b>{g.tieuDe} · </b> : null}{g.noiDung}</span>, cellTitle: (g) => `${g.tieuDe ?? ''}\n${g.noiDung}` },
    { key: 'tt', header: '', align: 'left', cell: (g) => (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        {g.trangThai !== 'hien' && <button className="btn primary" disabled={dangChay} onClick={() => doi(g.id, 'hien')}>Hiện</button>}
        {g.trangThai !== 'an' && <button className="btn ghost" disabled={dangChay} onClick={() => doi(g.id, 'an')}>Ẩn</button>}
      </span>) },
  ];
  return (<>
    <div style={{ marginBottom: 8 }}>
      <FilterChips urlKey="dg" value={loc} onChange={setLoc} counts={dem}
        options={[{ value: 'cho', label: 'Chờ duyệt' }, { value: 'hien', label: 'Đang hiện' }, { value: 'an', label: 'Đã ẩn' }, { value: 'all', label: 'Tất cả' }]} />
    </div>
    {rows.length
      ? <Panel pad={8}><DataTable rows={rows} columns={cot} getRowKey={(g) => String(g.id)} persistKey="shop-dg" minWidth={900}
          searchText={(g) => `${g.sanPham} ${g.ten} ${g.email ?? ''} ${g.tieuDe ?? ''} ${g.noiDung}`} searchPlaceholder="Tìm khách, nội dung…" /></Panel>
      : <EmptyState icon="⭐" compact title={ds.length ? 'Không có đánh giá ở mục này' : 'Chưa có đánh giá nào'}
          description="Khách viết ở nút “Write your review” trên trang sản phẩm; chỉ đánh giá đã bấm Hiện mới lên trang." />}
  </>);
}

/* ── Cửa hàng ───────────────────────────────────────────────────────────── */

/** Cấu hình mặt tiền apps/store (@mos2/shop/mat-tien). Mọi con số khách thấy phải có thật — gợi ý ngay dưới từng ô. */
