'use client';

// Biểu đồ CỘT + ĐƯỜNG theo trục thời gian, hai trục số (trái/phải) + một thang riêng cho cột — SVG thuần, không thư viện
// (cùng vai ComposedChart của report2 adfond). Rê chuột: vạch dọc + hộp số của đúng ngày đó. Bấm chú giải để ẩn/hiện một
// đường. Trục ngang luôn là thời gian TĂNG dần — người gọi xếp sẵn.
import { useEffect, useMemo, useRef, useState } from 'react';

export type ChuoiCombo = { key: string; nhan: string; mau: string; kieu: 'cot' | 'duong'; truc: 'trai' | 'phai' };

const PAD_L = 56, PAD_R = 56, PAD_T = 12, PAD_B = 22;

/** Bước chia trục "đẹp" (1·2·5 × 10^n) để nhãn trục là số tròn. */
function thang(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const tho = max / 4, mu = 10 ** Math.floor(Math.log10(tho)), b = [1, 2, 5, 10].map((x) => x * mu).find((x) => x >= tho)!;
  return Array.from({ length: Math.ceil(max / b) + 1 }, (_, i) => i * b);
}

export function ComboChart({ data, series, dinhDang, height = 220 }: {
  data: Array<{ x: string } & Record<string, number | string>>;
  series: ChuoiCombo[];
  /** Định dạng số theo chuỗi (tiền / số đếm) — nhãn trục + hộp rê chuột. */
  dinhDang: (key: string, v: number) => string;
  height?: number;
}) {
  const [an, datAn] = useState<Set<string>>(new Set());
  const [i, datI] = useState<number | null>(null);
  const hop = useRef<HTMLDivElement>(null);
  /* Vẽ theo bề ngang THẬT của khung (đo bằng ResizeObserver) — viewBox co giãn không đều sẽ kéo méo chữ trục. */
  const [W, datW] = useState(1000);
  useEffect(() => {
    const el = hop.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => datW(Math.max(320, Math.round(e!.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const hien = series.filter((s) => !an.has(s.key));
  const H = height, cao = H - PAD_T - PAD_B, rong = W - PAD_L - PAD_R;
  const n = data.length;
  const buoc = n ? rong / n : rong;
  const v = (r: Record<string, unknown>, k: string) => Number(r[k]) || 0;

  const truc = useMemo(() => {
    const max = (ds: ChuoiCombo[]) => Math.max(0, ...data.flatMap((r) => ds.map((s) => v(r, s.key))));
    const t = thang(max(hien.filter((s) => s.kieu === 'duong' && s.truc === 'trai')));
    const p = thang(max(hien.filter((s) => s.kieu === 'duong' && s.truc === 'phai')));
    const c = Math.max(1, ...data.map((r) => hien.filter((s) => s.kieu === 'cot').reduce((a, s) => Math.max(a, v(r, s.key)), 0)));
    return { t, p, c };
  }, [data, hien]); // eslint-disable-line react-hooks/exhaustive-deps
  const y = (val: number, top: number) => PAD_T + cao - (val / (top || 1)) * cao;
  const cx = (j: number) => PAD_L + buoc * j + buoc / 2;
  const cot = hien.filter((s) => s.kieu === 'cot');
  const bc = Math.min(28, (buoc * 0.7) / Math.max(1, cot.length));
  const nhanX = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(W / 70))));

  if (!n) return null;
  const keyTop = (s: ChuoiCombo) => (s.truc === 'trai' ? truc.t.at(-1)! : truc.p.at(-1)!);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, marginBottom: 4 }}>
        {series.map((s) => (
          <button key={s.key} type="button" onClick={() => datAn((a) => { const b = new Set(a); b.has(s.key) ? b.delete(s.key) : b.add(s.key); return b; })}
            aria-pressed={!an.has(s.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--fg-2)', opacity: an.has(s.key) ? 0.35 : 1 }}>
            <span style={{ width: 10, height: s.kieu === 'cot' ? 10 : 3, background: s.mau, borderRadius: 2, display: 'inline-block' }} />
            {s.nhan}{s.kieu === 'duong' ? (s.truc === 'trai' ? ' (trục trái)' : ' (trục phải)') : ''}
          </button>
        ))}
      </div>
      <div ref={hop} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Biểu đồ theo ngày"
          onMouseLeave={() => datI(null)}>
          {truc.t.map((t) => (
            <g key={'t' + t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(t, truc.t.at(-1)!)} y2={y(t, truc.t.at(-1)!)} stroke="var(--line)" strokeDasharray="3 3" />
              <text x={PAD_L - 6} y={y(t, truc.t.at(-1)!) + 3} fontSize="10" textAnchor="end" fill="var(--fg-3)">{dinhDang(hien.find((s) => s.truc === 'trai' && s.kieu === 'duong')?.key ?? '', t)}</text>
            </g>
          ))}
          {hien.some((s) => s.truc === 'phai' && s.kieu === 'duong') && truc.p.map((t) => (
            <text key={'p' + t} x={W - PAD_R + 6} y={y(t, truc.p.at(-1)!) + 3} fontSize="10" fill="var(--fg-3)">{dinhDang(hien.find((s) => s.truc === 'phai' && s.kieu === 'duong')!.key, t)}</text>
          ))}
          {data.map((r, j) => (
            <g key={'c' + j}>
              {cot.map((s, k) => {
                const h = (v(r, s.key) / truc.c) * cao * 0.6;
                return <rect key={s.key} x={cx(j) - (bc * cot.length) / 2 + k * bc} y={PAD_T + cao - h} width={bc - 1} height={h} fill={s.mau} opacity={0.55} rx={2} />;
              })}
              {j % nhanX === 0 && <text x={cx(j)} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--fg-3)">{String(r.x)}</text>}
            </g>
          ))}
          {hien.filter((s) => s.kieu === 'duong').map((s) => (
            <path key={s.key} fill="none" stroke={s.mau} strokeWidth={2} vectorEffect="non-scaling-stroke"
              d={data.map((r, j) => `${j ? 'L' : 'M'}${cx(j)},${y(v(r, s.key), keyTop(s))}`).join(' ')} />
          ))}
          {i != null && <line x1={cx(i)} x2={cx(i)} y1={PAD_T} y2={PAD_T + cao} stroke="var(--fg-3)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
          {data.map((_, j) => (
            <rect key={'h' + j} x={PAD_L + buoc * j} y={0} width={buoc} height={H} fill="transparent" onMouseEnter={() => datI(j)} />
          ))}
        </svg>
        {i != null && (
          <div style={{ position: 'absolute', top: 4, left: `${(cx(i) / W) * 100}%`, transform: `translateX(${cx(i) > W * 0.6 ? 'calc(-100% - 10px)' : '10px'})`,
            background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 11, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.12)', zIndex: 2 }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>{String(data[i]!.x)}</div>
            {series.map((s) => (
              <div key={s.key} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', opacity: an.has(s.key) ? 0.4 : 1 }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, background: s.mau, borderRadius: 2, marginRight: 5 }} />{s.nhan}</span>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{dinhDang(s.key, v(data[i]!, s.key))}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
