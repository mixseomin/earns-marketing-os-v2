'use client';

// Custom React Flow nodes for the Architecture Studio.
// Nodes are pure display — clicks are handled by onNodeClick in studio.tsx.

import { Handle, Position, type NodeProps } from '@xyflow/react';

const HANDLE_STYLE = { opacity: 0, width: 7, height: 7, background: 'transparent', border: 0 } as const;

// All-sides handles so edges can attach on whichever side faces the target.
function AllHandles() {
  return (
    <>
      {(['l', 'r', 't', 'b'] as const).map((side) => {
        const pos = side === 'l' ? Position.Left : side === 'r' ? Position.Right : side === 't' ? Position.Top : Position.Bottom;
        return (
          <span key={side}>
            <Handle id={`s-${side}`} type="source" position={pos} style={HANDLE_STYLE} />
            <Handle id={`t-${side}`} type="target" position={pos} style={HANDLE_STYLE} />
          </span>
        );
      })}
    </>
  );
}

interface ObjectNodeData {
  label: string;
  groupLabel: string;
  color: string;
  attrCount: number;
  bindable: boolean;
  boundLabel?: string | null;
  worst?: 'error' | 'warn' | 'ok' | null;
  rows?: number | null;
  issueCount?: number | null;
}

export function ObjectNode({ data, selected }: NodeProps) {
  const d = data as unknown as ObjectNodeData;
  const dot = d.worst === 'error' ? 'var(--bad)' : d.worst === 'warn' ? 'var(--warn)' : d.worst === 'ok' ? 'var(--ok)' : null;
  return (
    <div style={{
      position: 'relative',
      width: 188,
      background: 'var(--bg-1)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      padding: '9px 11px 9px 13px',
      boxShadow: selected ? '0 8px 24px rgba(0,0,0,.4)' : '0 2px 8px rgba(0,0,0,.3)',
      // selection = OFFSET outline (sits clear of the stripe) — never recolors the
      // border so the left accent bar stays visible while selected / dragging.
      outline: selected ? `2px solid ${d.color}` : undefined,
      outlineOffset: selected ? 2 : undefined,
      cursor: 'pointer',
    }}>
      {/* accent stripe = its OWN element → constant in every state (idle/hover/selected/drag) */}
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '8px 0 0 8px', background: d.color }} />
      <AllHandles />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--fg-0)', lineHeight: 1.2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
        {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{d.groupLabel}</div>
      {d.boundLabel && (
        <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: d.color, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>● {d.boundLabel}</div>
      )}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>
        {d.rows != null ? <span style={{ color: 'var(--fg-1)' }}>{d.rows} rows</span> : <span>{d.attrCount} attrs{d.bindable ? '' : ' · doc'}</span>}
        {d.issueCount != null && d.issueCount > 0 && (
          <span style={{ color: d.worst === 'error' ? 'var(--bad)' : 'var(--warn)', border: `1px solid ${d.worst === 'error' ? 'var(--bad)' : 'var(--warn)'}`, borderRadius: 3, padding: '0 4px' }}>⚠ {d.issueCount}</span>
        )}
      </div>
    </div>
  );
}

interface FlowStepNodeData {
  label: string;
  index: number;
  color: string;
  objects: string[];
  route?: string;
  writes?: string[];
  note?: string;
}

export function FlowStepNode({ data, selected }: NodeProps) {
  const d = data as unknown as FlowStepNodeData;
  return (
    <div style={{
      position: 'relative',
      width: 210,
      background: 'var(--bg-1)',
      border: '1px solid var(--line)',
      borderRadius: 8,
      padding: '12px 12px 10px',
      boxShadow: selected ? '0 8px 24px rgba(0,0,0,.4)' : '0 2px 8px rgba(0,0,0,.3)',
      outline: selected ? `2px solid ${d.color}` : undefined,
      outlineOffset: selected ? 2 : undefined,
      cursor: 'pointer',
    }}>
      <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, borderRadius: '8px 8px 0 0', background: d.color }} />
      <Handle id="t-l" type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle id="s-r" type="source" position={Position.Right} style={HANDLE_STYLE} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: d.color, fontWeight: 700 }}>{String(d.index + 1).padStart(2, '0')}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--fg-0)' }}>{d.label}</span>
      </div>
      {d.route && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-2)', marginTop: 4, lineHeight: 1.35, wordBreak: 'break-word' }}>{d.route}</div>}
      {d.objects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
          {d.objects.map((o) => (
            <span key={o} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-1)', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 5px' }}>{o}</span>
          ))}
        </div>
      )}
      {d.writes && d.writes.length > 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ok)', marginTop: 5 }}>✎ {d.writes.join(' · ')}</div>
      )}
    </div>
  );
}

export function GroupLabelNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; color: string };
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
      color: d.color, textTransform: 'uppercase', letterSpacing: '0.1em',
      borderBottom: `2px solid ${d.color}`, paddingBottom: 4, width: 188,
      pointerEvents: 'none',
    }}>{d.label}</div>
  );
}

export const NODE_TYPES = { objectNode: ObjectNode, flowStep: FlowStepNode, groupLabel: GroupLabelNode };
