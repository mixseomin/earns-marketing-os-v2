// Pure-SVG sparkline — no external deps.
// Renders the last N days of a metric as a tiny inline line chart.

interface SparklineProps {
  values: number[];                 // chronological, oldest → newest
  width?: number;                   // default 70
  height?: number;                  // default 18
  color?: string;                   // CSS color, default neon cyan
  showFill?: boolean;               // gradient fill below line
}

export function Sparkline({
  values,
  width = 70,
  height = 18,
  color = 'var(--neon-cyan, #6cf)',
  showFill = true,
}: SparklineProps) {
  if (!values || values.length < 2) {
    return <span style={{ display: 'inline-block', width, height, opacity: 0.3, fontSize: 9, lineHeight: `${height}px`, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 1.5;
  const innerH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = padY + (1 - (v - min) / range) * innerH;
    return [x, y];
  });

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p[0] ?? 0).toFixed(1)},${(p[1] ?? 0).toFixed(1)}`).join(' ');
  const fillD = `${d} L${width},${height} L0,${height} Z`;

  // Trend: positive if last value > median of values
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const isUp = last > median;
  const finalColor = isUp ? color : 'var(--fg-3, #888)';

  const uid = `sl-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {showFill && (
        <>
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={finalColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={finalColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillD} fill={`url(#${uid})`} />
        </>
      )}
      <path d={d} fill="none" stroke={finalColor} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      {/* last-point dot */}
      <circle
        cx={points[points.length - 1]?.[0] ?? 0}
        cy={points[points.length - 1]?.[1] ?? 0}
        r="1.6"
        fill={finalColor}
      />
    </svg>
  );
}
