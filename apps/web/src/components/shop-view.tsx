'use client';
// /shop — backend vận hành cửa hàng (mellowstep…): Đơn hàng · Vận chuyển · Sản phẩm↔NCC · Cửa hàng.
// Trạng thái màn nằm trọn trong URL (?tab, ?b bước, ?ch cửa hàng, ?m=don&mId= drawer) — F5/share giữ nguyên.
// Toàn bộ dựng trên primitive nhà (DataTable · Drawer · Tabs · FilterChips · StatsStrip · Panel · SimpleTable · LinkChip · TextField ·
// EmptyState · Pill). Định dạng tiền/giờ/link vận đơn: lib/shop/buoc.ts (một bản cho cả máy chủ + trình duyệt).
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  DataTable, Drawer, EmptyState, FilterChips, LinkChip, Panel, Pill, SimpleTable, StatsStrip, Tabs, TextField, type DataColumn,
} from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { BUOC, LINK_DS_CJ, NHAN_BUOC, gio, isoCua, linkVanDon, soNgayTu, tien, type Buoc } from '@/lib/shop/buoc';
import type { BienTheDong, ChiTietDon, CuaHangDong, DonDong } from '@/lib/shop/doc';
import { shopChiTietDon, shopDongBo, shopGhiChu, shopSangNcc, shopSuaBienThe, shopSuaCauHinh, shopTraNcc } from '@/lib/actions/shop';

type Tab = 'don' | 'van_chuyen' | 'san_pham' | 'cua_hang';
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

export function ShopView({ don, bienThe, cuaHang }: { don: DonDong[]; bienThe: BienTheDong[]; cuaHang: CuaHangDong[] }) {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'don');
  const [buoc, setBuoc] = useState<string>(sp.get('b') || 'all');
  const [ch, setCh] = useState<string>(sp.get('ch') || 'all');
  const modal = useModalParam();
  const [dangChay, batDau] = useTransition();
  const [bao, setBao] = useState<string | null>(null);

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const dat = (k: string, v: string, mac: string) => (v && v !== mac ? u.set(k, v) : u.delete(k));
    dat('tab', tab, 'don'); dat('b', buoc, 'all'); dat('ch', ch, 'all');
    const qs = u.toString();
    window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [tab, buoc, ch]);

  const theoCh = useMemo(() => don.filter((d) => ch === 'all' || d.cuaHang === ch), [don, ch]);
  const dem = useMemo(() => { const c: Partial<Record<string, number>> = { all: theoCh.length }; for (const d of theoCh) c[d.buoc] = (c[d.buoc] ?? 0) + 1; return c; }, [theoCh]);
  const dsDon = useMemo(() => theoCh.filter((d) => buoc === 'all' || d.buoc === buoc), [theoCh, buoc]);
  const dsVanChuyen = useMemo(() => theoCh.filter((d) => d.ncc?.maVanDon || d.buoc === 'ncc_xu_ly' || d.buoc === 'cho_tra'), [theoCh]);
  const bt = useMemo(() => bienThe.filter((b) => ch === 'all' || b.cuaHang === ch), [bienThe, ch]);
  const canXuLy = (dem.cho_ncc ?? 0) + (dem.loi_ncc ?? 0) + (dem.cho_tra ?? 0) + (dem.tre ?? 0);

  // KPI 30 ngày: đơn đã trả tiền (bỏ chưa trả + huỷ), doanh thu sau hoàn, lãi ước (đơn đủ giá vốn), đơn cần xử lý
  const kpi = useMemo(() => {
    const tu = Date.now() - 30 * 86_400_000;
    const tra = theoCh.filter((d) => d.buoc !== 'cho_tt' && d.buoc !== 'huy' && new Date(isoCua(d.taoLuc)).getTime() > tu);
    const coLai = tra.filter((d) => d.lai !== null);
    return { don: tra.length, dt: tra.reduce((t, d) => t + d.tong - d.hoan, 0), lai: coLai.reduce((t, d) => t + (d.lai ?? 0), 0), thieuLai: tra.length - coLai.length };
  }, [theoCh]);

  const dongBo = () => batDau(async () => {
    setBao(null);
    const r = await shopDongBo(ch === 'all' ? undefined : ch).catch((e) => ({ ok: false, loi: (e as Error).message }));
    setBao(r.ok ? 'Đã đồng bộ' : `Lỗi: ${r.loi}`);
  });

  const cotDon: DataColumn<DonDong>[] = [
    { key: 'so', header: 'Đơn', align: 'left', cell: (d) => <b>#{d.soDon}</b>, sortValue: (d) => Number(d.soDon) || 0 },
    { key: 'luc', header: 'Lúc', align: 'left', cell: (d) => gio(d.taoLuc), sortValue: (d) => d.taoLuc },
    { key: 'buoc', header: 'Bước', align: 'left', cell: (d) => <BuocPill b={d.buoc} />, sortValue: (d) => BUOC.findIndex((b) => b.key === d.buoc) },
    { key: 'khach', header: 'Khách', align: 'left', cell: (d) => <>{d.khach || '—'} <span style={phu}>{d.bang ? `${d.bang}, ` : ''}{d.nuoc}</span></> },
    { key: 'mon', header: 'Món', align: 'left', cell: (d) => <span style={{ display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{d.tenMon}</span>, cellTitle: (d) => d.tenMon },
    { key: 'tong', header: 'Tổng', cell: (d) => tien(d.tong), sortValue: (d) => d.tong, total: (r) => tien(r.reduce((t, d) => t + d.tong, 0)) },
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
        <span className="page-sub">Sau khi khách trả tiền: đặt NCC → trả NCC → vận đơn → giao. Bán + thu tiền vẫn ở Woo.</span>
        <span style={{ flex: 1 }} />
        {cuaHang.length > 1 && (
          <FilterChips urlKey="ch" value={ch} onChange={setCh}
            options={[{ value: 'all', label: 'Mọi cửa hàng' }, ...cuaHang.map((c) => ({ value: c.khoa, label: c.ten }))]} />
        )}
        <Link className="btn ghost" href={`/report2?f.du_an=${encodeURIComponent(ch === 'all' ? cuaHang[0]?.khoa ?? '' : ch)}`}>Báo cáo</Link>
        <button className="btn" disabled={dangChay} onClick={dongBo}>{dangChay ? 'Đang chạy…' : 'Đồng bộ ngay'}</button>
      </div>
      {bao && <div style={{ marginBottom: 8, fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</div>}

      <StatsStrip minColWidth={150} cards={[
        { key: 'don', label: 'Đơn 30 ngày', value: kpi.don },
        { key: 'dt', label: 'Doanh thu 30 ngày', value: tien(kpi.dt), sub: 'đã trừ hoàn' },
        { key: 'lai', label: 'Lãi ước 30 ngày', value: tien(kpi.lai), color: kpi.don ? mauTien(kpi.lai) : undefined, sub: kpi.thieuLai ? `${kpi.thieuLai} đơn thiếu giá vốn` : undefined },
        { key: 'xl', label: 'Cần xử lý', value: canXuLy, color: canXuLy ? 'var(--warn)' : undefined, sub: 'chờ/lỗi NCC · chờ trả · trễ',
          onClick: canXuLy ? () => { setTab('don'); setBuoc(dem.loi_ncc ? 'loi_ncc' : dem.cho_tra ? 'cho_tra' : dem.tre ? 'tre' : 'cho_ncc'); } : undefined },
      ]} />

      <Tabs<Tab> value={tab} onChange={setTab} hrefFor={(k) => `/shop?tab=${k}`} items={[
        { key: 'don', label: 'Đơn hàng', badge: canXuLy || undefined },
        { key: 'van_chuyen', label: 'Vận chuyển', badge: dem.tre || undefined },
        { key: 'san_pham', label: 'Sản phẩm', badge: thieuMa || undefined },
        { key: 'cua_hang', label: 'Cửa hàng' },
      ]} />

      <div style={{ marginTop: 10 }}>
        {tab === 'don' && (<>
          <div style={{ marginBottom: 8 }}>
            <FilterChips urlKey="b" value={buoc} onChange={setBuoc} counts={dem}
              options={[{ value: 'all', label: 'Tất cả' }, ...BUOC.map((b) => ({ value: b.key, label: b.nhan, title: b.chuThich }))]} />
          </div>
          {dsDon.length ? (
            <Panel pad={8}><DataTable rows={dsDon} columns={cotDon} getRowKey={(d) => String(d.id)} persistKey="shop-don" minWidth={980}
              groups={[{ key: 'them', label: 'Nguồn + cửa hàng', defaultOn: false }]}
              searchText={(d) => `${d.soDon} ${d.khach} ${d.email} ${d.tenMon} ${d.ncc?.maNcc ?? ''} ${d.ncc?.maVanDon ?? ''}`} searchPlaceholder="Tìm số đơn, khách, email, mã CJ, vận đơn…"
              onRowClick={(d) => modal.open('don', d.id)} /></Panel>
          ) : (
            <EmptyState icon="🛒" compact title={don.length ? `Không có đơn ở bước "${NHAN_BUOC[buoc as Buoc] ?? buoc}"` : 'Chưa có đơn nào'}
              description={don.length ? undefined : 'Đơn Woo vào đây ngay khi khách trả tiền.'}
              action={buoc !== 'all' ? <button className="btn ghost" onClick={() => setBuoc('all')}>Xem tất cả</button> : undefined} />
          )}
        </>)}

        {tab === 'van_chuyen' && (dsVanChuyen.length
          ? <Panel pad={8}><DataTable rows={dsVanChuyen} columns={cotVc} getRowKey={(d) => String(d.id)} persistKey="shop-vc" minWidth={900} onRowClick={(d) => modal.open('don', d.id)} /></Panel>
          : <EmptyState icon="🚚" compact title="Chưa có đơn nào ở NCC hay trên đường" />)}

        {tab === 'san_pham' && <BangSanPham bienThe={bt} />}
        {tab === 'cua_hang' && <div style={{ display: 'grid', gap: 12 }}>{cuaHang.map((c) => <TheCuaHang key={c.id} c={c} />)}</div>}
      </div>

      {modal.is('don') && modal.numId != null && <DrawerDon id={modal.numId} onClose={() => modal.close()} />}
    </div>
  );
}

/* ── Drawer một đơn: đầu ghim (số đơn · bước · hành động) + 2 tab Đơn | Nhật ký ─────────────────── */
function DrawerDon({ id, onClose }: { id: number; onClose: () => void }) {
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
  const traDuKien = d ? (d.giaVon ?? 0) + (d.shipNcc ?? 0) : 0;
  const dong = (nhan: string, giaTri: ReactNode) => (<><span style={phu}>{nhan}</span><span>{giaTri}</span></>);
  return (
    <Drawer onClose={onClose} width={640}>
      {!ct ? <div style={phu}>{loi ?? 'Đang tải…'}</div> : !d ? <div>Không thấy đơn.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Đơn #{d.soDon}</h2>
            <BuocPill b={d.buoc} />
            <span style={{ ...phu, fontSize: 12.5 }}>{gio(d.taoLuc)} · Woo {d.trangThaiShop} · {tien(d.tong)}</span>
          </div>
          {/* Hành động theo bước — chỉ nút hợp lệ với bước hiện tại; link ngoài là chip trung tính */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(d.buoc === 'cho_ncc' || d.buoc === 'loi_ncc') && (
              <button className="btn primary" disabled={dangChay} onClick={() => lam(() => shopSangNcc(id))}>{d.buoc === 'loi_ncc' ? 'Đặt lại sang CJ' : 'Sang CJ'}</button>
            )}
            {d.buoc === 'cho_tra' && (xacNhanTra ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                Trừ ví CJ khoảng {tien(traDuKien)}?
                <button className="btn danger" disabled={dangChay} onClick={() => lam(() => shopTraNcc(id))}>Trả</button>
                <button className="btn ghost" onClick={() => setXacNhanTra(false)}>Thôi</button>
              </span>
            ) : <button className="btn primary" disabled={dangChay} onClick={() => setXacNhanTra(true)}>Trả CJ {tien(traDuKien)}</button>)}
            {dangChay && <span style={{ ...phu, fontSize: 12.5 }}>Đang chạy…</span>}
            <span style={{ flex: 1 }} />
            <LinkChip href={linkWoo(d)} tone="neutral">Woo ↗</LinkChip>
            {d.ncc?.maNcc && <LinkChip href={LINK_DS_CJ} tone="neutral">CJ ↗</LinkChip>}
            {d.ncc?.maVanDon && <LinkChip href={linkVanDon(d.ncc.maVanDon)} tone="neutral">Vận đơn ↗</LinkChip>}
          </div>
          {(loi || d.ncc?.loi) && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi ?? d.ncc?.loi}</div>}

          <Tabs<'don' | 'nhat_ky'> value={tab} onChange={setTab} items={[
            { key: 'don', label: 'Đơn' },
            { key: 'nhat_ky', label: 'Nhật ký', badge: ct.suKien.length || undefined },
          ]} />

          {tab === 'don' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '4px 10px', fontSize: 13 }}>
              {dong('Khách', `${d.khach} · ${d.email}${ct.sdt ? ` · ${ct.sdt}` : ''}`)}
              {dong('Giao tới', [ct.diaChi.ten, ct.diaChi.dong1, ct.diaChi.dong2, ct.diaChi.thanh_pho, ct.diaChi.bang, ct.diaChi.zip, ct.diaChi.nuoc].filter(Boolean).join(', '))}
              {dong('Nguồn', d.sid ?? '—')}
              {dong('Đơn NCC', d.ncc?.maNcc ? `CJ ${d.ncc.maNcc} · ${d.ncc.trangThai} · ${d.ncc.daTra ? 'đã trả' : 'chưa trả'}${d.ncc.tuyen ? ` · ${d.ncc.tuyen} ${d.ncc.soNgay} ngày` : ''}` : '—')}
              {d.ncc?.maVanDon && dong('Vận đơn', `${d.ncc.maVanDon}${d.ncc.hang ? ` · ${d.ncc.hang}` : ''}${d.ncc.vanDon ? ` · ${d.ncc.vanDon}` : ''}`)}
            </div>
            <SimpleTable rows={ct.mon} getRowKey={(_, i) => String(i)} columns={[
              { key: 'ten', header: 'Món', cell: (m) => `${m.ten}${m.sl > 1 ? ` ×${m.sl}` : ''}` },
              { key: 'gia', header: 'Giá', align: 'right', cell: (m) => tien(m.gia) },
              { key: 'von', header: 'Vốn', align: 'right', cell: (m) => tien(m.giaVon === null ? null : m.giaVon * m.sl) },
              { key: 'ma', header: 'Mã CJ', align: 'right', cell: (m) => (m.maNcc ? 'có' : <span style={{ color: 'var(--bad)' }}>thiếu</span>) },
            ]} />
            <SimpleTable hideHeader rows={[
              { k: 'Khách trả', v: tien(d.tong) },
              ...(d.hoan > 0 ? [{ k: 'Hoàn', v: `−${tien(d.hoan)}` }] : []),
              { k: 'Giá vốn NCC', v: `−${tien(d.giaVon)}` },
              { k: 'Ship NCC', v: `−${tien(d.shipNcc)}` },
              { k: 'Phí cổng', v: `−${tien(d.phiCong)}` },
              { k: 'Lãi ước', v: <b style={{ color: mauTien(d.lai) }}>{tien(d.lai)}</b> },
            ]} getRowKey={(r) => r.k} columns={[
              { key: 'k', header: '', cell: (r) => r.k },
              { key: 'v', header: '', align: 'right', cell: (r) => r.v },
            ]} />
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
function BangSanPham({ bienThe }: { bienThe: BienTheDong[] }) {
  const [sua, setSua] = useState<BienTheDong | null>(null);
  const [loc, setLoc] = useState<'all' | 'thieu'>('all');
  const thieu = bienThe.filter((b) => !b.maNcc || b.giaVon === null);
  const rows = loc === 'thieu' ? thieu : bienThe;
  const cot: DataColumn<BienTheDong>[] = [
    { key: 'sp', header: 'Sản phẩm', align: 'left', cell: (b) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {b.anh && <img src={b.anh} alt="" width={22} height={22} style={{ objectFit: 'cover', borderRadius: 3 }} />}{b.sanPham}
      </span>), sortValue: (b) => b.sanPham },
    { key: 'bt', header: 'Biến thể', align: 'left', cell: (b) => b.ten },
    { key: 'gia', header: 'Giá bán', cell: (b) => tien(b.giaBan), sortValue: (b) => b.giaBan },
    { key: 'von', header: 'Giá vốn', cell: (b) => tien(b.giaVon), sortValue: (b) => b.giaVon },
    { key: 'bien', header: 'Biên', title: '(Giá bán − giá vốn) / giá bán — chưa trừ ship NCC + phí cổng.',
      cell: (b) => (b.giaBan && b.giaVon !== null ? `${Math.round(((b.giaBan - b.giaVon) / b.giaBan) * 100)}%` : '—'),
      sortValue: (b) => (b.giaBan && b.giaVon !== null ? (b.giaBan - b.giaVon) / b.giaBan : null) },
    { key: 'ma', header: 'Mã CJ (vid)', align: 'left', cell: (b) => (b.maNcc ? <span style={{ fontFamily: 'var(--mono)' }}>{b.maNcc}</span> : <span style={{ color: 'var(--bad)' }}>thiếu</span>) },
    { key: 'ban', header: 'Đã bán', cell: (b) => b.daBan || '—', sortValue: (b) => b.daBan },
  ];
  return (<>
    <div style={{ marginBottom: 8 }}>
      <FilterChips urlKey="sp" value={loc} onChange={setLoc} counts={{ all: bienThe.length, thieu: thieu.length }}
        options={[{ value: 'all', label: 'Mọi biến thể' }, { value: 'thieu', label: 'Thiếu mã CJ / giá vốn', title: 'Đơn có món thiếu mã CJ sẽ không sang được NCC.' }]} />
    </div>
    <Panel pad={8}><DataTable rows={rows} columns={cot} getRowKey={(b) => String(b.id)} persistKey="shop-sp" minWidth={820}
      searchText={(b) => `${b.sanPham} ${b.ten} ${b.sku ?? ''} ${b.maNcc ?? ''}`} searchPlaceholder="Tìm sản phẩm, size, mã CJ…"
      rowTitle={() => 'Bấm để sửa mã CJ / giá vốn (ghi ngược về Woo)'} onRowClick={(b) => setSua(b)} /></Panel>
    {sua && <SuaBienThe b={sua} onClose={() => setSua(null)} />}
  </>);
}

function SuaBienThe({ b, onClose }: { b: BienTheDong; onClose: () => void }) {
  const [ma, setMa] = useState(b.maNcc ?? '');
  const [von, setVon] = useState(b.giaVon === null ? '' : String(b.giaVon));
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const dirty = ma !== (b.maNcc ?? '') || von !== (b.giaVon === null ? '' : String(b.giaVon));
  return (
    <Drawer onClose={onClose} width={460} dirty={dirty}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{b.sanPham}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, ...phu }}>
            {b.ten} · giá bán {tien(b.giaBan)}{b.link && <LinkChip href={b.link} tone="neutral" size="xs">trang sản phẩm ↗</LinkChip>}
          </div>
        </div>
        <TextField id="shop-bt-ma" label="Mã biến thể CJ (vid)" mono value={ma} onChange={(e) => setMa(e.target.value.trim())} />
        <TextField id="shop-bt-von" label="Giá vốn NCC (USD, chưa ship)" inputMode="decimal" value={von} onChange={(e) => setVon(e.target.value)} />
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={!dirty || dangChay} onClick={() => batDau(async () => {
            const r = await shopSuaBienThe(b.id, { maNcc: ma || null, giaVon: von.trim() === '' ? null : Number(von) });
            if (r.ok && !r.loi) onClose(); else setLoi(r.loi ?? 'lỗi');
          })}>{dangChay ? 'Đang lưu…' : 'Lưu'}</button>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Cửa hàng ───────────────────────────────────────────────────────────── */
function TheCuaHang({ c }: { c: CuaHangDong }) {
  const goc = { ngay_ship_max: c.cauHinh.ngay_ship_max ?? 11, tu_sang_ncc: !!c.cauHinh.tu_sang_ncc, tu_tra_ncc: !!c.cauHinh.tu_tra_ncc, trang_thai: c.trangThai as 'bat' | 'tat' };
  const [cfg, setCfg] = useState(goc);
  const [bao, setBao] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const doi = JSON.stringify(cfg) !== JSON.stringify(goc);
  const tick = (k: 'tu_sang_ncc' | 'tu_tra_ncc', nhan: string, chu: string) => (
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title={chu}>
      <input type="checkbox" checked={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} /> {nhan}
    </label>
  );
  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{c.ten}
        <Pill color={c.trangThai === 'bat' ? 'var(--ok)' : 'var(--fg-3)'} label={c.trangThai === 'bat' ? 'đang chạy' : 'tắt'} /></span>}
      subtitle={`${c.nenTang} · NCC ${c.ncc.toUpperCase()} · ${c.soDon} đơn · ${c.soSanPham} sản phẩm`}
      actions={<>
        <LinkChip href={`https://${c.domain}`} tone="neutral">{c.domain} ↗</LinkChip>
        <button className="btn ghost" disabled={dangChay} onClick={() => batDau(async () => {
          const r = await shopDongBo(c.khoa, true).catch((e) => ({ ok: false, loi: (e as Error).message }));
          setBao(r.ok ? 'Đã kéo lại đơn + sản phẩm' : `Lỗi: ${r.loi}`);
        })}>{dangChay ? 'Đang chạy…' : 'Kéo lại cả sản phẩm'}</button>
      </>}>
      <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
        <div style={{ fontSize: 12.5, color: c.dongBoLoi ? 'var(--bad)' : 'var(--fg-3)' }}>
          Đồng bộ gần nhất {gio(c.dongBoLuc)}{c.dongBoLoi ? ` · lỗi: ${c.dongBoLoi}` : ' · Woo đẩy đơn tức thì, máy kéo bù mỗi 10 phút'}
          {c.thieuMa > 0 && <> · <span style={{ color: 'var(--bad)' }}>{c.thieuMa} biến thể thiếu mã CJ</span></>}
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={cfg.trang_thai === 'bat'} onChange={(e) => setCfg({ ...cfg, trang_thai: e.target.checked ? 'bat' : 'tat' })} /> Bật đồng bộ
          </label>
          {tick('tu_sang_ncc', 'Tự sang NCC', 'Đơn vừa trả tiền tự đặt sang CJ (chỉ TẠO đơn, chưa trả CJ — không tiêu tiền).')}
          {tick('tu_tra_ncc', 'Tự trả NCC (trừ ví)', 'Tạo xong tự trả CJ từ ví — TIÊU TIỀN không cần bấm. Mặc định tắt.')}
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title="Chỉ chọn tuyến ship giao tối đa ≤ số ngày này; trong đó lấy tuyến rẻ nhất.">
            Ship tối đa
            <TextField id={`shop-ngay-${c.khoa}`} size="sm" type="number" min={3} max={30} value={String(cfg.ngay_ship_max)}
              onChange={(e) => setCfg({ ...cfg, ngay_ship_max: Number(e.target.value) })} style={{ width: 64 }} />
            ngày
          </span>
          <button className="btn primary" disabled={!doi || dangChay} onClick={() => batDau(async () => { await shopSuaCauHinh(c.khoa, cfg); setBao('Đã lưu cấu hình'); })}>Lưu</button>
        </div>
        {bao && <div style={{ fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</div>}
      </div>
    </Panel>
  );
}
