import type { ScenePersonRow } from '@/lib/actions/scene-people';

// WHO-THEM Scenes view (MVP). The interaction network — people engaging with us
// across habitats, ranked by familiarity so bridge-ready ones surface on top.
export function ScenesPage({ projectId, people }: { projectId: string; people: ScenePersonRow[] }) {
  const warm = people.filter((p) => p.familiarityScore >= 60).length;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Scenes · WHO-THEM</h1>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 16px' }}>
        Interaction network — người tương tác với mình trong các habitat của project.{' '}
        <b>{people.length}</b> người · <b>{warm}</b> warm.
      </p>

      {people.length === 0 ? (
        <div style={{ border: '1px dashed var(--fg-3)', borderRadius: 8, padding: 24, color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.6 }}>
          Chưa có ai trong scene. Người sẽ <b>tự xuất hiện</b> khi Crew ext sync insights
          (forum replies-to-you) cho card đã đăng của project <code>{projectId}</code> — handle
          repliers được trích từ <code>insights_top_replies</code> sang đây, tính familiarity.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--fg-2)', borderBottom: '1px solid var(--bg-3)' }}>
              <th style={{ padding: '6px 8px' }}>Handle</th>
              <th style={{ padding: '6px 8px' }}>Platform</th>
              <th style={{ padding: '6px 8px' }}>Habitat / Scene</th>
              <th style={{ padding: '6px 8px' }}>Interactions</th>
              <th style={{ padding: '6px 8px' }}>Familiarity</th>
              <th style={{ padding: '6px 8px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-2)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700 }}>@{p.handle}</td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{p.platformKey || '—'}</td>
                <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{p.habitatName || p.sceneTag || '—'}</td>
                <td style={{ padding: '6px 8px' }} title={p.theyRepliedBack ? 'đã reply lại mình' : ''}>
                  {p.interactionCount}{p.theyRepliedBack ? ' ↩' : ''}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 80, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${p.familiarityScore}%`, height: '100%', background: p.familiarityScore >= 60 ? 'var(--neon-lime)' : 'var(--neon-amber)' }} />
                    </div>
                    <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{p.familiarityScore}</span>
                  </div>
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: 'var(--bg-2)', color: 'var(--fg-2)' }}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
