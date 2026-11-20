'use client';
// NGĂN CHỌN PHIM CHO MỘT MẪU CREATIVE (anh 19/11/2026: "Bảng chọn phim đang ngu. Nhìn mỗi tên sẽ ko biết làm gì tiếp. Phải có chi tiết các cột, các thông số,
// chia nhóm… giống bên tab Phim đối thủ!! Phim nào đã có…"). Loại 'etp-mau-phim' của EtpDrawerHost (xếp chồng, URL ?ed=etp-mau-phim~<mã mẫu>), mở từ chân thẻ tab Mẫu Creative.
// Mỗi phim Âu-Mỹ: nhóm (đã có creative mẫu này / đang sinh / nhà đang chạy / đối thủ đang chạy / còn lại), thể loại, tuổi, creative mẫu / dạng / tổng, camp + ROI
// nhà / đội, QC đối thủ (ghép từ Phim đối thủ). Cột cuối: Sinh → chonPhimMau (tạo dòng phim, mọi cổng của dòng giữ nguyên). Lọc ?mpl= · nhóm theo cột Nhóm.
// ngan-moi-ok: chọn phim cho mẫu — đã tra, chưa có ngăn nào (etp-phim là chi tiết một phim, etp-dt là creative đối thủ của một phim)
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer, DataTable, FilterChips) + OCamp / ORoi / useDoiThu của Phim đối thủ
import { useEffect, useMemo, useState } from 'react';
import { DataTable, Drawer, FilterChips, type DataColumn, type DataGroup } from '@/components/ui';
import { Dem, MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { chonPhimMau, docPhimChon, type PhimChon } from '@/lib/actions/etp-mau-cr';
import { DO, Mien, OCamp, ORoi, VANG, XANH, ngayTu, useDoiThu } from './etp-doi-thu';
import type { PhimDoiThu } from '@/lib/actions/etp-doi-thu';
import { SU_KIEN_MAU } from '@/lib/etp-mau-su-kien';

type Dong = PhimChon & { dt_dang: number; dt_lau: number; nhom: string };
const NHOM = ['1 · Đã có creative mẫu này', '2 · Đang sinh / đã chọn', '3 · Nhà đang chạy — chưa có mẫu này', '4 · Đối thủ đang chạy — nhà chưa có mẫu này', '5 · Còn lại'] as const;
/** số đầu nhãn nhóm chỉ để XẾP thứ tự — trên màn bỏ đi (YDNI 9a) */
const tenNhom = (v: string, rs: unknown[]) => <span style={{ fontWeight: 600 }}>{v.replace(/^\d · /, '')} <span style={{ color: MO_SO, fontWeight: 400 }}>· {rs.length}</span></span>;
const roi = (x: { chi: number; thu: number }) => (x.chi > 0.5 ? ((x.thu - x.chi) / x.chi) * 100 : null);
type Loc = 'chua' | 'nha' | 'nha_lai' | 'doi_lai' | 'dt';
const LOC: { value: Loc; label: string; title: string; f: (p: Dong) => boolean }[] = [
  { value: 'chua', label: 'Chưa có mẫu này', title: 'phim chưa có creative nào của mẫu này và chưa đang sinh', f: (p) => !p.cr_mau && !p.da_chon },
  { value: 'nha', label: 'Nhà đang chạy', title: 'nhà có camp đang chạy', f: (p) => p.nha.dang > 0 },
  { value: 'nha_lai', label: 'Nhà lãi', title: 'ROI nhà (cả đời) ≥ 0', f: (p) => (roi(p.nha) ?? -1) >= 0 },
  { value: 'doi_lai', label: 'Đội lãi', title: 'ROI đội (cả đời) ≥ 0', f: (p) => (roi(p.doi) ?? -1) >= 0 },
  { value: 'dt', label: 'Đối thủ đang chạy', title: 'đối thủ còn QC chạy trong 2 ngày qua (kho Spy)', f: (p) => p.dt_dang > 0 },
];
const docUrl = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));
function ghiUrl(k: string, v: string | null) {
  const u = new URL(window.location.href);
  if ((u.searchParams.get(k) ?? null) === v) return;
  if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
  window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
}

// XEM "PHIM ĐỐI THỦ ĐANG CHẠY" (anh 19/11/2026: "Tao cần thấy danh sách film đối thủ đang chạy khi chọn phim!") — mặc định của ngăn: mỗi phim đối thủ còn QC chạy
// (danh sách Phim đối thủ, useDoiThu) ghép phim Ethopex cùng tên → số mẫu này / nhà / đội + nút Sinh. Phim đối thủ chưa có trên Ethopex thì không sinh được (ghi rõ).
type XemNgan = 'dt' | 'etp';
type LocDt = 'sinh' | 'co_hoi' | 'da_co';
type DongDt = PhimDoiThu & { e: Dong | null; nhom: string };
// nhóm 3 = cơ hội: đối thủ chạy mà nhà chưa từng lên camp phim — đứng trước phim nhà đã chạy
const NHOM_DT = ['1 · Đã có creative mẫu này', '2 · Đang sinh / đã chọn', '3 · Nhà chưa chạy phim — cơ hội', '4 · Nhà đã chạy phim — chưa có mẫu này', '5 · Không có trên Ethopex'] as const;

const LOC_DT: { value: LocDt; label: string; title: string; f: (p: DongDt) => boolean }[] = [
  { value: 'sinh', label: 'Sinh được', title: 'phim có trên Ethopex, chưa có creative mẫu này, chưa chọn', f: (p) => !!p.e && !p.e.cr_mau && !p.e.da_chon },
  { value: 'co_hoi', label: 'Nhà chưa chạy', title: 'đối thủ đang chạy mà nhà chưa từng lên camp phim này', f: (p) => !!p.e && !p.e.nha.tong },
  { value: 'da_co', label: 'Đã có mẫu này', title: 'nhà đã có creative của phim theo đúng mẫu này', f: (p) => !!p.e?.cr_mau },
];

export function EtpMauPhimDrawer({ ma, onClose }: { ma: string; onClose: () => void }) {
  const [du, setDu] = useState<Awaited<ReturnType<typeof docPhimChon>> | null>(null);
  const { so: dt } = useDoiThu();
  const [loc, setLoc] = useState<Loc[]>(() => (docUrl('mpl') ?? '').split(',').filter((x): x is Loc => LOC.some((l) => l.value === x)));
  const [kq, setKq] = useState<Record<number, { dang?: boolean; loi?: string; ghi?: string }>>({});
  const [locDt, setLocDt] = useState<LocDt[]>(() => (docUrl('mpd') ?? '').split(',').filter((x): x is LocDt => LOC_DT.some((l) => l.value === x)));
  useEffect(() => { ghiUrl('mpd', locDt.length ? locDt.join(',') : null); }, [locDt]);
  useEffect(() => () => ghiUrl('mpd', null), []);
  const [xem, setXem] = useState<XemNgan>(() => (docUrl('mpv') === 'etp' ? 'etp' : 'dt'));
  useEffect(() => { ghiUrl('mpv', xem === 'dt' ? null : xem); }, [xem]);
  useEffect(() => () => ghiUrl('mpv', null), []);
  useEffect(() => { ghiUrl('mpl', loc.length ? loc.join(',') : null); }, [loc]);
  useEffect(() => () => ghiUrl('mpl', null), []);
  const tai = () => docPhimChon(ma).then(setDu).catch((e: unknown) => setDu({ loi: e instanceof Error ? e.message : String(e) }));
  useEffect(() => { void tai(); }, [ma]);   // eslint-disable-line react-hooks/exhaustive-deps
  const dtTheo = useMemo(() => new Map((dt?.phim ?? []).filter((p) => p.etp).map((p) => [p.etp!.id, p])), [dt]);
  const rows: Dong[] = useMemo(() => (du && 'phim' in du ? du.phim : []).map((p) => {
    const d = dtTheo.get(p.id), dt_dang = d?.qc_dang ?? 0, dt_lau = d?.lau_nhat ?? 0;
    const nhom = p.cr_mau ? NHOM[0] : p.da_chon || p.dong_chay.some((x) => x.loai === (du && 'mau' in du ? du.mau.dong : '')) ? NHOM[1] : p.nha.dang ? NHOM[2] : dt_dang ? NHOM[3] : NHOM[4];
    return { ...p, dt_dang, dt_lau, nhom };
  })
    // thứ tự mặc định: nhóm 1 → 5 (bảng dùng chung gom nhóm theo thứ tự xuất hiện), trong nhóm chi nhà nhiều trước, rồi QC đối thủ đang chạy
    .sort((a, b) => a.nhom.localeCompare(b.nhom) || b.nha.chi - a.nha.chi || b.dt_dang - a.dt_dang), [du, dtTheo]);
  const theoId = useMemo(() => new Map(rows.map((p) => [p.id, p])), [rows]);
  const dtRows: DongDt[] = useMemo(() => (dt?.phim ?? []).filter((p) => p.qc_dang > 0).map((p) => {
    const e = p.etp ? theoId.get(p.etp.id) ?? null : null;
    const nhom = !p.etp ? NHOM_DT[4] : !e ? NHOM_DT[4] : e.cr_mau ? NHOM_DT[0] : e.nhom === NHOM[1] ? NHOM_DT[1] : e.nha.dang || e.nha.tong ? NHOM_DT[3] : NHOM_DT[2];
    return { ...p, e, nhom };
  }).sort((a, b) => a.nhom.localeCompare(b.nhom) || b.qc_dang - a.qc_dang || b.lau_nhat - a.lau_nhat), [dt, theoId]);
  const loc_ = rows.filter((p) => loc.every((k) => LOC.find((l) => l.value === k)!.f(p)));
  const dem = Object.fromEntries(LOC.map((l) => [l.value, rows.filter(l.f).length])) as Record<Loc, number>;
  const mau = du && 'mau' in du ? du.mau : null;
  const sinh = (p: Dong) => {
    if (kq[p.id]?.dang) return;
    setKq((k) => ({ ...k, [p.id]: { dang: true } }));
    void chonPhimMau(ma, p.id).then((r) => {
      setKq((k) => ({ ...k, [p.id]: 'loi' in r ? { loi: r.loi } : { ghi: r.ghi } }));
      if (!('loi' in r)) { window.dispatchEvent(new Event(SU_KIEN_MAU)); void tai(); }
    }).catch((e: unknown) => setKq((k) => ({ ...k, [p.id]: { loi: e instanceof Error ? e.message : String(e) } })));
  };
  function oSinh(p: Dong) {
    const k = kq[p.id];
    if (k?.dang) return <span style={{ color: MO_SO }}>đang gửi máy…</span>;
    if (k?.loi) return <span style={{ color: DO, fontSize: 11.5 }} title={k.loi}>✕ {k.loi}</span>;
    if (k?.ghi) return <span style={{ color: XANH, fontSize: 11.5 }} title={k.ghi}>✓ {k.ghi}</span>;
    // PHIM ĐÃ CÓ creative của mẫu (máy dựng theo mẫu): bấm THÊM BẢN = dựng một bản KHÁC — máy nhớ khung + câu nhử đã dùng, lấy khung khác cảm xúc, câu khác (anh 20/11/2026)
    if (p.da_chon && p.cr_mau && !mau?.dong && p.co_link) return <button type="button" onClick={(e) => { e.stopPropagation(); sinh(p); }} title="dựng thêm một bản khác cho phim này: khung khác (ưu tiên khác cảm xúc), câu nhử góc khác, câu đọc khác — vào hàng chờ máy dựng theo mẫu"
      style={{ fontSize: 11.5, padding: '2px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}>＋ Thêm bản</button>;
    if (p.da_chon) return <span style={{ color: MO_SO, fontSize: 11.5 }}>đã chọn cho mẫu này</span>;
    if (!p.co_link) return <span style={{ color: MO_SO, fontSize: 11.5 }} title="phim chưa có link tập trên Ethopex — máy không tải được tập để dựng; đồng bộ có link thì nút hiện lại">chưa có link tập</span>;
    return <button type="button" onClick={(e) => { e.stopPropagation(); sinh(p); }} title={mau?.dong ? 'máy dòng phim bắt đầu sinh creative theo mẫu ngay — mọi cổng soát, chấm, phanh chợ, luật lên camp giữ nguyên' : 'đưa phim vào hàng chờ máy dựng theo mẫu — hàng chờ chưa có lịch tự chạy, chỉ chạy khi được gọi'}
      style={{ fontSize: 11.5, padding: '2px 10px', borderRadius: 6, border: '1px solid var(--accent, #60a5fa)', background: 'transparent', color: 'var(--accent, #60a5fa)', cursor: 'pointer' }}>
      {mau?.dong ? 'Sinh ngay' : 'Vào hàng chờ'}</button>;
  }
  const nhomCot: DataGroup[] = [
    { key: 'mau', label: 'Mẫu này', color: '#a78bfa' }, { key: 'nha', label: 'Nhà', color: '#38bdf8' }, { key: 'doi', label: 'Đội', color: '#94a3b8' }, { key: 'dt', label: 'Đối thủ', color: '#fb923c' },
  ];
  const cot: DataColumn<Dong>[] = [
    { key: 'ten', header: 'Phim', align: 'left', width: 220, sortValue: (p) => p.ten, onCellClick: (p) => openEntityDrawer('etp-phim', p.id),
      cell: (p) => <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={`${p.ten} — bấm mở ngăn phim`}>
        {p.dt_dang >= 3 && !p.cr_mau && !p.da_chon ? <span title="đối thủ đang chạy ≥ 3 QC mà nhà chưa có mẫu này" style={{ color: VANG, fontWeight: 700 }}>★</span> : null}
        <a style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{p.ten}</a></span> },
    { key: 'tl', header: 'Thể loại', align: 'left', width: 120, sortValue: (p) => p.tl, cell: (p) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 116 }} title={p.tl ?? ''}>{p.tl ?? '—'}</span> },
    { key: 'lang', header: 'Tiếng', title: 'tiếng của phim', align: 'left', width: 50, sortValue: (p) => p.locale, cell: (p) => (p.locale ?? '?').toUpperCase() },
    { key: 'tuoi', header: 'Tuổi', title: 'số ngày từ khi phim có trang trên Ethopex', width: 66, sortValue: (p) => p.tuoi, cell: (p) => (p.tuoi == null ? <span style={{ color: MO_SO }}>—</span> : `${p.tuoi} ngày`) },
    { key: 'cr_mau', group: 'mau', header: 'Mẫu này', title: 'creative của phim dựng theo đúng mẫu này (cổng mẫu ghi từ 19/11/2026)', width: 78, sortValue: (p) => p.cr_mau, cell: (p) => (p.cr_mau ? <b style={{ color: XANH }}><Dem v={p.cr_mau} /></b> : <span style={{ color: MO_SO }}>0</span>) },
    { key: 'cr_dang', group: 'mau', header: 'Dạng', title: 'creative của phim cùng dạng với mẫu này (mọi thời)', width: 70, sortValue: (p) => p.cr_dang, cell: (p) => <Dem v={p.cr_dang} /> },
    { key: 'cr_tong', group: 'mau', header: 'Tổng', title: 'mọi creative của phim', width: 58, sortValue: (p) => p.cr_tong, cell: (p) => <Dem v={p.cr_tong} /> },
    { key: 'dong', group: 'mau', header: 'Đang sinh', title: 'số dòng phim nhà đang sinh creative cho phim này (mọi dạng)', width: 92, sortValue: (p) => p.dong_chay.length,
      cell: (p) => (p.dong_chay.length ? <Dem v={p.dong_chay.length} /> : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'nha', group: 'nha', header: 'Camp', title: 'camp nhà: đang chạy / từng lên', width: 66, sortValue: (p) => p.nha.dang * 1000 + p.nha.tong, cell: (p) => <OCamp x={p.nha} ai="Nhà" /> },
    { key: 'nha_chi', group: 'nha', header: 'Chi $', width: 56, sortValue: (p) => p.nha.chi, cell: (p) => (p.nha.chi ? p.nha.chi.toFixed(0) : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'nha_roi', group: 'nha', header: 'ROI', width: 54, sortValue: (p) => roi(p.nha), cell: (p) => <ORoi x={p.nha} /> },
    { key: 'doi', group: 'doi', header: 'Camp', title: 'camp đội: đang chạy / từng lên', width: 66, sortValue: (p) => p.doi.dang * 1000 + p.doi.tong, cell: (p) => <OCamp x={p.doi} ai="Đội" /> },
    { key: 'doi_roi', group: 'doi', header: 'ROI', width: 54, sortValue: (p) => roi(p.doi), cell: (p) => <ORoi x={p.doi} /> },
    { key: 'dt_dang', group: 'dt', header: 'Đang', title: 'QC đối thủ Spy còn thấy trong 2 ngày qua', width: 60, sortValue: (p) => p.dt_dang, cell: (p) => (p.dt_dang ? <b>{p.dt_dang}</b> : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'dt_lau', group: 'dt', header: 'Lâu', title: 'QC đối thủ chạy lâu nhất (ngày)', width: 66, sortValue: (p) => p.dt_lau, cell: (p) => (p.dt_lau ? `${p.dt_lau} ngày` : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'sinh', header: 'Sinh creative', align: 'left', width: 190, sortValue: (p) => Number(p.da_chon), cell: (p) => oSinh(p) },
  ];
  const cotDt: DataColumn<DongDt>[] = [
    { key: 'ten', header: 'Phim đối thủ', align: 'left', width: 230, sortValue: (p) => p.ten, onCellClick: (p) => openEntityDrawer('etp-dt', p.khoa),
      cell: (p) => <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={`${p.ten} — bấm xem creative đối thủ của phim`}>
        {p.qc_dang >= 3 && p.e && !p.e.cr_mau && !p.e.da_chon ? <span title="đối thủ đang chạy ≥ 3 QC, phim có trên Ethopex, nhà chưa có mẫu này" style={{ color: VANG, fontWeight: 700 }}>★</span> : null}
        <a style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{p.ten}</a></span> },
    { key: 'mien', header: 'Đối thủ', align: 'left', width: 64, sortValue: (p) => p.mien.join(','), cell: (p) => <Mien ds={p.mien} /> },
    { key: 'qc_dang', group: 'dt', header: 'Đang', title: 'QC đối thủ Spy còn thấy trong 2 ngày qua', width: 56, sortValue: (p) => p.qc_dang, cell: (p) => <b style={{ fontWeight: p.qc_dang >= 10 ? 700 : 500 }}>{p.qc_dang}</b> },
    { key: 'qc_tong', group: 'dt', header: 'Tổng', title: 'mọi QC đối thủ của phim', width: 54, sortValue: (p) => p.qc_tong, cell: (p) => <Dem v={p.qc_tong} /> },
    { key: 'lau', group: 'dt', header: 'Lâu', title: 'QC chạy lâu nhất (ngày)', width: 62, sortValue: (p) => p.lau_nhat, cell: (p) => `${p.lau_nhat} ngày` },
    { key: 'page', group: 'dt', header: 'Page', title: 'số Page đối thủ chạy phim', width: 50, sortValue: (p) => p.so_page, cell: (p) => <Dem v={p.so_page} /> },
    { key: 'tu', group: 'dt', header: 'Chạy từ', title: 'số ngày từ QC đầu tiên của đối thủ', width: 66, sortValue: (p) => ngayTu(p.bat_dau), cell: (p) => { const n = ngayTu(p.bat_dau); return n == null ? '—' : `${n} ngày`; } },
    { key: 'etp', header: 'Ethopex', align: 'left', title: 'phim cùng tên trên Ethopex — bấm mở ngăn phim', width: 70, sortValue: (p) => p.etp?.id ?? null,
      onCellClick: (p) => { if (p.etp) openEntityDrawer('etp-phim', p.etp.id); }, cell: (p) => (p.etp ? <a style={{ cursor: 'pointer' }}>#{p.etp.id}</a> : <span style={{ color: MO_SO }}>không có</span>) },
    { key: 'tl', header: 'Thể loại', align: 'left', width: 110, sortValue: (p) => p.e?.tl ?? null, cell: (p) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 106 }} title={p.e?.tl ?? ''}>{p.e?.tl ?? '—'}</span> },
    { key: 'cr_mau', group: 'mau', header: 'Mẫu này', title: 'creative nhà của phim theo đúng mẫu này', width: 66, sortValue: (p) => p.e?.cr_mau ?? null, cell: (p) => (p.e?.cr_mau ? <b style={{ color: XANH }}>{p.e.cr_mau}</b> : <span style={{ color: MO_SO }}>0</span>) },
    { key: 'cr_dang', group: 'mau', header: 'Dạng', title: 'creative nhà của phim cùng dạng', width: 54, sortValue: (p) => p.e?.cr_dang ?? null, cell: (p) => (p.e ? <Dem v={p.e.cr_dang} /> : '—') },
    { key: 'nha', group: 'nha', header: 'Camp', width: 64, sortValue: (p) => (p.e ? p.e.nha.dang * 1000 + p.e.nha.tong : null), cell: (p) => (p.e ? <OCamp x={p.e.nha} ai="Nhà" /> : '—') },
    { key: 'nha_roi', group: 'nha', header: 'ROI', width: 54, sortValue: (p) => (p.e ? roi(p.e.nha) : null), cell: (p) => (p.e ? <ORoi x={p.e.nha} /> : '—') },
    { key: 'doi', group: 'doi', header: 'Camp', width: 64, sortValue: (p) => (p.e ? p.e.doi.dang * 1000 + p.e.doi.tong : null), cell: (p) => (p.e ? <OCamp x={p.e.doi} ai="Đội" /> : '—') },
    { key: 'doi_roi', group: 'doi', header: 'ROI', width: 54, sortValue: (p) => (p.e ? roi(p.e.doi) : null), cell: (p) => (p.e ? <ORoi x={p.e.doi} /> : '—') },
    { key: 'sinh', header: 'Sinh creative', align: 'left', width: 190, sortValue: (p) => Number(!!p.e?.da_chon),
      cell: (p) => (p.e ? oSinh(p.e) : <span style={{ fontSize: 11.5, color: MO_SO }} title="phim đối thủ chưa khớp phim nào trên Ethopex (tên khác / chưa có) — không sinh được">không có trên Ethopex</span>) },
  ];
  const dau = <div className="modal-head"><div><div className="id-line">chọn phim sinh creative theo mẫu</div><h2 style={{ margin: 0 }}>{mau?.ten ?? ma}</h2>
    <div style={{ fontSize: 11.5, color: MO_SO, marginTop: 2 }}>{mau ? (mau.dong ? `dạng ${mau.dang} · bấm Sinh ngay là máy dòng phim bắt đầu làm` : 'bấm Vào hàng chờ là phim xếp hàng máy dựng theo mẫu — hàng chờ chưa có lịch tự chạy') : ''}</div></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;
  return <Drawer onClose={onClose} width={1400} padding={0}>{dau}
    <div style={{ padding: '8px 12px' }}>
      <div style={{ marginBottom: 6 }}><FilterChips<XemNgan> value={xem} onChange={setXem} urlKey="mpv" allValue="dt"
        options={[{ value: 'dt', label: `Phim đối thủ đang chạy${dt ? ` · ${dtRows.length}` : ''}`, title: 'phim đối thủ còn QC chạy trong 2 ngày qua (kho Spy) — ghép phim Ethopex cùng tên để sinh' },
          { value: 'etp', label: `Mọi phim Ethopex · ${rows.length}`, title: 'mọi phim Âu-Mỹ trên Ethopex, chia nhóm theo mẫu này / nhà / đối thủ' }]} /></div>
      {!du ? <div style={{ color: MO_SO }}>đang đọc danh sách phim…</div> : 'loi' in du ? <div style={{ color: DO }}>{du.loi}</div> : xem === 'dt' ? (!dt
        ? <div style={{ color: MO_SO }}>đang đọc danh sách phim đối thủ (kho Spy)…</div>
        : <DataTable rows={dtRows.filter((p) => locDt.every((k) => LOC_DT.find((l) => l.value === k)!.f(p)))} columns={cotDt} groups={nhomCot} groupHeader getRowKey={(p) => p.khoa} persistKey="etp-mau-phim-dt" minWidth={1250} pageSize={100} fixedLayout
            groupBy={{ value: (p) => p.nhom, label: tenNhom }} locTuDong={false}
            searchText={(p) => `${p.ten} ${p.etp?.id ?? ''} ${p.mien.join(' ')} ${p.e?.tl ?? ''}`} searchPlaceholder="Tìm phim đối thủ, mã Ethopex…"
            dauThanh={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <FilterChips<LocDt> options={LOC_DT.map(({ value, label, title }) => ({ value, label, title }))} values={locDt} onToggle={setLocDt} counts={Object.fromEntries(LOC_DT.map((l) => [l.value, dtRows.filter(l.f).length])) as Record<LocDt, number>} urlKey="mpd" />
              <span style={{ fontSize: 11.5, color: MO_SO }} title="bấm tên phim để xem creative đối thủ của phim">{dtRows.filter((p) => p.e).length}/{dtRows.length} phim có trên Ethopex</span></span>} />) :
        <DataTable rows={loc_} columns={cot} groups={nhomCot} groupHeader getRowKey={(p) => String(p.id)} persistKey="etp-mau-phim" minWidth={1250} pageSize={100} fixedLayout   /* bề rộng theo khai báo từng cột — cột Phim không nuốt chỗ của Đối thủ / Sinh */
          groupBy={{ value: (p) => p.nhom, label: tenNhom }} locTuDong={false}
          searchText={(p) => `${p.ten} ${p.id} ${p.tl ?? ''}`} searchPlaceholder="Tìm phim, mã, thể loại…"
          dauThanh={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FilterChips<Loc> options={LOC.map(({ value, label, title }) => ({ value, label, title }))} values={loc} onToggle={setLoc} counts={dem} urlKey="mpl" />
            <span style={{ fontSize: 11.5, color: MO_SO }}>{loc_.length}/{rows.length} phim{dt ? '' : ' · đang đọc số đối thủ…'}</span></span>} />}
    </div>
  </Drawer>;
}
