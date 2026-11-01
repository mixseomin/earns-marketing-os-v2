'use client';
// WIDGET SỐ của Tổng quan 2 etp (anh 01/11/2026 "cụm nhóm Insight dựa vào Người, Tài khoản và Time"): đọc gói taiTong2 (actions/etp-tong2.ts), theo kỳ đang chọn trên trang.
// Khoá của VE_SO phải có trong sổ lib/etp-widget.json (check-etp-gop-y đối chiếu) — thêm widget = mục trong sổ + một hàm ở đây.
import { useEffect, useMemo, useState } from 'react';
import { SimpleTable, StatsStrip } from '@/components/ui';
import { taiTong2, type SoTong2 } from '@/lib/actions/etp-tong2';
import type { VeWidget } from '@/components/etp-tong2';

type ST = { chi: number; thu: number };
const cong = (rs: ST[]) => rs.reduce((a, r) => ({ chi: a.chi + r.chi, thu: a.thu + r.thu }), { chi: 0, thu: 0 });
const roi = (s: ST) => (s.chi >= 1 ? ((s.thu - s.chi) / s.chi) * 100 : null);
const tien = (v: number) => { const a = Math.abs(v); return `${v < 0 ? '−' : ''}$${a >= 10_000 ? `${(a / 1000).toFixed(1)}k` : a >= 100 ? a.toFixed(0) : a.toFixed(2)}`; };
const pct = (r: number | null) => (r == null ? '—' : `${r > 0 ? '+' : ''}${r.toFixed(0)}%`);
const XANH = 'var(--neon-lime, #4ade80)', DO = '#f87171', MO = 'var(--fg-3)';
const mauLai = (v: number) => (Math.abs(v) < 0.005 ? MO : v > 0 ? XANH : DO);
const congNgay = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const soNgayGiua = (tu: string, den: string) => Math.round((Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86_400_000) + 1;
const diToi = (q: Record<string, string>) => { const u = new URL(location.href); for (const [k, v] of Object.entries(q)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); } location.href = u.href; };

/** ROI theo ngày — đường mini (viz một lần, không primitive) */
function DuongRoi({ v }: { v: (number | null)[] }) {
  const ok = v.filter((x): x is number => x != null); if (ok.length < 2) return <span style={{ color: MO }}>—</span>;
  const max = Math.max(...ok, 0), min = Math.min(...ok, 0), W = 64, H = 16, y = (x: number) => H - 1 - ((x - min) / (max - min || 1)) * (H - 2);
  const d = v.map((x, i) => (x == null ? null : `${(i / (v.length - 1)) * W},${y(x)}`)).filter(Boolean).join(' ');
  return <svg width={W} height={H} style={{ verticalAlign: 'middle' }}><line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" /><polyline points={d} fill="none" stroke={ok.at(-1)! >= 0 ? XANH : DO} strokeWidth={1.5} /></svg>;
}

export function useVeSo(ky: { tu: string; den: string }): Record<string, VeWidget> {
  const [s, setS] = useState<SoTong2 | null>(null);
  useEffect(() => { let huy = false; const tai = () => taiTong2().then((r) => { if (!huy && !('loi' in r)) setS(r); }).catch(() => {});
    tai(); const t = setInterval(tai, 120_000); return () => { huy = true; clearInterval(t); }; }, []);

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
      if (!x) return cho;
      return <SimpleTable rows={x.nguoi} getRowKey={(p) => String(p.id)} rowStyle={(p) => (p.nha ? { fontWeight: 600 } : undefined)} columns={[
        { key: 'ten', header: 'Người', cell: (p) => <a href={`?t=camp${p.nha ? '' : `&ng=${p.id}`}`} style={{ color: 'inherit' }} title="xem camp của người này">{p.ten}{p.nha ? ' (nhà)' : ''}</a> },
        { key: 'chi', header: 'Chi', align: 'right', cell: (p) => tien(p.k.chi) },
        { key: 'lai', header: 'Lãi', align: 'right', cell: (p) => <span style={{ color: mauLai(p.k.thu - p.k.chi) }}>{tien(p.k.thu - p.k.chi)}</span> },
        { key: 'roi', header: 'ROI', align: 'right', cell: (p) => { const r = roi(p.k), t = roi(p.t); return <span title={t == null ? undefined : `kỳ trước cùng độ dài: ${pct(t)}`}>{pct(r)}{r != null && t != null ? <small style={{ color: r >= t ? XANH : DO, marginLeft: 4 }}>{r >= t ? '▲' : '▼'}{Math.abs(r - t).toFixed(0)}</small> : null}</span>; } },
        { key: 'camp', header: 'Camp bật', align: 'right', title: 'camp ACTIVE lúc này · tổng ngân sách / ngày', cell: (p) => <span title={`ngân sách ${tien(p.ns)}/ngày`}>{p.camp}</span> },
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
    tk: ({ rong }) => {
      if (!x) return cho;
      const nhom = x.nguoi.map((p) => ({ p, ds: x.tk.filter((a) => a.n === p.id).sort((a, b) => b.k.chi - a.k.chi) }));
      const cot = Math.max(...nhom.map((g) => g.ds.length), 1), o = Math.max(56, Math.floor((rong - 70 - (cot - 1) * 4) / cot));
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
        {nhom.map(({ p, ds }) => <div key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          <span style={{ width: 66, flex: '0 0 66px', color: 'var(--fg-2)', alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.ten}>{p.ten}</span>
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
