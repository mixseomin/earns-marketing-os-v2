'use client';

import { useState } from 'react';
import {
  Pill, PriorityPill, EffortPill, StatusPill, StatusFlag, LinkChip,
  Segmented, StatusSegmented, ViewToggle, MultiSelect, LIST_CALENDAR_VIEWS,
  Spinner, EmptyState, InfoHint, ConfirmDeleteButton, CTACard,
  Section, Collapsible, StatsStrip, ModalHeader,
  IconGear, IconUser, IconList, IconCheck, IconBan, IconGlobe, IconClock,
  IconSparkles, IconSliders, IconChevron, IconWarn, IconSwap, IconPencil,
  IconTrash, IconLock, IconInfo, IconX, IconUndo, IconFilePlus, IconDots,
} from '@/components/ui';

// DESIGN SYSTEM · gallery primitive dùng-chung (@/components/ui). 1 nguồn nhìn thấy được:
// dựng UI mới → tái dùng primitive ở đây, không bespoke. Preview LIVE (không chỉ mô tả).

function Cell({ name, file, children }: { name: string; file: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-1)' }}>
      <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, padding: '14px 12px', borderBottom: '1px solid var(--line)' }}>
        {children}
      </div>
      <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--fg-0)' }}>{name}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-4)' }}>{file}</span>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20, maxWidth: 980 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 7 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>{children}</div>
    </div>
  );
}

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

export function DesignSystemPanel() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [st, setSt] = useState('draft');
  const [vw, setVw] = useState('list');
  const [ms, setMs] = useState<string[]>(['x']);

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginBottom: 14, maxWidth: 760, lineHeight: 1.5 }}>
        Primitive dùng-chung — <code style={{ fontFamily: 'var(--font-mono)' }}>@/components/ui</code>. Dựng feature mới thì <b style={{ color: 'var(--accent)' }}>tái dùng</b> từ đây, đừng bespoke.
      </div>

      <Group title="Pills & Badges">
        <Cell name="Pill" file="pill.tsx"><Pill color="var(--accent)" label="Label" /><Pill color="var(--ok)" label="Live" tone="solid" /></Cell>
        <Cell name="PriorityPill" file="pill.tsx"><PriorityPill priority="critical" /><PriorityPill priority="high" /><PriorityPill priority="low" /></Cell>
        <Cell name="EffortPill" file="pill.tsx"><EffortPill effort="XS" /><EffortPill effort="M" /><EffortPill effort="XL" /></Cell>
        <Cell name="StatusPill" file="pill.tsx"><StatusPill meta={{ icon: '●', label: 'Warm', color: 'var(--ok)' }} /></Cell>
        <Cell name="StatusFlag" file="status-flag.tsx"><StatusFlag icon="🚫" tone="bad" title="blocked" /><StatusFlag icon="⚠" tone="warn" title="warn" /><StatusFlag icon="✓" tone="ok" title="ok" size="label" label="OK" /></Cell>
        <Cell name="LinkChip" file="link-chip.tsx"><LinkChip href="#" tone="accent">accent</LinkChip><LinkChip href="#" tone="success">ok</LinkChip></Cell>
      </Group>

      <Group title="Controls">
        <Cell name="Segmented" file="segmented.tsx"><Segmented options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} value={seg} onChange={setSeg} /></Cell>
        <Cell name="StatusSegmented" file="status-segmented.tsx"><StatusSegmented options={[{ value: 'draft', label: 'Draft', color: 'var(--fg-3)' }, { value: 'live', label: 'Live', color: 'var(--ok)' }]} value={st} onChange={setSt} /></Cell>
        <Cell name="ViewToggle" file="view-toggle.tsx"><ViewToggle options={LIST_CALENDAR_VIEWS} value={vw} onChange={setVw} /></Cell>
        <Cell name="MultiSelect" file="multi-select.tsx"><MultiSelect label="Platform" options={[{ value: 'x', label: 'X' }, { value: 'reddit', label: 'Reddit' }, { value: 'devto', label: 'dev.to' }]} selected={ms} onChange={setMs} variant="chip" /></Cell>
      </Group>

      <Group title="Feedback & Actions">
        <Cell name="Spinner" file="spinner.tsx"><Spinner size="md" /><Spinner size="sm" label="loading" /></Cell>
        <Cell name="InfoHint" file="info-hint.tsx"><span style={{ color: 'var(--fg-1)', fontSize: 12 }}>Field <InfoHint label="giải thích">Giải thích ngắn khi hover.</InfoHint></span></Cell>
        <Cell name="ConfirmDeleteButton" file="confirm-delete-button.tsx"><ConfirmDeleteButton onDelete={() => {}} /></Cell>
        <Cell name="CTACard" file="cta-card.tsx"><CTACard href="#" title="Mở dashboard" subtitle="đi tới trang" tone="accent" /></Cell>
        <Cell name="EmptyState" file="empty-state.tsx"><EmptyState icon="📭" title="Chưa có gì" description="thêm item đầu tiên" compact /></Cell>
      </Group>

      <Group title="Containers & Layout">
        <Cell name="StatsStrip" file="stats-strip.tsx"><div style={{ width: '100%' }}><StatsStrip cards={[{ key: 'p', label: 'Pass', value: 12, color: 'var(--ok)' }, { key: 'f', label: 'Fail', value: 3, color: 'var(--bad)' }]} /></div></Cell>
        <Cell name="Section" file="section.tsx"><div style={{ width: '100%' }}><Section title="Section" subtitle="mô tả" defaultOpen><span style={{ fontSize: 12, color: 'var(--fg-2)' }}>body</span></Section></div></Cell>
        <Cell name="Collapsible" file="collapsible.tsx"><div style={{ width: '100%' }}><Collapsible title="Collapsible" badge={<Pill color="var(--accent)" label="3" size="xs" />}><span style={{ fontSize: 12, color: 'var(--fg-2)' }}>nội dung</span></Collapsible></div></Cell>
        <Cell name="ModalHeader" file="modal-header.tsx"><div style={{ width: '100%' }}><ModalHeader kind="account" action="edit" title="Tiêu đề" idText="#14" subtitle="platform · habitat" onClose={() => {}} /></div></Cell>
      </Group>

      <Group title="Icons · icons.tsx">
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ICONS.map(([n, el]) => (
            <div key={n} title={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 62, padding: '8px 4px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)', color: 'var(--fg-1)' }}>
              {el}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--fg-4)' }}>{n}</span>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
