import type { ServerBox } from '@/lib/servers';
import { fleetTotals, SERVERS_SNAPSHOT_AT } from '@/lib/servers';

// Usage color = signal only (YDNI): lime ok, amber attention, red near-full.
function usageColor(pct: number | null): string {
  if (pct == null) return 'var(--fg-4)';
  if (pct >= 90) return '#ff5c7c';
  if (pct >= 70) return 'var(--neon-amber)';
  return 'var(--neon-lime)';
}

function UsageCell({ capacity, unit, pct }: { capacity: number; unit: string; pct: number | null }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>
        {capacity} {unit}
        {pct != null && <span style={{ color: usageColor(pct), marginLeft: 6 }}>{pct}%</span>}
      </div>
      {pct != null && (
        <div style={{ marginTop: 3, height: 4, borderRadius: 3, background: 'var(--bg-2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: usageColor(pct) }} />
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)',
  borderBottom: '1px solid var(--line-strong)', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '12px', borderBottom: '1px solid var(--line)', verticalAlign: 'top',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>{value}</span>
      <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{label}</span>
    </div>
  );
}

export function ServersPage({ boxes }: { boxes: ServerBox[] }) {
  const t = fleetTotals(boxes);
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', margin: 0 }}>🖥 Servers</h1>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          fleet inventory · snapshot {SERVERS_SNAPSHOT_AT} (usage not live)
        </span>
      </div>

      {/* Fleet roll-up */}
      <div style={{
        display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 16, marginBottom: 20,
        padding: '14px 18px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8,
      }}>
        <Stat label="boxes" value={String(t.boxes)} />
        <Stat label="vCPU" value={String(t.vcpu)} />
        <Stat label="RAM" value={`${t.ramGB} GB`} />
        <Stat label="disk" value={`${t.diskGB} GB`} />
        <Stat label="sites" value={String(t.sites)} />
        <Stat label="cost / mo" value={`€${t.costMonth.toFixed(2)}`} />
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Box</th>
              <th style={th}>Region</th>
              <th style={{ ...th, textAlign: 'right' }}>vCPU</th>
              <th style={th}>RAM</th>
              <th style={th}>Disk</th>
              <th style={th}>Cost / mo</th>
              <th style={th}>Sites</th>
            </tr>
          </thead>
          <tbody>
            {boxes.map((b) => (
              <tr key={b.id}>
                <td style={td}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-0)' }}>
                    {b.name}
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{b.host}</span>
                  </div>
                  <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginTop: 2 }}>
                    {b.ip} · {b.provider}{b.type ? ` ${b.type}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 5, maxWidth: 340 }}>{b.role}</div>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{b.flag} {b.region}</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-1)' }}>{b.vcpu}</td>
                <td style={td}><UsageCell capacity={b.ramGB} unit="GB" pct={b.ramUsedPct} /></td>
                <td style={td}><UsageCell capacity={b.diskGB} unit="GB" pct={b.diskUsedPct} /></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {b.costMonth == null ? (
                    <span style={{ color: 'var(--fg-3)' }}>—</span>
                  ) : (
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>
                      {b.costVerified ? '' : '~'}€{b.costMonth.toFixed(2)}
                      <span
                        title={b.costVerified ? 'Verified from Hetzner console' : 'Estimate — confirm in Hetzner console'}
                        style={{ marginLeft: 5, fontSize: 10, color: b.costVerified ? 'var(--neon-lime)' : 'var(--fg-4)' }}
                      >{b.costVerified ? '✓' : 'est'}</span>
                    </span>
                  )}
                </td>
                <td style={{ ...td, minWidth: 260 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginBottom: 4 }}>{b.sites.length} sites</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {b.sites.map((s) => (
                      <span key={s} style={{
                        fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                        padding: '1px 6px', borderRadius: 4, background: 'var(--bg-2)', border: '1px solid var(--line)',
                        whiteSpace: 'nowrap',
                      }}>{s}</span>
                    ))}
                  </div>
                  {b.notes && <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 6, fontStyle: 'italic', maxWidth: 340 }}>{b.notes}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
