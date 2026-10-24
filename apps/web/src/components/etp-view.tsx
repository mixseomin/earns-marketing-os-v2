'use client';
// etp.on.tc — QUẢN LÝ CAMP / CREATIVE / ROI TẬP TRUNG (anh 24/10/2026). Đọc kho `etp` (lib/etp-doc), làm mới mỗi phút; ngày = ngày Ethopex (07:00–07:00 VN).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, FilterChips, Segmented, StatsStrip, type DataColumn } from '@/components/ui';
import { CotAmDuong } from '@/components/cot-am-duong';
import type { CampEtpKho, CreativeEtpKho, DuLieuEtp, PhimEtpKho, SoTien } from '@/lib/etp-doc';

type Tab = 'tong' | 'camp' | 'creative' | 'phim' | 'luat';
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const roiOf = (s: SoTien) => (s.chi >= 0.3 ? Math.round(((s.thu - s.chi) / s.chi) * 100) : null);
const Roi = ({ s }: { s: SoTien }) => { const r = roiOf(s); return <span style={{ color: r == null ? 'var(--fg-3)' : r >= 0 ? 'var(--neon-lime, #4ade80)' : 'var(--neon-red, #f87171)', fontVariantNumeric: 'tabular-nums' }}>{r == null ? '—' : `${r > 0 ? '+' : ''}${r}%`}</span>; };
const Lai = ({ s }: { s: SoTien }) => <span style={{ color: s.thu - s.chi >= 0 ? 'var(--neon-lime, #4ade80)' : 'var(--neon-red, #f87171)', fontVariantNumeric: 'tabular-nums' }}>{usd(s.thu - s.chi)}</span>;
const vn = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
const cong = (xs: SoTien[]) => xs.reduce((a, x) => ({ chi: a.chi + x.chi, thu: a.thu + x.thu }), { chi: 0, thu: 0 });
const TT = ({ c }: { c: Pick<CampEtpKho, 'trang_thai' | 'lich' | 'giao'> }) => {
  const lich = c.lich && Date.parse(c.lich) > Date.now();
  const [nen, chu] = c.giao === 'DISAPPROVED' ? ['#d93025', 'bị từ chối'] : lich ? ['#b26a00', 'lịch'] : c.trang_thai === 'ACTIVE' ? ['#1e8e3e', 'chạy'] : ['#6b6b6b', 'tắt'];
  return <span style={{ background: nen, color: '#fff', borderRadius: 8, padding: '0 6px', fontSize: 11, whiteSpace: 'nowrap' }}>{chu}</span>;
};
const soCot = <T,>(key: string, header: string, f: (r: T) => SoTien): DataColumn<T>[] => [
  { key: `${key}_roi`, header: `ROI ${header}`, group: key, cell: (r) => <Roi s={f(r)} />, sortValue: (r) => roiOf(f(r)) ?? -1e9 },
  { key: `${key}_lai`, header: 'Lãi', group: key, cell: (r) => <Lai s={f(r)} />, sortValue: (r) => f(r).thu - f(r).chi, total: (rs) => usd(rs.reduce((a, r) => a + f(r).thu - f(r).chi, 0)) },
  { key: `${key}_chi`, header: 'Chi', group: key, cell: (r) => usd(f(r).chi), sortValue: (r) => f(r).chi, total: (rs) => usd(rs.reduce((a, r) => a + f(r).chi, 0)) },
];
const NHOM = [{ key: 'nay', label: 'Hôm nay (đang chạy)' }, { key: 'qua', label: 'Hôm qua' }, { key: 'thang', label: 'Tháng này' }];

export function EtpView({ du }: { du: DuLieuEtp }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tong');
  const [loc, setLoc] = useState<'all' | 'chay' | 'tat' | 'cung'>('chay');
  const [hep, setHep] = useState(false);   // màn hẹp (điện thoại): đầu trang gọn — 3 số chính, còn lại ở hover (anh 24/10/2026 "phần hero chiếm hết màn hình")
  useEffect(() => { const mq = window.matchMedia('(max-width: 720px)'); const f = () => setHep(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  useEffect(() => { const t = setInterval(() => router.refresh(), 60_000); return () => clearInterval(t); }, [router]);
  useEffect(() => { const x = new URLSearchParams(location.search).get('t') as Tab | null; if (x) setTab(x); }, []);
  useEffect(() => { const u = new URL(location.href); u.searchParams.set('t', tab); history.replaceState(history.state, '', u); }, [tab]);
  const tl = (k: string | null) => (k ? du.theLoai[k] ?? k : '—');
  const nay = cong(du.camps.map((c) => c.nay)), qua = cong(du.camps.map((c) => c.qua)), thang = cong(du.camps.map((c) => c.thang));
  const chay = du.camps.filter((c) => c.trang_thai === 'ACTIVE');
  const dk = du.cauHinh.find((c) => c.khoa === 'dung_khan')?.gia_tri === true;
  const camps = useMemo(() => du.camps.filter((c) => loc === 'all' || (loc === 'chay' ? c.trang_thai === 'ACTIVE' : loc === 'tat' ? c.trang_thai !== 'ACTIVE' : c.cung_doan > 3)), [du.camps, loc]);

  const cotCamp: DataColumn<CampEtpKho>[] = [
    { key: 'id', header: 'Camp', align: 'left', cell: (c) => <span style={{ whiteSpace: 'nowrap' }}>#{c.camp_id} <TT c={c} />{c.bo ? <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--fg-2)' }}>bộ {c.bo}</span> : null}</span>, sortValue: (c) => c.camp_id },
    { key: 'phim', header: 'Phim · creative', align: 'left', cell: (c) => <span title={c.ten}>{c.phim ?? c.ten.slice(0, 50)} <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>#{c.creative_id} {c.dang ?? ''}{c.cung_doan > 1 ? ` · ⚔${c.cung_doan}` : ''}</span></span>, sortValue: (c) => c.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (c) => <span style={{ fontSize: 12 }}>{tl(c.the_loai)}</span>, sortValue: (c) => c.the_loai ?? '' },
    { key: 'ns', header: 'Ngân sách', cell: (c) => `$${c.ngan_sach}`, sortValue: (c) => c.ngan_sach, total: (rs) => `$${rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0)}` },
    ...soCot<CampEtpKho>('nay', 'h.nay', (c) => c.nay), ...soCot<CampEtpKho>('qua', 'h.qua', (c) => c.qua), ...soCot<CampEtpKho>('thang', 'tháng', (c) => c.thang),
    { key: 'tao', header: 'Tạo', cell: (c) => <span style={{ fontSize: 11 }}>{vn(c.tao)}</span>, sortValue: (c) => c.tao ?? '' },
  ];
  const cotCr: DataColumn<CreativeEtpKho>[] = [
    { key: 'id', header: 'Creative', align: 'left', cell: (r) => <span style={{ whiteSpace: 'nowrap' }}>#{r.creative_id} <span style={{ fontSize: 11, color: r.cta_dat ? 'var(--neon-lime,#4ade80)' : '#ffb74d' }}>{r.cta_dat ? 'CTA đạt' : 'CTA cũ'}</span>{r.tu_choi ? <span style={{ fontSize: 11, color: '#f87171' }}> · Meta từ chối</span> : null}</span>, sortValue: (r) => r.creative_id },
    { key: 'phim', header: 'Phim · đoạn', align: 'left', cell: (r) => <span>{r.phim ?? '—'} <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{r.dang ?? ''} {r.tu != null ? `${Math.round(r.tu)}–${Math.round(r.den ?? 0)}s` : ''}</span>{r.video ? <a href={r.video} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11 }}>video</a> : null}</span>, sortValue: (r) => r.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (r) => <span style={{ fontSize: 12 }}>{tl(r.the_loai)}</span>, sortValue: (r) => r.the_loai ?? '' },
    { key: 'camp', header: 'Camp chạy', title: '⚔ = số camp đang chạy cùng ĐOẠN (gộp bản CTA cũ + bản sửa) — trần 3', cell: (r) => <span>{r.chay}/{r.camp}{r.cung_doan > 1 ? <span style={{ marginLeft: 4, color: r.cung_doan > 3 ? '#ffb74d' : 'var(--fg-2)' }}>⚔{r.cung_doan}</span> : null}</span>, sortValue: (r) => r.chay },
    ...soCot<CreativeEtpKho>('nay', 'h.nay', (r) => r.nay), ...soCot<CreativeEtpKho>('qua', 'h.qua', (r) => r.qua), ...soCot<CreativeEtpKho>('thang', 'tháng', (r) => r.thang),
    { key: 'tuoi', header: 'Tuổi', title: 'số ngày từ camp đầu tiên dùng creative — bão hoà thường sau vài ngày', cell: (r) => (r.ngay_dau ? `${Math.floor((Date.now() - Date.parse(r.ngay_dau)) / 86_400_000)}d` : '—'), sortValue: (r) => r.ngay_dau ?? '' },
  ];
  const cotPh: DataColumn<PhimEtpKho>[] = [
    { key: 'ten', header: 'Phim', align: 'left', cell: (p) => <span>{p.ten ?? p.content_id} <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{p.locale ?? ''} {p.nguon ?? ''}{p.bo ? ` · bộ ${p.bo}` : ''}</span></span>, sortValue: (p) => p.ten ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (p) => <span style={{ fontSize: 12 }}>{tl(p.the_loai)}</span>, sortValue: (p) => p.the_loai ?? '' },
    { key: 'sl', header: 'Creative · camp chạy', cell: (p) => `${p.creative} · ${p.chay}/${p.camp}`, sortValue: (p) => p.chay },
    ...soCot<PhimEtpKho>('nay', 'h.nay', (p) => p.nay), ...soCot<PhimEtpKho>('qua', 'h.qua', (p) => p.qua), ...soCot<PhimEtpKho>('thang', 'tháng', (p) => p.thang),
  ];
  const ngayGanNhat = du.ngay.slice(-31);

  return (
    // TRANG TỰ CUỘN (body của mos2 khoá cuộn — trong mos2 chỉ vùng nội dung cuộn; etp.on.tc đứng riêng): khung cao đúng màn hình, cuộn bên trong,
    // đầu trang trôi đi, tiêu đề bảng + thanh trang của DataTable dính theo khung này — kéo lên xem hết bảng như bên Ethopex
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
    <div style={{ padding: hep ? '10px 10px 40px' : '16px 20px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: hep ? 16 : 20 }}>ETP · quản lý camp</h1>
        <span title={`kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex 07:00–07:00 VN · tự làm mới mỗi phút`} style={{ fontSize: 11, color: 'var(--fg-2)' }}>{hep ? `đồng bộ ${vn(du.dongBo?.xong ?? null)}` : `kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex 07:00–07:00 VN · tự làm mới mỗi phút`}{du.dongBo?.loi ? ` · lỗi: ${du.dongBo.loi.slice(0, 80)}` : ''}</span>
        {dk ? <span style={{ background: '#d93025', color: '#fff', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>⛔ ĐANG DỪNG KHẨN</span> : null}
      </div>
      <div style={{ margin: hep ? '8px 0' : '12px 0' }}>
        {hep ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }} title={`Camp chạy ${chay.length} · ngân sách $${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày · đoạn vượt 3 camp ${new Set(du.camps.filter((c) => c.cung_doan > 3).map((c) => c.doan)).size} · cảnh báo 24h ${du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length}`}>
            {([['H.nay', nay], ['H.qua', qua], ['Tháng', thang]] as [string, SoTien][]).map(([ten, s]) => (
              <div key={ten} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-2)' }}>{ten} · <Roi s={s} /></div>
                <div style={{ fontWeight: 700, fontSize: 15 }}><Lai s={s} /></div>
              </div>))}
          </div>
        ) : <StatsStrip cards={[
          { key: 'nay', label: 'Lãi hôm nay', value: <Lai s={nay} />, sub: <span>ROI <Roi s={nay} /> · chi {usd(nay.chi)}</span> },
          { key: 'qua', label: 'Lãi hôm qua', value: <Lai s={qua} />, sub: <span>ROI <Roi s={qua} /> · chi {usd(qua.chi)}</span> },
          { key: 'thang', label: 'Lãi tháng', value: <Lai s={thang} />, sub: <span>ROI <Roi s={thang} /> · chi {usd(thang.chi)}</span> },
          { key: 'camp', label: 'Camp chạy', value: chay.length, sub: `ngân sách $${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày` },
          { key: 'cung', label: 'Đoạn vượt 3 camp', value: new Set(du.camps.filter((c) => c.cung_doan > 3).map((c) => c.doan)).size, color: '#ffb74d' },
          { key: 'cb', label: 'Cảnh báo 24h', value: du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length, color: du.canhBao.some((c) => c.muc === 'do' && Date.now() - Date.parse(c.luc) < 86_400_000) ? '#f87171' : undefined },
        ]} />}
      </div>
      <div style={{ display: 'flex', gap: hep ? 6 : 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: 'tong', label: 'Tổng quan' }, { value: 'camp', label: 'Camp', title: `${du.camps.length} camp` }, { value: 'creative', label: 'Creative', title: `${du.creatives.length} creative` },
          { value: 'phim', label: 'Phim', title: `${du.phims.length} phim` }, { value: 'luat', label: 'Luật & cảnh báo' }]} />
        {tab === 'camp' ? <FilterChips value={loc} onChange={setLoc} counts={{ all: du.camps.length, chay: chay.length, tat: du.camps.length - chay.length, cung: du.camps.filter((c) => c.cung_doan > 3).length }}
          options={[{ value: 'chay', label: 'Đang chạy' }, { value: 'tat', label: 'Đã tắt' }, { value: 'cung', label: 'Đoạn > 3 camp' }, { value: 'all', label: 'Tất cả' }]} /> : null}
      </div>
      {tab === 'tong' ? (
        <div>
          <CotAmDuong data={ngayGanNhat.map((r) => ({ x: `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)}`, v: r.thu - r.chi, phu: `chi ${usd(r.chi)} · thu ${usd(r.thu)} · ROI ${roiOf(r) ?? '—'}% · ${r.camp} camp có chi` }))} dinhDang={usd} />
          <DataTable rows={[...ngayGanNhat].reverse()} getRowKey={(r) => r.ngay} persistKey="etp-ngay" minWidth={560} columns={[
            { key: 'ngay', header: 'Ngày', align: 'left', cell: (r) => `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)}${r.ngay === du.nay ? ' · đang chạy' : ''}`, sortValue: (r) => r.ngay },
            { key: 'chi', header: 'Chi', cell: (r) => usd(r.chi), sortValue: (r) => r.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.chi, 0)) },
            { key: 'thu', header: 'Thu', cell: (r) => usd(r.thu), sortValue: (r) => r.thu, total: (rs) => usd(rs.reduce((a, r) => a + r.thu, 0)) },
            { key: 'lai', header: 'Lãi', cell: (r) => <Lai s={r} />, sortValue: (r) => r.thu - r.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.thu - r.chi, 0)) },
            { key: 'roi', header: 'ROI', cell: (r) => <Roi s={r} />, sortValue: (r) => roiOf(r) ?? -1e9 },
            { key: 'camp', header: 'Camp có chi', cell: (r) => r.camp, sortValue: (r) => r.camp }]} />
        </div>
      ) : tab === 'camp' ? (
        <DataTable rows={camps} columns={cotCamp} groups={NHOM} getRowKey={(c) => String(c.camp_id)} persistKey="etp-camp" minWidth={1400} pageSize={100}
          searchText={(c) => `${c.camp_id} ${c.ten} ${c.phim ?? ''} ${c.creative_id ?? ''} ${tl(c.the_loai)}`} searchPlaceholder="Tìm camp, phim, creative, thể loại…" />
      ) : tab === 'creative' ? (
        <DataTable rows={du.creatives} columns={cotCr} groups={NHOM} getRowKey={(r) => String(r.creative_id)} persistKey="etp-creative" minWidth={1400} pageSize={100}
          searchText={(r) => `${r.creative_id} ${r.phim ?? ''} ${r.dang ?? ''} ${tl(r.the_loai)}`} searchPlaceholder="Tìm creative, phim, dạng…" />
      ) : tab === 'phim' ? (
        <DataTable rows={du.phims} columns={cotPh} groups={NHOM} getRowKey={(p) => String(p.content_id)} persistKey="etp-phim" minWidth={1200} pageSize={100}
          searchText={(p) => `${p.content_id} ${p.ten ?? ''} ${tl(p.the_loai)}`} searchPlaceholder="Tìm phim, thể loại…" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 2fr)', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 14 }}>Rào chắn (etp.cau_hinh)</h3>
            {du.cauHinh.map((c) => <div key={c.khoa} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--line)' }}><b>{c.khoa}</b> = <code>{JSON.stringify(c.gia_tri)}</code><div style={{ color: 'var(--fg-2)' }}>{c.ghi}</div></div>)}
            <h3 style={{ fontSize: 14, marginTop: 16 }}>Cảnh báo</h3>
            {du.canhBao.length ? du.canhBao.map((c, i) => <div key={i} style={{ fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--line)' }}>{c.muc === 'do' ? '🔴' : '🟡'} {vn(c.luc)} — {c.noi_dung}</div>) : <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Chưa có cảnh báo.</div>}
          </div>
          <div>
            <h3 style={{ fontSize: 14 }}>Nhật ký luật (300 dòng gần nhất)</h3>
            <DataTable rows={du.nhatKy} getRowKey={(r) => `${r.luc}-${r.viec}-${r.camp_id}`} persistKey="etp-nk" minWidth={700} pageSize={50} columns={[
              { key: 'luc', header: 'Lúc', align: 'left', cell: (r) => <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{vn(r.luc)}</span>, sortValue: (r) => r.luc },
              { key: 'viec', header: 'Việc', align: 'left', cell: (r) => <span style={{ color: r.ok === false ? '#f87171' : undefined }}>{r.viec}{r.camp_id ? ` #${r.camp_id}` : ''}</span>, sortValue: (r) => r.viec },
              { key: 'doi', header: 'Trước → sau', cell: (r) => `${r.truoc ?? '—'} → ${r.sau ?? '—'}` },
              { key: 'luat', header: 'Luật · ai', align: 'left', cell: (r) => <span style={{ fontSize: 11 }} title={r.loi ?? ''}>{(r.luat ?? '').slice(0, 120)} <span style={{ color: 'var(--fg-2)' }}>· {r.ai}</span></span> }]}
              searchText={(r) => `${r.camp_id ?? ''} ${r.viec} ${r.luat ?? ''}`} searchPlaceholder="Tìm camp, việc, luật…" />
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
