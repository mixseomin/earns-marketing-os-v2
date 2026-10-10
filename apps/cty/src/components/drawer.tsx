'use client';
// Drawer dùng chung của cty.on.tc: hồ sơ nhân sự / phòng (intercepting route @drawer), chi tiết ô sơ đồ, hòm góp ý.
// Phải bên phải trên máy tính, tấm toàn màn trên điện thoại. Esc / bấm nền / × là đóng.
// DrawerLinks (gắn ở layout): bấm mọi link nội bộ /nhan-su/* · /phong/* — kể cả <a> trong SVG, thứ Next <Link> không bọc được —
// thì đi bằng router.push để route bị chặn mở trong drawer thay vì chuyển trang. Cmd/Ctrl-bấm vẫn mở trang đầy đủ.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

export function RouteDrawer({ children }: { children: React.ReactNode }) {
  const r = useRouter();
  return <Drawer onClose={() => r.back()}>{children}</Drawer>;
}

export const MO_TRONG_DRAWER = /^\/(nhan-su|phong)\/[^/?#]+$/;
export function DrawerLinks() {
  const r = useRouter();
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a'); if (!a) return;
      const href = a.getAttribute('href') ?? a.getAttribute('xlink:href') ?? '';
      if (!MO_TRONG_DRAWER.test(href)) return;
      e.preventDefault(); r.push(href, { scroll: false });
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [r]);
  return null;
}
