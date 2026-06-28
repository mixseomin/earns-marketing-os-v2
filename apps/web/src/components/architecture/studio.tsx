'use client';

// Architecture Studio — full-bleed canvas that CONSOLIDATES the existing MOS2
// system (objects · links · flows) into one map. Read-only: it visualizes and
// validates real data; it creates nothing. Layout persists in localStorage.

import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow, MarkerType,
  type Node, type Edge, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NODE_TYPES } from './nodes';
import crewCaps from './crew-capabilities.json';
import { ContentValuePage, ContentCadenceTable } from '@/components/content-value-page';
import type { ContentValue, ContentCadence } from '@/lib/actions/content-value-types';
import { PillarCoveragePanel } from '@/components/architecture/pillar-coverage-panel';
import { AccountInfraPanel } from '@/components/architecture/account-infra-panel';
import { TeamPanel } from '@/components/architecture/team-panel';
import {
  GROUPS, OBJECTS, OBJ_BY_KEY, FLOWS, FLOW_BY_KEY, CANON, BROWSE_GROUPS,
  EXT_SURFACE, SURFACE_GROUP_META, SURFACE_LAYERS,
  type ArchObject, type ArchFlow, type RelKind, type BrowseGroup, type SurfaceGroup,
} from './spec';
import { Drawer } from '@/components/drawer';
import {
  listInstances, browseInstances, getInstance, updateInstance, systemScan, listSelectors, resolveBoundLabels, selectorCatalog, getSelectorRow, extActivity, metricCoverage,
  templateAdoption, listDomSamples, listDomSamplesForPlatform, deleteDomSample, extractDomSample, seedSelectorsFromSample,
  listUxFlows, getUxFlow,
  getIdentity, updateIdentity,
  canonChecks, type CanonCheck,
  type InstanceRef, type InstancePage, type BrowseRow, type Issue, type ScanResult, type SelRow, type SelCatRow, type SelDetail, type ExtActivity, type ExtCall,
  type MetricCoverage, type MetricCell, type TemplateAdoptionData, type DomSampleRow, type DomExtract, type ExtractedEntity, type SeedSelector, type SeedFieldState,
  type UxFlowRow, type UxFlowDetailData, type IdentityDetailData,
} from '@/lib/actions/architecture';
import { listContentPillars, updateContentPillar, type ContentPillarRow } from '@/lib/actions/content-pillars';
import { listTribesForProject } from '@/lib/actions/tribes-crud';
import ReactMarkdown, { type Components } from 'react-markdown';

// compact markdown rendering for the dark drawer (default h1/p sizes are too big in a narrow panel).
const MD_COMPONENTS: Components = {
  h1: ({ node, ...p }) => <div style={{ fontSize: 14, fontWeight: 700, margin: '9px 0 4px', color: 'var(--fg-0)' }} {...p} />,
  h2: ({ node, ...p }) => <div style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 3px', color: 'var(--fg-0)' }} {...p} />,
  h3: ({ node, ...p }) => <div style={{ fontSize: 12.5, fontWeight: 700, margin: '6px 0 3px', color: 'var(--fg-1)' }} {...p} />,
  p: ({ node, ...p }) => <p style={{ margin: '4px 0', fontSize: 12, lineHeight: 1.55, color: 'var(--fg-1)' }} {...p} />,
  ul: ({ node, ...p }) => <ul style={{ margin: '4px 0', paddingLeft: 18 }} {...p} />,
  ol: ({ node, ...p }) => <ol style={{ margin: '4px 0', paddingLeft: 18 }} {...p} />,
  li: ({ node, ...p }) => <li style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--fg-1)', margin: '2px 0' }} {...p} />,
  a: ({ node, ...p }) => <a style={{ color: 'var(--accent)' }} target="_blank" rel="noopener noreferrer" {...p} />,
  code: ({ node, ...p }) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-2)', padding: '1px 4px', borderRadius: 4 }} {...p} />,
  strong: ({ node, ...p }) => <strong style={{ color: 'var(--fg-0)' }} {...p} />,
  blockquote: ({ node, ...p }) => <blockquote style={{ borderLeft: '2px solid var(--line)', margin: '4px 0', paddingLeft: 8, color: 'var(--fg-2)' }} {...p} />,
};
const looksMarkdown = (s: string) => /(^|\n)#{1,6}\s/.test(s) || /\*\*[^*\n]+\*\*/.test(s) || /(^|\n)\s*[-*]\s/.test(s) || /(^|\n)\s*\d+\.\s/.test(s) || /\[[^\]]+\]\([^)]+\)/.test(s);
import { adoptTemplate } from '@/lib/actions/platforms';

type ViewKey = 'objects' | 'onpage' | 'backend' | 'live' | 'canon' | 'surface';
type Pos = { x: number; y: number };
type Bound = { id: string; label: string; worst: 'error' | 'warn' | 'ok' | null };

const REL_COLOR: Record<RelKind, string> = {
  fk: '#5a6273', brief: '#ffb03c', tracking: '#ff7ab0', scope: '#5badff', gen: '#b48cff', m2m: '#3ce0c0', ref: '#7d8694',
};
const groupColor = (k: string) => GROUPS.find((g) => g.key === k)?.color || '#8a92a3';
const groupLabel = (k: string) => GROUPS.find((g) => g.key === k)?.label || k;

// Layout spacing — cột = GROUPS (trái→phải), trong 1 cột node xếp dọc theo CHIỀU
// CAO THẬT + gap (node cao đẩy node dưới xuống → ko chồng khi sau này node dài/ngắn
// khác nhau). Rộng rãi; reset đo size thật để giãn khít.
const COL_GAP = 120;       // khoảng trống giữa 2 cột (cộng vào bề rộng cột)
const ROW_GAP = 44;        // khoảng trống dọc giữa các node trong 1 cột
const HEADER_GAP = 34;     // group label → node đầu tiên
const EST_W = 200, EST_H = 104;  // ước lượng khi chưa đo được (first paint)

// ── default layouts (overridden by saved localStorage positions) ─────────────
// measured = {id: {w,h}} kích thước thật từ ReactFlow (reset truyền vào). Trống →
// ước lượng EST_* (first paint trước khi đo). Bề rộng mỗi cột = node rộng nhất cột đó.
function layoutColumns(measured: Record<string, { w: number; h: number }> = {}): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  let x = 0;
  GROUPS.forEach((g) => {
    const objs = OBJECTS.filter((o) => o.group === g.key);
    const colW = Math.max(EST_W, measured[`group:${g.key}`]?.w || 0, ...objs.map((o) => measured[o.key]?.w || 0));
    pos[`group:${g.key}`] = { x, y: 0 };
    let y = (measured[`group:${g.key}`]?.h || 24) + HEADER_GAP;
    objs.forEach((o) => {
      pos[o.key] = { x, y };
      y += (measured[o.key]?.h || EST_H) + ROW_GAP;
    });
    x += colW + COL_GAP;
  });
  return pos;
}
function defaultObjectPositions(): Record<string, Pos> { return layoutColumns(); }
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
const TECH_SCOPE_VI = 'Cấp TECHNOLOGY (forum tech): bộ selector DÙNG CHUNG cho MỌI site chạy technology này (vd mọi forum XenForo). Ưu tiên thấp nhất trong cascade.';
const SCOPE_KIND_VI: Record<string, string> = {
  technology: TECH_SCOPE_VI,
  engine: TECH_SCOPE_VI, // legacy scope value alias
  platform: 'Cấp PLATFORM: selector riêng cho 1 nền tảng (reddit, x…). Ghi đè lên cấp technology.',
  habitat: 'Cấp HABITAT: selector riêng cho 1 cộng đồng cụ thể. Ưu tiên CAO nhất, ghi đè platform + technology.',
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
// Descriptor SERIALIZABLE của 1 lớp drawer → cho URL nhớ full flow (F5 mở lại đúng
// trình tự). body (ReactNode) không serialize được nên mỗi push kèm `route` để rebuild.
type SubRoute =
  | { t: 'entity'; scope: 'platform' | 'technology'; key: string; tech?: string | null }
  | { t: 'dom'; id: number }
  | { t: 'sel'; id: string }
  | { t: 'scopeSel'; scopeKind: string; scopeKey: string }
  | { t: 'metric'; metric: string; platform: string; via: string }
  | { t: 'uxflow'; id: number }
  | { t: 'objpeek'; objKey: string }
  | { t: 'identity'; id: number }
  | { t: 'domlist'; pk: string; label?: string }
  | { t: 'inst'; objKey: string; id: string; label?: string };
type SubContent = { title: string; sub?: string; body: ReactNode; route?: SubRoute };
const SubCtx = createContext<(c: SubContent) => void>(() => { /* noop default */ });
const CASCADE_STEP = 240; // ≈ 1/3 of a standard 720 panel

// Rebuild 1 lớp drawer từ route (dùng khi F5 restore từ URL). Header đơn giản hơn
// lúc click live (chỉ có dữ liệu trong route) — body tự load đầy đủ.
function renderRoute(r: SubRoute): SubContent {
  switch (r.t) {
    case 'entity': return { title: r.key, sub: `${r.scope} hub · selectors + samples`, body: <EntityScopeDrawer scope={r.scope} scopeKey={r.key} technologyKey={r.tech ?? null} />, route: r };
    case 'dom': return { title: `#${r.id}`, sub: 'extract preview', body: <DomSampleDetail id={r.id} />, route: r };
    case 'domlist': return { title: `DOM · ${r.label || r.pk}`, sub: 'samples của platform', body: <DomSampleList platformKey={r.pk} label={r.label} />, route: r };
    case 'sel': return { title: `selector #${r.id}`, sub: 'selector detail', body: <SelectorDetail id={r.id} />, route: r };
    case 'scopeSel': return { title: `${r.scopeKind} · ${r.scopeKey}`, sub: 'mọi selector của scope', body: <ScopeSelectorList scopeKind={r.scopeKind} scopeKey={r.scopeKey} />, route: r };
    case 'metric': return { title: `${r.metric} · ${r.platform}`, sub: 'train metric', body: <MetricTrainGuide metric={r.metric} platform={r.platform} via={r.via} />, route: r };
    case 'uxflow': return { title: `flow #${r.id}`, sub: 'need→action steps', body: <UxFlowDetail id={r.id} />, route: r };
    case 'objpeek': return { title: OBJ_BY_KEY[r.objKey]?.label || r.objKey, sub: 'entity spec (peek)', body: <ObjPeek objKey={r.objKey} />, route: r };
    case 'identity': return { title: `identity #${r.id}`, sub: 'persona · view + edit', body: <IdentityDetail id={r.id} />, route: r };
    case 'inst': return { title: r.label || `#${r.id}`, sub: `${OBJ_BY_KEY[r.objKey]?.label || r.objKey} · #${r.id}`, body: <InstanceDetail objKey={r.objKey} id={r.id} />, route: r };
  }
}
function encodeStack(stack: SubContent[]): string {
  const routes: SubRoute[] = [];
  for (const c of stack) { if (!c.route) break; routes.push(c.route); } // chỉ prefix serialize được
  return routes.length ? encodeURIComponent(JSON.stringify(routes)) : '';
}
function decodeStack(raw: string): SubContent[] {
  try {
    const arr = JSON.parse(decodeURIComponent(raw)) as SubRoute[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => r && typeof r.t === 'string').map(renderRoute);
  } catch { return []; }
}

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
              <button key={r.id} onClick={() => push({ title: r.fieldName, sub: `${scopeKind} · ${scopeKey} · @ ${r.pageKind}`, body: <SelectorDetail id={r.id} />, route: { t: 'sel', id: r.id } })}
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
          <button onClick={() => push({ title: `${d.scopeKind} · ${d.scopeKey}`, sub: 'mọi selector của scope', body: <ScopeSelectorList scopeKind={d.scopeKind} scopeKey={d.scopeKey} />, route: { t: 'scopeSel', scopeKind: d.scopeKind, scopeKey: d.scopeKey } })}
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
  const scopeColor = (k: string) => (k === 'technology' || k === 'engine' ? '#b48cff' : k === 'platform' ? 'var(--accent)' : 'var(--ok)');

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter scope / page_kind / field…" autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Tip text={`scope = một cấp selector (technology/platform/habitat) + tên của nó.\nselectors = tổng số dòng selector đang khớp bộ lọc.`}>
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
              <Tip text={s.scopeKind === 'technology' || s.scopeKind === 'engine' ? `Forum technology "${s.scopeKey}" — selector áp cho MỌI site chạy technology này.` : s.scopeKind === 'platform' ? `Nền tảng "${s.scopeKey}".` : `Cộng đồng "${s.scopeKey}".`} style={{ cursor: 'help' }}>
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
                          <button onClick={() => openSub({ title: r.fieldName, sub: `${s.scopeKind} · ${s.scopeKey} · @ ${k.pk}`, body: <SelectorDetail id={r.id} />, route: { t: 'sel', id: r.id } })}
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
        Thứ tự ưu tiên lúc chạy: <b>habitat → platform → technology → generic</b> (cấp dưới ghi đè cấp trên). Quản lý tại <a href="/technologies" style={{ color: 'var(--accent)' }}>/technologies</a> · <a href="/platforms" style={{ color: 'var(--accent)' }}>/platforms</a>. <span style={{ color: 'var(--bad)' }}>Viền đỏ ⚠</span> = bất hợp lý · viền nét đứt = chưa có CSS.
      </div>
    </div>
  );
}

// ── metric tracking coverage (matrix metric × platform) ──────────────────────
// "Chỗ quản lý" việc bắt SỐ engagement (views/score/replies/shares) từ DOM. Mỗi ô =
// 1 cặp (metric, platform): đã train selector chưa? GAP đỏ = có card đăng nhưng KHÔNG
// selector → số không bao giờ bắt được (vd Reddit views). ◆ API = số có sẵn nhưng đến
// từ commentstats API, KHÔNG selector DOM. Bấm ô đã train → mở selector detail (lớp kế).
function MetricTrainGuide({ metric, platform, via }: { metric: string; platform: string; via: string }) {
  const step = (n: number, t: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, padding: '4px 0' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{n}</span>
      <span style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5 }}>{t}</span>
    </div>
  );
  return (
    <div>
      <div style={{ padding: '8px 10px', marginBottom: 12, background: 'color-mix(in srgb, var(--bad) 12%, transparent)', border: '1px solid var(--bad)', borderRadius: 6, fontSize: 12, color: 'var(--fg-0)' }}>
        Chưa có selector cho <b>{metric}</b> trên <b>{platform}</b> → số này hiện <b>không bắt được</b>. Train 1 lần qua extension:
      </div>
      {step(1, <>Mở 1 post/thread đã đăng của mình trên <b>{platform}</b> (nơi nhìn thấy số {metric}).</>)}
      {step(2, <>Bật Crew ext → mở <b>🎯 Selector manager</b> (nút trên crew bar) → kéo xuống mục <b>📊 Metrics</b>.</>)}
      {step(3, <>Bấm <b>🎯 Pick</b> ở dòng <b>{metric}</b> → click đúng con số trên trang. Ext tự sinh CSS.</>)}
      {step(4, <>Chọn cách đọc <b>via</b> = <code style={{ fontFamily: 'var(--font-mono)' }}>{via}</code> (mặc định). Nếu số nằm trong attribute gốc (vd <code style={{ fontFamily: 'var(--font-mono)' }}>faceplate-number number="29"</code>) → đổi via=<b>attr</b> để chính xác hơn "2.3K".</>)}
      {step(5, <>Chọn scope: <b>Platform ({platform})</b> cho riêng nền tảng, hoặc <b>Technology</b> nếu muốn dùng chung cho mọi forum cùng technology (xenforo…). Bấm <b>💾 Lưu</b>.</>)}
      <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
        Lưu xong: selector vào <code style={{ fontFamily: 'var(--font-mono)' }}>selector_overrides</code> (page_kind <code style={{ fontFamily: 'var(--font-mono)' }}>post-metrics</code>) → ext đọc qua <code style={{ fontFamily: 'var(--font-mono)' }}>MOS2.sel.metrics()</code> → lần track kế gửi số lên <code style={{ fontFamily: 'var(--font-mono)' }}>/seeding/insights</code> → ô này chuyển <span style={{ color: 'var(--ok)' }}>xanh ✓</span> + Live feed hiện 👁.
      </div>
    </div>
  );
}

function MetricCoveragePanel() {
  const openSub = useContext(SubCtx);
  const [cov, setCov] = useState<MetricCoverage | null>(null);
  useEffect(() => { let dead = false; metricCoverage().then((c) => { if (!dead) setCov(c); }); return () => { dead = true; }; }, []);
  if (cov == null) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading coverage…</div>;
  const cellOf = (metric: string, platform: string) => cov.cells.find((c) => c.metric === metric && c.platform === platform);
  const gaps = cov.cells.filter((c) => c.gap).length;
  const trained = cov.cells.filter((c) => c.trained).length;
  const apiFed = cov.cells.filter((c) => c.apiFed).length;
  if (!cov.platforms.length) {
    return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có card đã đăng nào để đo coverage.</div>;
  }
  const th: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', fontWeight: 600, padding: '5px 7px', textAlign: 'center', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{cov.metrics.length} metric × {cov.platforms.length} platform</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
          <span style={{ color: 'var(--ok)' }}>✓ {trained}</span>
          {gaps > 0 ? <span style={{ color: 'var(--bad)', fontWeight: 700 }}>⚠ {gaps} gap</span> : <span style={{ color: 'var(--ok)' }}>0 gap</span>}
          {apiFed > 0 && <Tip text={'◆ API: số có data nhưng KHÔNG do selector DOM bắt — đến từ commentstats API (Reddit). Đúng thiết kế, không phải lỗi.'}><span style={{ color: '#3fb6c4', cursor: 'help' }}>◆ {apiFed} API</span></Tip>}
        </span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>metric ↓ / platform →</th>
              {cov.platforms.map((p) => (
                <th key={p.key} style={th}>
                  <Tip text={`${p.key}${p.technologyKey ? ` · technology ${p.technologyKey}` : ''}\n${p.cards} card đã đăng.\nSelector platform-scope áp cho nền tảng này; technology-scope dùng chung mọi forum cùng technology.`} style={{ cursor: 'help' }}>
                    <span>{p.key}<br /><span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>{p.cards}c</span></span>
                  </Tip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cov.metrics.map((m) => (
              <tr key={m.metric}>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--bg-1)', borderRight: '1px solid var(--line)' }}>
                  <Tip text={`${m.hint}\n\nFeeds Card.${m.insightsCol}`} style={{ cursor: 'help' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-0)', whiteSpace: 'nowrap' }}>{m.label}</span>
                  </Tip>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--fg-4)' }}>{m.insightsCol}</div>
                </td>
                {cov.platforms.map((p) => {
                  const c = cellOf(m.metric, p.key);
                  if (!c) return <td key={p.key} style={{ textAlign: 'center', borderBottom: '1px solid var(--bg-1)' }}>·</td>;
                  // state → color + glyph. Thứ tự: trained > api(có số) > gap(applicable) > na(ko hỗ trợ) > none(0 card).
                  const state = c.trained ? 'trained' : c.apiFed ? 'api' : c.gap ? 'gap' : c.notApplicable ? 'na' : 'none';
                  const color = state === 'trained' ? 'var(--ok)' : state === 'gap' ? 'var(--bad)' : state === 'api' ? '#3fb6c4' : 'var(--fg-4)';
                  const glyph = state === 'trained' ? '✓' : state === 'gap' ? '⚠' : state === 'api' ? '◆' : '–';
                  const tip = state === 'trained'
                    ? `✓ Đã train · scope ${c.scope} ${c.scopeKey}\nvia=${c.via || 'text'} · nguồn ${SOURCE_VI[c.source || ''] || c.source}\n${c.populated}/${c.cards} card có số\n→ Bấm xem selector detail.`
                    : state === 'gap'
                    ? `⚠ GAP: ${c.cards} card đã đăng, KHÔNG selector → ${m.metric} không bắt được.\n→ Bấm xem hướng dẫn train.`
                    : state === 'api'
                    ? `◆ ${c.populated} card có ${m.metric} nhưng KHÔNG do selector DOM — đến từ commentstats API. Muốn bắt từ DOM thì vẫn train selector.\n→ Bấm xem hướng dẫn.`
                    : state === 'na'
                    ? `– N/A: ${p.key} không phơi bày ${m.metric} cho loại nội dung này (card = comment/reply). Không phải gap — đừng train.`
                    : `– Chưa cần: 0 card đã đăng trên ${p.key}.`;
                  const clickable = state !== 'none' && state !== 'na';
                  return (
                    <td key={p.key} style={{ textAlign: 'center', borderBottom: '1px solid var(--bg-1)', background: state === 'gap' ? 'color-mix(in srgb, var(--bad) 12%, transparent)' : state === 'trained' ? 'color-mix(in srgb, var(--ok) 9%, transparent)' : 'transparent' }}>
                      <Tip text={tip} style={{ cursor: clickable ? 'pointer' : 'default' }}>
                        <button
                          disabled={!clickable}
                          onClick={() => {
                            if (state === 'trained' && c.selId) openSub({ title: c.field, sub: `${c.scope} · ${c.scopeKey} · @ post-metrics`, body: <SelectorDetail id={c.selId} />, route: { t: 'sel', id: c.selId } });
                            else if (state === 'gap' || state === 'api') openSub({ title: `Train ${m.metric} · ${p.key}`, sub: 'hướng dẫn bắt số từ DOM', body: <MetricTrainGuide metric={m.metric} platform={p.key} via={c.via || 'text'} />, route: { t: 'metric', metric: m.metric, platform: p.key, via: c.via || 'text' } });
                          }}
                          style={{ background: 'none', border: 0, padding: '4px 6px', cursor: clickable ? 'pointer' : 'default', color, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <span>{glyph}</span>
                          {c.via && state === 'trained' && <span style={{ fontSize: 7.5, color: 'var(--fg-3)', fontWeight: 400 }}>{c.via}</span>}
                        </button>
                      </Tip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 8, lineHeight: 1.6 }}>
        <span style={{ color: 'var(--ok)' }}>✓ trained</span> = có selector DOM · <span style={{ color: 'var(--bad)' }}>⚠ gap</span> = có card mà chưa selector (cần train) · <span style={{ color: '#3fb6c4' }}>◆ API</span> = số từ commentstats API (không DOM) · <span style={{ color: 'var(--fg-4)' }}>–</span> = N/A (nền tảng không phơi bày metric cho comment/reply) hoặc chưa có card.<br />
        <b>Thêm platform mới</b> (cùng element số): train field <code style={{ fontFamily: 'var(--font-mono)' }}>metric.*</code> ở scope <b>platform</b> hoặc <b>technology</b> → cascade tự áp mọi habitat. <b>Thêm metric mới</b>: 1 dòng vào <code style={{ fontFamily: 'var(--font-mono)' }}>metric-field-schema.ts</code> → tự hiện ở đây + ext.
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

// Nodes đã có panel liệt kê item riêng (UI chuyên biệt) → KHÔNG hiện InstanceBrowser
// generic để khỏi trùng. Các node còn lại (account/people/habitat/brief/card/…) dùng browser.
// identity ĐÃ chuyển sang InstanceBrowser chung (full list + paginate + filter + search) — click row
// mở IdentityDetail editable. Chỉ còn dom/uxflow/selector giữ panel chuyên biệt.
const HAS_OWN_LIST = new Set(['domSample', 'uxFlow', 'selector', 'teamUser']);

// relative "x ago" for time columns (hover = full timestamp via the cell title).
function relAgo(v: unknown): string {
  if (v == null || v === '') return '—';
  const t = new Date(v as string | number | Date).getTime();
  if (isNaN(t)) return String(v);
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 7) return `${d}d ago`;
  if (d < 31) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
// full timestamp for the hover title (YYYY-MM-DD HH:mm).
function fmtFull(v: unknown): string {
  const t = new Date(v as string | number | Date).getTime();
  if (isNaN(t)) return String(v ?? '');
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}
// status/phase/kind → semantic color for a badge cell.
function badgeColor(v: string): string {
  const s = v.toLowerCase();
  if (['active', 'warming', 'live', 'posted', 'published', 'joined', 'approved', 'done', 'replied', 'verified'].includes(s)) return 'var(--ok)';
  if (['blocked', 'banned', 'rejected', 'failed', 'error', 'dead', 'left'].includes(s)) return 'var(--bad)';
  if (['limited', 'pending', 'hold', 'draft', 'todo', 'creating', 'queued', 'review'].includes(s)) return 'var(--warn)';
  return 'var(--fg-2)';
}
const ACCOUNT_STATUS_C = ['todo', 'creating', 'warming', 'active', 'limited', 'blocked', 'banned'];
const PENDING_C = new Set(['creating', 'todo', 'warming']);   // pending = chưa active → stale-check áp dụng
const STALE_DAYS = 7;
// Đồng bộ MỌI surface đang mở (table + các drawer cùng record) khi 1 chỗ sửa status/note.
// `from` = id component phát → bỏ qua chính nó (đã optimistic update, tránh double-apply note).
const INST_EVT = 'mos2-inst-updated';
function emitInstUpdate(objKey: string, id: string, patch: { status?: string; noteAppend?: string }, from: string) {
  try { window.dispatchEvent(new CustomEvent(INST_EVT, { detail: { objKey, id: String(id), patch, from } })); } catch { /* noop */ }
}

// project cell: 1st project = link; the "+N" opens a popover listing EVERY project,
// each clickable → mở drawer của project đó (mọi ref mở được phải mở ngay).
function ProjectCell({ ids, projMap, onOpen }: { ids: string[]; projMap: Map<string, string>; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const names = ids.map((id) => projMap.get(id) || id);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('scroll', close, true); };
  }, [open]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: r.left, y: r.bottom + 4 });
    setOpen((o) => !o);
  };
  return (
    <span title={names.join(', ')} style={{ display: 'inline-flex', gap: 4, minWidth: 0, alignItems: 'center' }}>
      <span role="link" onClick={(e) => { e.stopPropagation(); onOpen(String(ids[0])); }}
        style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline dotted', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[0]}</span>
      {ids.length > 1 && (
        <span role="button" onClick={toggle} title="Xem tất cả project"
          style={{ color: 'var(--fg-2)', cursor: 'pointer', flexShrink: 0, borderBottom: '1px dashed var(--fg-3)' }}>+{ids.length - 1}</span>
      )}
      {open && pos && createPortal(
        <div onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 300, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,.55)', minWidth: 140, maxHeight: 260, overflowY: 'auto', padding: 4 }}>
          {ids.map((id) => (
            <button key={id} onClick={(e) => { e.stopPropagation(); setOpen(false); onOpen(id); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 0, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 8px', borderRadius: 4, cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {projMap.get(id) || id}
            </button>
          ))}
        </div>, document.body)}
    </span>
  );
}

// ── live instance browser (node drawer) — danh sách thực tế + filter + phân trang.
// Mỗi row click → mở drawer chi tiết (InstanceDetail) ở lớp cascade kế. ───────────
function InstanceBrowser({ obj, projects, defaultProject, onProjectChange }: {
  obj: ArchObject; projects: { id: string; name: string }[]; defaultProject: string; onProjectChange?: (pid: string) => void;
}) {
  const openSub = useContext(SubCtx);
  const parent = obj.picker?.parent;
  const crossProject = !!obj.picker?.crossProject;
  const projectScoped = !!obj.projectScoped && !crossProject && !parent;
  // Phiên làm việc bền qua F5: search/filter/sort/project nhớ theo TỪNG object (localStorage).
  const sKey = `mos2_arch_sess_${obj.key}`;
  const sess0 = (() => { try { const v = JSON.parse(localStorage.getItem(sKey) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch { return {}; } })();
  const [projectId, setProjectId] = useState(sess0.projectId || defaultProject || projects[0]?.id || '');
  const [parentId, setParentId] = useState(sess0.parentId || '');
  const [parentInstances, setParentInstances] = useState<InstanceRef[]>([]);
  const [q, setQ] = useState(sess0.q || '');
  const [qDeb, setQDeb] = useState(sess0.q ? String(sess0.q).trim() : '');   // seed để fetch đầu dùng luôn query đã lưu
  const [page, setPage] = useState(0);
  const [data, setData] = useState<InstancePage>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const PAGE = 25;
  // Sort server-side (click header: none→desc→asc→none). '__label' = cột label đầu.
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(sess0.sort && sess0.sort.col ? sess0.sort : null);
  const hasMissingCol = (obj.browseCols || []).some((c) => c.col === '__missingSel');
  const [flt, setFlt] = useState<'empty' | 'partial' | 'full' | 'broken' | null>(sess0.flt || null);
  // Lưu phiên mỗi khi 1 trục thay đổi (page bỏ qua — reset effect dưới luôn về 0 khi mount).
  useEffect(() => { try { localStorage.setItem(sKey, JSON.stringify({ q, sort, flt, projectId, parentId })); } catch {} }, [sKey, q, sort, flt, projectId, parentId]);
  const toggleSort = (col: string) => setSort((s) => (s && s.col === col ? (s.dir === 'desc' ? { col, dir: 'asc' } : null) : { col, dir: 'desc' }));
  // Column GROUPS (Info/Posting/Selectors/DOM) — colored bands + show/hide như SEO overview.
  const bc = obj.browseCols || [];
  const groupsPresent = [...new Set(bc.map((c) => c.group).filter(Boolean))] as BrowseGroup[];
  const gKey = `mos2_arch_grp_${obj.key}`;
  const [groupsOff, setGroupsOff] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(gKey) || '[]') as string[]); } catch { return new Set(); } });
  const toggleGroup = (g: string) => setGroupsOff((prev) => { const n = new Set(prev); if (n.has(g)) n.delete(g); else n.add(g); try { localStorage.setItem(gKey, JSON.stringify([...n])); } catch {} return n; });
  // visible data columns = browseCols minus hidden groups (no-group cols always show).
  const dataCols: { key: string; label: string; kind?: 'time' | 'badge' | 'link' | 'project' | 'unread' | 'dom'; link?: string; group?: BrowseGroup }[] =
    bc.length ? bc.filter((c) => !c.group || !groupsOff.has(c.group)).map((c) => ({ key: c.col, label: c.label, kind: c.kind, link: c.link, group: c.group }))
      : [{ key: '__sub', label: parent ? (OBJ_BY_KEY[parent.object]?.label || parent.object).toLowerCase() : 'ctx' }];
  const colSig = dataCols.map((c) => c.key).join('|');   // đổi tập cột (toggle group) → nạp lại widths
  // Resize cột — DEFAULT thu gọn SÁT NỘI DUNG: px nhỏ theo loại cột ngắn; cột TEXT DÀI = null →
  // minmax(150px,1fr) tự do (fill remaining). widths[i]: number=px(user resize) | null=token co giãn.
  // Thứ tự [label, ...dataCols, pk]. Nhớ localStorage/node.
  const wKey = `mos2_arch_colw_${obj.key}`;   // v3: width MAP {colKey: px} — bền qua toggle group / thêm cột (lưu theo TỪNG CỘT)
  const WIDE = /\b(name|title|description|desc|approach|reason|url|body|summary|message|note|bio|content|prompt)\b/i;
  const pkCol = obj.pk || 'id';
  // grid order = [__label, ...dataCols, pk] → col-key cho từng vị trí resize (để persist theo key, ko theo index).
  const colKeyAt = (i: number): string => (i === 0 ? '__label' : i === dataCols.length + 1 ? pkCol : (dataCols[i - 1]?.key ?? `c${i}`));
  const loadWMap = (): Record<string, number> => { try { const m = JSON.parse(localStorage.getItem(wKey) || '{}'); return (m && typeof m === 'object') ? m : {}; } catch { return {}; } };
  const computeWidths = (): (number | null)[] => {
    const wmap = loadWMap();
    const def = (key: string, kind?: string): number | null => {
      if (key === '__board' || key === '__missingSel' || (!kind && WIDE.test(key))) return null;        // text dài → tự do (1fr)
      if (kind === 'time') return 86; if (kind === 'project') return 104; if (kind === 'link') return 96;
      if (kind === 'badge' || kind === 'unread') return 78; if (kind === 'dom') return 60;
      return 76;                                                              // compact
    };
    return [wmap['__label'] ?? (WIDE.test(obj.labelCol || '') ? null : 110),
      ...dataCols.map((c) => wmap[c.key] ?? def(c.key, c.kind)),
      wmap[pkCol] ?? 52];
  };
  const [widths, setWidths] = useState<(number | null)[]>(computeWidths);
  useEffect(() => { setWidths(computeWidths()); }, [obj.key, colSig]);   // eslint-disable-line react-hooks/exhaustive-deps
  const startResize = (i: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const cell = (e.currentTarget as HTMLElement).parentElement;
    const startX = e.clientX; const startW = cell ? cell.offsetWidth : (widths[i] ?? 100);
    const onMove = (ev: MouseEvent) => { const ww = Math.max(44, startW + (ev.clientX - startX)); setWidths((prev) => { const n = prev.slice(); n[i] = ww; return n; }); };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      setWidths((prev) => { const w = prev[i]; if (typeof w === 'number') { try { const m = loadWMap(); m[colKeyAt(i)] = w; localStorage.setItem(wKey, JSON.stringify(m)); } catch {} } return prev; }); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  useEffect(() => { let dead = false; if (!parent) { setParentInstances([]); return; } listInstances(parent.object).then((r) => { if (!dead) setParentInstances(r); }); return () => { dead = true; }; }, [parent?.object]);
  useEffect(() => { const h = setTimeout(() => { setQDeb(q.trim()); setPage(0); }, 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setPage(0); }, [projectId, parentId, sort, flt]);
  // 1 drawer sửa status → patch row tương ứng trong bảng NGAY (badge + stale recompute) — ko refetch.
  useEffect(() => {
    const h = (e: Event) => {
      const det = (e as CustomEvent).detail as { objKey: string; id: string; patch: { status?: string } };
      if (!det || det.objKey !== obj.key || det.patch.status == null) return;
      setData((prev) => ({ ...prev, rows: prev.rows.map((r) => String(r.id) === det.id ? { ...r, sub: det.patch.status, cols: { ...r.cols, status: det.patch.status } } : r) }));
    };
    window.addEventListener(INST_EVT, h);
    return () => window.removeEventListener(INST_EVT, h);
  }, [obj.key]);
  useEffect(() => {
    let dead = false;
    setLoading(true);
    browseInstances(obj.key, {
      projectId: projectScoped ? projectId : undefined,
      parentId: parent && parentId ? parentId : undefined,   // parentId rỗng = TẤT CẢ (ko gate)
      q: qDeb, limit: PAGE, offset: page * PAGE,
      cols: (obj.browseCols || []).map((c) => c.col),
      sort: sort || undefined,
      flt: flt || undefined,
    }).then((r) => { if (!dead) setData(r); }).finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
  }, [obj.key, projectScoped, projectId, parent?.object, parentId, qDeb, page, sort, flt]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const from = data.total === 0 ? 0 : page * PAGE + 1;
  const to = Math.min(data.total, (page + 1) * PAGE);
  const parentLabel = parent ? (OBJ_BY_KEY[parent.object]?.label || parent.object) : '';
  const projMap = new Map(projects.map((p) => [p.id, p.name]));   // id → name cho cột project
  const grid = widths.map((w) => (w == null ? 'minmax(150px,1fr)' : `${w}px`)).join(' ');   // null=text tự do(1fr); số=px(compact/resize)
  const cellVal = (it: BrowseRow, key: string) => (key === '__sub' ? it.sub : it.cols[key]);
  const open = (it: InstanceRef) => {
    // identity: mở drawer EDITABLE (IdentityDetail) thay vì InstanceDetail read-only chung.
    if (obj.key === 'identity') {
      openSub({ title: it.label || `identity #${it.id}`, sub: 'persona · view + edit', body: <IdentityDetail id={Number(it.id)} />, route: { t: 'identity', id: Number(it.id) } });
      return;
    }
    openSub({
      title: it.label || `#${it.id}`, sub: `${obj.label} · #${it.id}`,
      body: <InstanceDetail objKey={obj.key} id={it.id} />, route: { t: 'inst', objKey: obj.key, id: it.id, label: it.label },
    });
  };
  const openLinked = (e: React.MouseEvent, objKey: string, id: string) => {
    e.stopPropagation();   // ko trigger row click (mở account); chỉ mở drawer của entity được link
    openSub({ title: id, sub: OBJ_BY_KEY[objKey]?.label || objKey, body: <InstanceDetail objKey={objKey} id={id} />, route: { t: 'inst', objKey, id, label: id } });
  };
  const openProj = (pid: string) => openSub({ title: projMap.get(pid) || pid, sub: OBJ_BY_KEY['project']?.label || 'Project', body: <InstanceDetail objKey="project" id={pid} />, route: { t: 'inst', objKey: 'project', id: pid, label: projMap.get(pid) || pid } });
  // click cột DOM (✉/Σ) → drawer list sample của platform đó (KHÔNG mở row detail).
  const openDomList = (e: React.MouseEvent, it: BrowseRow) => {
    e.stopPropagation();
    openSub({ title: `DOM · ${it.label}`, sub: `${it.cols['__domTotal'] ?? 0} sample · ${it.cols['__domNew'] ?? 0} chưa đọc`, body: <DomSampleList platformKey={it.id} label={it.label} />, route: { t: 'domlist', pk: it.id, label: it.label } });
  };

  return (
    <Section title={obj.label} sub="// live · filter · phân trang · click row mở chi tiết">
      {/* filters: project + parent (optional, ko bắt buộc chọn) + search */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {projectScoped && (
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); onProjectChange?.(e.target.value); }} style={selStyle}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {parent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 170 }}>
            <SearchSelect value={parentId} options={parentInstances}
              placeholder={`lọc ${parentLabel} (tất cả)`}
              onChange={setParentId} />
            {parentId && (
              <button type="button" title="Bỏ lọc — xem tất cả" onClick={() => setParentId('')}
                style={{ ...btnStyle, padding: '5px 8px', flexShrink: 0 }}>×</button>
            )}
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`tìm trong ${data.total || '…'}…`}
          style={{ ...selStyle, flex: 1, minWidth: 150 }} />
        {hasMissingCol && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} title="Lọc theo health selector">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>health</span>
            {([
              ['empty', '○ Trống', '#8a92a3', 'Chưa train field CORE nào (chưa có selector)'],
              ['partial', '◑ Hở', '#ffb03c', 'Đã train ≥1 nhưng VẪN thiếu CORE — đang dùng mà hở'],
              ['full', '✓ Đủ', '#22c55e', 'Đủ toàn bộ CORE selector'],
              ['broken', '⚠ Hỏng', '#ef4444', 'Có selector HỎNG (miss_streak≥3 — ext báo lỗi từ trang thật)'],
            ] as const).map(([k, lbl, c, tip]) => {
              const on = flt === k;
              return (
                <button key={k} type="button" title={tip} onClick={() => setFlt((f) => (f === k ? null : k))}
                  style={{ padding: '3px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10.5, whiteSpace: 'nowrap',
                    background: on ? c : 'transparent', border: `1px solid ${on ? c : 'var(--line)'}`, color: on ? '#0b0f17' : c, fontWeight: on ? 700 : 500 }}>{lbl}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* count + range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 6 }}>
        <span><b style={{ color: 'var(--fg-1)' }}>{data.total}</b> {obj.label.toLowerCase()}{qDeb ? ` khớp “${qDeb}”` : ''}{parentId ? ` · ${parentLabel}` : ''}</span>
        {loading && <span style={{ color: 'var(--fg-4)' }}>· loading…</span>}
        {data.total > 0 && <span style={{ marginLeft: 'auto' }}>{from}–{to} / {data.total}</span>}
      </div>

      {/* column-group toggles — màu chip khớp band cột bên dưới (như SEO overview) */}
      {groupsPresent.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 10.5, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>nhóm:</span>
          {groupsPresent.map((g) => {
            const meta = BROWSE_GROUPS[g]; const on = !groupsOff.has(g);
            return (
              <button key={g} type="button" onClick={() => toggleGroup(g)}
                title={on ? `Ẩn nhóm ${meta.label}` : `Hiện nhóm ${meta.label}`}
                style={{ padding: '2px 9px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: on ? meta.bg : 'transparent', border: `1px solid ${on ? meta.fg : 'var(--line)'}`, color: on ? meta.fg : 'var(--fg-4)', fontWeight: on ? 700 : 400 }}>
                {on ? '✓ ' : '+ '}{meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* TABLE — header + paginated rows; click row mở drawer chi tiết.
          Cột link (platform…) click riêng → mở drawer entity đó (stopPropagation). */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 3, padding: '5px 10px', background: 'var(--bg-3)', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {[{ label: obj.labelCol || 'name', key: '__label', right: false, group: undefined as BrowseGroup | undefined },
            ...dataCols.map((dc) => ({ label: dc.label, key: dc.key, right: false, group: dc.group })),
            { label: obj.pk || 'id', key: obj.pk || 'id', right: true, group: undefined as BrowseGroup | undefined },
          ].map((hc, i, arr) => {
            const active = sort?.col === hc.key;
            const gm = hc.group ? BROWSE_GROUPS[hc.group] : null;
            return (
              <span key={i} onClick={() => toggleSort(hc.key)} title="Click = sort · kéo mép phải = đổi rộng cột"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', justifyContent: hc.right ? 'flex-end' : 'flex-start',
                  color: active ? 'var(--accent)' : (gm ? gm.fg : undefined), background: gm ? gm.bg : undefined, margin: gm ? '-5px 0' : undefined, padding: gm ? '5px 6px' : undefined, borderRadius: gm ? 3 : undefined }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{hc.label}</span>
                {active && <span style={{ flexShrink: 0 }}>{sort!.dir === 'asc' ? '▲' : '▼'}</span>}
                {i < arr.length - 1 && (
                  <span onMouseDown={(e) => startResize(i, e)} onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 0, right: -4, width: 9, height: '100%', cursor: 'col-resize' }} />
                )}
              </span>
            );
          })}
        </div>
        {data.rows.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--fg-3)', padding: '12px 10px', textAlign: 'center' }}>{loading ? 'loading…' : 'Không có item nào.'}</div>
        ) : data.rows.map((it, i) => {
          // stale: account pending (creating/todo/warming) + created >7d → viền đỏ trái + status đỏ.
          const sv = String(it.cols['status'] ?? it.sub ?? '').toLowerCase();
          const cAt = it.cols['created_at'];
          const ageDays = cAt ? (Date.now() - new Date(cAt as string | number | Date).getTime()) / 86400000 : 0;
          const stale = obj.key === 'account' && PENDING_C.has(sv) && ageDays > STALE_DAYS;
          // viền trái = màu theo status (stale ưu tiên đỏ); status lạ → trong suốt.
          const lbColor = stale ? 'var(--bad)' : badgeColor(sv);
          const lbOn = stale || (!!sv && lbColor !== 'var(--fg-2)');
          return (
          <button key={it.id} onClick={() => open(it)} title={stale ? `⚠ Pending ${Math.floor(ageDays)}d (>${STALE_DAYS}d) — nên chuyển limited` : (sv ? `status: ${sv}` : 'Mở chi tiết item')}
            style={{ display: 'grid', gridTemplateColumns: grid, gap: 3, alignItems: 'center', width: '100%', textAlign: 'left', border: 0, borderTop: i ? '1px solid var(--line)' : 0, borderLeft: lbOn ? `3px solid ${lbColor}` : '3px solid transparent', padding: '6px 10px 6px 7px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 ? 'var(--bg-1)' : 'var(--bg-2)')}>
            <span style={{ fontSize: 12, color: 'var(--fg-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            {dataCols.map((dc, j) => {
              const v = cellVal(it, dc.key);
              const empty = v == null || v === '';
              const domClickable = (dc.key === '__domNew' || dc.key === '__domTotal') && Number(it.cols['__domTotal'] ?? 0) > 0;
              return (
                <span key={j} title={domClickable ? `Mở ${it.cols['__domTotal']} DOM sample của ${it.label}` : (empty ? '' : String(v))}
                  {...(domClickable ? { role: 'button', onClick: (e: React.MouseEvent) => openDomList(e, it) } : {})}
                  style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 10.5, ...(domClickable ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}), ...(dc.group ? { background: BROWSE_GROUPS[dc.group].bgSoft, margin: '-6px 0', padding: '6px 6px', borderRadius: 3 } : {}) }}>
                  {empty ? <span style={{ color: 'var(--fg-4)' }}>—</span>
                    : dc.kind === 'link' && dc.link ? (
                      <span role="link" onClick={(e) => openLinked(e, dc.link!, String(v))}
                        style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline dotted' }}>{String(v)}</span>
                    ) : dc.kind === 'badge' ? (() => {
                      const hot = stale && dc.key === 'status';
                      const sc = hot ? 'var(--bad)' : badgeColor(String(v));
                      return <span style={{ color: sc, border: `1px solid ${sc}`, borderRadius: 4, padding: '0 5px', fontSize: 9.5, fontWeight: hot ? 800 : 400 }}>{String(v)}{hot ? ' ⚠' : ''}</span>;
                    })() : dc.kind === 'unread' ? (() => {
                      const n = Number(v);
                      if (!Number.isFinite(n) || n <= 0) return <span style={{ color: 'var(--fg-4)' }}>{Number.isFinite(n) ? '0' : '—'}</span>;
                      return <span style={{ color: 'var(--warn)', fontWeight: 700 }} title={`✉ ${n} tin nhắn chưa đọc`}>✉ {n}</span>;
                    })() : dc.kind === 'dom' ? (() => {
                      const n = Number(v);
                      if (!Number.isFinite(n)) return <span style={{ color: 'var(--fg-4)' }}>—</span>;
                      if (n <= 0) return <span style={{ color: 'var(--fg-4)' }} title="Không có DOM chưa đọc">0</span>;
                      return <span style={{ color: 'var(--warn)', fontWeight: 700 }} title={`✉ ${n} DOM sample chưa đọc — mở 1 sample để parse selector (mở = đánh dấu đã đọc)`}>✉ {n}</span>;
                    })() : dc.kind === 'time' ? (
                      <span title={fmtFull(v)} style={{ color: 'var(--fg-2)' }}>{relAgo(v)}</span>
                    ) : dc.kind === 'project' ? (() => {
                      const ids = (Array.isArray(v) ? v : [v]).filter((x) => x != null && x !== '').map(String);
                      if (!ids.length) return <span style={{ color: 'var(--fg-4)' }}>—</span>;
                      return <ProjectCell ids={ids} projMap={projMap} onOpen={openProj} />;
                    })() : (
                      <span style={{ color: 'var(--fg-1)' }}>{fmtVal(v)}</span>
                    )}
                </span>
              );
            })}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textAlign: 'right' }}>#{it.id}</span>
          </button>
          );
        })}
      </div>

      {/* pager */}
      {data.total > PAGE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{ ...btnStyle, opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? 'default' : 'pointer' }}>‹ trước</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>{page + 1} / {pages}</span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            style={{ ...btnStyle, opacity: page + 1 >= pages ? 0.4 : 1, cursor: page + 1 >= pages ? 'default' : 'pointer' }}>sau ›</button>
        </div>
      )}
    </Section>
  );
}

// full detail of one real row — opened as a cascade layer from InstanceBrowser.
// Modeled attrs (FK chips + live value) + mọi cột còn lại + consistency check.
// One key→value row in an instance drawer. Long/multiline values truncate to 1 line with "▸ xem";
// click expands to a full wrapped, scrollable, selectable block + copy (fixes drawer field cut-off).
const miniBtn: CSSProperties = { fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-3)', color: 'var(--fg-1)', cursor: 'pointer', flexShrink: 0 };
function FieldRow({ name, nameColor = 'var(--fg-0)', chips, value, link, zebra }: {
  name: string; nameColor?: string; chips?: ReactNode; value: unknown;
  link?: { label: string; onOpen: () => void }; zebra: number;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fmt, setFmt] = useState(true);   // markdown fields default to the rendered view
  const has = value != null && value !== '';
  const full = !has ? '' : (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
  const oneLine = full.replace(/\s+/g, ' ').trim();
  const long = !link && has && (oneLine.length > 56 || full.includes('\n'));
  const isMd = typeof value === 'string' && looksMarkdown(full);
  const bg = zebra % 2 ? 'var(--bg-1)' : 'var(--bg-2)';
  const nameBlock = (
    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: nameColor }}>{name}</span>{chips}
    </div>
  );
  const copy = async () => { try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ } };
  if (long && open) {
    return (
      <div style={{ padding: '6px 10px', background: bg, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {nameBlock}
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)', alignSelf: 'center' }}>{full.length}</span>
            {isMd && <button type="button" onClick={() => setFmt((v) => !v)} style={miniBtn}>{fmt ? '</> raw' : '📄 đẹp'}</button>}
            <button type="button" onClick={copy} style={miniBtn}>{copied ? '✓ copied' : '⧉ copy'}</button>
            <button type="button" onClick={() => setOpen(false)} style={miniBtn}>▾ thu gọn</button>
          </div>
        </div>
        {isMd && fmt ? (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', maxHeight: 380, overflow: 'auto', userSelect: 'text' }}>
            <ReactMarkdown components={MD_COMPONENTS}>{full}</ReactMarkdown>
          </div>
        ) : (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.5, color: 'var(--fg-0)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 8, maxHeight: 360, overflow: 'auto', userSelect: 'text' }}>{full}</pre>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '6px 10px', background: bg, alignItems: 'center' }}>
      {nameBlock}
      {link ? (
        <span role="link" title={`Mở ${link.label}`} onClick={link.onOpen}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline dotted', maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtVal(value)}</span>
      ) : long ? (
        <span onClick={() => setOpen(true)} title="bấm xem đầy đủ"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ok)', cursor: 'pointer', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
          {oneLine.slice(0, 50)}… <span style={{ color: 'var(--accent)' }}>▸ xem</span>
        </span>
      ) : (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: has ? 'var(--ok)' : 'var(--fg-4)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{has ? full : '—'}</span>
      )}
    </div>
  );
}
// Project drawer — editable Seeding-Radar relevance signals (key_messages/seo_keywords/forbidden/
// languages live on content_pillars). Narrow, sanctioned write like the account-status triage:
// edit here → updateContentPillar flips board_project_score.stale → boards re-score with new signals.
function ProjectRelevanceEditor({ projectId }: { projectId: string }) {
  const [pillars, setPillars] = useState<ContentPillarRow[] | null>(null);
  const [tribes, setTribes] = useState<Array<{ id: number; name: string; psychographic: string }> | null>(null);
  useEffect(() => {
    let dead = false;
    listContentPillars(projectId).then((r) => { if (!dead) setPillars(r); }).catch(() => { if (!dead) setPillars([]); });
    listTribesForProject(projectId).then((r) => { if (!dead) setTribes(r.map((t) => ({ id: t.id, name: t.name, psychographic: t.psychographic }))); }).catch(() => { if (!dead) setTribes([]); });
    return () => { dead = true; };
  }, [projectId]);
  return (
    <Section title="Relevance · Seeding Radar" sub="// thông số chấm board (② Project cần gì) — sửa + lưu thẳng DB">
      {pillars == null ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>loading…</div>
        : !pillars.length ? <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Chưa có content pillar → chưa chấm được. <a href={`/p/${projectId}/pillars`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>↗ Tạo pillar</a></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{pillars.map((p) => <PillarRelevanceRow key={p.id} projectId={projectId} pillar={p} />)}</div>}
      {/* WHO (tribes) — cũng tham gia chấm audience-fit. Đọc-only ở đây; sửa ở trang tribes. */}
      <div style={{ marginTop: 10, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
        <div style={{ fontSize: 10.5, color: 'var(--fg-2)', marginBottom: 5 }}>
          Nhóm đối tượng · audience (chấm cùng relevance)
          <a href={`/p/${projectId}/tribes`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', marginLeft: 6 }}>↗ sửa</a>
        </div>
        {tribes == null ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>…</span>
          : !tribes.length ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>chưa có tribe — board chấm theo topic thôi.</span>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{tribes.map((t) => <span key={t.id} title={t.psychographic} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-2)', border: '1px solid #4c3a8a', color: '#c4b5fd' }}>{t.name}</span>)}</div>}
      </div>
    </Section>
  );
}
function PillarRelevanceRow({ projectId, pillar }: { projectId: string; pillar: ContentPillarRow }) {
  const j = (xs?: string[]) => (xs || []).join(', ');
  const [km, setKm] = useState(j(pillar.keyMessages));
  const [kw, setKw] = useState(j(pillar.seoKeywords));
  const [fb, setFb] = useState(j(pillar.forbiddenMsgs));
  const [lg, setLg] = useState(j(pillar.languages));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const fCss: CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-1)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 7px', fontSize: 11.5, fontFamily: 'var(--font-mono)' };
  const lCss: CSSProperties = { fontSize: 10, color: 'var(--fg-3)', marginBottom: 2, display: 'block' };
  const field = (lbl: string, v: string, set: (s: string) => void) => (
    <div><label style={lCss}>{lbl}</label><input value={v} onChange={(e) => set(e.target.value)} style={fCss} /></div>
  );
  const save = async () => {
    setBusy(true); setMsg('');
    const r = await updateContentPillar(projectId, pillar.id, { keyMessages: split(km), seoKeywords: split(kw), forbiddenMsgs: split(fb), languages: split(lg) });
    setBusy(false); setMsg(r.ok ? '✓ đã lưu — board sẽ re-score' : ('✗ ' + (r.error || 'lỗi')));
  };
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 8, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-0)' }}>{pillar.name || `pillar #${pillar.id}`}</div>
      {field('Bán/nói về (key messages · phẩy)', km, setKm)}
      {field('Keywords (· phẩy)', kw, setKw)}
      {field('Tránh (forbidden · phẩy)', fb, setFb)}
      {field('Ngôn ngữ (· phẩy)', lg, setLg)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" disabled={busy} onClick={save} style={{ ...btnStyle, opacity: busy ? 0.5 : 1 }}>✓ Lưu</button>
        {msg && <span style={{ fontSize: 10.5, color: msg.startsWith('✓') ? 'var(--ok)' : 'var(--bad)' }}>{msg}</span>}
      </div>
    </div>
  );
}
function InstanceDetail({ objKey, id }: { objKey: string; id: string }) {
  const obj = OBJ_BY_KEY[objKey];
  const push = useContext(SubCtx);   // FK value click → mở entity được tham chiếu ở lớp kế
  const [d, setD] = useState<{ row: Record<string, unknown>; issues: Issue[] } | null | 'loading'>('loading');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [triBusy, setTriBusy] = useState(false);
  const [triMsg, setTriMsg] = useState('');
  const selfId = useRef(Math.random().toString(36).slice(2));
  const load = useCallback(() => { let dead = false; setD('loading'); getInstance(objKey, id).then((r) => { if (!dead) setD(r ?? null); }); return () => { dead = true; }; }, [objKey, id]);
  useEffect(() => load(), [load]);
  useEffect(() => { if (d && d !== 'loading' && d.row) setStatus(String(d.row.status ?? '')); }, [d]);
  // Drawer KHÁC (cùng record) sửa → đồng bộ d ở đây luôn (bỏ qua event do CHÍNH drawer này phát).
  useEffect(() => {
    const h = (e: Event) => {
      const det = (e as CustomEvent).detail as { objKey: string; id: string; from: string; patch: { status?: string; noteAppend?: string } };
      if (!det || det.objKey !== objKey || det.id !== String(id) || det.from === selfId.current) return;
      setD((p) => (p && p !== 'loading') ? { ...p, row: { ...p.row, ...(det.patch.status != null ? { status: det.patch.status } : {}), ...(det.patch.noteAppend ? { notes: (p.row.notes ? String(p.row.notes) + '\n' : '') + '[studio] ' + det.patch.noteAppend } : {}) } } : p);
    };
    window.addEventListener(INST_EVT, h);
    return () => window.removeEventListener(INST_EVT, h);
  }, [objKey, id]);
  if (!obj) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{objKey}: không có trong spec.</div>;
  if (d === 'loading') return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  if (!d) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Không tìm thấy record #{id}. <button onClick={() => load()} style={{ ...btnStyle, marginLeft: 6, padding: '2px 8px' }}>↻ thử lại</button></div>;
  const worst = d.issues.some((i) => i.level === 'error') ? 'error' : d.issues.some((i) => i.level === 'warn') ? 'warn' : 'ok';
  const mapped = new Set(obj.attrs.map((a) => a.col).filter(Boolean) as string[]);
  const others = Object.keys(d.row).filter((k) => !mapped.has(k));
  const hasNotes = 'notes' in d.row;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* TRIAGE — đổi status + ghi chú nhanh (lưu thẳng DB). Account-only cho status. */}
      {(objKey === 'account' || hasNotes) && (
        <Section title="Triage" sub="// đổi status · ghi chú — lưu thẳng DB">
          {objKey === 'account' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', width: 48 }}>status</span>
              <select value={status} disabled={triBusy} style={{ ...selStyle, flex: 1 }}
                onChange={async (e) => {
                  const ns = e.target.value; setTriBusy(true); setTriMsg('');
                  const r = await updateInstance('account', id, { status: ns });
                  setTriBusy(false);
                  if (r.ok) { setStatus(ns); setD((p) => (p && p !== 'loading') ? { ...p, row: { ...p.row, status: ns } } : p); emitInstUpdate(objKey, id, { status: ns }, selfId.current); setTriMsg('✓ status → ' + ns); }
                  else setTriMsg('✗ ' + (r.error || 'lỗi'));
                }}>
                {ACCOUNT_STATUS_C.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {objKey === 'account' && (() => {
            const stats = (d.row.account_stats as Record<string, unknown> | null) || null;
            const u = stats && typeof stats.unread_messages === 'number' ? stats.unread_messages as number : null;
            if (u == null) return null;   // chưa quét → không hiện dòng
            const at = stats && typeof stats.fetched_at === 'string' ? stats.fetched_at as string : null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', width: 48 }}>inbox</span>
                <span style={{ fontSize: 11.5, fontWeight: u > 0 ? 700 : 400, color: u > 0 ? 'var(--warn)' : 'var(--fg-3)' }}>
                  {u > 0 ? `✉ ${u} tin chưa đọc` : '✓ đã đọc hết'}
                  {at && <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}> · quét {relAgo(at)} trước</span>}
                </span>
              </div>
            );
          })()}
          {hasNotes && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ghi chú nhanh…" style={{ ...selStyle, flex: 1 }} />
              <button type="button" disabled={triBusy || !note.trim()} style={{ ...btnStyle, opacity: (!note.trim() || triBusy) ? 0.5 : 1 }}
                onClick={async () => {
                  const n = note.trim(); if (!n) return; setTriBusy(true); setTriMsg('');
                  const r = await updateInstance(objKey, id, { noteAppend: n });
                  setTriBusy(false);
                  if (r.ok) { setD((p) => (p && p !== 'loading') ? { ...p, row: { ...p.row, notes: (p.row.notes ? String(p.row.notes) + '\n' : '') + '[studio] ' + n } } : p); emitInstUpdate(objKey, id, { noteAppend: n }, selfId.current); setNote(''); setTriMsg('✓ đã ghi chú'); }
                  else setTriMsg('✗ ' + (r.error || 'lỗi'));
                }}>+ note</button>
            </div>
          )}
          {triMsg && <div style={{ fontSize: 10.5, color: triMsg.startsWith('✓') ? 'var(--ok)' : 'var(--bad)', marginTop: 5 }}>{triMsg}</div>}
        </Section>
      )}
      {objKey === 'project' && <ProjectRelevanceEditor projectId={id} />}
      <Section title="Attributes" sub={`// ${obj.table || 'doc-only'}`}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          {obj.attrs.map((a, i) => {
            const val = a.col != null ? d.row[a.col] : null;
            const has = val != null && val !== '';
            const fkObj = a.fk ? OBJ_BY_KEY[a.fk] : null;
            const canOpen = !!(fkObj?.table && has);   // FK trỏ tới node có bảng + có value → mở được
            return (
              <FieldRow key={a.name} zebra={i} value={val} name={a.name}
                chips={<>{a.pk && <span style={chip('var(--accent)')}>PK</span>}{a.fk && <span style={chip('#b48cff')}>→ {a.fk}</span>}</>}
                link={canOpen ? { label: `${fkObj!.label} #${val}`, onOpen: () => push({ title: String(val), sub: `${fkObj!.label} · #${val}`, body: <InstanceDetail objKey={a.fk!} id={String(val)} />, route: { t: 'inst', objKey: a.fk!, id: String(val), label: String(val) } }) } : undefined} />
            );
          })}
        </div>
      </Section>
      {others.length > 0 && (
        <Section title="Other columns" sub={`// ${others.length} ngoài model`}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {others.map((k, i) => (
              <FieldRow key={k} zebra={i} value={d.row[k]} name={k} nameColor="var(--fg-2)" />
            ))}
          </div>
        </Section>
      )}
      <Section title="Consistency check" sub={`// worst: ${worst}`}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' }}>
          {d.issues.map((it, i) => <IssueRow key={i} it={it} />)}
        </div>
      </Section>
      {obj.deepLink && <a href={obj.deepLink} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>↗ manage real {obj.label}</a>}
    </div>
  );
}

function ObjectDrawerBody({ obj, projects, defaultProject, bound, onBind, onProjectChange }: {
  obj: ArchObject; projects: { id: string; name: string }[]; defaultProject: string;
  bound?: Bound; onBind: (b: Bound | null) => void; onProjectChange?: (pid: string) => void;
}) {
  const [projectId, setProjectId] = useState(defaultProject || projects[0]?.id || '');
  const [instances, setInstances] = useState<InstanceRef[]>([]);
  const [picked, setPicked] = useState(bound?.id || '');
  const [detail, setDetail] = useState<{ row: Record<string, unknown>; issues: Issue[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sels, setSels] = useState<SelRow[] | null>(null);
  const [scopesWithSel, setScopesWithSel] = useState<{ key: string; n: number }[]>([]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const openSub = useContext(SubCtx);
  const isScoped = obj.key === 'platform' || obj.key === 'technology' || obj.key === 'habitat';
  const parent = obj.picker?.parent;             // child needs its parent picked first (channel → habitat)
  const crossProject = !!obj.picker?.crossProject; // independent place, list across projects (habitat)
  const [parentId, setParentId] = useState('');
  const [parentInstances, setParentInstances] = useState<InstanceRef[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingRand, setPendingRand] = useState(false);

  // load the selector library for this scope once an instance is picked
  useEffect(() => {
    let dead = false;
    setOpenGroups(new Set()); // đổi scope → thu gọn lại (default collapsed cho dễ nhìn)
    if (!isScoped || !picked) { setSels(null); return; }
    listSelectors(obj.key, picked).then((r) => { if (!dead) setSels(r); });
    return () => { dead = true; };
  }, [obj.key, isScoped, picked]);

  // which instances of THIS scope actually have selectors (đa số platform trống —
  // DEV.to=0, chỉ reddit/twitter/HN… có) → hiện chip quick-jump để khỏi bind mò.
  useEffect(() => {
    let dead = false;
    if (!isScoped) { setScopesWithSel([]); return; }
    selectorCatalog().then((rows) => {
      if (dead) return;
      const m = new Map<string, number>();
      for (const r of rows) if (r.scopeKind === obj.key) m.set(r.scopeKey, (m.get(r.scopeKey) ?? 0) + 1);
      setScopesWithSel([...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n));
    });
    return () => { dead = true; };
  }, [isScoped, obj.key]);

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

  // a pre-bound instance can live in another project (e.g. opened from the Live feed) —
  // align the project picker to it ONCE so the picker shows the right project + selection.
  const projSynced = useRef(false);
  useEffect(() => {
    if (projSynced.current || !obj.projectScoped || crossProject || parent || !detail) return;
    const pid = detail.row['project_id'];
    projSynced.current = true;
    if (typeof pid === 'string' && pid && pid !== projectId) setProjectId(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

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

      {/* Crew ext coverage — nhúng vào drawer Platform (social) + Technology (tech): platform/tech nào support tầng nào */}
      {(obj.key === 'platform' || obj.key === 'technology') && (
        <Section title="Crew ext · Coverage" sub="// auto-derive từ cfg ext (gen-capabilities.mjs)">
          <CoverageMatrix kind={obj.key === 'technology' ? 'tech' : 'social'} />
        </Section>
      )}

      {obj.key === 'card' && (
        <Section title="Giá trị & Độ bền · Pha A" sub="// value × độ bền · nhân đôi winner, bỏ dead (#4)">
          <ContentValueInline projects={projects} />
        </Section>
      )}

      {obj.key === 'habitat' && (
        <Section title="Cadence · Pha B" sub="// đến hạn → đăng nơi bền · bỏ nơi yếu (#3)">
          <ContentCadenceInline projects={projects} />
        </Section>
      )}

      {obj.key === 'pillar' && (
        <Section title="Coverage · biết thiếu để thêm" sub="// pillar/project · + tay · ✨ AI gợi ý">
          <PillarCoverageInline />
        </Section>
      )}

      {obj.key === 'account' && (
        <Section title="Setup · Browser & Proxy" sub="// gán profile + IP riêng cho từng account">
          <AccountInfraInline />
        </Section>
      )}

      {obj.key === 'teamUser' && (
        <Section title="Quản lý team · Assign" sub="// nhân sự × project × account · thêm/giao việc">
          <TeamInline />
        </Section>
      )}

      {/* LIVE ITEMS — danh sách thực tế mọi item của node này lên ĐẦU: filter + select
          full option + phân trang (account/people… có thể rất nhiều) → click mở drawer
          chi tiết. Bỏ qua node đã có panel-list riêng (identity/dom/uxflow/selector). */}
      {obj.table && !HAS_OWN_LIST.has(obj.key) && (
        <InstanceBrowser obj={obj} projects={projects} defaultProject={projectId} onProjectChange={(pid) => { setProjectId(pid); onProjectChange?.(pid); }} />
      )}

      {/* full selector catalog — every scope × page_kind × field, with counts (gọn overview) */}
      {obj.key === 'selector' && (
        <Section title="Selector catalog" sub="// scope → page_kind → fields">
          <SelectorCatalog />
        </Section>
      )}

      {/* metric tracking coverage — CHỖ QUẢN LÝ việc bắt số engagement từ DOM (views/score/…) */}
      {obj.key === 'card' && (
        <Section title="Metric tracking" sub="// metric × platform · ⚠ gap = chưa bắt được">
          <MetricCoveragePanel />
        </Section>
      )}

      {/* template adoption — 1 technology template → N forums seed-ready */}
      {obj.key === 'technology' && (
        <Section title="Template Adoption" sub="// bind platform → inherit selector pack · scale lever">
          <TemplateAdoptionPanel />
        </Section>
      )}

      {/* DOM sample library — node riêng, gắn platform/technology cụ thể */}
      {obj.key === 'domSample' && (
        <Section title="DOM Samples" sub="// ext 💾 capture · gom theo site · tìm & xoá">
          <DomSamplesPanel />
        </Section>
      )}

      {/* UX flows — chuỗi nhu cầu→hành động (sơ đồ khối), data-driven, scale */}
      {obj.key === 'uxFlow' && (
        <Section title="UX Flows" sub="// need→action · click step mở drawer entity · drive thiết kế ext">
          <UxFlowsPanel />
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
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); onProjectChange?.(e.target.value); setDetail(null); setPicked(''); }} style={selStyle}>
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

      {/* selector library for this scope (per platform/technology/habitat × entity) */}
      {isScoped && (
        <Section title="Selectors (this scope)" sub={`// scope_kind='${obj.key}'`}>
          {scopesWithSel.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 4 }}>
                {scopesWithSel.length} {obj.label.toLowerCase()} có selector — bấm để mở (đa số {obj.label.toLowerCase()} khác trống):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {scopesWithSel.map((s) => {
                  const on = s.key === picked;
                  return (
                    <button key={s.key} type="button" onClick={() => inspect(s.key)}
                      title={`Bind ${s.key} + xem ${s.n} selector`}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: on ? 'var(--bg-0)' : 'var(--accent)', background: on ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>
                      {s.key} <span style={{ opacity: 0.7 }}>{s.n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!picked ? (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Bấm 1 chip ở trên, hoặc bind 1 {obj.label} ở mục trên để xem selector của nó.</div>
          ) : sels == null ? (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>
          ) : sels.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>No selectors trained at this scope yet. Train on-page via the Crew picker (🎯) or fall back to the cascade (habitat → platform → technology).</div>
          ) : (() => {
            // group by page_kind — mỗi context (composer / subreddit-about / platform-any …)
            // là nơi CÙNG concept (user/author/viewer) nằm khác nhau. Mỗi nhóm collapse được.
            const groups: { pk: string; rows: typeof sels }[] = [];
            for (const s of sels) {
              const g = groups[groups.length - 1];
              if (g && g.pk === s.pageKind) g.rows.push(s);
              else groups.push({ pk: s.pageKind, rows: [s] });
            }
            const pkColor = (pk: string) => pk === 'signup' ? 'var(--neon-amber)' : pk === 'composer' ? 'var(--neon-cyan)'
              : pk.startsWith('subreddit') ? 'var(--neon-violet)' : pk === 'post-metrics' ? '#3fb6c4'
              : pk === 'account-profile' ? '#22c55e' : pk === 'platform-any' ? '#b48cff' : 'var(--fg-2)';
            const allOpen = groups.length > 0 && groups.every((g) => openGroups.has(g.pk));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--fg-3)' }}>
                  <span>{groups.length} nhóm · {sels.length} selector</span>
                  <button type="button" onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map((g) => g.pk)))}
                    style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-2)', fontSize: 10.5, padding: '2px 8px', cursor: 'pointer' }}>
                    {allOpen ? '⊟ thu hết' : '⊞ mở hết'}
                  </button>
                </div>
                {groups.map((g) => {
                  const open = openGroups.has(g.pk);
                  const col = pkColor(g.pk);
                  return (
                    <div key={g.pk} style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${col}`, borderRadius: 6, overflow: 'hidden' }}>
                      <button type="button"
                        onClick={() => setOpenGroups((prev) => { const n = new Set(prev); if (n.has(g.pk)) n.delete(g.pk); else n.add(g.pk); return n; })}
                        title={PAGE_KIND_VI[g.pk] || `page_kind "${g.pk}"`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 10px', background: 'var(--bg-3)', border: 0, cursor: 'pointer' }}>
                        <span style={{ fontSize: 9, color: 'var(--fg-3)', width: 8, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: col, fontWeight: 700 }}>{g.pk}</span>
                        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-1)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: '0 7px', flexShrink: 0 }}>{g.rows.length}</span>
                      </button>
                      {open && g.rows.map((s, i) => (
                        <button key={s.fieldName} type="button"
                          onClick={() => openSub({ title: s.fieldName, sub: `${obj.key} · ${picked} · @ ${s.pageKind}`, body: <SelectorDetail id={s.id} />, route: { t: 'sel', id: s.id } })}
                          title="Mở chi tiết selector (spec, cascade, raw jsonb)"
                          style={{ display: 'block', width: '100%', textAlign: 'left', borderWidth: '1px 0 0 0', borderStyle: 'solid', borderColor: 'var(--line)', cursor: 'pointer', padding: '6px 10px 6px 26px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 ? 'var(--bg-1)' : 'var(--bg-2)')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{s.fieldName}</span>
                            <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>›</span>
                            <span style={{ ...chip(s.source === 'manual' ? 'var(--ok)' : s.source === 'promoted' ? 'var(--accent)' : 'var(--fg-3)'), marginLeft: 'auto' }}>{s.source}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', marginTop: 2, wordBreak: 'break-all' }}>{s.css}{s.attr ? ` [${s.attr}]` : ''}</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 8, lineHeight: 1.5 }}>
            The Crew extension resolves these at runtime via <code>MOS2.sel</code> (priority: DB → a.sel → platform → technology → generic) and lets you pick/edit them on the page. Manage at <a href="/technologies" style={{ color: 'var(--accent)' }}>/technologies</a> · <a href="/platforms" style={{ color: 'var(--accent)' }}>/platforms</a>.
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

// Mock TRỰC QUAN từng element ext (tái dựng theo đúng style thật trong ext) — để Architect
// hiện HÌNH DÁNG, không chỉ liệt kê. Style copy từ ext source (màu/viền/bo góc).
function SurfacePreview({ k }: { k: string }) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,monospace';
  const sys = '-apple-system,system-ui,sans-serif';
  switch (k) {
    case 'scene-marker':
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: '#fbbf241a', border: '1px solid #fbbf2440', color: '#fbbf24', font: `700 11px ${mono}` }}>◎ 90 · warm</span>;
    case 'scene-popover':
      return <div style={{ width: 184, background: '#11161c', border: '1px solid #fbbf24', borderRadius: 8, padding: '9px 11px', color: '#e5e9f0', font: `12px/1.5 ${sys}` }}><div style={{ fontWeight: 800, marginBottom: 4 }}>◎ @automoderator</div><div>Familiarity: <b style={{ color: '#fbbf24' }}>90/100</b> · warm</div><div>Interactions: <b>0</b></div><div style={{ marginTop: 6, color: '#60a5fa' }}>↗ Xem trên MOS2</div></div>;
    case 'scene-out':
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: '#7a869915', border: '1px solid #2a323c', color: '#7a8699', font: `700 10px ${mono}` }}>◎ +scene</span>;
    case 'board-badge':
      return <span style={{ padding: '2px 9px', borderRadius: 999, background: '#3a2c08', color: '#fbbf24', border: '1px solid #fbbf2440', font: `700 11px ${mono}` }}>◆ TRACK</span>;
    case 'board-popover':
      return <div style={{ width: 200, background: '#0d0d0d', border: '1px solid #262626', borderRadius: 9, padding: '9px 10px', color: '#e5e5e5', font: `12px ${sys}` }}><div style={{ fontWeight: 700, marginBottom: 3 }}><span style={{ color: '#fbbf24' }}>⚑ chưa đánh giá</span> <span style={{ color: '#9ca3af', fontWeight: 400 }}>Recording…</span></div><div style={{ color: '#9ca3af', fontSize: 11 }}>fit 72/100 · 1.2k members</div><div style={{ display: 'flex', gap: 6, marginTop: 8 }}><span style={{ background: '#3a2c08', color: '#fbbf24', borderRadius: 5, padding: '3px 9px', fontSize: 11 }}>★ Track</span><span style={{ background: '#1f2937', color: '#cbd5e1', borderRadius: 5, padding: '3px 9px', fontSize: 11 }}>↻ Re-score</span></div></div>;
    case 'seed-pill':
      // Demo trên nền SÁNG (forum) để thấy chip đặc tự chứa vẫn đọc rõ. 1 pill ngang dùng chung X/Reddit/forum.
      return <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', background: '#e8eef5', padding: 7, borderRadius: 8 }}><span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 9px', borderRadius: 10, background: '#16a34a', color: '#fff', border: '1px solid #15803d', boxShadow: '0 1px 3px rgba(0,0,0,.35)', font: `700 11px ${sys}`, whiteSpace: 'nowrap' }}>✅ #1180 · warm-up · ❤ 0 💬 2</span><span style={{ height: 20, display: 'inline-flex', alignItems: 'center', padding: '0 5px', borderRadius: 8, background: '#1c2128', color: '#ddd', border: '1px solid #30363d', font: `600 10px ${sys}` }}>live ⌄</span></span>;
    case 'profile-pill':
      return <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 13 }}><span style={{ background: '#1f2430', border: '1px solid #30363d', borderRadius: 6, padding: '2px 6px' }}>🤖</span><span style={{ color: '#22c55e' }}>●</span><span>🎯</span><span>🖼</span></span>;
    case 'feed-engaged':
      return <span style={{ background: '#16351f', color: '#22c55e', border: '1px solid #22c55e55', borderRadius: 5, padding: '1px 7px', font: `700 10px ${mono}` }}>✓ engaged</span>;
    case 'hl-box':
      return <div style={{ position: 'relative', width: 130, height: 32, border: '1px solid #22d3ee99', background: '#22d3ee10', borderRadius: 3, marginTop: 14 }}><span style={{ position: 'absolute', top: -15, left: -1, background: '#22d3ee', color: '#08151a', font: `700 9px ${mono}`, padding: '1px 6px', borderRadius: '3px 3px 0 0' }}>user.handle</span></div>;
    case 'hl-label':
      return <span style={{ background: '#22d3ee', color: '#08151a', font: `700 10px ${mono}`, padding: '2px 7px', borderRadius: 3 }}>username ⚙phpbb: gsmarter17</span>;
    case 'hl-label-menu':
      return <div style={{ width: 130, background: '#12151c', border: '1px solid #2d2640', borderRadius: 8, padding: 5, color: '#e6edf3', font: `11px ${sys}` }}>{['↻ Retrain', '✕ Clear', '⧉ Copy CSS'].map((t) => <div key={t} style={{ padding: '3px 6px' }}>{t}</div>)}</div>;
    case 'train-banner':
      return <div style={{ background: 'linear-gradient(90deg,#7c3aed,#db2777)', color: '#fff', font: `700 10px ${sys}`, padding: '5px 11px', borderRadius: 5 }}>🎯 TRAIN MODE — hover element rồi click</div>;
    case 'train-picker':
      return <div style={{ width: 150, background: '#0a0a0a', border: '1px solid #3b82f6', borderRadius: 8, padding: 8, color: '#e5e5e5', font: `11px ${sys}` }}><div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: 4 }}>Chọn field</div>{['👁 metric', 'profile', 'viewer'].map((t) => <div key={t} style={{ padding: '2px 5px' }}>{t}</div>)}</div>;
    case 'manual-input':
      return <div style={{ width: 170, background: '#0a0a0a', border: '1px solid #fbbf24', borderRadius: 8, padding: 8, color: '#e5e5e5', font: `11px ${sys}` }}><div style={{ color: '#fbbf24', font: `700 10px ${sys}`, textTransform: 'uppercase', marginBottom: 5 }}>✍️ Manual · username</div><div style={{ background: '#0d1117', border: '1px solid #2d3741', borderRadius: 5, padding: '4px 7px', font: `10px ${mono}`, color: '#8b949e' }}>{"input[name='name']"}</div></div>;
    case 'fab':
      return <div style={{ display: 'inline-flex', gap: 5, background: '#161616', borderRadius: 10, padding: 4 }}>{['🔍', '🎯'].map((t) => <span key={t} style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 6 }}>{t}</span>)}</div>;
    case 'regwidget':
      return <div style={{ width: 158, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 9, color: '#e5e5e5', font: `11px ${mono}`, overflow: 'hidden' }}><div style={{ padding: '6px 8px', borderBottom: '1px solid #222', fontWeight: 700, fontSize: 10 }}>🪪 Đăng ký</div><div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}><div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 5, padding: '3px 6px', color: '#8b949e', fontSize: 10 }}>user · gsmarter17</div><div style={{ display: 'flex', gap: 5 }}><span style={{ background: '#7c3aed', color: '#fff', padding: '3px 9px', borderRadius: 6, fontSize: 10 }}>🪄 Fill all</span><span style={{ background: '#1f2937', color: '#cbd5e1', padding: '3px 9px', borderRadius: 6, fontSize: 10 }}>Submit →</span></div></div></div>;
    case 'login-pill':
      return <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 999, padding: '7px 13px', font: `700 11px ${mono}`, boxShadow: '0 6px 20px rgba(0,0,0,.5)' }}>🪪</span>;
    case 'crew-bar':
      return <div style={{ width: 188, background: '#12151c', border: '1px solid #5b3fa6', borderRadius: 11, padding: 7, color: '#fff', font: `12px ${sys}` }}><div style={{ fontWeight: 800, paddingBottom: 5, marginBottom: 5, borderBottom: '1px solid #2d2640' }}>🤖 HyperJournal</div><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ background: '#241c3a', color: '#c4b5fd', borderRadius: 5, padding: '2px 6px', fontSize: 10 }}>🌐 RU</span><span style={{ background: '#0d1117', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 5, padding: '2px 6px', fontSize: 10 }}>≤90</span><span style={{ background: 'rgba(74,222,128,.14)', color: '#4ade80', border: '1px solid #2ea043', borderRadius: 5, padding: '2px 6px', fontSize: 10 }}>📏 ≤280</span><span style={{ background: '#7c3aed', color: '#fff', borderRadius: 5, padding: '2px 8px', fontSize: 10 }}>✨ Gen reply</span></div></div>;
    case 'inline-solve':
      return <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', font: `11px ${sys}` }}><span style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 5, padding: '3px 8px', color: '#8b949e', fontSize: 10 }}>Что изображено?</span><span style={{ background: 'rgba(167,139,250,.28)', color: '#c4b5fd', border: '1px solid #5b3fa6', borderRadius: 5, padding: '2px 6px' }}>🤖</span></span>;
    case 'seeded-list':
    case 'selmgr':
    case 'domsamples':
      return <div style={{ width: 170, background: '#15101f', border: '1px solid #5b3fa6', borderRadius: 8, padding: '8px 10px', color: '#e7e3ff', font: `11px ${sys}` }}><div style={{ fontWeight: 700, marginBottom: 5 }}>{k === 'seeded-list' ? '📋 Bài đã seed' : k === 'selmgr' ? '🧷 Selector composer' : '🗂 DOM đã lưu'}</div><div style={{ borderTop: '1px solid #2a2340', padding: '4px 0', fontSize: 10, color: '#a99fce' }}>#1 · live · 👁 30</div><div style={{ borderTop: '1px solid #2a2340', padding: '4px 0', fontSize: 10, color: '#a99fce' }}>#2 · pending</div></div>;
    case 'toast':
      return <span style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 8, padding: '6px 11px', font: `11px ${sys}` }}>💾 Đã lưu DOM #7</span>;
    default:
      return <span style={{ color: 'var(--fg-4)', fontFamily: mono, fontSize: 10 }}>—</span>;
  }
}

// Ext · Surface — catalog MỌI element MOS2 Crew inject trên thực địa (badge/pill/widget/menu/
// HL box/popover/toast). Source kiểm soát để implement/nâng cấp: group theo loại + z-index ladder
// (tránh đè nhau như RegKit widget bị HL phủ). EXT_SURFACE sống trong spec.ts.
// Crew ext · Coverage matrix — platform/tech × tầng support. SINGLE SOURCE = ext buildCapabilities()
// (đọc cfg tables LIVE → POST DB crew_capabilities); CapsCtx mang data đó xuống, fallback bản bundled
// crew-capabilities.json khi ext chưa report. NHÚNG vào drawer Platform (social) + Technology (tech).
type CapRow = { recognize: boolean; login: boolean; badge: boolean; contact: boolean; host?: string; notes?: Record<string, string> };
type CapsData = typeof crewCaps;
const CapsCtx = createContext<CapsData>(crewCaps);

// Pha A content-value — NHÚNG vào drawer node `card` (KHÔNG page riêng; xem feedback_no_new_pages).
// Data load 1 lần ở route, mang xuống qua ContentValueCtx (giống CapsCtx). null = chưa load.
// onOpen chung: entity có node → mở InstanceDetail thành lớp cascade (giống FK click). Dùng cho Pha A/B.
function useOpenInstance() {
  const openSub = useContext(SubCtx);
  return (objKey: string, id: string | number, label: string) => openSub({
    title: label || `#${id}`, sub: OBJ_BY_KEY[objKey]?.label || objKey,
    body: <InstanceDetail objKey={objKey} id={String(id)} />, route: { t: 'inst', objKey, id: String(id), label },
  });
}

const ContentValueCtx = createContext<ContentValue | null>(null);
function ContentValueInline({ projects }: { projects: { id: string; name: string }[] }) {
  const cv = useContext(ContentValueCtx);
  const onOpen = useOpenInstance();
  if (!cv) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có dữ liệu insights.</div>;
  return <ContentValuePage data={cv} projects={projects} embedded onOpen={onOpen} />;
}

// Pha B cadence — NHÚNG vào drawer node `habitat`. Data load 1 lần ở route → ContentCadenceCtx.
const ContentCadenceCtx = createContext<ContentCadence | null>(null);
function ContentCadenceInline({ projects }: { projects: { id: string; name: string }[] }) {
  const cad = useContext(ContentCadenceCtx);
  const onOpen = useOpenInstance();
  if (!cad) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có dữ liệu cadence.</div>;
  return <ContentCadenceTable data={cad} projects={projects} onOpen={onOpen} />;
}

// Pha 1 (pillar coverage) + Setup account (browser/proxy) — self-fetch lúc mount (lazy, ko cần route/context).
function PillarCoverageInline() { const onOpen = useOpenInstance(); return <PillarCoveragePanel onOpen={onOpen} />; }
function AccountInfraInline() { const onOpen = useOpenInstance(); return <AccountInfraPanel onOpen={onOpen} />; }
function TeamInline() { const onOpen = useOpenInstance(); return <TeamPanel onOpen={onOpen} />; }
function CoverageMatrix({ kind }: { kind: 'social' | 'tech' }) {
  const caps = useContext(CapsCtx);
  const dims = caps.dimensions as { key: string; label: string; desc: string }[];
  const socials = Object.entries(caps.platforms as Record<string, CapRow>).map(([k, v]) => ({ k, ...v }));
  const tech = Object.entries(caps.tech as Record<string, CapRow>).map(([k, v]) => ({ k, ...v }));
  const score = (r: CapRow) => [r.recognize, r.login, r.badge, r.contact].filter(Boolean).length;
  const Cell = ({ on }: { on: boolean }) => <span style={{ color: on ? 'var(--ok)' : 'var(--fg-4)', fontWeight: on ? 700 : 400 }}>{on ? '✓' : '·'}</span>;
  const th: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)', padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, padding: '5px 10px', textAlign: 'center', borderBottom: '1px solid var(--line)' };
  const note: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 10, lineHeight: 1.5 };
  const v = (caps as { version?: string }).version;
  const intro = <div style={note}>Ext <b style={{ color: 'var(--accent)' }}>tự assemble + report</b> (buildCapabilities đọc cfg tables LIVE){v ? <> · ext v<b style={{ color: 'var(--fg-1)' }}>{v}</b></> : <> · <span style={{ color: 'var(--warn)' }}>chưa report (bản bundled)</span></>}. Thêm platform vào cfg = tự có, ko regex/drift.</div>;
  const caveat = (caps as { scopeNote?: string }).scopeNote
    ? <div style={{ ...note, marginTop: 10, marginBottom: 0, borderTop: '1px solid var(--line)', paddingTop: 8, color: 'var(--fg-4)' }}>⚠ {(caps as { scopeNote?: string }).scopeNote}</div>
    : null;

  if (kind === 'tech') {
    return (
      <div style={{ overflow: 'auto' }}>
        {intro}
        <table style={{ borderCollapse: 'collapse', maxWidth: 420, marginBottom: 10, width: '100%' }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Tech</th><th style={th}>Badge</th><th style={th}>Contact</th></tr></thead>
          <tbody>
            {tech.map((r) => (
              <tr key={r.k}>
                <td style={{ ...td, textAlign: 'left', color: 'var(--fg-0)', fontWeight: 600 }}>{r.k}</td>
                <td style={td}><Tip text={`Badge: ${r.badge ? '✓ có' : '— chưa'}\n${r.notes?.badge || ''}`} style={{ cursor: 'help' }}><Cell on={r.badge} /></Tip></td>
                <td style={td}><Tip text={`Contact: ${r.contact ? '✓ có' : '— chưa'}\n${r.notes?.contact || ''}`} style={{ cursor: 'help' }}><Cell on={r.contact} /></Tip></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={note}>{(caps as { bbcodeNote?: string }).bbcodeNote}</div>
        {caveat}
      </div>
    );
  }
  const socialSorted = [...socials].sort((a, b) => score(b) - score(a) || a.k.localeCompare(b.k));
  const fullCount = socialSorted.filter((r) => score(r) === 4).length;
  const withContact = socials.filter((r) => r.contact).length;
  return (
    <div style={{ overflow: 'auto' }}>
      {intro}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ ...legendChip, color: 'var(--ok)' }}>{fullCount} full 4 tầng</span>
        <span style={{ ...legendChip, color: 'var(--accent)' }}>{withContact} có Contact</span>
      </div>
      <table style={{ borderCollapse: 'collapse', maxWidth: 720, width: '100%' }}>
        <thead><tr><th style={{ ...th, textAlign: 'left' }}>Platform</th>{dims.map((d) => <th key={d.key} style={th} title={d.desc}>{d.label}</th>)}<th style={th}>Σ</th></tr></thead>
        <tbody>
          {socialSorted.map((r) => { const s = score(r); const isFull = s === 4; return (
            <tr key={r.k} style={{ background: isFull ? 'color-mix(in srgb, var(--ok) 9%, transparent)' : undefined }}>
              <td style={{ ...td, textAlign: 'left', color: 'var(--fg-0)', fontWeight: 600 }}>{r.k}{isFull && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--ok)', fontWeight: 700 }}>FULL</span>}<span style={{ color: 'var(--fg-4)', fontWeight: 400, marginLeft: 6 }}>{r.host}</span></td>
              {dims.map((d) => { const on = Boolean((r as unknown as Record<string, boolean>)[d.key]); return (
                <td key={d.key} style={td}><Tip text={`${d.label}: ${on ? '✓ có' : '— chưa'}\n${r.notes?.[d.key] || d.desc}`} style={{ cursor: 'help' }}><Cell on={on} /></Tip></td>
              ); })}
              <td style={{ ...td, color: isFull ? 'var(--ok)' : 'var(--fg-3)', fontWeight: 700 }}>{s}</td>
            </tr>
          ); })}
        </tbody>
      </table>
      {caveat}
    </div>
  );
}

function ExtSurfaceRegistry() {
  const groups = (['marker', 'overlay', 'panel', 'menu', 'toast'] as SurfaceGroup[])
    .map((g) => ({ g, items: EXT_SURFACE.filter((e) => e.group === g) }))
    .filter((x) => x.items.length);
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 20px', background: 'var(--bg-0)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginBottom: 12, maxWidth: 760, lineHeight: 1.5 }}>
        Mọi element ext dựng trên trang thật — <b style={{ color: 'var(--fg-1)' }}>{EXT_SURFACE.length}</b> element. Đây là <b style={{ color: 'var(--accent)' }}>source kiểm soát</b>: thêm/nâng cấp badge·pill·widget·menu → khai báo ở <code style={{ fontFamily: 'var(--font-mono)' }}>spec.ts EXT_SURFACE</code> trước, rồi implement trong ext theo đúng layer.
      </div>
      {/* z-index ladder */}
      <div style={{ marginBottom: 18, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-4)', padding: '6px 10px', background: 'var(--bg-2)' }}>z-index ladder (trên → dưới)</div>
        {SURFACE_LAYERS.map((l) => (
          <div key={l.z} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, padding: '5px 10px', borderTop: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 11, alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{l.z === 0 ? '—' : l.z}</span>
            <span style={{ color: 'var(--fg-2)' }}>{l.label}</span>
          </div>
        ))}
      </div>
      {groups.map(({ g, items }) => {
        const meta = SURFACE_GROUP_META[g];
        return (
          <div key={g} style={{ marginBottom: 18, maxWidth: 980 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: meta.color }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-1)' }}>{meta.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>· {items.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {items.map((e) => (
                <div key={e.key} style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${meta.color}`, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-1)' }}>
                  {/* PREVIEW — faux page bg để thấy hình dáng thật trên nền trang */}
                  <div style={{ minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 12px', background: 'repeating-linear-gradient(45deg, #0c0e12, #0c0e12 9px, #0f1217 9px, #0f1217 18px)', borderBottom: '1px solid var(--line)' }}>
                    <SurfacePreview k={e.key} />
                  </div>
                  {/* META */}
                  <div style={{ padding: '8px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>{e.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: e.zIndex == null ? 'var(--fg-4)' : 'var(--accent)', fontWeight: e.zIndex == null ? 400 : 700 }} title={e.zIndex == null ? 'inline (ăn theo flow trang)' : `z-index ${e.zIndex}`}>{e.zIndex == null ? 'inline' : 'z' + String(e.zIndex).slice(-3)}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: meta.color, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.domId}>{e.domId}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-2)', lineHeight: 1.45, marginTop: 5 }}>{e.purpose}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', marginTop: 3, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>⤷ {e.trigger}</span><span title={e.file} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 130 }}>{e.file}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Canon · Behavioral registry — the "x-entity" surface. Each behavioral concept (field-canon,
// platform-key, scope, engine, viewer-handle, board-class) shown ONCE: resolver signature, its
// home file:line on BOTH runtimes, codegen source, + live DB drift. Reference this, don't grep
// from memory. See decisions/2026-06-25-crew-behavioral-registry-xentity.md.
function CanonRegistry() {
  const [checks, setChecks] = useState<CanonCheck[] | null>(null);
  useEffect(() => { canonChecks().then(setChecks).catch(() => setChecks([])); }, []);
  const driftFor = (key: string) => (checks || []).find((c) => c.key === key);
  const cell = (label: string, val: ReactNode) => (
    <>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ color: 'var(--fg-1)' }}>{val}</span>
    </>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg-0)' }}>Canon · Behavioral registry</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>// 1 khái niệm hành vi = 1 resolver · tham chiếu, đừng reimplement inline</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', marginBottom: 16, maxWidth: 780, lineHeight: 1.55 }}>
        Backend <code style={{ color: 'var(--accent)' }}>canon.*</code> (lib/canon) ↔ ext <code style={{ color: 'var(--accent)' }}>MOS2.resolve.*</code> (core/resolve.js). Sửa 1 alias/host → sửa ĐÚNG file lib gốc; CẤM inline lowercase/host-match/engine-regex/querySelector-login tại call-site. CI guard <code style={{ color: 'var(--accent)' }}>check-canon.mjs</code> chặn tái diễn ở backend.
      </div>
      <div style={{ display: 'grid', gap: 10, maxWidth: 940 }}>
        {CANON.map((c) => {
          const d = driftFor(c.key);
          const hasDrift = d != null && d.drift > 0;
          const failed = d != null && d.drift < 0;
          return (
            <div key={c.key} style={{ border: `1px solid ${hasDrift ? 'var(--bad)' : 'var(--line)'}`, borderRadius: 8, background: 'var(--bg-1)', padding: '11px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600, color: 'var(--fg-0)' }}>{c.label}</span>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>{c.key}</code>
                {d != null && (
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, color: hasDrift ? 'var(--bg-1)' : failed ? 'var(--warn)' : 'var(--ok)', background: hasDrift ? 'var(--bad)' : 'transparent', border: `1px solid ${hasDrift ? 'var(--bad)' : failed ? 'var(--warn)' : 'var(--ok)'}` }}>
                    {failed ? '? check failed' : hasDrift ? `⚠ ${d.drift} drift` : '✓ no drift'}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>{c.signature}</div>
              {d && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: hasDrift ? 'var(--bad)' : 'var(--fg-3)', marginTop: 4 }}>{d.detail}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                {cell('backend', c.backendRef)}
                {cell('ext', c.extRef)}
                {c.generatedFrom && cell('codegen', c.generatedFrom)}
                {cell('home', c.references.map((r) => `${r.file}${r.line ? `:${r.line}` : ''}`).join('  ·  '))}
              </div>
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
  const rf = useReactFlow();
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
    // restore tab + open drawer from the URL so F5 keeps the view/modal
    try {
      const sp = new URLSearchParams(window.location.search);
      const tab = sp.get('tab');
      if (tab && ['objects', 'onpage', 'backend', 'live', 'canon', 'surface'].includes(tab)) setView(tab as ViewKey);
      const obj = sp.get('obj'); const flow = sp.get('flow'); const step = sp.get('step');
      if (obj && OBJ_BY_KEY[obj]) setSel({ kind: 'object', key: obj });
      else if (flow && step && FLOW_BY_KEY[flow]) setSel({ kind: 'flow', flow, step });
      // restore the cascade drawer stack (full drill flow) so F5 reopens every layer in order
      const d = sp.get('d'); if (d) { const st = decodeStack(d); if (st.length) setStack(st); }
    } catch { /* */ }
    hydrated.current = true;
  }, []);
  // reflect tab + open drawer into the URL (replaceState — no history spam)
  const urlSkip = useRef(true);
  useEffect(() => {
    if (urlSkip.current) { urlSkip.current = false; return; }
    try {
      const sp = new URLSearchParams(window.location.search);
      if (view === 'objects') sp.delete('tab'); else sp.set('tab', view);
      sp.delete('obj'); sp.delete('flow'); sp.delete('step');
      if (sel?.kind === 'object') sp.set('obj', sel.key);
      else if (sel?.kind === 'flow') { sp.set('flow', sel.flow); sp.set('step', sel.step); }
      const ds = encodeStack(stack); if (ds) sp.set('d', ds); else sp.delete('d');
      const qs = sp.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } catch { /* */ }
  }, [view, sel, stack]);
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
    if (view === 'objects') {
      // đo size THẬT của node đang render → giãn khít theo từng node (cao/thấp khác nhau).
      const measured: Record<string, { w: number; h: number }> = {};
      nodes.forEach((n) => { const m = n.measured; if (m?.width) measured[n.id] = { w: m.width, h: m.height || EST_H }; });
      const pos = layoutColumns(measured);
      savePositions(view, pos); savedRef.current = pos;
      const g = buildObjectGraph(pos, bound, scan);
      setNodes(g.nodes); setEdges(g.edges);
    } else {
      savePositions(view, {}); savedRef.current = {};
      const flow = FLOW_BY_KEY[view === 'onpage' ? 'onpage' : 'backend'];
      const g = flow ? buildFlowGraph(flow, {}) : buildObjectGraph({}, bound, scan);
      setNodes(g.nodes); setEdges(g.edges);
    }
    // refit sau khi DOM cập nhật vị trí mới
    requestAnimationFrame(() => { try { rf.fitView({ padding: 0.18, duration: 320 }); } catch { /* */ } });
  }, [view, bound, scan, nodes, setNodes, setEdges, rf]);

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
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--fg-0)' }}>Architect</div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 6, padding: 2 }}>
          {([['objects', 'Objects & Links'], ['onpage', 'Flow · On-page'], ['backend', 'Flow · Backend'], ['live', 'Live · Activity'], ['canon', 'Canon · Registry'], ['surface', 'Ext · Surface']] as [ViewKey, string][]).map(([k, lbl]) => (
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
        ) : view === 'canon' ? (
          <CanonRegistry />
        ) : view === 'surface' ? (
          <ExtSurfaceRegistry />
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
          width={1280}
          footer={null}
          pushPx={sel ? Math.min(stack.length * CASCADE_STEP, 600) : 0}
        >
          {selObj && <ObjectDrawerBody obj={selObj} projects={projects} defaultProject={proj} onProjectChange={setProj} bound={bound[selObj.key]} onBind={(b) => setBound((prev) => { const next = { ...prev }; if (b) next[selObj.key] = b; else delete next[selObj.key]; return next; })} />}
          {selFlow && sel?.kind === 'flow' && <FlowDrawerBody flow={selFlow} stepId={sel.step} />}
        </Drawer>
        <SubStack stack={sel ? stack : []} popTo={popTo} width={860} />
      </SubCtx.Provider>
    </div>
  );
}

export function ArchitectureStudio({ projects, defaultProjectId, caps, contentValue, contentCadence }: { projects: { id: string; name: string }[]; defaultProjectId?: string; caps?: Record<string, unknown> | null; contentValue?: ContentValue | null; contentCadence?: ContentCadence | null }) {
  return (
    <ReactFlowProvider>
      <CapsCtx.Provider value={(caps && caps.platforms ? caps : crewCaps) as CapsData}>
        <ContentValueCtx.Provider value={contentValue ?? null}>
          <ContentCadenceCtx.Provider value={contentCadence ?? null}>
            <StudioInner projects={projects} defaultProjectId={defaultProjectId || ''} />
          </ContentCadenceCtx.Provider>
        </ContentValueCtx.Provider>
      </CapsCtx.Provider>
    </ReactFlowProvider>
  );
}

// ── small style helpers ──────────────────────────────────────────────────────
// ── Template Adoption worklist ──────────────────────────────────────────────
// Scaling cockpit: 1 technology template → N forums. Shows each template's reach
// (bound platforms + ext-detected candidates with 1-click adopt) and unbound
// platforms still needing a template (manual bind dropdown).
const PK_SHORT: Record<string, string> = { signup: 'signup', composer: 'composer', 'account-profile': 'profile', 'post-metrics': 'metrics', 'subreddit-about': 'about', 'platform-any': 'viewer' };
function packLabel(c: Record<string, number>): string {
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${PK_SHORT[k] || k} ${n}`).join(' · ');
}
// selectors gom theo page_kind, click 1 field → SelectorDetail. Dùng lại cho tech & platform.
function SelByPageKind({ rows }: { rows: SelCatRow[] }) {
  const openSub = useContext(SubCtx);
  const byPk = new Map<string, SelCatRow[]>();
  for (const r of rows) { const a = byPk.get(r.pageKind) ?? byPk.set(r.pageKind, []).get(r.pageKind)!; a.push(r); }
  return (
    <>
      {[...byPk.entries()].map(([pk, items]) => (
        <div key={pk} style={{ marginBottom: 8, border: '1px solid var(--line)', borderLeft: '3px solid var(--accent)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 10px', background: 'var(--bg-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{PK_SHORT[pk] || pk}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{items.length} field</span>
          </div>
          {items.map((s, i) => (
            <button key={s.id} onClick={() => openSub({ title: s.fieldName, sub: `${s.scopeKind} · ${s.scopeKey} · @ ${pk}`, body: <SelectorDetail id={s.id} />, route: { t: 'sel', id: s.id } })}
              style={{ display: 'flex', width: '100%', textAlign: 'left', gap: 8, alignItems: 'center', padding: '4px 10px', borderTop: '1px solid var(--line)', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }}>{s.fieldName}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>↗</span>
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
// Drawer riêng cho 1 THỰC THỂ cụ thể (technology hoặc platform) — theo dõi: selectors
// own + kế thừa (platform bind tech) theo page_kind + DOM samples của nó.
function EntityScopeDrawer({ scope, scopeKey, technologyKey }: { scope: 'technology' | 'platform'; scopeKey: string; technologyKey?: string | null }) {
  const openSub = useContext(SubCtx);
  const [cat, setCat] = useState<SelCatRow[] | null>(null);
  const [samples, setSamples] = useState<DomSampleRow[] | null>(null);
  useEffect(() => { let dead = false; selectorCatalog().then((r) => { if (!dead) setCat(r); }); listDomSamples().then((r) => { if (!dead) setSamples(r); }); return () => { dead = true; }; }, []);
  if (cat == null || samples == null) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  const own = cat.filter((x) => x.scopeKey === scopeKey && (x.scopeKind === scope || (scope === 'technology' && x.scopeKind === 'engine')));
  const inh = (scope === 'platform' && technologyKey) ? cat.filter((x) => x.scopeKey === technologyKey && (x.scopeKind === 'technology' || x.scopeKind === 'engine')) : [];
  const mine = samples.filter((s) => (scope === 'technology' ? s.technologyKey === scopeKey : s.platformKey === scopeKey));
  const hdr = (t: string, c: string) => <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: c, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 6px' }}>{t}</div>;
  // Đây là drawer RIÊNG của thực thể này (hub theo dõi) — KHÔNG phải record chính thức.
  // Link mở Platform/Technology record (catalog quản lý) nếu muốn.
  const recObj = scope === 'platform' ? 'platform' : 'technology';
  const recHref = (OBJ_BY_KEY[recObj]?.deepLink || (scope === 'platform' ? '/platforms' : '/technologies')) + (scope === 'platform' ? `?key=${encodeURIComponent(scopeKey)}` : `?e=${encodeURIComponent(scopeKey)}`);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>{scope} <b style={{ color: scope === 'technology' ? '#b48cff' : 'var(--accent)' }}>{scopeKey}</b></span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{own.length} own{inh.length ? ` · ${inh.length} kế thừa` : ''} · {mine.length} sample</span>
        <a href={recHref} target="_blank" rel="noopener noreferrer" title={`Mở ${scope} record chính thức (catalog) trong tab mới`}
          style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>
          ↗ {scope === 'platform' ? 'Platform' : 'Technology'} record
        </a>
      </div>
      {own.length === 0 && inh.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có selector. Train trên site / seed từ DOM sample → field hiện ở đây.</div>}
      {own.length > 0 && <>{hdr('selectors (scope này)', 'var(--fg-4)')}<SelByPageKind rows={own} /></>}
      {inh.length > 0 && <>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#b48cff', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '10px 0 6px' }}>
          kế thừa từ technology <EntityLink scope="technology" ek={technologyKey!} label={technologyKey!} style={{ color: '#b48cff', fontWeight: 700, textTransform: 'uppercase' }} />
        </div>
        <SelByPageKind rows={inh} />
      </>}
      {mine.length > 0 && <>
        {hdr('DOM samples', 'var(--fg-4)')}
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          {mine.map((s, i) => (
            <button key={s.id} onClick={() => openSub({ title: `#${s.id} · ${s.platformKey || s.hostname || ''}`, sub: 'extract preview', body: <DomSampleDetail id={s.id} />, route: { t: 'dom', id: s.id } })}
              style={{ display: 'flex', width: '100%', textAlign: 'left', gap: 8, alignItems: 'center', padding: '4px 10px', borderTop: i ? '1px solid var(--line)' : 'none', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>#{s.id}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{s.pageKind}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{s.bytes >= 1024 ? Math.round(s.bytes / 1024) + 'KB' : s.bytes + 'B'} ↗</span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}
// REUSABLE: bất kỳ tên thực thể (platform/technology) ở đâu cũng dùng cái này → tự
// mở drawer hub tương ứng. Item mới chỉ cần <EntityLink>, KHÔNG wire openSub tay.
function EntityLink({ scope, ek, label, tech, style }: { scope: 'platform' | 'technology'; ek: string; label?: string; tech?: string | null; style?: CSSProperties }) {
  const openSub = useContext(SubCtx);
  return (
    <button onClick={() => openSub({ title: label || ek, sub: `${scope} hub · selectors + samples`, body: <EntityScopeDrawer scope={scope} scopeKey={ek} technologyKey={tech} />, route: { t: 'entity', scope, key: ek, tech } })}
      title={`Mở drawer ${scope}: ${label || ek}`}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...style }}>
      {label || ek} ↗
    </button>
  );
}
function TemplateAdoptionPanel() {
  const [data, setData] = useState<TemplateAdoptionData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({}); // unbound platform key → chosen tech
  const load = useCallback(() => { let dead = false; templateAdoption().then((d) => { if (!dead) setData(d); }); return () => { dead = true; }; }, []);
  useEffect(() => load(), [load]);
  const reload = useCallback(async () => { setRefreshing(true); try { setData(await templateAdoption()); } finally { setRefreshing(false); } }, []);

  const adopt = useCallback(async (platformKey: string, technologyKey: string, label?: string) => {
    setBusy(platformKey + ':' + technologyKey);
    await adoptTemplate({ platformKey, technologyKey, label, signupUrl: label ? 'https://' + label : undefined });
    setBusy(null);
    load();
  }, [load]);

  if (data == null) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading adoption…</div>;

  const btn = (active: boolean): CSSProperties => ({ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, cursor: active ? 'pointer' : 'default', border: '1px solid var(--accent)', color: active ? 'var(--bg-1)' : 'var(--accent)', background: active ? 'var(--accent)' : 'transparent', whiteSpace: 'nowrap' });
  const techGreen = '#b48cff';

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 12 }}>
        <span style={{ color: 'var(--ok)' }}>✓ {data.seedReadyCount} seed-ready</span>
        <span style={{ color: techGreen }}>◆ {data.techs.length} templates</span>
        <span style={{ color: data.detectedCount ? 'var(--accent)' : 'var(--fg-4)' }}>◎ {data.detectedCount} detected (ext)</span>
        <span style={{ color: data.unbound.length ? 'var(--warn,#ffb03c)' : 'var(--fg-4)' }} title="Forum platform (category community) chưa gắn engine — không tính platform bespoke (social/messaging/…)">⬚ {data.unbound.length} forum chưa bind</span>
        <button onClick={reload} disabled={refreshing} title="Tải lại dữ liệu (sau khi ext detect forum mới)"
          style={{ marginLeft: 'auto', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-1)', cursor: refreshing ? 'default' : 'pointer', width: 26, height: 26, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.5 : 1 }}>
          <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>↻</span>
        </button>
        <style>{'@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'}</style>
      </div>

      {/* per-template reach */}
      {data.techs.map((t) => (
        <div key={t.key} style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${techGreen}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <EntityLink scope="technology" ek={t.key} label={t.label} style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: techGreen }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>pack: {packLabel(t.selectorCounts)}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>{t.bound.length} bound</span>
          </div>
          {t.bound.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {t.bound.map((b) => (
                <EntityLink key={b.key} scope="platform" ek={b.key} label={`✓ ${b.label}`} tech={t.key} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ok)', border: '1px solid var(--ok)', borderRadius: 999, padding: '1px 8px' }} />
              ))}
            </div>
          )}
          {t.candidates.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>detected — adopt to inherit pack</div>
              {t.candidates.map((c) => (
                <div key={c.host} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                  <EntityLink scope="platform" ek={c.platformKey} label={c.host} tech={t.key} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>×{c.hits}{c.platformExists ? '' : ' · new'}</span>
                  <button disabled={!!busy} onClick={() => adopt(c.platformKey, t.key, c.host)} style={{ ...btn(true), marginLeft: 'auto', opacity: busy ? 0.5 : 1 }}>
                    {busy === c.platformKey + ':' + t.key ? '…' : `Adopt → +${t.total}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* unbound platforms needing a template */}
      {data.unbound.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }} title="Chỉ forum platform (category community/forum) — bespoke platform (Discord/FB/LinkedIn…) train selector riêng, không adopt template">forum platforms chưa gắn engine — bind a template</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {data.unbound.map((p, i) => {
              const chosen = pick[p.key] || p.detectedTech || '';
              return (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                  <EntityLink scope="platform" ek={p.key} label={p.label} tech={p.detectedTech} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{p.accounts} acct · own s{p.signup}/c{p.composer}</span>
                  {p.detectedTech && <span title="ext-detected engine" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: techGreen }}>◎ {p.detectedTech}</span>}
                  <select value={chosen} onChange={(e) => setPick((m) => ({ ...m, [p.key]: e.target.value }))} autoComplete="off"
                    style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)', padding: '2px 5px', maxWidth: 130 }}>
                    <option value="">technology…</option>
                    {data.allTechs.map((tt) => <option key={tt.key} value={tt.key}>{tt.label}</option>)}
                  </select>
                  <button disabled={!chosen || !!busy} onClick={() => adopt(p.key, chosen)} style={{ ...btn(!!chosen), opacity: !chosen || busy ? 0.4 : 1 }}>
                    {busy === p.key + ':' + chosen ? '…' : 'Bind'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.techs.length === 0 && data.unbound.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có selector template nào, và không có forum platform nào chờ bind.</div>}
    </div>
  );
}

// Chi tiết 1 sample: auto-extract entity LIST (user/thread/board) để KIỂM SOÁT
// page trích được gì trước khi seed.
function EntityGroup({ title, color, items, total, fmt }: { title: string; color: string; items: ExtractedEntity[]; total: number; fmt: (e: ExtractedEntity) => string }) {
  const PREVIEW = 8;
  const [expanded, setExpanded] = useState(false);
  const [q, setQ] = useState('');
  if (total === 0) return null;
  const ql = q.trim().toLowerCase();
  const filtered = ql ? items.filter((e) => `${e.key} ${fmt(e)} ${e.url || ''}`.toLowerCase().includes(ql)) : items;
  const showAll = expanded || !!ql;
  const shown = showAll ? filtered : filtered.slice(0, PREVIEW);
  const moreCount = filtered.length - shown.length;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color }}>{title} · {total}{total > items.length ? ` (mẫu ${items.length})` : ''}</span>
        {items.length > PREVIEW && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="lọc…" autoComplete="off"
          style={{ marginLeft: 'auto', width: 120, boxSizing: 'border-box', padding: '2px 7px', fontSize: 10.5, fontFamily: 'var(--font-mono)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)' }} />}
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
        {shown.map((e, i) => (
          <div key={e.key + i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 9px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', minWidth: 60, flexShrink: 0 }}>{e.key}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fmt(e) + (e.url ? '\n' + e.url : '')}>{fmt(e)}</span>
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: '4px 9px', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>không khớp</div>}
      </div>
      {!showAll && moreCount > 0 && <button onClick={() => setExpanded(true)} style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>+ xem thêm ({moreCount})</button>}
      {expanded && !ql && <button onClick={() => setExpanded(false)} style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>− thu gọn</button>}
    </div>
  );
}
// GIEO SELECTOR: map các field extract được vào (technology|platform) scope. Sau seed,
// ext highlight field này trên trang (page_kind thread-list/member-list). User review css
// TRƯỚC khi bấm — kiểm soát, không tự ghi đè.
function SeedPanel({ id, proposals, platformKey, technologyKey, onSeeded }: { id: number; proposals: SeedSelector[]; platformKey: string | null; technologyKey: string | null; onSeeded?: () => void }) {
  const [busy, setBusy] = useState<'technology' | 'platform' | null>(null);
  const [force, setForce] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useCallback(async (scope: 'technology' | 'platform') => {
    setBusy(scope); setMsg(null);
    const r = await seedSelectorsFromSample(id, scope, force);
    setBusy(null);
    if (r.ok) {
      const extra = [r.skippedSame ? `${r.skippedSame} bỏ qua (đã có)` : '', r.protectedManual ? `${r.protectedManual} giữ nguyên (manual)` : ''].filter(Boolean).join(' · ');
      setMsg({ ok: true, text: `✓ Ghi ${r.seeded} selector → ${scope} ${r.scopeKey}${extra ? ` · ${extra}` : ''}. Mở site (ext) → bật Highlight để thấy field được bắt.` });
      onSeeded?.();
    } else setMsg({ ok: false, text: `✕ ${r.error}` });
  }, [id, force, onSeeded]);
  const byPk = new Map<string, SeedSelector[]>();
  for (const s of proposals) { const a = byPk.get(s.pageKind) ?? byPk.set(s.pageKind, []).get(s.pageKind)!; a.push(s); }
  // tally per scope: new (sẽ ghi) · same (bỏ qua) · diff (ghi đè) · manual (protect nếu !force)
  const tally = (scope: 'technology' | 'platform') => {
    let neu = 0, same = 0, diff = 0, manual = 0;
    for (const s of proposals) { const st = scope === 'technology' ? s.tech : s.plat; if (!st || st.status === 'new') neu++; else if (st.status === 'same') same++; else { diff++; if (st.source === 'manual') manual++; } }
    return { neu, same, diff, manual };
  };
  const anyManual = tally('technology').manual + tally('platform').manual > 0;
  // badge cho 1 field ở 1 scope: chỉ hiện khi ĐÃ CÓ (same/diff) — 'new' để trống cho gọn.
  const stateBadge = (label: string, st?: SeedFieldState): ReactNode => {
    if (!st || st.status === 'new') return null;
    const same = st.status === 'same';
    const c = same ? 'var(--fg-4)' : (st.source === 'manual' ? 'var(--bad)' : 'var(--warn,#ffb03c)');
    const txt = same ? `✓${label}` : `⚠${label}${st.source === 'manual' ? '·manual' : ''}`;
    const tip = same ? `${label}: đã có y hệt → seed bỏ qua` : `${label}: đã có khác (${st.source}) — ${st.css}·${st.attr || 'textContent'}${st.source === 'manual' ? ' · train tay, KHÔNG đè trừ khi bật force' : ' → seed sẽ ghi đè'}`;
    return <span title={tip} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: c, border: `1px solid ${c}`, borderRadius: 4, padding: '0 4px', whiteSpace: 'nowrap' }}>{txt}</span>;
  };
  const seedBtn = (scope: 'technology' | 'platform', key: string | null): ReactNode => {
    const t = tally(scope);
    const willWrite = t.neu + (t.diff - (force ? 0 : t.manual));
    const disabled = !key || busy != null || willWrite === 0;
    const counts = key ? ` · ${t.neu} mới${t.diff ? ` · ${t.diff} đè${t.manual ? `(${t.manual} manual)` : ''}` : ''}${t.same ? ` · ${t.same} có` : ''}` : '';
    return (
      <button key={scope} disabled={disabled} onClick={() => run(scope)}
        title={key ? `Ghi ${willWrite} selector vào ${scope} "${key}" (${t.neu} mới + ${force ? t.diff : t.diff - t.manual} ghi đè). ${t.same} đã có y hệt sẽ bỏ qua.${t.manual && !force ? ` ${t.manual} selector train tay được giữ nguyên (bật force để đè).` : ''}` : `Sample chưa gắn ${scope} — không thể seed scope này`}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: disabled ? 'default' : 'pointer', border: `1px solid ${scope === 'technology' ? '#b48cff' : 'var(--accent)'}`, color: disabled ? 'var(--fg-4)' : (scope === 'technology' ? '#b48cff' : 'var(--accent)'), background: 'transparent', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1 }}>
        {busy === scope ? '…' : `Seed → ${scope}${key ? ` ${key}` : ' (chưa gắn)'}${busy ? '' : counts}`}
      </button>
    );
  };
  return (
    <div style={{ marginTop: 14, border: '1px solid var(--line)', borderLeft: '3px solid var(--ok)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>gieo selector · map vào scope</div>
      {proposals.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>Chưa đề xuất được selector (trang ít entity-link rõ pattern). Train tay từ class hooks ở trên, hoặc lưu 1 trang list (memberlist / viewforum) rồi extract lại.</div>
      ) : (
        <>
          {[...byPk.entries()].map(([pk, items]) => (
            <div key={pk} style={{ marginBottom: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>@ {pk}</div>
              {items.map((s) => (
                <div key={s.field} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '1px 0', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                  <span style={{ color: 'var(--fg-1)', minWidth: 96 }}>{s.field}</span>
                  <span style={{ color: 'var(--fg-3)', flex: 1, wordBreak: 'break-all' }}>{s.css}<span style={{ color: 'var(--fg-4)' }}> ·{s.attr}</span></span>
                  <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>{stateBadge('tech', s.tech)}{stateBadge('plat', s.plat)}</span>
                  <span style={{ color: 'var(--fg-4)' }}>×{s.count}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
            {seedBtn('technology', technologyKey)}
            {seedBtn('platform', platformKey)}
          </div>
          {anyManual && (
            <label style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, fontSize: 10.5, color: force ? 'var(--bad)' : 'var(--fg-3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} style={{ accentColor: 'var(--bad)' }} />
              ghi đè cả selector train tay (manual) — mặc định giữ nguyên
            </label>
          )}
          <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 5 }}>technology = mọi forum cùng engine kế thừa · platform = chỉ site này. <span style={{ color: 'var(--fg-3)' }}>✓ = đã có (bỏ qua) · ⚠ = sẽ ghi đè.</span></div>
          {msg && <div style={{ marginTop: 6, fontSize: 11, color: msg.ok ? 'var(--ok)' : 'var(--bad)' }}>{msg.text}</div>}
        </>
      )}
    </div>
  );
}

// ── UX Flows: list + block-diagram detail + entity peek ──────────────────────
function UxFlowsPanel() {
  const openSub = useContext(SubCtx);
  const [rows, setRows] = useState<UxFlowRow[] | null>(null);
  useEffect(() => { let dead = false; listUxFlows().then((r) => { if (!dead) setRows(r); }); return () => { dead = true; }; }, []);
  if (!rows) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  if (!rows.length) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có flow (ux_flows rỗng).</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((f) => (
        <button key={f.id} onClick={() => openSub({ title: f.label, sub: `${f.surface || ''} · ${f.steps} steps`, body: <UxFlowDetail id={f.id} />, route: { t: 'uxflow', id: f.id } })}
          style={{ textAlign: 'left', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', background: 'var(--bg-1)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--fg-0)', fontWeight: 600 }}>{f.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>{f.surface}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{f.steps} steps ↗</span>
          </div>
          {f.description && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3, lineHeight: 1.4 }}>{f.description}</div>}
        </button>
      ))}
    </div>
  );
}

function UxFlowDetail({ id }: { id: number }) {
  const openSub = useContext(SubCtx);
  const [d, setD] = useState<UxFlowDetailData | null | 'loading'>('loading');
  useEffect(() => { let dead = false; getUxFlow(id).then((r) => { if (!dead) setD(r ?? null); }); return () => { dead = true; }; }, [id]);
  if (d === 'loading') return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  if (!d) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>flow không tìm thấy.</div>;
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>{d.surface} · {d.steps.length} steps · need→action</div>
      {d.description && <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginBottom: 10, lineHeight: 1.4 }}>{d.description}</div>}
      {d.steps.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{i + 1}</div>
            {i < d.steps.length - 1 && <div style={{ flex: 1, width: 2, background: 'var(--line)', minHeight: 10 }} />}
          </div>
          <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 6, padding: '7px 9px', marginBottom: 8, background: 'var(--bg-1)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', fontWeight: 600 }}>{s.label} <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>· {s.stepKey}</span></div>
            {s.need && <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 3 }}><span style={{ color: 'var(--fg-4)' }}>cần:</span> {s.need}</div>}
            {s.action && <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 2 }}><span style={{ color: 'var(--ok)' }}>→</span> {s.action}</div>}
            {s.route && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--accent)', marginTop: 3 }}>{s.route}</div>}
            {s.objects.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                {s.objects.map((ok) => (
                  <button key={ok} onClick={() => openSub({ title: OBJ_BY_KEY[ok]?.label || ok, sub: 'entity spec (peek)', body: <ObjPeek objKey={ok} />, route: { t: 'objpeek', objKey: ok } })}
                    title={`mở entity ${ok}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px', background: 'var(--bg-2)', cursor: 'pointer' }}>
                    {OBJ_BY_KEY[ok]?.label || ok} ↗
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ObjPeek({ objKey }: { objKey: string }) {
  const o = OBJ_BY_KEY[objKey];
  if (!o) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{objKey}: không có trong spec.</div>;
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.45, marginBottom: 8 }}>{o.desc}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', marginBottom: 4 }}>{o.table ? `table: ${o.table}` : 'doc-only'} · group {o.group}</div>
      {o.attrs.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>attrs</div>
          {o.attrs.map((a) => (
            <div key={a.name} style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '1px 0' }}>
              <span style={{ color: 'var(--fg-1)', minWidth: 110 }}>{a.name}</span>
              <span style={{ color: 'var(--fg-4)' }}>{a.type}{a.col ? ` ·${a.col}` : ''}</span>
            </div>
          ))}
        </div>
      )}
      {o.routes.length > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginTop: 8, wordBreak: 'break-all' }}>{o.routes.join(' · ')}</div>}
      {o.deepLink && <a href={o.deepLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent)' }}>↗ manage real {o.label}</a>}
    </div>
  );
}

function IdentityDetail({ id }: { id: number }) {
  const [d, setD] = useState<IdentityDetailData | null | 'loading'>('loading');
  const [form, setForm] = useState<{ name: string; kind: string; handleBase: string; email: string; displayName: string; bio: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    getIdentity(id).then((r) => {
      if (dead) return;
      setD(r ?? null);
      if (r) setForm({ name: r.name || '', kind: r.kind || '', handleBase: r.handleBase || '', email: r.email || '', displayName: r.displayName || '', bio: r.bio || '' });
    });
    return () => { dead = true; };
  }, [id]);
  if (d === 'loading') return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading…</div>;
  if (!d || !form) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>identity không tìm thấy.</div>;
  const dirty = !!d && (form.name !== (d.name || '') || form.kind !== (d.kind || '') || form.handleBase !== (d.handleBase || '') || form.email !== (d.email || '') || form.displayName !== (d.displayName || '') || form.bio !== (d.bio || ''));
  const save = async () => {
    setSaving(true); setErr(null);
    const res = await updateIdentity(id, { name: form.name, kind: form.kind, handleBase: form.handleBase, email: form.email, displayName: form.displayName, bio: form.bio });
    setSaving(false);
    if (res.ok) { setD({ ...d, ...form }); setSaved(true); setTimeout(() => setSaved(false), 1800); }
    else setErr(res.error || 'save failed');
  };
  const inp: CSSProperties = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 8px', color: 'var(--fg-0)', fontFamily: 'var(--font-mono)', fontSize: 11.5, boxSizing: 'border-box' };
  const lbl: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' };
  const field = (key: keyof typeof form, label: string, opts?: { area?: boolean; mono?: boolean }) => (
    <div style={{ marginBottom: 9 }}>
      <label style={lbl}>{label}</label>
      {opts?.area
        ? <textarea value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.4 }} />
        : <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} autoComplete="off" style={inp} />}
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', marginBottom: 10 }}>
        <span>#{d.id}</span>
        {d.projectId && <span>· project <b style={{ color: 'var(--fg-2)' }}>{d.projectId}</b></span>
        }
        <span style={{ marginLeft: 'auto', color: d.hasPassword ? 'var(--ok)' : 'var(--fg-4)' }}>{d.hasPassword ? '🔒 password set' : '○ no password'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {field('name', 'name')}
        {field('kind', 'kind (user/bot…)')}
        {field('handleBase', 'handle base (@)')}
        {field('email', 'email')}
      </div>
      {field('displayName', 'display name (on-site)')}
      {field('bio', 'bio', { area: true })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 12 }}>
        <button onClick={save} disabled={!dirty || saving} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 6, cursor: !dirty || saving ? 'default' : 'pointer', border: '1px solid var(--accent)', color: dirty && !saving ? 'var(--bg-1)' : 'var(--fg-4)', background: dirty && !saving ? 'var(--accent)' : 'transparent', opacity: !dirty && !saving ? 0.6 : 1 }}>{saving ? 'saving…' : 'Save'}</button>
        {saved && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ok)' }}>✓ saved</span>}
        {dirty && !saving && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warn)' }}>● unsaved</span>}
        {err && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bad)' }}>{err}</span>}
        <a href="/identities" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>↗ full editor</a>
      </div>

      {/* persona + custom_fields = read-only JSON (canonical, dùng để fill profile on-site) */}
      <JsonBlock title="persona" data={d.persona} />
      <JsonBlock title="custom_fields (→ profile on-site, reuse mọi site)" data={d.customFields} />
    </div>
  );
}

function JsonBlock({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  const keys = data ? Object.keys(data) : [];
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{title}{keys.length ? ` · ${keys.length}` : ''}</div>
      {!keys.length
        ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)' }}>—</div>
        : (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {keys.map((k, i) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, padding: '4px 9px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                <span style={{ color: 'var(--fg-2)' }}>{k}</span>
                <span style={{ color: 'var(--fg-0)', wordBreak: 'break-word' }}>{typeof data![k] === 'object' ? JSON.stringify(data![k]) : String(data![k])}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// DOM sample LIST cho 1 platform — mở khi click cột DOM ở browse table. Unread (✉) lên đầu;
// click 1 sample → DomSampleDetail (mở = mark-read → ✉ của platform giảm + parse selector).
function DomSampleList({ platformKey, label }: { platformKey: string; label?: string }) {
  const openSub = useContext(SubCtx);
  const [rows, setRows] = useState<DomSampleRow[] | null>(null);
  useEffect(() => { let dead = false; listDomSamplesForPlatform(platformKey).then((r) => { if (!dead) setRows(r); }).catch(() => { if (!dead) setRows([]); }); return () => { dead = true; }; }, [platformKey]);
  if (!rows) return <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>loading DOM samples…</div>;
  if (!rows.length) return <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>Chưa có DOM sample nào cho <b style={{ color: 'var(--fg-1)' }}>{label || platformKey}</b>. Dùng ext capture trang để tạo.</div>;
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', margin: '0 4px 8px' }}>
        <b style={{ color: 'var(--fg-1)' }}>{rows.length}</b> sample · <span style={{ color: unread ? 'var(--warn)' : 'var(--ok)', fontWeight: 700 }}>{unread} chưa đọc</span> · mở 1 sample = đánh dấu đã đọc + parse selector
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 108px 50px 60px 60px', gap: 6, padding: '0 10px 4px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span /><span>title · fields tách được</span><span>page_kind</span><span style={{ textAlign: 'right' }}>size</span><span style={{ textAlign: 'right' }}>đọc</span><span style={{ textAlign: 'right' }}>chụp</span>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const ex = r.extract;
          return (
          <button key={r.id} onClick={() => openSub({ title: `#${r.id} · ${r.platformKey || r.hostname || ''}`, sub: 'extract preview · parse selector', body: <DomSampleDetail id={r.id} />, route: { t: 'dom', id: r.id } })}
            style={{ display: 'grid', gridTemplateColumns: '26px 1fr 108px 50px 60px 60px', gap: 6, alignItems: 'start', width: '100%', textAlign: 'left', border: 0, borderTop: i ? '1px solid var(--line)' : 0, padding: '7px 10px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')} onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 ? 'var(--bg-1)' : 'var(--bg-2)')}>
            <span style={{ color: r.readAt ? 'var(--fg-4)' : 'var(--warn)', fontWeight: r.readAt ? 400 : 700, paddingTop: 1 }} title={r.readAt ? 'đã đọc' : 'chưa đọc'}>{r.readAt ? '✓' : '✉'}</span>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={r.url || r.title || ''}><span style={{ color: 'var(--accent)', fontWeight: 700 }}>#{r.id}</span> {r.title || r.url || r.hostname || `sample #${r.id}`}</span>
              {ex ? (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3, fontSize: 9.5 }}>
                  {[...new Set([...(ex.selFields || []), ...(ex.inputs || [])])].slice(0, 10).map((f) => (
                    <span key={f} style={{ color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '0 4px' }}>{f}</span>
                  ))}
                </div>
              ) : <span style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>{r.readAt ? 'mở lại để tách fields' : 'chưa đọc — mở để tách fields'}</span>}
            </div>
            <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingTop: 1 }} title={r.pageKind}>{r.pageKind}</span>
            <span style={{ color: 'var(--fg-3)', textAlign: 'right', paddingTop: 1 }}>{(r.bytes / 1024).toFixed(0)}KB</span>
            <span style={{ color: r.readAt ? 'var(--fg-2)' : 'var(--fg-4)', textAlign: 'right', paddingTop: 1 }} title={r.readAt ? fmtFull(r.readAt) : 'chưa đọc'}>{r.readAt ? relAgo(r.readAt) : '—'}</span>
            <span style={{ color: 'var(--fg-3)', textAlign: 'right', paddingTop: 1 }} title={fmtFull(r.capturedAt)}>{relAgo(r.capturedAt)}</span>
          </button>
          );
        })}
      </div>
    </div>
  );
}

function DomSampleDetail({ id }: { id: number }) {
  const [d, setD] = useState<DomExtract | null | 'loading'>('loading');
  useEffect(() => { let dead = false; extractDomSample(id).then((r) => { if (!dead) setD(r ?? null); }); return () => { dead = true; }; }, [id]);
  if (d === 'loading') return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>extracting…</div>;
  if (!d) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>sample không tìm thấy.</div>;
  const empty = d.counts.users + d.counts.threads + d.counts.boards === 0;
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 4 }}>{d.pageKind} · {Math.round(d.bytes / 1024)}KB · {d.counts.anchors} links</div>
      {d.url && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', marginBottom: 4, wordBreak: 'break-all' }}>{d.url}</div>}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ color: '#b48cff' }}>◆ {d.counts.users} users</span>
        <span style={{ color: 'var(--accent)' }}>≡ {d.counts.threads} threads</span>
        <span style={{ color: 'var(--ok)' }}>▦ {d.counts.boards} boards</span>
        <span style={{ color: 'var(--fg-3)' }}>⌨ {d.counts.inputs} fields</span>
      </div>
      {/* PAGE SIGNALS — train platform/tech */}
      {(() => {
        const s = d.signals; const chip = (k: string, v: string | null, c?: string) => v ? <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: c || 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px' }}>{k}:<b style={{ color: c || 'var(--fg-0)' }}>{v}</b></span> : null;
        const authBtn = (label: string, url: string | null, c: string) => url ? <a key={label} href={url.startsWith('http') ? url : undefined} target="_blank" rel="noopener noreferrer" title={url} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '1px 7px', textDecoration: 'none', cursor: url.startsWith('http') ? 'pointer' : 'default' }}>{label} ↗</a> : null;
        return <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', margin: '6px 0', padding: '6px 8px', border: '1px solid var(--line)', borderLeft: '3px solid #b48cff', borderRadius: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '100%', marginBottom: 2 }}>page signals</span>
          {chip('engine', s.engine, '#b48cff')}{chip('style', s.styleName)}{chip('lang', s.lang, 'var(--accent)')}{chip('dir', s.dir)}{chip('charset', s.charset)}{chip('generator', s.generator)}{chip('viewport', s.viewport)}{chip('session', s.session)}
          {s.loggedIn != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: s.loggedIn ? 'var(--ok)' : 'var(--bad)', border: `1px solid ${s.loggedIn ? 'var(--ok)' : 'var(--bad)'}`, borderRadius: 4, padding: '1px 6px' }}>{s.loggedIn ? '● logged-in' : '○ logged-out'}</span>}
          {authBtn('login', s.loginUrl, 'var(--fg-2)')}{authBtn('register', s.registerUrl, 'var(--accent)')}{authBtn('logout', s.logoutUrl, 'var(--fg-2)')}
        </div>;
      })()}
      {d.breadcrumbs.length > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}>🧭 {d.breadcrumbs.join(' › ')}</div>}
      {(d.pagination.topics != null || d.pagination.totalPages != null) && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', marginBottom: 4 }}>{d.pagination.topics != null ? `${d.pagination.topics} topics` : ''}{d.pagination.totalPages != null ? ` · trang ${d.pagination.page}/${d.pagination.totalPages}` : ''}</div>}
      {empty && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>Không bắt được entity-link nào (trang này ít link user/thread, hoặc engine dùng pattern lạ). Xem class hooks dưới.</div>}
      <EntityGroup title="Users (handle · id/slug)" color="#b48cff" items={d.users} total={d.counts.users} fmt={(e) => e.label} />
      <EntityGroup title="Threads / posts (title · id)" color="var(--accent)" items={d.threads} total={d.counts.threads} fmt={(e) => e.label} />
      <EntityGroup title="Boards / sub-forums" color="var(--ok)" items={d.boards} total={d.counts.boards} fmt={(e) => e.label} />
      {/* FORM FIELDS — login/register/search/post controls */}
      {d.inputs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>form fields ({d.inputs.length}) · login/register/search/post</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {d.inputs.slice(0, 14).map((f, i) => (
              <div key={f.css + i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 8px', borderTop: i ? '1px solid var(--line)' : 'none', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>
                <span style={{ color: f.type === 'password' ? 'var(--bad)' : f.type === 'submit' || f.type === 'button' ? 'var(--accent)' : 'var(--fg-2)', minWidth: 62 }}>{f.tag}:{f.type}</span>
                <span style={{ color: 'var(--fg-0)', minWidth: 90 }}>{f.label}</span>
                <span style={{ color: 'var(--fg-4)', flex: 1, wordBreak: 'break-all', textAlign: 'right' }}>{f.css}</span>
              </div>
            ))}
            {d.inputs.length > 14 && <div style={{ padding: '3px 8px', borderTop: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', background: 'var(--bg-2)' }}>+{d.inputs.length - 14} field nữa…</div>}
          </div>
        </div>
      )}
      {/* BLOCKS — menu state / panel titles */}
      {d.blocks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>blocks / menu state ({d.blocks.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {d.blocks.map((b, i) => <span key={b + i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px' }}>{b}</span>)}
          </div>
        </div>
      )}
      {d.classHooks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>class hooks (gợi ý selector custom)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {d.classHooks.map((c) => <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px' }}>.{c}</span>)}
          </div>
        </div>
      )}
      <SeedPanel id={d.id} proposals={d.seedSelectors} platformKey={d.platformKey} technologyKey={d.technologyKey} />
      {/* GAPS — capture-next guidance to complete the template */}
      {d.gaps.length > 0 && (
        <div style={{ marginTop: 12, border: '1px solid var(--warn,#ffb03c)', borderRadius: 6, padding: '8px 10px', background: 'color-mix(in srgb, var(--warn,#ffb03c) 8%, transparent)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--warn,#ffb03c)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>⚠ cần capture thêm để train đủ</div>
          {d.gaps.map((g, i) => <div key={i} style={{ fontSize: 11, color: 'var(--fg-1)', marginBottom: 3, lineHeight: 1.4 }}>• {g}</div>)}
        </div>
      )}
    </div>
  );
}

// ── DOM sample library (ext capture) — list + delete ────────────────────────
function DomSamplesPanel() {
  const openSub = useContext(SubCtx);
  const [rows, setRows] = useState<DomSampleRow[] | null>(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => { let dead = false; listDomSamples().then((r) => { if (!dead) setRows(r); }); return () => { dead = true; }; }, []);
  useEffect(() => load(), [load]);
  // Destructive = XÁC NHẬN 2 bước INLINE (bấm 🗑 → "Xoá? / Huỷ" → bấm Xoá mới xoá thật).
  // Confirm TRƯỚC, không hard-delete ngay, không native dialog (feedback_destructive_actions).
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const doDelete = useCallback((row: DomSampleRow) => {
    setConfirmId(null);
    setRows((prev) => (prev ? prev.filter((x) => x.id !== row.id) : prev));
    deleteDomSample(row.id).catch(() => { /* */ });
  }, []);
  // confirm tự huỷ sau 4s (tránh kẹt trạng thái Xoá?/Huỷ — pattern đã chốt).
  useEffect(() => { if (confirmId == null) return; const t = setTimeout(() => setConfirmId(null), 4000); return () => clearTimeout(t); }, [confirmId]);
  if (rows == null) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>loading samples…</div>;
  const ql = q.trim().toLowerCase();
  const view = ql ? rows.filter((r) => `${r.hostname} ${r.platformKey} ${r.technologyKey} ${r.pageKind} ${r.url}`.toLowerCase().includes(ql)) : rows;
  const kb = (b: number) => (b >= 1024 ? Math.round(b / 1024) + 'KB' : b + 'B');
  // gom theo SITE (platform/host) — mỗi sample luôn thuộc 1 site cụ thể
  const groups: Array<{ key: string; tech: string | null; items: DomSampleRow[] }> = [];
  for (const r of view) {
    const gk = r.platformKey || r.hostname || '?';
    let g = groups.find((x) => x.key === gk);
    if (!g) { g = { key: gk, tech: r.technologyKey, items: [] }; groups.push(g); }
    if (!g.tech && r.technologyKey) g.tech = r.technologyKey;
    g.items.push(r);
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="lọc host / platform / page_kind…" autoComplete="off"
          style={{ flex: 1, boxSizing: 'border-box', padding: '5px 9px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{view.length} sample{view.length !== 1 ? 's' : ''}</span>
        <button onClick={load} title="Tải lại" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-1)', cursor: 'pointer', width: 26, height: 26, fontSize: 13 }}>↻</button>
      </div>
      {groups.length === 0 ? <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có DOM sample nào (bấm 🤖 → 💾 Lưu HTML trên 1 trang forum).</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g) => (
            <div key={g.key} style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${g.tech ? '#b48cff' : 'var(--accent)'}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', flexWrap: 'wrap' }}>
                <EntityLink scope="platform" ek={g.key} tech={g.tech} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }} />
                {g.tech ? <EntityLink scope="technology" ek={g.tech} label={`◆ ${g.tech}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#b48cff' }} /> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>engine custom (no tech)</span>}
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{g.items.length} sample{g.items.length !== 1 ? 's' : ''}</span>
              </div>
              {g.items.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: '1px solid var(--line)', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)', minWidth: 28 }}>#{r.id}</span>
                  <div onClick={() => openSub({ title: `#${r.id} · ${r.platformKey || r.hostname || ''}`, sub: 'extract preview · kiểm soát trước khi seed', body: <DomSampleDetail id={r.id} />, route: { t: 'dom', id: r.id } })}
                    style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} title="Bấm xem chi tiết extract được">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{r.pageKind}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{kb(r.bytes)} · {new Date(r.capturedAt).toLocaleString()}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>↗ extract</span>
                    </div>
                    {r.url && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</div>}
                  </div>
                  {confirmId === r.id ? (
                    <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => doDelete(r)} title="Xác nhận xoá vĩnh viễn sample này"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--bad)', color: 'var(--bg-1)', background: 'var(--bad)', whiteSpace: 'nowrap' }}>⚠ XOÁ</button>
                      <button onClick={() => setConfirmId(null)} title="Huỷ"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', color: 'var(--fg-2)', background: 'transparent', whiteSpace: 'nowrap' }}>✗</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmId(r.id)} title="Xoá sample (cần xác nhận)"
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--bad)'; e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-4)'; e.currentTarget.style.opacity = '0.5'; }}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', border: 'none', color: 'var(--fg-4)', background: 'transparent', whiteSpace: 'nowrap', flexShrink: 0, opacity: 0.5 }}>🗑</button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
