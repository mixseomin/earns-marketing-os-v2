import { RESOURCE_DATA, type StripItem } from '@/lib/mock/resources';
import { getResourceStripData } from '@/lib/resource-strip-data';

const noteColor = (tone: string) =>
  tone === 'warn' ? 'var(--warn)' : tone === 'bad' ? 'var(--bad)' : 'var(--fg-3)';
const bgColor = (tone: string) =>
  tone === 'warn' ? 'rgba(255,176,60,.05)' : tone === 'bad' ? 'rgba(255,77,94,.07)' : 'transparent';

export async function ResourceStrip({ projectId, isDemo }: { projectId?: string; isDemo?: boolean } = {}) {
  // Demos: render mock for design preview. Real projects: query DB for live counts.
  const strip: StripItem[] = isDemo || !projectId
    ? RESOURCE_DATA.strip
    : await getResourceStripData(projectId);

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
          🗂 Resource Status <span style={{ color: 'var(--fg-4)', fontSize: 9 }}>// kho hậu cần</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>click vault › drill-down</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {strip.map((s, i) => (
          <div key={i} style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', minWidth: 0,
            background: bgColor(s.tone),
            borderRight: i < strip.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.lbl}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{s.val}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: noteColor(s.tone), marginTop: 1, whiteSpace: 'nowrap' }}>{s.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
