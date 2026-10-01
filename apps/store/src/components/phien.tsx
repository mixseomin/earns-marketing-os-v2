'use client';
// Sổ PHIÊN khách (mos2 /shop › Khách trực tiếp): trang xem, % cuộn, click, bước phễu. Gom sự kiện vào hàng đợi, gửi mỗi 5 giây và khi rời
// trang (sendBeacon); nhịp 15 giây khi tab đang hiện để biết khách còn trên site. Không gửi chữ khách gõ — form chỉ báo "đã điền".
// Bước mua (xem sp, thêm giỏ, checkout, trả tiền, đặt hàng) đi qua bao() ở do.ts — không gắn tay từng chỗ.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type Ev = { l: string; t: string; c?: Record<string, unknown>; ts: number };
const cho: Ev[] = [];
let daGuiMeta = false;
let cuonMax = 0;

function lay(kho: Storage, k: string) {
  try { let v = kho.getItem(k); if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); kho.setItem(k, v); } return v; }
  catch { return 'x' + Math.random().toString(36).slice(2); }
}
/** id tab — một lượt ghé (cũng là phiên "đang xem" của trang sản phẩm). */
export const idPhien = () => lay(sessionStorage, 'phien');

export function ghiPhien(l: string, c?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  cho.push({ l, t: location.pathname, c, ts: Date.now() });
  if (['them_gio', 'checkout', 'tra_tien', 'dat_hang'].includes(l)) gui();   // bước phễu: gửi ngay, đừng đợi nhịp
}

function gui(roi = false) {
  if (!cho.length && !roi) return;
  const meta = daGuiMeta ? undefined : {
    k: lay(localStorage, 'khach-id'), dau: location.pathname + location.search, ref: document.referrer || null,
    tb: matchMedia('(max-width: 640px)').matches ? 'mobile' : matchMedia('(max-width: 1024px)').matches ? 'tablet' : 'desktop',
  };
  const than = JSON.stringify({ p: idPhien(), meta, cuon: cuonMax, ev: cho.splice(0, 50) });
  daGuiMeta = true;
  if (roi && navigator.sendBeacon) navigator.sendBeacon('/api/phien', new Blob([than], { type: 'application/json' }));
  else fetch('/api/phien', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: than, keepalive: true }).catch(() => null);
}

const nhanCua = (e: Element) => (e.getAttribute('aria-label') || e.getAttribute('title') || (e as HTMLElement).innerText || e.getAttribute('href') || e.tagName)
  .replace(/\s+/g, ' ').trim().slice(0, 60);

export function TheoDoiPhien() {
  const duong = usePathname();
  // Mỗi trang: một sự kiện xem trang, mốc cuộn tính lại từ 0
  useEffect(() => {
    cuonMax = 0;
    ghiPhien('xem_trang', { tieu_de: document.title.slice(0, 80) });
    if (duong === '/checkout') ghiPhien('checkout');
  }, [duong]);
  useEffect(() => {
    const MOC = [25, 50, 75, 100];
    let cho2 = 0;
    const cuon = () => {
      if (cho2) return;
      cho2 = requestAnimationFrame(() => {
        cho2 = 0;
        const h = document.documentElement.scrollHeight - innerHeight;
        const pct = h <= 0 ? 100 : Math.min(100, Math.round((scrollY / h) * 100));
        for (const m of MOC) if (pct >= m && cuonMax < m) ghiPhien('cuon', { pct: m });
        cuonMax = Math.max(cuonMax, pct);
      });
    };
    const bam = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest?.('a, button, summary, [role="button"], label, select');
      if (el) ghiPhien('click', { nhan: nhanCua(el), the: el.tagName.toLowerCase() });
    };
    let daDien = false;
    const dien = (e: Event) => {
      if (daDien || !(e.target as Element)?.closest?.('.tt-form')) return;
      daDien = true; ghiPhien('nhap_tt');
    };
    const an = () => { if (document.visibilityState === 'hidden') gui(true); };
    addEventListener('scroll', cuon, { passive: true });
    addEventListener('click', bam, { capture: true, passive: true });
    addEventListener('input', dien, { capture: true, passive: true });
    document.addEventListener('visibilitychange', an);
    addEventListener('pagehide', () => gui(true));
    const nhip = setInterval(() => { if (document.visibilityState === 'visible') { if (!cho.length) cho.push({ l: 'nhip', t: location.pathname, ts: Date.now() }); gui(); } }, 15_000);
    const xa = setInterval(() => gui(), 5_000);
    gui();
    return () => { removeEventListener('scroll', cuon); removeEventListener('click', bam, { capture: true }); removeEventListener('input', dien, { capture: true });
      document.removeEventListener('visibilitychange', an); clearInterval(nhip); clearInterval(xa); };
  }, []);
  return null;
}
