'use client';
// Drawer dùng chung của studio: trượt từ phải, Esc / bấm nền để đóng. `nho` = drawer hẹp chồng lên drawer lớn.
import { useEffect, type ReactNode } from 'react';

export function Ngan({ onClose, nho, children }: { onClose: () => void; nho?: boolean; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <><div className={`xv-backdrop${nho ? ' nho' : ''}`} onClick={onClose} /><div className={`xv-drawer${nho ? ' nho' : ''}`}>{children}</div></>;
}
