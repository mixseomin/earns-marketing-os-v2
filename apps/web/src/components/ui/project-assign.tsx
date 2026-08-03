'use client';

// ProjectAssign — THE ONE many-to-many "assign this entity to N projects" field.
// Assigned projects as chips + inline searchable add-picker + (optional) ★ primary.
// Used by BOTH the account drawer (AccountProjectsSection, with primary) AND the
// browser-profile drawer (flat, no primary) — same look/behaviour, no hand-rolled <select>.
//
// The caller owns the DATA + the backend calls (each entity has its own actions):
//   <ProjectAssign
//     assigned={rows}            // null = loading; role:'primary' shows ★ (needs onSetPrimary)
//     all={allProjects}
//     onJoin={(id) => joinX(id)} onLeave={(id) => leaveX(id)}
//     onSetPrimary={(id) => setPrimaryX(id)}  // OMIT → flat mode (no ★), e.g. browser-profile
//   />
// After a handler resolves the caller reloads and passes fresh `assigned`.

import { useState, useTransition } from 'react';

export interface ProjectRef {
  id: string;
  name: string;
  emoji?: string | null;
  /** 'primary' → ★ target (only meaningful when onSetPrimary is provided). */
  role?: 'primary' | 'shared' | null;
}

export interface ProjectAssignProps {
  assigned: ProjectRef[] | null;   // null = loading
  all: ProjectRef[];
  onJoin: (id: string) => void | Promise<void>;
  onLeave: (id: string) => void | Promise<void>;
  /** Provided → primary (★) semantics shown (account). Omitted → flat assign (browser-profile). */
  onSetPrimary?: (id: string) => void | Promise<void>;
  /** Section label. Default "Projects tham gia". */
  label?: string;
  /** Start collapsed (YDNI 1-line). Default true. */
  collapsible?: boolean;
}

const name = (p: ProjectRef) => (p.emoji ? p.emoji + ' ' : '') + p.name;

export function ProjectAssign({ assigned, all, onJoin, onLeave, onSetPrimary, label = 'Projects tham gia', collapsible = true }: ProjectAssignProps) {
  const [expanded, setExpanded] = useState(!collapsible);
  const [showJoinPicker, setShowJoinPicker] = useState(false);
  const [joinQ, setJoinQ] = useState('');
  const [pending, setPending] = useState<{ kind: 'primary' | 'leave'; id: string } | null>(null);
  const [busy, startT] = useTransition();
  const supportsPrimary = !!onSetPrimary;

  const parts = assigned ?? [];
  const joined = new Set(parts.map((p) => p.id));
  const addable = all.filter((p) => !joined.has(p.id));
  const primary = parts.find((p) => p.role === 'primary');
  const others = parts.filter((p) => p.role !== 'primary');
  const isP = (k: 'primary' | 'leave', id: string) => pending?.kind === k && pending.id === id;
  const run = (fn: (id: string) => void | Promise<void>, id: string) => startT(async () => { await fn(id); setPending(null); });
  const filtered = addable.filter((p) => !joinQ || p.name.toLowerCase().includes(joinQ.toLowerCase()));

  // COLLAPSED — 1 dòng (YDNI). Cả management ẩn sau 1 click.
  if (collapsible && !expanded) {
    const lead = supportsPrimary ? primary : parts[0];
    const rest = supportsPrimary ? others : parts.slice(1);
    return (
      <div style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, minHeight: 30 }}>
        <span style={{ color: 'var(--fg-4)', flexShrink: 0 }} title={label}>📁</span>
        {assigned == null ? <span style={{ color: 'var(--fg-4)' }}>…</span> : lead ? (
          <button type="button" onClick={() => setExpanded(true)} title="Quản lý projects"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: 'var(--fg-1)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name(lead)}</span>
            {supportsPrimary && <span style={{ color: 'var(--neon-lime,#84cc16)', flexShrink: 0 }}>★</span>}
          </button>
        ) : (
          <button type="button" onClick={() => { setExpanded(true); setShowJoinPicker(true); }}
            style={{ fontWeight: 600, color: 'var(--accent,#7c3aed)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>+ gắn project</button>
        )}
        {rest.length > 0 && (
          <button type="button" onClick={() => setExpanded(true)}
            style={{ fontSize: 10.5, color: 'var(--fg-4)', border: '1px solid var(--line)', borderRadius: 8, padding: '0 6px', cursor: 'pointer', background: 'transparent', flexShrink: 0 }}>+{rest.length} khác</button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setExpanded(true)} title="Quản lý projects (thêm · rời)"
          style={{ fontSize: 13, color: 'var(--fg-4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>⋯</button>
      </div>
    );
  }

  // EXPANDED — full management.
  return (
    <div style={{ padding: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: .4 }}>
          {label}{supportsPrimary && <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--fg-4)' }}> · ★ = target chính</span>}
        </span>
        <span style={{ flex: 1 }} />
        {collapsible && (
          <button type="button" onClick={() => { setExpanded(false); setShowJoinPicker(false); }}
            style={{ fontSize: 11, color: 'var(--fg-4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>▴ thu gọn</button>
        )}
      </div>
      {assigned == null ? <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>Đang tải…</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {parts.length === 0 && <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>— chưa gán project nào —</span>}
          {parts.map((p) => {
            const isPrimary = supportsPrimary && p.role === 'primary';
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{name(p)}</span>
                {supportsPrimary && (isPrimary
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: '#0a0a0a', background: 'var(--neon-lime,#84cc16)', borderRadius: 8, padding: '1px 7px' }}>★ CHÍNH</span>
                  : <span style={{ fontSize: 10, color: 'var(--fg-4)', border: '1px solid var(--line)', borderRadius: 8, padding: '1px 7px' }}>tham gia</span>)}
                <span style={{ flex: 1 }} />
                {supportsPrimary && !isPrimary && (
                  <button type="button" disabled={busy} onClick={() => isP('primary', p.id) ? run(onSetPrimary!, p.id) : setPending({ kind: 'primary', id: p.id })}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--line)', background: isP('primary', p.id) ? 'var(--neon-lime,#84cc16)' : 'transparent', color: isP('primary', p.id) ? '#0a0a0a' : 'var(--fg-2)' }}>
                    {isP('primary', p.id) ? 'Xác nhận?' : 'đặt làm chính'}</button>
                )}
                {!isPrimary && (
                  <button type="button" disabled={busy} onClick={() => isP('leave', p.id) ? run(onLeave, p.id) : setPending({ kind: 'leave', id: p.id })}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--line)', background: isP('leave', p.id) ? 'var(--bad,#ef4444)' : 'transparent', color: isP('leave', p.id) ? '#fff' : 'var(--fg-4)' }}>
                    {isP('leave', p.id) ? 'Xác nhận rời?' : 'rời'}</button>
                )}
              </div>
            );
          })}
          {addable.length > 0 && (!showJoinPicker ? (
            <button type="button" onClick={() => setShowJoinPicker(true)} disabled={busy}
              style={{ marginTop: 4, alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 5, border: '1px dashed var(--line)', cursor: 'pointer', background: 'transparent', color: 'var(--accent,#7c3aed)' }}>
              + tham gia project khác…
            </button>
          ) : (
            <div style={{ border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg-1)', padding: 6, display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
              <input value={joinQ} onChange={(e) => setJoinQ(e.target.value)} placeholder="tìm project…" autoComplete="off"
                style={{ fontSize: 12, padding: '4px 7px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-0)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
                {filtered.map((p) => (
                  <button key={p.id} type="button" disabled={busy} onClick={() => startT(async () => { await onJoin(p.id); setShowJoinPicker(false); setJoinQ(''); })}
                    style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 7px', borderRadius: 5, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)' }}>
                    <span style={{ fontWeight: 700 }}>{name(p)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-4)' }}>+ tham gia</span>
                  </button>
                ))}
                {filtered.length === 0 && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>Không match.</span>}
              </div>
              <button type="button" onClick={() => { setShowJoinPicker(false); setJoinQ(''); }}
                style={{ alignSelf: 'flex-start', fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' }}>đóng</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
