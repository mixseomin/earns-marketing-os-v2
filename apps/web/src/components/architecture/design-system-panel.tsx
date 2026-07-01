'use client';

import { useState, useEffect } from 'react';
import {
  Pill, PriorityPill, EffortPill, StatusPill, StatusFlag, LinkChip,
  Segmented, StatusSegmented, ViewToggle, MultiSelect, LIST_CALENDAR_VIEWS,
  Spinner, EmptyState, InfoHint, ConfirmDeleteButton, CTACard,
  Section, Collapsible, StatsStrip, ModalHeader,
  IconGear, IconUser, IconList, IconCheck, IconBan, IconGlobe, IconClock,
  IconSparkles, IconSliders, IconChevron, IconWarn, IconSwap, IconPencil,
  IconTrash, IconLock, IconInfo, IconX, IconUndo, IconFilePlus, IconDots,
} from '@/components/ui';
import ADOPTION from './ui-adoption.json';

// DESIGN SYSTEM — tokens + primitive (@/components/ui) làm 1 nguồn nhìn-thấy + governance.
// 4 lớp: (1) design tokens, (2) variant matrix + props/API, (3) copy snippet + search, (4) adoption count.
const USES = ADOPTION as Record<string, number>;

// ── design tokens ────────────────────────────────────────────────────────────
const TOKEN_GROUPS: { group: string; vars: string[] }[] = [
  { group: 'Background', vars: ['--bg-0', '--bg-1', '--bg-2', '--bg-3', '--bg-4'] },
  { group: 'Foreground', vars: ['--fg-0', '--fg-1', '--fg-2', '--fg-3', '--fg-4'] },
  { group: 'Accent', vars: ['--accent', '--accent-soft', '--accent-line'] },
  { group: 'Semantic', vars: ['--ok', '--bad', '--warn', '--info'] },
  { group: 'Neon (base)', vars: ['--neon-blue', '--neon-cyan', '--neon-lime', '--neon-amber', '--neon-red', '--neon-pink', '--neon-violet'] },
  { group: 'Line', vars: ['--line', '--line-2', '--line-strong'] },
];
const RADII = ['--r-sm', '--r-md', '--r-lg', '--r-xl'];
const SPACING = ['--s-1', '--s-2', '--s-3', '--s-4', '--s-5'];
const FONTS = ['--font-mono', '--font-display', '--font-sans'];

function useComputedVars(names: string[]): Record<string, string> {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const out: Record<string, string> = {};
    for (const n of names) out[n] = cs.getPropertyValue(n).trim();
    setVals(out);
  }, [names.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps
  return vals;
}

function TokensSection() {
  const allColor = TOKEN_GROUPS.flatMap((g) => g.vars);
  const vals = useComputedVars([...allColor, ...RADII, ...SPACING, ...FONTS]);
  const copy = (t: string) => { try { navigator.clipboard?.writeText(t); } catch { /* noop */ } };
  return (
    <div style={{ marginBottom: 22, maxWidth: 980 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 7 }}>🎨 Design tokens · globals.css</div>
      {TOKEN_GROUPS.map((g) => (
        <div key={g.group} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{g.group}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {g.vars.map((v) => (
              <button key={v} onClick={() => copy(`var(${v})`)} title={`click copy var(${v}) · ${vals[v] || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px 4px 4px', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 7, cursor: 'pointer' }}>
                <span style={{ width: 26, height: 26, borderRadius: 5, background: `var(${v})`, border: '1px solid var(--line-strong)', flexShrink: 0 }} />
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-1)', fontWeight: 700 }}>{v}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>{vals[v] || '—'}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 6 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', marginBottom: 4 }}>Radius</div>
          <div style={{ display: 'flex', gap: 8 }}>{RADII.map((r) => (
            <div key={r} style={{ textAlign: 'center' }}><div style={{ width: 34, height: 34, background: 'var(--bg-3)', border: '1px solid var(--line-strong)', borderRadius: `var(${r})` }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>{r.replace('--r-', '')} {vals[r]}</span></div>
          ))}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', marginBottom: 4 }}>Spacing</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>{SPACING.map((s) => (
            <div key={s} style={{ textAlign: 'center' }}><div style={{ width: `var(${s})`, height: `var(${s})`, background: 'var(--accent)', borderRadius: 2 }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>{vals[s]}</span></div>
          ))}</div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {FONTS.map((f) => (
          <div key={f} style={{ fontFamily: `var(${f})`, fontSize: 15, color: 'var(--fg-0)', marginBottom: 2 }}>{f} · The quick brown fox 0123 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-4)' }}>{(vals[f] || '').split(',')[0]}</span></div>
        ))}
      </div>
    </div>
  );
}

// ── copy snippet ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { try { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* noop */ } }}
      title="Copy JSX" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: done ? 'var(--ok)' : 'var(--fg-3)', cursor: 'pointer' }}>
      {done ? '✓ copied' : '⧉ copy'}
    </button>
  );
}

// ── component registry (variant matrix + props + snippet + adoption) ───────────
type Prop = { n: string; t: string; d?: string; req?: boolean };
type Comp = { name: string; file: string; props: Prop[]; snippet: string; render: () => React.ReactNode };

function AdoptionBadge({ name }: { name: string }) {
  const n = USES[name] ?? 0;
  return <span title={`${n} file dùng <${name}> (build-time)`} style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, color: n === 0 ? 'var(--warn)' : 'var(--ok)', background: n === 0 ? 'color-mix(in srgb, var(--warn) 14%, transparent)' : 'color-mix(in srgb, var(--ok) 12%, transparent)', border: `1px solid ${n === 0 ? 'color-mix(in srgb, var(--warn) 40%, transparent)' : 'color-mix(in srgb, var(--ok) 35%, transparent)'}` }}>{n === 0 ? '⚠ 0 dùng' : `${n} dùng`}</span>;
}

function PropsTable({ props }: { props: Prop[] }) {
  if (!props.length) return null;
  return (
    <details style={{ marginTop: 6 }}>
      <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)', cursor: 'pointer', userSelect: 'none' }}>props · {props.length}</summary>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          {props.map((p) => (
            <tr key={p.n} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-1)', fontWeight: 700, whiteSpace: 'nowrap' }}>{p.n}{p.req ? <span style={{ color: 'var(--bad)' }}>*</span> : ''}</td>
              <td style={{ padding: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>{p.t}</td>
              <td style={{ padding: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>{p.d ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// Small stateful demo wrappers so interactive primitives render live.
function SegDemo() { const [v, setV] = useState<'a' | 'b' | 'c'>('a'); return <Segmented options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} value={v} onChange={setV} />; }
function StatusSegDemo() { const [v, setV] = useState('draft'); return <StatusSegmented options={[{ value: 'draft', label: 'Draft', color: 'var(--fg-3)' }, { value: 'live', label: 'Live', color: 'var(--ok)' }, { value: 'paused', label: 'Paused', color: 'var(--warn)' }]} value={v} onChange={setV} />; }
function ViewToggleDemo() { const [v, setV] = useState('list'); return <ViewToggle options={LIST_CALENDAR_VIEWS} value={v} onChange={setV} />; }
function MultiDemo() { const [v, setV] = useState<string[]>(['x']); return <MultiSelect label="Platform" options={[{ value: 'x', label: 'X' }, { value: 'reddit', label: 'Reddit' }, { value: 'devto', label: 'dev.to' }]} selected={v} onChange={setV} variant="chip" />; }

const COMPONENTS: Comp[] = [
  { name: 'Pill', file: 'pill.tsx', props: [{ n: 'color', t: 'string', req: true }, { n: 'label', t: 'ReactNode', req: true }, { n: 'icon', t: 'ReactNode' }, { n: 'tone', t: "'soft'|'solid'", d: 'soft' }, { n: 'size', t: "'xs'|'sm'|'md'", d: 'sm' }, { n: 'onClick', t: '() => void' }], snippet: `<Pill color="var(--accent)" label="Label" tone="soft" />`, render: () => <><Pill color="var(--accent)" label="soft" /><Pill color="var(--ok)" label="solid" tone="solid" /><Pill color="var(--warn)" label="md" size="md" /><Pill color="var(--bad)" label="xs" size="xs" /></> },
  { name: 'PriorityPill', file: 'pill.tsx', props: [{ n: 'priority', t: "'critical'|'high'|'medium'|'low'", req: true }, { n: 'size', t: 'PillSize', d: 'xs' }], snippet: `<PriorityPill priority="high" />`, render: () => <><PriorityPill priority="critical" /><PriorityPill priority="high" /><PriorityPill priority="medium" /><PriorityPill priority="low" /></> },
  { name: 'EffortPill', file: 'pill.tsx', props: [{ n: 'effort', t: "'XS'|'S'|'M'|'L'|'XL'", req: true }], snippet: `<EffortPill effort="M" />`, render: () => <><EffortPill effort="XS" /><EffortPill effort="S" /><EffortPill effort="M" /><EffortPill effort="L" /><EffortPill effort="XL" /></> },
  { name: 'StatusPill', file: 'pill.tsx', props: [{ n: 'meta', t: '{icon,label,color}', req: true }, { n: 'size', t: 'PillSize', d: 'xs' }], snippet: `<StatusPill meta={{ icon: '●', label: 'Warm', color: 'var(--ok)' }} />`, render: () => <><StatusPill meta={{ icon: '●', label: 'Warm', color: 'var(--ok)' }} /><StatusPill meta={{ icon: '◐', label: 'Engaging', color: 'var(--accent)' }} /></> },
  { name: 'StatusFlag', file: 'status-flag.tsx', props: [{ n: 'icon', t: 'string', req: true }, { n: 'tone', t: "'bad'|'warn'|'ok'|'info'", d: 'bad' }, { n: 'size', t: "'icon'|'label'", d: 'icon' }, { n: 'label', t: 'string' }, { n: 'title', t: 'string' }], snippet: `<StatusFlag icon="🚫" tone="bad" title="blocked" />`, render: () => <><StatusFlag icon="🚫" tone="bad" title="bad" /><StatusFlag icon="⚠" tone="warn" title="warn" /><StatusFlag icon="✓" tone="ok" title="ok" /><StatusFlag icon="🤖" tone="info" title="info" /><StatusFlag icon="✓" tone="ok" size="label" label="OK" /></> },
  { name: 'LinkChip', file: 'link-chip.tsx', props: [{ n: 'href', t: 'string', req: true }, { n: 'children', t: 'ReactNode', req: true }, { n: 'tone', t: "'accent'|'neutral'|'success'|'warn'|'danger'" }, { n: 'size', t: "'xs'|'sm'" }], snippet: `<LinkChip href="#" tone="accent">label</LinkChip>`, render: () => <><LinkChip href="#" tone="accent">accent</LinkChip><LinkChip href="#" tone="neutral">neutral</LinkChip><LinkChip href="#" tone="success">success</LinkChip><LinkChip href="#" tone="warn">warn</LinkChip><LinkChip href="#" tone="danger">danger</LinkChip></> },
  { name: 'Segmented', file: 'segmented.tsx', props: [{ n: 'options', t: '{value,label}[]', req: true }, { n: 'value', t: 'T', req: true }, { n: 'onChange', t: '(v)=>void', req: true }, { n: 'size', t: "'xs'|'sm'" }], snippet: `<Segmented options={opts} value={v} onChange={setV} />`, render: () => <SegDemo /> },
  { name: 'StatusSegmented', file: 'status-segmented.tsx', props: [{ n: 'options', t: '{value,label,color}[]', req: true }, { n: 'value', t: 'string', req: true }, { n: 'onChange', t: '(v)=>void', req: true }], snippet: `<StatusSegmented options={opts} value={v} onChange={setV} />`, render: () => <StatusSegDemo /> },
  { name: 'ViewToggle', file: 'view-toggle.tsx', props: [{ n: 'options', t: 'ViewOption[]', req: true }, { n: 'value', t: 'string', req: true }, { n: 'onChange', t: '(v)=>void', req: true }], snippet: `<ViewToggle options={LIST_CALENDAR_VIEWS} value={v} onChange={setV} />`, render: () => <ViewToggleDemo /> },
  { name: 'MultiSelect', file: 'multi-select.tsx', props: [{ n: 'label', t: 'string', req: true }, { n: 'options', t: '{value,label}[]', req: true }, { n: 'selected', t: 'T[]', req: true }, { n: 'onChange', t: '(v[])=>void', req: true }, { n: 'variant', t: "'default'|'chip'" }], snippet: `<MultiSelect label="Platform" options={opts} selected={v} onChange={setV} variant="chip" />`, render: () => <MultiDemo /> },
  { name: 'Spinner', file: 'spinner.tsx', props: [{ n: 'size', t: "'xs'|'sm'|'md'" }, { n: 'color', t: 'string' }, { n: 'label', t: 'string' }], snippet: `<Spinner size="md" label="loading" />`, render: () => <><Spinner size="xs" /><Spinner size="sm" /><Spinner size="md" label="loading" /></> },
  { name: 'InfoHint', file: 'info-hint.tsx', props: [{ n: 'children', t: 'ReactNode', req: true }, { n: 'label', t: 'string' }, { n: 'size', t: 'number' }], snippet: `<InfoHint label="giải thích">nội dung hint</InfoHint>`, render: () => <span style={{ color: 'var(--fg-1)', fontSize: 12 }}>Field <InfoHint label="hint">Giải thích khi hover.</InfoHint></span> },
  { name: 'ConfirmDeleteButton', file: 'confirm-delete-button.tsx', props: [{ n: 'onDelete', t: '() => void', req: true }, { n: 'labelIdle', t: 'ReactNode' }, { n: 'windowMs', t: 'number' }], snippet: `<ConfirmDeleteButton onDelete={handleDelete} />`, render: () => <ConfirmDeleteButton onDelete={() => { /* demo */ }} /> },
  { name: 'CTACard', file: 'cta-card.tsx', props: [{ n: 'href', t: 'string', req: true }, { n: 'title', t: 'ReactNode', req: true }, { n: 'subtitle', t: 'ReactNode' }, { n: 'tone', t: "'accent'|'success'|'warn'|'danger'" }], snippet: `<CTACard href="#" title="Mở" subtitle="đi tới" tone="accent" />`, render: () => <div style={{ width: '100%', display: 'grid', gap: 6 }}><CTACard href="#" title="Accent" subtitle="đi tới trang" tone="accent" /><CTACard href="#" title="Success" tone="success" /></div> },
  { name: 'EmptyState', file: 'empty-state.tsx', props: [{ n: 'icon', t: 'ReactNode', req: true }, { n: 'title', t: 'ReactNode', req: true }, { n: 'description', t: 'ReactNode' }, { n: 'action', t: 'ReactNode' }, { n: 'compact', t: 'boolean' }], snippet: `<EmptyState icon="📭" title="Chưa có gì" compact />`, render: () => <EmptyState icon="📭" title="Chưa có gì" description="thêm item đầu tiên" compact /> },
  { name: 'StatsStrip', file: 'stats-strip.tsx', props: [{ n: 'cards', t: 'StatCard[]', req: true }, { n: 'columns', t: 'number' }], snippet: `<StatsStrip cards={cards} />`, render: () => <div style={{ width: '100%' }}><StatsStrip cards={[{ key: 'p', label: 'Pass', value: 12, color: 'var(--ok)' }, { key: 'f', label: 'Fail', value: 3, color: 'var(--bad)' }, { key: 'w', label: 'Warn', value: 5, color: 'var(--warn)' }]} /></div> },
  { name: 'Section', file: 'section.tsx', props: [{ n: 'title', t: 'ReactNode', req: true }, { n: 'children', t: 'ReactNode', req: true }, { n: 'subtitle', t: 'ReactNode' }, { n: 'accent', t: 'string' }, { n: 'defaultOpen', t: 'boolean' }], snippet: `<Section title="Title" subtitle="sub" defaultOpen>…</Section>`, render: () => <div style={{ width: '100%' }}><Section title="Section" subtitle="mô tả" accent="var(--accent)" defaultOpen><span style={{ fontSize: 12, color: 'var(--fg-2)' }}>body</span></Section></div> },
  { name: 'Collapsible', file: 'collapsible.tsx', props: [{ n: 'title', t: 'ReactNode', req: true }, { n: 'children', t: 'ReactNode', req: true }, { n: 'badge', t: 'ReactNode' }, { n: 'defaultOpen', t: 'boolean' }], snippet: `<Collapsible title="Title" badge={badge}>…</Collapsible>`, render: () => <div style={{ width: '100%' }}><Collapsible title="Collapsible" badge={<Pill color="var(--accent)" label="3" size="xs" />}><span style={{ fontSize: 12, color: 'var(--fg-2)' }}>nội dung</span></Collapsible></div> },
  { name: 'ModalHeader', file: 'modal-header.tsx', props: [{ n: 'kind', t: 'ModalKind', req: true }, { n: 'action', t: "'edit'|'create'|'view'", req: true }, { n: 'title', t: 'ReactNode', req: true }, { n: 'onClose', t: '() => void', req: true }, { n: 'idText', t: 'string' }], snippet: `<ModalHeader kind="account" action="edit" title="Title" onClose={close} />`, render: () => <div style={{ width: '100%' }}><ModalHeader kind="account" action="edit" title="Tiêu đề" idText="#14" subtitle="platform · habitat" onClose={() => { /* demo */ }} /></div> },
];

const ICONS: [string, React.ReactNode][] = [
  ['Gear', <IconGear key="g" size={16} title="Gear" />], ['User', <IconUser key="u" size={16} title="User" />],
  ['List', <IconList key="l" size={16} title="List" />], ['Check', <IconCheck key="c" size={16} title="Check" />],
  ['Ban', <IconBan key="b" size={16} title="Ban" />], ['Globe', <IconGlobe key="gl" size={16} title="Globe" />],
  ['Clock', <IconClock key="ck" size={16} title="Clock" />], ['Sparkles', <IconSparkles key="s" size={16} title="Sparkles" />],
  ['Sliders', <IconSliders key="sl" size={16} title="Sliders" />], ['Chevron', <IconChevron key="cv" size={16} title="Chevron" />],
  ['Warn', <IconWarn key="w" size={16} title="Warn" />], ['Swap', <IconSwap key="sw" size={16} title="Swap" />],
  ['Pencil', <IconPencil key="p" size={16} title="Pencil" />], ['Trash', <IconTrash key="t" size={16} title="Trash" />],
  ['Lock', <IconLock key="lk" size={16} title="Lock" />], ['Info', <IconInfo key="i" size={16} title="Info" />],
  ['X', <IconX key="x" size={16} title="X" />], ['Undo', <IconUndo key="ud" size={16} title="Undo" />],
  ['FilePlus', <IconFilePlus key="fp" size={16} title="FilePlus" />], ['Dots', <IconDots key="d" size={16} title="Dots" />],
];

function CompCard({ c }: { c: Comp }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-1)' }}>
      <div style={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, padding: '14px 12px', borderBottom: '1px solid var(--line)' }}>{c.render()}</div>
      <div style={{ padding: '7px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>{c.name}</span>
          <AdoptionBadge name={c.name} />
          <span style={{ flex: 1 }} />
          <CopyBtn text={c.snippet} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)', marginTop: 2 }}>ui/{c.file}</div>
        <PropsTable props={c.props} />
      </div>
    </div>
  );
}

export function DesignSystemPanel() {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const shown = ql ? COMPONENTS.filter((c) => c.name.toLowerCase().includes(ql)) : COMPONENTS;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, maxWidth: 980, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5, flex: 1, minWidth: 260 }}>
          Tokens + primitive <code style={{ fontFamily: 'var(--font-mono)' }}>@/components/ui</code>. Dựng feature mới thì <b style={{ color: 'var(--accent)' }}>tái dùng</b>, đừng bespoke. Badge <b style={{ color: 'var(--ok)' }}>N dùng</b> = số file import (build-time) · <b style={{ color: 'var(--warn)' }}>⚠ 0</b> = orphan.
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 lọc primitive…" autoComplete="off" style={{ background: 'var(--bg-0)', color: 'var(--fg-0)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, width: 180 }} />
      </div>

      {!ql && <TokensSection />}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 7 }}>🧱 Primitives · {shown.length}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 10, maxWidth: 980, marginBottom: 20 }}>
        {shown.map((c) => <CompCard key={c.name} c={c} />)}
      </div>

      {!ql && (
        <div style={{ maxWidth: 980 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 7 }}>🔣 Icons · icons.tsx</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ICONS.map(([n, el]) => (
              <div key={n} title={`${n} · ${USES['Icon' + n] ?? 0} dùng`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 62, padding: '8px 4px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)', color: 'var(--fg-1)' }}>
                {el}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--fg-4)' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
