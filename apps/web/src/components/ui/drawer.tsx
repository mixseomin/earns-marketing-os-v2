'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';

// Escape must close only the TOPMOST drawer, not every mounted one. Each drawer registered a document
// keydown listener that closed ITSELF → a stack (task → outreach → picker → detail) collapsed entirely on
// one Escape. Track mount order in a module-level stack; a drawer's listener acts only when it's on top.
// The SAME stack also drives auto-backgrounding: a drawer that isn't on top slides left + dims (below).
let drawerSeq = 0;
const drawerStack: number[] = [];
const stackListeners = new Set<() => void>();
const notifyStack = () => stackListeners.forEach((fn) => fn());

// Standard right-side slide-over drawer. Handles backdrop, ESC + click-outside close, and STACKING.
//
// AUTO-STACK: when another drawer mounts on top, the underlying one slides left + dims + goes inert
// AUTOMATICALLY (the module stack knows what's on top) — no call site hand-wires it. Just render the
// second drawer; the first backgrounds itself:
//   {aOpen && <Drawer onClose={closeA}>…A…</Drawer>}
//   {bOpen && <Drawer onClose={closeB} zIndex={300}>…B…</Drawer>}   // A backgrounds itself
// The `backgrounded` prop still exists as an OVERRIDE (pass a boolean to force it on/off), e.g. when
// the "on top" thing isn't another <Drawer>. Omit it to get the automatic behaviour.
// The top drawer's higher zIndex paints its backdrop over A; clicking it fires closeB only
// (separate DOM branch, no bubbling to A's backdrop). See feedback_stacked_drawer.

export function Drawer({
  onClose,
  children,
  width = 720,
  zIndex = 200,
  backgrounded,
  closeOnOutside = true,
  closeOnEsc = true,
  dimBackdrop = true,
  padding = 20,
  bodyStyle,
  resizable = true,
  dirty = false,
  discardLabel = 'Bỏ thay đổi chưa lưu?',
}: {
  onClose: () => void;
  children: ReactNode;
  /** Initial panel width in px (caps at 96vw). Drag the left edge to resize. */
  width?: number;
  /** Backdrop z-index; panel sits at zIndex+1. Bump for stacked drawers. */
  zIndex?: number;
  /** This drawer has another drawer stacked on top: slide left + dim + inert. */
  backgrounded?: boolean;
  /** Click backdrop closes. Set false for form drawers guarding unsaved data. */
  closeOnOutside?: boolean;
  /** ESC closes (topmost only). Set false for form drawers guarding unsaved data. */
  closeOnEsc?: boolean;
  /** Paint the dim scrim. Off when a base drawer already supplies the dim. */
  dimBackdrop?: boolean;
  padding?: number;
  bodyStyle?: CSSProperties;
  /** Allow drag-resize via the left edge. */
  resizable?: boolean;
  /** Form has UNSAVED edits → outside-click/ESC asks an inline confirm instead of closing.
   * The house standard for form drawers: close freely when clean, guard only when dirty
   * (replaces the old unconditional closeOnOutside={false} that blocked even empty forms). */
  dirty?: boolean;
  /** Text on the inline discard-confirm sheet. */
  discardLabel?: string;
}) {
  const [w, setW] = useState(width);
  const [askClose, setAskClose] = useState(false);
  // Auto-background: true when another drawer is mounted ON TOP of this one (this id isn't the
  // stack top). Recomputed whenever the stack changes. Explicit `backgrounded` prop overrides.
  const [autoBg, setAutoBg] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;   // always latest, so the mount-once effect never restacks on identity change
  const escRef = useRef(closeOnEsc);
  escRef.current = closeOnEsc;
  // Outside-click / ESC route through requestClose: dirty → inline confirm; clean → close now.
  // No native window.confirm (house rule: no native dialog).
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const requestClose = () => { if (dirtyRef.current) setAskClose(true); else onClose(); };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    const id = ++drawerSeq;
    drawerStack.push(id);
    // Recompute my own backgrounded state from the stack, and re-run on every stack change so a
    // drawer that gets covered (or uncovered) updates without any parent wiring.
    const recompute = () => setAutoBg(drawerStack.length > 0 && drawerStack[drawerStack.length - 1] !== id);
    stackListeners.add(recompute);
    notifyStack();   // I just pushed → the drawer I covered must recompute (and so must I)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (drawerStack[drawerStack.length - 1] !== id) return;   // not the top drawer → ignore
      if (!escRef.current) return;                              // ESC-close disabled (form guarding data)
      e.stopPropagation();
      requestCloseRef.current();                                // dirty → inline confirm; clean → close
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stackListeners.delete(recompute);
      const i = drawerStack.lastIndexOf(id);
      if (i >= 0) drawerStack.splice(i, 1);
      notifyStack();   // I left → whoever I covered is topmost again
    };
  }, []);
  const bg = backgrounded ?? autoBg;

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setW(Math.max(360, Math.min(window.innerWidth * 0.98, window.innerWidth - ev.clientX)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.userSelect = ''; };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      <div
        onClick={closeOnOutside ? requestClose : undefined}
        style={{ position: 'fixed', inset: 0, zIndex, background: dimBackdrop ? 'rgba(0,0,0,.45)' : 'transparent' }}
      />
      <div
        data-comp="ui.Drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: zIndex + 1,
          width: `min(${w}px, 96vw)`, background: 'var(--bg-1)',
          borderLeft: '1px solid var(--line-2)', boxShadow: '-12px 0 40px rgba(0,0,0,.5)',
          overflowY: 'auto', padding,
          transition: 'transform .2s ease, filter .2s ease',
          // Slid a large fraction of its own width so it still peeks on the LEFT even under
          // a wide/resizable child drawer (a fixed 56px got fully covered). % = own width →
          // deterministic regardless of the child's width. See feedback_stacked_drawer.
          transform: bg ? 'translateX(-86%) scale(.94)' : 'none',
          transformOrigin: 'left center',
          filter: bg ? 'brightness(.5)' : 'none',
          pointerEvents: bg ? 'none' : 'auto',
          ...bodyStyle,
        }}
      >
        {resizable && !bg && (
          <div onMouseDown={startResize} title="Kéo để đổi độ rộng"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 5 }} />
        )}
        {children}
        {askClose && (
          // Inline discard-confirm (no native dialog). Only reachable when dirty.
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)' }}
               onClick={() => setAskClose(false)}>
            <div onClick={(e) => e.stopPropagation()}
                 style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 12, padding: 18, maxWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div style={{ fontSize: 14, marginBottom: 14 }}>{discardLabel}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn ghost" onClick={() => setAskClose(false)}>Ở lại</button>
                <button className="btn" onClick={() => { setAskClose(false); onClose(); }}>Bỏ & đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
