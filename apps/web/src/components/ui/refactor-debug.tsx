'use client';

// RefactorDebug — press "2" to toggle a dev overlay that outlines every HOUSE component
// (any element carrying data-comp) with a dashed border + a small top-left label of its
// name. Lets you SEE which parts of the UI use shared components; anything that ISN'T
// outlined is a hand-roll. Styling lives in globals.css under `body.refactor-debug`.
// Mounted once in RootProviders → active across all of MOS2.

import { useEffect, useState } from 'react';

export function RefactorDebug() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '2' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // Don't hijack "2" while typing.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      setOn((v) => {
        const next = !v;
        document.body.classList.toggle('refactor-debug', next);
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!on) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 10, right: 10, zIndex: 99999, pointerEvents: 'none',
      font: "600 10px/1 var(--font-mono, 'JetBrains Mono', monospace)", letterSpacing: '.03em',
      color: '#e0b341', background: 'rgba(10,10,13,.92)', border: '1px solid #e0b341',
      borderRadius: 6, padding: '6px 9px',
    }}>
      ⌗ REFACTOR DEBUG · nhấn [2] để tắt
    </div>
  );
}
