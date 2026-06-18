'use client';

// Architecture Studio — full-bleed canvas that CONSOLIDATES the existing MOS2
// system (objects · links · flows) into one map. Read-only: it visualizes and
// validates real data; it creates nothing. Layout persists in localStorage.

import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
  listInstances, getInstance, systemScan, listSelectors, resolveBoundLabels, selectorCatalog, getSelectorRow, extActivity,
  type InstanceRef, type Issue, type ScanResult, type SelRow, type SelCatRow, type SelDetail, type ExtActivity, type ExtCall,
} from '@/lib/actions/architecture';

type ViewKey = 'objects' | 'onpage' | 'backend' | 'live';
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

// ── instant tooltip (0ms, portal so it survives the drawer's transform/overflow)
function Tip({ text, children, style }: { text: string; children: ReactNode; style?: CSSProperties }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const show = () => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ x: r.left + r.width / 2, y: r.top }); };
  return (
    <span ref={ref} onMouseEnter={show} onMouseLeave={() => setPos(null)} style={{ display: 'inline-flex', ...style }}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <span style={{ position: 'fixed', left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)', background: 'var(--bg-3)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 9px', fontSize: 11, lineHeight: 1.45, maxWidth: 290, zIndex: 99999, pointerEvents: 'none', boxShadow: '0 6px 24px rgba(0,0,0,.45)', whiteSpace: 'pre-wrap' }}>{text}</span>,
        document.body)}
    </span>
  );
}

// Vietnamese descriptions (internal admin tool) — explain scope/context/field on hover.
const SCOPE_KIND_VI: Record<string, string> = {
  engine: 'Cấp ENGINE (forum tech): bộ selector DÙNG CHUNG cho MỌI site chạy engine này (vd mọi forum XenForo). Ưu tiên thấp nhất trong cascade.',
  platform: 'Cấp PLATFORM: selector riêng cho 1 nền tảng (reddit, x…). Ghi đè lên cấp engine.',
  habitat: 'Cấp HABITAT: selector riêng cho 1 cộng đồng cụ thể. Ưu tiên CAO nhất, ghi đè platform + engine.',
};
const PAGE_KIND_VI: Record<string, string> = {
  composer: 'Khung soạn thảo: ô nhập reply/post, nút gửi, anchor để chèn widget, và bài đang được trả lời.',
  'account-profile': 'Trang hồ sơ tài khoản: đọc handle, karma, ngày tạo, tên hiển thị… của người dùng.',
  'platform-any': 'Áp cho MỌI trang của nền tảng (vd: kiểm tra đã đăng nhập chưa).',
  signup: 'Form đăng ký tài khoản: map các ô nhập (email, mật khẩu, ngày sinh, location…).',
  'subreddit-about': 'Trang giới thiệu cộng đồng (about): mô tả, số thành viên, luật, ngày tạo, icon…',
};
const FIELD_PREFIX_VI: Record<string, string> = {
  viewer: 'Tài khoản ĐANG đăng nhập (của mình): handle, trạng thái login…',
  post: 'Bài/comment đang xem: tác giả, nội dung, permalink, item, container…',
  composer: 'Phần tử khung soạn: ô nhập (editor), nút gửi, anchor chèn, container cha…',
  thread: 'Thông tin chủ đề/thread: tiêu đề…',
  parent: 'Container cha bao quanh item — dùng để định vị tương đối.',
  brief: 'Dữ liệu cộng đồng cho brief: trạng thái tham gia, karma trong sub, lần ghé gần nhất…',
  account: 'Hồ sơ tài khoản: handle / tên hiển thị…',
};
const FIELD_EXACT_VI: Record<string, string> = {
  _adapter: 'CẤU HÌNH HÀNH VI (insert/float/noPost…), KHÔNG phải selector DOM — nên không có CSS.',
  replyAction: 'Nút/hành động mở khung trả lời.',
  breadcrumb: 'Đường dẫn breadcrumb để nhận diện vị trí trang.',
  members: 'Số thành viên của cộng đồng.',
  rules: 'Luật của cộng đồng.',
  privacy: 'Chế độ riêng tư của cộng đồng (public/private).',
  description: 'Mô tả cộng đồng.',
  icon_url: 'URL icon/avatar của cộng đồng.',
  password: 'Ô nhập mật khẩu (form đăng ký).',
  email: 'Ô nhập email (form đăng ký).',
  username: 'Ô nhập username (form đăng ký).',
  display_name: 'Tên hiển thị.',
  karma: 'Điểm karma của tài khoản.',
  created: 'Ngày tạo tài khoản.',
  created_at: 'Ngày tạo (cộng đồng/tài khoản).',
};
const SOURCE_VI: Record<string, string> = {
  manual: 'gắn tay (manual) — ưu tiên cao, đã kiểm chứng',
  promoted: 'học & thăng cấp (promoted) từ lần pick trên trang',
  seed: 'mặc định khởi tạo (seed) — có thể chưa kiểm chứng',
};
function fieldDescVi(field: string): string {
  if (FIELD_EXACT_VI[field]) return FIELD_EXACT_VI[field];
  const pfx = field.split('.')[0]!;
  if (FIELD_PREFIX_VI[pfx]) return FIELD_PREFIX_VI[pfx];
  if (field.startsWith('custom_fields') || field.startsWith('dob_') || ['location', 'profile_location', 'state_province_region', 'address_line_one', 'profile_website', 'official_website', 'abouts', 'about', 'reactions', 'option_receive_admin_email'].includes(field))
    return `Field nhập/đọc ở form (đăng ký/hồ sơ): ${field}.`;
  return `Selector cho field: ${field}.`;
}
function selChipTip(r: SelCatRow): string {
  const src = SOURCE_VI[r.source] || `nguồn: ${r.source}`;
  return `${fieldDescVi(r.fieldName)}\nNguồn: ${src}.${r.hasCss ? '' : '\n⚠ Chưa có CSS selector — chỉ là cấu hình/flag hoặc cần train trên trang.'}`;
}

// ── anomaly detection — make "điểm bất hợp lý" POP without reading every row ──
const PLATFORM_ALIAS: Record<string, string> = { x: 'twitter', twitter: 'x' }; // same platform, 2 scope keys
// page_kind that belongs to one platform but leaked onto another (taxonomy isn't namespaced)
function rowAnomaly(scopeKind: string, scopeKey: string, pageKind: string): string | null {
  if (scopeKind === 'platform' && pageKind.startsWith('subreddit') && scopeKey !== 'reddit')
    return `page_kind "${pageKind}" là của Reddit — bất hợp lý trên nền tảng "${scopeKey}".`;
  return null;
}

// ── cascade drawer stack (Google AdX / Tag Manager): the TOP layer is standard width
// on the right; each layer below is pushed an extra step (~1/3) to the left and dimmed
// behind a scrim. Pop a level via ✕ / ‹ / Esc / click-the-dim. In-app "links" inside a
// layer push the NEXT layer (no new browser tab). ──
type SubContent = { title: string; sub?: string; body: ReactNode };
const SubCtx = createContext<(c: SubContent) => void>(() => { /* noop default */ });
const CASCADE_STEP = 240; // ≈ 1/3 of a standard 720 panel

function SubStack({ stack, popTo, width }: { stack: SubContent[]; popTo: (n: number) => void; width: number }) {
  useEffect(() => {
    if (!stack.length) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); popTo(stack.length - 1); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [stack.length, popTo]);
  if (!stack.length) return null;
  const n = stack.length;
  const baseZ = 250;
  const topZ = baseZ + (n - 1) * 4;
  return (
    <>
      {/* scrim under the top layer: dims base + lower layers; click → pop the top one */}
      <div onClick={() => popTo(n - 1)} style={{ position: 'fixed', inset: 0, zIndex: topZ - 1, background: 'rgba(7,9,13,.4)' }} />
      {stack.map((c, i) => {
        const depthFromTop = n - 1 - i;
        const isTop = i === n - 1;
        const tx = -depthFromTop * CASCADE_STEP;
        return (
          <div key={i} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width, maxWidth: '72vw', zIndex: baseZ + i * 4, transform: `translateX(${tx}px)`, transition: 'transform .2s ease-out', background: 'var(--bg-1)', borderLeft: `2px solid ${isTop ? 'var(--accent)' : 'var(--line)'}`, boxShadow: '-28px 0 90px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', pointerEvents: isTop ? 'auto' : 'none' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                {c.sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.sub}</div>}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--fg-0)', marginTop: 3, wordBreak: 'break-all' }}>{c.title}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => popTo(i)} title="Quay lại lớp trước" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', height: 26, borderRadius: 5, color: 'var(--fg-1)', cursor: 'pointer', fontSize: 13, padding: '0 9px' }}>‹</button>
                <button onClick={() => popTo(0)} title="Đóng tất cả lớp (Esc)" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', width: 26, height: 26, borderRadius: 5, color: 'var(--fg-1)', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{c.body}</div>
          </div>
        );
      })}
    </>
  );
}

// a scope's selector library (opened as a cascade layer from a selector's detail) —
// each field links to its own detail in the NEXT layer
function ScopeSelectorList({ scopeKind, scopeKey }: { scopeKind: string; scopeKey: string }) {
  const push = useContext(SubCtx);
  const [rows, setRows] = useState<SelCatRow[] | null>(null);
  useEffect(() => { let dead = false; selectorCatalog().then((r) => { if (!dead) setRows(r.filter((x) => x.scopeKind === scopeKind && x.scopeKey === scopeKey)); }); return () => { dead = true; }; }, [scopeKind, scopeKey]);
  if (rows == null) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  if (!rows.length) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Không có selector.</div>;
  const groups: { pk: string; rows: SelCatRow[] }[] = [];
  for (const r of rows) { const g = groups[groups.length - 1]; if (g && g.pk === r.pageKind) g.rows.push(r); else groups.push({ pk: r.pageKind, rows: [r] }); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{rows.length} selector · bấm 1 field để mở chi tiết ở lớp kế.</div>
      {groups.map((g) => (
        <div key={g.pk} style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '5px 10px', background: 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-1)', fontWeight: 600 }}>@ {g.pk} <span style={{ color: 'var(--fg-3)' }}>{g.rows.length}</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 10px' }}>
            {g.rows.map((r) => (
              <button key={r.id} onClick={() => push({ title: r.fieldName, sub: `${scopeKind} · ${scopeKey} · @ ${r.pageKind}`, body: <SelectorDetail id={r.id} /> })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: r.hasCss ? 'var(--fg-1)' : 'var(--fg-3)', background: 'var(--bg-1)', border: `1px ${r.hasCss ? 'solid' : 'dashed'} var(--line)`, borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>{r.fieldName}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// full detail of one selector row — opened as a cascade layer
function SelectorDetail({ id }: { id: string }) {
  const push = useContext(SubCtx);
  const [d, setD] = useState<SelDetail | null | 'loading'>('loading');
  useEffect(() => { let dead = false; setD('loading'); getSelectorRow(id).then((r) => { if (!dead) setD(r); }); return () => { dead = true; }; }, [id]);
  if (d === 'loading') return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  if (!d) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Không tìm thấy selector.</div>;
  const css = String(d.spec.css ?? '');
  const attr = d.spec.attr ? String(d.spec.attr) : '';
  const parse = d.spec.parse ? String(d.spec.parse) : '';
  const kind = d.spec.kind ? String(d.spec.kind) : '';
  const enumVals = Array.isArray(d.spec.enum_values) ? (d.spec.enum_values as unknown[]).map(String) : null;
  const notes = d.spec.notes ? String(d.spec.notes) : '';
  const anom = rowAnomaly(d.scopeKind, d.scopeKey, d.pageKind);
  const row = (label: string, val: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--bg-2)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)', wordBreak: 'break-all', minWidth: 0 }}>{val}</span>
    </div>
  );
  return (
    <div>
      {anom && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', marginBottom: 12, background: 'color-mix(in srgb, var(--bad) 12%, transparent)', border: '1px solid var(--bad)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-0)' }}>
          <span style={{ color: 'var(--bad)', fontWeight: 700 }}>⚠</span><span>{anom}</span>
        </div>
      )}
      <Section title="Định danh" sub="// where it resolves">
        {row('scope', (
          <button onClick={() => push({ title: `${d.scopeKind} · ${d.scopeKey}`, sub: 'mọi selector của scope', body: <ScopeSelectorList scopeKind={d.scopeKind} scopeKey={d.scopeKey} /> })}
            style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}>{d.scopeKind} · {d.scopeKey} ↗</button>
        ))}
        {row('page_kind', d.pageKind)}
        {row('field', d.fieldName)}
        {row('nguồn', SOURCE_VI[d.source] || d.source)}
        {row('confidence', d.confidence == null ? '—' : String(d.confidence))}
        {row('verified', d.lastVerifiedAt ? new Date(d.lastVerifiedAt).toLocaleString() : 'chưa kiểm chứng')}
      </Section>
      <Section title="Spec" sub="// cách extract">
        {row('css', css ? <span style={{ color: 'var(--accent)' }}>{css}</span> : <span style={{ color: 'var(--warn)' }}>— (chưa có CSS)</span>)}
        {attr && row('attr', attr)}
        {kind && row('kind', kind)}
        {parse && row('parse', parse)}
        {enumVals && row('enum', enumVals.join(' · '))}
        {notes && row('notes', notes)}
      </Section>
      <Section title="Raw spec" sub="// jsonb">
        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-1)', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: 10, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(d.spec, null, 2)}</pre>
      </Section>
    </div>
  );
}

// ── selector catalog (compact, browsable: scope → page_kind → fields) ────────
function SelectorCatalog() {
  const openSub = useContext(SubCtx);
  const [rows, setRows] = useState<SelCatRow[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [onlyIssues, setOnlyIssues] = useState(false);
  useEffect(() => { let dead = false; selectorCatalog().then((r) => { if (!dead) setRows(r); }); return () => { dead = true; }; }, []);

  if (rows == null) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading catalog…</div>;
  if (rows.length === 0) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>No selectors trained yet.</div>;

  const ql = q.trim().toLowerCase();
  const filtered = ql ? rows.filter((r) => `${r.scopeKey} ${r.pageKind} ${r.fieldName}`.toLowerCase().includes(ql)) : rows;

  // group: scope → page_kind → field rows, tagging each level with anomalies. Pre-sorted.
  type Row = SelCatRow & { anom: string | null };
  type Kind = { pk: string; rows: Row[]; hasAnom: boolean };
  type Scope = { key: string; scopeKind: string; scopeKey: string; total: number; kinds: Kind[]; aliasDup: string | null; problems: string[] };
  const scopes: Scope[] = [];
  for (const r of filtered) {
    const sk = `${r.scopeKind}:${r.scopeKey}`;
    let s = scopes.find((x) => x.key === sk);
    if (!s) { s = { key: sk, scopeKind: r.scopeKind, scopeKey: r.scopeKey, total: 0, kinds: [], aliasDup: null, problems: [] }; scopes.push(s); }
    s.total++;
    let k = s.kinds.find((x) => x.pk === r.pageKind);
    if (!k) { k = { pk: r.pageKind, rows: [], hasAnom: false }; s.kinds.push(k); }
    const anom = rowAnomaly(r.scopeKind, r.scopeKey, r.pageKind);
    k.rows.push({ ...r, anom });
    if (anom) { k.hasAnom = true; s.problems.push(anom); }
  }
  const presentKeys = new Set(scopes.map((s) => s.scopeKey));
  for (const s of scopes) {
    const alias = PLATFORM_ALIAS[s.scopeKey];
    // only a real problem while BOTH keys still carry selectors (auto-clears once merged)
    if (alias && presentKeys.has(alias)) { s.aliasDup = alias; s.problems.unshift(`"${s.scopeKey}" và "${alias}" là CÙNG 1 nền tảng — selector đang tách 2 key, nên gộp về 1.`); }
  }
  const totalProblems = scopes.reduce((a, s) => a + s.problems.length, 0);
  const view = onlyIssues ? scopes.filter((s) => s.problems.length > 0) : scopes;

  const isOpen = (s: Scope) => (ql || onlyIssues ? true : open.has(s.key)); // filter/issues-mode auto-expand
  const toggle = (key: string) => setOpen((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const scopeColor = (k: string) => (k === 'engine' ? '#b48cff' : k === 'platform' ? 'var(--accent)' : 'var(--ok)');

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter scope / page_kind / field…" autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Tip text={`scope = một cấp selector (engine/platform/habitat) + tên của nó.\nselectors = tổng số dòng selector đang khớp bộ lọc.`}>
          <span style={{ fontSize: 10.5, color: 'var(--fg-3)', cursor: 'help' }}>{scopes.length} scope{scopes.length > 1 ? 's' : ''} · {filtered.length} selectors</span>
        </Tip>
        {totalProblems > 0 ? (
          <button onClick={() => setOnlyIssues((v) => !v)}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, color: onlyIssues ? 'var(--bg-1)' : 'var(--bad)', background: onlyIssues ? 'var(--bad)' : 'transparent', border: '1px solid var(--bad)', borderRadius: 999, padding: '2px 9px', cursor: 'pointer' }}>
            ⚠ {totalProblems} điểm bất hợp lý{onlyIssues ? ' ✕' : ''}
          </button>
        ) : (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ok)' }}>✓ không có bất hợp lý</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {view.map((s) => {
          const bad = s.problems.length > 0;
          return (
          <div key={s.key} style={{ border: `1px solid ${bad ? 'var(--bad)' : 'var(--line)'}`, borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => toggle(s.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: bad ? 'color-mix(in srgb, var(--bad) 12%, var(--bg-2))' : 'var(--bg-2)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 9, color: 'var(--fg-3)', width: 8 }}>{isOpen(s) ? '▾' : '▸'}</span>
              <Tip text={SCOPE_KIND_VI[s.scopeKind] || `Cấp scope: ${s.scopeKind}.`} style={{ cursor: 'help' }}>
                <span style={{ ...chip(scopeColor(s.scopeKind)), marginLeft: 0 }}>{s.scopeKind}</span>
              </Tip>
              <Tip text={s.scopeKind === 'engine' ? `Forum engine "${s.scopeKey}" — selector áp cho MỌI site chạy engine này.` : s.scopeKind === 'platform' ? `Nền tảng "${s.scopeKey}".` : `Cộng đồng "${s.scopeKey}".`} style={{ cursor: 'help' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)' }}>{s.scopeKey}</span>
              </Tip>
              {bad && (
                <Tip text={s.problems.join('\n')} style={{ cursor: 'help' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: 'var(--bg-1)', background: 'var(--bad)', borderRadius: 999, padding: '1px 7px' }}>⚠ {s.problems.length}</span>
                </Tip>
              )}
              <Tip text={`${s.total} selector qua ${s.kinds.length} ngữ cảnh trang (page_kind). "ctx" = số page_kind.`} style={{ marginLeft: 'auto', cursor: 'help' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>{s.total} · {s.kinds.length} ctx</span>
              </Tip>
            </button>
            {isOpen(s) && (
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {bad && s.aliasDup && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '6px 10px', background: 'color-mix(in srgb, var(--bad) 10%, transparent)', fontSize: 11, color: 'var(--fg-0)' }}>
                    <span style={{ color: 'var(--bad)', fontWeight: 700 }}>⚠</span>
                    <span>{s.problems[0]}</span>
                  </div>
                )}
                {s.kinds.map((k) => (
                  <div key={k.pk} style={{ padding: '5px 10px 6px 22px', borderTop: '1px solid var(--bg-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Tip text={(k.hasAnom ? `⚠ ${k.rows.find((r) => r.anom)?.anom}\n\n` : '') + (PAGE_KIND_VI[k.pk] || `Ngữ cảnh trang "${k.pk}" — nhóm selector dùng ở màn hình này.`)} style={{ cursor: 'help' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: k.hasAnom ? 'var(--bad)' : 'var(--fg-1)', fontWeight: 600 }}>{k.hasAnom ? '⚠ ' : ''}@ {k.pk}</span>
                      </Tip>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>{k.rows.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {k.rows.map((r) => {
                        const border = r.anom ? 'var(--bad)' : r.hasCss ? 'var(--line)' : 'var(--fg-3)';
                        return (
                        <Tip key={r.fieldName} text={(r.anom ? `⚠ ${r.anom}\n\n` : '') + selChipTip(r) + '\n\n→ Bấm để xem chi tiết (css, spec, raw).'} style={{ cursor: 'pointer' }}>
                          <button onClick={() => openSub({ title: r.fieldName, sub: `${s.scopeKind} · ${s.scopeKey} · @ ${k.pk}`, body: <SelectorDetail id={r.id} /> })}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: r.anom ? 'var(--bad)' : r.hasCss ? 'var(--fg-1)' : 'var(--fg-3)', background: r.anom ? 'color-mix(in srgb, var(--bad) 14%, var(--bg-1))' : 'var(--bg-1)', border: `1px ${r.hasCss || r.anom ? 'solid' : 'dashed'} ${border}`, borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>{r.anom ? '⚠ ' : ''}{r.fieldName}</button>
                        </Tip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 8, lineHeight: 1.5 }}>
        Thứ tự ưu tiên lúc chạy: <b>habitat → platform → engine → generic</b> (cấp dưới ghi đè cấp trên). Quản lý tại <a href="/engines" style={{ color: 'var(--accent)' }}>/engines</a> · <a href="/platforms" style={{ color: 'var(--accent)' }}>/platforms</a>. <span style={{ color: 'var(--bad)' }}>Viền đỏ ⚠</span> = bất hợp lý · viền nét đứt = chưa có CSS.
      </div>
    </div>
  );
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
          <div style={{ overflowY: 'auto', paddingBottom: 6 }}>
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
    const label = instances.find((x) => x.id === id)?.label || bound?.label || id;
    onBind({ id, label, worst });
  }, [obj.key, instances, onBind, bound]);

  // auto-load attribute values when a binding is already selected (reopen / restored after F5)
  useEffect(() => {
    if (picked && !detail && !loading) inspect(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

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

      {/* full selector catalog — every scope × page_kind × field, with counts (gọn overview) */}
      {obj.key === 'selector' && (
        <Section title="Selector catalog" sub="// scope → page_kind → fields">
          <SelectorCatalog />
        </Section>
      )}

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                // group by page_kind — each context (composer / subreddit-about / platform-any …)
                // is where the SAME concept (user/author/viewer) is located differently
                const groups: { pk: string; rows: typeof sels }[] = [];
                for (const s of sels) {
                  const g = groups[groups.length - 1];
                  if (g && g.pk === s.pageKind) g.rows.push(s);
                  else groups.push({ pk: s.pageKind, rows: [s] });
                }
                return groups.map((g) => (
                  <div key={g.pk} style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--bg-3)', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-0)', fontWeight: 600 }}>@ {g.pk}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{g.rows.length} field{g.rows.length > 1 ? 's' : ''}</span>
                    </div>
                    {g.rows.map((s, i) => (
                      <div key={s.fieldName} style={{ padding: '6px 10px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{s.fieldName}</span>
                          <span style={{ ...chip(s.source === 'manual' ? 'var(--ok)' : s.source === 'promoted' ? 'var(--accent)' : 'var(--fg-3)'), marginLeft: 'auto' }}>{s.source}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', marginTop: 2, wordBreak: 'break-all' }}>{s.css}{s.attr ? ` [${s.attr}]` : ''}</div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
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
// ── live ext activity feed (ext_call_log) — what the extension does on real sites ──
function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const statusColor = (n: number) => (n >= 400 ? 'var(--bad)' : n >= 300 ? 'var(--warn)' : 'var(--ok)');

function LiveActivity({ onOpenObject }: { onOpenObject: (objKey: string, objId?: string | null, label?: string) => void }) {
  const [data, setData] = useState<ExtActivity | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [ep, setEp] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // re-render to refresh relative times
  const load = useCallback(() => { extActivity({ limit: 80, errorsOnly }).then(setData).catch(() => {}); }, [errorsOnly]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 10000); return () => clearInterval(t); }, []);
  void tick;

  if (!data) return <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>loading ext activity…</div>;
  const { stats, endpoints } = data;
  const rows = ep ? data.rows.filter((r) => r.endpoint === ep) : data.rows;
  const stat = (label: string, val: ReactNode, color?: string) => (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 11px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: color || 'var(--fg-0)', marginTop: 2 }}>{val}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 8px var(--ok)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>Live · Ext activity</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>// ext_call_log · auto-refresh 15s</span>
        <button onClick={load} style={{ marginLeft: 'auto', ...selStyle, cursor: 'pointer' }}>↻ refresh</button>
        <button onClick={() => setErrorsOnly((v) => !v)} style={{ ...selStyle, cursor: 'pointer', color: errorsOnly ? 'var(--bg-1)' : 'var(--bad)', background: errorsOnly ? 'var(--bad)' : 'var(--bg-2)', borderColor: 'var(--bad)' }}>⚠ chỉ lỗi</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 8, marginBottom: 14 }}>
        {stat('Calls 24h', stats.last24h)}
        {stat('Calls 7d', stats.last7d)}
        {stat('Last call', stats.lastCallAt ? `${relTime(stats.lastCallAt)} ago` : '—', 'var(--ok)')}
        {stat('Errors 7d', stats.errors7d, stats.errors7d > 0 ? 'var(--bad)' : 'var(--ok)')}
        {stat('Ext version', stats.versions[0]?.v || '—')}
      </div>

      {/* endpoint breakdown — click to filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {endpoints.map((e) => (
          <button key={e.endpoint} onClick={() => setEp(ep === e.endpoint ? null : e.endpoint)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', background: ep === e.endpoint ? 'var(--accent)' : 'var(--bg-2)', color: ep === e.endpoint ? 'var(--bg-1)' : 'var(--fg-1)', border: '1px solid var(--line)' }}>
            {e.endpoint}<span style={{ opacity: 0.7 }}>{e.n}</span>
            {e.errs > 0 && <span style={{ color: ep === e.endpoint ? 'var(--bg-1)' : 'var(--bad)', fontWeight: 700 }}>⚠{e.errs}</span>}
            {e.avgMs != null && <span style={{ opacity: 0.6 }}>{e.avgMs}ms</span>}
          </button>
        ))}
        {ep && <button onClick={() => setEp(null)} style={{ ...selStyle, cursor: 'pointer', fontSize: 10.5 }}>✕ bỏ lọc {ep}</button>}
      </div>

      {/* feed */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        {rows.length === 0 && <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>không có call nào.</div>}
        {rows.map((r, i) => {
          const obj = r.objKey;
          const human = [r.place, r.who ? `@${r.who}` : null].filter(Boolean).join(' · ');
          const openTitle = obj ? (r.objId ? `mở ${obj} đã chọn sẵn` : `mở ${obj}`) : undefined;
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
              <span title={`HTTP ${r.status}`} style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(r.status), flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', width: 34, flexShrink: 0, textAlign: 'right' }}>{relTime(r.ts)}</span>
              <button onClick={() => obj && onOpenObject(obj, r.objId, human || r.host)} disabled={!obj} title={openTitle}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: obj ? 'var(--accent)' : 'var(--fg-1)', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px', cursor: obj ? 'pointer' : 'default', flexShrink: 0, width: 120, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.objId && <span title="bind sẵn instance" style={{ color: 'var(--ok)' }}>●</span>}{r.endpoint}</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {human || r.host}{r.result && <span style={{ color: 'var(--ok)' }}> → {r.result}</span>}
                {r.errorMsg && <span style={{ color: 'var(--bad)' }}> · {r.errorMsg}</span>}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', flexShrink: 0 }}>{r.host}{r.extVersion ? ` · v${r.extVersion}` : ''}{r.durationMs != null ? ` · ${r.durationMs}ms` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudioInner({ projects, defaultProjectId }: { projects: { id: string; name: string }[]; defaultProjectId: string }) {
  const [view, setView] = useState<ViewKey>('objects');
  const [proj, setProj] = useState(defaultProjectId || projects[0]?.id || '');
  const [bound, setBound] = useState<Record<string, Bound>>({});
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showScanPanel, setShowScanPanel] = useState(true);
  const [filling, setFilling] = useState(false);
  const [sel, setSel] = useState<{ kind: 'object'; key: string } | { kind: 'flow'; flow: string; step: string } | null>(null);
  const [stack, setStack] = useState<SubContent[]>([]); // cascade drawer layers above the base
  const pushSub = useCallback((c: SubContent) => setStack((s) => [...s, c]), []);
  const popTo = useCallback((n: number) => setStack((s) => s.slice(0, n)), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const savedRef = useRef<Record<string, Pos>>({});
  const hydrated = useRef(false);

  // restore persisted bindings + project once (survive F5); then keep them saved
  useEffect(() => {
    const b = loadBound();
    if (Object.keys(b).length) {
      setBound(b);
      // refresh stale labels to the current meaningful composite (no click needed)
      resolveBoundLabels(Object.entries(b).map(([key, v]) => ({ key, id: v.id }))).then((fresh) => {
        if (Object.keys(fresh).length) setBound((prev) => {
          const next = { ...prev };
          for (const k in fresh) { const cur = next[k]; const lbl = fresh[k]; if (cur && lbl) next[k] = { ...cur, label: lbl }; }
          return next;
        });
      }).catch(() => { /* */ });
    }
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

  // Bind a random instance to every bindable node that is still empty (skips already-bound).
  const fillAllEmpty = useCallback(async () => {
    setFilling(true);
    try {
      const targets = OBJECTS.filter((o) => o.table && !bound[o.key]);
      const results = await Promise.all(targets.map(async (o): Promise<[string, Bound] | null> => {
        try {
          // list ALL instances directly (ignore the drawer's parent cascade — for a
          // bulk fill we just want any row; cascade parents are too sparse to hit).
          const projArg = o.projectScoped && !o.picker?.crossProject ? (proj || undefined) : undefined;
          const list = await listInstances(o.key, projArg);
          const inst = pickRandom(list);
          if (!inst) return null;
          const d = await getInstance(o.key, inst.id);
          const worst: Bound['worst'] = d ? (d.issues.some((i) => i.level === 'error') ? 'error' : d.issues.some((i) => i.level === 'warn') ? 'warn' : 'ok') : null;
          return [o.key, { id: inst.id, label: inst.label, worst }];
        } catch { return null; }
      }));
      setBound((prev) => { const next = { ...prev }; for (const r of results) if (r) next[r[0]] = r[1]; return next; });
    } finally { setFilling(false); }
  }, [bound, proj]);

  const clearAll = useCallback(() => setBound({}), []);

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setStack([]); // fresh node → reset cascade
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
          {([['objects', 'Objects & Links'], ['onpage', 'Flow · On-page'], ['backend', 'Flow · Backend'], ['live', 'Live · Activity']] as [ViewKey, string][]).map(([k, lbl]) => (
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
            <button onClick={fillAllEmpty} disabled={filling} title="Bind a random instance to every empty node" style={btnStyle}>
              {filling ? '⏳ filling…' : '🎲 Fill all'}
            </button>
            {Object.keys(bound).length > 0 && (
              <button onClick={clearAll} title="Clear all bindings" style={btnStyle}>✕</button>
            )}
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

      {/* canvas (or live feed) */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {view === 'live' ? (
          <LiveActivity onOpenObject={(key, instId, label) => {
            setStack([]);
            if (instId) setBound((prev) => ({ ...prev, [key]: { id: instId, label: label || instId, worst: null } }));
            setSel({ kind: 'object', key });
          }} />
        ) : (
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
        )}
      </div>

      {/* drawer */}
      <SubCtx.Provider value={pushSub}>
        <Drawer
          open={!!sel}
          onClose={() => { setSel(null); setStack([]); }}
          sub={drawerSub}
          title={drawerTitle}
          width={860}
          footer={null}
          pushPx={sel ? Math.min(stack.length * CASCADE_STEP, 600) : 0}
        >
          {selObj && <ObjectDrawerBody obj={selObj} projects={projects} defaultProject={proj} bound={bound[selObj.key]} onBind={(b) => setBound((prev) => { const next = { ...prev }; if (b) next[selObj.key] = b; else delete next[selObj.key]; return next; })} />}
          {selFlow && sel?.kind === 'flow' && <FlowDrawerBody flow={selFlow} stepId={sel.step} />}
        </Drawer>
        <SubStack stack={sel ? stack : []} popTo={popTo} width={720} />
      </SubCtx.Provider>
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
