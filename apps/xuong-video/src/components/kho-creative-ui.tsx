'use client';
// KHO CREATIVE THEO SẢN PHẨM (kho-creative.ts) — tab 📦 Sản phẩm trên trang chủ → ngăn một sản phẩm, 6 tab cố định:
// Creative (bảng, gom / lọc / chọn → so cạnh nhau) · Bản đồ (loại góc × dòng khuôn, mở ma trận góc × khuôn) · Góc (cây loại › góc › creative)
// · Thành phần (mỗi loại một bảng: dùng ở bao nhiêu creative) · Lô sinh · Kết quả. Nhãn chỉ ghi tên, số ở hover (YDNI luật 3).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable, type DataColumn } from '@mos2/bang/data-table';
import { Ngan } from './ngan';
import { Seg, Pill, LinkNgoai, Nut, Loi, mono } from './ui';
import { useNho } from './nho';
import { docKhoSanPham, dsGocSpy, docCumGoc, dsLo, themLo, boLo, giaTriSanPham, taoPhimTuLo, type KhoSanPham, type LoSinh } from '@/lib/actions';
import { TaoTuTemplate } from './template-ui';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { LOAI_GOC_SPY, loaiGocSpy, linkGocSpy, linkSpSpy, type GocSpy } from '@/lib/xuong-video/goc-spy';
import { COT_DONG, COT_KHUON, LOAI_THANH_PHAN, banDo, dongCua, oMaTran, cumCua, type CumGoc, type DongCreative, type ThanhPhan } from '@/lib/xuong-video/kho-creative';
import { nhomPhim, tongSanPham, type TongSanPham, type SoLieuQc } from '@/lib/xuong-video/nhom-phim';
import { DONG_TEMPLATE, tien, type Phim } from '@/lib/xuong-video/kieu';
import { KhoCreative } from './kho-concept-ui';
import { docKhoConcept, type KhoConcept } from '@/lib/actions-concept';
import { soLieuQcSong, type SoLieuSong } from '@/lib/actions-ethopex';

// 4 tab đầu = kho creative theo CONCEPT (kho-concept-ui.tsx, 17/10/2026): Concept → Template → Phương án → Đề xuất; "Đã làm" = creative đã thành phim
// Tab đầu = BẢNG CREATIVE duy nhất + bộ lọc (kho-concept-ui.tsx › KhoCreative, anh 17/10/2026); concept / template / phương án nằm trong ⚙ Cấu hình của nó
type TabSp = 'kho' | 'creative' | 'ban_do' | 'goc' | 'thanh_phan' | 'lo' | 'ket_qua';
const TAB_SP: { value: TabSp; label: string }[] = [
  { value: 'kho', label: 'Creative' }, { value: 'creative', label: 'Đã làm' }, { value: 'goc', label: 'Góc' }, { value: 'thanh_phan', label: 'Thành phần' },
];
// ẨN (anh 17/10/2026 "ẩn đi, không hiện thừa"): Bản đồ + Lô sinh trùng việc với Template / Đề xuất; Kết quả chưa có số liệu. Mã + dữ liệu xv_lo giữ nguyên.
const tenKhuon = (c: Pick<DongCreative, 'tpl'>) => (c.tpl ? DONG_TEMPLATE.find((d) => d.key === c.tpl!.dong)?.khuon.find((k) => k.key === c.tpl!.khuon)?.ten ?? c.tpl.khuon : 'Ngoài template');

/** Danh sách sản phẩm (tab 📦 Sản phẩm): mỗi sản phẩm một dòng, bấm mở ngăn. Nhóm theo sản phẩm của phim QC (nhom-phim.ts › sanPhamPhim). */

/** Tên ngắn của creative trong ngăn sản phẩm: bỏ "Ethopex · <phim> · " (đã ở tiêu đề ngăn) — còn "Cảnh thật 84–141s (lô 2010)" / "QC kể chuyện (lô 19/10)". */
const tenNgan = (c: Pick<DongCreative, 'ten'>): string => { const p = c.ten.split(' · '); return p.length >= 3 ? p.slice(2).join(' · ') : c.ten.replace(/^[^·]*·\s*/, ''); };
/** Số liệu QC của creative: sống (Ethopex, lúc mở ngăn) nếu có, không thì bản chụp trong kinh_thanh. */
const soLieuCr = (c: Pick<DongCreative, 'etp'>, song: SoLieuSong | null): SoLieuQc | null =>
  c.etp?.creative_id && song ? (song.theo_creative[c.etp.creative_id] ?? null) : (c.etp?.so_lieu ?? null);
/** Kéo số liệu QC sống từ Ethopex (actions-ethopex.ts) khi mở; làm mới tay; đồng hồ "bao lâu rồi" tự chạy. */
function useSoLieuSong() {
  const [data, setData] = useState<SoLieuSong | null>(null); const [loi, setLoi] = useState(''); const [dang, setDang] = useState(false); const [, nhip] = useState(0);
  const tai = async () => { setDang(true); const r = await soLieuQcSong(); setDang(false); if (r.ok) { setData(r.data); setLoi(''); } else setLoi(r.loi); };
  useEffect(() => { void tai(); const t = setInterval(() => nhip((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  return { data, loi, dang, tai };
}
/** "x phút trước" (giờ VN cho mốc tuyệt đối ở hover). */
export const truoc = (iso: string | null | undefined): string => {
  if (!iso) return '—'; const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? 'vừa xong' : s < 3600 ? `${Math.floor(s / 60)} phút trước` : s < 86400 ? `${Math.floor(s / 3600)} giờ ${Math.floor((s % 3600) / 60)} phút trước` : `${Math.floor(s / 86400)} ngày trước`;
};
const gioVn = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
/** Dòng mốc cập nhật số liệu QC — dùng ở bảng Sản phẩm và ngăn sản phẩm. */
function MocSoLieu({ s }: { s: ReturnType<typeof useSoLieuSong> }) {
  return <span style={{ ...mono, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
    {s.data ? <>
      <span title={`Kéo trực tiếp từ Ethopex lúc ${gioVn(s.data.luc)} · khoảng ${s.data.khoang}`}>Số liệu QC (từ đầu tháng) cập nhật <b>{truoc(s.data.luc)}</b></span>
      <span title={`Ethopex đồng bộ chi tiêu Facebook lần cuối lúc ${gioVn(s.data.ethopex_dong_bo)}`}>· Ethopex đồng bộ Facebook {truoc(s.data.ethopex_dong_bo)}</span>
    </> : s.loi ? <span style={{ color: 'var(--red, #f85149)' }}>Không kéo được số liệu sống: {s.loi} — đang hiện bản chụp</span> : <span>Đang kéo số liệu QC từ Ethopex…</span>}
    <Nut ban={s.dang} onClick={() => void s.tai()}>{s.dang ? 'Đang kéo…' : '↻ Làm mới'}</Nut>
  </span>;
}

const LOAI_CR: Record<string, string> = { qc_canh_that: 'cảnh thật', qc_ke_chuyen: 'kể chuyện AI', qc_nhan_vat: 'nhân vật AI' };
const usd = (x: number) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`;
/** Danh sách sản phẩm = BẢNG QUẢN LÝ (anh 20/10/2026: "page này phải show đủ thông tin để quản lý, mỗi cái tên thì xem gì"): mỗi sản phẩm một dòng —
 *  creative (đủ nấc / kẹt), loại, camp (kể cả nhân bản), chi / thu / lãi / ROI QC (dong-bo-so-lieu.sh), chi phí sản xuất, lần sửa. Bấm dòng = mở ngăn sản phẩm. */
export function DanhSachSanPham({ phim, onMo }: { phim: Phim[]; onMo: (key: string) => void }) {
  const song = useSoLieuSong();
  const ds = useMemo(() => nhomPhim(phim, { kieu: 'quang_cao' }).filter((g) => g.key.startsWith('sp:')).map((g) => tongSanPham(g, song.data?.theo_creative ?? null)), [phim, song.data]);
  if (!ds.length) return <div className="xv-panel" style={mono}>Chưa có creative quảng cáo nào gắn sản phẩm (ô Sản phẩm + link trang bán ở tab 🎭 Phim của phim QC).</div>;
  const mau = (x: number) => (x > 0 ? 'var(--green, #3fb950)' : x < 0 ? 'var(--red, #f85149)' : 'var(--fg-2)');
  const cot: DataColumn<TongSanPham>[] = [
    { key: 'ten', header: 'Sản phẩm', align: 'left', sortValue: (s) => s.ten, cellTitle: (s) => `${s.ten}${s.khoang ? ` · số liệu QC: ${s.khoang}` : ''}`, cell: (s) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ flex: '0 0 auto', width: 26, height: 38, borderRadius: 3, border: '1px solid var(--line)', background: s.anh ? `center / cover no-repeat url(${anhNho(s.anh, 160)}), #111` : 'var(--bg-2)' }} />
        <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ten}</b>
      </span>) },
    { key: 'nguon', header: 'Nguồn', width: 90, align: 'left', sortValue: (s) => s.nguon, cell: (s) => s.nguon || '—' },
    { key: 'nn', header: 'NN', width: 52, align: 'center', sortValue: (s) => s.ngon_ngu.join(), cell: (s) => <Pill color="var(--cyan)">{s.ngon_ngu.join(' ')}</Pill> },
    { key: 'cr', header: 'Creative', title: 'Tổng creative · đủ nấc (mọi cảnh có hình + clip) · kẹt', width: 120, align: 'right', sortValue: (s) => s.so_creative,
      cellTitle: (s) => `${s.so_creative} creative · ${s.du} đủ nấc · ${s.ket} kẹt`,
      cell: (s) => <span>{s.so_creative} <span style={{ color: 'var(--fg-2)' }}>· {s.du} đủ</span>{s.ket > 0 && <span style={{ color: 'var(--red, #f85149)' }}> · {s.ket} kẹt</span>}</span> },
    { key: 'loai', header: 'Loại', width: 190, align: 'left', sortValue: (s) => s.loai.qc_canh_that ?? 0, cellTitle: (s) => Object.entries(s.loai).map(([k, v]) => `${v} ${LOAI_CR[k] ?? k}`).join('\n'),
      cell: (s) => <span style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Object.entries(s.loai).map(([k, v]) => `${v} ${LOAI_CR[k] ?? k}`).join(' · ')}</span> },
    { key: 'camp', header: 'Camp', title: 'Camp Ethopex đang gắn creative của sản phẩm (kể cả nhân bản) · số camp đang lãi', width: 90, align: 'right', sortValue: (s) => s.so_camp,
      cell: (s) => <span>{s.so_camp}{s.camp_lai > 0 && <span style={{ color: 'var(--green, #3fb950)' }}> · {s.camp_lai} lãi</span>}</span> },
    { key: 'chi', header: 'Chi QC', width: 80, align: 'right', sortValue: (s) => s.chi, cell: (s) => usd(s.chi) },
    { key: 'thu', header: 'Thu', width: 80, align: 'right', sortValue: (s) => s.thu, cell: (s) => usd(s.thu) },
    { key: 'lai', header: 'Lãi', width: 80, align: 'right', sortValue: (s) => s.lai, cell: (s) => <b style={{ color: mau(s.lai) }}>{usd(s.lai)}</b> },
    { key: 'roi', header: 'ROI', width: 70, align: 'right', sortValue: (s) => s.roi ?? -1e9, cell: (s) => (s.roi == null ? '—' : <b style={{ color: mau(s.roi) }}>{s.roi}%</b>) },
    { key: 'sx', header: 'Chi SX', title: 'Chi phí sản xuất creative trong studio (ảnh, video, giọng)', width: 80, align: 'right', sortValue: (s) => s.chi_sx_cents, cell: (s) => tien(s.chi_sx_cents) },
    { key: 'sua', header: 'Cập nhật', width: 100, align: 'right', sortValue: (s) => s.cap_nhat,
      cell: (s) => (s.cap_nhat ? new Date(s.cap_nhat).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—') },
  ];
  const khoang = ds.find((s) => s.khoang)?.khoang;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <MocSoLieu s={song} />
      {!song.data && khoang && <span style={mono} title="Bản chụp ghi bằng scripts/ethopex/dong-bo-so-lieu.sh">Bản chụp: {khoang}</span>}
      <DataTable rows={[...ds].sort((a, b) => b.lai - a.lai)} columns={cot} getRowKey={(s) => s.key} onRowClick={(s) => onMo(s.key.slice(3))} fixedLayout stickyFirst={false} minWidth={1180} persistKey="xv-ds-san-pham" />
    </div>
  );
}

/** Ngăn một sản phẩm. onMoPhim = mở ngăn phim (chồng lên). */
export function NganSanPham({ spKey, onClose, onMoPhim, onMoTemplate }: { spKey: string; onClose: () => void; onMoPhim: (id: number) => void; onMoTemplate: () => void }) {
  const [d, setD] = useState<KhoSanPham | null>(null);
  const [loi, setLoi] = useState('');
  const [goc, setGoc] = useState<(GocSpy & { so_nhac: number })[]>([]);
  const [tab, setTab] = useNho<TabSp>('xv-sp-tab', 'kho', TAB_SP.map((t) => t.value), 'sptab');
  const [kc, setKc] = useState<KhoConcept | null>(null);
  const [kcLoi, setKcLoi] = useState('');
  const taiKc = async () => { const r = await docKhoConcept(spKey); if (r.ok) { setKc(r.data); setKcLoi(''); } else setKcLoi(r.loi); };
  const [chon, setChon] = useState<number[]>([]);
  const [soSanh, setSoSanh] = useState(false);
  const [locGoc, setLocGoc] = useState<number | null>(null);
  const [lo, setLo] = useState<LoSinh[]>([]);
  const [cum, setCum] = useState<{ cum: CumGoc[]; nguon: string } | null>(null);
  const taiLo = async () => { const r = await dsLo(spKey); if (r.ok) setLo(r.data); };
  const taiKho = async () => { const r = await docKhoSanPham(spKey); if (r.ok) setD(r.data); else setLoi(r.loi); };
  const song = useSoLieuSong();
  useEffect(() => { void taiKho(); void taiLo(); void taiKc(); }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (d?.sp.spy) { void dsGocSpy(d.sp.spy).then((r) => r.ok && setGoc(r.data)); void docCumGoc(d.sp.spy).then((r) => r.ok && setCum(r.data)); } }, [d?.sp.spy]);
  const moGoc = (id: number) => { setLocGoc(id); setTab('creative'); };
  if (loi) return <Ngan onClose={onClose}><Loi>{loi}</Loi></Ngan>;
  if (!d) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  return (
    <Ngan onClose={onClose} tieuDe={`📦 ${d.sp.ten}`} nut={<>
      {d.sp.spy && <LinkNgoai href={linkSpSpy(d.sp.spy)} className="xv-lienket xv-mono" title="Mở nhóm góc của sản phẩm trên spy.on.tc (tab mới)">góc trên spy ↗</LinkNgoai>}
      {d.sp.link && <LinkNgoai href={d.sp.link} className="xv-lienket xv-mono" title={d.sp.link}>trang bán ↗</LinkNgoai>}
    </>} dau={<Seg options={TAB_SP} value={tab} onChange={setTab} />}>
      {tab === 'kho' && (kc ? <KhoCreative d={kc} spKey={spKey} phim={d.creative} onDoi={async () => { await taiKc(); await taiKho(); }} onMoPhim={onMoPhim} /> : <Loi>{kcLoi}</Loi>)}
      {tab === 'creative' && <MocSoLieu s={song} />}
      {tab === 'creative' && <BangCreative song={song.data} d={d} goc={goc} cum={cum?.cum ?? []} locGoc={locGoc} setLocGoc={setLocGoc} chon={chon} setChon={setChon} onMoPhim={onMoPhim} onSoSanh={() => setSoSanh(true)} />}
      {tab === 'ban_do' && <BanDo d={d} goc={goc} lo={lo} spKey={spKey} onLo={taiLo} onMoPhim={onMoPhim} onMoGoc={moGoc} />}
      {tab === 'goc' && <CayGoc d={d} goc={goc} cum={cum} onMoPhim={onMoPhim} onMoGoc={moGoc} />}
      {tab === 'thanh_phan' && <ThuVienThanhPhan tp={d.thanh_phan} onMoPhim={onMoPhim} />}
      {tab === 'lo' && <LoSinhTab spKey={spKey} lo={lo} onDoi={async () => { await taiLo(); await taiKho(); }} onMoPhim={onMoPhim} onMoBanDo={() => setTab('ban_do')} onMoTemplate={onMoTemplate} />}
      {tab === 'ket_qua' && <Trong tieu="Chưa có số liệu quảng cáo" chu="Studio chưa nhận chi / đơn của quảng cáo đang chạy, nên chưa biết creative, góc hay thành phần nào thắng." />}
      {soSanh && <SoSanh ds={d.creative.filter((c) => chon.includes(c.id))} tp={d.thanh_phan} onClose={() => setSoSanh(false)} onMoPhim={onMoPhim} />}
    </Ngan>
  );
}

function Trong({ tieu, chu, nut }: { tieu: string; chu: string; nut?: ReactNode }) {
  return <div style={{ padding: '28px 12px', textAlign: 'center', display: 'grid', gap: 6, justifyItems: 'center' }}><b>{tieu}</b><span style={{ ...mono, maxWidth: 520 }}>{chu}</span>{nut}</div>;
}

/** Ảnh nhỏ + 5 nấc sản xuất (màu = trạng thái, số ở hover). */
function NacSx({ c }: { c: DongCreative }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title={c.nac.map((x) => `${x.ten}: ${x.key === 'kich_ban' || x.key === 'xuat' ? (x.tt === 'xong' ? 'có' : 'chưa') : `${x.so}/${x.tong}`}`).join(' · ')}>
      {c.nac.map((x) => <i key={x.key} style={{ width: 13, height: 7, borderRadius: 2, background: x.tt === 'xong' ? '#4ade80' : x.tt === 'dang' ? 'var(--amber)' : 'var(--line)' }} />)}
      <span style={{ ...mono, marginLeft: 5 }}>{c.ket}</span>
    </span>
  );
}
const ChipGoc = ({ g, on }: { g: GocSpy; on?: () => void }) => (
  <button type="button" onClick={on} title={`${loaiGocSpy(g.loai).ten}: ${g.ten} · bấm để lọc theo góc này`}
    style={{ all: 'unset', cursor: 'pointer', fontSize: 11, padding: '0 6px', borderRadius: 4, border: '1px solid var(--cyan)', color: 'var(--cyan)', maxWidth: 'calc(100% - 30px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }}>{loaiGocSpy(g.loai).ic} {g.ten}</button>
);

type Gom = 'khong' | 'loai' | 'cum' | 'khuon';
const diemSx = (c: DongCreative) => c.nac.filter((x) => x.tt === 'xong').length;
function BangCreative({ song, d, goc, cum, locGoc, setLocGoc, chon, setChon, onMoPhim, onSoSanh }: { song: SoLieuSong | null; d: KhoSanPham; goc: GocSpy[]; cum: CumGoc[]; locGoc: number | null; setLocGoc: (x: number | null) => void; chon: number[]; setChon: (x: number[]) => void; onMoPhim: (id: number) => void; onSoSanh: () => void }) {
  const [gom, setGom] = useNho<Gom>('xv-sp-gom', 'loai', ['khong', 'loai', 'cum', 'khuon']);
  const [tim, setTim] = useState('');
  // Lọc góc + ô tìm áp TRƯỚC khi gom: mọi nhóm cùng một bộ lọc (mỗi nhóm là một DataTable — ô tìm riêng từng bảng thì lọc lệch nhau).
  const ds = useMemo(() => {
    const t = tim.trim().toLowerCase();
    return d.creative.filter((c) => (locGoc == null || c.goc.some((g) => g.id === locGoc)) && (!t || [c.ten, c.hook, c.cta, ...c.goc.map((g) => g.ten)].some((x) => x.toLowerCase().includes(t))))
      .sort((a, b) => b.sua_luc.localeCompare(a.sua_luc));
  }, [d.creative, locGoc, tim]);
  const nhom: { ten: string; ds: DongCreative[] }[] = gom === 'khong' ? [{ ten: '', ds }]
    : gom === 'khuon' ? [...new Set(ds.map(tenKhuon))].map((k) => ({ ten: k, ds: ds.filter((c) => tenKhuon(c) === k) }))
    : gom === 'cum' ? [...cum.map((c) => c.ten), 'Chưa vào cụm'].map((t) => ({ ten: `🧩 ${t}`, ds: ds.filter((c) => c.goc.some((g) => (cumCua(g.id, cum) ?? 'Chưa vào cụm') === t)) })).filter((x) => x.ds.length)
    : [...LOAI_GOC_SPY.map((l) => ({ ten: `${l.ic} ${l.ten}`, ds: ds.filter((c) => c.goc.some((g) => g.loai === l.key)) })),
      // creative KHÔNG có góc spy vẫn phải hiện (20/10/2026: gom theo loại góc làm mất hết creative phim → bảng trống)
      { ten: '🎬 QC gốc của app', ds: ds.filter((c) => !c.goc.length && !!c.etp?.nguon_qc) },
      { ten: '📖 Cốt truyện phim', ds: ds.filter((c) => !c.goc.length && !!c.etp && !c.etp.nguon_qc) },
      { ten: 'Chưa gắn góc', ds: ds.filter((c) => !c.goc.length && !c.etp) }].filter((x) => x.ds.length);
  const gocLoc = locGoc != null ? (goc.find((g) => g.id === locGoc) ?? d.creative.flatMap((c) => c.goc).find((g) => g.id === locGoc)) : null;
  const doi = (id: number) => setChon(chon.includes(id) ? chon.filter((x) => x !== id) : [...chon, id]);
  // Cột dùng chung cho mọi nhóm; bảng cố định bề rộng cột (fixedLayout) để các bảng nhóm xếp chồng thẳng cột với nhau.
  const cot = (tenNhom: string): DataColumn<DongCreative>[] => [
    { key: 'chon', header: '', width: 30, align: 'center', cell: (c) => <input type="checkbox" checked={chon.includes(c.id)} onChange={() => doi(c.id)} onClick={(e) => e.stopPropagation()} aria-label={`chọn #${c.id}`} /> },
    { key: 'ten', header: 'Creative', width: '22%', align: 'left', sortValue: (c) => c.ten, cell: (c) => (
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <span style={{ width: 22, height: 32, flexShrink: 0, borderRadius: 3, border: '1px solid var(--line)', background: c.anh ? `center / cover no-repeat url(${anhNho(c.anh, 160)}), #111` : 'var(--bg-2)' }} />
        <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{tenNgan(c)}</b>
        {c.sua_sau_xuat && <span style={{ color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 4, padding: '0 4px' }} title="Có shot sửa sau lần xuất gần nhất — bản xuất đang dùng đã cũ">sửa sau xuất</span>}
      </span>), cellTitle: (c) => `#${c.id} · ${c.ten} · ${c.so_shot} shot${c.xuat ? ' · đã xuất' : ''}` },
    { key: 'goc', header: 'Góc', width: '17%', align: 'left', sortValue: (c) => c.goc[0]?.ten ?? c.etp?.nguon_qc ?? null, cell: (c) => {
      // Creative phim (Ethopex) chưa có góc spy kiểu shop: góc = QC gốc của app mà creative cắt từ đó (Thư viện QC Meta) + đoạn cắt
      if (!c.goc.length && c.etp?.nguon_qc) return <a href={`https://www.facebook.com/ads/library/?id=${c.etp.nguon_qc}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
        title={`QC gốc của app (Thư viện QC Meta #${c.etp.nguon_qc})${c.etp.doan ? ` · đoạn cắt ${c.etp.doan}` : ''}`} style={{ fontSize: 11, color: 'var(--cyan)' }}>🎬 QC gốc{c.etp.doan ? ` · ${c.etp.doan}` : ''}</a>;
      if (!c.goc.length && c.etp) return <span style={{ fontSize: 11 }} title="Kể lại theo cốt truyện chính thức của phim (QC kể chuyện / nhân vật AI)">📖 cốt truyện phim</span>;
      const chinh = (gom === 'loai' ? c.goc.find((x) => `${loaiGocSpy(x.loai).ic} ${loaiGocSpy(x.loai).ten}` === tenNhom) : null) ?? c.goc[0];
      const phu = c.goc.filter((x) => x !== chinh);
      return <>{chinh ? <ChipGoc g={chinh} on={() => setLocGoc(chinh.id)} /> : 'chưa gắn'}{phu.length > 0 && <span style={{ marginLeft: 4 }} title={phu.map((x) => `${loaiGocSpy(x.loai).ic} ${x.ten}`).join('\n')}>+{phu.length}</span>}</>;
    } },
    // Bấm khuôn = mở ĐÚNG template đó (góp ý #1400) — onCellClick chặn lan lên hàng, không mở phim creative chồng lên
    { key: 'khuon', header: 'Khuôn', width: 150, align: 'left', sortValue: tenKhuon, onCellClick: (c) => { if (c.tpl) onMoPhim(c.tpl.id); },
      cell: (c) => <Pill color="var(--fg-2)" title={`${tenKhuon(c)}${c.tpl ? ` · template #${c.tpl.id} · bấm để mở template` : ' · không tạo từ template'}`}>{tenKhuon(c)}</Pill> },
    { key: 'hook', header: 'Hook', align: 'left', sortValue: (c) => c.hook, cell: (c) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.hook || '—'}</span>, cellTitle: (c) => c.hook },
    { key: 'cta', header: 'CTA', width: '12%', align: 'left', sortValue: (c) => c.cta, cell: (c) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.cta || '—'}</span>, cellTitle: (c) => c.cta },
    { key: 'camp', header: 'Camp', title: 'Camp Ethopex đang dùng creative này (gốc + nhân bản) — xanh = đang lãi', width: 150, align: 'left', sortValue: (c) => c.etp?.camp.length ?? 0, cell: (c) => {
      const sl = soLieuCr(c, song); const ds = c.etp?.camp ?? [];
      if (!c.etp) return <span style={{ color: 'var(--fg-2)' }}>chưa lên</span>;
      return <span style={{ fontSize: 11.5, display: 'flex', flexWrap: 'wrap', whiteSpace: 'normal', lineHeight: 1.35 }}>{ds.length ? ds.map((id) => { const x = sl?.camp?.find((k) => k.id === id); return <span key={id} title={x ? `#${id} · budget $${x.budget} · spending ${x.spending ?? '—'}% · chi $${x.chi?.toFixed(2)} · thu $${x.thu?.toFixed(2)} · ROI ${x.roi ?? '—'}%` : `#${id}`}
        style={{ marginRight: 4, color: (x?.lai ?? 0) > 0 ? 'var(--green, #3fb950)' : (x?.lai ?? 0) < 0 ? 'var(--red, #f85149)' : 'var(--fg-1)' }}>#{id}{x && x.budget !== 1 ? ` $${x.budget}` : ''}</span>; }) : `creative #${c.etp.creative_id}`}</span>;
    } },
    { key: 'lai', header: 'Lãi · ROI', title: 'Lãi và ROI cộng các camp của creative (số liệu sống từ Ethopex, từ đầu tháng)', width: 110, align: 'right', sortValue: (c) => soLieuCr(c, song)?.lai ?? -1e9, cell: (c) => {
      const sl = soLieuCr(c, song); if (!sl || !sl.chi) return '—';
      const roi = Math.round(((sl.thu! - sl.chi) / sl.chi) * 1000) / 10; const m = sl.lai! > 0 ? 'var(--green, #3fb950)' : 'var(--red, #f85149)';
      return <span title={`chi $${sl.chi.toFixed(2)} · thu $${sl.thu!.toFixed(2)}`}><b style={{ color: m }}>{sl.lai! < 0 ? '−' : ''}${Math.abs(sl.lai!).toFixed(2)}</b> <span style={{ color: m }}>{roi}%</span></span>;
    } },
    { key: 'nn', header: 'NN', title: 'Ngôn ngữ của lời / chữ màn (kinh thánh)', width: 46, align: 'center', sortValue: (c) => c.ngon_ngu, cell: (c) => <Pill color="var(--cyan)">{c.ngon_ngu.toUpperCase()}</Pill> },
    { key: 'sx', header: 'Sản xuất', title: 'Bấm tiêu đề để xếp theo số bước đã xong', width: 205, align: 'left', sortValue: diemSx, cell: (c) => <NacSx c={c} /> },
  ];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={mono}>Gom</span><Seg options={[{ value: 'loai' as Gom, label: 'Loại góc' }, ...(cum.length ? [{ value: 'cum' as Gom, label: 'Cụm người mua' }] : []), { value: 'khuon' as Gom, label: 'Khuôn' }, { value: 'khong' as Gom, label: 'Không' }]} value={gom} onChange={setGom} />
        <input className="xv-in" style={{ width: 200 }} value={tim} onChange={(e) => setTim(e.target.value)} placeholder="🔍 tên, hook, CTA, góc…" />
        {gocLoc && <Pill color="var(--cyan)" title="Bỏ lọc góc"><button type="button" onClick={() => setLocGoc(null)} style={{ all: 'unset', cursor: 'pointer' }}>{loaiGocSpy(gocLoc.loai).ic} {gocLoc.ten} ✕</button></Pill>}
      </div>
      {!ds.length && <div style={{ ...mono, padding: 10, border: '1px solid var(--line)', borderRadius: 8 }}>Không có creative khớp bộ lọc.</div>}
      {nhom.map((g) => (
        <div key={g.ten || 'tat_ca'} style={{ display: 'grid', gap: 4 }}>
          {g.ten && <b style={{ fontSize: 12.5 }} title={`${g.ds.length} creative`}>{g.ten}</b>}
          <DataTable rows={g.ds} columns={cot(g.ten)} getRowKey={(c) => `${g.ten}-${c.id}`} onRowClick={(c) => onMoPhim(c.id)} fixedLayout stickyFirst={false} minWidth={1100}
            persistKey="xv-sp-creative" rowStyle={(c) => (chon.includes(c.id) ? { background: 'color-mix(in srgb, var(--cyan) 8%, transparent)' } : undefined)} />
        </div>
      ))}
      {chon.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', border: '1px solid var(--cyan)', borderRadius: 8 }}>
          <b style={{ fontSize: 12 }} title={chon.map((x) => `#${x}`).join(' ')}>Đã chọn</b>
          <Nut chinh ly={(chon.length < 2 || chon.length > 4) && 'chọn 2–4 creative để so'} onClick={onSoSanh}>So cạnh nhau</Nut>
          <Nut onClick={() => setChon([])}>Bỏ chọn</Nut>
        </div>
      )}
    </div>
  );
}

function BanDo({ d, goc, lo, spKey, onLo, onMoPhim, onMoGoc }: { d: KhoSanPham; goc: (GocSpy & { so_nhac: number })[]; lo: LoSinh[]; spKey: string; onLo: () => Promise<void>; onMoPhim: (id: number) => void; onMoGoc: (id: number) => void }) {
  const bd = banDo(d.creative);
  const [bao, setBao] = useState('');
  const trongLo = (gid: number, k: { dong: string; khuon: string }) => lo.some((l) => l.trang_thai === 'cho' && l.dong === k.dong && l.khuon === k.khuon && l.goc.some((g) => g.id === gid));
  // Ô trống → thêm vào lô sinh (0đ, chỉ là kế hoạch); tạo phim ở tab Lô sinh.
  const them = async (g: GocSpy, k: { dong: string; khuon: string; ten: string }) => { const r = await themLo(spKey, g, k.dong, k.khuon); setBao(r.ok ? `Đã thêm vào lô: ${g.ten} × ${k.ten}` : r.loi); if (r.ok) await onLo(); };
  const [mo, setMo] = useState<string | null>(null);
  const [het, setHet] = useState(false);
  const cot = COT_DONG.filter((c) => c.key !== 'ngoai' || d.creative.some((x) => dongCua(x) === 'ngoai'));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* ma trận bung NGAY DƯỚI hàng loại góc vừa bấm (góp ý #1401 — trước đây vẽ dưới cả bảng, xa chỗ bấm) */}
      <DataTable rows={LOAI_GOC_SPY} getRowKey={(l) => l.key} onRowClick={(l) => setMo(mo === l.key ? null : l.key)} minWidth={560}
        renderExpanded={(l) => (mo === l.key ? maTran(l.key) : null)}
        rowStyle={(l) => (mo === l.key ? { background: 'color-mix(in srgb, var(--cyan) 8%, transparent)' } : undefined)}
        columns={[
          { key: 'loai', header: 'Loại góc', align: 'left', cell: (l) => <b>{mo === l.key ? '▾' : '▸'} {l.ic} {l.ten}</b>, cellTitle: (l) => `${goc.filter((g) => g.loai === l.key).length} góc trên spy · bấm để mở ma trận góc × khuôn` },
          ...cot.map((c): DataColumn<(typeof LOAI_GOC_SPY)[number]> => ({ key: c.key, header: c.ten, sortValue: (l) => (bd[l.key]?.[c.key] ?? []).length,
            cell: (l) => { const ids = bd[l.key]?.[c.key] ?? []; return <b style={{ color: ids.length ? 'var(--fg-1)' : 'var(--fg-4)' }}>{ids.length}</b>; },
            cellTitle: (l) => { const ids = bd[l.key]?.[c.key] ?? []; return ids.length ? ids.map((x) => `#${x}`).join(' ') + ' (một creative gắn nhiều góc nên có thể ở nhiều hàng)' : 'chưa có creative'; } })),
        ]} />
    </div>
  );
  function maTran(mo: string) {
        // Góc ĐÃ có creative lên đầu (không thì góc dùng nhiều nhất có thể rơi khỏi 12 dòng đầu), rồi theo lượt nhắc.
        const coCr = (id: number) => d.creative.some((c) => c.goc.some((x) => x.id === id));
        const ds = goc.filter((g) => g.loai === mo).sort((a, b) => Number(coCr(b.id)) - Number(coCr(a.id)) || b.so_nhac - a.so_nhac);
        const hien = het ? ds : ds.slice(0, 12);
        const cotK = COT_KHUON.filter((k) => k.dong !== 'ngoai' || d.creative.some((x) => dongCua(x) === 'ngoai'));
        return (
          <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            {!ds.length && <div style={{ ...mono, padding: 10 }}>Chưa tải được góc từ spy cho loại này.</div>}
            {/* Ma trận góc × khuôn: mỗi DÒNG khuôn là một nhóm cột (bật / tắt ở ⚙ Columns của DataTable). */}
            {ds.length > 0 && <DataTable rows={hien} getRowKey={(g) => String(g.id)} minWidth={240 + cotK.length * 26}
              groups={COT_DONG.filter((c) => cotK.some((k) => k.dong === c.key)).map((c) => ({ key: c.key, label: c.ten }))}
              columns={[
                { key: 'goc', header: 'Góc', align: 'left', width: 260, sortValue: (g) => g.ten, cell: (g) => <button type="button" onClick={() => onMoGoc(g.id)} style={{ all: 'unset', cursor: 'pointer' }}>{g.ten}</button>, cellTitle: (g) => `${g.so_nhac} lượt nhắc${g.mo_ta ? ` · ${g.mo_ta}` : ''}` },
                ...cotK.map((k): DataColumn<(typeof hien)[number]> => ({ key: `${k.dong}.${k.khuon}`, group: k.dong, header: k.ngan, title: k.ten, align: 'center', width: 26,
                  sortValue: (g) => oMaTran(d.creative, g.id, k).length,
                  cell: (g) => { const ids = oMaTran(d.creative, g.id, k); const cho = !ids.length && trongLo(g.id, k); const themDuoc = !ids.length && !cho && k.dong !== 'ngoai'; return (
                    <button type="button" disabled={!ids.length && !themDuoc} onClick={(e) => { e.stopPropagation(); if (ids[0]) onMoPhim(ids[0]); else if (themDuoc) void them(g, k); }}
                      title={ids.length ? ids.map((x) => `#${x}`).join(' ') : cho ? `${g.ten} × ${k.ten}: trong lô sinh, chờ tạo phim` : themDuoc ? `${g.ten} × ${k.ten}: trống · bấm để thêm vào lô sinh` : 'trống'}
                      style={{ all: 'unset', cursor: ids.length || themDuoc ? 'pointer' : 'default', display: 'inline-block', width: 12, height: 12, borderRadius: 2, border: `1px solid ${cho ? 'var(--amber)' : 'var(--line)'}`, background: ids.length ? 'var(--lime)' : cho ? 'color-mix(in srgb, var(--amber) 45%, transparent)' : 'transparent' }} />); } })),
              ]} />}
            <div style={{ ...mono, padding: '6px 8px' }}>Ô xanh = đã có creative (bấm mở) · ô vàng = trong lô sinh · ô trống bấm để thêm vào lô sinh{bao && <b style={{ marginLeft: 8, color: 'var(--fg-1)' }}>{bao}</b>}</div>
            {ds.length > 12 && <button type="button" className="xv-lienket xv-mono" style={{ margin: 8 }} onClick={() => setHet(!het)} title={`${ds.length} góc`}>{het ? '▴ chỉ góc nhiều lượt nhắc' : '▾ hiện hết góc'}</button>}
          </div>
        );
  }
}

function CayGoc({ d, goc, cum, onMoPhim, onMoGoc }: { d: KhoSanPham; goc: (GocSpy & { so_nhac: number })[]; cum: { cum: CumGoc[]; nguon: string } | null; onMoPhim: (id: number) => void; onMoGoc: (id: number) => void }) {
  const [het, setHet] = useState(false);
  const [cheDo, setCheDo] = useNho<'loai' | 'cum'>('xv-sp-cay', 'loai', ['loai', 'cum']);
  const ds = goc.length ? goc : d.creative.flatMap((c) => c.goc.map((g) => ({ ...g, so_nhac: 0 })));
  const theo = (id: number) => d.creative.filter((c) => c.goc.some((g) => g.id === id));
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Seg options={[{ value: 'loai' as const, label: 'Theo loại góc' }, { value: 'cum' as const, label: 'Theo cụm người mua', title: cum ? cum.nguon : 'chưa gom cụm cho nhóm spy này' }]} value={cheDo} onChange={setCheDo} />
        <button type="button" className="xv-lienket xv-mono" onClick={() => setHet(!het)}>{het ? '▴ chỉ góc đã có creative' : '▾ hiện cả góc chưa có creative'}</button>
      </span>
      {cheDo === 'cum' && (!cum ? <span style={mono}>Nhóm spy này chưa gom cụm người mua (scripts/cum-goc.mts ghi cụm sau khi đọc tên + nhãn review của từng góc).</span>
        : [...cum.cum, { ten: 'Chưa vào cụm', mo_ta: '', goc: ds.map((g) => g.id).filter((id) => !cumCua(id, cum.cum)) }].map((c) => {
          const gl = [...new Map(ds.filter((g) => c.goc.includes(g.id)).map((g) => [g.id, g])).values()];
          const co = gl.filter((g) => d.creative.some((x) => x.goc.some((y) => y.id === g.id)));
          if (!gl.length) return null;
          return (
            <details key={c.ten} open={co.length > 0 || het}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }} title={`${gl.length} góc · ${gl.reduce((a, g) => a + g.so_nhac, 0)} lượt nhắc${c.mo_ta ? ` · ${c.mo_ta}` : ''}`}>🧩 {c.ten}{!co.length && <span style={{ ...mono, marginLeft: 8, color: 'var(--amber)' }}>chưa có creative</span>}</summary>
              <div style={{ paddingLeft: 10, borderLeft: '1px solid var(--line)', display: 'grid', gap: 3, margin: '4px 0 6px 12px' }}>
                {(het ? gl : gl.filter((g) => d.creative.some((x) => x.goc.some((y) => y.id === g.id))).concat(co.length ? [] : gl.slice(0, 3))).map((g) => { const cr = d.creative.filter((x) => x.goc.some((y) => y.id === g.id)); return (
                  <div key={g.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', color: cr.length ? undefined : 'var(--fg-4)' }}>
                    <span title={loaiGocSpy(g.loai).ten}>{loaiGocSpy(g.loai).ic}</span>
                    <button type="button" onClick={() => onMoGoc(g.id)} title={`${g.so_nhac} lượt nhắc · bấm để lọc bảng creative`} style={{ all: 'unset', cursor: 'pointer' }}>{g.ten}</button>
                    <LinkNgoai href={linkGocSpy(g)} className="xv-lienket xv-mono" title="Bằng chứng của góc trên spy (tab mới)">spy ↗</LinkNgoai>
                    {cr.map((x) => <button key={x.id} type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(x.id)} title={x.ten}>#{x.id}</button>)}
                  </div>); })}
              </div>
            </details>
          );
        }))}
      {cheDo === 'loai' && LOAI_GOC_SPY.map((l) => {
        const gl = [...new Map(ds.filter((g) => g.loai === l.key).map((g) => [g.id, g])).values()];
        const co = gl.filter((g) => theo(g.id).length);
        return (
          <details key={l.key} open={co.length > 0}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }} title={`${gl.length} góc · ${co.length} góc có creative`}>{l.ic} {l.ten}</summary>
            <div style={{ marginLeft: 12, paddingLeft: 10, borderLeft: '1px solid var(--line)', display: 'grid', gap: 3, margin: '4px 0 6px 12px' }}>
              {(het ? gl : co).map((g) => { const cr = theo(g.id); return (
                <div key={g.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', color: cr.length ? undefined : 'var(--fg-4)' }}>
                  <button type="button" onClick={() => onMoGoc(g.id)} title={`${g.so_nhac} lượt nhắc · ${cr.length} creative · bấm để lọc bảng creative`} style={{ all: 'unset', cursor: 'pointer' }}>{g.ten}</button>
                  <LinkNgoai href={linkGocSpy(g)} className="xv-lienket xv-mono" title="Bằng chứng của góc trên spy (tab mới)">spy ↗</LinkNgoai>
                  {cr.map((c) => <button key={c.id} type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(c.id)} title={c.ten}>#{c.id}</button>)}
                </div>); })}
              {!het && !co.length && <span style={mono}>chưa góc nào có creative</span>}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function ThuVienThanhPhan({ tp, onMoPhim }: { tp: ThanhPhan[]; onMoPhim: (id: number) => void }) {
  const [loai, setLoai] = useNho<string>('xv-sp-tp', 'hook', LOAI_THANH_PHAN.map((l) => l.key));
  const ds = tp.filter((t) => t.loai === loai);
  const lop = (nhom: 'chu' | 'hinh') => LOAI_THANH_PHAN.filter((l) => l.nhom === nhom).map((l) => ({ value: l.key, label: l.ten, title: `${tp.filter((t) => t.loai === l.key).length} thành phần` }));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={mono}>Lời / chữ</span><Seg options={lop('chu')} value={loai} onChange={setLoai} /></span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={mono}>Hình / tiếng</span><Seg options={lop('hinh')} value={loai} onChange={setLoai} /></span>
      </div>
      <DataTable key={loai} rows={ds} getRowKey={(t, i) => `${loai}-${i}`} minWidth={720} searchText={(t) => `${t.noi_dung} ${t.phu}`} searchPlaceholder="lọc thành phần…"
        columns={[
          { key: 'nd', header: 'Nội dung', align: 'left', sortValue: (t) => t.noi_dung, cell: (t) => <span style={{ whiteSpace: 'normal' }}>{t.noi_dung}</span> },
          { key: 'phu', header: 'Hình / mô tả', align: 'left', cell: (t) => <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', maxWidth: 300 }}>{t.phu || '—'}</span>, cellTitle: (t) => t.phu },
          { key: 'dung', header: 'Dùng ở', align: 'left', sortValue: (t) => t.dung_o.length, cellTitle: (t) => `${t.dung_o.length} creative${t.co_media ? ` · ${t.co_media} lần có hình / clip sẵn` : ''}`,
            cell: (t) => <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{t.dung_o.map((x) => <button key={x} type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(x)}>#{x}</button>)}</span> },
        ]} />
    </div>
  );
}

/** So 2–4 creative theo từng thành phần; ô khác nhau tô vàng. Ngăn chồng lên ngăn sản phẩm. */
function SoSanh({ ds, tp, onClose, onMoPhim }: { ds: DongCreative[]; tp: ThanhPhan[]; onClose: () => void; onMoPhim: (id: number) => void }) {
  const cua = (id: number, loai: string) => tp.filter((t) => t.loai === loai && t.dung_o.includes(id)).map((t) => t.noi_dung).join(' · ') || '—';
  const hang: [string, (c: DongCreative) => string][] = [
    ['Góc', (c) => c.goc.map((g) => g.ten).join(' · ') || '—'], ['Khuôn', tenKhuon], ['Hook', (c) => c.hook || '—'], ['CTA', (c) => c.cta || '—'], ['Ngôn ngữ', (c) => c.ngon_ngu.toUpperCase()],
    ...LOAI_THANH_PHAN.filter((l) => !['hook', 'cta'].includes(l.key)).map((l) => [l.ten, (c: DongCreative) => cua(c.id, l.key)] as [string, (c: DongCreative) => string]),
    ['Sản xuất', (c) => c.ket],
  ];
  return (
    <Ngan onClose={onClose} tieuDe="So cạnh nhau">
      {/* Mỗi DÒNG một thành phần, mỗi CỘT một creative; dòng có ô khác nhau tô vàng. */}
      <DataTable rows={hang} getRowKey={([ten]) => ten} minWidth={160 + 220 * ds.length}
        rowStyle={([, f]) => (new Set(ds.map(f)).size > 1 ? { background: 'color-mix(in srgb, var(--amber) 16%, transparent)' } : undefined)}
        columns={[
          { key: 'tp', header: 'Thành phần', align: 'left', cell: ([ten]) => ten },
          ...ds.map((c): DataColumn<(typeof hang)[number]> => ({ key: String(c.id), align: 'left', title: c.ten, cell: ([, f]) => <span style={{ whiteSpace: 'normal', display: 'block', maxWidth: 280 }}>{f(c)}</span>,
            header: <button type="button" onClick={() => onMoPhim(c.id)} style={{ all: 'unset', cursor: 'pointer', color: 'var(--cyan)', display: 'grid', gap: 4, justifyItems: 'start', textTransform: 'none' }} title={c.ten}>
              {/* Ảnh đại diện của creative (#1396) — cùng ảnh cột hình ở bảng Creative; rê để phóng to. */}
              {c.anh ? <img src={anhNho(c.anh, 160)} alt="" style={{ width: 54, height: 96, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--line)' }} /> : <span style={{ width: 54, height: 96, borderRadius: 4, border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', fontSize: 14, color: 'var(--fg-4)' }}>🎬</span>}
              #{c.id}</button> })),
        ]} />
    </Ngan>
  );
}

/** Tab Lô sinh: các ô góc × khuôn đã chọn ở ma trận (Bản đồ) → tạo phim từ template (0đ, chưa sinh gì), ô sản phẩm điền sẵn từ creative cùng
 *  sản phẩm, góc của ô gắn vào phim mới. Bỏ = đổi trạng thái (không xoá dòng). */
function LoSinhTab({ spKey, lo, onDoi, onMoPhim, onMoBanDo, onMoTemplate }: { spKey: string; lo: LoSinh[]; onDoi: () => Promise<void>; onMoPhim: (id: number) => void; onMoBanDo: () => void; onMoTemplate: () => void }) {
  const [tao, setTao] = useState<LoSinh | null>(null);
  const [gtDau, setGtDau] = useState<Record<string, string>>({});
  const [hienBo, setHienBo] = useState(false);
  useEffect(() => { void giaTriSanPham(spKey).then((r) => r.ok && setGtDau(r.data)); }, [spKey]);
  const ds = lo.filter((l) => hienBo || l.trang_thai !== 'bo');
  const kh = (l: LoSinh) => DONG_TEMPLATE.find((d) => d.key === l.dong)?.khuon.find((k) => k.key === l.khuon)?.ten ?? l.khuon;
  if (!lo.length) return <Trong tieu="Lô sinh trống" chu="Mở tab Bản đồ, bấm một loại góc để mở ma trận góc × khuôn, rồi bấm ô trống để đưa ô đó vào lô. Mỗi dòng lô tạo thành một phim từ template (0đ)." nut={<span style={{ display: 'flex', gap: 6 }}><Nut chinh onClick={onMoBanDo}>Mở Bản đồ</Nut><Nut onClick={onMoTemplate}>🧩 Template</Nut></span>} />;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={mono}>Mỗi dòng = một ô góc × khuôn chờ thành phim. Tạo phim là chép template + điền ô (0đ), chưa sinh hình / giọng.</span>
        {lo.some((l) => l.trang_thai === 'bo') && <label style={{ ...mono, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={hienBo} onChange={(e) => setHienBo(e.target.checked)} />hiện dòng đã bỏ</label>}
      </span>
      <DataTable rows={ds} getRowKey={(l) => String(l.id)} minWidth={720} rowStyle={(l) => (l.trang_thai === 'bo' ? { opacity: 0.5 } : undefined)}
        columns={[
          { key: 'goc', header: 'Góc', align: 'left', sortValue: (l) => l.goc[0]?.ten ?? null, cell: (l) => <>{l.goc.map((g) => <span key={g.id} title={loaiGocSpy(g.loai).ten}>{loaiGocSpy(g.loai).ic} {g.ten}</span>)}</> },
          { key: 'khuon', header: 'Khuôn', align: 'left', sortValue: kh, cell: (l) => <Pill color="var(--fg-2)">{kh(l)}</Pill> },
          { key: 'tpl', header: 'Template', align: 'left', cell: (l) => (l.template_id ? `#${l.template_id}` : '—'), cellTitle: (l) => l.template_ten },
          { key: 'tt', header: 'Trạng thái', align: 'left', sortValue: (l) => l.trang_thai, cellTitle: (l) => new Date(l.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            cell: (l) => (l.trang_thai === 'da_tao' && l.phim_id ? <button type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(l.phim_id!)}>đã tạo #{l.phim_id}</button> : l.trang_thai === 'bo' ? 'đã bỏ' : 'chờ tạo') },
          { key: 'lam', header: '', align: 'left', cell: (l) => (l.trang_thai === 'cho' ? <span style={{ display: 'inline-flex', gap: 6 }}><Nut chinh onClick={() => setTao(l)}>Tạo phim</Nut><Nut onClick={async () => { await boLo(l.id); await onDoi(); }}>Bỏ</Nut></span> : null) },
        ]} />
      {tao && tao.template_id && (
        <TaoTuTemplate templateId={tao.template_id} tenTemplate={tao.template_ten} gtDau={gtDau} onClose={() => setTao(null)}
          taoBang={(ten, gt) => taoPhimTuLo(tao.id, ten, gt)}
          dauNgan={<div style={{ ...mono, marginBottom: 8, color: 'var(--fg-1)' }}>Lô sinh · góc {tao.goc.map((g) => `${loaiGocSpy(g.loai).ic} ${g.ten}`).join(', ')} · ô sản phẩm đã điền sẵn từ creative cùng sản phẩm; câu chuyện viết theo góc này.</div>}
          onTao={async (id) => { setTao(null); await onDoi(); onMoPhim(id); }} />
      )}
    </div>
  );
}
