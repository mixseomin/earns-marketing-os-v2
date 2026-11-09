'use client';

// XEM TẠI CHỖ — bấm một ảnh/PDF trong drawer thì phóng to NGAY TRONG TRANG rồi đóng, KHÔNG mở tab
// mới. Nhảy ra tab ngoài là bắt người đang duyệt việc mất mạch: đóng tab, tìm lại cửa sổ cũ, drawer
// có khi đã đóng, cuộn lại từ đầu. Duyệt bìa hay đọc một trang bản dựng là việc của 5 giây.
//
// Luật này được MÁY canh, không trông vào trí nhớ: `scripts/check-canon.mjs` chặn mọi
// target="_blank" trỏ vào /api/media (nội dung của mình) trong components/. Muốn xem file thì dùng
// component này.
//
// Nguồn ngoài (site của người khác) vẫn phải mở tab mới — không nhúng được site người ta vào drawer.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export interface MediaViewerItem {
  url: string;                 // /api/media/<id>/raw
  label?: string;
  kind?: 'image' | 'pdf' | 'frame';   // frame = trang HTML của mình (vd DOM đã lưu). Tự đoán nếu bỏ trống.
  page?: number;               // PDF: mở thẳng trang này
}

const guessKind = (it: MediaViewerItem): 'image' | 'pdf' | 'frame' =>
  it.kind ?? (it.page != null || /\.pdf(\?|#|$)/i.test(it.url) ? 'pdf' : 'image');

/**
 * Lớp phủ xem file. Đóng bằng: phím Esc · bấm nền · nút ✕. Ba đường vì người dùng khác nhau
 * với tay tới đường khác nhau, và không đường nào được là "đóng cả drawer".
 */
export function MediaViewer({ item, onClose }: { item: MediaViewerItem; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    // capture: bắt TRƯỚC handler Esc của Drawer, nếu không thì một phím Esc đóng luôn cả drawer bên dưới.
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  const kind = guessKind(item);
  const src = kind === 'pdf' && item.page != null ? `${item.url}#page=${item.page}` : item.url;

  return (
    <div onClick={onClose} role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(6,8,12,.82)',
        display: 'flex', flexDirection: 'column', padding: 24, gap: 10, backdropFilter: 'blur(2px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e8ebf0', flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label ?? 'Xem'}
        </span>
        <span style={{ fontSize: 11, color: '#9aa2b0' }}>Esc hoặc bấm ra ngoài để đóng</span>
        <button type="button" onClick={onClose} aria-label="Đóng"
          style={{ marginLeft: 'auto', cursor: 'pointer', border: '1px solid #3a4150', background: 'transparent',
            color: '#e8ebf0', borderRadius: 6, padding: '3px 11px', fontSize: 13 }}>✕</button>
      </div>
      {/* stopPropagation: bấm vào CHÍNH file thì không đóng — chỉ bấm nền mới đóng. */}
      <div onClick={(e) => e.stopPropagation()} role="presentation"
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'pdf' || kind === 'frame' ? (
          <iframe src={src} title={item.label ?? 'PDF'}
            style={{ width: '100%', height: '100%', border: '1px solid #2a303c', borderRadius: 8, background: '#fff' }} />
        ) : (
          <img src={src} alt={item.label ?? ''}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 18px 60px rgba(0,0,0,.5)' }} />
        )}
      </div>
    </div>
  );
}

/**
 * Hook gọn cho chỗ dùng: `const v = useMediaViewer()` → `v.open({url,label})` + `{v.node}`.
 * Đặt thành hook để mỗi chỗ dùng khỏi tự nuôi một useState + tự nhớ render lớp phủ (quên render =
 * bấm không ra gì, đúng kiểu lỗi im lặng).
 */
export function useMediaViewer() {
  const [item, setItem] = useState<MediaViewerItem | null>(null);
  return {
    open: (it: MediaViewerItem) => setItem(it),
    close: () => setItem(null),
    node: item ? <MediaViewer item={item} onClose={() => setItem(null)} /> : null,
  };
}

/** Ô bấm được, dùng thay cho <a target="_blank"> khi nội dung là file của mình. */
export function MediaOpen({ item, onOpen, style, title, children }: {
  item: MediaViewerItem; onOpen: (it: MediaViewerItem) => void;
  style?: CSSProperties; title?: string; children: ReactNode;
}) {
  return (
    <button type="button" title={title ?? item.label} onClick={() => onOpen(item)}
      style={{ cursor: 'zoom-in', border: 'none', background: 'transparent', padding: 0, textAlign: 'left',
        color: 'inherit', font: 'inherit', ...style }}>
      {children}
    </button>
  );
}
