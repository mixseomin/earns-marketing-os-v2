'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';

// Escape must close only the TOPMOST drawer, not every mounted one. Each drawer registered a document
// keydown listener that closed ITSELF → a stack (task → outreach → picker → detail) collapsed entirely on
// one Escape. Track mount order in a module-level stack; a drawer's listener acts only when it's on top.
// The SAME stack also drives auto-backgrounding: a drawer that isn't on top slides left + dims (below).
let drawerSeq = 0;
const drawerStack: number[] = [];
const drawerW = new Map<number, number>();   // id → effective rendered width (px), for the left-cascade
const stackListeners = new Set<() => void>();
const notifyStack = () => stackListeners.forEach((fn) => fn());

// Z-ORDER FOLLOWS THE STACK, not a hand-typed number. Every drawer's z is derived from its
// position in drawerStack (BASE + pos*STEP), so the most-recently-opened drawer is ALWAYS on top —
// mount order == paint order, guaranteed. Before this, each call site hand-picked a zIndex
// (300 here, 200 there, 540/640 elsewhere); whenever mount order disagreed with those numbers a
// child stacked on top would paint BEHIND its parent (e.g. browser-profile drawer 200 opened from
// account drawer 300). The `zIndex` prop is now only a FLOOR (max'd with BASE) for the rare drawer
// that must clear a non-drawer overlay — it can no longer break inter-drawer ordering.
const DRAWER_BASE = 1000;
const DRAWER_STEP = 10;

// Standard right-side slide-over drawer. Handles backdrop, ESC + click-outside close, and STACKING.
//
// AUTO-STACK (no call site wires anything — the module stack knows the layout):
//   {aOpen && <Drawer onClose={closeA}>…A…</Drawer>}
//   {bOpen && <Drawer onClose={closeB} zIndex={300}>…B…</Drawer>}
// When B mounts on top, A CASCADES LEFT by exactly B's width so A sits flush to the LEFT of B,
// full-size (no scale/resize) and fully visible — a left-tiled stack, not a hidden peek. Only the
// BOTTOM drawer paints the dim scrim; drawers stacked above use a transparent backdrop so the
// cascaded drawers underneath show through instead of being buried under a second black scrim.
// A backgrounded drawer is inert (pointer-events:none); clicking it (through the top's transparent
// backdrop) closes the top drawer. `backgrounded` / `dimBackdrop` props stay as explicit OVERRIDES;
// omit them for the automatic behaviour. See feedback_stacked_drawer.

export function Drawer({
  onClose,
  children,
  width = 720,
  zIndex = 200,
  backgrounded,
  closeOnOutside = true,
  closeOnEsc = true,
  dimBackdrop,
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
  /** FLOOR for the backdrop z only (panel = z+1). Inter-drawer order is stack-derived (mount order
   * always wins) — you do NOT set this to stack drawers. Pass it only to clear a non-drawer overlay;
   * anything ≤ DRAWER_BASE is ignored. Legacy call-site values are harmless (floored + positional). */
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
  // Portal chỉ chạy sau mount (SSR không có `document`; drawer luôn mở do tương tác client nên không kẹt hydrate).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Stack-derived layout, recomputed on every stack change (no parent wiring):
  //   shift   = total width of the drawers stacked ABOVE me → I translate left by this (left-cascade).
  //   isBottom= I'm the bottom-most drawer → I paint the dim scrim (others go transparent).
  const [shift, setShift] = useState(0);
  // Chiều rộng THỰC SỰ vẽ ra. Khi có drawer chồng lên, drawer dưới phải CO LẠI cho vừa phần
  // màn hình còn trống — nếu không thì dù dịch trái bao nhiêu vẫn chồng nhau (đo 07/08:
  // task 720px + account 1040px = 1.760px trên màn 1.472px → chồng 354px, chữ bị cắt giữa dòng).
  const [renderW, setRenderW] = useState(width);
  const [isBottom, setIsBottom] = useState(true);
  // Stack-derived backdrop z (panel = z+1). Recomputed from drawerStack position on every change,
  // so a drawer opened later always outranks one opened earlier — regardless of the zIndex prop.
  const [z, setZ] = useState(Math.max(zIndex ?? 0, DRAWER_BASE));
  const zFloorRef = useRef(Math.max(zIndex ?? 0, DRAWER_BASE));
  zFloorRef.current = Math.max(zIndex ?? 0, DRAWER_BASE);
  const idRef = useRef(0);
  // Effective rendered width (px), matching the panel's `min(w, 96vw)`. Registered in the stack so
  // the drawer BELOW me knows how far to cascade.
  const effW = renderW;
  const effWRef = useRef(effW);
  effWRef.current = effW;
  // Bề rộng NGƯỜI DÙNG yêu cầu (prop hoặc kéo tay). recompute co từ đây xuống cho vừa stack.
  const reqWRef = useRef(w);
  reqWRef.current = w;
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
    idRef.current = id;
    drawerStack.push(id);
    drawerW.set(id, effWRef.current);
    // Recompute my left-cascade offset from the stack on every change (mount/unmount/resize).
    // NOT a flat sum of widths above (that flies off-screen at ~3+ drawers). A CONVERGING series:
    // the drawer just under the top slides ~2/3 of the top's width; each deeper level adds a
    // diminishing sliver (×STEP_DECAY), and the whole thing is hard-capped at 85% of the viewport.
    // So 2, 20 or 200 drawers ALL stay on screen — the top always keeps ≥15%, deep ones collapse
    // into a thin left deck. Bottom-most drawer paints the dim scrim.
    const recompute = () => {
      const pos = drawerStack.indexOf(id);
      if (pos < 0) return;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      // TỔNG bề rộng thật của các drawer nằm TRÊN mình. Bản cũ dùng chuỗi suy giảm (0.66, rồi ×0.6)
      // để không bị đẩy khỏi màn hình — nhưng dịch ÍT HƠN bề rộng của cái trên thì đương nhiên chồng
      // lên nhau. Xếp cạnh thật sự đòi dịch ĐÚNG BẰNG tổng bề rộng ở trên; chỗ không đủ thì giải bằng
      // CO BỀ RỘNG, không phải bằng dịch thiếu.
      let above = 0;
      for (let k = drawerStack.length - 1; k > pos; k--) above += drawerW.get(drawerStack[k]!) ?? 0;
      // Drawer trên cùng không vượt quá 62% màn để cái dưới còn chỗ đọc được.
      const topCap = drawerStack.length > 1 ? vw * 0.62 : vw * 0.96;
      const mine = Math.min(reqWRef.current, pos === drawerStack.length - 1 ? topCap : vw * 0.96);
      // Còn lại bao nhiêu thì mình rộng bấy nhiêu, tối thiểu 320px (dưới mức đó thì form vỡ).
      const fit = Math.max(320, Math.min(mine, vw - above - 8));
      setRenderW(fit);
      drawerW.set(id, fit);
      setShift(Math.min(above, Math.max(0, vw - fit)));   // không bao giờ đẩy ra khỏi mép trái
      setIsBottom(pos === 0);
      setZ(zFloorRef.current + pos * DRAWER_STEP);   // later in the stack ⇒ higher z ⇒ paints on top
    };
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
      drawerW.delete(id);
      notifyStack();   // I left → whoever I covered re-cascades / becomes topmost again
    };
  }, []);
  // Keep my registered width fresh (resize / viewport change) so the drawer below re-cascades.
  useEffect(() => {
    if (!idRef.current) return;
    drawerW.set(idRef.current, effW);
    notifyStack();
  }, [effW]);
  const bg = backgrounded ?? shift > 0;         // I'm backgrounded if something's stacked above me
  const dim = dimBackdrop ?? isBottom;          // only the bottom drawer paints the dim scrim

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setW(Math.max(360, Math.min(window.innerWidth * 0.98, window.innerWidth - ev.clientX)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.userSelect = ''; };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const overlay = (
    <>
      <div
        onClick={closeOnOutside ? requestClose : undefined}
        style={{ position: 'fixed', inset: 0, zIndex: z, background: dim ? 'rgba(0,0,0,.45)' : 'transparent' }}
      />
      <div
        data-comp="ui.Drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: z + 1,
          width: `${renderW}px`, background: 'var(--bg-1)',
          borderLeft: '1px solid var(--line-2)', boxShadow: '-12px 0 40px rgba(0,0,0,.5)',
          overflowY: 'auto', padding,
          transition: 'transform .2s ease, filter .2s ease',
          // LEFT-CASCADE: slide left by `shift` (a CONVERGING, viewport-capped offset from the
          // stack — see recompute), full-size (no scale/resize). The drawer under the top peeks a
          // big chunk; deeper ones peek less, capped so any number stay on screen. Dimmed a touch
          // so the top still reads as active.
          transform: shift > 0 ? `translateX(${-shift}px)` : (bg ? 'translateX(-86%)' : 'none'),
          transformOrigin: 'left center',
          filter: bg ? 'brightness(.68)' : 'none',
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
  // Portal ra <body>. Drawer mở TỪ TRONG children của Drawer khác (vd EntityPicker trong PieceDrawer)
  // nếu để tại chỗ sẽ nằm trong panel cha — mà panel cha có `transform` (cascade) → thành containing
  // block cho position:fixed, nên backdrop `inset:0` của con CO LẠI bằng đúng panel cha thay vì cả
  // màn hình. Hậu quả: bấm "ra ngoài" trúng backdrop toàn màn của CHA → đóng cả stack. Ở tầng <body>
  // mọi backdrop mới thật sự phủ viewport, và z theo module stack chỉ đóng drawer trên cùng. Portal
  // của React vẫn giữ context nên children vẫn thấy provider lang/theme.
  return mounted ? createPortal(overlay, document.body) : null;
}
