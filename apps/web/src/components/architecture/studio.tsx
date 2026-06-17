'use client';

// Architecture Studio — full-bleed canvas that CONSOLIDATES the existing MOS2
// system (objects · links · flows) into one map. Read-only: it visualizes and
// validates real data; it creates nothing. Layout persists in localStorage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  type Node, type Edge, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NODE_TYPES } from './nodes';
import {
  GROUPS, OBJECTS, OBJ_BY_KEY, FLOWS, FLOW_BY_KEY,
  type ArchObject, type ArchFlow, type RelKind,
} from './spec';
import { Drawer } from '@/components/drawer';
import {
  listInstances, getInstance, systemScan, listSelectors,
  type InstanceRef, type Issue, type ScanResult, type SelRow,
} from '@/lib/actions/architecture';

type ViewKey = 'objects' | 'onpage' | 'backend';
type Pos = { x: number; y: number };
type Bound = { id: string; label: string; worst: 'error' | 'warn' | 'ok' | null };

const REL_COLOR: Record<RelKind, string> = {
  fk: '#5a6273', brief: '#ffb03c', tracking: '#ff7ab0', scope: '#5badff', gen: '#b48cff', m2m: '#3ce0c0', ref: '#7d8694',
};
const groupColor = (k: string) => GROUPS.find((g) => g.key === k)?.color || '#8a92a3';
const groupLabel = (k: string) => GROUPS.find((g) => g.key === k)?.label || k;

const COL_W = 250;
const ROW_H = 104;

// ── default layouts (overridden by saved localStorage positions) ─────────────
function defaultObjectPositions(): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  GROUPS.forEach((g, gi) => {
    pos[`group:${g.key}`] = { x: gi * COL_W, y: 0 };
    const objs = OBJECTS.filter((o) => o.group === g.key);
    objs.forEach((o, i) => { pos[o.key] = { x: gi * COL_W, y: 56 + i * ROW_H }; });
  });
  return pos;
}
function defaultFlowPositions(flow: ArchFlow): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  flow.steps.forEach((s, i) => { pos[s.id] = { x: i * 250, y: 160 + (i % 2) * 40 }; });
  return pos;
}

function pickHandles(a: Pos, b: Pos): { sourceHandle: string; targetHandle: string } {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { sourceHandle: 's-r', targetHandle: 't-l' } : { sourceHandle: 's-l', targetHandle: 't-r' };
  }
  return dy >= 0 ? { sourceHandle: 's-b', targetHandle: 't-t' } : { sourceHandle: 's-t', targetHandle: 't-b' };
}

function lsKey(view: ViewKey) { return `mos2-arch-layout:${view}`; }
function loadPositions(view: ViewKey): Record<string, Pos> {
  try { return JSON.parse(localStorage.getItem(lsKey(view)) || '{}'); } catch { return {}; }
}
function savePositions(view: ViewKey, pos: Record<string, Pos>) {
  try { localStorage.setItem(lsKey(view), JSON.stringify(pos)); } catch { /* ignore */ }
}

// Persisted bindings + project selection survive reload (F5) — restored on mount.
const BOUND_KEY = 'mos2-arch-bound';
const PROJ_KEY = 'mos2-arch-proj';
function loadBound(): Record<string, Bound> { try { return JSON.parse(localStorage.getItem(BOUND_KEY) || '{}'); } catch { return {}; } }
function loadProj(): string { try { return localStorage.getItem(PROJ_KEY) || ''; } catch { return ''; } }
const pickRandom = <T,>(a: T[]): T | undefined => (a.length ? a[Math.floor(Math.random() * a.length)] : undefined);

// ── node/edge builders ───────────────────────────────────────────────────────
function buildObjectGraph(saved: Record<string, Pos>, bound: Record<string, Bound>, scan: ScanResult | null): { nodes: Node[]; edges: Edge[] } {
  const base = defaultObjectPositions();
  const at = (id: string): Pos => saved[id] || base[id] || { x: 0, y: 0 };
  const nodes: Node[] = [];

  GROUPS.forEach((g) => {
    nodes.push({ id: `group:${g.key}`, type: 'groupLabel', position: at(`group:${g.key}`), data: { label: g.label, color: g.color }, draggable: true, selectable: false });
  });
  OBJECTS.forEach((o) => {
    const b = bound[o.key];
    const sc = scan?.[o.key];
    const scanWorst: Bound['worst'] = sc ? (sc.errors > 0 ? 'error' : sc.warns > 0 ? 'warn' : 'ok') : null;
    nodes.push({
      id: o.key, type: 'objectNode', position: at(o.key),
      data: {
        label: o.label, groupLabel: groupLabel(o.group), color: groupColor(o.group),
        attrCount: o.attrs.length, bindable: !!o.table,
        boundLabel: b?.label || null,
        worst: scanWorst || b?.worst || null,
        rows: sc ? sc.rows : null,
        issueCount: sc ? sc.errors + sc.warns : null,
      },
    });
  });

  const seen = new Set<string>();
  const edges: Edge[] = [];
  OBJECTS.forEach((o) => {
    o.relations.forEach((r) => {
      if (!OBJ_BY_KEY[r.to]) return;
      const key = `${o.key}->${r.to}:${r.kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      const h = pickHandles(at(o.key), at(r.to));
      const col = REL_COLOR[r.kind];
      edges.push({
        id: key, source: o.key, target: r.to, ...h,
        label: r.kind, type: 'default', animated: r.kind === 'tracking',
        style: { stroke: col, strokeWidth: 1.5, strokeDasharray: r.kind === 'scope' ? '4 3' : undefined },
        labelStyle: { fill: col, fontSize: 9, fontFamily: 'var(--font-mono)' },
        labelBgStyle: { fill: 'var(--bg-0)', fillOpacity: 0.85 },
        markerEnd: { type: MarkerType.ArrowClosed, color: col, width: 14, height: 14 },
      });
    });
  });
  return { nodes, edges };
}

function buildFlowGraph(flow: ArchFlow, saved: Record<string, Pos>): { nodes: Node[]; edges: Edge[] } {
  const base = defaultFlowPositions(flow);
  const at = (id: string): Pos => saved[id] || base[id] || { x: 0, y: 0 };
  const color = flow.family === 'onpage' ? '#3ce0c0' : '#5badff';
  const nodes: Node[] = flow.steps.map((s, i) => ({
    id: s.id, type: 'flowStep', position: at(s.id),
    data: { label: s.label, index: i, color, objects: s.objects, route: s.route, writes: s.writes, note: s.note },
  }));
  const edges: Edge[] = [];
  for (let i = 1; i < flow.steps.length; i++) {
    const prev = flow.steps[i - 1], cur = flow.steps[i];
    if (!prev || !cur) continue;
    edges.push({
      id: `${prev.id}->${cur.id}`, source: prev.id, target: cur.id,
      sourceHandle: 's-r', targetHandle: 't-l', type: 'default', animated: true,
      style: { stroke: color, strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    });
  }
  return { nodes, edges };
}

// ── instance inspector (inside drawer) ───────────────────────────────────────
function IssueRow({ it }: { it: Issue }) {
  const c = it.level === 'error' ? 'var(--bad)' : it.level === 'warn' ? 'var(--warn)' : 'var(--ok)';
  const icon = it.level === 'error' ? '✕' : it.level === 'warn' ? '⚠' : '✓';
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: 'var(--fg-1)', padding: '3px 0' }}>
      <span style={{ color: c, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{it.msg}</span>
    </div>
  );
}

// Searchable + grouped instance picker. Groups by `sub` (the parent context) when present.
function SearchSelect({ value, options, placeholder, onChange, disabled, width }: {
  value: string; options: InstanceRef[]; placeholder: string;
  onChange: (id: string) => void; disabled?: boolean; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const ql = q.trim().toLowerCase();
  const filtered = ql ? options.filter((o) => `${o.label} ${o.sub || ''} ${o.id}`.toLowerCase().includes(ql)) : options;
  const doGroup = options.some((o) => o.sub);
  const groups: [string, InstanceRef[]][] = (() => {
    if (!doGroup) return [['', filtered]];
    const m = new Map<string, InstanceRef[]>();
    for (const o of filtered) { const k = o.sub || '—'; const a = m.get(k); if (a) a.push(o); else m.set(k, [o]); }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  return (
    <div ref={ref} style={{ position: 'relative', ...(width ? { width } : { flex: 1, minWidth: 170 }) }}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen((o) => !o)}
        style={{ ...selStyle, width: '100%', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? 'var(--fg-0)' : 'var(--fg-3)' }}>
          {selected ? `${selected.label}${selected.sub ? ` · ${selected.sub}` : ''}` : placeholder}
        </span>
        <span style={{ color: 'var(--fg-3)', flexShrink: 0 }}>▾</span>
      </button>
      {open && !disabled && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,.55)', maxHeight: 340, display: 'flex', flexDirection: 'column' }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${options.length}…`}
            style={{ ...selStyle, margin: 6, marginBottom: 4 }} />
          <div style={{ overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fg-3)' }}>no match</div>}
            {groups.map(([g, items]) => (
              <div key={g || '_'}>
                {doGroup && g && (
                  <div style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--line)' }}>{g} · {items.length}</div>
                )}
                {items.map((o) => (
                  <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid var(--line)', padding: '6px 10px', cursor: 'pointer', background: o.id === value ? 'var(--bg-3)' : 'transparent', color: 'var(--fg-0)' }}>
                    <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{o.label}</span>
                    {!doGroup && o.sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>{o.sub}</span>}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>#{o.id}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectDrawerBody({ obj, projects, defaultProject, bound, onBind }: {
  obj: ArchObject; projects: { id: string; name: string }[]; defaultProject: string;
  bound?: Bound; onBind: (b: Bound | null) => void;
}) {
  const [projectId, setProjectId] = useState(defaultProject || projects[0]?.id || '');
  const [instances, setInstances] = useState<InstanceRef[]>([]);
  const [picked, setPicked] = useState(bound?.id || '');
  const [detail, setDetail] = useState<{ row: Record<string, unknown>; issues: Issue[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sels, setSels] = useState<SelRow[] | null>(null);
  const isScoped = obj.key === 'platform' || obj.key === 'engine' || obj.key === 'habitat';
  const parent = obj.picker?.parent;             // child needs its parent picked first (channel → habitat)
  const crossProject = !!obj.picker?.crossProject; // independent place, list across projects (habitat)
  const [parentId, setParentId] = useState('');
  const [parentInstances, setParentInstances] = useState<InstanceRef[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingRand, setPendingRand] = useState(false);

  // load the selector library for this scope once an instance is picked
  useEffect(() => {
    let dead = false;
    if (!isScoped || !picked) { setSels(null); return; }
    listSelectors(obj.key, picked).then((r) => { if (!dead) setSels(r); });
    return () => { dead = true; };
  }, [obj.key, isScoped, picked]);

  // load parent options for cascade (channel → habitat)
  useEffect(() => {
    let dead = false;
    if (!parent) { setParentInstances([]); return; }
    listInstances(parent.object).then((r) => { if (!dead) setParentInstances(r); });
    return () => { dead = true; };
  }, [parent?.object]);

  // load instance list — filtered by project (scoped), parent (cascade), or neither (cross-project)
  useEffect(() => {
    let dead = false;
    if (!obj.table) { setInstances([]); return; }
    if (parent && !parentId) { setInstances([]); return; } // wait for parent
    const projArg = obj.projectScoped && !crossProject && !parent ? projectId : undefined;
    setLoading(true);
    listInstances(obj.key, projArg, parent ? parentId : undefined)
      .then((r) => { if (!dead) setInstances(r); })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [obj.key, obj.table, obj.projectScoped, crossProject, parent?.object, parentId, projectId]);

  const inspect = useCallback(async (id: string) => {
    setPicked(id);
    if (!id) { setDetail(null); onBind(null); return; }
    setLoading(true);
    const d = await getInstance(obj.key, id);
    setLoading(false);
    if (!d) { setDetail(null); return; }
    setDetail(d);
    const worst: Bound['worst'] = d.issues.some((i) => i.level === 'error') ? 'error'
      : d.issues.some((i) => i.level === 'warn') ? 'warn' : 'ok';
    const label = instances.find((x) => x.id === id)?.label || id;
    onBind({ id, label, worst });
  }, [obj.key, instances, onBind]);

  // "Fill random": bind a random instance. For cascade objects, roll a random parent
  // first, then pick a random child once it loads (pendingRand).
  const randomFill = useCallback(() => {
    if (instances.length) { const x = pickRandom(instances); if (x) inspect(x.id); return; }
    if (parent && parentInstances.length) {
      const p = pickRandom(parentInstances);
      if (p) { setParentId(p.id); setPicked(''); setDetail(null); onBind(null); setPendingRand(true); }
    }
  }, [instances, parent, parentInstances, inspect, onBind]);
  useEffect(() => {
    if (pendingRand && instances.length) { setPendingRand(false); const x = pickRandom(instances); if (x) inspect(x.id); }
  }, [pendingRand, instances, inspect]);

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5, marginBottom: 14 }}>{obj.desc}</div>

      {/* attribute schema */}
      <Section title="Attributes" sub={`// ${obj.table || 'doc-only'}`}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          {obj.attrs.map((a, i) => (
            <div key={a.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '6px 10px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{a.name}</span>
                {a.pk && <span style={chip('var(--accent)')}>PK</span>}
                {a.fk && <span style={chip('#b48cff')}>→ {a.fk}</span>}
                {a.note && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>{a.note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {a.col && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{a.col}</span>}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)' }}>{a.type}</span>
                {detail && a.col != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ok)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fmtVal(detail.row[a.col])}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* relations */}
      <Section title="Links" sub={`// ${obj.relations.length}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {obj.relations.map((r) => (
            <div key={`${r.to}:${r.kind}`} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ ...chip(REL_COLOR[r.kind]), marginLeft: 0 }}>{r.kind}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{OBJ_BY_KEY[r.to]?.label || r.to}</span>
              {r.via && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{r.via}</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* routes */}
      <Section title="API routes" sub="// /api/ext">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {obj.routes.map((rt) => (
            <span key={rt} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-1)', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '2px 6px' }}>{rt}</span>
          ))}
        </div>
        {obj.deepLink && <a href={obj.deepLink} style={{ display: 'inline-block', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>↗ manage real {obj.label}</a>}
      </Section>

      {/* instance binding */}
      {obj.table && (
        <Section title="Bind real instance" sub="// validates against the model">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {obj.projectScoped && !crossProject && !parent && (
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setDetail(null); setPicked(''); }} style={selStyle}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {parent && (
              <SearchSelect value={parentId} options={parentInstances}
                placeholder={`— ${OBJ_BY_KEY[parent.object]?.label || parent.object} first —`}
                onChange={(idv) => { setParentId(idv); setDetail(null); setPicked(''); onBind(null); }} />
            )}
            <SearchSelect value={picked} options={instances}
              placeholder={parent && !parentId ? 'pick parent first' : loading ? 'loading…' : `— pick (${instances.length}) —`}
              onChange={inspect} disabled={!!parent && !parentId} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button type="button" onClick={() => setMenuOpen((o) => !o)} title="Actions" style={{ ...btnStyle, padding: '5px 9px' }}>⋯</button>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.5)', minWidth: 152, padding: 4 }}>
                    <button type="button" onClick={() => { randomFill(); setMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'transparent', border: 0, color: 'var(--fg-0)', fontSize: 12, padding: '6px 8px', borderRadius: 4, cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      🎲 Fill random
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          {crossProject && (
            <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 8, lineHeight: 1.5 }}>
              {obj.label} is an independent place — listed across ALL projects. It still carries a <code>project_id</code> today, so the same community can appear as several rows; the per-project approach really lives in the <b>brief</b> (account × habitat).
            </div>
          )}
          {obj.projectScoped && !crossProject && !parent && !loading && instances.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 8, lineHeight: 1.45 }}>
              0 in <b>{projects.find((p) => p.id === projectId)?.name || projectId}</b> — this object is project-scoped; switch project to find instances.
            </div>
          )}
          {detail && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Consistency check</div>
              {detail.issues.map((it, i) => <IssueRow key={i} it={it} />)}
            </div>
          )}
        </Section>
      )}

      {/* selector library for this scope (per platform/engine/habitat × entity) */}
      {isScoped && (
        <Section title="Selectors (this scope)" sub={`// scope_kind='${obj.key}'`}>
          {!picked ? (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Bind a real {obj.label} above to view its extraction selectors.</div>
          ) : sels == null ? (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>
          ) : sels.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>No selectors trained at this scope yet. Train on-page via the Crew picker (🎯) or fall back to the cascade (habitat → platform → engine).</div>
          ) : (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
              {sels.map((s, i) => (
                <div key={`${s.pageKind}.${s.fieldName}`} style={{ padding: '6px 10px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{s.fieldName}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)' }}>@ {s.pageKind}</span>
                    <span style={{ ...chip(s.source === 'manual' ? 'var(--ok)' : s.source === 'promoted' ? 'var(--accent)' : 'var(--fg-3)'), marginLeft: 'auto' }}>{s.source}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', marginTop: 2, wordBreak: 'break-all' }}>{s.css}{s.attr ? ` [${s.attr}]` : ''}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 8, lineHeight: 1.5 }}>
            The Crew extension resolves these at runtime via <code>MOS2.sel</code> (priority: DB → a.sel → platform → engine → generic) and lets you pick/edit them on the page. Manage at <a href="/engines" style={{ color: 'var(--accent)' }}>/engines</a> · <a href="/platforms" style={{ color: 'var(--accent)' }}>/platforms</a>.
          </div>
        </Section>
      )}
    </div>
  );
}

function FlowDrawerBody({ flow, stepId }: { flow: ArchFlow; stepId: string }) {
  const step = flow.steps.find((s) => s.id === stepId);
  if (!step) return null;
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5, marginBottom: 6 }}>{flow.desc}</div>
      {step.note && <div style={{ fontSize: 12.5, color: 'var(--fg-0)', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}>{step.note}</div>}
      {step.route && <Section title="Route"><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-word' }}>{step.route}</div></Section>}
      {step.writes && step.writes.length > 0 && <Section title="Writes"><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ok)' }}>{step.writes.join(' · ')}</div></Section>}
      <Section title="Objects touched" sub={`// ${step.objects.length}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {step.objects.map((ok) => {
            const o = OBJ_BY_KEY[ok];
            return (
              <div key={ok} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: groupColor(o?.group || ''), flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{o?.label || ok}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{o?.table || ''}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
function StudioInner({ projects, defaultProjectId }: { projects: { id: string; name: string }[]; defaultProjectId: string }) {
  const [view, setView] = useState<ViewKey>('objects');
  const [proj, setProj] = useState(defaultProjectId || projects[0]?.id || '');
  const [bound, setBound] = useState<Record<string, Bound>>({});
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showScanPanel, setShowScanPanel] = useState(true);
  const [sel, setSel] = useState<{ kind: 'object'; key: string } | { kind: 'flow'; flow: string; step: string } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const savedRef = useRef<Record<string, Pos>>({});
  const hydrated = useRef(false);

  // restore persisted bindings + project once (survive F5); then keep them saved
  useEffect(() => {
    const b = loadBound(); if (Object.keys(b).length) setBound(b);
    const p = loadProj(); if (p) setProj(p);
    hydrated.current = true;
  }, []);
  useEffect(() => { if (hydrated.current) { try { localStorage.setItem(BOUND_KEY, JSON.stringify(bound)); } catch { /* */ } } }, [bound]);
  useEffect(() => { if (hydrated.current && proj) { try { localStorage.setItem(PROJ_KEY, proj); } catch { /* */ } } }, [proj]);

  // (re)build graph when the view / bindings / scan change
  useEffect(() => {
    const saved = loadPositions(view);
    savedRef.current = saved;
    const flow = FLOW_BY_KEY[view === 'onpage' ? 'onpage' : 'backend'];
    const g = view === 'objects' || !flow ? buildObjectGraph(saved, bound, scan)
      : buildFlowGraph(flow, saved);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [view, bound, scan, setNodes, setEdges]);

  const runScan = useCallback(async () => {
    setScanning(true);
    try { setScan(await systemScan(proj || undefined)); setShowScanPanel(true); }
    finally { setScanning(false); }
  }, [proj]);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type === 'objectNode') setSel({ kind: 'object', key: node.id });
    else if (node.type === 'flowStep') setSel({ kind: 'flow', flow: view === 'onpage' ? 'onpage' : 'backend', step: node.id });
  }, [view]);

  const persist = useCallback(() => {
    const pos: Record<string, Pos> = { ...savedRef.current };
    nodes.forEach((n) => { pos[n.id] = n.position; });
    savedRef.current = pos;
    savePositions(view, pos);
  }, [nodes, view]);

  const resetLayout = useCallback(() => {
    savePositions(view, {});
    savedRef.current = {};
    const flow = FLOW_BY_KEY[view === 'onpage' ? 'onpage' : 'backend'];
    const g = view === 'objects' || !flow ? buildObjectGraph({}, bound, scan) : buildFlowGraph(flow, {});
    setNodes(g.nodes); setEdges(g.edges);
  }, [view, bound, scan, setNodes, setEdges]);

  const selObj = sel?.kind === 'object' ? OBJ_BY_KEY[sel.key] : null;
  const selFlow = sel?.kind === 'flow' ? FLOW_BY_KEY[sel.flow] : null;

  const drawerSub = selObj ? groupLabel(selObj.group) : selFlow ? selFlow.label : '';
  let drawerTitle = '';
  if (selObj) drawerTitle = selObj.label;
  else if (sel && sel.kind === 'flow' && selFlow) drawerTitle = selFlow.steps.find((s) => s.id === sel.step)?.label || '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-0)', display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ height: 48, flexShrink: 0, borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px' }}>
        <a href="/" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)', textDecoration: 'none' }}>← MOS2</a>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--fg-0)' }}>Architecture Studio</div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 6, padding: 2 }}>
          {([['objects', 'Objects & Links'], ['onpage', 'Flow · On-page'], ['backend', 'Flow · Backend']] as [ViewKey, string][]).map(([k, lbl]) => (
            <button key={k} onClick={() => setView(k)} style={tabStyle(view === k)}>{lbl}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {view === 'objects' && (
          <>
            <select value={proj} onChange={(e) => { setProj(e.target.value); setScan(null); }} title="Project scope for counts/scan/bind" style={selStyle}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={runScan} disabled={scanning} style={{ ...btnStyle, borderColor: scan ? 'var(--accent)' : 'var(--line)', color: scan ? 'var(--accent)' : 'var(--fg-1)' }}>
              {scanning ? '⏳ scanning…' : '⚕ Health scan'}
            </button>
          </>
        )}
        <button onClick={resetLayout} style={btnStyle}>↺ Reset layout</button>
      </div>

      {/* legend */}
      <div style={{ position: 'absolute', top: 58, left: 14, zIndex: 5, display: 'flex', flexWrap: 'wrap', gap: 8, pointerEvents: 'none' }}>
        {view === 'objects'
          ? (Object.keys(REL_COLOR) as RelKind[]).map((k) => (
              <span key={k} style={legendChip}><span style={{ width: 14, height: 2, background: REL_COLOR[k], display: 'inline-block' }} /> {k}</span>
            ))
          : <span style={legendChip}>{FLOW_BY_KEY[view === 'onpage' ? 'onpage' : 'backend']?.label || ''}</span>}
      </div>

      {/* scan summary panel */}
      {view === 'objects' && scan && showScanPanel && (() => {
        const entries = Object.entries(scan).filter(([, o]) => o.errors + o.warns > 0)
          .sort((a, b) => (b[1].errors - a[1].errors) || (b[1].warns - a[1].warns));
        const tot = Object.values(scan).reduce((a, o) => ({ e: a.e + o.errors, w: a.w + o.warns }), { e: 0, w: 0 });
        return (
          <div style={{ position: 'absolute', top: 58, right: 14, zIndex: 6, width: 286, maxHeight: '70vh', overflowY: 'auto', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)' }}>
                Health scan · <span style={{ color: 'var(--bad)' }}>{tot.e} err</span> · <span style={{ color: 'var(--warn)' }}>{tot.w} warn</span>
              </div>
              <button onClick={() => setShowScanPanel(false)} style={{ background: 'transparent', border: 0, color: 'var(--fg-3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            {entries.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'var(--ok)' }}>✓ No cross-layer inconsistencies found.</div>
            ) : entries.map(([key, o]) => (
              <button key={key} onClick={() => setSel({ kind: 'object', key })} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', padding: '8px 11px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.errors > 0 ? 'var(--bad)' : 'var(--warn)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 600 }}>{OBJ_BY_KEY[key]?.label || key}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{o.rows} rows</span>
                </div>
                {o.items.map((it, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: it.level === 'error' ? 'var(--bad)' : 'var(--warn)', marginTop: 2, marginLeft: 14 }}>
                    {it.count}× {it.msg}
                  </div>
                ))}
              </button>
            ))}
          </div>
        );
      })()}

      {/* canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick} onNodeDragStop={persist}
          nodeTypes={NODE_TYPES}
          fitView fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2} maxZoom={2}
          panOnScroll zoomOnScroll={false} zoomOnPinch preventScrolling
          panOnScrollSpeed={0.8}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="var(--line)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => {
            const d = n.data as { color?: string };
            return d?.color || '#5a6273';
          }} maskColor="rgba(7,9,13,0.7)" style={{ background: 'var(--bg-1)' }} />
        </ReactFlow>
      </div>

      {/* drawer */}
      <Drawer
        open={!!sel}
        onClose={() => setSel(null)}
        sub={drawerSub}
        title={drawerTitle}
        width={620}
        footer={null}
      >
        {selObj && <ObjectDrawerBody obj={selObj} projects={projects} defaultProject={proj} bound={bound[selObj.key]} onBind={(b) => setBound((prev) => { const next = { ...prev }; if (b) next[selObj.key] = b; else delete next[selObj.key]; return next; })} />}
        {selFlow && sel?.kind === 'flow' && <FlowDrawerBody flow={selFlow} stepId={sel.step} />}
      </Drawer>
    </div>
  );
}

export function ArchitectureStudio({ projects, defaultProjectId }: { projects: { id: string; name: string }[]; defaultProjectId?: string }) {
  return (
    <ReactFlowProvider>
      <StudioInner projects={projects} defaultProjectId={defaultProjectId || ''} />
    </ReactFlowProvider>
  );
}

// ── small style helpers ──────────────────────────────────────────────────────
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{title}</span>
        {sub && <span style={{ color: 'var(--fg-4)', textTransform: 'none', letterSpacing: '0.04em' }}>{sub}</span>}
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
      {children}
    </div>
  );
}
function fmtVal(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v).slice(0, 60);
}
function chip(color: string): React.CSSProperties {
  return { fontFamily: 'var(--font-mono)', fontSize: 9, color, border: `1px solid ${color}`, borderRadius: 3, padding: '0 4px', marginLeft: 6 };
}
const selStyle: React.CSSProperties = { background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, padding: '5px 8px', fontFamily: 'var(--font-mono)' };
const btnStyle: React.CSSProperties = { background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-1)', fontSize: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const legendChip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 7px' };
function tabStyle(active: boolean): React.CSSProperties {
  return { background: active ? 'var(--bg-0)' : 'transparent', border: active ? '1px solid var(--line)' : '1px solid transparent', borderRadius: 5, color: active ? 'var(--fg-0)' : 'var(--fg-2)', fontSize: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: active ? 600 : 400 };
}
