'use client';
// KHỐI "PHIM ĐỘI CÓ CAMP, NHÀ CHƯA CÓ" trên đầu tab Camp › Theo phim (anh 27/11/2026: "thêm vào …v=cay… cả danh sách các phim chưa có camp của Nhà nhưng đội đang có camp để lên camp").
// Gập / mở (nhớ theo máy), mặc định mở; bảng DataTable chung: phim · người đội · số camp đội · chi / thu / lãi / ROI 7 ngày; nút 🚀 mở Phiếu lên camp (ngăn etp-phieu-len) — camp chỉ tạo khi anh ✓ Duyệt.
// Dữ liệu: @/lib/actions/etp-phim-doi (đọc lúc mở tab, không nằm trong gói dữ liệu chính của trang).
import { useEffect, useState } from 'react';
import { DataTable, type DataColumn } from '@/components/ui';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { dsPhimDoi, type PhimDoi } from '@/lib/actions/etp-phim-doi';
import { KeToan, MO_SO, mauLai, Dem } from '@/components/etp-so';

const KHOA = 'etp-phim-doi.mo';
const roi = (r: PhimDoi) => (r.chi7 > 0 ? Math.round(((r.thu7 - r.chi7) / r.chi7) * 100) : null);
const PHIEU: Record<string, string> = { dung: 'phiếu nháp', cho_duyet: 'phiếu chờ duyệt', len: 'phiếu đang lên', loi: 'phiếu lỗi' };

const COT: DataColumn<PhimDoi>[] = [
  { key: 'phim', header: 'Phim', align: 'left', width: 300, sortValue: (r) => r.ten, cell: (r) => <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
    {r.anh ? <img src={r.anh} alt="" style={{ width: 24, height: 36, objectFit: 'cover', borderRadius: 3, flex: 'none' }} /> : <span style={{ width: 24, height: 36, background: 'var(--bg-3)', borderRadius: 3, flex: 'none' }} />}
    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`#${r.cid} · ${r.ten}`}>{r.ten}<span style={{ color: MO_SO, fontSize: 11 }}> #{r.cid}</span></span></span> },
  { key: 'lang', header: 'Ngôn ngữ', align: 'left', width: 70, sortValue: (r) => r.lang ?? '', cell: (r) => <span style={{ color: r.lang ? undefined : MO_SO }}>{r.lang ?? '—'}</span> },
  { key: 'tl', header: 'Thể loại', align: 'left', width: 110, sortValue: (r) => r.the_loai ?? '', cell: (r) => <span style={{ color: r.the_loai ? undefined : MO_SO }}>{r.the_loai ?? '—'}</span> },
  { key: 'nguoi', header: 'Đội đang chạy', align: 'left', width: 170, sortValue: (r) => r.nguoi.join(', '), cell: (r) => <span title={r.nguoi.join(', ')} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.nguoi.join(', ') || '—'}</span> },
  { key: 'so_camp', header: 'Camp đội', title: 'số camp đội có chi trong 7 ngày', width: 70, sortValue: (r) => r.so_camp, cell: (r) => <Dem v={r.so_camp} />, total: (rs) => <Dem v={rs.reduce((a, r) => a + r.so_camp, 0)} /> },
  { key: 'chi7', header: 'Chi 7n', width: 90, sortValue: (r) => r.chi7, cell: (r) => <KeToan v={r.chi7} />, total: (rs) => <KeToan v={rs.reduce((a, r) => a + r.chi7, 0)} /> },
  { key: 'thu7', header: 'Thu 7n', width: 90, sortValue: (r) => r.thu7, cell: (r) => <KeToan v={r.thu7} />, total: (rs) => <KeToan v={rs.reduce((a, r) => a + r.thu7, 0)} /> },
  { key: 'lai7', header: 'Lãi 7n', width: 90, sortValue: (r) => r.thu7 - r.chi7, cell: (r) => <KeToan v={r.thu7 - r.chi7} mau={mauLai(r.thu7 - r.chi7)} />, total: (rs) => { const v = rs.reduce((a, r) => a + r.thu7 - r.chi7, 0); return <KeToan v={v} mau={mauLai(v)} />; } },
  { key: 'roi', header: 'ROI 7n', width: 70, sortValue: (r) => roi(r), cell: (r) => { const v = roi(r); return v == null ? <span style={{ color: MO_SO }}>—</span> : <b style={{ color: mauLai(v) }}>{v > 0 ? '+' : ''}{v}%</b>; } },
  { key: 'len', header: '', align: 'center', width: 130, cell: (r) => <span style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
    <button data-phim-doi-len={r.cid} onClick={(e) => { e.stopPropagation(); openEntityDrawer('etp-phieu-len', r.cid); }} title="mở Phiếu lên camp cho phim này — camp chỉ tạo khi anh ✓ Duyệt"
      style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line-2)', background: 'var(--bg-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>🚀 Lên camp</button>
    {r.phieu ? <span style={{ fontSize: 10.5, color: MO_SO, whiteSpace: 'nowrap' }}>{PHIEU[r.phieu] ?? r.phieu}</span> : null}</span> },
];

export function PhimDoiChuaCo() {
  const [ds, setDs] = useState<PhimDoi[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [mo, setMo] = useState(true);
  useEffect(() => { try { if (localStorage.getItem(KHOA) === '0') setMo(false); } catch { /* kho bị chặn: giữ mặc định mở */ } }, []);
  useEffect(() => { let huy = false; dsPhimDoi().then((r) => { if (huy) return; if ('loi' in r) setLoi(r.loi); else setDs(r.ds); }).catch((e) => !huy && setLoi(String(e?.message ?? e))); return () => { huy = true; }; }, []);
  const doi = () => setMo((v) => { try { localStorage.setItem(KHOA, v ? '0' : '1'); } catch { /* bỏ qua */ } return !v; });
  const lai = ds?.filter((r) => r.thu7 > r.chi7).length ?? 0;
  return <section data-phim-doi style={{ border: '1px solid var(--line-2)', borderRadius: 8, marginBottom: 10, background: 'var(--bg-1)' }}>
    <button onClick={doi} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
      <span style={{ fontSize: 11, color: MO_SO }}>{mo ? '▾' : '▸'}</span>
      <b style={{ fontSize: 12.5 }}>🎯 Phim đội có camp, nhà chưa có</b>
      <span style={{ fontSize: 11.5, color: MO_SO }}>{ds ? `${ds.length} phim · ${lai} phim đội đang lãi 7 ngày` : loi ? '' : 'đang đọc…'}</span>
    </button>
    {loi ? <div style={{ margin: '0 10px 8px', padding: '6px 10px', borderRadius: 6, background: 'rgba(220,38,38,.12)', color: 'var(--neon-red, #f87171)', fontSize: 12 }}>Không đọc được danh sách phim đội: {loi}</div> : null}
    {mo && ds ? (ds.length ? <div style={{ padding: '0 6px 6px' }}>
      <DataTable rows={ds} columns={COT} getRowKey={(r) => String(r.cid)} persistKey="etp-phim-doi" minWidth={1100} pageSize={10} defaultSort={[{ key: 'lai7', dir: 'desc' }]}
        searchText={(r) => `${r.cid} ${r.ten} ${r.lang ?? ''} ${r.the_loai ?? ''} ${r.nguoi.join(' ')}`} searchPlaceholder="Tìm phim, người đội…" />
    </div> : <div style={{ padding: '0 10px 8px', fontSize: 12, color: MO_SO }}>Không có phim nào đội đang chạy mà nhà chưa có camp.</div>) : null}
  </section>;
}
