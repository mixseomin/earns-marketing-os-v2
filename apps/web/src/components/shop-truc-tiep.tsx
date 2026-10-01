'use client';
// /shop › Khách trực tiếp — ai đang trên mặt tiền (kiểu GA4 thời gian thực): phễu toàn cảnh → bảng phiên → drawer dòng thời gian
// (trang xem, % cuộn, bấm gì, chọn mẫu, thêm giỏ, checkout…). Tự gọi lại mỗi 5 giây khi tab đang hiện. Sổ: shop_phien (apps/store
// /api/phien ghi), phễu + nhãn: @mos2/shop/phien. URL: ?kc cửa sổ · ?pc chặng đang lọc · ?m=phien&mId= drawer.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DaiLuong, DataTable, Drawer, EmptyState, FilterChips, LinkChip, Panel, Pill, SimpleTable, StatsStrip, ThanhChang, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { fmtAgoVi } from '@/lib/time-format';
import { APP_TZ } from '@/lib/local-day';
import { CHANG_PHIEN, CUA_SO, NHAN_SU_KIEN, type CuaSo } from '@mos2/shop/phien';
import { isoCua, tien } from '@/lib/shop/buoc';
import type { PhienDong, SuKienPhien } from '@/lib/shop/phien';
import { shopPhien, shopSuKienPhien } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const giay = (s: string) => new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(isoCua(s)));
const truoc = (s: string) => fmtAgoVi(new Date(isoCua(s)).toISOString());
const thoiLuong = (p: PhienDong) => {
  const g = Math.max(0, Math.round((new Date(isoCua(p.cuoi)).getTime() - new Date(isoCua(p.batDau)).getTime()) / 1000));
  return g < 60 ? `${g}s` : g < 3600 ? `${Math.floor(g / 60)}m ${g % 60}s` : `${Math.floor(g / 3600)}h ${Math.floor((g % 3600) / 60)}m`;
};
const Cham = ({ on }: { on: boolean }) => <span title={on ? 'Đang trên site' : 'Đã rời'} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: on ? 'var(--ok)' : 'var(--bg-3)' }} />;
const NHIP = 5_000;

export function KhachTrucTiep({ ch }: { ch: string }) {
  const sp = useSearchParams();
  const [cuaSo, setCuaSo] = useState<CuaSo>((sp.get('kc') as CuaSo) || '30p');
  const [pc, setPc] = useState(sp.get('pc') || '');
  const [rows, setRows] = useState<PhienDong[] | null>(null);
  const [luc, setLuc] = useState<number>(0);
  const modal = useModalParam();

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (cuaSo !== '30p') u.set('kc', cuaSo); else u.delete('kc');
    if (pc) u.set('pc', pc); else u.delete('pc');
    const qs = u.toString();
    window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [cuaSo, pc]);
  useEffect(() => {
    let song = true;
    const nap = () => shopPhien(cuaSo).then((r) => { if (song) { setRows(r); setLuc(Date.now()); } }).catch(() => null);
    nap();
    const id = setInterval(() => document.visibilityState === 'visible' && nap(), NHIP);
    return () => { song = false; clearInterval(id); };
  }, [cuaSo]);

  const ds = useMemo(() => (rows ?? []).filter((p) => ch === 'all' || p.cuaHang === ch), [rows, ch]);
  const loc = useMemo(() => ds.filter((p) => !pc || CHANG_PHIEN[p.chang]?.key === pc), [ds, pc]);
  const online = ds.filter((p) => p.online).length;
  const toi = (i: number) => ds.filter((p) => p.chang >= i).length;
  const pct = (n: number) => (ds.length ? `${Math.round((n / ds.length) * 100)}%` : '—');
  const iGio = CHANG_PHIEN.findIndex((c) => c.key === 'them_gio'), iDon = CHANG_PHIEN.length - 1;

  const cot: DataColumn<PhienDong>[] = [
    { key: 'on', header: '', align: 'left', cell: (p) => <Cham on={p.online} />, sortValue: (p) => (p.online ? 1 : 0) },
    { key: 'khach', header: 'Khách', align: 'left', cell: (p) => <>{p.thietBi ?? '—'} <span style={phu}>{[p.thanhPho, p.nuoc].filter(Boolean).join(', ')}</span>
      {p.quayLai && <> <Pill color="var(--accent)" label="quay lại" uppercase={false} mono={false} /></>}</> },
    { key: 'nguon', header: 'Nguồn', align: 'left', cell: (p) => p.nguon ?? '—', cellTitle: (p) => p.trangDau ?? '' },
    { key: 'dang', header: 'Đang ở', align: 'left', cell: (p) => <span style={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{p.trangHien ?? '—'}</span>,
      cellTitle: (p) => p.trangHien ?? '' },
    { key: 'cuon', header: 'Cuộn', title: '% cuộn sâu nhất ở trang đang xem', cell: (p) => `${p.cuon}%`, sortValue: (p) => p.cuon },
    { key: 'chang', header: 'Phễu', align: 'left', cell: (p) => <ThanhChang so={CHANG_PHIEN.length} i={p.chang} nhan={CHANG_PHIEN[p.chang]?.nhan ?? '—'} />, sortValue: (p) => p.chang },
    { key: 'trang', header: 'Trang', title: 'Số trang đã xem', cell: (p) => p.soTrang, sortValue: (p) => p.soTrang },
    { key: 'click', header: 'Bấm', cell: (p) => p.soClick, sortValue: (p) => p.soClick },
    { key: 'gio', header: 'Giỏ', cell: (p) => (p.gioGia ? tien(p.gioGia) : '—'), sortValue: (p) => p.gioGia },
    { key: 'don', header: 'Đơn', align: 'left', cell: (p) => (p.soDon ? <b>#{p.soDon}</b> : '—') },
    { key: 'tl', header: 'Thời lượng', cell: (p) => thoiLuong(p) },
    { key: 'cuoi', header: 'Lần cuối', align: 'left', cell: (p) => <span title={giay(p.cuoi)}>{truoc(p.cuoi)}</span>, sortValue: (p) => p.cuoi },
  ];
  const mo = ds.find((p) => p.id === modal.id) ?? null;

  return (<>
    <StatsStrip minColWidth={130} cards={[
      { key: 'on', label: 'Đang online', value: online, color: online ? 'var(--ok)' : undefined, sub: `nhịp ${NHIP / 1000}s · ${luc ? giay(new Date(luc).toISOString()) : '…'}` },
      { key: 'ph', label: 'Phiên', value: ds.length, sub: CUA_SO.find((c) => c.value === cuaSo)?.label },
      { key: 'ql', label: 'Khách quay lại', value: ds.filter((p) => p.quayLai).length },
      { key: 'gio', label: 'Thêm giỏ', value: toi(iGio), sub: pct(toi(iGio)) },
      { key: 'don', label: 'Đặt hàng', value: toi(iDon), sub: pct(toi(iDon)), color: toi(iDon) ? 'var(--ok)' : undefined },
      { key: 'gt', label: 'Giá trị giỏ', value: tien(ds.reduce((t, p) => t + p.gioGia, 0)) },
    ]} />
    <div style={{ margin: '10px 0 8px' }}>
      <FilterChips urlKey="kc" value={cuaSo} onChange={(v) => setCuaSo(v as CuaSo)} options={CUA_SO.map((c) => ({ value: c.value, label: c.label, title: 'title' in c ? c.title : undefined }))} />
    </div>
    <DaiLuong urlKey="pc" value={pc} onChange={setPc} nut={CHANG_PHIEN.map((c, i) => {
      const o = ds.filter((p) => p.chang === i);
      return { key: c.key, nhan: c.nhan, title: `${c.chuThich} Số lớn = phiên dừng ở bước này; ${pct(toi(i))} số phiên đã tới bước này.`,
        so: o.length, phuDe: `${pct(toi(i))} tới`, dau: [{ n: o.filter((p) => p.online).length, nhan: 'online', mau: 'var(--ok)' }] };
    })} />
    {rows === null ? <div style={phu}>Đang tải…</div> : loc.length ? (
      <Panel pad={8}><DataTable rows={loc} columns={cot} getRowKey={(p) => p.id} persistKey="shop-phien" minWidth={1040}
        searchText={(p) => `${p.nguon ?? ''} ${p.trangHien ?? ''} ${p.trangDau ?? ''} ${p.nuoc ?? ''} ${p.thanhPho ?? ''} ${p.soDon ?? ''}`}
        searchPlaceholder="Tìm trang, nguồn, nước, số đơn…" onRowClick={(p) => modal.open('phien', p.id)} /></Panel>
    ) : <EmptyState icon="👀" compact title={ds.length ? 'Không có phiên ở bước này' : 'Chưa có khách nào trong khoảng này'}
        description={ds.length ? undefined : 'Mặt tiền gửi nhịp mỗi 15 giây khi khách mở trang — có người vào là hiện ở đây.'} />}
    {modal.is('phien') && modal.id && <DrawerPhien id={modal.id} p={mo} onClose={() => modal.close()} />}
  </>);
}

function chiTiet(e: SuKienPhien): string {
  const c = e.chiTiet ?? {};
  if (e.loai === 'click') return String(c.nhan ?? '');
  if (e.loai === 'cuon') return `${c.pct}%`;
  if (e.loai === 'chon') return `${c.tc}: ${c.gt}`;
  if (e.loai === 'xem_trang') return String(c.tieu_de ?? '');
  const mon = Array.isArray(c.mon) ? (c.mon as string[]).join(' + ') : '';
  return [c.value ? tien(Number(c.value)) : '', c.so ? `#${c.so}` : '', mon].filter(Boolean).join(' · ');
}

function DrawerPhien({ id, p, onClose }: { id: string; p: PhienDong | null; onClose: () => void }) {
  const [ev, setEv] = useState<SuKienPhien[] | null>(null);
  useEffect(() => {
    let song = true;
    const nap = () => shopSuKienPhien(id).then((r) => song && setEv(r)).catch(() => null);
    nap();
    const t = setInterval(() => document.visibilityState === 'visible' && nap(), NHIP);
    return () => { song = false; clearInterval(t); };
  }, [id]);
  return (
    <Drawer onClose={onClose} width={640}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {p && <Cham on={p.online} />}
          <h2 style={{ margin: 0, fontSize: 17 }}>Phiên khách</h2>
          {p && <span style={{ ...phu, fontSize: 12.5 }}>{p.thietBi} · {[p.thanhPho, p.nuoc].filter(Boolean).join(', ') || 'chưa rõ nơi'} · nguồn {p.nguon ?? '—'}{p.quayLai ? ' · khách quay lại' : ''}</span>}
          <span style={{ flex: 1 }} />
          {p?.trangHien && <LinkChip href={`https://${p.domain}${p.trangHien}`} tone="neutral" size="xs">trang đang xem ↗</LinkChip>}
        </div>
        {p && <ThanhChang so={CHANG_PHIEN.length} i={p.chang} nhan={CHANG_PHIEN[p.chang]?.nhan} phuDe={`vào ${giay(p.batDau)} · ${thoiLuong(p)} · ${p.soTrang} trang · ${p.soClick} lần bấm · trang đầu ${p.trangDau ?? '—'}`} />}
        {!ev ? <div style={phu}>Đang tải…</div> : (
          <SimpleTable rows={ev} getRowKey={(_, i) => String(i)}
            rowStyle={(e) => (e.loai in Object.fromEntries(CHANG_PHIEN.map((c) => [c.key, 1])) ? { fontWeight: 700 } : e.loai === 'cuon' ? { color: 'var(--fg-3)' } : undefined)} columns={[
              { key: 'ts', header: 'Lúc', width: 70, cell: (e) => <span style={phu}>{giay(e.ts)}</span> },
              { key: 'l', header: 'Sự kiện', width: 110, cell: (e) => NHAN_SU_KIEN[e.loai] ?? e.loai },
              { key: 't', header: 'Trang', width: 170, cell: (e) => <span style={phu}>{e.trang}</span> },
              { key: 'c', header: 'Chi tiết', cell: (e) => chiTiet(e) },
            ]} />
        )}
      </div>
    </Drawer>
  );
}
