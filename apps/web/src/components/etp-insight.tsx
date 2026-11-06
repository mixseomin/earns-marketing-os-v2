'use client';
// TAB INSIGHT etp (anh 06/11/2026 "tạo 1 tab mới là Insight (chỉ david xem) và tổng hợp các insight gần đây sau khi phân tích chi tiết theo từng ngày và từng giờ của nhà và đội"):
// trên = thẻ nhận định (sổ etp.insight) · dưới = số sống để tự kiểm: ngày × người, khung giờ × ngày (nhà / đội), 24 giờ VN 7 ngày. Chỉ vai chủ (lib/actions/etp-insight.ts kiểm trên máy chủ).
import { useEffect, useMemo, useState } from 'react';
import { mauLai } from '@/components/etp-so';
import { docInsight, docMoc, type DuInsight } from '@/lib/actions/etp-insight';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { dongBang, roiKhoi, type DongMoc, type Khoi, type MocSo } from '@/lib/etp-moc';

const NHOM: Record<string, [string, string]> = { gio: ['🕒 Giờ', '#60a5fa'], ngay: ['📅 Ngày', '#a78bfa'], camp: ['🎯 Camp', '#f59e0b'], doi: ['👥 Đội', '#4ade80'] };
const roi = (chi: number, thu: number) => (chi >= 1 ? Math.round(((thu - chi) / chi) * 100) : null);
const ngan = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const tien = (v: number) => `$${Math.round(v).toLocaleString('vi-VN')}`;
function Roi({ chi, thu }: { chi: number; thu: number }) {
  const r = roi(chi, thu);
  return r == null ? <span style={{ color: 'var(--fg-3)' }}>—</span> : <b style={{ color: mauLai(r) }}>{r > 0 ? '+' : ''}{r}%</b>;
}
// nền ô theo ROI: xanh dương lãi, đỏ lỗ — đậm dần tới ±50%
const nen = (chi: number, thu: number) => { const r = roi(chi, thu); if (r == null) return undefined; const a = Math.min(Math.abs(r), 50) / 50 * 0.35; return r >= 0 ? `rgba(74,222,128,${a})` : `rgba(248,113,113,${a})`; };
const o: React.CSSProperties = { padding: '4px 8px', borderTop: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const dau: React.CSSProperties = { ...o, borderTop: 'none', color: 'var(--fg-2)', fontWeight: 600, fontSize: 11 };
const the: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, padding: 12 };

// Ô ROI MỘT KHỐI của bảng mốc: màu theo ROI, hover = số mốc đủ khối + chi / thu — ít mốc (< 5) thì mờ
function ORoi({ x }: { x: Khoi }) {
  const r = roiKhoi(x);
  if (r == null) return <span style={{ color: 'var(--fg-3)' }}>—</span>;
  return <span title={`${x.n} mốc đủ số · chi ${tien(x.chi)} · thu ${tien(x.thu)}${x.n < 5 ? ' · ít mẫu' : ''}`} style={{ opacity: x.n < 5 ? 0.5 : 1 }}><b style={{ color: mauLai(r) }}>{r > 0 ? '+' : ''}{r}%</b></span>;
}
const KHOI: [keyof DongMoc & ('truoc' | 'k1' | 'k2' | 'k3' | 'k72'), string, string][] = [['truoc', 'ROI 24h trước', 'ROI 24 giờ TRƯỚC mốc (lên camp: không có)'], ['k1', 'ROI 0–24h sau', 'ROI 24 giờ đầu sau mốc'],
  ['k2', 'ROI 24–48h sau', 'ROI khối 24 giờ thứ hai sau mốc'], ['k3', 'ROI 48–72h sau', 'ROI khối 24 giờ thứ ba sau mốc'], ['k72', 'ROI cộng 72h', 'ROI cộng dồn 72 giờ sau mốc — chỉ mốc đã đủ 72 giờ số']];
const COT_MOC: DataColumn<DongMoc>[] = [
  { key: 'ten', header: 'Mốc', align: 'left', width: 250, cell: (d) => <span title={d.title}>{d.ten}</span>, sortValue: (d) => d.ten },
  { key: 'n', header: 'Số mốc', width: 70, title: 'số lần (camp × mốc) trong kỳ, theo bộ lọc đang chọn', cell: (d) => (d.k1.n < d.n ? <span title={`${d.k1.n} mốc đủ 24 giờ số · ${d.k3.n} đủ 72 giờ — mốc gần đây chưa đủ khối nào thì chưa vào ô ROI`}>{d.n}<span style={{ color: 'var(--fg-3)', fontSize: 10 }}> · {d.k1.n} đủ</span></span> : d.n), sortValue: (d) => d.n },
  ...KHOI.map(([k, h, t]): DataColumn<DongMoc> => ({ key: k, header: h, title: t, group: 'roi', width: 96, cell: (d) => <ORoi x={d[k] as Khoi} />, sortValue: (d) => roiKhoi(d[k] as Khoi) })),
  { key: 'lai72', header: 'Lãi 72h / mốc', group: 'kq', width: 96, title: 'lãi (thu − chi) cộng 72 giờ sau mốc, chia số mốc đã đủ 72 giờ', cell: (d) => (d.lai72 == null ? '—' : <b style={{ color: mauLai(d.lai72) }}>{d.lai72 >= 0 ? '+' : '−'}${Math.abs(d.lai72).toFixed(2)}</b>), sortValue: (d) => d.lai72 },
  { key: 'am1', header: '% âm 24h sau', group: 'kq', width: 90, title: 'tỷ lệ mốc mà 24 giờ sau lỗ (mốc có chi ≥ $0,3 trong 24 giờ sau)', cell: (d) => (d.am1 == null ? '—' : `${Math.round(d.am1 * 100)}%`), sortValue: (d) => d.am1 },
  { key: 'toc', header: 'Chi sau / trước', group: 'kq', width: 90, title: 'chi 24 giờ sau ÷ chi 24 giờ trước (mốc có chi cả hai phía) — tăng bậc có ăn thêm tiền thật không', cell: (d) => (d.toc == null ? '—' : `×${d.toc.toFixed(2)}`), sortValue: (d) => d.toc },
  { key: 'chi1', header: 'Chi 24h sau', group: 'kq', width: 90, cell: (d) => (d.k1.n ? tien(d.k1.chi) : '—'), sortValue: (d) => d.k1.chi }];

/** BẢNG MỐC × ROI SAU MỐC — tập camp + kỳ do trang truyền (cùng bộ lọc tab Camp, cùng kỳ chung) */
function BangMoc({ ids, tu, den, nhan }: { ids: number[]; tu: string; den: string; nhan: string }) {
  const khoa = useMemo(() => [...ids].sort((a, b) => a - b).join(','), [ids]);
  const [ms, setMs] = useState<MocSo[] | null>(null), [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { let huy = false; setMs(null); setLoi(null);
    const t = setTimeout(() => { docMoc(khoa ? khoa.split(',').map(Number) : [], tu, den).then((r) => { if (!huy) { if ('loi' in r) setLoi(r.loi); else setMs(r); } }).catch((e) => !huy && setLoi(String(e?.message ?? e))); }, 300);
    return () => { huy = true; clearTimeout(t); }; }, [khoa, tu, den]);
  const dong = useMemo(() => (ms ? dongBang(ms) : []), [ms]);
  return (
    <section style={the}>
      <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>Mốc × ROI sau mốc <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 12 }}>· {nhan} · mốc = giờ VN lên camp (giờ có chi đầu) / lên bậc / giảm bậc (tính từ giờ kế sau lúc đổi) · số theo giờ etp.so_gio_camp</span></h3>
      {loi ? <div style={{ color: '#f87171', fontSize: 12 }}>{loi}</div> : !ms ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>đang tính…</div> : !dong.length ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>không có mốc nào trong kỳ với bộ lọc này</div>
        : <DataTable rows={dong} columns={COT_MOC} getRowKey={(d) => d.k} rowStyle={(d) => (d.k.endsWith('-all') ? { fontWeight: 700 } : undefined)} persistKey="etp-insight-moc" minWidth={1100} fixedLayout
            groups={[{ key: 'roi', label: 'ROI theo khối 24 giờ', color: '#3b82f6' }, { key: 'kq', label: 'Kết quả', color: '#f59e0b' }]} groupHeader
            groupBy={{ value: (d) => d.nhom, label: (v, rs) => <b>{v.split('|')[1]} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {rs.find((r) => r.k.endsWith('-all'))?.n ?? rs.reduce((a, r) => a + r.n, 0)} mốc</span></b> }} />}
    </section>
  );
}

export function TabInsight({ ids, tu, den, nhan }: { ids: number[]; tu: string; den: string; nhan: string }) {
  const [du, setDu] = useState<DuInsight | null>(null), [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { docInsight().then((r) => ('loi' in r ? setLoi(r.loi) : setDu(r))).catch((e) => setLoi(String(e?.message ?? e))); }, []);
  const nguoi = useMemo(() => [...new Map((du?.ngay ?? []).map((x) => [x.nguoi, x.nha])).entries()].sort((a, b) => Number(b[1]) - Number(a[1])), [du]);
  const ngays = useMemo(() => [...new Set((du?.ngay ?? []).map((x) => x.ngay))].sort().reverse(), [du]);
  const khNgay = useMemo(() => [...new Set((du?.khung ?? []).map((x) => x.ngay))].sort().reverse(), [du]);
  if (loi) return <div style={{ padding: 16, color: 'var(--fg-2)' }}>{loi}</div>;
  if (!du) return <div style={{ padding: 16, color: 'var(--fg-3)' }}>đang tải số…</div>;
  const so = (ds: { chi: number; thu: number }[]) => ds.reduce((a, x) => ({ chi: a.chi + x.chi, thu: a.thu + x.thu }), { chi: 0, thu: 0 });
  const dot = [...new Set(du.insight.map((x) => x.ngay))];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BangMoc ids={ids} tu={tu} den={den} nhan={nhan} />
      {dot.map((d) => (
        <section key={d}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Nhận định ngày {ngan(d)} <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 12 }}>· số ngày đã khép, nhà = Tuấn David, đội = mọi người còn lại · chỉ để đọc, máy không làm theo</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {du.insight.filter((x) => x.ngay === d).map((x) => { const [n, m] = NHOM[x.nhom] ?? [x.nhom, 'var(--fg-2)'];
              return (
                <div key={x.id} style={{ ...the, borderLeft: `3px solid ${m}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ color: m, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{n}</span>
                    <b style={{ fontSize: 13 }}>{x.tieu_de}</b>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{x.noi_dung}</div>
                  {x.goi_y ? <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--fg-2)', marginTop: 6 }}>→ {x.goi_y}</div> : null}
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>số {x.khoang} · {x.ai}</div>
                </div>); })}
          </div>
        </section>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 12, alignItems: 'start' }}>
        <section style={the}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Theo ngày — từng người</h3>
          <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <thead><tr><th style={{ ...dau, textAlign: 'left' }}>Ngày</th>{nguoi.map(([n, nha]) => <th key={n} colSpan={2} style={dau}>{n}{nha ? ' (nhà)' : ''}</th>)}<th colSpan={2} style={dau}>Cả hệ</th></tr></thead>
            <tbody>{ngays.map((d) => { const r = du.ngay.filter((x) => x.ngay === d), t = so(r);
              return <tr key={d}><td style={{ ...o, textAlign: 'left' }}>{ngan(d)}</td>
                {nguoi.map(([n]) => { const x = r.find((y) => y.nguoi === n); return [<td key={n + 'c'} style={{ ...o, color: 'var(--fg-2)' }} title={x ? `${x.camp} camp có chi` : ''}>{x ? tien(x.chi) : '—'}</td>, <td key={n + 'r'} style={{ ...o, background: x ? nen(x.chi, x.thu) : undefined }}>{x ? <Roi chi={x.chi} thu={x.thu} /> : null}</td>]; })}
                <td style={{ ...o, color: 'var(--fg-2)' }}>{tien(t.chi)}</td><td style={{ ...o, background: nen(t.chi, t.thu) }}><Roi {...t} /></td></tr>; })}</tbody>
          </table></div>
        </section>
        <section style={the}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }} title="khung của máy luật: 07–15 nạp sáng · 15–21 chỉ giảm / tắt · 21–07 khung tăng">Theo khung giờ — nhà / đội</h3>
          <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <thead><tr><th style={{ ...dau, textAlign: 'left' }}>Ngày</th>{['07–15', '15–21', '21–07'].map((k) => <th key={k} colSpan={2} style={dau}>{k}</th>)}</tr>
              <tr><th style={dau} />{['07–15', '15–21', '21–07'].flatMap((k) => [<th key={k + 'n'} style={dau}>nhà</th>, <th key={k + 'd'} style={dau}>đội</th>])}</tr></thead>
            <tbody>
              {[['7 ngày gần', 0, 7], ['7 ngày trước', 7, 14]].map(([t, a, b]) => { const ds = khNgay.slice(a as number, b as number);
                return <tr key={t as string} style={{ fontWeight: 600 }}><td style={{ ...o, textAlign: 'left' }}>{t}</td>
                  {['07–15', '15–21', '21–07'].flatMap((k) => (['nha', 'doi'] as const).map((ai) => { const s = so(du.khung.filter((x) => ds.includes(x.ngay) && x.khung === k && x.ai === ai));
                    return <td key={k + ai} style={{ ...o, background: nen(s.chi, s.thu) }} title={`chi ${tien(s.chi)}`}><Roi {...s} /></td>; }))}</tr>; })}
              {khNgay.map((d) => <tr key={d}><td style={{ ...o, textAlign: 'left' }}>{ngan(d)}</td>
                {['07–15', '15–21', '21–07'].flatMap((k) => (['nha', 'doi'] as const).map((ai) => { const x = du.khung.find((y) => y.ngay === d && y.khung === k && y.ai === ai);
                  return <td key={k + ai} style={{ ...o, background: x ? nen(x.chi, x.thu) : undefined }} title={x ? `chi ${tien(x.chi)} · thu ${tien(x.thu)}` : ''}>{x ? <Roi chi={x.chi} thu={x.thu} /> : '—'}</td>; }))}</tr>)}
            </tbody>
          </table></div>
        </section>
      </div>
      <section style={the}>
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>24 giờ VN — 7 ngày đã khép <span style={{ color: 'var(--fg-3)', fontWeight: 400, fontSize: 12 }}>· doanh thu ghi dồn theo đợt đồng bộ nên từng giờ nhiễu, đọc theo khung</span></h3>
        <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
          <tbody>{(['nha', 'doi'] as const).map((ai) => (
            <tr key={ai}><td style={{ ...o, textAlign: 'left', fontWeight: 600 }}>{ai === 'nha' ? 'Nhà' : 'Đội'}</td>
              {Array.from({ length: 24 }, (_, i) => (i + 7) % 24).map((h) => { const x = du.gio.find((y) => y.h === h && y.ai === ai);
                return <td key={h} style={{ ...o, background: x ? nen(x.chi, x.thu) : undefined, textAlign: 'center' }} title={`${String(h).padStart(2, '0')}h · chi ${x ? tien(x.chi) : '$0'}`}>
                  <div style={{ color: 'var(--fg-3)', fontSize: 10 }}>{String(h).padStart(2, '0')}h</div>{x ? <Roi chi={x.chi} thu={x.thu} /> : '—'}</td>; })}</tr>))}</tbody>
        </table></div>
      </section>
    </div>
  );
}
