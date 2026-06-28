'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import type { ContentValue, Durability, ContentCadence, CadenceBucket } from '@/lib/actions/content-value-types';
import { DURABILITY_META, CADENCE_META } from '@/lib/actions/content-value-types';

const CAD_ORDER: CadenceBucket[] = ['due', 'cold', 'watch', 'weak'];

// Pha B — "Đến hạn → đăng nơi bền" theo habitat. Embedded trong drawer node `habitat` (KHÔNG page riêng).
// due = đăng tiếp ở đây · weak = nơi không ra giá trị, cân nhắc bỏ.
export function ContentCadenceTable({ data, projects }: { data: ContentCadence; projects: { id: string; name: string }[] }) {
  const [proj, setProj] = useState('');
  const [bucket, setBucket] = useState<CadenceBucket | ''>('');
  const scope = useMemo(() => (proj ? data.rows.filter((r) => r.projectId === proj) : data.rows), [data.rows, proj]);
  const rows = useMemo(() => (bucket ? scope.filter((r) => r.bucket === bucket) : scope), [scope, bucket]);
  const counts = useMemo(() => { const c = { due: 0, watch: 0, cold: 0, weak: 0 } as Record<CadenceBucket, number>; for (const r of scope) c[r.bucket]++; return c; }, [scope]);

  const chip: CSSProperties = { fontSize: 12, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--bg-3)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' };
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)' };

  if (data.rows.length === 0) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có bài đăng gắn habitat để tính cadence.</div>;
  return (
    <div>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 10px' }}>
        {scope.length} nơi đã đăng · <b style={{ color: 'var(--neon-lime)' }}>Đến hạn</b> = nơi bền (best ≥ {data.durableCut}) nhưng ≥10 ngày chưa đăng → ưu tiên đăng tiếp. <b style={{ color: 'var(--bad)' }}>Yếu</b> = best≈0 → cân nhắc bỏ.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px' }}>
        <select value={proj} onChange={(e) => setProj(e.target.value)} style={{ ...chip, cursor: 'pointer' }}>
          <option value="">Mọi project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ width: 1, height: 18, background: 'var(--bg-3)' }} />
        {CAD_ORDER.map((b) => {
          const m = CADENCE_META[b]; const on = bucket === b;
          return <button key={b} title={m.hint} onClick={() => setBucket(on ? '' : b)} style={{ ...chip, borderColor: on ? m.color : 'var(--bg-3)', color: on ? m.color : 'var(--fg-2)', fontWeight: on ? 700 : 500 }}>{m.label} <b style={{ color: m.color }}>{counts[b]}</b></button>;
        })}
      </div>
      {rows.length === 0 ? <div style={{ border: '1px dashed var(--fg-3)', borderRadius: 8, padding: 16, color: 'var(--fg-2)', fontSize: 13 }}>Không có nơi khớp bộ lọc.</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Nơi (habitat)</th><th style={th}>Platform</th>{!proj && <th style={th}>Project</th>}
            <th style={{ ...th, textAlign: 'right' }}>Bài</th><th style={{ ...th, textAlign: 'right' }}>Lâu chưa đăng</th>
            <th style={{ ...th, textAlign: 'right' }}>Best</th><th style={th}>Trạng thái</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const m = CADENCE_META[r.bucket];
              return (
                <tr key={r.habitatId}>
                  <td style={{ ...td, maxWidth: 280 }}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-0)', textDecoration: 'none' }}>{r.name}</a> : <span style={{ color: 'var(--fg-1)' }}>{r.name}</span>}</td>
                  <td style={{ ...td, color: 'var(--fg-2)' }}>{r.platformKey || '—'}</td>
                  {!proj && <td style={{ ...td, color: 'var(--fg-3)' }}>{r.projectName || '—'}</td>}
                  <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)' }}>{r.posts}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: r.daysSince >= 10 ? 'var(--neon-amber)' : 'var(--fg-2)' }}>{r.daysSince}d</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--neon-cyan)' }}>{r.bestValue}</td>
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

const ORDER: Durability[] = ['winner', 'rising', 'steady', 'decaying', 'dead'];

// Pha A — "Đo giá trị & độ bền" bài đã đăng (#4). Rank value × aliveness → Winner/Decaying/Dead +
// rollup pillar (pillar ra winner → nhân đôi). Data = insights ĐÃ capture. SỐNG TRONG drawer node `card`
// của Architecture Studio (embedded=true bỏ chrome) — KHÔNG page riêng (xem feedback_no_new_pages).
// counts/pillars/total lấy thẳng từ SQL (scale 1M); bảng chỉ top-500 (data.truncated báo nếu cắt).
export function ContentValuePage({ data, projects, embedded = false }: { data: ContentValue; projects: { id: string; name: string }[]; embedded?: boolean }) {
  const [proj, setProj] = useState('');
  const [filterDur, setFilterDur] = useState<Durability | ''>('');
  // proj filter chỉ lọc bảng top-500 client-side (đủ ở quy mô hiện tại). counts/pillars KHÔNG lọc theo proj
  // khi ko chọn → dùng SQL (chính xác mọi quy mô); khi chọn proj → recompute từ cards đang thấy.
  const scopeCards = useMemo(() => (proj ? data.cards.filter((c) => c.projectId === proj) : data.cards), [data.cards, proj]);
  const cards = useMemo(() => (filterDur ? scopeCards.filter((c) => c.durability === filterDur) : scopeCards), [scopeCards, filterDur]);

  const counts = useMemo(() => {
    if (!proj) return data.counts; // SQL-accurate, scale-safe
    const c = { winner: 0, rising: 0, steady: 0, decaying: 0, dead: 0 } as Record<Durability, number>;
    for (const x of scopeCards) c[x.durability]++; return c;
  }, [data.counts, proj, scopeCards]);
  const total = proj ? scopeCards.length : data.total;

  const pillars = useMemo(() => {
    if (!proj) return data.pillars.map((p) => ({ name: p.pillarName, posts: p.posts, val: p.totalValue, win: p.winners }));
    const m = new Map<string, { name: string; posts: number; val: number; win: number }>();
    for (const x of scopeCards) { const k = x.pillarName || '(no pillar)'; const cur = m.get(k) || { name: k, posts: 0, val: 0, win: 0 }; cur.posts++; cur.val = Math.round((cur.val + x.valueScore) * 10) / 10; if (x.durability === 'winner') cur.win++; m.set(k, cur); }
    return [...m.values()].sort((a, b) => b.val - a.val);
  }, [data.pillars, proj, scopeCards]);

  const chip: CSSProperties = { fontSize: 12, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--bg-3)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' };
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)' };

  return (
    <div style={embedded ? undefined : { padding: 16, maxWidth: 1100 }}>
      {!embedded && <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Content · Giá trị & Độ bền</h1>}
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 12px' }}>
        {total} bài đã đăng · rank theo <b>value</b> (score + views) × <b>độ bền</b> (tuổi + lifecycle). Mục tiêu: nhân đôi <b style={{ color: 'var(--neon-lime)' }}>Winner</b>, refresh/bỏ <b style={{ color: 'var(--neon-amber)' }}>Decaying/Dead</b>.
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
      {data.truncated && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>Bảng hiện top {data.cards.length} theo value (tổng {data.total}). Counts + pillar tính trên toàn bộ trong SQL.</div>}
    </div>
  );
}
