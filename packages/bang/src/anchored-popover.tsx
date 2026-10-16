'use client';

// AnchoredPopover — nội dung neo ngay dưới một nút, đặt bằng toạ độ viewport (getBoundingClientRect)
// + position:fixed, và LUÔN portal ra <body>.
//
// Vì sao BẮT BUỘC portal: position:fixed neo theo ancestor gần nhất có `transform` hoặc `filter`
// (không phải viewport). Panel Drawer khi có drawer khác chồng lên sẽ mang `transform` (cascade) +
// `filter: brightness` → mọi popover fixed dựng BÊN TRONG panel bị neo theo panel, lệch chỗ + kẹt
// z-index. Portal ra <body> đưa popover về đúng viewport. Đây là chỗ 7 popover tự chế cùng lặp một
// khuôn (rect + fixed + backdrop + reposition); 3 cái quên portal nên vỡ trong Drawer/modal. Primitive
// này là NGUỒN chuẩn — popover mới dùng nó, không tự dựng fixed nữa. Xem drawer portal cùng gốc.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

export interface AnchoredPopoverProps {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Căn mép TRÁI (mặc định) hay mép PHẢI của nút neo. */
  align?: 'left' | 'right';
  /** Khoảng cách px dưới nút neo (mặc định 4). */
  gap?: number;
  /** z của backdrop; panel = z+1 (mặc định 1100). */
  zIndex?: number;
  /** Lớp phủ bắt click-ngoài để đóng (mặc định true). false = hover-card: KHÔNG chặn click, để click
   *  xuyên xuống hàng/thẻ bên dưới; caller tự đóng (vd onMouseLeave). */
  backdrop?: boolean;
  /**
   * Chế độ HOVER-CARD: tự đóng khi con trỏ rời khỏi CẢ nút neo LẪN panel (theo dõi mousemove ở document
   * + đóng khi cuộn). Vì sao cần: hover-card tự chế đóng bằng onMouseLeave + timer rất dễ KẸT-MỞ — chỉ
   * cần một mouseleave bị nuốt (portal re-render / con trỏ lướt nhanh / hàng đổi filter giữa chừng) là
   * popover nằm lì che mất ô/hàng bên dưới → chỗ đó không hover/không click được. mousemove ở document
   * bắn liên tục nên KHÔNG THỂ kẹt. Dùng kèm backdrop=false; caller chỉ cần onMouseEnter=mở, khỏi timer.
   */
  closeOnPointerOutside?: boolean;
}

export function AnchoredPopover({ anchorRef, open, onClose, children, align = 'left', gap = 4, zIndex = 1100, backdrop = true, closeOnPointerOutside = false }: AnchoredPopoverProps) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Chỉ portal sau mount (SSR không có document; popover luôn mở do tương tác client).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Hover-card guard: đóng khi con trỏ ra ngoài (nút neo ∪ panel) hoặc khi cuộn. Chống kẹt-mở tận gốc.
  useEffect(() => {
    if (!open || !closeOnPointerOutside) return;
    const M = 14; // dung sai: phủ khoảng hở gap giữa nút↔panel + rìa, để lướt qua khe không bị đóng nhầm
    const near = (r: DOMRect | undefined, x: number, y: number) =>
      !!r && x >= r.left - M && x <= r.right + M && y >= r.top - M && y <= r.bottom + M;
    const onMove = (e: MouseEvent) => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = panelRef.current?.getBoundingClientRect();
      if (!near(a, e.clientX, e.clientY) && !near(p, e.clientX, e.clientY)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousemove', onMove); window.removeEventListener('scroll', onScroll, true); };
  }, [open, closeOnPointerOutside, anchorRef, onClose]);

  // useLayoutEffect (KHÔNG useEffect): đo rect + setPos phải commit TRƯỚC khi trình duyệt vẽ, nếu không
  // popover mở trễ 1 frame (render null vì chưa có pos → vẽ trắng → effect passive chạy sau paint → mới hiện).
  // 4 popover cũ tính vị trí ngay trong onClick nên hiện tức thì; giữ nguyên độ mượt đó. Chuẩn nhà: Popover
  // (backlinks-page), orders-blotter đều useLayoutEffect cho đo-rồi-đặt.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const recompute = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos(align === 'right'
        ? { top: r.bottom + gap, right: window.innerWidth - r.right }
        : { top: r.bottom + gap, left: r.left });
    };
    recompute();
    const h = () => recompute();
    window.addEventListener('scroll', h, true);   // capture: bắt scroll của mọi container cha
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open, align, gap, anchorRef]);

  if (!open || !mounted || !pos) return null;
  return createPortal(
    // stopPropagation: click từ nội dung PORTAL vẫn nổi bọt theo CÂY REACT (không phải DOM) lên tổ tiên
    // — popover khai báo trong 1 hàng/thẻ có onClick thì click backdrop/panel sẽ kích luôn onClick đó
    // (vd mở drawer ngoài ý muốn). Chặn tại đây để overlay không rò click ra ngoài.
    <>
      {backdrop && <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'fixed', inset: 0, zIndex }} />}
      <div ref={panelRef} onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right, zIndex: zIndex + 1 }}>
        {children}
      </div>
    </>,
    document.body,
  );
}
