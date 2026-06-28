'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import type { ContentValue, Durability } from '@/lib/actions/content-value-types';
import { DURABILITY_META } from '@/lib/actions/content-value-types';

const ORDER: Durability[] = ['winner', 'rising', 'steady', 'decaying', 'dead'];

// Pha A — "Đo giá trị & độ bền" bài đã đăng (#4). Rank theo value × aliveness → Winner/Decaying/Dead +
// rollup pillar (pillar nào ra winner → nhân đôi). Data = insights ĐÃ capture (ko nhập tay).
export function ContentValuePage({ data, projects }: { data: ContentValue; projects: { id: string; name: string }[] }) {
  const [proj, setProj] = useState('');
  const [filterDur, setFilterDur] = useState<Durability | ''>('');
  const cards = useMemo(() => {
    let cs = proj ? data.cards.filter((c) => c.projectId === proj) : data.cards;
    if (filterDur) cs = cs.filter((c) => c.durability === filterDur);
    return cs;
  }, [data.cards, proj, filterDur]);
  const scopeCards = useMemo(() => (proj ? data.cards.filter((c) => c.projectId === proj) : data.cards), [data.cards, proj]);
  const counts = useMemo(() => { const c = { winner: 0, rising: 0, steady: 0, decaying: 0, dead: 0 } as Record<Durability, number>; for (const x of scopeCards) c[x.durability]++; return c; }, [scopeCards]);
  const pillars = useMemo(() => {
    const m = new Map<string, { name: string; posts: number; val: number; win: number }>();
    for (const x of scopeCards) { const k = x.pillarName || '(no pillar)'; const cur = m.get(k) || { name: k, posts: 0, val: 0, win: 0 }; cur.posts++; cur.val = Math.round((cur.val + x.valueScore) * 10) / 10; if (x.durability === 'winner') cur.win++; m.set(k, cur); }
    return [...m.values()].sort((a, b) => b.val - a.val);
  }, [scopeCards]);

  const chip: CSSProperties = { fontSize: 12, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--bg-3)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' };
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)' };

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Content · Giá trị & Độ bền</h1>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 12px' }}>
        {scopeCards.length} bài đã đăng · rank theo <b>value</b> (score + views) × <b>độ bền</b> (tuổi + lifecycle). Mục tiêu: nhân đôi <b style={{ color: 'var(--neon-lime)' }}>Winner</b>, refresh/bỏ <b style={{ color: 'var(--neon-amber)' }}>Decaying/Dead</b>.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 12px' }}>
        <select value={proj} onChange={(e) => setProj(e.target.value)} style={{ ...chip, cursor: 'pointer' }}>
          <option value="">Mọi project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ width: 1, height: 18, background: 'var(--bg-3)' }} />
        {ORDER.map((d) => {
          const m = DURABILITY_META[d]; const on = filterDur === d;
          return <button key={d} title={m.hint} onClick={() => setFilterDur(on ? '' : d)} style={{ ...chip, borderColor: on ? m.color : 'var(--bg-3)', color: on ? m.color : 'var(--fg-2)', fontWeight: on ? 700 : 500 }}>{m.label} <b style={{ color: m.color }}>{counts[d]}</b></button>;
        })}
      </div>

      {/* Pillar rollup — pillar nào tạo nhiều giá trị/winner → dồn kế hoạch vào đó (feed Pha B) */}
      {pillars.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', margin: '0 0 6px' }}>Theo pillar (nhân đôi cái ra winner)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pillars.map((p) => (
              <div key={p.name} style={{ border: '1px solid var(--bg-3)', borderRadius: 8, padding: '6px 10px', fontSize: 12, background: 'var(--bg-1)' }}>
                <b>{p.name}</b> <span style={{ color: 'var(--fg-3)' }}>· {p.posts} bài</span>
                <span style={{ color: 'var(--neon-cyan)', marginLeft: 6 }}>Σ value {p.val}</span>
                {p.win > 0 && <span style={{ color: 'var(--neon-lime)', marginLeft: 6 }}>★ {p.win} winner</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div style={{ border: '1px dashed var(--fg-3)', borderRadius: 8, padding: 20, color: 'var(--fg-2)', fontSize: 13 }}>Chưa có bài khớp bộ lọc.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Bài</th><th style={th}>Pillar</th>{!proj && <th style={th}>Project</th>}
              <th style={{ ...th, textAlign: 'right' }}>Tuổi</th><th style={{ ...th, textAlign: 'right' }}>Views</th>
              <th style={{ ...th, textAlign: 'right' }}>Score</th><th style={{ ...th, textAlign: 'right' }}>Value</th><th style={th}>Độ bền</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const m = DURABILITY_META[c.durability];
              return (
                <tr key={c.id}>
                  <td style={{ ...td, maxWidth: 360 }}>{c.postUrl ? <a href={c.postUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-0)', textDecoration: 'none' }}>{c.title}</a> : <span style={{ color: 'var(--fg-1)' }}>{c.title}</span>}</td>
                  <td style={{ ...td, color: 'var(--fg-2)' }}>{c.pillarName || '—'}</td>
                  {!proj && <td style={{ ...td, color: 'var(--fg-3)' }}>{c.projectName || '—'}</td>}
                  <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{c.ageDays}d</td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.views.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.score}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--neon-cyan)' }}>{c.valueScore}</td>
                  <td style={td}><span title={m.hint} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 99, border: `1px solid ${m.color}`, color: m.color, cursor: 'help' }}>{m.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
