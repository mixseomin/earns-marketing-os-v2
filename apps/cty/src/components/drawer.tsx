'use client';
// Hộp trượt cho CÔNG CỤ không phải bản ghi (hòm góp ý, chi tiết một ô sơ đồ) — nằm trên chồng ngăn kéo. Bản ghi (nhân sự,
// phòng, nhật ký, luật, mục tiêu) mở bằng chồng ngăn chuẩn ngan-keo ở components/ngan, KHÔNG dùng hộp này.
import { useEffect } from 'react';

export function Drawer({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const cu = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = cu; };
  }, [onClose]);
  return (
    <div className="cty-drawer-nen" onClick={onClose}>
      <aside className="cty-drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="cty-drawer-dau"><span className="cty-drawer-ten">{title}</span><button type="button" onClick={onClose} aria-label="Đóng">×</button></div>
        <div className="cty-drawer-than">{children}</div>
      </aside>
    </div>
  );
}
