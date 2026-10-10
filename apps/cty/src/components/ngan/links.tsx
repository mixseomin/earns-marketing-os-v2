'use client';
// Host chồng ngăn (gắn một lần ở layout): bấm BẤT KỲ link thực thể nào — trên màn hay trong ngăn, kể cả <a> trong SVG và
// <Link> của Next — thì mở ngăn chồng lên thay vì đổi màn (luật 5). Bắt ở pha capture của document nên chạy trước Next Link.
// Khoá đã có trong chồng → kéo lên trên cùng (luật 3). Link có `data-thay` (bộ lọc trong ngăn nhật ký) thay đúng tầng đang đứng.
// Trong lúc máy chủ dựng ngăn: một tầng "Đang tải…" hiện ngay (luật 7). Thanh đầu (.cty-top) và Cmd/Ctrl-bấm: điều hướng thường.
import { useEffect, useState, useTransition } from 'react';
import { khoaTuHref, moKhoa, urlVoiChong } from '@/lib/ngan';
import { useChong, rongTang } from './tang';
import { usePathname, useRouter } from 'next/navigation';

export const SU_KIEN_MO = 'cty:mo-ngan';
/** Mở ngăn từ mã JS (vd ô sơ đồ có data-href) — cùng đường với bấm link. */
export function moNgan(href: string) { window.dispatchEvent(new CustomEvent(SU_KIEN_MO, { detail: href })); }

export function NganLinks() {
  const { chong } = useChong(); const router = useRouter(); const path = usePathname();
  const [dangMo, chuyen] = useTransition();
  const [cho, setCho] = useState<string | null>(null);

  useEffect(() => {
    const mo = (href: string, thay?: number) => {
      const khoa = khoaTuHref(href); if (!khoa) return false;
      setCho(khoa);
      chuyen(() => router.replace(urlVoiChong(path, window.location.search, moKhoa(chong, khoa, thay)), { scroll: false }));
      return true;
    };
    const bam = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a'); if (!a || a.closest('.cty-top') || a.target === '_blank') return;
      const tangEl = a.closest<HTMLElement>('[data-tang]');
      if (a.hasAttribute('data-thay') && !tangEl) return;   // bộ lọc trên chính trang nhật ký: lọc trang như thường
      if (tangEl && tangEl.classList.contains('nk-duoi')) return;   // bấm vào ngăn dưới = quay về (TangNgan lo)
      const thay = a.hasAttribute('data-thay') && tangEl ? Number(tangEl.dataset.tang) : undefined;
      if (mo(a.getAttribute('href') ?? a.getAttribute('xlink:href') ?? '', thay)) { e.preventDefault(); e.stopPropagation(); }
    };
    const tuMa = (e: Event) => { mo(String((e as CustomEvent).detail)); };
    document.addEventListener('click', bam, true); window.addEventListener(SU_KIEN_MO, tuMa);
    return () => { document.removeEventListener('click', bam, true); window.removeEventListener(SU_KIEN_MO, tuMa); };
  }, [chong, path, router]);

  useEffect(() => { if (!dangMo) setCho(null); }, [dangMo]);
  useEffect(() => { document.body.style.overflow = chong.length ? 'hidden' : ''; }, [chong.length]);

  if (!dangMo || !cho || chong.includes(cho)) return null;
  return (
    <aside className="nk nk-cho" style={{ width: rongTang(chong.length), zIndex: 60 + chong.length * 2 }} aria-busy="true">
      <div className="nk-dau"><div className="nk-tieu">Đang mở…</div></div>
      <div className="nk-than"><p className="cty-muted">Đang tải…</p></div>
    </aside>
  );
}
