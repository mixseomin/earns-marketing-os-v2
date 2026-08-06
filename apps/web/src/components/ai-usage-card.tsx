import type { AiUsageSummary } from '@/lib/data';

const money = (n: number) => (n > 0 && n < 0.01 ? '<$0.01' : '$' + n.toFixed(2));

// Homepage AI usage strip — model đang dùng + cost hôm nay/7d/30d + top feature. Server component (chỉ hiển thị).
export function AiUsageCard({ usage }: { usage: AiUsageSummary | null }) {
  if (!usage) return null;   // DB unavailable — ẩn. calls30===0 vẫn HIỆN (chỗ report cố định).
  const cell = (label: string, val: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{val}</span>
    </div>
  );
  return (
    <div style={{ margin: '0 0 14px', padding: '11px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 116 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>🤖 AI usage</span>
        <span style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{usage.models.join(', ') || '—'}</span>
      </div>
      {cell('Hôm nay', money(usage.cost1))}
      {cell('7 ngày', money(usage.cost7))}
      {cell('30 ngày', money(usage.cost30))}
      {cell('Calls 30d', String(usage.calls30))}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
        {usage.byFeature.length === 0
          ? <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>chưa có lần gọi AI nào (30 ngày)</span>
          : usage.byFeature.slice(0, 5).map((f) => (
            <span key={f.feature} style={{ fontSize: 10, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {f.feature} <span style={{ color: 'var(--fg-3)' }}>{money(f.cost30)}</span>
            </span>
          ))}
      </div>
    </div>
  );
}
