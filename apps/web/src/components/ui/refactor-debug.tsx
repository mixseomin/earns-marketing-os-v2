'use client';

// RefactorDebug — press "2" to outline every HOUSE component (data-comp) and label it
// with a REAL clickable badge (click = copy the comp name for debugging). Anything with
// no dashed outline / no badge is a hand-roll. Mounted once in RootProviders.
//
// Why badges are JS-drawn (not a CSS ::before): pseudo-element labels anchored to the wrong
// positioned ancestor (phantom / duplicated labels) and stacked exactly on top of each other
// when components nest (Drawer → ModalHeader), so the parent's name got hidden. Here each
// data-comp element gets ONE badge positioned by its bounding rect, staggered by nesting
// depth so a child's badge never covers its parent's, and clickable to copy the name.

import { useEffect, useState, useCallback } from 'react';

interface Badge { name: string; top: number; left: number; depth: number; key: number }

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

// A drawer that's been backgrounded (covered by a drawer on top) sets pointer-events:none
// inline on its panel. Skip its whole subtree — only the ACTIVE (top) drawer gets labelled,
// so a stack doesn't bleed the underneath drawer's badges (2× ui.Drawer, stray ui.Pill…) over
// the top one.
const inInertDrawer = (el: HTMLElement) => {
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    if (p.style && p.style.pointerEvents === 'none') return true;
  }
  return false;
};

export function RefactorDebug() {
  const [on, setOn] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const scan = useCallback(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-comp]'));
    const set = new Set(els);
    const out: Badge[] = [];
    els.forEach((el, i) => {
      if (inInertDrawer(el)) return;                               // covered/backgrounded drawer → skip its subtree
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;                 // hidden/collapsed → no badge
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return; // off-screen
      let depth = 0;
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) depth++;
      out.push({ name: el.getAttribute('data-comp') || '?', top: Math.max(0, r.top), left: Math.max(0, r.left), depth, key: i });
    });
    setBadges(out);
  }, []);

  // Toggle on "2" (ignored while typing / with modifiers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '2' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      setOn((v) => !v);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // While on: track the body class, rescan on scroll/resize + a slow interval (drawers open/close).
  useEffect(() => {
    document.body.classList.toggle('refactor-debug', on);
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

  const copy = async (name: string) => {
    try { await navigator.clipboard.writeText(name); } catch { /* clipboard blocked — ignore */ }
    setCopied(name);
    window.setTimeout(() => setCopied((c) => (c === name ? null : c)), 1200);
  };

  if (!on) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none' }}>
      {badges.map((b) => {
        const hit = copied === b.name;
        return (
          <button key={b.key} type="button" onClick={() => copy(b.name)} title={`Copy "${b.name}"`}
            style={{
              position: 'fixed', top: b.top + b.depth * 13, left: b.left, pointerEvents: 'auto',
              font: "700 9px/1.4 ui-monospace,'JetBrains Mono',monospace", letterSpacing: '0.02em',
              color: '#0a0a0a', background: hit ? '#4ade80' : '#e0b341', border: 'none',
              borderRadius: '0 0 4px 0', padding: '1px 5px', cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,.45)',
            }}>
            {hit ? '✓ copied' : b.name}
          </button>
        );
      })}
      <div style={{ position: 'fixed', right: 12, bottom: 12, pointerEvents: 'none', font: "600 11px ui-monospace,monospace", color: '#e0b341', background: 'rgba(0,0,0,.72)', padding: '4px 9px', borderRadius: 6, border: '1px solid rgba(224,179,65,.4)' }}>
        ⌗ REFACTOR DEBUG · {badges.length} comps · click tên = copy · [2] tắt
      </div>
    </div>
  );
}
