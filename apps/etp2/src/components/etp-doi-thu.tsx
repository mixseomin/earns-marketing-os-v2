'use client';
// PHIM ĐỐI THỦ (anh giao 19/11/2026): phim đối thủ đang quảng bá trên Meta (kho Spy) so với nhà / đội trên Ethopex. Bấm một phim → ngăn creative đối thủ
// (etp-doi-thu-drawer.tsx, loại 'etp-dt' của EtpDrawerHost — xếp chồng, đi theo URL ?ed=etp-dt~<khoá>). CHỈ ĐỌC — không có nút lên camp (lên camp vẫn qua cổng).
// Dữ liệu: lib/actions/etp-doi-thu.ts. Bộ lọc trên URL: ?dtl=<lọc,…>.
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (DataTable, FilterChips, SiteFavicon, useSoNho)
import { useEffect, useMemo, useState } from 'react';
import { DataTable, FilterChips, SiteFavicon, type DataColumn } from '@/components/ui';
import { Dem, MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { useSoNho } from '@/lib/so-nho';
import { docPhimDoiThu, type DuDoiThu, type PhimDoiThu } from '@/lib/actions/etp-doi-thu';

export const XANH = 'var(--neon-lime, #4ade80)', DO = 'var(--neon-red, #f87171)', VANG = '#fbbf24';
export const ngayTu = (d: string | null) => (d ? Math.max(0, Math.floor((Date.now() - Date.parse(d.length <= 10 ? `${d}T00:00:00+07:00` : d)) / 864e5)) : null);
export const gioVn = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
const roi = (x: { chi: number; thu: number }) => (x.chi > 0.5 ? ((x.thu - x.chi) / x.chi) * 100 : null);
/** số giữ trong máy của danh sách — ngăn kéo đọc chung khoá này nên mở ngay, không tải lại */
export const useDoiThu = () => useSoNho<DuDoiThu>('doi-thu', docPhimDoiThu);

/** ô Nhà / Đội: đèn xanh + số đang chạy · vòng xám + số từng chạy · gạch mờ = chưa chạy (chữ đầy đủ ở hover) */
export function OCamp({ x, ai }: { x: PhimDoiThu['nha']; ai: string }) {
  if (x.dang) return <span title={`${ai}: ${x.dang} camp đang chạy / ${x.tong} camp từng lên`} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}><span style={{ width: 7, height: 7, borderRadius: 9, background: XANH }} />{x.dang}<span style={{ color: MO_SO }}>/{x.tong}</span></span>;
  if (x.tong) return <span title={`${ai}: từng lên ${x.tong} camp, hiện không camp nào chạy`} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}><span style={{ width: 7, height: 7, borderRadius: 9, border: '1.5px solid var(--fg-3)', boxSizing: 'border-box' }} />{x.tong}</span>;
  return <span title={`${ai} chưa chạy phim này`} style={{ color: MO_SO }}>—</span>;
}
export function ORoi({ x }: { x: PhimDoiThu['nha'] }) {
  const r = roi(x);
  if (r == null) return <span style={{ color: MO_SO }}>—</span>;
  return <span title={`chi $${x.chi.toFixed(2)} · thu $${x.thu.toFixed(2)} · lãi $${(x.thu - x.chi).toFixed(2)}`} style={{ color: r >= 0 ? XANH : DO, fontVariantNumeric: 'tabular-nums' }}>{r.toFixed(0)}%</span>;
}
export const Mien = ({ ds }: { ds: string[] }) => <span style={{ display: 'inline-flex', gap: 4 }} title={ds.join(' · ')}>{ds.map((m) => <SiteFavicon key={m} url={`https://${m}`} size={14} title={m} />)}</span>;

const docUrl = (k: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(k));
function ghiUrl(k: string, v: string | null) {
  const u = new URL(window.location.href);
  if ((u.searchParams.get(k) ?? null) === v) return;
  if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
  window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
}

type Loc = 'chay' | 'chua' | 'etp' | 'cohoi';
const LOC: { value: Loc; label: string; title: string; f: (p: PhimDoiThu) => boolean }[] = [
  { value: 'cohoi', label: '★ Cơ hội', title: 'đối thủ đang chạy ≥ 3 QC + phim có trên Ethopex + nhà chưa từng chạy', f: (p) => p.co_hoi },
  { value: 'chay', label: 'Còn chạy', title: 'đối thủ còn QC chạy trong 2 ngày qua', f: (p) => p.qc_dang > 0 },
  { value: 'chua', label: 'Nhà chưa chạy', title: 'nhà chưa từng lên camp phim này', f: (p) => p.nha.tong === 0 },
  { value: 'etp', label: 'Có trên Ethopex', title: 'tên phim khớp một phim trong kho Ethopex', f: (p) => !!p.etp },
];
const tlCua = (p: PhimDoiThu) => p.etp?.the_loai_ten ?? null;

export function TabDoiThu() {
  const { so: du, loi } = useDoiThu();
  const [loc, setLoc] = useState<Loc[]>(() => (docUrl('dtl') ?? '').split(',').filter((x): x is Loc => LOC.some((l) => l.value === x)));
  useEffect(() => { ghiUrl('dtl', loc.length ? loc.join(',') : null); }, [loc]);
  useEffect(() => () => ghiUrl('dtl', null), []);   // rời tab thì bỏ lọc khỏi URL
  const rows = useMemo(() => (du?.phim ?? []).filter((p) => loc.every((k) => LOC.find((l) => l.value === k)!.f(p))), [du, loc]);
  const dem = useMemo(() => Object.fromEntries(LOC.map((l) => [l.value, (du?.phim ?? []).filter(l.f).length])) as Record<Loc, number>, [du]);
  const cot: DataColumn<PhimDoiThu>[] = useMemo(() => [
    { key: 'ten', header: 'Phim', align: 'left', width: 300, sortValue: (p) => p.ten, cell: (p) => <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {p.co_hoi ? <span title="cơ hội: đối thủ chạy mạnh, phim có trên Ethopex, nhà chưa chạy" style={{ color: VANG, fontWeight: 700 }}>★</span> : null}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: p.co_hoi ? 600 : undefined }} title={`${p.ten}\nmã trang đích: ${p.ma.map((m) => m.replace('~', ' ')).join(', ')}`}>{p.ten}</span></span> },
    { key: 'mien', header: 'Đối thủ', align: 'left', width: 70, sortValue: (p) => p.mien.join(','), cell: (p) => <Mien ds={p.mien} /> },
    { key: 'qc_dang', header: 'QC đang chạy', title: 'QC đối thủ Spy còn thấy trong 2 ngày qua', sortValue: (p) => p.qc_dang, cell: (p) => <b style={{ fontWeight: p.qc_dang >= 10 ? 700 : 500 }}><Dem v={p.qc_dang} /></b> },
    { key: 'qc_tong', header: 'QC tổng', sortValue: (p) => p.qc_tong, cell: (p) => <Dem v={p.qc_tong} /> },
    { key: 'lau', header: 'Chạy lâu nhất', title: 'số ngày QC chạy lâu nhất của phim (từ ngày bắt đầu tới lần cuối Spy thấy)', sortValue: (p) => p.lau_nhat, cell: (p) => <span style={{ fontVariantNumeric: 'tabular-nums', color: p.lau_nhat ? undefined : MO_SO }}>{p.lau_nhat}d</span> },
    { key: 'page', header: 'Page', title: 'số Page đối thủ chạy phim này', sortValue: (p) => p.so_page, cell: (p) => <Dem v={p.so_page} /> },
    { key: 'etp', header: 'Ethopex', align: 'left', title: 'mã phim trên Ethopex (bấm để mở ngăn phim)', sortValue: (p) => p.etp?.id ?? null,
      onCellClick: (p) => { if (p.etp) openEntityDrawer('etp-phim', p.etp.id); else openEntityDrawer('etp-dt', p.khoa); },
      cell: (p) => (p.etp ? <a style={{ cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }} title={`${p.etp.ten} · ${(p.etp.locale ?? '?').toUpperCase()}${p.etp_khac.length ? ` · thêm mã ${p.etp_khac.join(', ')}` : ''} — bấm mở ngăn phim`}>#{p.etp.id}{p.etp_khac.length ? <span style={{ color: MO_SO }}> +{p.etp_khac.length}</span> : null}</a> : <span style={{ color: MO_SO }} title="không khớp phim nào trên Ethopex">—</span>) },
    { key: 'tl', header: 'Thể loại', align: 'left', sortValue: tlCua, cell: (p) => tlCua(p) ?? <span style={{ color: MO_SO }}>—</span> },
    { key: 'tuoi_etp', header: 'Tuổi Ethopex', title: 'số ngày từ khi phim có trên Ethopex', sortValue: (p) => ngayTu(p.etp?.co_tu ?? null), cell: (p) => { const n = ngayTu(p.etp?.co_tu ?? null); return n == null ? <span style={{ color: MO_SO }}>—</span> : <span title={p.etp?.co_tu ? `có trên Ethopex từ ${gioVn(p.etp.co_tu)}` : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>{n}d</span>; } },
    { key: 'tuoi_dt', header: 'Đối thủ chạy từ', title: 'số ngày từ khi đối thủ bắt đầu chạy QC đầu tiên của phim', sortValue: (p) => ngayTu(p.bat_dau), cell: (p) => { const n = ngayTu(p.bat_dau); return n == null ? <span style={{ color: MO_SO }}>—</span> : <span title={`QC đầu tiên bắt đầu ${ngayVn(p.bat_dau)}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{n}d</span>; } },
    { key: 'nha', header: 'Nhà', title: 'camp nhà: đang chạy / từng lên', sortValue: (p) => p.nha.dang * 1000 + p.nha.tong, cell: (p) => <OCamp x={p.nha} ai="Nhà" /> },
    { key: 'roi_nha', header: 'ROI nhà', sortValue: (p) => roi(p.nha), cell: (p) => <ORoi x={p.nha} /> },
    { key: 'doi', header: 'Đội', title: 'camp đội: đang chạy / từng lên', sortValue: (p) => p.doi.dang * 1000 + p.doi.tong, cell: (p) => <OCamp x={p.doi} ai="Đội" /> },
    { key: 'roi_doi', header: 'ROI đội', sortValue: (p) => roi(p.doi), cell: (p) => <ORoi x={p.doi} /> },
  ], []);
  if (loi && !du) return <div style={{ padding: 16, color: DO }}>{loi}</div>;
  if (!du) return <div style={{ padding: 16, color: MO_SO }}>đang đọc kho Spy…</div>;
  return (
    <DataTable rows={rows} columns={cot} getRowKey={(p) => p.khoa} persistKey="etp-doi-thu" minWidth={1320} pageSize={100} defaultSort={[{ key: 'qc_dang', dir: 'desc' }]}
      onRowClick={(p) => openEntityDrawer('etp-dt', p.khoa)} rowStyle={(p) => (p.co_hoi ? { background: 'rgba(251,191,36,0.07)' } : undefined)}
      searchText={(p) => `${p.ten} ${p.etp?.id ?? ''} ${p.mien.join(' ')} ${tlCua(p) ?? ''}`} searchPlaceholder="Tìm phim, mã Ethopex, đối thủ…"
      dauThanh={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterChips<Loc> options={LOC.map(({ value, label, title }) => ({ value, label, title }))} values={loc} onToggle={setLoc} counts={dem} urlKey="dtl" />
        <span style={{ fontSize: 11.5, color: loi ? DO : MO_SO }} title={`${du.qc} QC đối thủ trong kho Spy · miền theo dõi: ${du.mien.join(', ')} (thêm miền: cấu hình doi_thu_mien ở Luật & cảnh báo)${du.chua_ten ? ` · ${du.chua_ten} QC chưa lấy được tên phim` : ''}`}>
          {loi ? `tải mới lỗi: ${loi}` : `${rows.length}/${du.phim.length} phim · ${du.phim.filter((p) => p.qc_dang > 0).length} còn chạy · ${gioVn(du.luc)}`}</span>
      </span>} />
  );
}
