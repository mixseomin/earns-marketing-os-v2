'use client';
// Ô "LƯỢT 2 KIỂU K CHỜ DUYỆT" ở etp2 › Camp (anh 26/11/2026 "Camp lên kiểu Dol cũng ko cần duyệt nếu Creative đã passed" → chỉ camp kiểu K cần duyệt):
// mỗi dòng = một camp lượt 2 máy định lên (creative clone của cr gốc đã duyệt, đổi kiểu chữ dol → kien, sang bộ kia). Chưa bấm ✓ thì máy không tạo gì.
// Lỗi hiện ô đỏ ngay dưới nút. Không có gì chờ → không vẽ gì. Bảng = SimpleTable nhà (ui-conventions §7).
import { useCallback, useEffect, useState } from 'react';
import { SimpleTable, type SimpleColumn } from '@/components/ui';
import { dsLuot2Cho, duyetLuot2, type Luot2Cho } from '@/lib/actions/etp-luot2-duyet';

const nut: React.CSSProperties = { fontSize: 12, padding: '2px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'inherit' };
const KD = (k: string | null) => (k === 'kien' ? 'K' : k === 'dol' ? 'D' : k ?? '?');
const tien = (v: number | null) => (v == null ? '—' : `$${v.toFixed(2)}`);

export function ChoDuyetLuot2() {
  const [ds, setDs] = useState<Luot2Cho[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [tin, setTin] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const tai = useCallback(async () => { const r = await dsLuot2Cho(); if ('loi' in r) setLoi(r.loi); else setDs(r.ds); }, []);
  useEffect(() => { tai(); const t = setInterval(tai, 20000); return () => clearInterval(t); }, [tai]);
  const bam = async (crs: number[], ok: boolean) => {
    setDang(true); setLoi(null); setTin(null);
    const r = await duyetLuot2(crs, ok); setDang(false);
    if ('loi' in r) setLoi(r.loi); else { setTin(r.chu); tai(); }
  };
  if (!ds?.length && !loi && !tin) return null;
  const cot: SimpleColumn<Luot2Cho>[] = [
    { key: 'phim', header: 'Phim', cell: (x) => <span title={x.phim ?? ''}>{x.phim ?? `phim ${x.content_id ?? '?'}`} <span style={{ color: 'var(--fg-3)' }}>{x.lang}</span></span> },
    { key: 'cr', header: 'Cr gốc', cell: (x) => `#${x.cr_goc}` },
    { key: 'goc', header: 'Camp gốc', cell: (x) => `${x.camp_goc ? `#${x.camp_goc}` : '—'} · ${KD(x.kieu_goc)} · bộ ${x.bo_goc ?? '?'}` },
    { key: 'so', header: 'Chi · thu gốc', align: 'right', cell: (x) => `${tien(x.chi_goc)} · ${tien(x.doanh_goc)}` },
    { key: 'moi', header: 'Lên thành', cell: (x) => <><b>{KD(x.kieu_moi)}</b> · bộ {x.bo_moi ?? '?'} · ★ ROAS</> },
    { key: 'luc', header: 'Xếp lúc', cell: (x) => x.tao ?? '—' },
    { key: 'nut', header: '', align: 'right', cell: (x) => <span style={{ whiteSpace: 'nowrap' }}>
      <button style={{ ...nut, borderColor: '#4ade80' }} disabled={dang} onClick={() => bam([x.cr_goc], true)} title="duyệt: máy lên camp K này ở nhịp kế">✓</button>{' '}
      <button style={{ ...nut, borderColor: '#f87171' }} disabled={dang} onClick={() => bam([x.cr_goc], false)} title="không duyệt: bỏ, máy không lên">✕</button></span> },
  ];
  return <section data-o="luot2-cho" style={{ border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 10px', margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <b>Lượt 2 · camp kiểu K chờ anh duyệt</b>
      <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{ds?.length ?? 0} camp · creative clone của bản đã duyệt, đổi chữ D → K, sang bộ kia · chưa duyệt thì máy không tạo</span>
      {ds && ds.length > 1 ? <button style={{ ...nut, marginLeft: 'auto', borderColor: '#4ade80' }} disabled={dang} onClick={() => bam(ds.map((x) => x.cr_goc), true)}>✓ Duyệt hết</button> : null}
    </div>
    {loi ? <div role="alert" style={{ background: '#7f1d1d', color: '#fecaca', borderRadius: 6, padding: '6px 8px', fontSize: 12.5 }}>Không làm được: {loi}</div> : null}
    {tin ? <div style={{ color: '#4ade80', fontSize: 12.5 }}>{tin}</div> : null}
    {ds?.length ? <SimpleTable rows={ds} columns={cot} getRowKey={(x) => String(x.cr_goc)} /> : null}
  </section>;
}
