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
import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
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
}

export function AnchoredPopover({ anchorRef, open, onClose, children, align = 'left', gap = 4, zIndex = 1100 }: AnchoredPopoverProps) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  // Chỉ portal sau mount (SSR không có document; popover luôn mở do tương tác client).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex }} />
      <div style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right, zIndex: zIndex + 1 }}>
        {children}
      </div>
    </>,
    document.body,
  );
}
