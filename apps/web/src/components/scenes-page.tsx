'use client';
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ScenePersonRow, SceneContacts } from '@/lib/actions/scene-people';

const contactChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 6, background: 'var(--bg-2)', color: 'var(--fg-1)', textDecoration: 'none', border: '1px solid var(--bg-3)' };

// Suy link contact từ CANONICAL lưu (userId+host+engine) — DRY với popover ext (deriveContactLinks).
// phpBB → profile/PM/email-form formulaic (ko lưu dư); engine khác → href profile lưu sẵn. email = địa chỉ thật.
function deriveContacts(c: SceneContacts) {
  const host = c.host || '';
  const base = host ? `https://${host}` : '';
  let profile = c.profile || '', pm = c.pm || '', emailForm = c.emailForm || '';
  if (c.engine === 'phpbb' && c.userId && base) {
    if (!profile) profile = `${base}/memberlist.php?mode=viewprofile&u=${c.userId}`;
    if (!pm) pm = `${base}/ucp.php?i=pm&mode=compose&u=${c.userId}`;
    if (!emailForm) emailForm = `${base}/memberlist.php?mode=email&u=${c.userId}`;
  }
  let email = '';
  if (c.email) { if (/^https?:/i.test(c.email)) { emailForm = emailForm || c.email; } else { email = c.email; } }
  return { profile, pm, email, emailForm, website: c.website || '', userId: c.userId || '', host, location: c.location || '', posts: c.posts, karma: c.karma, joined: c.joined || '', about: c.about || '', channels: Array.isArray(c.channels) ? c.channels : [] };
}
// Emoji ngắn cho channel phổ biến (reuse vocab Orit) — thiếu → tên type. Scale mọi channel_type.
const CH_EMOJI: Record<string, string> = { twitter: '𝕏', x: '𝕏', telegram: '✈️', whatsapp: '🟢', signal: '🔵', discord: '🎮', github: '🐙', gitlab: '🦊', linkedin: '💼', instagram: '📷', facebook: '📘', youtube: '▶️', tiktok: '🎵', reddit: '👽', mastodon: '🐘', bluesky: '🦋', threads: '@', matrix: '⬢', linktree: '🌳', medium: '✍️', substack: '📰', devto: '👩‍💻', paypal: '💵', kofi: '☕', patreon: '🅿️', buymeacoffee: '☕', gumroad: '🛒', upwork: '💼', fiverr: '🟩', producthunt: '🐱', vk: '🆚', line: '💚', viber: '💜', wechat: '💬', snapchat: '👻', pinterest: '📌' };
const chLabel = (t: string) => `${CH_EMOJI[t] || ''} ${(t || '').replace(/_/g, ' ')}`.trim();

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
              <th style={{ padding: '6px 8px' }}>Joined</th>
              <th style={{ padding: '6px 8px' }}>Karma</th>
              <th style={{ padding: '6px 8px' }}>Contacts</th>
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
                  <td style={{ padding: '6px 8px', color: 'var(--fg-2)', whiteSpace: 'nowrap', fontSize: 12 }} title={p.contacts?.joined ? `Tham gia ${p.contacts.host || ''}` : ''}>{p.contacts?.joined || '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{p.contacts?.karma != null ? <b style={{ color: 'var(--neon-amber)' }}>⭐{p.contacts.karma.toLocaleString()}</b> : <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {p.contacts ? (() => {
                      const d = deriveContacts(p.contacts);
                      return (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
                          {d.profile && <a href={d.profile} target="_blank" rel="noreferrer" title="Mở profile" style={contactChip}>👤</a>}
                          {d.pm && <a href={d.pm} target="_blank" rel="noreferrer" title="Gửi tin nhắn riêng (PM)" style={contactChip}>✉️</a>}
                          {d.email
                            ? <a href={`mailto:${d.email}`} title={`Email trực tiếp: ${d.email}`} style={contactChip}>@ {d.email}</a>
                            : d.emailForm && <a href={d.emailForm} target="_blank" rel="noreferrer" title="Email qua form" style={contactChip}>📧</a>}
                          {d.website && <a href={d.website} target="_blank" rel="noreferrer" title={d.website} style={contactChip}>🌐</a>}
                          {d.userId && <span title={`ID của họ trên ${d.host || 'forum'} (không phải số người đã lưu)`} style={{ color: 'var(--fg-3)' }}>{d.host || 'forum'} #{d.userId}</span>}
                          {d.location && <span title="Vị trí" style={{ color: 'var(--fg-2)' }}>📍{d.location}</span>}
                          {d.posts != null && <span title="Số bài trên forum" style={{ color: 'var(--fg-3)' }}>📝{d.posts}</span>}
                          {d.channels.map((ch, i) => ch.value ? <a key={`${ch.type}-${i}`} href={ch.url || '#'} target="_blank" rel="noreferrer" title={`${ch.type}: ${ch.value}`} style={{ ...contactChip, background: 'var(--bg-3)', minWidth: 'auto', padding: '0 6px' }}>{chLabel(ch.type)} {String(ch.value).slice(0, 18)}</a> : null)}
                          {d.about && <span title={d.about} style={{ color: 'var(--fg-3)', fontStyle: 'italic', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{d.about}”</span>}
                        </div>
                      );
                    })() : <span style={{ color: 'var(--fg-3)' }}>—</span>}
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
