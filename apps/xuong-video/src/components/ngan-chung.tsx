'use client';
// Drawer chung của cả studio (anh chốt 09/10/2026: bấm link KHÔNG được mở trang khác, phải là drawer).
//   moNgan({ loai: 'thu-vien' | 'so-chi-phi' | 'xem', … }) gọi được từ bất kỳ đâu (header, form shot, sổ, ảnh, clip, bản xuất).
//   Thư viện + sổ chi phí ghi vào URL (?ngan=…) → F5 mở lại đúng; xem tệp (ảnh/clip/âm) là drawer hẹp chồng lên, có nút Tải (cùng nguồn, không mở tab).
import { Suspense, useEffect, useState } from 'react';
import { useModalParam } from '@/lib/use-modal-param';
import { Ngan } from './ngan';
import { ThuVienNoiDung } from './thu-vien';
import { SoChiPhi } from './so-chi-phi';
import { KhoNoiDung, maDich, docDich, type DichKho } from './kho';

export type YeuCauNgan = { loai: 'thu-vien'; tl?: string } | { loai: 'so-chi-phi'; phim?: number } | { loai: 'xem'; url: string; ten?: string } | { loai: 'kho'; dich?: DichKho };
const SU_KIEN = 'xv-ngan';
export function moNgan(y: YeuCauNgan): void { window.dispatchEvent(new CustomEvent<YeuCauNgan>(SU_KIEN, { detail: y })); }
/** Link tải tệp R2 qua proxy cùng nguồn (Content-Disposition: attachment) — tải về, không mở trang. */
export const linkTai = (url: string) => `/api/xv/tai?u=${encodeURIComponent(url)}`;

function Host() {
  const ngan = useModalParam('ngan');
  const [tl, setTl] = useState('');
  const [xem, setXem] = useState<{ url: string; ten?: string } | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      const y = (e as CustomEvent<YeuCauNgan>).detail;
      if (y.loai === 'xem') setXem({ url: y.url, ten: y.ten });
      else if (y.loai === 'kho') ngan.open('kho', maDich(y.dich ?? {}) || null);
      else { if (y.loai === 'thu-vien') setTl(y.tl ?? ''); ngan.open(y.loai, y.loai === 'so-chi-phi' ? y.phim ?? null : null); }
    };
    window.addEventListener(SU_KIEN, h); return () => window.removeEventListener(SU_KIEN, h);
  }, [ngan]);
  const laVideo = !!xem && /\.(mp4|webm|mov)(\?|$)/i.test(xem.url);
  const laAm = !!xem && /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(xem.url);
  return (<>
    {ngan.is('thu-vien') && (
      <Ngan onClose={ngan.close} tieuDe="🎬 Thư viện điện ảnh">
        <ThuVienNoiDung key={tl} tlDau={tl} />
      </Ngan>
    )}
    {ngan.is('kho') && (
      <Ngan onClose={ngan.close} tieuDe="📦 Kho tài sản">
        <KhoNoiDung key={ngan.id ?? ''} dich={docDich(ngan.id)} />
      </Ngan>
    )}
    {ngan.is('so-chi-phi') && (
      <Ngan onClose={ngan.close} tieuDe="💰 Sổ chi phí">
        <SoChiPhi phimDau={ngan.numId ?? undefined} />
      </Ngan>
    )}
    {xem && (
      <Ngan nho onClose={() => setXem(null)} tieuDe={xem.ten || (laVideo ? 'Clip' : laAm ? 'Âm thanh' : 'Ảnh')}
        nut={<a href={linkTai(xem.url)} download className="xv-btn chinh" style={{ textDecoration: 'none' }}>⬇ Tải về</a>}>
        {laVideo ? <video key={xem.url} src={xem.url} controls autoPlay playsInline style={{ width: '100%', maxHeight: '80vh', borderRadius: 8, background: '#000' }} />
          : laAm ? <audio key={xem.url} src={xem.url} controls autoPlay style={{ width: '100%' }} />
          : <img src={xem.url} alt="" data-khong-phong-to="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }} />}
      </Ngan>
    )}
  </>);
}
export function NganChung() { return <Suspense fallback={null}><Host /></Suspense>; }

/** Nút mở drawer chung — dùng ở chỗ là server component (header). */
export function NutNgan({ y, children, className = 'xv-mono' }: { y: YeuCauNgan; children: React.ReactNode; className?: string }) {
  return <button type="button" className={`xv-lienket ${className}`} onClick={() => moNgan(y)}>{children}</button>;
}
