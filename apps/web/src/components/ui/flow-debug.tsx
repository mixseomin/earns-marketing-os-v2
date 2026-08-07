'use client';

// FlowDebug — the FLOW analog of RefactorDebug ("2"). Press "3" to reveal every ENTITY on the
// page (any [data-entity], e.g. EntityRef chips) with a badge: the entity kind + how many
// surfaces its CRUD cascades to (↻ N, from ENTITY_DEPS), or ⚠ if that entity has NO cascade
// kind wired (CRUD it → nothing auto-refreshes). Click a badge → /cascade for the full flow
// (relationships + DB triggers + refresh). Mounted once in RootProviders, same as RefactorDebug.

import { useEffect, useState, useCallback } from 'react';
import { ENTITY_DEPS } from '@/lib/entity-cascade';

// EntityRef kind → the touchEntity cascade kind (null = no auto-refresh wired = a gap to flag).
const K2C: Record<string, keyof typeof ENTITY_DEPS | null> = {
  account: 'account', 'browser-profile': 'environment', proxy: 'environment', identity: 'identity',
  brief: 'brief', habitat: 'habitat', tribe: 'tribe', agent: 'agent', 'team-member': 'team-member',
  media: 'resource', contact: null, project: 'project', card: 'card', task: 'inbox', scene: 'scene',
  pillar: 'pillar',
};
const ICON: Record<string, string> = {
  account: '🔐', 'browser-profile': '🧬', proxy: '🛰', identity: '👤', brief: '📝', habitat: '🏘',
  tribe: '◍', agent: '🧠', 'team-member': '👥', media: '🎬', contact: '📇', project: '📁', card: '📋', task: '📥', scene: '◎', pillar: '📚',
};

function cascadeCount(kind: string): { gap: boolean; n: number } {
  const c = K2C[kind];
  if (!c) return { gap: true, n: 0 };
  const d = ENTITY_DEPS[c];
  const n = (d.sections?.length ?? 0) + (d.self ? 1 : 0) + (d.paths?.length ?? 0) + (d.pages?.length ?? 0) + (d.tags?.length ?? 0);
  return { gap: false, n };
}

interface Badge { kind: string; top: number; left: number; depth: number; key: number }

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};
const inInertDrawer = (el: HTMLElement) => {
  for (let p: HTMLElement | null = el; p; p = p.parentElement) if (p.style && p.style.pointerEvents === 'none') return true;
  return false;
};

export function FlowDebug() {
  const [on, setOn] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);

  const scan = useCallback(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-entity]'));
    const set = new Set(els);
    const out: Badge[] = [];
    els.forEach((el, i) => {
      if (inInertDrawer(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
      let depth = 0;
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) depth++;
      out.push({ kind: el.getAttribute('data-entity') || '?', top: Math.max(0, r.top), left: Math.max(0, r.left), depth, key: i });
    });
    setBadges(out);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '3' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      setOn((v) => !v);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('flow-debug', on);
    if (!on) { setBadges([]); return; }
    scan();
    const rescan = () => scan();
    window.addEventListener('scroll', rescan, true);
    window.addEventListener('resize', rescan);
    const iv = window.setInterval(scan, 500);
    return () => {
      window.removeEventListener('scroll', rescan, true);
      window.removeEventListener('resize', rescan);
      window.clearInterval(iv);
    };
  }, [on, scan]);

  if (!on) return null;
  const gaps = badges.filter((b) => cascadeCount(b.kind).gap).length;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none' }}>
      {badges.map((b) => {
        const { gap, n } = cascadeCount(b.kind);
        return (
          <button key={b.key} type="button" onClick={() => window.open('/cascade', '_blank')} title={`${b.kind} → xem flow đầy đủ ở /cascade`}
            style={{
              position: 'fixed', top: b.top + b.depth * 13, left: b.left, pointerEvents: 'auto',
              font: "700 9px/1.4 ui-monospace,'JetBrains Mono',monospace", letterSpacing: '0.02em',
              color: '#0a0a0a', background: gap ? '#f2a341' : '#3ee08f', border: 'none',
              borderRadius: '0 0 4px 0', padding: '1px 5px', cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,.45)',
            }}>
            {ICON[b.kind] ?? ''}{b.kind} {gap ? '⚠no-cascade' : `↻${n}`}
          </button>
        );
      })}
      <div style={{ position: 'fixed', right: 12, bottom: 12, pointerEvents: 'none', font: "600 11px ui-monospace,monospace", color: '#3ee08f', background: 'rgba(0,0,0,.72)', padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(62,224,143,.4)' }}>
        ⇄ FLOW DEBUG · {badges.length} entities{gaps > 0 ? ` · ${gaps} ⚠ no-cascade` : ''} · click = /cascade · [3] tắt
      </div>
    </div>
  );
}
