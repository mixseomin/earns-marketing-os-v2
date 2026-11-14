'use client';
// WIDGET SỐ của Tổng quan 2 etp (anh 01/11/2026 "cụm nhóm Insight dựa vào Người, Tài khoản và Time"): đọc gói taiTong2 (actions/etp-tong2.ts), theo kỳ đang chọn trên trang.
// Khoá của VE_SO phải có trong sổ lib/etp-widget.json (check-etp-gop-y đối chiếu) — thêm widget = mục trong sổ + một hàm ở đây.
import { useEffect, useMemo, useState } from 'react';
import { SimpleTable, StatsStrip } from '@/components/ui';
import { taiTong2, type SoTong2 } from '@/lib/actions/etp-tong2';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import type { VeWidget } from '@/components/etp-tong2';
import { Dem, KeToan } from '@/components/etp-so';
import { congNgay as congN, doiChieu, heSo, hieuChinh, mauCpm, mocMau, nen, ngayThiTruong, saiSo, type NhatKyDuDoan, type SoNgay } from '@/lib/etp-thi-truong';
import { useSoNho } from '@/lib/so-nho';

type ST = { chi: number; thu: number };
const cong = (rs: ST[]) => rs.reduce((a, r) => ({ chi: a.chi + r.chi, thu: a.thu + r.thu }), { chi: 0, thu: 0 });
const roi = (s: ST) => (s.chi >= 1 ? ((s.thu - s.chi) / s.chi) * 100 : null);
// tien() chỉ cho CHỮ (câu, tiêu đề, ô số lớn). Ô TIỀN TRONG BẢNG dùng <KeToan> (etp-so): luôn 2 số lẻ, dấu phẩy nghìn, $ mép trái, âm trong ngoặc (anh 12/11/2026 #1565 "trình bày chuẩn kế toán")
const tien = (v: number) => { const a = Math.abs(v); return `${v < 0 ? '−' : ''}$${a >= 10_000 ? `${(a / 1000).toFixed(1)}k` : a >= 100 ? a.toFixed(0) : a.toFixed(2)}`; };
const pct = (r: number | null) => (r == null ? '—' : `${r > 0 ? '+' : ''}${r.toFixed(0)}%`);
const XANH = 'var(--neon-lime, #4ade80)', DO = '#f87171', MO = 'var(--fg-3)';
const mauLai = (v: number) => (Math.abs(v) < 0.005 ? MO : v > 0 ? XANH : DO);
const congNgay = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const soNgayGiua = (tu: string, den: string) => Math.round((Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86_400_000) + 1;
/** ROI kỳ + ▲▼ so kỳ trước cùng độ dài — dùng chung cho dòng người và dòng Tổng */
const roiSoTruoc = (k: ST, t: ST) => { const r = roi(k), tr = roi(t); return <span title={tr == null ? undefined : `kỳ trước cùng độ dài: ${pct(tr)}`}>{pct(r)}{r != null && tr != null ? <small style={{ color: r >= tr ? XANH : DO, marginLeft: 4 }}>{r >= tr ? '▲' : '▼'}{Math.abs(r - tr).toFixed(0)}</small> : null}</span>; };
const diToi = (q: Record<string, string>) => { const u = new URL(location.href); for (const [k, v] of Object.entries(q)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); } location.href = u.href; };

/** ROI theo ngày — đường mini (viz một lần, không primitive) */
function DuongRoi({ v }: { v: (number | null)[] }) {
  const ok = v.filter((x): x is number => x != null); if (ok.length < 2) return <span style={{ color: MO }}>—</span>;
  const max = Math.max(...ok, 0), min = Math.min(...ok, 0), W = 64, H = 16, y = (x: number) => H - 1 - ((x - min) / (max - min || 1)) * (H - 2);
  const d = v.map((x, i) => (x == null ? null : `${(i / (v.length - 1)) * W},${y(x)}`)).filter(Boolean).join(' ');
  return <svg width={W} height={H} style={{ verticalAlign: 'middle' }}><line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" /><polyline points={d} fill="none" stroke={ok.at(-1)! >= 0 ? XANH : DO} strokeWidth={1.5} /></svg>;
}

const gioVn = (g: number) => String((g + 7) % 24).padStart(2, '0');   // giờ UTC của ngày Ethopex → giờ VN (ngày Ethopex bắt đầu 07:00 VN = 00 UTC)
const NHAN_LUAT = BANG_LUAT.khoa as Record<string, { nhan?: string[] }>;
// PHIM MỚI: mốc "đủ thử" (chi cả đời) và "thắng" (lãi cả đời) — cùng mốc phân tích 14/11/2026 (phim thắng = lãi ≥ $30)
// PM_NGAY = khung các ô tổng: 21 ngày (không phải 30) — lứa 19/10 là toàn bộ phim lúc hệ thống mới chạy, ôm vào thì "phim mới" trông đẹp hơn thật
const PM_DU = 20, PM_THANG = 30, PM_NGAY = 21;
const dauTuan = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const ngayThang = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const TEN_VIEC: Record<string, string> = { tat: '⏹ Tắt', giam: '↓ Hạ', tang: '↑ Tăng', nhan_ban: '⧉ Nhân bản' };

/** đường luỹ kế lãi theo giờ: hôm nay (đậm) · hôm qua · TB 7 ngày đã khép (nét đứt) */
function LuyKe({ s, rong, cao }: { s: SoTong2; rong: number; cao: number }) {
  const ngay = (d: string) => { let a = 0; return Array.from({ length: 24 }, (_, g) => { const r = s.gioNgay.filter((x) => x.d === d && x.g === g); a += r.reduce((t, x) => t + x.thu - x.chi, 0); return a; }); };
  const nay = ngay(s.nay).slice(0, s.gio + 1), qua = ngay(congNgay(s.nay, -1));
  const bay = Array.from({ length: 7 }, (_, i) => ngay(congNgay(s.nay, -1 - i))), tb = qua.map((_, g) => bay.reduce((t, d) => t + d[g]!, 0) / 7);
  const W = Math.max(200, rong), H = Math.max(80, cao - 18), PL = 44, PB = 16, all = [...nay, ...qua, ...tb, 0], max = Math.max(...all), min = Math.min(...all);
  const x = (g: number) => PL + (g / 23) * (W - PL - 6), y = (v: number) => 4 + ((max - v) / (max - min || 1)) * (H - PB - 8);
  const duong = (v: number[]) => v.map((t, g) => `${x(g)},${y(t)}`).join(' ');
  return <div style={{ fontSize: 11 }}>
    <div style={{ display: 'flex', gap: 12, color: 'var(--fg-2)' }}><span style={{ color: XANH }}>━ hôm nay {tien(nay.at(-1) ?? 0)}</span><span>━ hôm qua {tien(qua[s.gio] ?? 0)} cùng giờ</span><span style={{ color: MO }}>┅ TB 7 ngày {tien(tb[s.gio] ?? 0)}</span></div>
    <svg width={W} height={H} role="img" aria-label="lãi luỹ kế theo giờ">
      {[max, 0, min].filter((v, i, a) => a.indexOf(v) === i).map((v) => <g key={v}><line x1={PL} x2={W - 6} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v ? '3 3' : undefined} /><text x={PL - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="var(--fg-3)">{tien(v)}</text></g>)}
      {[0, 6, 12, 18, 23].map((g) => <text key={g} x={x(g)} y={H - 3} textAnchor="middle" fontSize={9} fill="var(--fg-3)">{gioVn(g)}h</text>)}
      <polyline points={duong(tb)} fill="none" stroke="var(--fg-3)" strokeDasharray="4 3" />
      <polyline points={duong(qua)} fill="none" stroke="var(--fg-2)" strokeWidth={1.2} />
      <polyline points={duong(nay)} fill="none" stroke={(nay.at(-1) ?? 0) >= 0 ? XANH : DO} strokeWidth={2.2} />
    </svg>
  </div>;
}

/** THỊ TRƯỜNG (anh 11/11/2026 "bảng CPM kia trong 30 ngày gần nhất… hoặc show theo kiểu lịch tháng. Ngày chưa đến thì dự đoán. Dùng màu sắc, số, gradient"):
 *  lịch nhiệt tháng (ô = ngày Ethopex, màu = CPM so với nền: xanh rẻ → đỏ đắt; ô sọc nét đứt = dự đoán) · bảng 30 ngày + 14 ngày dự đoán. Hàm số: lib/etp-thi-truong.ts */
function ThiTruong({ t, nay, rong, cao }: { t: { so: Record<string, SoNgay>; tranMoi: { tran: number; ly_do: string } | null; nk: NhatKyDuDoan }; nay: string; rong: number; cao: number }) {
  const [che, setChe] = useState<'lich' | 'bang' | 'doi'>('lich'); const [th, setTh] = useState(0);
  const hc = hieuChinh(t.so, nay), us = (d: string) => t.so[d]?.nuoc?.US, tyUs = (d: string) => { const v = t.so[d]; return v?.nuoc?.US && v.chi ? v.nuoc.US.chi / v.chi : null; };
  const nuocChu = (d: string) => Object.entries(t.so[d]?.nuoc ?? {}).slice(0, 5).map(([k, x]) => `${k} ${t.so[d]!.chi ? Math.round((x.chi / t.so[d]!.chi) * 100) : 0}% · CPM ${x.cpm == null ? '—' : `$${x.cpm.toFixed(1)}`} · ROI ${pct(x.roi)}`).join('\n');
  const n = nen(t.so, nay), nenCpm = mocMau(t.so, nay), ss = saiSo(t.so, nay), bien = (v: number | null) => (v == null ? '' : ` ±${Math.round(v)}%`);   // nenCpm = mốc màu TB 30 ngày
  const g = new Date(`${nay}T00:00:00Z`), m0 = new Date(Date.UTC(g.getUTCFullYear(), g.getUTCMonth() + th, 1));
  const dau = m0.toISOString().slice(0, 10), soNgayThang = new Date(Date.UTC(m0.getUTCFullYear(), m0.getUTCMonth() + 1, 0)).getUTCDate();
  const lech = (m0.getUTCDay() + 6) % 7, soO = Math.ceil((lech + soNgayThang) / 7) * 7, tu = congN(dau, -lech);
  const ds = che === 'lich' ? ngayThiTruong(t.so, nay, tu, congN(tu, soO - 1)) : ngayThiTruong(t.so, nay, congN(nay, -29), congN(nay, 14)).reverse();
  const thang = m0.getUTCMonth(), cpm$ = (v: number | null) => (v == null ? '—' : `$${v.toFixed(v >= 100 ? 0 : 1)}`);
  const nutC = (on: boolean): React.CSSProperties => ({ fontSize: 11, padding: '1px 8px', borderRadius: 5, border: '1px solid var(--line)', background: on ? 'var(--bg-2)' : 'transparent', color: on ? 'var(--fg-1)' : 'var(--fg-3)', cursor: 'pointer' });
  const dauTrang = <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 4 }}>
    <span style={{ display: 'inline-flex', gap: 2 }}><button type="button" style={nutC(che === 'lich')} onClick={() => setChe('lich')}>Lịch tháng</button><button type="button" style={nutC(che === 'bang')} onClick={() => setChe('bang')}>Bảng 30 ngày</button><button type="button" style={nutC(che === 'doi')} onClick={() => setChe('doi')} title="nhật ký: dự đoán máy chụp 13:00 VN mỗi ngày ↔ CPM thật khi ngày đó khép">Đoán ↔ thật</button></span>
    {che === 'lich' ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><button type="button" style={nutC(false)} disabled={th <= -1} onClick={() => setTh(th - 1)}>◀</button><b>tháng {thang + 1}/{m0.getUTCFullYear()}</b><button type="button" style={nutC(false)} disabled={th >= 2} onClick={() => setTh(th + 1)}>▶</button></span> : null}
    <span title="màu ô = CPM ngày đó ÷ CPM nền (TB 3 ngày đã khép, đã bỏ hệ số mùa)" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-3)' }}>rẻ<span style={{ width: 70, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${mauCpm(16, 20, 0.9)}, ${mauCpm(24, 20, 0.9)}, ${mauCpm(32, 20, 0.9)})` }} />đắt</span>
    <span style={{ color: 'var(--fg-2)' }} title={`mốc màu = CPM TB 30 ngày đã khép · nền dự đoán = CPM ngày ${n?.d ?? '—'} (hôm qua) đã bỏ hệ số mùa`}>TB 30 ngày {cpm$(nenCpm)} · nền dự đoán {cpm$(n?.cpm ?? null)} · CPC {n ? `$${n.cpc.toFixed(2)}` : '—'} · ROI {pct(n?.roi ?? null)}</span>
    {n && us(n.d)?.cpm != null ? <span title="CPM chung đổi theo cả giá thị trường lẫn tỉ trọng nước — CPM Mỹ mới là giá thị trường Mỹ" style={{ color: 'var(--fg-2)' }}>Mỹ hôm qua {cpm$(us(n.d)!.cpm)} · {Math.round((tyUs(n.d) ?? 0) * 100)}% chi</span> : null}
    {hc ? <span title={`đã có ${hc.n} ngày mùa lễ khép: phần tăng thật = ${Math.round(hc.k * 100)}% phần tăng giả định → hệ số các ngày lễ còn lại nhân theo`} style={{ color: '#f59e0b' }}>hệ số lễ tự chỉnh ×{hc.k.toFixed(2)}</span> : null}
    {t.tranMoi ? <span title={t.tranMoi.ly_do} style={{ color: 'var(--fg-2)' }}>trần camp mới hôm nay <b>{t.tranMoi.tran}</b></span> : null}
    <span style={{ color: MO }} title={`dự đoán = CPM hôm qua × hệ số mùa · sai số đo trên số nhà: 1 ngày${bien(ss[1])} · 3 ngày${bien(ss[3])} · 7 ngày${bien(ss[7])} · hệ số Black Friday / Cyber Monday / 1–2/12 theo số công khai BFCM 2025 (Lebesgue, Biddyco, AdScale), các ngày khác là giả định · ROI không dự đoán`}>ô sọc = dự đoán (sai 1 / 3 / 7 ngày:{bien(ss[1])}{bien(ss[3])}{bien(ss[7])})</span>
  </div>;
  if (che === 'doi') {   // NHẬT KÝ DỰ ĐOÁN ↔ THỰC TẾ (anh 11/11/2026): apps/etp/du_doan_cpm.py chụp mỗi ngày, lib doiChieu đặt cạnh số thật
    const { dong, tb } = doiChieu(t.so, t.nk, nay), o_ = (x: { cpm: number; lech: number; dl: boolean } | null) => (!x ? <span style={{ color: MO }}>—</span>
      : <span title={x.dl ? 'DỰNG LẠI — ngày này trước khi máy bắt đầu chụp (11/11/2026), đoán lại bằng đúng cách hiện tại trên số cũ' : 'bản máy chụp lúc 13:00 VN ngày làm'} style={{ fontStyle: x.dl ? 'italic' : undefined }}>
          {cpm$(x.cpm)} <b style={{ color: Math.abs(x.lech) <= 10 ? XANH : Math.abs(x.lech) <= 25 ? '#f59e0b' : DO }}>{x.lech > 0 ? '+' : ''}{Math.round(x.lech)}%</b>{x.dl ? <small style={{ color: MO }}> dl</small> : null}</span>);
    return <div style={{ fontSize: 11 }}>{dauTrang}
      <div style={{ color: 'var(--fg-2)', margin: '2px 0 4px' }}>lệch TB (tuyệt đối) đoán trước 1 ngày <b>{tb[1] == null ? '—' : `${Math.round(tb[1])}%`}</b> · 3 ngày <b>{tb[3] == null ? '—' : `${Math.round(tb[3])}%`}</b> · 7 ngày <b>{tb[7] == null ? '—' : `${Math.round(tb[7])}%`}</b>
        <span style={{ color: MO }}> · + = đoán cao hơn thật · <i>dl</i> = dựng lại (trước 11/11), từ 11/11 là bản máy chụp thật · xanh ≤ 10% · vàng ≤ 25% · đỏ &gt; 25%</span></div>
      {dong.length ? <SimpleTable rows={dong} getRowKey={(r) => r.d} columns={[
        { key: 'd', header: 'Ngày', cell: (r) => `${r.d.slice(8, 10)}/${r.d.slice(5, 7)}` },
        { key: 'that', header: 'CPM thật', align: 'right', cell: (r) => <span style={{ padding: '0 6px', borderRadius: 4, background: mauCpm(r.that, nenCpm) }}>{cpm$(r.that)}</span> },
        { key: 'd1', header: 'Đoán trước 1 ngày', align: 'right', cell: (r) => o_(r.doan[1]) },
        { key: 'd3', header: 'Trước 3 ngày', align: 'right', cell: (r) => o_(r.doan[3]) },
        { key: 'd7', header: 'Trước 7 ngày', align: 'right', cell: (r) => o_(r.doan[7]) },
      ]} /> : <span style={{ color: MO }}>chưa có nhật ký — máy chụp lần đầu sau 13:00 VN (apps/etp/du_doan_cpm.py)</span>}</div>;
  }
  if (che === 'bang') return <div style={{ fontSize: 11 }}>{dauTrang}<SimpleTable rows={ds} getRowKey={(o) => o.d} rowStyle={(o) => (o.du ? { opacity: 0.75, fontStyle: 'italic' } : o.d === nay ? { fontWeight: 600 } : undefined)} columns={[
    { key: 'd', header: 'Ngày', cell: (o) => <span>{o.d.slice(8, 10)}/{o.d.slice(5, 7)}{o.d === nay ? ' (hôm nay)' : ''}{o.du ? ' · dự đoán' : ''}{o.le ? <b style={{ color: '#f59e0b' }}> · {o.le}</b> : null}</span> },
    { key: 'chi', header: 'Chi', align: 'right', cell: (o) => (o.chi == null ? '—' : <KeToan v={o.chi} />) },
    { key: 'cpm', header: 'CPM', align: 'right', cell: (o) => <span style={{ display: 'inline-block', minWidth: 52, padding: '0 6px', borderRadius: 4, background: mauCpm(o.cpm, nenCpm), fontVariantNumeric: 'tabular-nums' }}>{cpm$(o.cpm)}</span> },
    { key: 'so', header: 'So TB 30n', align: 'right', cell: (o) => (o.cpm == null || !nenCpm ? '—' : `${Math.round((o.cpm / nenCpm) * 100)}%`) },
    { key: 'sai', header: 'Biên sai', align: 'right', cell: (o) => (o.du ? (o.sai == null ? 'chưa đủ số' : `±${Math.round(o.sai)}%`) : '') },
    { key: 'us', header: 'CPM Mỹ', align: 'right', cell: (o) => { const x = us(o.d); return x?.cpm == null ? '—' : <span title={nuocChu(o.d)}>{cpm$(x.cpm)}</span>; } },
    { key: 'tyus', header: '% chi Mỹ', align: 'right', cell: (o) => { const r = tyUs(o.d); return r == null ? '—' : `${Math.round(r * 100)}%`; } },
    { key: 'cpc', header: 'CPC', align: 'right', cell: (o) => (o.cpc == null ? '—' : `$${o.cpc.toFixed(2)}`) },
    { key: 'roi', header: 'ROI', align: 'right', cell: (o) => <span style={{ color: o.roi == null ? MO : o.roi >= 0 ? XANH : DO }}>{pct(o.roi)}</span> },
  ]} /></div>;
  const hang = soO / 7, oH = Math.max(30, Math.floor((cao - 46 - 16 - (hang - 1) * 3) / hang)), rongO = (Math.max(280, rong) - 6 * 3) / 7, to = rongO >= 74 && oH >= 44;
  return <div style={{ fontSize: 11 }}>{dauTrang}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
      {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => <div key={w} style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 10 }}>{w}</div>)}
      {ds.map((o) => {
        const ngoai = new Date(`${o.d}T00:00:00Z`).getUTCMonth() !== thang;
        const tit = [`${o.d}${o.le ? ` · ${o.le}` : ''}${o.du ? ' · DỰ ĐOÁN' : o.d === nay ? ' · hôm nay (chưa khép)' : ''}`,
          o.cpm == null ? 'chưa có số' : `CPM ${cpm$(o.cpm)}${nenCpm ? ` = ${Math.round((o.cpm / nenCpm) * 100)}% TB 30 ngày` : ''} · CPC ${o.cpc == null ? '—' : `$${o.cpc.toFixed(2)}`}`,
          ...(t.so[o.d]?.nuoc ? [nuocChu(o.d)] : []),
          o.du ? `hệ số mùa ×${o.heSo}${heSo(o.d).nguon ? '' : ' (giả định)'} · biên sai ${o.sai == null ? 'chưa đủ số đo' : `±${Math.round(o.sai)}%`}` : `chi ${o.chi == null ? '—' : tien(o.chi)} · ROI ${pct(o.roi)}`].join('\n');
        return <div key={o.d} title={tit}
          style={{ height: oH, borderRadius: 6, padding: '2px 5px', overflow: 'hidden', opacity: ngoai ? 0.35 : 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: o.du ? `repeating-linear-gradient(135deg, ${mauCpm(o.cpm, nenCpm, 0.34)} 0 6px, ${mauCpm(o.cpm, nenCpm, 0.16)} 6px 12px)` : mauCpm(o.cpm, nenCpm),
            border: o.d === nay ? '2px solid var(--fg-1)' : o.du ? '1px dashed var(--fg-3)' : '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 2, color: 'var(--fg-2)', fontSize: 10 }}><span>{Number(o.d.slice(8))}</span>{o.le ? <b style={{ color: '#f59e0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.le}</b> : o.du ? <span>dự</span> : null}</div>
          <b style={{ fontSize: to ? 14 : 11, fontVariantNumeric: 'tabular-nums', fontStyle: o.du ? 'italic' : undefined }}>{cpm$(o.cpm)}</b>
          {to ? <div style={{ fontSize: 10, color: o.roi == null ? MO : o.roi >= 0 ? XANH : DO }}>{o.du ? (o.sai == null ? `×${o.heSo}` : `±${Math.round(o.sai)}%`) : o.roi == null ? ' ' : `ROI ${pct(o.roi)}`}</div> : null}
        </div>;
      })}
    </div>
  </div>;
}

export function useVeSo(ky: { tu: string; den: string }): Record<string, VeWidget> {
  const { so: s } = useSoNho<SoTong2>('tong2', taiTong2, 120_000);   // bản lần trước hiện ngay, tải mới ngầm (anh 13/11/2026 widget Người đứng "đang tải số…")

  const x = useMemo(() => {
    if (!s) return null;
    const qua = congNgay(s.nay, -1), tu = ky.tu < '2000' ? (s.nguoiNgay.map((r) => r.d).sort()[0] ?? s.nay) : ky.tu, den = ky.den;
    const dai = soNgayGiua(tu, den), tuTruoc = congNgay(tu, -dai), denTruoc = congNgay(tu, -1);
    const trong = (d: string, a: string, b: string) => d >= a && d <= b;
    const ngay7 = Array.from({ length: 7 }, (_, i) => congNgay(s.nay, i - 7));   // 7 ngày đã khép
    const nguoi = s.nguoi.map((p) => {
      const rs = s.nguoiNgay.filter((r) => r.n === p.id), k = cong(rs.filter((r) => trong(r.d, tu, den))), t = cong(rs.filter((r) => trong(r.d, tuTruoc, denTruoc)));
      const r3 = roi(cong(rs.filter((r) => trong(r.d, ngay7[4]!, qua)))), r7 = roi(cong(rs.filter((r) => trong(r.d, ngay7[0]!, qua))));
      const tks = s.tk.filter((a) => a.n === p.id).map((a) => a.id), nay = s.tkNay.filter((a) => tks.includes(a.tk));
      return { ...p, k, t, r3, r7, duong: ngay7.map((d) => roi(cong(rs.filter((r) => r.d === d)))), camp: nay.reduce((a, b) => a + b.chay, 0), ns: nay.reduce((a, b) => a + b.ns, 0) };
    });
    const tk = s.tk.map((a) => {
      const rs = s.tkNgay.filter((r) => r.tk === a.id), k = cong(rs.filter((r) => trong(r.d, tu, den))), nay = s.tkNay.find((r) => r.tk === a.id);
      const homNay = cong(rs.filter((r) => r.d === s.nay)), ba = [1, 2, 3].map((i) => cong(rs.filter((r) => r.d === congNgay(s.nay, -i))));
      const nguoiChi = cong(s.tkNgay.filter((r) => s.tk.find((b) => b.id === r.tk)?.n === a.n && trong(r.d, tu, den))).chi;
      const co: string[] = [];
      if (ba.every((b) => b.chi > 0 && b.thu < b.chi)) co.push('lỗ 3 ngày đã khép liền');
      if (nguoiChi > 0 && k.chi / nguoiChi > 0.4 && s.tk.filter((b) => b.n === a.n && cong(s.tkNgay.filter((r) => r.tk === b.id && trong(r.d, tu, den))).chi > 0).length >= 2) co.push(`dồn ${Math.round((k.chi / nguoiChi) * 100)}% chi của người`);
      if ((nay?.loi ?? 0) > 0) co.push(`${nay!.loi} camp lỗi`);
      if ((nay?.chay ?? 0) > 0 && homNay.chi === 0 && ba[0]!.chi === 0) co.push('có camp bật mà 24 giờ không chi');
      return { ...a, k, chay: nay?.chay ?? 0, ns: nay?.ns ?? 0, tieu: nay?.ns ? homNay.chi / nay.ns : null, co };
    });
    return { qua, tu, den, dai, nguoi, tk };
  }, [s, ky.tu, ky.den]);

  const cho = <span style={{ color: MO, fontSize: 12 }}>đang tải số…</span>;
  return {
    // PHÂN BỔ NGÂN SÁCH (anh 02/11/2026 "kế hoạch này hãy cho vào Tổng quan 2"): ngân sách camp nhà đang bật so với trần ngày + từng nhóm so với mục tiêu kế hoạch
    // (nhóm tính sống trên máy chủ theo 3 ngày đã khép; mục tiêu / cách làm = etp.cau_hinh 'phan_bo', sửa không cần deploy)
    // PHIM MỚI — KHẢ NĂNG TÌM RA PHIM HIỆU QUẢ (anh 14/11/2026): phim xếp theo ngày nhà chi đầu tiên; đủ thử = chi cả đời ≥ $PM_DU, thắng = lãi cả đời ≥ $PM_THANG
    // (mọi bộ, cả ★ ROAS, chỉ ngày đã khép). Tỷ lệ thắng tính trên phim đủ thử. Tuần kết thúc trong 7 ngày gần nhất → phim còn non, ghi "đang thử".
    phim_moi: () => {
      if (!s) return cho;
      if (!s.phimMoi) return <span style={{ color: MO, fontSize: 12 }}>số phim mới chỉ có ở tài khoản nhà</span>;
      type P = NonNullable<SoTong2['phimMoi']>[number];
      const qua = congNgay(s.nay, -1), tuK = congNgay(s.nay, -PM_NGAY), moc = congNgay(qua, -7);
      const thang = (r: P) => r.thu - r.chi >= PM_THANG, du = (r: P) => r.chi >= PM_DU;
      const gom = (rs: P[]) => { const d = rs.filter(du).length, w = rs.filter(thang).length, thua = rs.filter((r) => !thang(r)).reduce((a, r) => a + r.chi, 0);
        return { n: rs.length, d, w, k: cong(rs), tile: d ? (w / d) * 100 : null, giaThang: w ? thua / w : null }; };
      const g30 = gom(s.phimMoi.filter((r) => r.d0 >= tuK));
      const tuan = [...new Set(s.phimMoi.map((r) => dauTuan(r.d0)))].sort().reverse().slice(0, 8)
        .map((t) => ({ t, non: congNgay(t, 6) > moc, ...gom(s.phimMoi!.filter((r) => dauTuan(r.d0) === t)) }));
      const moi = s.phimMoi.filter((r) => r.d0 >= tuK && thang(r)).sort((a, b) => (b.thu - b.chi) - (a.thu - a.chi)).slice(0, 6);
      const tl = (v: number | null) => (v == null ? '—' : `${v.toFixed(0)}%`);
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        <StatsStrip minColWidth={120} cards={[
          { key: 'thu', label: `Phim thử ${PM_NGAY} ngày`, value: String(g30.n), sub: `${g30.d} phim đủ thử (chi ≥ $${PM_DU})`, title: `phim nhà bắt đầu chi trong ${PM_NGAY} ngày gần nhất (ngày Ethopex đã khép)` },
          { key: 'thang', label: 'Phim thắng', value: String(g30.w), color: g30.w ? XANH : DO, sub: `tỷ lệ ${tl(g30.tile)} phim đủ thử`, title: `lãi cả đời ≥ $${PM_THANG} (mọi bộ, cả ★ ROAS)` },
          { key: 'lai', label: 'Lãi ròng phim mới', value: tien(g30.k.thu - g30.k.chi), color: mauLai(g30.k.thu - g30.k.chi), sub: `ROI ${pct(roi(g30.k))} · chi ${tien(g30.k.chi)}`, title: `cộng mọi phim bắt đầu trong ${PM_NGAY} ngày, kể cả phim thua` },
          { key: 'gia', label: 'Tiền thử / phim thắng', value: g30.giaThang == null ? '—' : tien(g30.giaThang), sub: 'chi của phim chưa thắng ÷ số phim thắng', title: 'mỗi phim thắng tìm được tốn bao nhiêu tiền thử các phim còn lại' },
        ]} />
        <SimpleTable rows={tuan} getRowKey={(r) => r.t} columns={[
          { key: 't', header: 'Tuần bắt đầu', cell: (r) => <span title={`phim nhà chi lần đầu từ ${ngayThang(r.t)} tới ${ngayThang(congNgay(r.t, 6))}`}>{ngayThang(r.t)}{r.non ? <small style={{ color: MO, marginLeft: 4 }}>đang thử</small> : null}</span> },
          { key: 'n', header: 'Phim', align: 'right', cell: (r) => <Dem v={r.n} /> },
          { key: 'd', header: 'Đủ thử', align: 'right', cell: (r) => <Dem v={r.d} /> },
          { key: 'w', header: 'Thắng', align: 'right', cell: (r) => <b style={{ color: r.w ? XANH : MO }}>{r.w}</b> },
          { key: 'tl', header: 'Tỷ lệ', align: 'right', cell: (r) => tl(r.tile) },
          { key: 'chi', header: 'Chi', align: 'right', cell: (r) => <KeToan v={r.k.chi} /> },
          { key: 'lai', header: 'Lãi', align: 'right', cell: (r) => <KeToan v={r.k.thu - r.k.chi} mau={mauLai(r.k.thu - r.k.chi)} /> },
          { key: 'roi', header: 'ROI', align: 'right', cell: (r) => { const v = roi(r.k); return <span style={{ color: v == null ? MO : v >= 0 ? XANH : DO }}>{pct(v)}</span>; } },
        ]} />
        {moi.length ? <SimpleTable rows={moi} getRowKey={(r) => String(r.p)} columns={[
          { key: 'p', header: `Phim thắng mới (${PM_NGAY} ngày)`, cell: (r) => <span title={`${r.ten}${r.tl ? ` · ${r.tl}` : ''}${r.nn ? ` · ${r.nn}` : ''}`} style={{ display: 'inline-block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{r.ten}</span> },
          { key: 'd0', header: 'Bắt đầu', align: 'right', cell: (r) => ngayThang(r.d0) },
          { key: 'bo', header: 'Bộ', align: 'right', cell: (r) => r.bo ?? '—' },
          { key: 'lai', header: 'Lãi', align: 'right', cell: (r) => <KeToan v={r.thu - r.chi} mau={XANH} /> },
          { key: 'roi', header: 'ROI', align: 'right', cell: (r) => pct(roi(r)) },
        ]} /> : <span style={{ color: MO }}>{PM_NGAY} ngày qua chưa có phim mới nào lãi từ ${PM_THANG}</span>}
      </div>;
    },
    phan_bo: () => {
      if (!s) return cho;
      const pb = s.phanBo;
      if (!pb) return <span style={{ color: MO, fontSize: 12 }}>kế hoạch phân bổ chỉ có ở tài khoản nhà</span>;
      const tran = pb.tran, dung = tran ? Math.min(1, pb.tong / tran) : 0;
      const tongMuc = pb.nhom.reduce((a, k) => a + (k.muc ? k.muc[1] : 0), 0);
      const lech = (k: (typeof pb.nhom)[number]) => (!k.muc ? null : k.ns > k.muc[1] + 0.5 ? 'tren' : k.ns < k.muc[0] - 0.5 ? 'duoi' : null);
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        <div title="tổng ngân sách ngày các camp nhà đang bật so với trần ngày (etp.cau_hinh tran_ngay — cổng chung chặn mọi lệnh làm vượt)">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><b style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{tien(pb.tong)}</b>
            <span style={{ color: MO }}>/ngày đang bật{tran ? ` · trần ${tien(tran)} · còn ${tien(Math.max(0, tran - pb.tong))}` : ' · chưa đặt trần'}</span>
            {tran ? <span style={{ marginLeft: 'auto', color: MO }} title="trần − tổng mục tiêu cao của các nhóm: chỗ chừa cho tăng bậc">đệm kế hoạch {tien(Math.max(0, tran - tongMuc))}</span> : null}</div>
          {tran ? <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 4, overflow: 'hidden' }}><div style={{ width: `${(dung * 100).toFixed(1)}%`, height: '100%', background: dung > 0.95 ? DO : XANH }} /></div> : null}
        </div>
        <SimpleTable rows={pb.nhom} getRowKey={(k) => k.ma} columns={[
          { key: 'ten', header: 'Nhóm', cell: (k) => <span title="3 ngày đã khép gần nhất · camp mới < 3 ngày tính là test">{k.ten}</span> },
          { key: 'camp', header: 'Camp', align: 'right', cell: (k) => <Dem v={k.camp} /> },
          { key: 'ns', header: 'Đang', align: 'right', cell: (k) => { const l = lech(k); return <b style={{ color: l === 'tren' ? DO : l === 'duoi' ? '#f59e0b' : undefined, fontVariantNumeric: 'tabular-nums' }} title={l === 'tren' ? 'cao hơn mục tiêu' : l === 'duoi' ? 'thấp hơn mục tiêu' : 'trong mục tiêu'}><KeToan v={k.ns} mau={l === 'tren' ? DO : l === 'duoi' ? '#f59e0b' : undefined} /></b>; } },
          { key: 'muc', header: 'Mục tiêu', align: 'right', cell: (k) => (!k.muc ? '—' : k.muc[0] === k.muc[1] ? tien(k.muc[0]) : `${tien(k.muc[0])}–${tien(k.muc[1])}`) },
          { key: 'roi', header: 'ROI 3n', align: 'right', cell: (k) => { const r = roi({ chi: k.chi3, thu: k.thu3 }); return <span style={{ color: r == null ? MO : r >= 0 ? XANH : DO }}>{pct(r)}</span>; } },
          { key: 'lai', header: 'Lãi/ngày', align: 'right', cell: (k) => <KeToan v={(k.thu3 - k.chi3) / 3} mau={mauLai(k.thu3 - k.chi3)} /> },
          { key: 'cach', header: 'Cách làm', cell: (k) => <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{k.cach}</span> },
        ]} />
      </div>;
    },
    nam_nhanh: () => {
      if (!s || !x) return cho;
      const quaS = cong(s.nguoiNgay.filter((r) => r.d === x.qua)), tb7 = cong(s.nguoiNgay.filter((r) => r.d >= congNgay(s.nay, -7) && r.d < s.nay)), laiTb = (tb7.thu - tb7.chi) / 7;
      // nhịp hôm nay: lãi tới giờ này so với hôm qua cùng giờ (số giờ nhà + đội; vai người không có số giờ)
      const toiGio = (d: string) => cong(s.gioNgay.filter((r) => r.d === d && r.g <= s.gio));
      const nayG = toiGio(s.nay), quaG = toiGio(x.qua), coGio = s.gioNgay.length > 0;
      const tut = [...x.nguoi].filter((p) => p.r3 != null && p.r7 != null).sort((a, b) => (a.r3! - a.r7!) - (b.r3! - b.r7!))[0];
      const do_ = x.tk.filter((a) => a.co.length);
      return <StatsStrip minColWidth={130} cards={[
        { key: 'qua', label: 'Lãi hôm qua', value: tien(quaS.thu - quaS.chi), color: mauLai(quaS.thu - quaS.chi), sub: `ROI ${pct(roi(quaS))} · TB 7 ngày ${tien(laiTb)}/ngày`, title: 'ngày Ethopex hôm qua (07:00–07:00 VN), mọi người đang xem' },
        coGio ? { key: 'nhip', label: `Nhịp hôm nay tới ${String((s.gio + 7) % 24).padStart(2, '0')}:00`, value: tien(nayG.thu - nayG.chi), color: mauLai(nayG.thu - nayG.chi),
          sub: `chi ${tien(nayG.chi)} · hôm qua cùng giờ ${tien(quaG.thu - quaG.chi)}`, title: 'lãi luỹ kế hôm nay tới giờ này (giờ VN) so với hôm qua tới cùng giờ — số giờ nhà + đội' }
          : { key: 'nhip', label: 'Hôm nay', value: tien(cong(s.nguoiNgay.filter((r) => r.d === s.nay)).thu - cong(s.nguoiNgay.filter((r) => r.d === s.nay)).chi), sub: 'tới giờ này' },
        { key: 'tut', label: 'Người tụt mạnh nhất', value: tut ? tut.ten : '—', color: tut && tut.r3! < tut.r7! ? DO : undefined, sub: tut ? `ROI 3 ngày ${pct(tut.r3)} · 7 ngày ${pct(tut.r7)}` : 'chưa đủ số', title: 'ROI 3 ngày đã khép so với 7 ngày đã khép' },
        { key: 'tk', label: 'Tài khoản cần xem', value: `${do_.length}/${x.tk.length}`, color: do_.length ? DO : MO, sub: do_.slice(0, 3).map((a) => a.ten).join(' · ') || 'không có cờ', title: do_.map((a) => `${a.ten}: ${a.co.join(', ')}`).join('\n') || undefined },
        ...(s.luat ? [{ key: 'luat', label: 'Luật nhịp tới (nhà)', value: `↑${s.luat.tang} ↓${s.luat.giam} ✕${s.luat.tat}`, sub: 'bấm xem bản luật', title: 'số camp máy luật nhà xếp tăng / giảm / tắt ở nhịp tới', onClick: () => diToi({ t: 'luat' }) }] : []),
      ]} />;
    },
    nguoi: () => {
      if (!x || !s) return cho;
      // dòng Tổng (sticky đáy, #1581): cộng chi/thu kỳ + kỳ trước của mọi người đang hiện, ROI tính từ tổng (không cộng %), đường ROI 7 ngày từ tổng từng ngày
      const tk = cong(x.nguoi.map((p) => p.k)), tt = cong(x.nguoi.map((p) => p.t));
      const ids = new Set(x.nguoi.map((p) => p.id)), ngay7 = Array.from({ length: 7 }, (_, i) => congNgay(s.nay, i - 7));
      const tong = {
        ten: `Tổng (${x.nguoi.length} người)`,
        chi: <KeToan v={tk.chi} />,
        lai: <KeToan v={tk.thu - tk.chi} mau={mauLai(tk.thu - tk.chi)} />,
        roi: roiSoTruoc(tk, tt),
        camp: <span title={`ngân sách ${tien(x.nguoi.reduce((a, p) => a + p.ns, 0))}/ngày`}><Dem v={x.nguoi.reduce((a, p) => a + p.camp, 0)} /></span>,
        duong: <DuongRoi v={ngay7.map((d) => roi(cong(s.nguoiNgay.filter((r) => r.d === d && ids.has(r.n)))))} />,
      };
      return <SimpleTable rows={x.nguoi} getRowKey={(p) => String(p.id)} tong={tong} rowStyle={(p) => (p.nha ? { fontWeight: 600 } : undefined)} columns={[
        { key: 'ten', header: 'Người', cell: (p) => <a href={`?t=camp${p.nha ? '' : `&ng=${p.id}`}`} style={{ color: 'inherit' }} title="xem camp của người này">{p.ten}{p.nha ? ' (nhà)' : ''}</a> },
        { key: 'chi', header: 'Chi', align: 'right', cell: (p) => <KeToan v={p.k.chi} /> },
        { key: 'lai', header: 'Lãi', align: 'right', cell: (p) => <KeToan v={p.k.thu - p.k.chi} mau={mauLai(p.k.thu - p.k.chi)} /> },
        { key: 'roi', header: 'ROI', align: 'right', cell: (p) => roiSoTruoc(p.k, p.t) },
        { key: 'camp', header: 'Camp bật', align: 'right', title: 'camp ACTIVE lúc này · tổng ngân sách / ngày', cell: (p) => <span title={`ngân sách ${tien(p.ns)}/ngày`}><Dem v={p.camp} /></span> },
        { key: 'duong', header: 'ROI 7 ngày', title: 'ROI từng ngày, 7 ngày đã khép', cell: (p) => <DuongRoi v={p.duong} /> },
      ]} />;
    },
    nha_thua: () => {
      if (!s || !x) return cho;
      const nha = s.nguoi.find((p) => p.nha); if (!nha || s.nguoi.length < 2) return <span style={{ color: MO, fontSize: 12 }}>cần số của nhà và ít nhất một người khác</span>;
      // phim cả nhà và đội cùng chạy 7 ngày đã khép: ROI đội tốt nhất trừ ROI nhà — chênh nhiều nhất trước
      const theo = new Map<number, typeof s.phim>(); for (const r of s.phim) theo.set(r.p, [...(theo.get(r.p) ?? []), r]);
      const ds = [...theo.values()].flatMap((rs) => {
        const n = rs.find((r) => r.n === nha.id), doi = rs.filter((r) => r.n !== nha.id && r.chi >= 20).sort((a, b) => roi(b)! - roi(a)!)[0];
        return n && doi && n.chi >= 20 && roi(doi)! > roi(n)! ? [{ ten: n.ten, nha: n, doi, chenh: roi(doi)! - roi(n)! }] : [];
      }).sort((a, b) => b.chenh - a.chenh).slice(0, 6);
      if (!ds.length) return <span style={{ color: MO, fontSize: 12 }}>7 ngày đã khép: phim chung nào nhà cũng không thua đội</span>;
      const ten = (id: number) => s.nguoi.find((p) => p.id === id)?.ten ?? `#${id}`;
      return <SimpleTable rows={ds} getRowKey={(r) => r.ten} columns={[
        { key: 'p', header: 'Phim (7 ngày đã khép)', cell: (r) => <span title={r.ten} style={{ display: 'inline-block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{r.ten}</span> },
        { key: 'nha', header: 'Nhà', align: 'right', cell: (r) => <span title={`chi ${tien(r.nha.chi)}`}>{pct(roi(r.nha))}</span> },
        { key: 'doi', header: 'Đội tốt nhất', align: 'right', cell: (r) => <span title={`chi ${tien(r.doi.chi)}`}>{ten(r.doi.n)} {pct(roi(r.doi))}</span> },
        { key: 'c', header: 'Chênh', align: 'right', cell: (r) => <b style={{ color: DO }}>{r.chenh.toFixed(0)} điểm</b> },
      ]} />;
    },
    gio_nhiet: ({ rong, cao }) => {
      if (!s) return cho;
      if (!s.gioNgay.length) return <span style={{ color: MO, fontSize: 12 }}>số theo giờ chỉ có ở tài khoản nhà</span>;
      const ds = [...new Set(s.gioNgay.map((r) => r.d))].sort().reverse(), o = new Map(s.gioNgay.map((r) => [`${r.d}|${r.g}`, { chi: 0, thu: 0 }]));
      for (const r of s.gioNgay) { const t = o.get(`${r.d}|${r.g}`)!; t.chi += r.chi; t.thu += r.thu; }
      const cotG = Array.from({ length: 24 }, (_, g) => g), tong = cotG.map((g) => cong(ds.filter((d) => d !== s.nay).map((d) => o.get(`${d}|${g}`) ?? { chi: 0, thu: 0 })));
      const cw = Math.max(10, Math.floor((rong - 44) / 24)), ch = Math.max(8, Math.min(22, Math.floor((cao - 34) / (ds.length + 1)) - 1));
      const mau = (t?: ST) => { if (!t || t.chi < 0.5) return 'var(--bg-2)'; const r = (t.thu - t.chi) / t.chi; return r >= 0 ? `rgba(74,222,128,${Math.min(0.85, 0.15 + r)})` : `rgba(248,113,113,${Math.min(0.85, 0.15 - r)})`; };
      const o_ = (t: ST | undefined, ten: string) => <span title={t && t.chi >= 0.01 ? `${ten} · chi ${tien(t.chi)} · thu ${tien(t.thu)} · lãi ${tien(t.thu - t.chi)} · ROI ${pct(roi(t))}` : `${ten} · không chi`} style={{ width: cw, height: ch, background: mau(t), borderRadius: 2 }} />;
      return <div style={{ fontSize: 9, color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', gap: 1, paddingLeft: 42 }}>{cotG.map((g) => <span key={g} style={{ width: cw, textAlign: 'center' }}>{g % 3 === 0 ? gioVn(g) : ''}</span>)}</div>
        {[...ds.map((d) => [d, `${d.slice(8, 10)}/${d.slice(5, 7)}`] as const), ['tong', 'Cộng'] as const].map(([d, nhan]) => <div key={d} style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <span style={{ width: 40, flex: '0 0 40px', textAlign: 'right', paddingRight: 2, fontWeight: d === 'tong' ? 700 : 400, color: d === s.nay ? 'var(--fg-1)' : undefined }}>{nhan}</span>
          {cotG.map((g) => <span key={g} style={{ display: 'inline-flex' }}>{o_(d === 'tong' ? tong[g] : d === s.nay && g > s.gio ? undefined : o.get(`${d}|${g}`), `${nhan} ${gioVn(g)}:00 VN`)}</span>)}
        </div>)}
        <div style={{ paddingLeft: 42, marginTop: 2 }}>giờ VN · màu = ROI giờ đó (nhà + đội) · dòng Cộng = các ngày đã khép</div>
      </div>;
    },
    luy_ke: ({ rong, cao }) => (!s ? cho : !s.gioNgay.length ? <span style={{ color: MO, fontSize: 12 }}>số theo giờ chỉ có ở tài khoản nhà</span> : <LuyKe s={s} rong={rong} cao={cao} />),
    luat: () => {
      if (!s || !x) return cho;
      if (!s.luat) return <span style={{ color: MO, fontSize: 12 }}>máy luật chỉ chạy trên tài khoản nhà</span>;
      const lam = [...s.daLam.filter((r) => r.d >= x.tu && r.d <= x.den).reduce((m, r) => { const k = `${r.viec}|${r.luat}`; m.set(k, (m.get(k) ?? 0) + r.n); return m; }, new Map<string, number>())]
        .map(([k, n]) => { const [viec, luat] = k.split('|'); return { viec: viec!, luat: luat!, n }; }).sort((a, b) => b.n - a.n);
      const sap = s.baoNhom.filter((b) => NHAN_LUAT[b.nhom]?.nhan?.length).sort((a, b) => b.n - a.n);
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
        <div><div style={{ color: 'var(--fg-3)', fontSize: 10, marginBottom: 4 }}>NHỊP TỚI — máy xếp</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{sap.length ? sap.map((b) => { const n = NHAN_LUAT[b.nhom]!.nhan!;
            return <a key={b.nhom} href="?t=luat" title="mở Luật & cảnh báo" style={{ border: `1px ${n[3] === 'gan' ? 'dashed' : 'solid'} ${n[2]}`, color: n[2], borderRadius: 10, padding: '1px 8px', textDecoration: 'none' }}>{n[0]} {n[1]} · {b.n}</a>; }) : <span style={{ color: MO }}>không có</span>}</div></div>
        <div><div style={{ color: 'var(--fg-3)', fontSize: 10, marginBottom: 4 }}>ĐÃ LÀM TRONG KỲ — số camp</div>
          {lam.length ? <SimpleTable rows={lam} getRowKey={(r) => `${r.viec}|${r.luat}`} hideHeader columns={[
            { key: 'v', header: 'Việc', cell: (r) => TEN_VIEC[r.viec] ?? r.viec },
            { key: 'l', header: 'Luật', cell: (r) => (r.viec === 'tat' || r.viec === 'giam' ? <a href={`?t=camp&l=all&lu=${encodeURIComponent(`lam:${r.viec}:${r.luat}`)}`} style={{ color: 'inherit' }} title="mở các camp máy đã làm theo luật này">{r.luat}</a> : r.luat) },
            { key: 'n', header: 'Camp', align: 'right', cell: (r) => <Dem v={r.n} /> },
          ]} /> : <span style={{ color: MO }}>máy chưa làm gì trong kỳ</span>}</div>
      </div>;
    },
    thi_truong: ({ rong, cao }) => (!s ? cho : !s.thiTruong ? <span style={{ color: MO, fontSize: 12 }}>số thị trường chỉ có ở tài khoản nhà</span> : <ThiTruong t={s.thiTruong} nay={s.nay} rong={rong} cao={cao} />),
    tk: ({ rong }) => {
      if (!x) return cho;
      const nhom = x.nguoi.map((p) => ({ p, ds: x.tk.filter((a) => a.n === p.id).sort((a, b) => b.k.chi - a.k.chi) }));
      // ô hẹp (điện thoại, widget nhỏ): tên người lên dòng riêng để ô tài khoản có đủ bề ngang
      const cot = Math.max(...nhom.map((g) => g.ds.length), 1), dung = rong < 480, o = Math.max(56, Math.floor((rong - (dung ? 0 : 70) - (cot - 1) * 4) / cot));
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
        {nhom.map(({ p, ds }) => <div key={p.id} style={{ display: 'flex', flexWrap: dung ? 'wrap' : undefined, gap: 4, alignItems: 'stretch' }}>
          <span style={{ width: dung ? '100%' : 66, flex: dung ? '0 0 100%' : '0 0 66px', color: 'var(--fg-2)', alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.ten}>{p.ten}</span>
          {ds.map((a) => {
            const r = roi(a.k), lai = a.k.thu - a.k.chi, trong = a.k.chi === 0 && a.chay === 0;
            const nen = trong ? 'transparent' : r == null ? 'var(--bg-2)' : r >= 0 ? `rgba(74,222,128,${Math.min(0.35, 0.08 + r / 150)})` : `rgba(248,113,113,${Math.min(0.4, 0.1 - r / 120)})`;
            return <a key={a.id} href={a.bo ? `?t=camp&b=${a.bo}` : `?t=camp${p.nha ? '' : `&ng=${p.id}`}`}
              title={[`${a.ten} · ${p.ten}`, trong ? 'chưa dùng (không camp, không chi trong kỳ)' : `kỳ: chi ${tien(a.k.chi)} · thu ${tien(a.k.thu)} · lãi ${tien(lai)} · ROI ${pct(r)}`,
                `${a.chay} camp bật · ngân sách ${tien(a.ns)}/ngày${a.tieu != null ? ` · hôm nay đã tiêu ${Math.round(a.tieu * 100)}%` : ''}`, ...a.co.map((c) => `⚠ ${c}`)].join('\n')}
              style={{ width: o, padding: '4px 6px', borderRadius: 6, border: `1px solid ${a.co.length ? DO : 'var(--line)'}`, background: nen, color: trong ? MO : 'var(--fg-1)', textDecoration: 'none', boxSizing: 'border-box', lineHeight: 1.35 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}><b>{a.ten.replace(/^ETP_/, '')}</b>{a.co.length ? <span style={{ color: DO }}>⚠</span> : null}</div>
              {trong ? <div>trống</div> : <><div style={{ color: mauLai(lai) }}>{tien(lai)} · {pct(r)}</div><div style={{ color: 'var(--fg-3)' }}>{a.chay} bật{a.tieu != null ? ` · ${Math.round(a.tieu * 100)}%` : ''}</div></>}
            </a>;
          })}
        </div>)}
      </div>;
    },
  };
}
