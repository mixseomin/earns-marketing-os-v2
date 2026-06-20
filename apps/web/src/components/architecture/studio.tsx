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
import {
  GROUPS, OBJECTS, OBJ_BY_KEY, FLOWS, FLOW_BY_KEY,
  type ArchObject, type ArchFlow, type RelKind,
} from './spec';
import { Drawer } from '@/components/drawer';
import {
  listInstances, getInstance, systemScan, listSelectors, resolveBoundLabels, selectorCatalog, getSelectorRow, extActivity, metricCoverage,
  templateAdoption, listDomSamples, deleteDomSample, extractDomSample,
  type InstanceRef, type Issue, type ScanResult, type SelRow, type SelCatRow, type SelDetail, type ExtActivity, type ExtCall,
  type MetricCoverage, type MetricCell, type TemplateAdoptionData, type DomSampleRow, type DomExtract, type ExtractedEntity,
} from '@/lib/actions/architecture';
import { adoptTemplate } from '@/lib/actions/platforms';

type ViewKey = 'objects' | 'onpage' | 'backend' | 'live';
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
                            if (state === 'trained' && c.selId) openSub({ title: c.field, sub: `${c.scope} · ${c.scopeKey} · @ post-metrics`, body: <SelectorDetail id={c.selId} /> });
                            else if (state === 'gap' || state === 'api') openSub({ title: `Train ${m.metric} · ${p.key}`, sub: 'hướng dẫn bắt số từ DOM', body: <MetricTrainGuide metric={m.metric} platform={p.key} via={c.via || 'text'} /> });
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
                          onClick={() => openSub({ title: s.fieldName, sub: `${obj.key} · ${picked} · @ ${s.pageKind}`, body: <SelectorDetail id={s.id} /> })}
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
      if (tab && ['objects', 'onpage', 'backend', 'live'].includes(tab)) setView(tab as ViewKey);
      const obj = sp.get('obj'); const flow = sp.get('flow'); const step = sp.get('step');
      if (obj && OBJ_BY_KEY[obj]) setSel({ kind: 'object', key: obj });
      else if (flow && step && FLOW_BY_KEY[flow]) setSel({ kind: 'flow', flow, step });
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
      const qs = sp.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } catch { /* */ }
  }, [view, sel]);
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
            <button key={s.id} onClick={() => openSub({ title: s.fieldName, sub: `${s.scopeKind} · ${s.scopeKey} · @ ${pk}`, body: <SelectorDetail id={s.id} /> })}
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
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ color: 'var(--fg-2)' }}>scope <b>{scope}</b>=<b style={{ color: scope === 'technology' ? '#b48cff' : 'var(--accent)' }}>{scopeKey}</b></span>
        <span style={{ color: 'var(--fg-4)' }}>{own.length} own{inh.length ? ` · ${inh.length} kế thừa` : ''} · {mine.length} DOM sample</span>
      </div>
      {own.length === 0 && inh.length === 0 && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Chưa có selector. Train trên site / seed từ DOM sample → field hiện ở đây.</div>}
      {own.length > 0 && <>{hdr('selectors (scope này)', 'var(--fg-4)')}<SelByPageKind rows={own} /></>}
      {inh.length > 0 && <>{hdr(`kế thừa từ technology ${technologyKey}`, '#b48cff')}<SelByPageKind rows={inh} /></>}
      {mine.length > 0 && <>
        {hdr('DOM samples', 'var(--fg-4)')}
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          {mine.map((s, i) => (
            <button key={s.id} onClick={() => openSub({ title: `#${s.id} · ${s.platformKey || s.hostname || ''}`, sub: 'extract preview', body: <DomSampleDetail id={s.id} /> })}
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
function TemplateAdoptionPanel() {
  const openSub = useContext(SubCtx);
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
            <button onClick={() => openSub({ title: t.label, sub: `technology · ${t.key} · selectors + samples`, body: <EntityScopeDrawer scope="technology" scopeKey={t.key} /> })} title="Mở drawer technology này (fields/selectors + samples)"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: techGreen, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{t.label} ↗</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>pack: {packLabel(t.selectorCounts)}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>{t.bound.length} bound</span>
          </div>
          {t.bound.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {t.bound.map((b) => (
                <button key={b.key} onClick={() => openSub({ title: b.label, sub: `platform · ${b.key} · bound ${t.key}`, body: <EntityScopeDrawer scope="platform" scopeKey={b.key} technologyKey={t.key} /> })}
                  title={`own: signup ${b.ownSignup} · composer ${b.ownComposer} · bấm xem drawer platform`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ok)', border: '1px solid var(--ok)', borderRadius: 999, padding: '1px 8px', background: 'none', cursor: 'pointer' }}>✓ {b.label} ↗</button>
              ))}
            </div>
          )}
          {t.candidates.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>detected — adopt to inherit pack</div>
              {t.candidates.map((c) => (
                <div key={c.host} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-1)' }}>{c.host}</span>
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
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
  if (total === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color, marginBottom: 5 }}>{title} · {total}{total > items.length ? ` (hiện ${items.length})` : ''}</div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
        {items.map((e, i) => (
          <div key={e.key + i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 9px', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', minWidth: 60, flexShrink: 0 }}>{e.key}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-0)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fmt(e) + (e.url ? '\n' + e.url : '')}>{fmt(e)}</span>
          </div>
        ))}
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
      </div>
      {empty && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>Không bắt được entity-link nào (trang này ít link user/thread, hoặc engine dùng pattern lạ). Xem class hooks dưới.</div>}
      <EntityGroup title="Users (handle · id/slug)" color="#b48cff" items={d.users} total={d.counts.users} fmt={(e) => e.label} />
      <EntityGroup title="Threads / posts (title · id)" color="var(--accent)" items={d.threads} total={d.counts.threads} fmt={(e) => e.label} />
      <EntityGroup title="Boards / sub-forums" color="var(--ok)" items={d.boards} total={d.counts.boards} fmt={(e) => e.label} />
      {d.classHooks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>class hooks (gợi ý selector custom)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {d.classHooks.map((c) => <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px' }}>.{c}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DOM sample library (ext capture) — list + delete ────────────────────────
function DomSamplesPanel() {
  const openSub = useContext(SubCtx);
  const [rows, setRows] = useState<DomSampleRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => { let dead = false; listDomSamples().then((r) => { if (!dead) setRows(r); }); return () => { dead = true; }; }, []);
  useEffect(() => load(), [load]);
  const del = useCallback(async (id: number) => {
    setBusy(id);
    await deleteDomSample(id);
    setRows((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    setBusy(null);
  }, []);
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
                <button onClick={() => openSub({ title: g.key, sub: `platform · selectors + samples`, body: <EntityScopeDrawer scope="platform" scopeKey={g.key} technologyKey={g.tech} /> })} title="Mở drawer platform này"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-0)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{g.key} ↗</button>
                {g.tech ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#b48cff' }}>◆ {g.tech}</span> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>engine custom (no tech)</span>}
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{g.items.length} sample{g.items.length !== 1 ? 's' : ''}</span>
              </div>
              {g.items.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: '1px solid var(--line)', background: i % 2 ? 'var(--bg-1)' : 'var(--bg-2)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)', minWidth: 28 }}>#{r.id}</span>
                  <div onClick={() => openSub({ title: `#${r.id} · ${r.platformKey || r.hostname || ''}`, sub: 'extract preview · kiểm soát trước khi seed', body: <DomSampleDetail id={r.id} /> })}
                    style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} title="Bấm xem chi tiết extract được">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{r.pageKind}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{kb(r.bytes)} · {new Date(r.capturedAt).toLocaleString()}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>↗ extract</span>
                    </div>
                    {r.url && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</div>}
                  </div>
                  <button disabled={busy === r.id} onClick={() => del(r.id)} title="Xoá sample này"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--bad)', color: busy === r.id ? 'var(--fg-4)' : 'var(--bad)', background: 'transparent', whiteSpace: 'nowrap' }}>
                    {busy === r.id ? '…' : '🗑'}
                  </button>
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
