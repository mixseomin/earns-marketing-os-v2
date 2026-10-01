'use client';
// /shop — backend vận hành cửa hàng (mellowstep…): Đơn hàng · Vận chuyển · Sản phẩm↔NCC · Cửa hàng.
// Trạng thái màn nằm trọn trong URL (?tab, ?b bước, ?ch cửa hàng, ?m=don&mId= drawer) — F5/share giữ nguyên.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { DataTable, Drawer, FilterChips, Pill, StatsStrip, Tabs, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { BUOC, NHAN_BUOC, type Buoc } from '@/lib/shop/buoc';
import type { BienTheDong, ChiTietDon, CuaHangDong, DonDong } from '@/lib/shop/doc';
import { shopChiTietDon, shopDongBo, shopGhiChu, shopSangNcc, shopSuaBienThe, shopSuaCauHinh, shopTraNcc } from '@/lib/actions/shop';

type Tab = 'don' | 'van_chuyen' | 'san_pham' | 'cua_hang';
const MAU: Record<string, string> = { muted: 'var(--fg-3)', warn: 'var(--warn)', bad: 'var(--bad)', ok: 'var(--ok)', info: 'var(--info)' };
const MAU_BUOC = Object.fromEntries(BUOC.map((b) => [b.key, MAU[b.mau]])) as Record<Buoc, string>;
const CHU_BUOC = Object.fromEntries(BUOC.map((b) => [b.key, b.chuThich])) as Record<Buoc, string>;
const tien = (x: number | null | undefined) => (x === null || x === undefined ? '—' : (x < 0 ? '-$' : '$') + Math.abs(x).toFixed(2));
// Giờ hiển thị = GMT+7 (luật chung), dạng 14:05 01/10
const gio = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(Date.parse(s.includes('T') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z') + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
};
const soNgayTu = (s: string | null) => (s ? Math.floor((Date.now() - Date.parse(s.includes('T') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z')) / 86_400_000) : null);
const linkVanDon = (ma: string) => `https://t.17track.net/en#nums=${encodeURIComponent(ma)}`;
const linkWoo = (d: { domain: string; maNgoai: string }) => `https://${d.domain}/wp-admin/admin.php?page=wc-orders&action=edit&id=${d.maNgoai}`;

function BuocPill({ b }: { b: Buoc }) {
  return <Pill color={MAU_BUOC[b]} label={NHAN_BUOC[b]} title={CHU_BUOC[b]} uppercase={false} mono={false} />;
}

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
  const canXuLy = (dem.cho_ncc ?? 0) + (dem.loi_ncc ?? 0) + (dem.cho_tra ?? 0) + (dem.tre ?? 0);

  // KPI 30 ngày: đơn đã trả tiền, doanh thu, lãi ước (đơn đủ giá vốn), đơn cần xử lý
  const kpi = useMemo(() => {
    const tu = Date.now() - 30 * 86_400_000;
    const tra = theoCh.filter((d) => !['cho_tt'].includes(d.buoc) && Date.parse(d.taoLuc.replace(' ', 'T') + (d.taoLuc.includes('+') ? '' : 'Z')) > tu);
    const dt = tra.reduce((t, d) => t + d.tong - d.hoan, 0);
    const coLai = tra.filter((d) => d.lai !== null);
    return { don: tra.length, dt, lai: coLai.reduce((t, d) => t + (d.lai ?? 0), 0), thieuLai: tra.length - coLai.length };
  }, [theoCh]);

  const chay = (f: () => Promise<{ ok: boolean; loi?: string }>, xong: string) => batDau(async () => {
    setBao(null);
    try { const r = await f(); setBao(r.ok ? (r.loi ? `${xong} — ${r.loi}` : xong) : `Lỗi: ${r.loi}`); }
    catch (e) { setBao(`Lỗi: ${(e as Error).message}`); }
  });

  const cotDon: DataColumn<DonDong>[] = [
    { key: 'so', header: 'Đơn', align: 'left', cell: (d) => <b>#{d.soDon}</b>, sortValue: (d) => Number(d.soDon) || 0 },
    { key: 'luc', header: 'Lúc', align: 'left', cell: (d) => gio(d.taoLuc), sortValue: (d) => d.taoLuc },
    { key: 'buoc', header: 'Bước', align: 'left', cell: (d) => <BuocPill b={d.buoc} />, sortValue: (d) => BUOC.findIndex((b) => b.key === d.buoc) },
    { key: 'khach', header: 'Khách', align: 'left', cell: (d) => <span>{d.khach || '—'} <span style={{ color: 'var(--fg-3)' }}>{d.bang ? `${d.bang}, ` : ''}{d.nuoc}</span></span> },
    { key: 'mon', header: 'Món', align: 'left', cell: (d) => <span style={{ display: 'inline-block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{d.tenMon}</span>, cellTitle: (d) => d.tenMon },
    { key: 'tong', header: 'Tổng', cell: (d) => tien(d.tong), sortValue: (d) => d.tong, total: (r) => tien(r.reduce((t, d) => t + d.tong, 0)) },
    { key: 'lai', header: 'Lãi ước', title: 'Tổng − hoàn − giá vốn NCC − ship NCC − phí cổng (Stripe thật, chưa có thì 2.9% + 30¢). — = thiếu giá vốn.',
      cell: (d) => <span style={{ color: d.lai === null ? undefined : d.lai >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{tien(d.lai)}</span>, sortValue: (d) => d.lai,
      total: (r) => tien(r.reduce((t, d) => t + (d.lai ?? 0), 0)) },
    { key: 'ncc', header: 'NCC', align: 'left', cell: (d) => d.ncc?.maNcc ? <span title={d.ncc.tuyen ?? ''}>{d.ncc.trangThai}{d.ncc.daTra ? '' : ' · chưa trả'}</span> : d.ncc?.loi ? <span style={{ color: 'var(--bad)' }}>lỗi</span> : '—' },
    { key: 'vd', header: 'Vận đơn', align: 'left', cell: (d) => d.ncc?.maVanDon
      ? <a href={linkVanDon(d.ncc.maVanDon)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{d.ncc.maVanDon}</a> : '—' },
    { key: 'nguon', header: 'Nguồn', align: 'left', group: 'them', cell: (d) => d.sid ?? '—' },
    { key: 'ch', header: 'Cửa hàng', align: 'left', group: 'them', cell: (d) => d.cuaHang },
  ];

  const cotVc: DataColumn<DonDong>[] = [
    { key: 'so', header: 'Đơn', align: 'left', cell: (d) => <b>#{d.soDon}</b> },
    { key: 'buoc', header: 'Bước', align: 'left', cell: (d) => <BuocPill b={d.buoc} /> },
    { key: 'tuyen', header: 'Tuyến', align: 'left', cell: (d) => d.ncc?.tuyen ? `${d.ncc.tuyen} (${d.ncc.soNgay} ngày)` : '—' },
    { key: 'vd', header: 'Mã vận đơn', align: 'left', cell: (d) => d.ncc?.maVanDon ? <a href={linkVanDon(d.ncc.maVanDon)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{d.ncc.maVanDon}</a> : '—' },
    { key: 'hang', header: 'Hãng', align: 'left', cell: (d) => d.ncc?.hang ?? '—' },
    { key: 'gui', header: 'Gửi', align: 'left', cell: (d) => gio(d.ncc?.guiLuc), sortValue: (d) => d.ncc?.guiLuc ?? '' },
    { key: 'ngay', header: 'Số ngày', title: 'Số ngày từ lúc có mã vận đơn (đã giao thì tính tới lúc giao).',
      cell: (d) => { const n = soNgayTu(d.ncc?.guiLuc ?? null); return n === null ? '—' : <span style={{ color: d.buoc === 'tre' ? 'var(--bad)' : undefined }}>{n}</span>; },
      sortValue: (d) => soNgayTu(d.ncc?.guiLuc ?? null) },
    { key: 'hanh_trinh', header: 'Hãng báo', align: 'left', cell: (d) => d.ncc?.vanDon ?? '—' },
    { key: 'giao', header: 'Giao', align: 'left', cell: (d) => gio(d.ncc?.giaoLuc) },
  ];

  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Shop</h1>
        <span className="page-sub">Đơn sau khi khách trả tiền: đặt NCC → trả NCC → vận đơn → giao. Mặt tiền + thu tiền vẫn ở Woo.</span>
        <span style={{ flex: 1 }} />
        {cuaHang.length > 1 && (
          <FilterChips urlKey="ch" value={ch} onChange={setCh}
            options={[{ value: 'all', label: 'Mọi cửa hàng' }, ...cuaHang.map((c) => ({ value: c.khoa, label: c.ten }))]} />
        )}
        <a className="btn ghost" href={`/report2?f.du_an=${encodeURIComponent(ch === 'all' ? cuaHang[0]?.khoa ?? '' : ch)}`}>Báo cáo ↗</a>
        <button className="btn" disabled={dangChay} onClick={() => chay(() => shopDongBo(ch === 'all' ? undefined : ch), 'Đã đồng bộ')}>
          {dangChay ? 'Đang chạy…' : 'Đồng bộ ngay'}
        </button>
      </div>
      {bao && <div style={{ margin: '6px 0 10px', color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)', fontSize: 12.5 }}>{bao}</div>}

      <StatsStrip minColWidth={140} cards={[
        { key: 'don', label: 'Đơn 30 ngày', value: kpi.don },
        { key: 'dt', label: 'Doanh thu 30 ngày', value: tien(kpi.dt), sub: 'đã trừ hoàn' },
        { key: 'lai', label: 'Lãi ước 30 ngày', value: tien(kpi.lai), color: kpi.lai >= 0 ? 'var(--ok)' : 'var(--bad)', sub: kpi.thieuLai ? `${kpi.thieuLai} đơn thiếu giá vốn` : undefined },
        { key: 'xl', label: 'Cần xử lý', value: canXuLy, color: canXuLy ? 'var(--warn)' : undefined, sub: 'chờ/lỗi NCC · chờ trả · trễ',
          onClick: () => { setTab('don'); setBuoc(dem.loi_ncc ? 'loi_ncc' : dem.cho_tra ? 'cho_tra' : dem.tre ? 'tre' : 'cho_ncc'); } },
      ]} />

      <Tabs<Tab> value={tab} onChange={setTab} hrefFor={(k) => `/shop?tab=${k}`} items={[
        { key: 'don', label: 'Đơn hàng', badge: canXuLy || undefined },
        { key: 'van_chuyen', label: 'Vận chuyển', badge: dem.tre || undefined },
        { key: 'san_pham', label: 'Sản phẩm', badge: bienThe.filter((b) => !b.maNcc).length || undefined },
        { key: 'cua_hang', label: 'Cửa hàng' },
      ]} />

      <div style={{ marginTop: 10 }}>
        {tab === 'don' && (<>
          <div style={{ marginBottom: 8 }}>
            <FilterChips urlKey="b" value={buoc} onChange={setBuoc} counts={dem}
              options={[{ value: 'all', label: 'Tất cả' }, ...BUOC.map((b) => ({ value: b.key, label: b.nhan, title: b.chuThich }))]} />
          </div>
          <DataTable rows={dsDon} columns={cotDon} getRowKey={(d) => String(d.id)} persistKey="shop-don" minWidth={980}
            groups={[{ key: 'them', label: 'Nguồn + cửa hàng', defaultOn: false }]}
            searchText={(d) => `${d.soDon} ${d.khach} ${d.email} ${d.tenMon} ${d.ncc?.maNcc ?? ''} ${d.ncc?.maVanDon ?? ''}`} searchPlaceholder="Tìm số đơn, khách, email, mã CJ, vận đơn…"
            onRowClick={(d) => modal.open('don', d.id)} />
          {!dsDon.length && <div style={{ padding: 16, color: 'var(--fg-3)' }}>{don.length ? 'Không có đơn ở bước này.' : 'Chưa có đơn nào — đơn Woo sẽ vào đây ngay khi khách trả tiền.'}</div>}
        </>)}

        {tab === 'van_chuyen' && (<>
          <DataTable rows={dsVanChuyen} columns={cotVc} getRowKey={(d) => String(d.id)} persistKey="shop-vc" minWidth={900}
            onRowClick={(d) => modal.open('don', d.id)} />
          {!dsVanChuyen.length && <div style={{ padding: 16, color: 'var(--fg-3)' }}>Chưa có đơn nào đang ở NCC hay trên đường.</div>}
        </>)}

        {tab === 'san_pham' && <BangSanPham bienThe={bienThe.filter((b) => ch === 'all' || b.cuaHang === ch)} />}
        {tab === 'cua_hang' && <BangCuaHang cuaHang={cuaHang} />}
      </div>

      {modal.is('don') && modal.numId != null && (
        <DrawerDon id={modal.numId} onClose={() => modal.close()} />
      )}
    </div>
  );
}

/* ── Drawer một đơn ─────────────────────────────────────────────────────── */
function DrawerDon({ id, onClose }: { id: number; onClose: () => void }) {
  const [ct, setCt] = useState<ChiTietDon | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const [xacNhanTra, setXacNhanTra] = useState(false);
  const [ghiChu, setGhiChu] = useState('');
  const tai = () => shopChiTietDon(id).then(setCt).catch((e) => setLoi((e as Error).message));
  useEffect(() => { tai(); }, [id]);
  const lam = (f: () => Promise<{ ok: boolean; loi?: string }>) => batDau(async () => {
    setLoi(null); setXacNhanTra(false);
    const r = await f().catch((e) => ({ ok: false, loi: (e as Error).message }));
    if (!r.ok || r.loi) setLoi(r.loi ?? 'lỗi');
    await tai();
  });
  const d = ct?.don;
  const dongNho: React.CSSProperties = { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 10px', fontSize: 13 };
  return (
    <Drawer onClose={onClose} width={640}>
      {!ct ? <div style={{ color: 'var(--fg-3)' }}>{loi ?? 'Đang tải…'}</div> : !d ? <div>Không thấy đơn.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Đơn #{d.soDon}</h2>
            <BuocPill b={d.buoc} />
            <span style={{ color: 'var(--fg-3)', fontSize: 12.5 }}>{gio(d.taoLuc)} · Woo: {d.trangThaiShop}</span>
            <span style={{ flex: 1 }} />
            <a className="btn ghost" href={linkWoo(d)} target="_blank" rel="noreferrer">Mở trong Woo ↗</a>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{CHU_BUOC[d.buoc]}</div>

          {/* Hành động theo bước — chỉ hiện nút hợp lệ với bước hiện tại */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(d.buoc === 'cho_ncc' || d.buoc === 'loi_ncc') && (
              <button className="btn primary" disabled={dangChay} onClick={() => lam(() => shopSangNcc(id))}>{d.buoc === 'loi_ncc' ? 'Đặt lại sang CJ' : 'Sang CJ'}</button>
            )}
            {d.buoc === 'cho_tra' && !xacNhanTra && (
              <button className="btn primary" disabled={dangChay} onClick={() => setXacNhanTra(true)}>
                Trả CJ {tien((d.giaVon ?? 0) + (d.shipNcc ?? 0))} từ ví CJ
              </button>
            )}
            {d.buoc === 'cho_tra' && xacNhanTra && (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>Trừ ví CJ khoảng {tien((d.giaVon ?? 0) + (d.shipNcc ?? 0))}?</span>
                <button className="btn danger" disabled={dangChay} onClick={() => lam(() => shopTraNcc(id))}>Trả</button>
                <button className="btn ghost" onClick={() => setXacNhanTra(false)}>Thôi</button>
              </span>
            )}
            {d.ncc?.maNcc && <a className="btn ghost" href="https://www.cjdropshipping.com/mine/dropshipping/orderList?orderType=3&childType=1" target="_blank" rel="noreferrer">Đơn trên CJ ↗</a>}
            {d.ncc?.maVanDon && <a className="btn ghost" href={linkVanDon(d.ncc.maVanDon)} target="_blank" rel="noreferrer">Vận đơn ↗</a>}
            {dangChay && <span style={{ color: 'var(--fg-3)', fontSize: 12.5 }}>Đang chạy…</span>}
          </div>
          {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}

          <section style={dongNho}>
            <span style={{ color: 'var(--fg-3)' }}>Khách</span><span>{d.khach} · {d.email}{ct.sdt ? ` · ${ct.sdt}` : ''}</span>
            <span style={{ color: 'var(--fg-3)' }}>Giao tới</span>
            <span>{[ct.diaChi.ten, ct.diaChi.dong1, ct.diaChi.dong2, ct.diaChi.thanh_pho, ct.diaChi.bang, ct.diaChi.zip, ct.diaChi.nuoc].filter(Boolean).join(', ')}</span>
            <span style={{ color: 'var(--fg-3)' }}>Nguồn</span><span>{d.sid ?? '—'}</span>
            <span style={{ color: 'var(--fg-3)' }}>Đơn NCC</span>
            <span>{d.ncc?.maNcc ? `CJ ${d.ncc.maNcc} · ${d.ncc.trangThai}${d.ncc.daTra ? ' · đã trả' : ' · chưa trả'}` : '—'}{d.ncc?.tuyen ? ` · ${d.ncc.tuyen} ${d.ncc.soNgay} ngày` : ''}</span>
            {d.ncc?.maVanDon && (<><span style={{ color: 'var(--fg-3)' }}>Vận đơn</span><span>{d.ncc.maVanDon}{d.ncc.hang ? ` · ${d.ncc.hang}` : ''}{d.ncc.vanDon ? ` · ${d.ncc.vanDon}` : ''}</span></>)}
          </section>

          <section>
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Món</h3>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                {ct.mon.map((m, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '4px 0' }}>{m.ten}{m.sl > 1 ? ` ×${m.sl}` : ''}</td>
                    <td style={{ textAlign: 'right' }}>{tien(m.gia)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--fg-3)' }}>vốn {tien(m.giaVon === null ? null : m.giaVon * m.sl)}</td>
                    <td style={{ textAlign: 'right', color: m.maNcc ? 'var(--fg-3)' : 'var(--bad)' }}>{m.maNcc ? 'có mã CJ' : 'thiếu mã CJ'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...dongNho, marginTop: 8, gridTemplateColumns: '1fr auto' }}>
              <span>Khách trả</span><b style={{ textAlign: 'right' }}>{tien(d.tong)}</b>
              {d.hoan > 0 && (<><span>Hoàn</span><span style={{ textAlign: 'right', color: 'var(--bad)' }}>−{tien(d.hoan)}</span></>)}
              <span>Giá vốn NCC</span><span style={{ textAlign: 'right' }}>−{tien(d.giaVon)}</span>
              <span>Ship NCC</span><span style={{ textAlign: 'right' }}>−{tien(d.shipNcc)}</span>
              <span>Phí cổng</span><span style={{ textAlign: 'right' }}>−{tien(d.phiCong)}</span>
              <span>Lãi ước</span><b style={{ textAlign: 'right', color: d.lai === null ? undefined : d.lai >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{tien(d.lai)}</b>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>Nhật ký</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú nội bộ (khách nhắn, đã đổi size…)"
                style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-1)' }} />
              <button className="btn" disabled={!ghiChu.trim() || dangChay} onClick={() => lam(async () => { const r = await shopGhiChu(id, ghiChu); setGhiChu(''); return r; })}>Ghi</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ct.suKien.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '92px 46px 1fr', gap: 8, fontSize: 12.5, color: s.loi ? 'var(--bad)' : undefined }}>
                  <span style={{ color: 'var(--fg-3)' }}>{gio(s.ts)}</span>
                  <span style={{ color: 'var(--fg-3)' }}>{s.nguon === 'ncc' ? 'NCC' : s.nguon === 'woo' ? 'Woo' : s.nguon === 'nguoi' ? 'Người' : 'Máy'}</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{s.noiDung}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

/* ── Sản phẩm ↔ NCC ─────────────────────────────────────────────────────── */
function BangSanPham({ bienThe }: { bienThe: BienTheDong[] }) {
  const [sua, setSua] = useState<BienTheDong | null>(null);
  const [chiThieu, setChiThieu] = useState(false);
  const rows = chiThieu ? bienThe.filter((b) => !b.maNcc || b.giaVon === null) : bienThe;
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
    { key: 'ma', header: 'Mã CJ (vid)', align: 'left', cell: (b) => b.maNcc ? <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>{b.maNcc}</span> : <span style={{ color: 'var(--bad)' }}>thiếu</span> },
    { key: 'ban', header: 'Đã bán', cell: (b) => b.daBan || '—', sortValue: (b) => b.daBan },
  ];
  const thieu = bienThe.filter((b) => !b.maNcc || b.giaVon === null).length;
  return (<>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, fontSize: 12.5 }}>
      <span style={{ color: 'var(--fg-3)' }}>{bienThe.length} biến thể · bấm một dòng để sửa mã CJ / giá vốn (ghi ngược về Woo).</span>
      {thieu > 0 && <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--bad)' }}>
        <input type="checkbox" checked={chiThieu} onChange={(e) => setChiThieu(e.target.checked)} /> Chỉ {thieu} dòng thiếu mã/giá vốn</label>}
    </div>
    <DataTable rows={rows} columns={cot} getRowKey={(b) => String(b.id)} persistKey="shop-sp" minWidth={820}
      searchText={(b) => `${b.sanPham} ${b.ten} ${b.sku ?? ''} ${b.maNcc ?? ''}`} searchPlaceholder="Tìm sản phẩm, size, mã CJ…"
      onRowClick={(b) => setSua(b)} />
    {sua && <SuaBienThe b={sua} onClose={() => setSua(null)} />}
  </>);
}

function SuaBienThe({ b, onClose }: { b: BienTheDong; onClose: () => void }) {
  const [ma, setMa] = useState(b.maNcc ?? '');
  const [von, setVon] = useState(b.giaVon === null ? '' : String(b.giaVon));
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const dirty = ma !== (b.maNcc ?? '') || von !== (b.giaVon === null ? '' : String(b.giaVon));
  const o: React.CSSProperties = { width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-1)' };
  return (
    <Drawer onClose={onClose} width={460} dirty={dirty}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{b.sanPham}</h2>
      <div style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 14 }}>{b.ten} · giá bán {tien(b.giaBan)}{b.link ? <> · <a href={b.link} target="_blank" rel="noreferrer">trang sản phẩm ↗</a></> : null}</div>
      <label style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>Mã biến thể CJ (vid)</label>
      <input id="shop-bt-ma" value={ma} onChange={(e) => setMa(e.target.value.trim())} style={{ ...o, fontFamily: 'var(--mono)' }} />
      <label style={{ display: 'block', fontSize: 12.5, margin: '12px 0 4px' }}>Giá vốn NCC (USD, chưa ship)</label>
      <input id="shop-bt-von" value={von} onChange={(e) => setVon(e.target.value)} inputMode="decimal" style={o} />
      {loi && <div style={{ color: 'var(--bad)', fontSize: 13, marginTop: 10 }}>{loi}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn primary" disabled={!dirty || dangChay} onClick={() => batDau(async () => {
          const r = await shopSuaBienThe(b.id, { maNcc: ma || null, giaVon: von.trim() === '' ? null : Number(von) });
          if (r.ok && !r.loi) onClose(); else setLoi(r.loi ?? 'lỗi');
        })}>{dangChay ? 'Đang lưu…' : 'Lưu'}</button>
        <button className="btn ghost" onClick={onClose}>Đóng</button>
      </div>
    </Drawer>
  );
}

/* ── Cửa hàng ───────────────────────────────────────────────────────────── */
function BangCuaHang({ cuaHang }: { cuaHang: CuaHangDong[] }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {cuaHang.map((c) => <TheCuaHang key={c.id} c={c} />)}
      <div style={{ color: 'var(--fg-3)', fontSize: 12.5 }}>
        Thêm cửa hàng Woo mới: một dòng shop_cua_hang + khoá REST/webhook SHOP_&lt;KHOÁ&gt;_* trong .env.production trên box3 (Claude làm được, nhờ một câu).
      </div>
    </div>
  );
}

function TheCuaHang({ c }: { c: CuaHangDong }) {
  const [cfg, setCfg] = useState({ ngay_ship_max: c.cauHinh.ngay_ship_max ?? 11, tu_sang_ncc: !!c.cauHinh.tu_sang_ncc, tu_tra_ncc: !!c.cauHinh.tu_tra_ncc, trang_thai: c.trangThai as 'bat' | 'tat' });
  const [bao, setBao] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();
  const doi = cfg.ngay_ship_max !== (c.cauHinh.ngay_ship_max ?? 11) || cfg.tu_sang_ncc !== !!c.cauHinh.tu_sang_ncc || cfg.tu_tra_ncc !== !!c.cauHinh.tu_tra_ncc || cfg.trang_thai !== c.trangThai;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, background: 'var(--bg-1)', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b>{c.ten}</b><a href={`https://${c.domain}`} target="_blank" rel="noreferrer">{c.domain} ↗</a>
        <Pill color={c.trangThai === 'bat' ? 'var(--ok)' : 'var(--fg-3)'} label={c.trangThai === 'bat' ? 'đang chạy' : 'tắt'} />
        <span style={{ color: 'var(--fg-3)', fontSize: 12.5 }}>{c.nenTang} · NCC {c.ncc.toUpperCase()} · {c.soDon} đơn · {c.soSanPham} sản phẩm{c.thieuMa ? ` · ${c.thieuMa} biến thể thiếu mã CJ` : ''}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={dangChay} onClick={() => batDau(async () => {
          const r = await shopDongBo(c.khoa, true).catch((e) => ({ ok: false, loi: (e as Error).message }));
          setBao(r.ok ? 'Đã kéo lại đơn + sản phẩm' : `Lỗi: ${r.loi}`);
        })}>{dangChay ? 'Đang chạy…' : 'Kéo lại cả sản phẩm'}</button>
      </div>
      <div style={{ fontSize: 12.5, color: c.dongBoLoi ? 'var(--bad)' : 'var(--fg-3)' }}>
        Đồng bộ gần nhất: {gio(c.dongBoLuc)}{c.dongBoLoi ? ` · lỗi: ${c.dongBoLoi}` : ' · webhook Woo đẩy đơn tức thì, nhịp máy kéo bù mỗi 10 phút'}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={cfg.trang_thai === 'bat'} onChange={(e) => setCfg({ ...cfg, trang_thai: e.target.checked ? 'bat' : 'tat' })} /> Bật đồng bộ
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title="Đơn vừa trả tiền tự đặt sang CJ (chỉ TẠO đơn, chưa trả CJ — không tiêu tiền).">
          <input type="checkbox" checked={cfg.tu_sang_ncc} onChange={(e) => setCfg({ ...cfg, tu_sang_ncc: e.target.checked })} /> Tự sang NCC
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: cfg.tu_tra_ncc ? 'var(--warn)' : undefined }} title="Tạo xong tự trả CJ từ ví — TIÊU TIỀN không cần bấm. Mặc định tắt.">
          <input type="checkbox" checked={cfg.tu_tra_ncc} onChange={(e) => setCfg({ ...cfg, tu_tra_ncc: e.target.checked })} /> Tự trả NCC (trừ ví)
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} title="Chỉ chọn tuyến ship có thời gian giao tối đa ≤ số ngày này; trong đó lấy tuyến rẻ nhất.">
          Ship tối đa
          <input id={`shop-ngay-${c.khoa}`} type="number" min={3} max={30} value={cfg.ngay_ship_max} onChange={(e) => setCfg({ ...cfg, ngay_ship_max: Number(e.target.value) })}
            style={{ width: 56, padding: '3px 6px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-1)' }} /> ngày
        </label>
        <button className="btn primary" disabled={!doi || dangChay} onClick={() => batDau(async () => {
          await shopSuaCauHinh(c.khoa, cfg); setBao('Đã lưu cấu hình');
        })}>Lưu</button>
      </div>
      {bao && <div style={{ fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</div>}
    </div>
  );
}
