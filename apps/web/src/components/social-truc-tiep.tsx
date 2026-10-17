'use client';
// SOCIAL TRAFFIC › TRỰC TIẾP — ai đang ở trên site aff (pickjot.com…) lúc này: dải phễu Vào → Cuộn 25% → Đọc 50% → Bấm sang shop,
// bảng phiên (nguồn: youtube short / fb comment…), ngăn dòng thời gian từng khách. Cùng khuôn /shop › Khách trực tiếp (shop-truc-tiep.tsx)
// nhưng nguồn là sổ phiên adfond (lib/social-truc-tiep.ts). Tự gọi lại mỗi 10 giây khi tab đang hiện.
// URL: ?stk cửa sổ · ?stb bước đang lọc · ?m=st-phien&mId= ngăn phiên.
import { useEffect, useMemo, useState } from 'react';
import { DaiLuong, DataTable, Drawer, EmptyState, FilterChips, LinkChip, Panel, Pill, SimpleTable, StatsStrip, ThanhChang, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { useShallowParam } from '@/lib/url-shallow';
import { fmtAgoVi } from '@/lib/time-format';
import { APP_TZ } from '@/lib/local-day';
import { socialPhien, socialSuKien } from '@/lib/actions/social-traffic';
import { BUOC_AFF, CUA_SO_AFF, NHAN_SK_AFF, type CuaSoAff, type PhienAff, type SuKienAff } from '@/lib/social-traffic-demo';

const NHIP = 10_000;
const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const giay = (s: string) => new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(s));
const thoiLuong = (p: PhienAff) => {
  const g = Math.max(0, Math.round((Date.parse(p.cuoi) - Date.parse(p.batDau)) / 1000));
  return g < 60 ? `${g}s` : g < 3600 ? `${Math.floor(g / 60)}m ${g % 60}s` : `${Math.floor(g / 3600)}h ${Math.floor((g % 3600) / 60)}m`;
};
const Cham = ({ on }: { on: boolean }) => <span title={on ? 'Đang trên site' : 'Đã rời'} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: on ? 'var(--ok)' : 'var(--bg-3)' }} />;
const cat = (s: string | null, w = 220) => <span title={s ?? ''} style={{ display: 'inline-block', maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{s ?? '—'}</span>;

export function SocialTrucTiep() {
  const [kc, setKc] = useShallowParam('stk', '30p');
  const [bc, setBc] = useShallowParam('stb', '');
  const [kq, setKq] = useState<{ sites: string[]; khongMa: string[]; phien: PhienAff[] } | null>(null);
  const [loi, setLoi] = useState('');
  const [luc, setLuc] = useState(0);
  const modal = useModalParam();

  useEffect(() => {
    let song = true;
    const nap = () => socialPhien(kc as CuaSoAff).then((r) => { if (song) { setKq(r); setLuc(Date.now()); setLoi(''); } })
      .catch((e: Error) => song && setLoi(e.message));
    nap();
    const id = setInterval(() => document.visibilityState === 'visible' && nap(), NHIP);
    return () => { song = false; clearInterval(id); };
  }, [kc]);

  const ds = kq?.phien ?? [];
  const loc = useMemo(() => ds.filter((p) => !bc || BUOC_AFF[p.buoc]?.ma === bc), [ds, bc]);
  const online = ds.filter((p) => p.online).length;
  const toi = (i: number) => ds.filter((p) => p.buoc >= i).length;
  const pct = (n: number) => (ds.length ? `${Math.round((n / ds.length) * 100)}%` : '—');
  const nguon = useMemo(() => { const m = new Map<string, number>(); for (const p of ds) m.set(p.nguon ?? 'không rõ', (m.get(p.nguon ?? 'không rõ') ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); }, [ds]);

  const cot: DataColumn<PhienAff>[] = [
    { key: 'on', header: '', align: 'left', cell: (p) => <Cham on={p.online} />, sortValue: (p) => (p.online ? 1 : 0) },
    { key: 'nguon', header: 'Nguồn', align: 'left', cell: (p) => p.nguon ?? '—', sortValue: (p) => p.nguon },
    { key: 'khach', header: 'Khách', align: 'left', cell: (p) => <>{p.thietBi ?? '—'} <span style={phu}>{[p.thanhPho, p.nuoc].filter(Boolean).join(', ')}</span>
      {p.quayLai && <> <Pill color="var(--accent)" label="quay lại" uppercase={false} mono={false} /></>}</> },
    { key: 'dang', header: 'Đang ở', align: 'left', cell: (p) => cat(p.tieuDe ?? p.trangHien), cellTitle: (p) => `${p.site}${p.trangHien ?? ''}` },
    { key: 'cuon', header: 'Cuộn', cell: (p) => `${p.cuon}%`, sortValue: (p) => p.cuon },
    { key: 'buoc', header: 'Phễu', align: 'left', cell: (p) => <ThanhChang so={BUOC_AFF.length} i={p.buoc} nhan={BUOC_AFF[p.buoc]?.nhan ?? '—'} />, sortValue: (p) => p.buoc },
    { key: 'bam', header: 'Bấm sang', align: 'left', cell: (p) => (p.bamMua ? cat(p.bamMua, 180) : '—') },
    { key: 'trang', header: 'Trang', cell: (p) => p.soTrang, sortValue: (p) => p.soTrang },
    { key: 'tl', header: 'Thời lượng', cell: (p) => thoiLuong(p) },
    { key: 'cuoi', header: 'Lần cuối', align: 'left', cell: (p) => <span title={giay(p.cuoi)}>{fmtAgoVi(p.cuoi)}</span>, sortValue: (p) => p.cuoi },
  ];
  const mo = ds.find((p) => p.id === modal.id) ?? null;

  if (loi) return <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>Không đọc được sổ phiên: {loi}</div>;
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <StatsStrip minColWidth={130} cards={[
        { key: 'on', label: 'Đang online', value: online, color: online ? 'var(--ok)' : undefined, sub: `nhịp ${NHIP / 1000}s · ${luc ? giay(new Date(luc).toISOString()) : '…'}` },
        { key: 'ph', label: 'Phiên', value: ds.length, sub: CUA_SO_AFF.find((c) => c.value === kc)?.label },
        { key: 'ql', label: 'Khách quay lại', value: ds.filter((p) => p.quayLai).length },
        { key: 'doc', label: 'Đọc 50%', value: toi(2), sub: pct(toi(2)) },
        { key: 'bam', label: 'Bấm sang shop', value: toi(3), sub: pct(toi(3)), color: toi(3) ? 'var(--ok)' : undefined },
        { key: 'ng', label: 'Nguồn nhiều nhất', value: nguon[0]?.[0] ?? '—', sub: nguon[0] ? `${nguon[0][1]} phiên` : undefined, title: nguon.map(([k, n]) => `${k}: ${n}`).join(' · ') },
      ]} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <FilterChips urlKey="stk" value={kc} onChange={setKc} options={CUA_SO_AFF.map((c) => ({ value: c.value, label: c.label }))} />
        <span style={{ ...phu, fontSize: 11.5 }}>đo được: {kq ? kq.sites.join(', ') || 'chưa site nào' : '…'} · sổ phiên adfond (page-events.js), không tính lượt đội nhà</span>
        {kq?.khongMa.length ? <span style={{ fontSize: 11.5, color: 'var(--warn)' }} title="Gumroad / Etsy không cho chèn mã theo dõi của mình — khách vào thẳng các trang này không bao giờ hiện ở đây. Muốn đo thì trỏ link qua trang của mình (pickjot.com…) trước.">
          ⚠️ không gắn được mã: {kq.khongMa.join(', ')}</span> : null}
      </div>
      <DaiLuong urlKey="stb" value={bc} onChange={setBc} nut={BUOC_AFF.map((b, i) => {
        const o = ds.filter((p) => p.buoc === i);
        return { key: b.ma, nhan: b.nhan, title: `${b.chuThich} Số lớn = phiên dừng ở bước này; ${pct(toi(i))} số phiên đã tới bước này.`,
          so: o.length, phuDe: `${pct(toi(i))} tới`, dau: [{ n: o.filter((p) => p.online).length, nhan: 'online', mau: 'var(--ok)' }] };
      })} />
      {kq === null ? <div style={phu}>Đang tải…</div> : loc.length ? (
        <Panel pad={8}><DataTable rows={loc} columns={cot} getRowKey={(p) => p.id} persistKey="st-phien" minWidth={1000}
          searchText={(p) => `${p.nguon ?? ''} ${p.tieuDe ?? ''} ${p.trangHien ?? ''} ${p.nuoc ?? ''} ${p.thanhPho ?? ''} ${p.bamMua ?? ''}`}
          searchPlaceholder="Tìm nguồn, trang, nước…" onRowClick={(p) => modal.open('st-phien', p.id)} /></Panel>
      ) : <EmptyState icon="👀" compact title={ds.length ? 'Không có phiên ở bước này' : 'Chưa có khách nào trong khoảng này'}
          description={ds.length ? undefined : 'Site aff gửi nhịp mỗi 15 giây khi khách mở trang — có người vào là hiện ở đây. Chọn "7 ngày" để xem phiên cũ.'} />}
      {modal.is('st-phien') && modal.id && <NganPhien id={modal.id} p={mo} onClose={() => modal.close()} />}
    </div>
  );
}

function NganPhien({ id, p, onClose }: { id: string; p: PhienAff | null; onClose: () => void }) {
  const [ev, setEv] = useState<SuKienAff[] | null>(null);
  useEffect(() => {
    let song = true;
    const nap = () => socialSuKien(id).then((r) => song && setEv(r)).catch(() => song && setEv([]));
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
          {p && <span style={{ ...phu, fontSize: 12.5 }}>{p.thietBi ?? '—'} · {[p.thanhPho, p.nuoc].filter(Boolean).join(', ') || 'chưa rõ nơi'} · nguồn {p.nguon ?? '—'}{p.quayLai ? ' · khách quay lại' : ''}</span>}
          <span style={{ flex: 1 }} />
          {p?.trangHien && <LinkChip href={`https://${p.site}${p.trangHien}`} tone="neutral" size="xs">trang đang xem ↗</LinkChip>}
        </div>
        {p && <ThanhChang so={BUOC_AFF.length} i={p.buoc} nhan={BUOC_AFF[p.buoc]?.nhan} phuDe={`vào ${giay(p.batDau)} · ${thoiLuong(p)} · ${p.soTrang} trang · ${p.soBam} lần bấm · cuộn ${p.cuon}% · trang đầu ${p.trangVao ?? '—'}`} />}
        {!ev ? <div style={phu}>Đang tải…</div> : ev.length ? (
          <SimpleTable rows={ev} getRowKey={(_, i) => String(i)} rowStyle={(e) => (e.loai === 'bam_mua' ? { fontWeight: 700 } : undefined)} columns={[
            { key: 'ts', header: 'Lúc', width: 70, cell: (e) => <span style={phu}>{giay(e.luc)}</span> },
            { key: 'l', header: 'Sự kiện', width: 110, cell: (e) => NHAN_SK_AFF[e.loai] ?? e.loai },
            { key: 't', header: 'Trang', width: 170, cell: (e) => <span style={phu}>{e.trang ?? ''}</span> },
            { key: 'c', header: 'Chi tiết', cell: (e) => e.chiTiet ?? '' },
          ]} />
        ) : <span style={phu}>Phiên này chưa có sự kiện nào.</span>}
      </div>
    </Drawer>
  );
}
