// SteamSolo language coverage + on-demand translation demand.
// Data: https://steamsolo.com/api/lang-stats/ (guides.language, guide_translations, translation_demand).
// The demand meter tells us which language versions to actually publish (indexed) vs leave on-demand.
import { RefreshSteamsoloBtn } from './refresh-steamsolo-btn';
import { internalUrl } from '../lib/internal-origin';
import { Panel } from './ui/panel';

interface LangStats {
  ok: boolean;
  engagement: { views: number; likes: number; shares: number; helpful: number; guides: number; comments: number; followers: number };
  features: { feature: string; hits: number }[];
  recent_comments: { name: string; body: string; created_at: string; slug: string; title: string; game: string }[];
  top_guides: { views: number; likes: number; shares: number; slug: string; title: string; game: string }[];
  source_lang: { lang: string; n: number }[];
  translations: { lang: string; status: string; n: number }[];
  demand: { lang: string; hits: number; guides: number; last_at: string | null }[];
  top_demand: { lang: string; hits: number; slug: string; title: string; game: string }[];
  updated_at: string;
}

async function load(): Promise<LangStats | null> {
  try {
    const r = await fetch(internalUrl('https://steamsolo.com/api/lang-stats/'), { next: { revalidate: 60, tags: ['steamsolo-stats'] } });
    if (!r.ok) return null;
    return (await r.json()) as LangStats;
  } catch {
    return null;
  }
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const th: React.CSSProperties = { ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', textAlign: 'left', padding: '3px 8px', fontWeight: 500 };
const td: React.CSSProperties = { ...mono, fontSize: 12, padding: '3px 8px', color: 'var(--fg-1)' };
const FEATURE_LABEL: Record<string, string> = {
  select_translate: '🌐 Translate selection',
  select_copy: '📋 Copy selection',
  select_share_x: '𝕏 Quote → X',
  select_share_reddit: '👽 Quote → Reddit',
  read_in_language: '🌐 Read in your language',
};

export async function SteamsoloLangPanel() {
  const d = await load();
  if (!d?.ok) return null;

  const total = d.source_lang.reduce((s, x) => s + x.n, 0) || 1;
  const done = d.translations.filter((t) => t.status === 'done').reduce((s, t) => s + t.n, 0);
  const queued = d.translations.filter((t) => t.status === 'queued').reduce((s, t) => s + t.n, 0);
  const demandTotal = d.demand.reduce((s, x) => s + x.hits, 0);
  const e = d.engagement;
  const tiles: [string, number][] = [['Views', e.views], ['Likes', e.likes], ['Shares', e.shares], ['Comments', e.comments], ['Followers', e.followers ?? 0]];

  return (
    <Panel
      title="🎮 SteamSolo — Engagement & languages"
      actions={<>
        <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>
          {done} translated · {queued} queued · {demandTotal} on-demand requests
        </span>
        <RefreshSteamsoloBtn />
      </>}
    >

      {/* Reader engagement on our own site (likes/shares/views/comments we log per guide) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {tiles.map(([label, n]) => (
          <div key={label} style={{ flex: '1 1 90px', background: 'var(--bg-2)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: 'var(--fg-0)' }}>{n.toLocaleString()}</div>
            <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{label}</div>
          </div>
        ))}
      </div>

      {d.top_guides.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={th}>Top guides by views</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Guide</th>
              <th style={{ ...th, textAlign: 'right' }}>Views</th>
              <th style={{ ...th, textAlign: 'right' }}>Likes</th>
              <th style={{ ...th, textAlign: 'right' }}>Shares</th>
            </tr></thead>
            <tbody>
              {d.top_guides.slice(0, 8).map((x, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <a href={`https://steamsolo.com/guide/${x.slug}/`} target="_blank" rel="noopener" style={{ color: 'var(--fg-1)' }}>{x.title}</a>
                    <span style={{ color: 'var(--fg-3)' }}> · {x.game}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>{x.views}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)' }}>{x.likes}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)' }}>{x.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.features?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={th}>Feature usage (selection popup)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.features.map((f) => (
              <div key={f.feature} style={{ background: 'var(--bg-2)', borderRadius: 6, padding: '7px 11px', minWidth: 92 }}>
                <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: 'var(--accent)' }}>{f.hits.toLocaleString()}</div>
                <div style={{ ...mono, fontSize: 11, color: 'var(--fg-2)' }}>{FEATURE_LABEL[f.feature] || f.feature}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.recent_comments?.length > 0 && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ ...th, cursor: 'pointer', userSelect: 'none', marginBottom: 0 }}>
            Recent comments <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{d.engagement.comments}</span>
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {d.recent_comments.map((c, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <div style={{ ...mono, fontSize: 12, color: 'var(--fg-1)' }}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--fg-2)' }}> {c.body}</span>
                </div>
                <a href={`https://steamsolo.com/guide/${c.slug}/`} target="_blank" rel="noopener" style={{ ...mono, fontSize: 10.5, color: 'var(--fg-3)' }}>
                  {c.title} · {c.game}
                </a>
              </div>
            ))}
          </div>
        </details>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Source-language coverage of the library */}
        <div>
          <div style={th}>Guide coverage by language</div>
          {d.source_lang.slice(0, 8).map((s) => {
            const pct = Math.round((s.n / total) * 100);
            return (
              <div key={s.lang} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px' }}>
                <span style={{ ...td, padding: 0, width: 110, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.lang}</span>
                <span style={{ flex: 1, height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
                </span>
                <span style={{ ...mono, fontSize: 11, color: 'var(--fg-2)', width: 96, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.n.toLocaleString()} · {pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Demand: which languages users request that we don't have */}
        <div>
          <div style={th}>Most-requested translations {demandTotal === 0 && <span style={{ textTransform: 'none', color: 'var(--fg-3)' }}>— collecting, none yet</span>}</div>
          {d.demand.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Lang</th><th style={{ ...th, textAlign: 'right' }}>Requests</th><th style={{ ...th, textAlign: 'right' }}>Guides</th></tr></thead>
              <tbody>
                {d.demand.slice(0, 8).map((x) => (
                  <tr key={x.lang} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{x.lang}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>{x.hits}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)' }}>{x.guides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top guide+lang pairs to publish (indexed) first */}
      {d.top_demand.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={th}>Top guide × language to publish first</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {d.top_demand.slice(0, 8).map((x, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, textAlign: 'right', width: 40, color: 'var(--accent)', fontWeight: 600 }}>{x.hits}×</td>
                  <td style={{ ...td, width: 44 }}>{x.lang}</td>
                  <td style={td}>
                    <a href={`https://steamsolo.com/guide/${x.slug}/`} target="_blank" rel="noopener" style={{ color: 'var(--fg-1)' }}>
                      {x.title}
                    </a>
                    <span style={{ color: 'var(--fg-3)' }}> · {x.game}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
