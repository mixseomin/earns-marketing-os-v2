// HÀM VẼ TỪNG WIDGET của outreach.on.tc (phía máy chủ). Mỗi mã trong sổ lib/outreach/so.ts có đúng MỘT hàm ở đây — kiểu Record<MaWidgetOb, Ve> bắt thiếu lúc kiểm kiểu.
// Số đọc từ lib/outreach/du-lieu.ts (React cache: cả màn chỉ hai truy vấn); nhóm trạng thái + kiểu + nguồn đọc sổ lib/outreach/kieu.ts.
// Ba widget hạ tầng thư (H2–H4) vẽ lại đúng khối Deliverability của trang chủ (cùng khối, cùng số với màn Email của /home).
// Link trong ruột widget trỏ trang MOS2 khác → khung trang mở tại chỗ (ngăn trang nhúng), không rời outreach.
// tra-repo-ok: hàm vẽ nội bộ trên primitive nhà (StatsStrip, SimpleTable, DataTable), không phải khối mã mới nhiều thao tác.
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { EmptyState, SimpleTable, StatsStrip } from '@/components/ui';
import type { MaWidgetOb } from '@/lib/outreach/so';
import { KIEU, NGUON, TT_TRA_LOI, nguonCua, ttCua, type MaKieu } from '@/lib/outreach/kieu';
import { SO_NGAY_DUNG, dangDung, docChienDich, docNguoiNhan, locDa, soNgayTu, type ChienDich } from '@/lib/outreach/du-lieu';
import { BangChienDich, BangNguoiNhan } from './bang';

const DeliverabilityCard = dynamic(() => import('@/components/deliverability-card').then((m) => m.DeliverabilityCard));

/** ngữ cảnh một lượt xem: dự án đang lọc (?da) — rỗng = mọi dự án */
export type NguOb = { da?: string };
type Ve = (n: NguOb) => ReactNode;

const MO = 'var(--fg-3)', DO = 'var(--bad, #f87171)', XANH = 'var(--neon-lime, #4ade80)', VANG = '#f59e0b';
const so = (v: number) => v.toLocaleString('vi-VN');
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a * 10 < b ? 1 : 0)}%` : '—');
const h2 = (n: number) => String(n).padStart(2, '0');
const gioVn = (s: string | null) => { if (!s) return '—'; const d = new Date(Date.parse(s) + 7 * 3600_000); return `${h2(d.getUTCHours())}:${h2(d.getUTCMinutes())} ${h2(d.getUTCDate())}/${h2(d.getUTCMonth() + 1)}`; };
const cong = (rs: ChienDich[], lay: (c: ChienDich) => number) => rs.reduce((a, c) => a + lay(c), 0);
const linkCd = (c: ChienDich) => `/p/${c.da}/outreach?c=${c.id}`;
const a = { color: 'var(--fg-1)', fontWeight: 600 } as const;
const ChuaCo = ({ da }: { da?: string }) => <EmptyState icon="✉" title={da ? `Dự án ${da} chưa có chiến dịch outreach` : 'Chưa có chiến dịch outreach nào'} description="Tạo chiến dịch trong trang outreach của dự án, nó tự hiện ở đây." compact />;

async function DaiSo({ n }: { n: NguOb }) {
  const cd = locDa(await docChienDich(), n.da), dung = cd.filter(dangDung);
  const gui = cong(cd, (c) => c.daGui), tl = cong(cd, (c) => c.traLoi), thang = cong(cd, (c) => c.thang), cho = cong(cd, (c) => c.choGui), han = cong(cd, (c) => c.toiHan);
  const cuoi = cd.map((c) => c.guiCuoi).filter((x): x is string => !!x).sort().at(-1) ?? null, nghi = soNgayTu(cuoi);
  return <StatsStrip minColWidth={128} cards={[
    { key: 'cd', label: 'Chiến dịch đang chạy', value: `${cd.filter((c) => c.chay).length}/${cd.length}`, color: dung.length ? DO : undefined, sub: dung.length ? `${dung.length} đang đứng` : `${new Set(cd.map((c) => c.da)).size} dự án`, title: 'đang chạy / tổng số chiến dịch' },
    { key: 'nn', label: 'Người nhận', value: so(cong(cd, (c) => c.n)), sub: `${so(cong(cd, (c) => c.coEmail))} có email` },
    { key: 'gui', label: 'Đã gửi', value: so(gui), sub: cuoi ? `thư gần nhất ${gioVn(cuoi)}` : 'chưa gửi thư nào', color: nghi != null && nghi > SO_NGAY_DUNG && cho + han > 0 ? VANG : undefined, title: cuoi ? `${nghi} ngày trước, giờ Việt Nam` : undefined },
    { key: 'tl', label: 'Trả lời', value: so(tl), color: tl ? XANH : undefined, sub: `${pct(tl, gui)} số thư đã gửi` },
    { key: 'thang', label: 'Thắng', value: so(thang), color: thang ? XANH : undefined, sub: `${pct(thang, gui)} số thư đã gửi`, title: 'đạt đích của kiểu chiến dịch: nhúng công cụ, đặt link, mua hàng, chốt hợp tác' },
    { key: 'cho', label: 'Chờ gửi', value: so(cho), sub: `${so(han)} thư nhắc tới hạn`, color: han ? VANG : undefined },
    { key: 'doi', label: 'Thư dội', value: so(cong(cd, (c) => c.doi)), color: cong(cd, (c) => c.doi) ? DO : undefined, sub: `${pct(cong(cd, (c) => c.doi), gui)} số thư đã gửi`, title: 'thư bị máy chủ nhận trả lại — nhiều thư dội làm hỏng uy tín domain gửi' },
  ]} />;
}

async function CanXu({ n }: { n: NguOb }) {
  const [cdAll, nn] = await Promise.all([docChienDich(), docNguoiNhan()]);
  const cd = locDa(cdAll, n.da);
  const viec: { key: string; mau: string; chu: ReactNode; phu: string }[] = [];
  for (const c of cd.filter(dangDung)) viec.push({ key: `dung${c.id}`, mau: DO, chu: <a href={linkCd(c)} style={a}>{c.ten}</a>, phu: `${c.da} · bật tự gửi, còn ${c.choGui + c.toiHan} thư chờ, ${c.guiCuoi ? `${soNgayTu(c.guiCuoi)} ngày không gửi được thư nào` : 'chưa gửi được thư nào'}` });
  for (const c of cd.filter((x) => x.chay && !x.tuEmail && x.n > 0)) viec.push({ key: `from${c.id}`, mau: VANG, chu: <a href={linkCd(c)} style={a}>{c.ten}</a>, phu: `${c.da} · chưa đặt người gửi, thư sẽ đi từ địa chỉ mặc định của máy` });
  for (const c of cd.filter((x) => x.daGui >= 20 && x.doi / x.daGui > 0.05)) viec.push({ key: `doi${c.id}`, mau: DO, chu: <a href={linkCd(c)} style={a}>{c.ten}</a>, phu: `${c.da} · ${pct(c.doi, c.daGui)} thư dội (${c.doi}/${c.daGui}), danh sách cần lọc lại` });
  for (const c of cd.filter((x) => !x.tuGui && x.toiHan > 0)) viec.push({ key: `han${c.id}`, mau: VANG, chu: <a href={linkCd(c)} style={a}>{c.ten}</a>, phu: `${c.da} · ${c.toiHan} thư nhắc tới hạn, chiến dịch gửi tay` });
  for (const p of locDa(nn.ds, n.da).filter((x) => x.tt === 'replied').slice(0, 8)) viec.push({ key: `tl${p.id}`, mau: XANH, chu: <a href={`/p/${p.da}/outreach?prospect=${p.id}`} style={a}>{p.ten}</a>, phu: `${p.da} · đã trả lời ${gioVn(p.traLoiLuc)}, chưa xếp quan tâm hay từ chối` });
  if (!viec.length) return <EmptyState icon="✓" title="Không có gì cần xử" compact />;
  return <div style={{ display: 'grid', gap: 6 }}>{viec.map((v) => (
    <div key={v.key} style={{ borderLeft: `3px solid ${v.mau}`, padding: '2px 0 2px 8px', fontSize: 12 }}>{v.chu}<div style={{ color: 'var(--fg-2)', fontSize: 11 }}>{v.phu}</div></div>))}</div>;
}

async function ChienDichBang({ n }: { n: NguOb }) {
  const cd = locDa(await docChienDich(), n.da);
  if (!cd.length) return <ChuaCo da={n.da} />;
  return <BangChienDich ds={cd} dung={cd.filter(dangDung).map((c) => c.id)} />;
}

async function PheuKieu({ n }: { n: NguOb }) {
  const cd = locDa(await docChienDich(), n.da);
  if (!cd.length) return <ChuaCo da={n.da} />;
  const rs = (Object.keys(KIEU) as MaKieu[]).map((k) => { const r = cd.filter((c) => c.kieu === k); return { k, cd: r.length, n: cong(r, (c) => c.n), cho: cong(r, (c) => c.choGui), gui: cong(r, (c) => c.daGui), tl: cong(r, (c) => c.traLoi), thang: cong(r, (c) => c.thang) }; }).filter((r) => r.cd);
  const max = Math.max(...rs.map((r) => r.gui), 1);
  return <SimpleTable rows={rs} getRowKey={(r) => r.k} columns={[
    { key: 'k', header: 'Kiểu', cell: (r) => <span title={`gửi cho: ${KIEU[r.k].nhan}\ntính thắng: ${KIEU[r.k].dich}`} style={{ fontWeight: 600 }}>{KIEU[r.k].ten}</span> },
    { key: 'cd', header: 'Chiến dịch', align: 'right', cell: (r) => r.cd },
    { key: 'cho', header: 'Chờ gửi', align: 'right', cell: (r) => so(r.cho) },
    { key: 'gui', header: 'Đã gửi', align: 'right', cell: (r) => so(r.gui) },
    { key: 'thanh', header: 'Gửi → trả lời → thắng', title: 'thanh xám = đã gửi (so với kiểu gửi nhiều nhất) · vàng = trả lời · xanh = thắng', width: '34%',
      cell: (r) => <span style={{ display: 'block', position: 'relative', height: 10, borderRadius: 3, background: 'var(--bg-2)', overflow: 'hidden' }} title={`${r.gui} đã gửi · ${r.tl} trả lời · ${r.thang} thắng`}>
        <i style={{ position: 'absolute', inset: 0, width: `${(r.gui / max) * 100}%`, background: 'var(--line)' }} /><i style={{ position: 'absolute', inset: 0, width: `${(r.tl / max) * 100}%`, background: VANG }} /><i style={{ position: 'absolute', inset: 0, width: `${(r.thang / max) * 100}%`, background: XANH }} /></span> },
    { key: 'tl', header: 'Trả lời', align: 'right', cell: (r) => <span style={{ color: r.tl ? XANH : MO }}>{r.tl} · {pct(r.tl, r.gui)}</span> },
    { key: 'thang', header: 'Thắng', align: 'right', cell: (r) => <b style={{ color: r.thang ? XANH : MO }}>{r.thang} · {pct(r.thang, r.gui)}</b> },
  ]} />;
}

async function NguoiNhanBang({ n }: { n: NguOb }) {
  const nn = await docNguoiNhan(), ds = locDa(nn.ds, n.da);
  if (!ds.length) return <EmptyState icon="👤" title={n.da ? `Dự án ${n.da} chưa có người nhận nào` : 'Chưa có người nhận nào'} compact />;
  return <BangNguoiNhan ds={ds} tong={n.da ? ds.length : nn.tong} />;
}

async function HangCho({ n }: { n: NguOb }) {
  const cd = locDa(await docChienDich(), n.da).filter((c) => c.choGui + c.toiHan > 0).sort((x, y) => y.choGui + y.toiHan - (x.choGui + x.toiHan));
  if (!cd.length) return <EmptyState icon="✓" title="Không còn thư nào chờ gửi" compact />;
  return <SimpleTable rows={cd} getRowKey={(c) => String(c.id)} columns={[
    { key: 'ten', header: 'Chiến dịch', cell: (c) => <><a href={linkCd(c)} style={a}>{c.ten}</a><span style={{ color: MO }}> · {c.da}</span></> },
    { key: 'cho', header: 'Thư đầu', align: 'right', title: 'người chưa nhận thư nào', cell: (c) => so(c.choGui) },
    { key: 'han', header: 'Thư nhắc', align: 'right', title: 'đã gửi, tới hạn nhắc mà chưa trả lời', cell: (c) => <span style={{ color: c.toiHan ? VANG : MO }}>{so(c.toiHan)}</span> },
    { key: 'cach', header: 'Sẽ đi thế nào', cell: (c) => {
      if (!c.chay) return <span style={{ color: MO }}>chiến dịch tạm dừng, không gửi</span>;
      if (!c.tuGui || !c.tran) return <span style={{ color: VANG }}>gửi tay: mở chiến dịch rồi bấm gửi từng thư</span>;
      if (dangDung(c)) return <span style={{ color: DO }}>bật tự gửi nhưng đang đứng ({c.guiCuoi ? `${soNgayTu(c.guiCuoi)} ngày` : 'chưa lần nào'} không gửi được)</span>;
      return <span>máy tự gửi mỗi ngày tối đa {c.tran} thư, hết hàng sau khoảng {Math.ceil((c.choGui + c.toiHan) / c.tran)} ngày</span>;
    } },
  ]} />;
}

async function TraLoi({ n }: { n: NguOb }) {
  const ds = locDa((await docNguoiNhan()).ds, n.da).filter((p) => p.traLoiLuc || TT_TRA_LOI.includes(p.tt)).slice(0, 40);
  if (!ds.length) return <EmptyState icon="✉" title="Chưa có ai trả lời" description="Người nhận trả lời thư thì hiện ở đây, mới nhất trước." compact />;
  return <SimpleTable rows={ds} getRowKey={(p) => String(p.id)} columns={[
    { key: 'ten', header: 'Người trả lời', cell: (p) => <><a href={`/p/${p.da}/outreach?prospect=${p.id}`} style={a}>{p.ten || p.email}</a>{p.congTy ? <span style={{ color: MO }}> · {p.congTy}</span> : null}</> },
    { key: 'tt', header: 'Kết quả', cell: (p) => <span style={{ color: ttCua(p.tt).mau }}>{ttCua(p.tt).ten}</span> },
    { key: 'cd', header: 'Chiến dịch', cell: (p) => <span style={{ color: 'var(--fg-2)' }}>{p.cdTen ?? '—'} · {p.da}</span> },
    { key: 'luc', header: 'Lúc', align: 'right', title: 'giờ Việt Nam', cell: (p) => gioVn(p.traLoiLuc) },
  ]} />;
}

async function SoKieu() {
  const cd = await docChienDich();
  const rs = (Object.keys(KIEU) as MaKieu[]).map((k) => ({ k, ...KIEU[k], soCd: cd.filter((c) => c.kieu === k).length, gui: cong(cd.filter((c) => c.kieu === k), (c) => c.daGui) }));
  return <SimpleTable rows={rs} getRowKey={(r) => r.k} columns={[
    { key: 'ten', header: 'Kiểu', cell: (r) => <b>{r.ten}</b> },
    { key: 'nhan', header: 'Gửi cho ai', cell: (r) => r.nhan },
    { key: 'dich', header: 'Tính thắng khi', cell: (r) => r.dich },
    { key: 'nguon', header: 'Nguồn hợp', cell: (r) => <span style={{ color: 'var(--fg-2)' }}>{r.nguon.map((x) => nguonCua(x).ten).join(' · ')}</span> },
    { key: 'cd', header: 'Chiến dịch', align: 'right', cell: (r) => <span style={{ color: r.soCd ? undefined : MO }}>{r.soCd}</span> },
    { key: 'gui', header: 'Đã gửi', align: 'right', cell: (r) => <span style={{ color: r.gui ? undefined : MO }}>{so(r.gui)}</span> },
  ]} />;
}

async function NguonNhan() {
  const nn = (await docNguoiNhan()).ds;
  const ma = [...new Set([...Object.keys(NGUON), ...nn.map((p) => p.nguon)])];
  const rs = ma.map((k) => { const r = nn.filter((p) => p.nguon === k); return { k, ...nguonCua(k), n: r.length, tl: r.filter((p) => p.traLoiLuc || TT_TRA_LOI.includes(p.tt)).length, gui: r.filter((p) => p.guiLuc).length }; });
  return <SimpleTable rows={rs} getRowKey={(r) => r.k} columns={[
    { key: 'ten', header: 'Nguồn', cell: (r) => <><b>{r.ten}</b><div style={{ color: 'var(--fg-2)', fontSize: 11 }}>{r.moTa}</div></> },
    { key: 'noi', header: 'Máy nạp', cell: (r) => (r.noi ? <span style={{ color: XANH }}>đã nối</span> : <span style={{ color: VANG }} title="Sổ đã khai nguồn này, bộ nạp người nhận chưa dựng">chưa nối</span>) },
    { key: 'n', header: 'Người nhận', align: 'right', cell: (r) => <span style={{ color: r.n ? undefined : MO }}>{so(r.n)}</span> },
    { key: 'tl', header: 'Trả lời', align: 'right', cell: (r) => <span style={{ color: r.tl ? XANH : MO }}>{r.tl} · {pct(r.tl, r.gui)}</span> },
  ]} />;
}

async function DuongGui({ n }: { n: NguOb }) {
  const cd = locDa(await docChienDich(), n.da);
  if (!cd.length) return <ChuaCo da={n.da} />;
  const coKhoa = !!(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET);
  return (<>
    <div style={{ fontSize: 11, color: coKhoa ? 'var(--fg-2)' : DO, marginBottom: 6 }} role={coKhoa ? undefined : 'alert'}>
      {coKhoa ? 'Thư outreach hiện đi qua một cổng gửi duy nhất của máy chủ; người gửi lấy theo chiến dịch.' : 'Máy chủ chưa có khoá cổng gửi thư: bấm gửi ở chiến dịch nào cũng sẽ bị từ chối.'}
    </div>
    <SimpleTable rows={cd} getRowKey={(c) => String(c.id)} rowStyle={(c) => (dangDung(c) ? { background: 'rgba(248,113,113,0.08)' } : undefined)} columns={[
      { key: 'ten', header: 'Chiến dịch', cell: (c) => <><a href={linkCd(c)} style={a}>{c.ten}</a><span style={{ color: MO }}> · {c.da}</span></> },
      { key: 'tu', header: 'Người gửi', cell: (c) => (c.tuEmail ? <span title={c.tuTen ?? undefined}>{c.tuTen ? `${c.tuTen} · ` : ''}{c.tuEmail}</span> : <span style={{ color: VANG }}>chưa đặt</span>) },
      { key: 'cach', header: 'Cách gửi', cell: (c) => (c.tuGui ? `tự gửi · ${c.tran}/ngày` : 'gửi tay') },
      { key: 'gui', header: 'Đã gửi', align: 'right', cell: (c) => so(c.daGui) },
      { key: 'doi', header: 'Thư dội', align: 'right', cell: (c) => <span style={{ color: c.doi ? DO : MO }}>{c.doi}</span> },
      { key: 'cuoi', header: 'Gửi cuối', align: 'right', title: 'giờ Việt Nam', cell: (c) => gioVn(c.guiCuoi) },
      { key: 'ket', header: 'Thư đang kẹt', align: 'right', title: 'thư chờ + thư nhắc tới hạn của chiến dịch đang đứng', cell: (c) => (dangDung(c) ? <b style={{ color: DO }}>{so(c.choGui + c.toiHan)}</b> : <span style={{ color: MO }}>0</span>) },
    ]} />
  </>);
}

export const VE_OB: Record<MaWidgetOb, Ve> = {
  T1: (n) => <DaiSo n={n} />,
  T2: (n) => <CanXu n={n} />,
  C1: (n) => <ChienDichBang n={n} />,
  C2: (n) => <PheuKieu n={n} />,
  N1: (n) => <NguoiNhanBang n={n} />,
  N2: (n) => <HangCho n={n} />,
  N3: (n) => <TraLoi n={n} />,
  K1: () => <SoKieu />,
  K2: () => <NguonNhan />,
  H1: (n) => <DuongGui n={n} />,
  H2: () => <DeliverabilityCard chi="table" />,
  H3: () => <DeliverabilityCard chi="warmup" />,
  H4: () => <DeliverabilityCard chi="seed" />,
};
