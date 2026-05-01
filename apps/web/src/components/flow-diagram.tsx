'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getFlowData } from '@/lib/actions/flow';
import type { FlowData, FlowSquad } from '@/lib/actions/flow';

// ── Layout constants ─────────────────────────────────────────────
const DIAGRAM_H = 560;
const DIAGRAM_W = 900; // reference width; scales via viewBox

const LAYERS = {
  human:        { y: 24 },
  orchestrator: { y: 110 },
  squads:       { y: 230 },
  special:      { y: 390 },
  inbox:        { y: 480 },
};

const NODE_W = 160;
const NODE_H = 100;
const ORCH_W = 200;
const ORCH_H = 86;
const HUMAN_W = 130;
const HUMAN_H = 46;
const CLAUDE_W = 150;
const CLAUDE_H = 46;
const KB_W = 150;
const KB_H = 56;
const MON_W = 150;
const MON_H = 56;
const INBOX_W = 150;
const INBOX_H = 46;

// Trust level label
const TRUST_LABEL: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4' };
const TRUST_COLOR: Record<number, string> = {
  1: 'var(--neon-lime)',
  2: 'var(--neon-cyan)',
  3: 'var(--neon-amber)',
  4: 'var(--neon-violet)',
};

// Model shorthand
function shortModel(m: string): string {
  return m
    .replace('gpt-4o-mini', '4o-mini')
    .replace('gpt-4o', '4o')
    .replace('claude-3-5-sonnet', 'c3.5s')
    .replace('claude-3-opus', 'c3-opus')
    .replace('claude-sonnet', 'c-sonnet')
    .replace('o1-mini', 'o1-mini')
    .slice(0, 12);
}

// Last active label
function relativeTime(iso: string | null): string {
  if (!iso) return 'idle';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Node position helpers ────────────────────────────────────────
const PAIR_GAP = 20;

function humanNodePos(W: number) {
  // Human left of center, Claude right of center
  return { x: W / 2 - PAIR_GAP / 2 - HUMAN_W, y: LAYERS.human.y };
}

function claudeNodePos(W: number) {
  return { x: W / 2 + PAIR_GAP / 2, y: LAYERS.human.y };
}

function orchNodePos(W: number) {
  return { x: W / 2 - ORCH_W / 2, y: LAYERS.orchestrator.y };
}

// Multi-row squad layout. Wraps when squads exceed available width.
const SQUAD_ROW_H = NODE_H + 18;
const MIN_GAP = 8;
const SIDE_PAD = 30;

function computeSquadLayout(n: number, W: number): { perRow: number; rows: number } {
  if (n === 0) return { perRow: 0, rows: 0 };
  const available = W - SIDE_PAD * 2;
  const perRowMax = Math.max(1, Math.floor((available + MIN_GAP) / (NODE_W + MIN_GAP)));
  const perRow = Math.min(n, perRowMax);
  const rows = Math.ceil(n / perRow);
  return { perRow, rows };
}

function squadNodePositions(squads: FlowSquad[], W: number): Array<{ x: number; y: number }> {
  const n = squads.length;
  if (n === 0) return [];
  const { perRow, rows } = computeSquadLayout(n, W);
  const available = W - SIDE_PAD * 2;
  const positions: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r++) {
    const rowStart = r * perRow;
    const inRow = Math.min(perRow, n - rowStart);
    const idealGap = inRow > 1 ? (available - inRow * NODE_W) / (inRow - 1) : 0;
    const gap = Math.min(20, Math.max(MIN_GAP, idealGap));
    const totalW = inRow * NODE_W + (inRow - 1) * gap;
    const startX = Math.max(SIDE_PAD, (W - totalW) / 2);
    for (let i = 0; i < inRow; i++) {
      positions.push({ x: startX + i * (NODE_W + gap), y: LAYERS.squads.y + r * SQUAD_ROW_H });
    }
  }
  return positions;
}

// Extra height pushed down by additional squad rows (rows beyond the first)
function extraRowsHeight(squads: FlowSquad[], W: number): number {
  const { rows } = computeSquadLayout(squads.length, W);
  return Math.max(0, rows - 1) * SQUAD_ROW_H;
}

function kbNodePos(W: number, extraH: number) {
  return { x: W / 2 - 20 - KB_W, y: LAYERS.special.y + extraH };
}

function monNodePos(W: number, extraH: number) {
  return { x: W / 2 + 20, y: LAYERS.special.y + extraH };
}

function inboxNodePos(W: number, extraH: number) {
  const mon = monNodePos(W, extraH);
  return { x: mon.x + MON_W / 2 - INBOX_W / 2, y: LAYERS.inbox.y + extraH };
}

// Center of a node rect
function cx(x: number, w: number) { return x + w / 2; }
function cy(y: number, h: number) { return y + h / 2; }

// Bottom-center of a node
function bot(x: number, y: number, w: number, h: number) {
  return { x: x + w / 2, y: y + h };
}

// Top-center of a node
function top(x: number, y: number, w: number) {
  return { x: x + w / 2, y };
}

// Cubic bezier SVG path between two points
function curve(
  x1: number, y1: number,
  x2: number, y2: number,
  tension = 0.4,
): string {
  const dy = (y2 - y1) * tension;
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

// ── Sub-components ───────────────────────────────────────────────

function ActiveBar({ active, total }: { active: number; total: number }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : (active > 0 ? 100 : 0);
  const bars = 6;
  const filled = Math.round((pct / 100) * bars);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 5, height: 8, borderRadius: 1,
              background: i < filled ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
        {active} active
      </span>
    </div>
  );
}

function PulseDot({ color, size = 6 }: { color?: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size, height: size,
        borderRadius: '50%',
        background: color ?? 'var(--neon-lime)',
        boxShadow: `0 0 4px ${color ?? 'var(--neon-lime)'}`,
        flexShrink: 0,
      }}
    />
  );
}

// ── SVG Arrows overlay ───────────────────────────────────────────
function ArrowsLayer({
  W, H,
  squads,
  orchSquad,
  publisherIdx,
}: {
  W: number; H: number;
  squads: FlowSquad[];
  orchSquad: FlowSquad | null;
  publisherIdx: number;
}) {
  const humanPos = humanNodePos(W);
  const claudePos = claudeNodePos(W);
  const orchPos = orchNodePos(W);
  const nonOrchSquads = squads.filter((s) => !isOrchestrator(s));
  const squadPos = squadNodePositions(nonOrchSquads, W);
  const extraH = extraRowsHeight(nonOrchSquads, W);
  const kbPos = kbNodePos(W, extraH);
  const monPos = monNodePos(W, extraH);
  const inboxPos = inboxNodePos(W, extraH);

  // Arrow color
  const dimArrow = 'rgba(148,163,184,0.22)';
  const orchArrow = 'var(--neon-violet)';
  const cyanArrow = 'rgba(0,229,255,0.35)';
  const amberArrow = 'rgba(255,176,60,0.55)';

  const paths: Array<{ d: string; color: string; animate?: boolean; dashed?: boolean }> = [];

  // Human ↔ Claude IDE — horizontal bidirectional (draw as two offset paths)
  const humanRight = { x: humanPos.x + HUMAN_W, y: humanPos.y + HUMAN_H / 2 };
  const claudeLeft  = { x: claudePos.x, y: claudePos.y + CLAUDE_H / 2 };
  const gap = claudeLeft.x - humanRight.x;
  paths.push({ d: `M ${humanRight.x} ${humanRight.y - 4} L ${humanRight.x + gap} ${humanRight.y - 4}`, color: amberArrow, dashed: true });
  paths.push({ d: `M ${claudeLeft.x} ${claudeLeft.y + 4} L ${claudeLeft.x - gap} ${claudeLeft.y + 4}`, color: amberArrow, dashed: true });

  // Claude IDE → Orchestrator (spawns cards / architecture)
  if (orchSquad) {
    const b = bot(claudePos.x, claudePos.y, CLAUDE_W, CLAUDE_H);
    const t = top(orchPos.x, orchPos.y, ORCH_W);
    paths.push({ d: curve(b.x, b.y, t.x, t.y, 0.5), color: amberArrow, dashed: true });
  }

  // Human → Orchestrator (or first squad)
  if (orchSquad) {
    const b = bot(humanPos.x, humanPos.y, HUMAN_W, HUMAN_H);
    const t = top(orchPos.x, orchPos.y, ORCH_W);
    paths.push({ d: curve(b.x, b.y, t.x, t.y), color: orchArrow });
  } else if (nonOrchSquads.length > 0) {
    const b = bot(humanPos.x, humanPos.y, HUMAN_W, HUMAN_H);
    const sp0 = squadPos[0]!;
    const t = top(sp0.x, sp0.y, NODE_W);
    paths.push({ d: curve(b.x, b.y, t.x, t.y), color: dimArrow });
  }

  // Orchestrator → each squad
  if (orchSquad) {
    const b = bot(orchPos.x, orchPos.y, ORCH_W, ORCH_H);
    nonOrchSquads.forEach((sq, i) => {
      const sp = squadPos[i]!;
      const t = top(sp.x, sp.y, NODE_W);
      paths.push({
        d: curve(b.x, b.y, t.x, t.y, 0.5),
        color: orchArrow,
        animate: sq.activeCards > 0,
      });
    });
  }

  // All squads → Knowledge Base (converging)
  nonOrchSquads.forEach((sq, i) => {
    const sp = squadPos[i]!;
    const b = bot(sp.x, sp.y, NODE_W, NODE_H);
    const kbT = top(kbPos.x, kbPos.y, KB_W);
    paths.push({
      d: curve(b.x, b.y, kbT.x, kbT.y, 0.5),
      color: dimArrow,
      animate: sq.activeCards > 0,
    });
  });

  // Publisher squad → Monitor
  if (publisherIdx >= 0 && publisherIdx < squadPos.length) {
    const spPub = squadPos[publisherIdx]!;
    const b = bot(spPub.x, spPub.y, NODE_W, NODE_H);
    const monT = top(monPos.x, monPos.y, MON_W);
    paths.push({ d: curve(b.x, b.y, monT.x, monT.y), color: cyanArrow });
  }

  // Monitor → Inbox
  const monB = bot(monPos.x, monPos.y, MON_W, MON_H);
  const inboxT = top(inboxPos.x, inboxPos.y, INBOX_W);
  paths.push({ d: curve(monB.x, monB.y, inboxT.x, inboxT.y), color: cyanArrow });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
    >
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="rgba(148,163,184,0.5)" />
        </marker>
        <marker id="arr-violet" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="var(--neon-violet)" />
        </marker>
        <marker id="arr-cyan" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="rgba(0,229,255,0.6)" />
        </marker>
        <marker id="arr-amber" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="rgba(255,176,60,0.7)" />
        </marker>
        <style>{`
          @keyframes flowDash {
            to { stroke-dashoffset: -24; }
          }
          .flow-active {
            animation: flowDash 1.2s linear infinite;
          }
        `}</style>
      </defs>
      {paths.map((p, i) => {
        const isViolet = p.color === 'var(--neon-violet)';
        const isCyan = p.color.includes('0,229,255');
        const isAmber = p.color.includes('255,176,60');
        const markerId = isViolet ? 'arr-violet' : isCyan ? 'arr-cyan' : isAmber ? 'arr-amber' : 'arr';
        return (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={isViolet ? 1.5 : isAmber ? 1.2 : 1}
            strokeDasharray={p.animate ? '8 4' : p.dashed ? '5 4' : undefined}
            className={p.animate ? 'flow-active' : undefined}
            markerEnd={`url(#${markerId})`}
            opacity={isViolet ? 0.85 : isAmber ? 0.8 : 0.7}
          />
        );
      })}
    </svg>
  );
}

// ── Detect orchestrator ──────────────────────────────────────────
function isOrchestrator(sq: FlowSquad): boolean {
  const k = sq.squadKey.toLowerCase();
  return k.includes('planner') || k.includes('orchestrat');
}

function detectPublisherIdx(squads: FlowSquad[]): number {
  return squads.findIndex((s) => {
    const k = s.squadKey.toLowerCase();
    return k.includes('publisher') || k.includes('publish');
  });
}

// ── Node components ──────────────────────────────────────────────
function HumanNode({ pos }: { pos: { x: number; y: number } }) {
  return (
    <div
      title="Human operator — sets goals, reviews escalations"
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: HUMAN_W, height: HUMAN_H,
        border: '1.5px dashed var(--fg-3)',
        borderRadius: 8,
        background: 'rgba(90,98,115,0.10)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3,
      }}
    >
      <span style={{ fontSize: 16 }}>👤</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-2)', fontFamily: 'var(--font-display)' }}>
        Human / Goal
      </span>
    </div>
  );
}

function ClaudeIDENode({ pos }: { pos: { x: number; y: number } }) {
  return (
    <div
      title="Claude IDE — builds features, seeds cards, reviews architecture. Participates when human pulls it in."
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: CLAUDE_W, height: CLAUDE_H,
        border: '1.5px solid var(--neon-amber)',
        borderRadius: 8,
        background: 'rgba(255,176,60,0.07)',
        boxShadow: '0 0 10px rgba(255,176,60,0.18)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14 }}>✨</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neon-amber)', fontFamily: 'var(--font-display)' }}>
          Claude IDE
        </span>
      </div>
      <span style={{ fontSize: 8, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        Architect · Builder
      </span>
    </div>
  );
}

function OrchestratorNode({ sq, pos }: { sq: FlowSquad; pos: { x: number; y: number } }) {
  const isActive = sq.activeCards > 0;
  return (
    <div
      title={`Orchestrator — planning & coordination\nModel: ${sq.model}\nTrust: ${TRUST_LABEL[sq.trustLevel] ?? 'L1'}\nActive cards: ${sq.activeCards}`}
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: ORCH_W, height: ORCH_H,
        border: `1.5px solid var(--neon-violet)`,
        borderRadius: 8,
        background: 'rgba(157,108,255,0.08)',
        boxShadow: isActive ? '0 0 16px rgba(157,108,255,0.3)' : '0 0 6px rgba(157,108,255,0.12)',
        padding: '8px 12px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15 }}>{sq.icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-display)' }}>
          {sq.name}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: 'var(--neon-violet)',
          border: '1px solid rgba(157,108,255,0.4)',
          borderRadius: 3, padding: '1px 4px',
        }}>
          {TRUST_LABEL[sq.trustLevel] ?? 'L1'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {shortModel(sq.model)}
        </span>
        {isActive && <PulseDot color="var(--neon-lime)" />}
        <span style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          {relativeTime(sq.lastActiveAt)}
        </span>
      </div>
    </div>
  );
}

function SquadNode({ sq, pos }: { sq: FlowSquad; pos: { x: number; y: number } }) {
  const isActive = sq.activeCards > 0;
  const tColor = TRUST_COLOR[sq.trustLevel] ?? 'var(--fg-3)';
  const lastTs = relativeTime(sq.lastActiveAt);
  return (
    <div
      title={`${sq.name}\nKey: ${sq.squadKey}\nModel: ${sq.model}\nTrust: ${TRUST_LABEL[sq.trustLevel] ?? '?'}\nActive: ${sq.activeCards} cards\nWorkflow: ${sq.totalWorkflowCards} cards\nLast active: ${lastTs}`}
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: NODE_W, height: NODE_H,
        border: `1px solid ${isActive ? tColor : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 6,
        background: isActive
          ? `rgba(${hexToRgbFallback(tColor)}, 0.05)`
          : 'var(--bg-3)',
        boxShadow: isActive ? `0 0 10px rgba(${hexToRgbFallback(tColor)}, 0.2)` : 'none',
        padding: '8px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>{sq.icon}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 600, color: 'var(--fg-1)',
          fontFamily: 'var(--font-display)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1,
        }}>
          {sq.name}
        </span>
      </div>
      {/* Model + Trust */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <span style={{ fontSize: 8.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shortModel(sq.model)}
        </span>
        <span style={{
          fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: tColor,
          border: `1px solid ${tColor}`,
          borderRadius: 3, padding: '1px 3px', opacity: 0.9, flexShrink: 0,
        }}>
          {TRUST_LABEL[sq.trustLevel] ?? 'L?'}
        </span>
      </div>
      {/* Active bar */}
      <ActiveBar active={sq.activeCards} total={sq.totalWorkflowCards} />
      {/* Last active */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
        {isActive
          ? <PulseDot color={tColor} size={5} />
          : <span style={{ width: 5, height: 5, borderRadius: '50%', border: '1px solid var(--fg-4)', display: 'inline-block', flexShrink: 0 }} />}
        <span style={{ fontSize: 8.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {lastTs}
        </span>
        {sq.useAgentLoop && (
          <span style={{
            marginLeft: 'auto', fontSize: 8, color: 'var(--neon-lime)',
            fontFamily: 'var(--font-mono)', border: '1px solid rgba(182,255,60,0.3)',
            borderRadius: 3, padding: '0 3px',
          }}>loop</span>
        )}
      </div>
    </div>
  );
}

function KnowledgeNode({ pos, count }: { pos: { x: number; y: number }; count: number }) {
  return (
    <div
      title={`Knowledge Base — ${count} entries\nAll squads write learnings here`}
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: KB_W, height: KB_H,
        border: '1px solid rgba(0,229,255,0.35)',
        borderRadius: 6,
        background: 'rgba(0,229,255,0.05)',
        padding: '8px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>📚</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-1)' }}>Knowledge Base</span>
      </div>
      <span style={{ fontSize: 8.5, color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
        {count} entries
      </span>
    </div>
  );
}

function MonitorNode({ pos, active, replies }: { pos: { x: number; y: number }; active: number; replies: number }) {
  return (
    <div
      title={`Publication Monitor\n${active} active publications\n${replies} awaiting reply`}
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: MON_W, height: MON_H,
        border: `1px solid ${active > 0 ? 'var(--neon-cyan)' : 'rgba(0,229,255,0.2)'}`,
        borderRadius: 6,
        background: 'rgba(0,229,255,0.04)',
        padding: '8px 10px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>📡</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-1)' }}>Monitor</span>
        {active > 0 && <PulseDot color="var(--neon-cyan)" size={5} />}
      </div>
      <span style={{ fontSize: 8.5, color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
        {active} live · {replies} replies
      </span>
    </div>
  );
}

function InboxNode({ pos, pending, claimed }: { pos: { x: number; y: number }; pending: number; claimed: number }) {
  const hasTasks = pending + claimed > 0;
  return (
    <div
      title={`Human Inbox\n${pending} pending · ${claimed} claimed\nTasks requiring human action`}
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        width: INBOX_W, height: INBOX_H,
        border: `1.5px solid ${hasTasks ? 'var(--neon-amber)' : 'rgba(255,176,60,0.2)'}`,
        borderRadius: 6,
        background: hasTasks ? 'rgba(255,176,60,0.07)' : 'rgba(255,176,60,0.02)',
        boxShadow: hasTasks ? '0 0 10px rgba(255,176,60,0.2)' : 'none',
        padding: '6px 10px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      <span style={{ fontSize: 14 }}>📥</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-1)' }}>Human Inbox</span>
        <span style={{ fontSize: 8.5, color: 'var(--neon-amber)', fontFamily: 'var(--font-mono)' }}>
          {pending} pending · {claimed} claimed
        </span>
      </div>
      {hasTasks && <PulseDot color="var(--neon-amber)" />}
    </div>
  );
}

// Fallback rgb extractor for CSS var colors — returns an approx string
function hexToRgbFallback(color: string): string {
  if (color.includes('neon-lime')) return '182,255,60';
  if (color.includes('neon-cyan')) return '0,229,255';
  if (color.includes('neon-amber')) return '255,176,60';
  if (color.includes('neon-violet')) return '157,108,255';
  return '90,98,115';
}

// ── Legend ───────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{
      marginTop: 12,
      padding: '6px 12px',
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trust</span>
        {[1, 2, 3, 4].map((l) => (
          <span key={l} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: TRUST_COLOR[l] }}>
            {TRUST_LABEL[l]} {['auto', 'auto+log', 'approve', 'escalate'][l - 1]}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          <PulseDot color="var(--neon-lime)" size={5} /> active
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', border: '1px solid var(--fg-4)' }} /> idle
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          <span style={{ display: 'inline-block', width: 14, height: 1, borderTop: '1px dashed rgba(148,163,184,0.5)', verticalAlign: 'middle' }} />
          <span style={{ display: 'inline-block', width: 14, height: 1, borderTop: '1.5px dashed rgba(157,108,255,0.8)', verticalAlign: 'middle', marginLeft: 2 }} /> flow
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loop</span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--neon-lime)', border: '1px solid rgba(182,255,60,0.3)', borderRadius: 3, padding: '0 3px' }}>loop</span>
        <span style={{ fontSize: 9, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>= agent loop enabled</span>
      </div>
    </div>
  );
}


// ── Main component ───────────────────────────────────────────────
export function FlowDiagram({ data: initialData, projectId }: { data: FlowData; projectId: string }) {
  const [data, setData] = useState<FlowData>(initialData);
  const containerRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DIAGRAM_W);

  // Measure container width for responsive layout
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 100) setW(w);
    });
    obs.observe(el);
    setW(el.clientWidth || DIAGRAM_W);
    return () => obs.disconnect();
  }, []);

  // Auto-refresh every 15s
  const refresh = useCallback(async () => {
    try {
      const fresh = await getFlowData(projectId);
      setData(fresh);
    } catch (_) { /* silent */ }
  }, [projectId]);

  useEffect(() => {
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const isEmpty = data.squads.length === 0;
  const orchSquad = data.squads.find(isOrchestrator) ?? null;
  const nonOrchSquads = data.squads.filter((s) => !isOrchestrator(s));
  const squadPos = squadNodePositions(nonOrchSquads, W);
  const publisherIdx = detectPublisherIdx(nonOrchSquads);

  const humanPos = humanNodePos(W);
  const claudePos = claudeNodePos(W);
  const orchPos = orchNodePos(W);
  const extraH = extraRowsHeight(nonOrchSquads, W);
  const kbPos = kbNodePos(W, extraH);
  const monPos = monNodePos(W, extraH);
  const inboxPos = inboxNodePos(W, extraH);
  const diagramH = DIAGRAM_H + extraH;

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: diagramH,
          background: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          overflow: 'hidden',
          transition: 'height 0.3s',
        }}
      >
        {/* SVG arrows */}
        <ArrowsLayer
          W={W} H={diagramH}
          squads={data.squads}
          orchSquad={orchSquad}
          publisherIdx={publisherIdx}
        />

        {/* Human node */}
        <HumanNode pos={humanPos} />

        {/* Claude IDE node */}
        <ClaudeIDENode pos={claudePos} />

        {/* Orchestrator node */}
        {orchSquad && <OrchestratorNode sq={orchSquad} pos={orchPos} />}

        {/* Squad nodes (non-orchestrator) */}
        {nonOrchSquads.map((sq, i) => {
          const sp = squadPos[i];
          if (!sp) return null;
          return <SquadNode key={sq.squadKey} sq={sq} pos={sp} />;
        })}

        {/* Empty hint when no squads — sits in the squads layer */}
        {isEmpty && (
          <div style={{
            position: 'absolute',
            left: '50%', top: LAYERS.squads.y + NODE_H / 2 - 30,
            transform: 'translateX(-50%)',
            padding: '14px 22px',
            border: '1.5px dashed var(--fg-4)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            color: 'var(--fg-3)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ fontSize: 22, opacity: 0.5 }}>🤖</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>No squads yet</span>
            <a href={`/p/${projectId}/squads`} style={{
              fontSize: 10, color: 'var(--accent)', textDecoration: 'none',
              border: '1px solid var(--accent)', borderRadius: 4, padding: '3px 8px', marginTop: 2,
            }}>
              + Configure squads
            </a>
          </div>
        )}

        {/* Knowledge Base */}
        <KnowledgeNode pos={kbPos} count={data.knowledgeCount} />

        {/* Monitor */}
        <MonitorNode
          pos={monPos}
          active={data.publicationsActive}
          replies={data.publicationsPendingReplies}
        />

        {/* Inbox */}
        <InboxNode
          pos={inboxPos}
          pending={data.inboxPending}
          claimed={data.inboxClaimed}
        />

        {/* Refresh timestamp */}
        <div style={{
          position: 'absolute', bottom: 6, right: 10,
          fontSize: 8.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)',
        }}>
          auto-refresh 15s
        </div>
      </div>

      <Legend />
    </div>
  );
}
