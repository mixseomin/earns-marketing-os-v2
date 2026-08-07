import { ENTITY_DEPS } from '@/lib/entity-cascade';

// /cascade — "CRUD 1 entity → chuỗi hệ quả". Entity-centric, NOT route-string dump.
// Per entity: ↔ liên kết (real FK + junction) · ⚙ trigger DB (pg_trigger) · ↻ màn refresh
// (ENTITY_DEPS / touchEntity). Everything is derived from live DB metadata + the cascade map.

export interface DbTrigger { table: string; name: string; func: string; def: string; }
export interface FkEdge { src: string; col: string; tgt: string; }

// Curated: DB table → the entity a human thinks in. `cache` = the matching touchEntity kind
// (null = this entity has NO auto-refresh wired → surfaced as a gap ⚠, e.g. Habitat/Community).
type EntityDef = { table: string; label: string; icon: string; cache: keyof typeof ENTITY_DEPS | null };
const ENTITIES: EntityDef[] = [
  { table: 'projects',           label: 'Project',        icon: '📁', cache: 'project' },
  { table: 'platform_accounts',  label: 'Account',        icon: '🔐', cache: 'account' },
  { table: 'browser_profiles',   label: 'BrowserProfile', icon: '🧬', cache: 'environment' },
  { table: 'proxies',            label: 'Proxy',          icon: '🛰', cache: 'environment' },
  { table: 'identities',         label: 'Identity',       icon: '👤', cache: 'identity' },
  { table: 'platforms',          label: 'Platform',       icon: '🌐', cache: 'platform' },
  { table: 'tribes',             label: 'Tribe',          icon: '◍', cache: 'tribe' },
  { table: 'habitats',           label: 'Habitat / Community', icon: '🏘', cache: null },
  { table: 'content_pillars',    label: 'Pillar',         icon: '📚', cache: null },
  { table: 'community_briefs',   label: 'Brief',          icon: '📝', cache: 'brief' },
  { table: 'cards',              label: 'Card',           icon: '📋', cache: 'card' },
  { table: 'seeding_schedules',  label: 'Seeding',        icon: '⏱', cache: 'seeding' },
  { table: 'outreach_campaigns', label: 'Outreach',       icon: '✉', cache: 'outreach' },
  { table: 'squads',             label: 'Squad',          icon: '🤖', cache: 'squad' },
  { table: 'agents',             label: 'Agent',          icon: '🧠', cache: 'agent' },
  { table: 'people',             label: 'Person (Scene)', icon: '◎', cache: 'scene' },
  { table: 'contacts',           label: 'Contact',        icon: '📇', cache: null },
  { table: 'knowledge_items',    label: 'Knowledge',      icon: '📖', cache: 'knowledge' },
  { table: 'human_tasks',        label: 'Task',           icon: '📥', cache: 'inbox' },
  { table: 'members',            label: 'Team member',    icon: '👥', cache: 'team-member' },
  { table: 'media_assets',       label: 'Media',          icon: '🎬', cache: 'resource' },
];

const SECTION_LABEL: Record<string, string> = {
  resources: 'Resources', seeding: 'Seeding', tribes: 'Tribes', board: 'Board', squads: 'Squads',
  studio: 'Studio', settings: 'Settings', outreach: 'Outreach', identities: 'Identities',
  backlinks: 'Backlinks', plays: 'Plays', publications: 'Publications', community: 'Community',
};
const PATH_LABEL: Record<string, string> = {
  '/': 'All Projects', '/platforms': 'Platforms', '/architecture': 'Architecture', '/agents': 'Agents',
  '/team': 'Team', '/inbox': 'Inbox', '/knowledge': 'Knowledge', '/library': 'Library', '/roadmap': 'Roadmap',
  '/scheduler': 'Scheduler', '/tests': 'Tests', '/catalog': 'Catalog', '/plays': 'Plays',
  '/environments': 'Environments', '/ai-log': 'AI Log', '/unmapped': 'Unmapped', '/p': 'Projects', '/communities': 'Communities',
};

function eventOf(def: string): string {
  const m = def.match(/\b(BEFORE|AFTER|INSTEAD OF)\s+(.+?)\s+ON\b/i);
  return m ? `${m[1]!.toUpperCase()} ${m[2]!.replace(/\s+/g, ' ')}` : '';
}

function refreshLabels(cache: keyof typeof ENTITY_DEPS | null): string[] {
  if (!cache) return [];
  const d = ENTITY_DEPS[cache];
  const out: string[] = [];
  for (const s of d.sections ?? []) out.push(SECTION_LABEL[s] ?? s);
  if (d.self) out.push('Project overview');
  for (const p of d.paths ?? []) out.push(PATH_LABEL[p] ?? p);
  for (const p of d.pages ?? []) { const seg = p.replace('/p/[id]/', '').replace(/^\//, ''); out.push((SECTION_LABEL[seg] ?? PATH_LABEL[p] ?? seg) + ' ·all'); }
  for (const t of d.tags ?? []) out.push('cache:' + t);
  return [...new Set(out)];
}

const chipBase: React.CSSProperties = { display: 'inline-block', fontSize: 11.5, padding: '2px 8px', borderRadius: 6, marginRight: 5, marginBottom: 5, fontFamily: 'var(--font-sans)' };
const rel = { ...chipBase, background: '#3c9bff1f', color: '#9cc7ff', border: '1px solid #3c9bff33' };       // belongs-to →
const nn  = { ...chipBase, background: '#9d6cff22', color: '#c3a6ff', border: '1px solid #9d6cff40' };       // n-n ↔
const use = { ...chipBase, background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line)' };// used-by ⇠
const ref = { ...chipBase, background: '#22c98e1c', color: '#7fe3c0', border: '1px solid #22c98e33' };       // refresh ↻
const lineLbl: React.CSSProperties = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', width: 74, flexShrink: 0, paddingTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start' };

export function CascadeView({ triggers, fks }: { triggers: DbTrigger[]; fks: FkEdge[] }) {
  const byTable = new Map(ENTITIES.map((e) => [e.table, e]));
  const entityTables = new Set(ENTITIES.map((e) => e.table));

  const out = new Map<string, FkEdge[]>();   // src → edges
  const inc = new Map<string, FkEdge[]>();   // tgt → edges
  for (const f of fks) {
    (out.get(f.src) ?? out.set(f.src, []).get(f.src)!).push(f);
    (inc.get(f.tgt) ?? inc.set(f.tgt, []).get(f.tgt)!).push(f);
  }
  // Junction = a NON-entity table whose FKs point at exactly 2 distinct entity tables → n-n link.
  const junctions: { a: string; b: string; via: string }[] = [];
  for (const [src, edges] of out) {
    if (entityTables.has(src)) continue;
    const tgts = [...new Set(edges.map((e) => e.tgt).filter((t) => entityTables.has(t)))];
    if (tgts.length === 2) junctions.push({ a: tgts[0]!, b: tgts[1]!, via: src });
  }
  const trigByTable = new Map<string, DbTrigger[]>();
  for (const t of triggers) (trigByTable.get(t.table) ?? trigByTable.set(t.table, []).get(t.table)!).push(t);

  const lbl = (table: string) => byTable.get(table);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Cascade — CRUD 1 entity → chuỗi hệ quả</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Mỗi entity: <b style={{ color: '#9cc7ff' }}>↔ liên kết</b> (FK + junction thật) · <b style={{ color: 'var(--neon-amber)' }}>⚙ trigger DB</b> (pg_trigger, tự chạy khi ghi) · <b style={{ color: '#7fe3c0' }}>↻ màn refresh</b> khi CRUD (touchEntity). Nguồn = metadata DB live, không hand-author.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ENTITIES.map((e) => {
          const belongsTo = [...new Set((out.get(e.table) ?? []).map((f) => f.tgt).filter((t) => entityTables.has(t) && t !== e.table))];
          const nnMap = new Map<string, string>();
          for (const j of junctions) { if (j.a === e.table && j.b !== e.table) nnMap.set(j.b, j.via); if (j.b === e.table && j.a !== e.table) nnMap.set(j.a, j.via); }
          const usedBy = [...new Set((inc.get(e.table) ?? []).map((f) => f.src).filter((s) => entityTables.has(s) && s !== e.table))];
          const trigs = trigByTable.get(e.table) ?? [];
          const refreshes = refreshLabels(e.cache);

          return (
            <div key={e.table} data-comp="cascade.Entity" style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 9, padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 15 }}>{e.icon}</span>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{e.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>{e.table}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(belongsTo.length > 0 || nnMap.size > 0) && (
                  <div style={rowStyle}>
                    <span style={lineLbl}>↔ liên kết</span>
                    <div>
                      {[...nnMap].map(([t, via]) => { const r = lbl(t); return <span key={'n' + t} style={nn} title={`n-n qua ${via}`}>↔ {r ? `${r.icon} ${r.label}` : t}</span>; })}
                      {belongsTo.map((t) => { const r = lbl(t); return <span key={'b' + t} style={rel} title="thuộc về (FK)">→ {r ? `${r.icon} ${r.label}` : t}</span>; })}
                    </div>
                  </div>
                )}

                {usedBy.length > 0 && (
                  <div style={rowStyle}>
                    <span style={lineLbl}>⇠ dùng bởi</span>
                    <div>{usedBy.map((t) => { const r = lbl(t); return <span key={t} style={use}>{r ? `${r.icon} ${r.label}` : t}</span>; })}</div>
                  </div>
                )}

                {trigs.length > 0 && (
                  <div style={rowStyle}>
                    <span style={lineLbl}>⚙ trigger</span>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.7 }}>
                      {trigs.map((t) => (
                        <div key={t.name}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-amber)' }}>{t.name}</span>
                          <span style={{ color: 'var(--fg-4)' }}> · {eventOf(t.def)} · </span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{t.func}()</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={rowStyle}>
                  <span style={lineLbl}>↻ refresh</span>
                  <div>
                    {refreshes.length > 0
                      ? refreshes.map((r) => <span key={r} style={ref}>{r}</span>)
                      : <span style={{ fontSize: 11.5, color: 'var(--neon-amber)' }}>⚠ chưa gắn auto-refresh (không có touchEntity kind) — CRUD entity này KHÔNG tự bust cache surface nào</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 10.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        source: pg_constraint (FK) · pg_trigger · lib/entity-cascade.ts (ENTITY_DEPS) — {fks.length} FK edges · {triggers.length} triggers · {ENTITIES.length} entities
      </p>
    </div>
  );
}
