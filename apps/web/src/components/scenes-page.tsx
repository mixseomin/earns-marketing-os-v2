'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ScenePersonRow } from '@/lib/actions/scene-people';

// WHO-THEM Scenes view. The interaction network — people engaging with us across
// habitats, ranked by familiarity. ?focus=<handle> (deep-link từ Crew ext popover)
// → auto-filter + scroll + highlight đúng người (khỏi search trong danh sách dài).
// Suspense wrap: useSearchParams cần boundary khi Next static-analyze build.
export function ScenesPage(props: { projectId: string; people: ScenePersonRow[] }) {
  return <Suspense fallback={null}><ScenesInner {...props} /></Suspense>;
}
function ScenesInner({ projectId, people }: { projectId: string; people: ScenePersonRow[] }) {
  const sp = useSearchParams();
  const focus = (sp.get('focus') || '').replace(/^@/, '').trim().toLowerCase();
  const [q, setQ] = useState(focus);
  const warm = people.filter((p) => p.familiarityScore >= 60).length;
  const rowRef = useRef<HTMLTableRowElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return people;
    return people.filter((p) =>
      p.handle.toLowerCase().includes(s) ||
      (p.habitatName || '').toLowerCase().includes(s) ||
      (p.sceneTag || '').toLowerCase().includes(s));
  }, [people, q]);

  useEffect(() => {
    if (focus && rowRef.current) rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Scenes · WHO-THEM</h1>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 12px' }}>
        Interaction network — người mình tương tác trong các habitat của project.{' '}
        <b>{people.length}</b> người · <b>{warm}</b> warm.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px' }}>
        <input
          autoFocus={!!focus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm handle / habitat / scene…"
          autoComplete="off"
          style={{ flex: 1, maxWidth: 360, padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--bg-3)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
        />
        {q && (
          <button onClick={() => setQ('')} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--bg-3)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' }}>
            Xoá ({filtered.length})
          </button>
        )}
      </div>

      {people.length === 0 ? (
        <div style={{ border: '1px dashed var(--fg-3)', borderRadius: 8, padding: 24, color: 'var(--fg-2)', fontSize: 13, lineHeight: 1.6 }}>
          Chưa có ai trong scene. Người <b>tự xuất hiện</b> khi mình tương tác (like/reply/follow
          qua Crew ext) hoặc khi họ reply lại card của project <code>{projectId}</code>.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ border: '1px dashed var(--fg-3)', borderRadius: 8, padding: 16, color: 'var(--fg-2)', fontSize: 13 }}>
          Không tìm thấy <b>@{q}</b> trong scene của project này.
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
            {filtered.map((p) => {
              const hit = !!focus && p.handle.toLowerCase() === focus;
              return (
                <tr
                  key={p.id}
                  ref={hit ? rowRef : undefined}
                  style={{
                    borderBottom: '1px solid var(--bg-2)',
                    background: hit ? 'color-mix(in srgb, var(--neon-amber) 14%, transparent)' : undefined,
                    outline: hit ? '1px solid var(--neon-amber)' : undefined,
                  }}
                >
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
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
