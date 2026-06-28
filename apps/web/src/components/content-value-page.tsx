'use client';
import { Fragment, useMemo, useState, type CSSProperties } from 'react';
import type { ContentValue, Durability, ContentCadence, CadenceBucket, HabitatPlaybook } from '@/lib/actions/content-value-types';
import { DURABILITY_META, CADENCE_META } from '@/lib/actions/content-value-types';
import { getHabitatPlaybook, createBriefFromWinners } from '@/lib/actions/content-cadence';

const CAD_ORDER: CadenceBucket[] = ['due', 'cold', 'watch', 'weak'];

// Mọi entity có node trong Architecture Studio → click mở drawer (cascade) qua onOpen (studio cấp).
// Fallback: nếu ko có onOpen/id thì external href (post_url) hoặc text thường.
export type OpenFn = (objKey: string, id: string | number, label: string) => void;
function EntityLink({ onOpen, objKey, id, label, href, style }: { onOpen?: OpenFn; objKey: string; id: number | null; label: string; href?: string | null; style?: CSSProperties }) {
  const base: CSSProperties = { color: 'var(--fg-0)', textDecoration: 'none', cursor: 'pointer', ...style };
  if (onOpen && id != null) return <a role="button" title={`Mở ${objKey} trong studio`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(objKey, id, label); }} style={base}>{label}</a>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={base}>{label}</a>;
  return <span style={{ color: 'var(--fg-1)' }}>{label}</span>;
}

// Panel "đăng gì ở đây" khi bung 1 nơi: giai đoạn kế hoạch (brief.phase → nextAction) + winner cũ để LẶP công thức + link soạn.
// Pha C: nếu CHƯA có brief (phase null) → nút sinh brief từ winner (đóng vòng A→C→B).
function Playbook({ pb, onOpen, onRefresh }: { pb: HabitatPlaybook | 'loading' | undefined; onOpen?: OpenFn; onRefresh?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!pb || pb === 'loading') return <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fg-3)' }}>Đang tải gợi ý…</div>;
  const genBrief = async () => {
    setBusy(true); setErr('');
    const r = await createBriefFromWinners(pb.habitatId);
    setBusy(false);
    if (r.ok) onRefresh?.(); else setErr(r.error || 'lỗi');
  };
  return (
    <div style={{ padding: '10px 14px 14px 34px', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: 'var(--fg-1)' }}>Đăng gì:</span>{' '}
        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, border: '1px solid var(--neon-cyan)', color: 'var(--neon-cyan)', marginRight: 6 }}>{pb.phase || 'no brief'}</span>
        <span style={{ color: 'var(--fg-1)' }}>{pb.nextAction}</span>
      </div>
      {!pb.phase && (
        <div style={{ fontSize: 12 }}>
          <button onClick={genBrief} disabled={busy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--neon-lime)', background: 'transparent', color: 'var(--neon-lime)', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Đang tạo…' : '✨ Tạo brief từ winner (Pha C)'}
          </button>
          {err && <span style={{ color: 'var(--bad)', marginLeft: 8 }}>{err}</span>}
          <span style={{ color: 'var(--fg-3)', marginLeft: 8 }}>sinh kế hoạch từ công thức đã landed ở đây</span>
        </div>
      )}
      {(pb.tone || pb.pillarName) && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          {pb.tone && <>Giọng: <b style={{ color: 'var(--fg-2)' }}>{pb.tone}</b>{pb.pillarName ? ' · ' : ''}</>}
          {pb.pillarName && <>Pillar: <b style={{ color: 'var(--fg-2)' }}>{pb.pillarName}</b></>}
        </div>
      )}

      {/* Đăng BẰNG tài khoản nào + browser/proxy quản lý nó (mọi thứ liên quan) */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '2px 0 4px' }}>Tài khoản đăng ở đây:</div>
        {pb.accounts.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Chưa có account gắn nơi này (chưa brief, chưa đăng).</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {pb.accounts.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--bg-3)', borderRadius: 8, padding: '6px 9px', background: 'var(--bg-0)', fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <EntityLink onOpen={onOpen} objKey="account" id={a.id} label={a.handle} href="/architecture?obj=account" style={{ fontWeight: 700 }} />
                  {a.platformKey && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{a.platformKey}</span>}
                  {a.status && <span style={{ fontSize: 10, padding: '0 6px', borderRadius: 99, border: `1px solid ${a.status === 'active' ? 'var(--neon-lime)' : a.status === 'blocked' || a.status === 'banned' ? 'var(--bad)' : 'var(--neon-amber)'}`, color: a.status === 'active' ? 'var(--neon-lime)' : a.status === 'blocked' || a.status === 'banned' ? 'var(--bad)' : 'var(--neon-amber)' }}>{a.status}</span>}
                  {a.accountKind && <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>{a.accountKind}</span>}
                  {a.fromBrief && <span title="Có brief = đúng account theo kế hoạch" style={{ fontSize: 10, color: 'var(--neon-cyan)' }}>★ theo brief</span>}
                  {a.postsHere > 0 && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {a.postsHere} bài ở đây</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 3, fontSize: 10, color: 'var(--fg-3)' }}>
                  <span title="Cách đăng nhập">🔑 {a.authMethod || '—'}{a.has2fa ? ' · 2FA' : ''}{a.cookieNeeded ? ' · cần cookie session' : ''}</span>
                  <span title="Browser quản lý account" style={{ color: a.browser ? 'var(--fg-2)' : 'var(--neon-amber)' }}>🌐 {a.browser ? `${a.browser.tool || 'browser'}${a.browser.label ? ' · ' + a.browser.label : ''}` : 'chưa gắn browser'}</span>
                  <span title="Proxy / IP" style={{ color: a.proxy ? 'var(--fg-2)' : 'var(--neon-amber)' }}>🛡 {a.proxy ? `${a.proxy.type || 'proxy'}${a.proxy.location ? ' · ' + a.proxy.location : ''}${a.proxy.health ? ' · ' + a.proxy.health : ''}` : 'chưa gắn proxy'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', margin: '2px 0 4px' }}>Công thức từng landed ở đây — lặp lại:</div>
        {pb.topPosts.length === 0 ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Chưa có bài nào ở đây — đây là nơi mới.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {pb.topPosts.map((p, i) => (
              <div key={i} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: 'var(--neon-cyan)', minWidth: 34 }}>{p.value}</span>
                {p.contentKind && <span style={{ fontSize: 10, color: 'var(--fg-3)', minWidth: 38 }}>{p.contentKind}</span>}
                <EntityLink onOpen={onOpen} objKey="card" id={p.id} label={p.title} href={p.url} />
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Mở bài gốc" style={{ color: 'var(--fg-4)', textDecoration: 'none' }}>↗</a>}
                <span style={{ color: 'var(--fg-4)', fontSize: 10 }}>{p.daysAgo}d</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 12, marginTop: 2 }}>
        {pb.url && <a href={pb.url} target="_blank" rel="noreferrer" style={{ color: 'var(--neon-lime)', textDecoration: 'none' }}>↗ Tới nơi để đăng</a>}
        {pb.projectId && <a href={`/p/${pb.projectId}`} style={{ color: 'var(--neon-cyan)', textDecoration: 'none' }}>✍️ Soạn ở board</a>}
      </div>
    </div>
  );
}

// Pha B — "Đến hạn → đăng nơi bền" theo habitat. Embedded trong drawer node `habitat` (KHÔNG page riêng).
// due = đăng tiếp ở đây · weak = nơi không ra giá trị, cân nhắc bỏ.
export function ContentCadenceTable({ data, projects, onOpen }: { data: ContentCadence; projects: { id: string; name: string }[]; onOpen?: OpenFn }) {
  const [proj, setProj] = useState('');
  const [bucket, setBucket] = useState<CadenceBucket | ''>('');
  const [open, setOpen] = useState<number | null>(null);
  const [pb, setPb] = useState<Record<number, HabitatPlaybook | 'loading'>>({});
  const load = (habitatId: number) => { setPb((m) => ({ ...m, [habitatId]: 'loading' })); getHabitatPlaybook(habitatId).then((p) => setPb((m) => ({ ...m, [habitatId]: p }))); };
  const toggle = (habitatId: number) => {
    if (open === habitatId) { setOpen(null); return; }
    setOpen(habitatId);
    if (!pb[habitatId]) load(habitatId);
  };
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
            <th style={{ ...th, width: 22 }} /><th style={th}>Nơi (habitat)</th><th style={th}>Platform</th>{!proj && <th style={th}>Project</th>}
            <th style={{ ...th, textAlign: 'right' }}>Bài</th><th style={{ ...th, textAlign: 'right' }}>Lâu chưa đăng</th>
            <th style={{ ...th, textAlign: 'right' }}>Best</th><th style={th}>Trạng thái</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const m = CADENCE_META[r.bucket];
              const isOpen = open === r.habitatId;
              const cols = (!proj ? 8 : 7);
              return (
                <Fragment key={r.habitatId}>
                  <tr onClick={() => toggle(r.habitatId)} style={{ cursor: 'pointer', background: isOpen ? 'var(--bg-1)' : undefined }} title="Click: đăng gì ở đây?">
                    <td style={{ ...td, textAlign: 'center', color: 'var(--fg-3)' }}>{isOpen ? '▾' : '▸'}</td>
                    <td style={{ ...td, maxWidth: 280 }}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--fg-0)', textDecoration: 'none' }}>{r.name}</a> : <span style={{ color: 'var(--fg-1)' }}>{r.name}</span>}</td>
                    <td style={{ ...td, color: 'var(--fg-2)' }}>{r.platformKey || '—'}</td>
                    {!proj && <td style={{ ...td, color: 'var(--fg-3)' }}>{r.projectName || '—'}</td>}
                    <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)' }}>{r.posts}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: r.daysSince >= 10 ? 'var(--neon-amber)' : 'var(--fg-2)' }}>{r.daysSince}d</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--neon-cyan)' }}>{r.bestValue}</td>
                    <td style={td}><span title={m.hint} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 99, border: `1px solid ${m.color}`, color: m.color, cursor: 'help' }}>{m.label}</span></td>
                  </tr>
                  {isOpen && <tr><td colSpan={cols} style={{ padding: 0, borderBottom: '1px solid var(--bg-3)' }}><Playbook pb={pb[r.habitatId]} onOpen={onOpen} onRefresh={() => load(r.habitatId)} /></td></tr>}
                </Fragment>
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
export function ContentValuePage({ data, projects, embedded = false, onOpen }: { data: ContentValue; projects: { id: string; name: string }[]; embedded?: boolean; onOpen?: OpenFn }) {
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
    if (!proj) return data.pillars.map((p) => ({ id: p.key !== 'none' ? Number(p.key) : null, name: p.pillarName, posts: p.posts, val: p.totalValue, win: p.winners }));
    const m = new Map<string, { id: number | null; name: string; posts: number; val: number; win: number }>();
    for (const x of scopeCards) { const k = x.pillarName || '(no pillar)'; const cur = m.get(k) || { id: x.pillarId, name: k, posts: 0, val: 0, win: 0 }; cur.posts++; cur.val = Math.round((cur.val + x.valueScore) * 10) / 10; if (x.durability === 'winner') cur.win++; m.set(k, cur); }
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
                <b><EntityLink onOpen={onOpen} objKey="pillar" id={p.id} label={p.name} /></b> <span style={{ color: 'var(--fg-3)' }}>· {p.posts} bài</span>
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
                  <td style={{ ...td, maxWidth: 360 }}><EntityLink onOpen={onOpen} objKey="card" id={c.id} label={c.title} href={c.postUrl} />{c.postUrl && <a href={c.postUrl} target="_blank" rel="noreferrer" title="Mở bài gốc" style={{ color: 'var(--fg-4)', textDecoration: 'none', marginLeft: 6 }}>↗</a>}</td>
                  <td style={{ ...td, color: 'var(--fg-2)' }}>{c.pillarId != null ? <EntityLink onOpen={onOpen} objKey="pillar" id={c.pillarId} label={c.pillarName || '—'} style={{ color: 'var(--fg-2)' }} /> : (c.pillarName || '—')}</td>
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
