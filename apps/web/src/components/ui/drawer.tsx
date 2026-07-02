'use client';

import { useEffect, type ReactNode, type CSSProperties } from 'react';

// Standard right-side slide-over drawer. Handles backdrop, ESC + click-outside
// close, and STACKING: when another drawer opens on top, pass `backgrounded`
// to the underlying one — it slides left + dims + goes inert so the stack is
// visible and the top layer reads as active. See feedback_stacked_drawer.
//
// Stacking recipe (parent owns both open states):
//   <Drawer onClose={closeA} backgrounded={bOpen}>…A…</Drawer>
//   {bOpen && <Drawer onClose={closeB} width={560} zIndex={300}>…B…</Drawer>}
// The top drawer's higher zIndex paints its backdrop over A; clicking it fires
// closeB only (separate DOM branch, no bubbling to A's backdrop).

export function Drawer({
  onClose,
  children,
  width = 720,
  zIndex = 200,
  backgrounded = false,
  closeOnOutside = true,
  dimBackdrop = true,
  padding = 20,
  bodyStyle,
}: {
  onClose: () => void;
  children: ReactNode;
  /** Panel max width in px (caps at 96vw). */
  width?: number;
  /** Backdrop z-index; panel sits at zIndex+1. Bump for stacked drawers. */
  zIndex?: number;
  /** This drawer has another drawer stacked on top: slide left + dim + inert. */
  backgrounded?: boolean;
  /** Click backdrop closes. Set false for form drawers guarding unsaved data. */
  closeOnOutside?: boolean;
  /** Paint the dim scrim. Off when a base drawer already supplies the dim. */
  dimBackdrop?: boolean;
  padding?: number;
  bodyStyle?: CSSProperties;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={closeOnOutside ? onClose : undefined}
        style={{ position: 'fixed', inset: 0, zIndex, background: dimBackdrop ? 'rgba(0,0,0,.45)' : 'transparent' }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: zIndex + 1,
          width: `min(${width}px, 96vw)`, background: 'var(--bg-1)',
          borderLeft: '1px solid var(--line-2)', boxShadow: '-12px 0 40px rgba(0,0,0,.5)',
          overflowY: 'auto', padding,
          transition: 'transform .18s ease, filter .18s ease',
          transform: backgrounded ? 'translateX(-56px)' : 'none',
          filter: backgrounded ? 'brightness(.5)' : 'none',
          pointerEvents: backgrounded ? 'none' : 'auto',
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </>
  );
}
