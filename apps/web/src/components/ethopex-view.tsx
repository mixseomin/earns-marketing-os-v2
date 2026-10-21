'use client';
// TAB ETHOPEX (trang chủ) — quản lý camp FB phim ngắn trên Ethopex + LUẬT đang áp cho từng camp, khuôn cột "Luật" của adfond /report2:
// ô biểu tượng (luật nặng nhất đang chạm, tô theo mức dung > ha > bao > len) + chip mã luật (rê = câu luật với số thật của camp + vì sao);
// bấm hàng → ngăn chi tiết: từng luật, điều kiện ✓/○ (hiện tại vs ngưỡng), "Chạm thì: …". Sổ luật: lib/ethopex-luat.ts. Dữ liệu: lib/ethopex-doc.ts.
import { useMemo, useState, useEffect } from 'react';
import { DataTable, Drawer, FilterChips, LinkChip, MultiSelect, Segmented, StatsStrip, type DataColumn } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { CotAmDuong } from '@/components/cot-am-duong';
import { useModalParam } from '@/lib/use-modal-param';
import { LUAT, LUAT_THEO_MA, MUC_MAU, chamLuat, dangCamp, deXuatPhim, nangNhat, roi, type CampEtp, type DangCr, type LuatCham, type PhimDeXuat } from '@/lib/ethopex-luat';
import type { DuLieuEthopex } from '@/lib/ethopex-doc';

type Dong = CampEtp & { luat: LuatCham[] };
type Loc = 'all' | 'chay' | 'tat' | 'cham';
type Xem = 'camp' | 'ngay' | 'phim' | 'cho' | 'luat';   // YDNI: chia tab con — không chồng khối dọc (anh 22/10/2026)
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`);
const mauTien = (v: number) => (v > 0 ? 'var(--neon-lime, #9be15d)' : v < 0 ? 'var(--neon-red, #ff5c5c)' : 'var(--fg-3)');
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
function truoc(iso: string) { const p = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return p < 1 ? 'vừa xong' : p < 60 ? `${p} phút trước` : `${Math.round(p / 60)} giờ trước`; }

function OLuat({ ds }: { ds: LuatCham[] }) {
  const n = nangNhat(ds), cham = ds.filter((x) => x.trang_thai === 'cham'), gan = ds.filter((x) => x.trang_thai === 'gan');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span title={`${cham.length} luật đang chạm · ${gan.length} sắp chạm · ${ds.length} luật đang áp`}
        style={{ width: 14, display: 'inline-block', textAlign: 'center', color: n ? MUC_MAU[n.muc] : 'var(--fg-3)', opacity: n ? 1 : 0.5 }}>{n ? n.icon : '·'}</span>
      {ds.filter((x) => x.trang_thai !== 'ap').map((x) => {
        const l = LUAT_THEO_MA[x.ma]!;
        return <span key={x.ma} title={`${l.ma} · ${l.ten} | ${x.cau}\nVì sao: ${l.vi}`}
          style={{ ...mono, fontSize: 10, padding: '0 4px', borderRadius: 3, border: `1px ${x.trang_thai === 'gan' ? 'dashed' : 'solid'} ${x.trang_thai === 'cham' ? MUC_MAU[l.muc] : 'var(--line)'}`,
            color: x.trang_thai === 'cham' ? MUC_MAU[l.muc] : 'var(--fg-2)' }}>{l.ma}</span>;
      })}
    </span>
  );
}

type DongNk = { luc: string; viec: string; truoc: string | null; sau: string | null; ai: string; luat: string | null; loi: string | null };
/** NHẬT KÝ THAY ĐỔI của camp (anh 22/10/2026: "log mọi thay đổi trong từng camp") — lịch sử Ethopex (mọi người, mọi đường) + luật kích hoạt của máy. */
function NhatKyCamp({ id }: { id: number }) {
  const [ds, setDs] = useState<DongNk[] | null>(null); const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { let bo = false; fetch(`/api/ethopex/lich-su/${id}`).then((r) => r.json()).then((j) => { if (!bo) { setDs(j.dong ?? []); setLoi(j.ok ? j.loi : j.error); } }).catch((e) => !bo && setLoi(String(e))); return () => { bo = true; }; }, [id]);
  if (!ds) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{loi ?? 'Đang đọc lịch sử…'}</div>;
  if (!ds.length) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có thay đổi nào.</div>;
  return (
    <div>
      {loi ? <div style={{ fontSize: 11, color: MUC_MAU.ha }}>Lịch sử Ethopex lỗi: {loi} — chỉ hiện nhật ký của máy</div> : null}
      {ds.map((d, i) => (
        <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '5px 0', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{new Date(d.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
            <span style={{ flex: 1 }}><b>{d.viec}</b> {d.truoc != null || d.sau != null ? <span style={mono}>{d.viec === 'ngân sách' ? `$${d.truoc ?? '—'} → $${d.sau ?? '—'}` : `${d.truoc ?? '—'} → ${d.sau ?? '—'}`}</span> : null}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{d.ai}</span>
          </div>
          {d.luat ? <div style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 4 }}>luật: {d.luat}</div> : null}
          {d.loi ? <div style={{ fontSize: 11, color: MUC_MAU.dung, marginLeft: 4 }}>không làm được: {d.loi}</div> : null}
        </div>
      ))}
    </div>
  );
}

function NganCamp({ c, onClose }: { c: Dong; onClose: () => void }) {
  const [mo, setMo] = useState<string | null>(null);
  const [tab, setTab] = useState<'luat' | 'nk'>('luat');
  const r = roi(c.thang);
  return (
    <Drawer onClose={onClose} width={640}>
      <div style={{ ...mono, fontSize: 11, color: 'var(--fg-3)' }}>Camp #{c.id} · tạo {new Date(c.tao).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
      <h3 style={{ margin: '4px 0 12px', fontSize: 15 }}>{c.ten}</h3>
      <StatsStrip minColWidth={110} cards={[
        { key: 'ns', label: 'Ngân sách', value: `$${c.ngan_sach}` },
        { key: 'chi', label: 'Chi tháng', value: usd(c.thang.chi) },
        { key: 'lai', label: 'Lãi tháng', value: usd(c.thang.thu - c.thang.chi), color: mauTien(c.thang.thu - c.thang.chi) },
        { key: 'roi', label: 'ROI tháng', value: pct(r), color: mauTien(r ?? 0) },
      ]} />
      <div style={{ display: 'grid', gridTemplateColumns: c.video ? '200px 1fr' : '1fr', gap: 14, margin: '12px 0 14px' }}>
        {c.video ? <video src={c.video} poster={c.anh ?? undefined} controls preload="none" playsInline style={{ width: 200, aspectRatio: '9 / 16', background: '#000', borderRadius: 6 }} /> : null}
        <div style={{ ...mono, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.7 }}>
          <div><span style={{ color: 'var(--fg-3)' }}>Phim:</span> {c.phim ?? '—'} {c.content_id ? `(content ${c.content_id})` : ''} · {c.ngon_ngu?.toUpperCase() ?? '—'}</div>
          <div><span style={{ color: 'var(--fg-3)' }}>Creative:</span> #{c.creative_id ?? '—'}{c.dang_creative ? ` · ${c.dang_creative}` : ''}</div>
          <div><span style={{ color: 'var(--fg-3)' }}>Trạng thái:</span> {c.trang_thai} · giao {c.giao || '—'}</div>
          {c.fb_ad ? <div><span style={{ color: 'var(--fg-3)' }}>FB ad:</span> {c.fb_ad}{c.fb_video ? ` · video ${c.fb_video}` : ''}</div> : null}
          {c.loi ? <div style={{ color: MUC_MAU.dung }}>{c.loi.slice(0, 220)}</div> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {c.link_phim ? <LinkChip href={c.link_phim} title={c.link_phim}>Phim trên site gốc ↗</LinkChip> : null}
            {c.trang_dich ? <LinkChip href={c.trang_dich} tone="neutral" title={c.trang_dich}>Trang đích ↗</LinkChip> : null}
            {c.video ? <LinkChip href={c.video} tone="neutral">Video creative ↗</LinkChip> : null}
            <LinkChip href={`https://app.ethopex.dev/campaign/facebook/edit/${c.id}`} tone="neutral">Camp trên Ethopex ↗</LinkChip>
            {c.studio_phim_id ? <LinkChip href={`https://studio.on.tc/?m=phim&mId=${c.studio_phim_id}`} tone="neutral">Creative trong studio ↗</LinkChip> : null}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Segmented<'luat' | 'nk'> value={tab} onChange={setTab} options={[{ value: 'luat', label: 'Luật đang áp' }, { value: 'nk', label: 'Nhật ký thay đổi', title: 'Mọi thay đổi ngân sách / trạng thái: lịch sử Ethopex + luật kích hoạt của máy' }]} />
      </div>
      {tab === 'nk' ? <NhatKyCamp id={c.id} /> : c.luat.map((x) => {
        const l = LUAT_THEO_MA[x.ma]!, mau = x.trang_thai === 'cham' ? MUC_MAU[l.muc] : 'var(--fg-2)';
        return (
          <div key={x.ma} style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: x.dk.length ? 'pointer' : 'default' }} onClick={() => setMo(mo === x.ma ? null : x.ma)}>
              <span style={{ width: 16, textAlign: 'center', color: mau }}>{l.icon}</span>
              <span style={{ ...mono, fontSize: 10, color: mau }}>{l.ma}</span>
              <span style={{ fontSize: 12, flex: 1 }}>{l.ten}</span>
              <span style={{ ...mono, fontSize: 10, color: mau, border: `1px ${x.trang_thai === 'gan' ? 'dashed' : 'solid'} ${x.trang_thai === 'ap' ? 'var(--line)' : mau}`, borderRadius: 3, padding: '0 4px' }}>
                {x.trang_thai === 'cham' ? 'đã chạm' : x.trang_thai === 'gan' ? 'sắp chạm' : 'đang áp'}</span>
              <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{l.gac === 'may' ? 'máy chặn' : 'anh duyệt'}</span>
              {x.dk.length ? <span style={{ color: 'var(--fg-3)' }}>{mo === x.ma ? '▴' : '▾'}</span> : null}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', margin: '2px 0 0 24px' }}>{x.cau}</div>
            {mo === x.ma && (
              <div style={{ margin: '6px 0 0 24px', fontSize: 11 }}>
                {x.dk.map((d) => <div key={d.ten} style={mono}>{d.dat ? '✓' : '○'} {d.ten}: <b>{d.hien}</b> <span style={{ color: 'var(--fg-3)' }}>(ngưỡng {d.nguong})</span></div>)}
                <div style={{ marginTop: 4 }}><span style={{ color: 'var(--fg-3)' }}>Chạm thì:</span> {l.lam}</div>
                <div style={{ color: 'var(--fg-3)' }}>Vì sao: {l.vi} — {l.nguon}</div>
              </div>
            )}
          </div>
        );
      })}
    </Drawer>
  );
}

/** TAB "THEO NGÀY" — mỗi ngày thực sự kiếm được bao nhiêu (anh 22/10/2026), lọc theo phim / camp / dạng creative / ngôn ngữ; tự làm mới mỗi phút.
 *  Hai góc: theo NGÀY QUẢNG CÁO (Report group_by date — 2 ngày gần nhất còn về thêm, vẽ nhạt) và TIỀN MỚI VÀO (điểm chụp cộng dồn — chỉ tổng tài khoản). */
function TabNgay({ du }: { du: DuLieuEthopex }) {
  const [phim, setPhim] = useState<string[]>([]), [camp, setCamp] = useState<number[]>([]), [dang, setDang] = useState<string[]>([]), [nn, setNn] = useState<string[]>([]);
  const [goc, setGoc] = useState<'qc' | 'moi'>('qc');
  const loc = phim.length + camp.length + dang.length + nn.length > 0;
  const tenPhim = (c: CampEtp) => c.phim ?? c.ten.replace(/^(TEST )?\d{4}(ns)? /, '').split(/ (EN|ES) - /)[0]!;
  const opt = useMemo(() => {
    const dem = <K extends string | number>(f: (c: CampEtp) => K | null) => { const m = new Map<K, number>(); for (const c of du.camps) { const k = f(c); if (k != null) m.set(k, (m.get(k) ?? 0) + 1); } return m; };
    return { phim: [...dem(tenPhim)].map(([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count),
      camp: du.camps.map((c) => ({ value: c.id, label: `#${c.id} ${c.ten}` })),
      dang: [...dem((c) => dangCamp(c))].map(([value, count]) => ({ value: String(value), label: String(value), count })),
      nn: [...dem((c) => c.ngon_ngu?.toUpperCase() ?? null)].map(([value, count]) => ({ value: String(value), label: String(value), count })) };
  }, [du]); // eslint-disable-line react-hooks/exhaustive-deps
  const chon = useMemo(() => new Set(du.camps.filter((c) => (!phim.length || phim.includes(tenPhim(c))) && (!camp.length || camp.includes(c.id)) && (!dang.length || dang.includes(dangCamp(c))) && (!nn.length || nn.includes(c.ngon_ngu?.toUpperCase() ?? ''))).map((c) => c.id)), [du, phim, camp, dang, nn]); // eslint-disable-line react-hooks/exhaustive-deps
  const ngayQc = useMemo(() => {
    if (!loc) return du.theoNgay;
    const m = new Map<string, { ngay: string; chi: number; thu: number }>();
    for (const r of du.ngayCamp) if (chon.has(r.camp)) { const o = m.get(r.ngay) ?? { ngay: r.ngay, chi: 0, thu: 0 }; o.chi += r.chi; o.thu += r.thu; m.set(r.ngay, o); }
    return [...m.values()].sort((a, b) => a.ngay.localeCompare(b.ngay));
  }, [du, chon, loc]);
  const dongNgay = goc === 'moi' && !loc ? du.tienMoi.map((r) => ({ ...r, mo: !r.du })) : ngayQc.map((r, i, a) => ({ ...r, mo: i >= a.length - 2 }));
  const dd = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const tong = dongNgay.reduce((a, r) => ({ chi: a.chi + r.chi, thu: a.thu + r.thu }), { chi: 0, thu: 0 });
  const cot: DataColumn<(typeof dongNgay)[number]>[] = [
    { key: 'ngay', header: 'Ngày', align: 'left', cell: (r) => <span>{dd(r.ngay)}{r.mo ? <span style={{ color: 'var(--fg-3)' }}> · còn về thêm</span> : null}</span>, sortValue: (r) => r.ngay },
    { key: 'chi', header: 'Chi', cell: (r) => usd(r.chi), sortValue: (r) => r.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.chi, 0)) },
    { key: 'thu', header: 'Thu', cell: (r) => usd(r.thu), sortValue: (r) => r.thu, total: (rs) => usd(rs.reduce((a, r) => a + r.thu, 0)) },
    { key: 'lai', header: 'Lãi', cell: (r) => <span style={{ color: mauTien(r.thu - r.chi) }}>{usd(r.thu - r.chi)}</span>, sortValue: (r) => r.thu - r.chi, total: (rs) => { const v = rs.reduce((a, r) => a + r.thu - r.chi, 0); return <span style={{ color: mauTien(v) }}>{usd(v)}</span>; } },
    { key: 'roi', header: 'ROI', cell: (r) => pct(r.chi ? ((r.thu - r.chi) / r.chi) * 100 : null), sortValue: (r) => (r.chi ? (r.thu - r.chi) / r.chi : -1e9) },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <MultiSelect<string> label="Phim" options={opt.phim} selected={phim} onChange={setPhim} compact searchPlaceholder="Tìm phim…" />
        <MultiSelect<number> label="Camp" options={opt.camp} selected={camp} onChange={setCamp} compact searchPlaceholder="Tìm camp…" />
        <MultiSelect<string> label="Dạng" options={opt.dang} selected={dang} onChange={setDang} compact />
        <MultiSelect<string> label="Ngôn ngữ" options={opt.nn} selected={nn} onChange={setNn} compact />
        <span style={{ flex: 1 }} />
        <Segmented<'qc' | 'moi'> value={loc ? 'qc' : goc} onChange={setGoc} options={[
          { value: 'qc', label: 'Theo ngày quảng cáo', title: 'Chi / thu của các click trong ngày (Report Ethopex) — 2 ngày gần nhất doanh thu còn về thêm' },
          { value: 'moi', label: 'Tiền mới vào', title: loc ? 'Chỉ có cho tổng tài khoản — bỏ bộ lọc để xem' : 'Tiền thật vào / ra trong ngày (giờ VN), kể cả doanh thu về trễ của click cũ — đếm từ 22/10/2026' },
        ]} />
      </div>
      <StatsStrip minColWidth={110} cards={[
        { key: 'lai', label: 'Lãi cả kỳ', value: usd(tong.thu - tong.chi), color: mauTien(tong.thu - tong.chi) },
        { key: 'roi', label: 'ROI', value: pct(roi(tong)), color: mauTien(roi(tong) ?? 0) },
        { key: 'chi', label: 'Chi', value: usd(tong.chi) },
        { key: 'thu', label: 'Thu', value: usd(tong.thu) },
      ]} />
      <div style={{ margin: '10px 0' }}>
        <CotAmDuong data={dongNgay.map((r) => ({ x: dd(r.ngay), v: r.thu - r.chi, mo: r.mo, phu: `chi ${usd(r.chi)} · thu ${usd(r.thu)} · ROI ${pct(r.chi ? ((r.thu - r.chi) / r.chi) * 100 : null)}` }))} dinhDang={usd} />
      </div>
      <DataTable rows={[...dongNgay].reverse()} columns={cot} getRowKey={(r) => r.ngay} persistKey="ethopex-ngay" minWidth={520} />
    </div>
  );
}

export function EthopexView({ du }: { du: DuLieuEthopex }) {
  const modal = useModalParam('em');
  const [loc, setLoc] = useState<Loc>('all');
  const [xem, setXem] = useState<Xem>('camp');
  const router = useRouter();
  useEffect(() => { if (xem !== 'ngay') return; const t = setInterval(() => router.refresh(), 60_000); return () => clearInterval(t); }, [xem, router]);   // "realtime": làm mới mỗi phút (server nhớ 60s)
  const [hep, setHep] = useState(false);
  useEffect(() => { const mq = window.matchMedia('(max-width: 640px)'); const f = () => setHep(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  useEffect(() => { const q = new URLSearchParams(location.search); const v = q.get('etl') as Loc | null; if (v) setLoc(v); const x = q.get('etx') as Xem | null; if (x) setXem(x); }, []);
  useEffect(() => { const u = new URL(location.href); if (xem === 'camp') u.searchParams.delete('etx'); else u.searchParams.set('etx', xem); history.replaceState(history.state, '', u); }, [xem]);
  useEffect(() => { const u = new URL(location.href); if (loc === 'all') u.searchParams.delete('etl'); else u.searchParams.set('etl', loc); history.replaceState(history.state, '', u); }, [loc]);
  const dong: Dong[] = useMemo(() => {
    const soCamp = new Map<number, number>();
    for (const c of du.camps) if (c.content_id && c.trang_thai === 'ACTIVE') soCamp.set(c.content_id, (soCamp.get(c.content_id) ?? 0) + 1);   // chỉ camp ĐANG CHẠY tính vào trần phim
    return du.camps.map((c) => ({ ...c, luat: chamLuat(c, { soCampPhim: c.content_id ? soCamp.get(c.content_id) ?? 0 : 0, phimThang: !!c.content_id && du.phimThang.includes(c.content_id) }) }));
  }, [du]);
  const coCham = (d: Dong) => d.luat.some((x) => x.trang_thai === 'cham' && LUAT_THEO_MA[x.ma]!.muc !== 'bao');
  const hien = dong.filter((d) => loc === 'all' || (loc === 'chay' ? d.trang_thai === 'ACTIVE' : loc === 'tat' ? d.trang_thai !== 'ACTIVE' : coCham(d)));
  const tong = dong.reduce((a, d) => ({ chi: a.chi + d.thang.chi, thu: a.thu + d.thang.thu }), { chi: 0, thu: 0 });
  const dem = (ma: string) => dong.filter((d) => d.luat.some((x) => x.ma === ma && x.trang_thai === 'cham')).length;
  const dangMo = modal.numId ? dong.find((d) => d.id === modal.numId) : undefined;
  const phim = useMemo(() => deXuatPhim(du.camps, du.phimThang), [du]);
  const DANG: DangCr[] = ['kể chuyện', 'cảnh thật', 'cảnh cuối', 'phim dài'];
  const cotPhim: DataColumn<PhimDeXuat>[] = [
    { key: 'phim', header: 'Phim', align: 'left', cell: (p) => (p.link ? <LinkChip href={p.link} tone="neutral" size="xs" title={p.link}>{p.phim} ↗</LinkChip> : p.phim), sortValue: (p) => p.phim },
    { key: 'nn', header: 'NN', align: 'center', cell: (p) => p.ngon_ngu?.toUpperCase() ?? '—', sortValue: (p) => p.ngon_ngu ?? '' },
    { key: 'tt', header: 'Phim', align: 'center', title: `Phim thắng: tiêu ≥ $10 và ROI ≥ 50%, hoặc anh đã duyệt scale`, cell: (p) => <span style={{ color: p.thang ? MUC_MAU.len : 'var(--fg-3)' }}>{p.thang ? 'thắng' : 'test'}</span>, sortValue: (p) => (p.thang ? 1 : 0) },
    { key: 'n', header: 'Camp', cell: (p) => p.so_camp, sortValue: (p) => p.so_camp },
    { key: 'chi', header: 'Chi tháng', cell: (p) => usd(p.tong.chi), sortValue: (p) => p.tong.chi },
    { key: 'roi', header: 'ROI phim', cell: (p) => { const v = roi(p.tong); return <span style={{ color: mauTien(v ?? 0) }}>{pct(v)}</span>; }, sortValue: (p) => roi(p.tong) ?? -1e9 },
    { key: 'dang', header: 'ROI theo dạng', align: 'left', cell: (p) => (
      <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
        {DANG.filter((d) => p.theo_dang[d]).map((d) => { const s = p.theo_dang[d]!, v = roi(s); return <span key={d} title={`${d}: ${s.n} camp · chi ${usd(s.chi)} · thu ${usd(s.thu)}`} style={{ ...mono, fontSize: 10, color: mauTien(v ?? 0) }}>{d} {pct(v)}</span>; })}
      </span>) },
    { key: 'dx', header: 'Đề xuất (luật DC)', align: 'left', cell: (p) => (
      <span style={{ display: 'grid', gap: 2 }}>{p.de_xuat.map((x, i) => <span key={i} style={{ fontSize: 11, color: x.muc === 'ha' || x.muc === 'dung' ? MUC_MAU[x.muc] : 'var(--fg-1)' }}>{x.muc === 'len' ? '↑ ' : ''}{x.cau}</span>)}</span>) },
  ];

  const cot: DataColumn<Dong>[] = [
    { key: 'luat', header: 'Luật', align: 'left', width: 120, cell: (d) => <OLuat ds={d.luat} />, sortValue: (d) => (nangNhat(d.luat) ? 10 : 0) + d.luat.filter((x) => x.trang_thai === 'cham').length },
    { key: 'cr', header: 'Creative', align: 'left', width: 74, cell: (d) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={d.dang_creative ?? undefined}>
        {d.anh ? <img src={d.anh} alt="" loading="lazy" style={{ width: 22, height: 39, objectFit: 'cover', borderRadius: 2, background: 'var(--bg-2)' }} /> : <span style={{ width: 22, height: 39, display: 'inline-block', background: 'var(--bg-2)', borderRadius: 2 }} />}
        <span style={{ ...mono, color: 'var(--fg-3)' }}>#{d.creative_id ?? '—'}</span>
      </span>), sortValue: (d) => d.creative_id ?? 0 },
    { key: 'camp', header: 'Camp', align: 'left', cell: (d) => <span><span style={{ ...mono, color: 'var(--fg-3)' }}>#{d.id}</span> {d.ten}</span>, sortValue: (d) => d.id },
    { key: 'phim', header: 'Phim', align: 'left', cell: (d) => (d.link_phim ? <LinkChip href={d.link_phim} tone="neutral" size="xs" title={d.link_phim} onClick={(e) => e.stopPropagation()}>{d.phim ?? 'phim'} ↗</LinkChip> : d.phim ?? '—'), sortValue: (d) => d.phim ?? '' },
    { key: 'nn', header: 'NN', align: 'center', cell: (d) => d.ngon_ngu?.toUpperCase() ?? '—', sortValue: (d) => d.ngon_ngu ?? '' },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (d) => <span style={{ color: d.trang_thai === 'ACTIVE' ? 'var(--fg-1)' : 'var(--fg-3)' }}>{d.trang_thai === 'ACTIVE' ? 'Bật' : 'Tắt'}{d.giao ? ` · ${d.giao}` : ''}</span>, sortValue: (d) => d.trang_thai + d.giao },
    { key: 'ns', header: 'Ngân sách', cell: (d) => `$${d.ngan_sach}`, sortValue: (d) => d.ngan_sach, total: (rs) => `$${rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0)}` },
    { key: 'sp', header: 'Spending hôm nay', title: 'chi hôm nay / ngân sách ngày', cell: (d) => `${d.ngan_sach ? Math.round((d.hom_nay.chi / d.ngan_sach) * 100) : 0}%`, sortValue: (d) => (d.ngan_sach ? d.hom_nay.chi / d.ngan_sach : 0) },
    { key: 'chi', group: 'thang', header: 'Chi', cell: (d) => usd(d.thang.chi), sortValue: (d) => d.thang.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.thang.chi, 0)) },
    { key: 'thu', group: 'thang', header: 'Thu', cell: (d) => usd(d.thang.thu), sortValue: (d) => d.thang.thu, total: (rs) => usd(rs.reduce((a, r) => a + r.thang.thu, 0)) },
    { key: 'lai', group: 'thang', header: 'Lãi', cell: (d) => <span style={{ color: mauTien(d.thang.thu - d.thang.chi) }}>{usd(d.thang.thu - d.thang.chi)}</span>, sortValue: (d) => d.thang.thu - d.thang.chi,
      total: (rs) => { const v = rs.reduce((a, r) => a + r.thang.thu - r.thang.chi, 0); return <span style={{ color: mauTien(v) }}>{usd(v)}</span>; } },
    { key: 'roi', group: 'thang', header: 'ROI', cell: (d) => { const v = roi(d.thang); return <span style={{ color: mauTien(v ?? 0) }}>{pct(v)}</span>; }, sortValue: (d) => roi(d.thang) ?? -1e9 },
    { key: 'roi3', group: 'xu', header: 'ROI 3 ngày', title: '3 ngày gần nhất (giờ VN)', cell: (d) => pct(roi(d.gan)), sortValue: (d) => roi(d.gan) ?? -1e9 },
    { key: 'roi4', group: 'xu', header: 'ROI 4 ngày trước', cell: (d) => pct(roi(d.truoc)), sortValue: (d) => roi(d.truoc) ?? -1e9 },
  ];

  return (
    <div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--fg-3)', marginBottom: 10 }}>
        Số liệu sống từ Ethopex · cập nhật {truoc(du.luc)} · ROI/lãi từ đầu tháng (giờ VN) · luật chỉ báo, tăng / giảm / tắt anh duyệt từng camp
        {du.loi ? <span style={{ color: MUC_MAU.dung }}> · lỗi: {du.loi}</span> : null}
      </div>
      <StatsStrip minColWidth={hep ? 80 : 120} cards={([
        { key: 'chay', label: 'Camp đang bật', value: dong.filter((d) => d.trang_thai === 'ACTIVE').length, sub: `${dong.length} camp` },
        { key: 'chi', label: 'Chi tháng', value: usd(tong.chi) },
        { key: 'lai', label: 'Lãi tháng', value: usd(tong.thu - tong.chi), color: mauTien(tong.thu - tong.chi) },
        { key: 'roi', label: 'ROI tháng', value: pct(roi(tong)), color: mauTien(roi(tong) ?? 0) },
        { key: 'tb', label: 'Đủ đk tăng', value: dem('TB'), color: dem('TB') ? MUC_MAU.len : undefined, title: 'Luật TB — chờ anh duyệt' },
        { key: 'gb', label: 'Đủ đk giảm bậc', value: dem('GB'), color: dem('GB') ? MUC_MAU.ha : undefined, title: 'Luật GB — số trọn ngày hôm qua, nút ↘ phiên sáng' },
        { key: 'gt', label: 'Cần xem giảm/tắt', value: dem('GT'), color: dem('GT') ? MUC_MAU.ha : undefined },
        { key: 'tc', label: 'Ad bị từ chối', value: dem('TC'), color: dem('TC') ? MUC_MAU.dung : undefined },
      ] as { key: string; label: string; value: React.ReactNode; title?: string }[]).filter((c) => !hep || ['lai', 'roi', 'tb', 'gb'].includes(c.key))
        // màn hẹp (điện thoại): chỉ 4 số chính, cả dải nằm ở hover của "Lãi tháng" — để bảng còn chỗ, trang không cuộn (YDNI)
        .map((c) => (hep && c.key === 'lai' ? { ...c, title: `Camp bật ${dong.filter((d) => d.trang_thai === 'ACTIVE').length}/${dong.length} · chi tháng ${usd(tong.chi)} · cần xem giảm/tắt ${dem('GT')} · ad bị từ chối ${dem('TC')}` } : c))} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '12px 0 8px' }}>
        <Segmented<Xem> value={xem} onChange={setXem} hrefFor={(v) => `?tab=ethopex${v === 'camp' ? '' : `&etx=${v}`}`} options={[
          { value: 'camp', label: 'Camp', title: `${dong.length} camp` },
          { value: 'ngay', label: 'Theo ngày', title: 'Mỗi ngày kiếm được bao nhiêu — biểu đồ lãi, lọc theo phim / camp / dạng / ngôn ngữ, tự làm mới mỗi phút' },
          { value: 'phim', label: 'Theo phim', title: `${phim.length} phim — đề xuất dạng creative (luật DC)` },
          { value: 'cho', label: 'Hàng chờ', title: `${du.hangCho.length} phim chờ test` },
          { value: 'luat', label: 'Sổ luật', title: `${LUAT.length} luật · kb #261 mục 8–8i` },
        ]} />
        {xem === 'camp' ? <FilterChips<Loc> urlKey="etl" value={loc} onChange={setLoc}
          counts={{ all: dong.length, chay: dong.filter((d) => d.trang_thai === 'ACTIVE').length, tat: dong.filter((d) => d.trang_thai !== 'ACTIVE').length, cham: dong.filter(coCham).length }}
          options={[{ value: 'all', label: 'Tất cả' }, { value: 'chay', label: 'Đang bật' }, { value: 'tat', label: 'Đã tắt' }, { value: 'cham', label: 'Chạm luật', title: 'Có luật tăng / giảm / từ chối đang chạm' }]} /> : null}
      </div>
      <div>   {/* cuộn THEO TRANG: đầu tab trôi đi, tiêu đề bảng + thanh trang dính (DataTable mặc định, học Ethopex 22/10/2026) */}
        {xem === 'camp' ? (
          <DataTable<Dong> rows={hien} columns={cot} getRowKey={(d) => String(d.id)} persistKey="ethopex-camp" minWidth={1100} pageSize={50}
            groups={[{ key: 'thang', label: 'Từ đầu tháng' }, { key: 'xu', label: 'Xu hướng ROI' }]}
            searchText={(d) => `${d.id} ${d.ten} ${d.phim ?? ''} ${d.creative_id ?? ''}`} searchPlaceholder="Tìm camp, phim, creative…"
            onRowClick={(d) => modal.open('camp', d.id)} rowStyle={(d) => (d.trang_thai === 'ACTIVE' ? undefined : { opacity: 0.6 })} />
        ) : xem === 'ngay' ? (
          <TabNgay du={du} />
        ) : xem === 'phim' ? (
          <DataTable<PhimDeXuat> rows={phim} columns={cotPhim} getRowKey={(p) => String(p.content_id)} persistKey="ethopex-phim" minWidth={980}
            searchText={(p) => `${p.phim} ${p.content_id}`} searchPlaceholder="Tìm phim…" />
        ) : xem === 'cho' ? (
          du.hangCho.length ? du.hangCho.map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12, opacity: p.trang_thai === 'cho' ? 1 : 0.7 }}>
              <div>
                <LinkChip href={p.url} tone="neutral" size="xs" title={p.url}>{p.ten} ↗</LinkChip>{' '}
                <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>#{p.id} · {p.nguon} · {p.locale.toUpperCase()} · {p.so_page} Page / {p.so_qc} QC</span>
                <div style={{ fontSize: 11, color: p.trang_thai === 'can_xem' ? MUC_MAU.ha : 'var(--fg-3)' }}>{p.ghi}</div>
              </div>
              <span style={{ ...mono, fontSize: 10, color: p.trang_thai === 'can_xem' ? MUC_MAU.ha : 'var(--fg-2)' }}>{p.trang_thai === 'cho' ? 'chờ test' : p.trang_thai === 'can_xem' ? 'cần anh xem' : p.trang_thai === 'trung' ? 'bản trùng' : 'đề xuất'}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Không có phim chờ test</div>
        ) : (
          LUAT.map((l) => (
            <div key={l.ma} style={{ display: 'grid', gridTemplateColumns: '18px 44px 1fr', gap: 8, padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ color: 'var(--fg-2)', textAlign: 'center' }}>{l.icon}</span>
              <span style={{ ...mono, fontSize: 10, color: 'var(--fg-2)' }}>{l.ma}</span>
              <div>
                <b>{l.ten}</b> <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{l.gac === 'may' ? 'máy chặn' : 'anh duyệt'} · {l.nguon}</span>
                <div style={{ color: 'var(--fg-2)' }}>Khi {l.khi} → {l.lam}</div>
                <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>Vì sao: {l.vi}</div>
              </div>
            </div>
          ))
        )}
      </div>
      {dangMo && modal.is('camp') ? <NganCamp c={dangMo} onClose={modal.close} /> : null}
    </div>
  );
}
