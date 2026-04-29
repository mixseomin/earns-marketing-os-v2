// SVG charts ported from MOS2 design charts.jsx — no external lib.

export function Sparkline({ data, color, fill, height = 36 }: { data: number[]; color?: string; fill?: string; height?: number }) {
  if (!data || data.length === 0) return null;
  const w = 200, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaD = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={areaD} fill={fill || color} opacity="0.18" />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function RevenueChart({ data }: { data: { label: string; rev: number; target: number }[] }) {
  const w = 600, h = 200;
  const PAD = { l: 40, r: 12, t: 12, b: 22 };
  const cw = w - PAD.l - PAD.r, ch = h - PAD.t - PAD.b;
  const max = Math.max(...data.map((d) => Math.max(d.rev, d.target)));
  const min = 0;
  const x = (i: number) => PAD.l + (i / (data.length - 1)) * cw;
  const y = (v: number) => PAD.t + ch - ((v - min) / (max - min)) * ch;

  const linePts = data.map((d, i) => [x(i), y(d.rev)] as const);
  const targetPts = data.map((d, i) => [x(i), y(d.target)] as const);
  const lineD = linePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaD = `${lineD} L ${x(data.length - 1)} ${PAD.t + ch} L ${x(0)} ${PAD.t + ch} Z`;
  const targetD = targetPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + ((max - min) * i) / yTicks);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="rev-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 4" />
          <text x={PAD.l - 6} y={y(t) + 3} fontSize="9" fill="var(--fg-3)" textAnchor="end" fontFamily="var(--font-mono)">{(t / 1000000).toFixed(0)}M</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={h - 6} fontSize="9" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--font-mono)">{d.label}</text>
      ))}
      <path d={areaD} fill="url(#rev-grad)" />
      <path d={targetD} stroke="var(--fg-3)" strokeWidth="1" strokeDasharray="3 3" fill="none" opacity="0.7" />
      <path d={lineD} stroke="var(--accent)" strokeWidth="2" fill="none" />
      {linePts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="1.5" />
      ))}
      <line x1={x(data.length - 1)} x2={x(data.length - 1)} y1={PAD.t} y2={PAD.t + ch}
            stroke="var(--accent)" strokeDasharray="2 2" opacity="0.4" />
    </svg>
  );
}

export function HourBars({ data }: { data: { label: string; value: number; now: boolean }[] }) {
  const w = 600, h = 140;
  const PAD = { l: 32, r: 8, t: 8, b: 20 };
  const cw = w - PAD.l - PAD.r, ch = h - PAD.t - PAD.b;
  const max = Math.max(...data.map((d) => d.value));
  const bw = cw / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={PAD.l} x2={w - PAD.r}
              y1={PAD.t + ch * (1 - p)} y2={PAD.t + ch * (1 - p)}
              stroke="var(--line)" strokeDasharray="2 4" />
      ))}
      {data.map((d, i) => {
        const bh = (d.value / max) * ch;
        const x = PAD.l + bw * i + 2;
        const y = PAD.t + ch - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw - 4} height={bh}
                  fill={d.now ? 'var(--accent)' : 'var(--bg-4)'} rx="1.5" />
            {i % 3 === 0 && (
              <text x={x + (bw - 4) / 2} y={h - 6} fontSize="9" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--font-mono)">{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  const pct = Math.min(value / max, 1);
  const r = 28, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" width="80" height="80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color || 'var(--accent)'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${c * pct} ${c}`}
              transform="rotate(-90 40 40)" />
      <text x="40" y="42" textAnchor="middle" fontSize="14" fontWeight="700"
            fill="var(--fg-0)" fontFamily="var(--font-display)">{value}</text>
      <text x="40" y="55" textAnchor="middle" fontSize="8"
            fill="var(--fg-3)" fontFamily="var(--font-mono)">{label}</text>
    </svg>
  );
}
