import { ENTITY_DEPS } from '@/lib/entity-cascade';
import { Panel, SimpleTable } from './ui';

// /cascade — the live view of "when an entity changes, what refreshes". Two halves:
//   • Data-layer: real Postgres triggers (pg_trigger) that cascade row writes.
//   • Cache-layer: the ENTITY_DEPS graph, rendered by-entity AND reversed by-surface.
// It reads ENTITY_DEPS directly, so the page IS the verification surface (no hand-kept copy).

export interface DbTrigger { table: string; name: string; func: string; def: string; }

// Pull the timing + event ("AFTER INSERT OR UPDATE OF project_id") out of the trigger DDL.
function eventOf(def: string): string {
  const m = def.match(/\b(BEFORE|AFTER|INSTEAD OF)\s+(.+?)\s+ON\b/i);
  return m ? `${m[1]!.toUpperCase()} ${m[2]!.replace(/\s+/g, ' ')}` : '—';
}

const chip = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block', fontSize: 11, fontFamily: 'var(--font-mono)',
  padding: '2px 7px', borderRadius: 5, background: bg, color: fg, marginRight: 4, marginBottom: 4,
});
const C = {
  section: chip('#3c9bff22', '#8fc1ff'),   // project-scoped /p/[id]/x
  self:    chip('#7d889922', '#c3ccd8'),    // /p/[id]
  path:    chip('#9d6cff22', '#c3a6ff'),    // absolute route
  page:    chip('#ffae4522', '#ffd08a'),    // route template (page)
  tag:     chip('#22c98e22', '#7fe3c0'),    // cache tag
};

export function CascadeView({ triggers }: { triggers: DbTrigger[] }) {
  const kinds = Object.keys(ENTITY_DEPS).sort() as (keyof typeof ENTITY_DEPS)[];

  // Reverse index: surface → the entity kinds that invalidate it. This is the "relationship"
  // view — one glance shows every entity feeding a given surface (and orphan surfaces show up
  // as short lists / absences).
  const rev: Record<string, string[]> = {};
  const add = (surface: string, kind: string) => { (rev[surface] ||= []).push(kind); };
  for (const k of kinds) {
    const d = ENTITY_DEPS[k];
    for (const s of d.sections ?? []) add(`/p/[id]/${s}`, k);
    if (d.self) add('/p/[id]', k);
    for (const p of d.paths ?? []) add(p, k);
    for (const p of d.pages ?? []) add(`${p} ·page`, k);
    for (const t of d.tags ?? []) add(`tag:${t}`, k);
  }
  const surfaces = Object.keys(rev).sort((a, b) => (rev[b]?.length ?? 0) - (rev[a]?.length ?? 0) || a.localeCompare(b));

  const byEntityRows = kinds.map((k) => ({ k, d: ENTITY_DEPS[k] }));

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Cascade — entity triggers & relationships</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Đụng 1 entity → refresh những đâu. Cache-layer đọc thẳng <code>ENTITY_DEPS</code> (single source), data-layer đọc <code>pg_trigger</code> thật.
        </p>
      </div>

      <Panel title="Data-layer triggers" subtitle={`Postgres · ${triggers.length} trigger — row-level cascade (junction/derived), không thể quên`}>
        {triggers.length === 0
          ? <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-3)' }}>Không có trigger user-defined nào.</p>
          : <SimpleTable rows={triggers} getRowKey={(t) => t.table + t.name}
              columns={[
                { key: 'table', header: 'Table', cell: (t) => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>{t.table}</span> },
                { key: 'name', header: 'Trigger', cell: (t) => <span style={{ fontFamily: 'var(--font-mono)' }}>{t.name}</span> },
                { key: 'event', header: 'Event', cell: (t) => <span style={{ color: 'var(--fg-2)' }}>{eventOf(t.def)}</span> },
                { key: 'func', header: 'Function', cell: (t) => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{t.func}()</span> },
              ]} />}
      </Panel>

      <Panel title="Cache cascade — by entity" subtitle="touchEntity(kind) → busts these surfaces">
        <SimpleTable rows={byEntityRows} getRowKey={(r) => r.k}
          columns={[
            { key: 'kind', header: 'Entity', width: 120, cell: (r) => <span style={{ fontWeight: 600 }}>{r.k}</span> },
            { key: 'deps', header: 'Invalidates', cell: (r) => {
              const { d } = r;
              const empty = !(d.sections?.length || d.self || d.paths?.length || d.pages?.length || d.tags?.length);
              return (
                <div>
                  {(d.sections ?? []).map((s) => <span key={'s' + s} style={C.section}>/p/[id]/{s}</span>)}
                  {d.self && <span style={C.self}>/p/[id]</span>}
                  {(d.paths ?? []).map((p) => <span key={'p' + p} style={C.path}>{p}</span>)}
                  {(d.pages ?? []).map((p) => <span key={'g' + p} style={C.page}>{p} ·page</span>)}
                  {(d.tags ?? []).map((t) => <span key={'t' + t} style={C.tag}>tag:{t}</span>)}
                  {empty && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>— (dynamic, qua ctx.sections)</span>}
                </div>
              );
            } },
          ]} />
      </Panel>

      <Panel title="Cache cascade — by surface (reverse)" subtitle="surface ← các entity feed vào nó · thấy coverage + orphan ngay">
        <SimpleTable rows={surfaces.map((s) => ({ s, ks: rev[s] ?? [] }))} getRowKey={(r) => r.s}
          columns={[
            { key: 'surface', header: 'Surface', width: 210, cell: (r) => <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>{r.s}</span> },
            { key: 'kinds', header: 'Fed by', cell: (r) => <div>{r.ks.map((k) => <span key={k} style={C.path}>{k}</span>)}</div> },
            { key: 'n', header: '#', align: 'right', width: 40, cell: (r) => <span style={{ color: 'var(--fg-3)' }}>{r.ks.length}</span> },
          ]} />
      </Panel>
    </div>
  );
}
