// StickyBar — dải tiêu đề DÍNH ngay dưới thanh công cụ của trang khi cuộn (tên nhóm/ngày/dự án), để cuộn tới đâu
// vẫn biết đang ở khối nào. Trước 20/09/2026 pattern này viết tay ở feed ngày của Plays và view Tiến độ (2 bản);
// gom về đây. `top` = chiều cao thanh công cụ dính phía trên (barH), truyền từ trang.
import type { CSSProperties, ReactNode } from 'react';

export function StickyBar({ top = 0, zIndex = 20, children, style, border = true }: {
  top?: number; zIndex?: number; children: ReactNode; style?: CSSProperties;
  /** kẻ mảnh dưới dải (mặc định có) */
  border?: boolean;
}) {
  return (
    <div data-comp="ui.StickyBar" style={{ position: 'sticky', top, zIndex, background: 'var(--bg-0)', padding: '8px 0 6px',
      borderBottom: border ? '1px solid var(--line)' : undefined, ...style }}>
      {children}
    </div>
  );
}
