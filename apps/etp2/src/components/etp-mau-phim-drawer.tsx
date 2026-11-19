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
import { DO, OCamp, ORoi, VANG, XANH, useDoiThu } from './etp-doi-thu';
import { SU_KIEN_MAU } from '@/lib/etp-mau-su-kien';

type Dong = PhimChon & { dt_dang: number; dt_lau: number; nhom: string };
const NHOM = ['1 · Đã có creative mẫu này', '2 · Đang sinh / đã chọn', '3 · Nhà đang chạy — chưa có mẫu này', '4 · Đối thủ đang chạy — nhà chưa có mẫu này', '5 · Còn lại'] as const;
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

export function EtpMauPhimDrawer({ ma, onClose }: { ma: string; onClose: () => void }) {
  const [du, setDu] = useState<Awaited<ReturnType<typeof docPhimChon>> | null>(null);
  const { so: dt } = useDoiThu();
  const [loc, setLoc] = useState<Loc[]>(() => (docUrl('mpl') ?? '').split(',').filter((x): x is Loc => LOC.some((l) => l.value === x)));
  const [kq, setKq] = useState<Record<number, { dang?: boolean; loi?: string; ghi?: string }>>({});
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
  const nhomCot: DataGroup[] = [
    { key: 'mau', label: 'Mẫu này', color: '#a78bfa' }, { key: 'nha', label: 'Nhà', color: '#38bdf8' }, { key: 'doi', label: 'Đội', color: '#94a3b8' }, { key: 'dt', label: 'Đối thủ', color: '#fb923c' },
  ];
  const cot: DataColumn<Dong>[] = [
    { key: 'ten', header: 'Phim', align: 'left', width: 260, sortValue: (p) => p.ten, onCellClick: (p) => openEntityDrawer('etp-phim', p.id),
      cell: (p) => <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }} title={`${p.ten} · phim #${p.id} — bấm mở ngăn phim`}>
        {p.dt_dang >= 3 && !p.cr_mau && !p.da_chon ? <span title="đối thủ đang chạy ≥ 3 QC mà nhà chưa có mẫu này" style={{ color: VANG, fontWeight: 700 }}>★</span> : null}
        <a style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{p.ten}</a></span> },
    { key: 'tl', header: 'Thể loại', align: 'left', width: 130, sortValue: (p) => p.tl, cell: (p) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={p.tl ?? ''}>{p.tl ?? '—'}</span> },
    { key: 'lang', header: 'Tiếng', align: 'left', sortValue: (p) => p.locale, cell: (p) => (p.locale ?? '?').toUpperCase() },
    { key: 'tuoi', header: 'Tuổi', title: 'số ngày từ khi phim có trang trên Ethopex', sortValue: (p) => p.tuoi, cell: (p) => (p.tuoi == null ? <span style={{ color: MO_SO }}>—</span> : `${p.tuoi} ngày`) },
    { key: 'cr_mau', group: 'mau', header: 'Creative mẫu', title: 'creative của phim dựng theo đúng mẫu này (cổng mẫu ghi từ 19/11/2026)', sortValue: (p) => p.cr_mau, cell: (p) => (p.cr_mau ? <b style={{ color: XANH }}><Dem v={p.cr_mau} /></b> : <span style={{ color: MO_SO }}>0</span>) },
    { key: 'cr_dang', group: 'mau', header: 'Cùng dạng', title: 'creative của phim cùng dạng với mẫu này (mọi thời)', sortValue: (p) => p.cr_dang, cell: (p) => <Dem v={p.cr_dang} /> },
    { key: 'cr_tong', group: 'mau', header: 'Tổng cr', title: 'mọi creative của phim', sortValue: (p) => p.cr_tong, cell: (p) => <Dem v={p.cr_tong} /> },
    { key: 'dong', group: 'mau', header: 'Dòng chạy', align: 'left', title: 'dòng phim đang chạy (mã loại · số dòng) — bấm mở ngăn phim', sortValue: (p) => p.dong_chay.length,
      cell: (p) => (p.dong_chay.length ? <span style={{ fontSize: 11 }}>{p.dong_chay.map((x) => `${x.loai} #${x.id}`).join(' · ')}</span> : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'nha', group: 'nha', header: 'Camp', title: 'camp nhà: đang chạy / từng lên', sortValue: (p) => p.nha.dang * 1000 + p.nha.tong, cell: (p) => <OCamp x={p.nha} ai="Nhà" /> },
    { key: 'nha_chi', group: 'nha', header: 'Chi $', sortValue: (p) => p.nha.chi, cell: (p) => (p.nha.chi ? p.nha.chi.toFixed(0) : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'nha_roi', group: 'nha', header: 'ROI', sortValue: (p) => roi(p.nha), cell: (p) => <ORoi x={p.nha} /> },
    { key: 'doi', group: 'doi', header: 'Camp', title: 'camp đội: đang chạy / từng lên', sortValue: (p) => p.doi.dang * 1000 + p.doi.tong, cell: (p) => <OCamp x={p.doi} ai="Đội" /> },
    { key: 'doi_roi', group: 'doi', header: 'ROI', sortValue: (p) => roi(p.doi), cell: (p) => <ORoi x={p.doi} /> },
    { key: 'dt_dang', group: 'dt', header: 'QC chạy', title: 'QC đối thủ Spy còn thấy trong 2 ngày qua', sortValue: (p) => p.dt_dang, cell: (p) => (p.dt_dang ? <b>{p.dt_dang}</b> : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'dt_lau', group: 'dt', header: 'Lâu nhất', title: 'QC đối thủ chạy lâu nhất (ngày)', sortValue: (p) => p.dt_lau, cell: (p) => (p.dt_lau ? `${p.dt_lau} ngày` : <span style={{ color: MO_SO }}>—</span>) },
    { key: 'sinh', header: 'Sinh creative', align: 'left', width: 230, sortValue: (p) => Number(p.da_chon),
      cell: (p) => { const k = kq[p.id];
        if (k?.dang) return <span style={{ color: MO_SO }}>đang tạo dòng…</span>;
        if (k?.loi) return <span style={{ color: DO, fontSize: 11.5 }} title={k.loi}>✕ {k.loi}</span>;
        if (k?.ghi) return <span style={{ color: XANH, fontSize: 11.5 }} title={k.ghi}>✓ {k.ghi}</span>;
        if (p.da_chon) return <span style={{ color: MO_SO, fontSize: 11.5 }}>đã chọn cho mẫu này</span>;
        return <button type="button" onClick={(e) => { e.stopPropagation(); sinh(p); }} title={mau?.dong ? `tạo dòng phim ${mau.dong} — máy sinh creative theo mẫu, mọi cổng của dòng (soát, chấm, phanh chợ, luật lên camp) giữ nguyên` : 'mẫu chưa có máy dựng — chỉ ghi phim, dựng mã mẫu xong máy mới sinh'}
          style={{ fontSize: 11.5, padding: '2px 10px', borderRadius: 6, border: '1px solid var(--accent, #60a5fa)', background: 'transparent', color: 'var(--accent, #60a5fa)', cursor: 'pointer' }}>
          {mau?.dong ? `Sinh (${mau.dong})` : 'Ghi chờ dựng'}</button>; } },
  ];
  const dau = <div className="modal-head"><div><div className="id-line">chọn phim sinh creative theo mẫu</div><h2 style={{ margin: 0 }}>{mau?.ten ?? ma}</h2>
    <div style={{ fontSize: 11.5, color: MO_SO, marginTop: 2 }}>{mau ? (mau.dong ? `dạng ${mau.dang} · máy dựng: dòng ${mau.dong}` : 'mẫu chưa có máy dựng — chọn phim chỉ ghi lại') : ''}</div></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;
  return <Drawer onClose={onClose} width={1400} padding={0}>{dau}
    <div style={{ padding: '8px 12px' }}>
      {!du ? <div style={{ color: MO_SO }}>đang đọc danh sách phim…</div> : 'loi' in du ? <div style={{ color: DO }}>{du.loi}</div> :
        <DataTable rows={loc_} columns={cot} groups={nhomCot} groupHeader getRowKey={(p) => String(p.id)} persistKey="etp-mau-phim" minWidth={1180} pageSize={100}
          groupBy={{ value: (p) => p.nhom }} locTuDong={false}
          searchText={(p) => `${p.ten} ${p.id} ${p.tl ?? ''}`} searchPlaceholder="Tìm phim, mã, thể loại…"
          dauThanh={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FilterChips<Loc> options={LOC.map(({ value, label, title }) => ({ value, label, title }))} values={loc} onToggle={setLoc} counts={dem} urlKey="mpl" />
            <span style={{ fontSize: 11.5, color: MO_SO }}>{loc_.length}/{rows.length} phim{dt ? '' : ' · đang đọc số đối thủ…'}</span></span>} />}
    </div>
  </Drawer>;
}
