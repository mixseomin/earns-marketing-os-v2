'use client';
// NHÓM CỘT "QC TRANG" + BIỂU ĐỒ IRPM / FILL (anh 23/11/2026, card etp:qc-adsense-camp-2311): tách camp / phim lỗ vì trang phim kiếm ít
// (Impression RPM / fill thấp) hay vì Facebook đắt (CPC cao). Số theo khoảng thời gian đang chọn; ẩn / hiện bằng nút ⚙ của bảng.
import type { DataColumn } from '@/components/ui';
import { chiSo, type ChiSoQc, type GopQc, NGUONG_QC } from '@/lib/qc-trang';

export const NHOM_QC = { key: 'qc', label: 'QC trang (AdSense)', color: '#f472b6',
  title: 'Số AdSense của trang phim trong khoảng đang chọn, so với chợ cùng ngày: Impression RPM, tỉ lệ lấp QC, Page RPM, số QC mỗi lượt xem, ROI và chẩn đoán lỗ do trang hay do Facebook' };

const MO = 'var(--fg-3)';
const so = (v: number | null, d = 1) => (v == null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }));
const pt = (v: number | null) => (v == null ? '' : ` (${v > 0 ? '+' : ''}${Math.round(v)}%)`);
// đỏ = kém chợ tới ngưỡng "trang yếu"; còn lại trung tính (màu chỉ báo tín hiệu thật)
const mauLech = (v: number | null) => (v != null && v <= -NGUONG_QC.yeu_kem * 100 ? '#f87171' : undefined);

const MAU_NHAN: Record<string, string> = { 'trang hỏng': '#ef4444', 'trang yếu': '#f59e0b', 'FB đắt': '#60a5fa' };
const GIAI_NHAN: Record<string, string> = {
  'trang hỏng': `Trang có từ ${NGUONG_QC.hong_xem} lượt xem mà không xin QC hoặc tỉ lệ lấp dưới ${NGUONG_QC.hong_fill}% — trang phim có thể đang lỗi QC`,
  'trang yếu': `Impression RPM hoặc tỉ lệ lấp thấp hơn chợ từ ${Math.round(NGUONG_QC.yeu_kem * 100)}% trở lên (cần từ ${NGUONG_QC.yeu_hien} QC hiện) — lỗ do trang kiếm ít`,
  'FB đắt': `Giá một lượt bấm Facebook cao hơn trung vị camp nhà từ ${Math.round(NGUONG_QC.fb_dat * 100)}% trở lên (cần từ ${NGUONG_QC.fb_bam_min} lượt bấm) — lỗ do Facebook`,
};

/** đoạn chữ so với chợ — dùng chung cho chip và rê chuột từng ô */
export function moTa(s: ChiSoQc, g: GopQc) {
  return [
    `IRPM $${so(s.irpm, 2)} · chợ $${so(g.choI, 2)}${pt(s.irpmLech)}`,
    `Fill ${so(s.fill)}% · chợ ${so(g.choF)}%${pt(s.fillLech)}`,
    `Page RPM $${so(s.prpm, 2)} · chợ $${so(g.choP, 2)}${pt(s.prpmLech)}`,
    s.cpc == null ? `CPC Facebook: chưa đủ ${NGUONG_QC.fb_bam_min} lượt bấm` : `CPC Facebook $${so(s.cpc, 3)} · trung vị nhà $${so(g.choT, 3)}${pt(s.cpcLech)}`,
    `${g.x.toLocaleString('vi-VN')} lượt xem · ${g.q.toLocaleString('vi-VN')} lượt xin QC · ${g.h.toLocaleString('vi-VN')} QC hiện · ${g.ngay} ngày`,
  ].join('\n');
}

/** chip chẩn đoán — rê chuột xem số so với chợ */
export function ChipQc({ s, g }: { s: ChiSoQc; g: GopQc }) {
  if (!s.nhan) return <span style={{ color: MO }}>—</span>;
  return <span title={`${GIAI_NHAN[s.nhan]}\n${moTa(s, g)}`} style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap',
    color: MAU_NHAN[s.nhan], border: `1px solid ${MAU_NHAN[s.nhan]}` }}>{s.nhan}</span>;
}

/** các cột nhóm "QC trang" cho một bảng — f trả số gộp của dòng (null = chưa có số AdSense trong khoảng) */
export function cotQc<T>(f: (r: T) => GopQc | null | undefined): DataColumn<T>[] {
  const cs = (r: T) => { const g = f(r); return g ? { g, s: chiSo(g) } : null; };
  const o = (v: number | null, d: number, tien = false, lech: number | null = null) =>
    <span style={{ fontVariantNumeric: 'tabular-nums', color: v == null ? MO : mauLech(lech) }}>{v == null ? '—' : `${tien ? '$' : ''}${so(v, d)}`}</span>;
  const tt = (r: T) => { const x = cs(r); return x ? moTa(x.s, x.g) : 'Chưa có số AdSense trong khoảng này'; };
  const sv = (k: keyof ChiSoQc) => (r: T) => { const v = cs(r)?.s[k]; return typeof v === 'number' ? v : -1e9; };
  return [
    { key: 'qc_irpm', group: 'qc', header: 'IRPM', title: 'Impression RPM — tiền AdSense trên 1.000 QC hiện; đỏ = thấp hơn chợ cùng ngày', align: 'right', cellTitle: (r) => tt(r), sortValue: sv('irpm'),
      cell: (r) => { const x = cs(r); return o(x?.s.irpm ?? null, 2, true, x?.s.irpmLech ?? null); } },
    { key: 'qc_fill', group: 'qc', header: 'Fill', title: 'Tỉ lệ lấp — QC hiện trên lượt xin QC (%)', align: 'right', cellTitle: (r) => tt(r), sortValue: sv('fill'),
      cell: (r) => { const x = cs(r); return o(x?.s.fill ?? null, 1, false, x?.s.fillLech ?? null); } },
    { key: 'qc_prpm', group: 'qc', header: 'Page RPM', title: 'Tiền AdSense trên 1.000 lượt xem trang', align: 'right', cellTitle: (r) => tt(r), sortValue: sv('prpm'),
      cell: (r) => { const x = cs(r); return o(x?.s.prpm ?? null, 2, true, x?.s.prpmLech ?? null); } },
    { key: 'qc_xem', group: 'qc', header: 'QC/lượt xem', title: 'Số QC hiện trên mỗi lượt xem trang', align: 'right', cellTitle: (r) => tt(r), sortValue: sv('qcXem'),
      cell: (r) => o(cs(r)?.s.qcXem ?? null, 2) },
    { key: 'qc_roi', group: 'qc', header: 'ROI', title: 'ROI % của đúng các ngày có số AdSense', align: 'right', cellTitle: (r) => tt(r), sortValue: sv('roi'),
      cell: (r) => { const v = cs(r)?.s.roi ?? null; return <span style={{ fontVariantNumeric: 'tabular-nums', color: v == null ? MO : v >= 0 ? 'var(--neon-lime, #4ade80)' : '#f87171' }}>{v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)}%`}</span>; } },
    { key: 'qc_nhan', group: 'qc', header: 'Chẩn đoán', title: 'trang hỏng · trang yếu · FB đắt — rê chuột xem số so với chợ', cellTitle: (r) => tt(r),
      sortValue: (r) => { const n = cs(r)?.s.nhan; return n === 'trang hỏng' ? 3 : n === 'trang yếu' ? 2 : n === 'FB đắt' ? 1 : 0; },
      cell: (r) => { const x = cs(r); return x ? <ChipQc s={x.s} g={x.g} /> : <span style={{ color: MO }}>—</span>; } },
  ];
}

type Diem = { d: string; irpm: number | null; fill: number | null; choI: number | null; choF: number | null };
/** biểu đồ nhỏ theo ngày: IRPM (hồng) + fill (xanh) của nhà, nét đứt = chợ cùng ngày; rê chuột xem số từng ngày */
export function BieuDoQc({ chuoi, rong = 300 }: { chuoi: Diem[]; rong?: number }) {
  if (chuoi.length < 2) return <div style={{ fontSize: 11, color: MO }}>{chuoi.length ? 'Mới có số AdSense một ngày — chưa vẽ được đường' : 'Chưa có số AdSense theo ngày'}</div>;
  const cao = 70, le = 4;
  const x = (i: number) => le + (i * (rong - 2 * le)) / (chuoi.length - 1);
  const duong = (vs: (number | null)[], max: number) => vs.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${(cao - le - (v / max) * (cao - 2 * le)).toFixed(1)}`)).filter(Boolean).join(' ');
  const maxI = Math.max(1, ...chuoi.flatMap((c) => [c.irpm ?? 0, c.choI ?? 0]));
  const ngay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const tieuDe = chuoi.map((c) => `${ngay(c.d)}: IRPM $${so(c.irpm, 2)} (chợ $${so(c.choI, 2)}) · fill ${so(c.fill)}% (chợ ${so(c.choF)}%)`).join('\n');
  return <div title={tieuDe}>
    <div style={{ fontSize: 10.5, color: MO, marginBottom: 2 }}>
      <span style={{ color: '#f472b6' }}>━ IRPM</span> · <span style={{ color: '#38bdf8' }}>━ Fill</span> · ┄ chợ cùng ngày · {ngay(chuoi[0]!.d)} → {ngay(chuoi[chuoi.length - 1]!.d)}
    </div>
    <svg width={rong} height={cao} style={{ display: 'block', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
      <polyline points={duong(chuoi.map((c) => c.choI), maxI)} fill="none" stroke="#f472b6" strokeOpacity={0.5} strokeDasharray="3 3" strokeWidth={1} />
      <polyline points={duong(chuoi.map((c) => c.irpm), maxI)} fill="none" stroke="#f472b6" strokeWidth={1.6} />
      <polyline points={duong(chuoi.map((c) => c.choF), 100)} fill="none" stroke="#38bdf8" strokeOpacity={0.5} strokeDasharray="3 3" strokeWidth={1} />
      <polyline points={duong(chuoi.map((c) => c.fill), 100)} fill="none" stroke="#38bdf8" strokeWidth={1.6} />
    </svg>
  </div>;
}
