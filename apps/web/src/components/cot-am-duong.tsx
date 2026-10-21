'use client';
// Biểu đồ CỘT ÂM/DƯƠNG theo ngày (lãi mỗi ngày có thể âm — ComboChart chỉ vẽ từ 0 lên) + đường CỘNG DỒN tuỳ chọn. SVG thuần, đo bề ngang thật.
// Rê chuột: hộp số của đúng ngày. Màu: dương = tiền lãi, âm = lỗ (đúng bảng nghĩa YDNI: màu là tín hiệu tiền +/−).
import { useEffect, useRef, useState } from 'react';

export function CotAmDuong({ data, dinhDang, conDuong = true, height = 220, ghiChu }: {
  data: { x: string; v: number; phu?: string; mo?: boolean }[];   // mo = số chưa chốt (vẽ nhạt)
  dinhDang: (v: number) => string; conDuong?: boolean; height?: number; ghiChu?: (i: number) => string | null;
}) {
  const hop = useRef<HTMLDivElement>(null); const [W, datW] = useState(800); const [i, datI] = useState<number | null>(null);
  useEffect(() => { const el = hop.current; if (!el) return; const ro = new ResizeObserver(([e]) => datW(Math.max(300, Math.round(e!.contentRect.width)))); ro.observe(el); return () => ro.disconnect(); }, []);
  const n = data.length; if (!n) return <div ref={hop} style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có số</div>;
  const luy = data.reduce<number[]>((a, d) => [...a, (a.at(-1) ?? 0) + d.v], []);
  const vals = [...data.map((d) => d.v), ...(conDuong ? luy : []), 0];
  const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
  const PL = 56, PR = 12, PT = 10, PB = 22, cao = height - PT - PB, rong = W - PL - PR, buoc = rong / n;
  const y = (v: number) => PT + ((max - v) / span) * cao, y0 = y(0), bc = Math.min(36, buoc * 0.6), cx = (j: number) => PL + buoc * j + buoc / 2;
  const nhan = [max, (max + min) / 2, min, 0].filter((v, k, a) => a.findIndex((u) => Math.abs(u - v) < span * 0.08) === k);
  return (
    <div ref={hop} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} onMouseLeave={() => datI(null)} role="img" aria-label="Lãi mỗi ngày">
        {nhan.map((v) => <g key={v}><line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 ? undefined : '3 3'} />
          <text x={PL - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--fg-3)">{dinhDang(v)}</text></g>)}
        {data.map((d, j) => { const top = d.v >= 0 ? y(d.v) : y0, h = Math.max(1, Math.abs(y(d.v) - y0));
          return <g key={d.x} onMouseEnter={() => datI(j)}>
            <rect x={PL + buoc * j} y={PT} width={buoc} height={cao} fill="transparent" />
            <rect x={cx(j) - bc / 2} y={top} width={bc} height={h} rx={2} fill={d.v >= 0 ? 'var(--neon-lime, #9be15d)' : 'var(--neon-red, #ff5c5c)'} opacity={d.mo ? 0.45 : 0.9} />
            {(n <= 14 || j % Math.ceil(n / 14) === 0) && <text x={cx(j)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--fg-3)">{d.x}</text>}
          </g>; })}
        {conDuong && <polyline fill="none" stroke="var(--fg-2)" strokeWidth={1.5} points={luy.map((v, j) => `${cx(j)},${y(v)}`).join(' ')} />}
        {i != null && <line x1={cx(i)} x2={cx(i)} y1={PT} y2={PT + cao} stroke="var(--fg-3)" strokeDasharray="2 2" />}
      </svg>
      {i != null && (
        <div style={{ position: 'absolute', top: 4, left: Math.min(W - 230, Math.max(0, cx(i) + 8)), width: 220, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
          <div style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{data[i]!.x}{data[i]!.mo ? ' · còn về thêm' : ''}</div>
          <div style={{ color: data[i]!.v >= 0 ? 'var(--neon-lime, #9be15d)' : 'var(--neon-red, #ff5c5c)' }}>lãi {dinhDang(data[i]!.v)}</div>
          {conDuong && <div style={{ color: 'var(--fg-2)' }}>cộng dồn {dinhDang(luy[i]!)}</div>}
          {data[i]!.phu ? <div style={{ color: 'var(--fg-3)' }}>{data[i]!.phu}</div> : null}
          {ghiChu?.(i) ? <div style={{ color: 'var(--fg-3)' }}>{ghiChu(i)}</div> : null}
        </div>
      )}
    </div>
  );
}
