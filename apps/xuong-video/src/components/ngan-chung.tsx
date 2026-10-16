'use client';
// Drawer chung của cả studio (anh chốt 09/10/2026: bấm link KHÔNG được mở trang khác, phải là drawer).
//   moNgan({ loai: 'thu-vien' | 'so-chi-phi' | 'nguon-ai' | 'xem', … }) gọi được từ bất kỳ đâu (header, form shot, sổ, ảnh, clip, bản xuất).
//   Mọi ngăn chung là MỘT CHỒNG trên URL (?nc=loai:id, đúng thứ tự) → F5 mở lại đúng; xem tệp (ảnh/clip/âm) là tầng hẹp, có nút Tải (cùng nguồn, không mở tab).
import { Suspense, useEffect, useState } from 'react';
import { Ngan } from './ngan';
import { ThuVienNoiDung, ChiTietKyThuatNgan } from './thu-vien';
import { SoChiPhi } from './so-chi-phi';
import { KhoNoiDung, maDich, docDich, type DichKho } from './kho';
import { NguonShotNoiDung } from './nguon-shot';
import { NoiKhungTap } from './noi-khung';
import { BoSetXem } from './bo-set-xem';
import { SoNguonAi } from './nguon-ai-ui';
import { SoLienMachXem } from './so-lien-mach-ui';

export type YeuCauNgan = { loai: 'lien-mach'; tapId: number; canh?: string } | { loai: 'thu-vien'; tl?: string } | { loai: 'so-chi-phi'; phim?: number } | { loai: 'xem'; url: string; ten?: string } | { loai: 'kho'; dich?: DichKho } | { loai: 'nguon'; canhId: number } | { loai: 'noi-khung'; tapId: number } | { loai: 'bo-set'; tapId: number; canhId?: number | null } | { loai: 'ky-thuat'; ma: string } | { loai: 'nguon-ai' };
const SU_KIEN = 'xv-ngan';
export function moNgan(y: YeuCauNgan): void { window.dispatchEvent(new CustomEvent<YeuCauNgan>(SU_KIEN, { detail: y })); }
/** Link tải tệp R2 qua proxy cùng nguồn (Content-Disposition: attachment) — tải về, không mở trang. */
export const linkTai = (url: string) => `/api/xv/tai?u=${encodeURIComponent(url)}`;

/** Một tầng của CHỒNG ngăn chung. loai:id là khoá (mở lại cùng khoá = kéo tầng đó lên, không dựng bản thứ hai). */
type Lop = { loai: YeuCauNgan['loai']; id: string; ten?: string };
const khoaLop = (l: Lop) => `${l.loai}:${l.id}`;
function lopCua(y: YeuCauNgan): Lop {
  switch (y.loai) {
    case 'xem': return { loai: 'xem', id: y.url, ten: y.ten };
    case 'kho': return { loai: 'kho', id: maDich(y.dich ?? {}) || '' };
    case 'nguon': return { loai: 'nguon', id: String(y.canhId) };
    case 'ky-thuat': return { loai: 'ky-thuat', id: y.ma };
    case 'noi-khung': return { loai: 'noi-khung', id: String(y.tapId) };
    case 'bo-set': return { loai: 'bo-set', id: `${y.tapId}.${y.canhId ?? 0}` };
    case 'lien-mach': return { loai: 'lien-mach', id: `${y.tapId}~${encodeURIComponent(y.canh ?? '')}` };
    case 'thu-vien': return { loai: 'thu-vien', id: y.tl ?? '' };
    case 'so-chi-phi': return { loai: 'so-chi-phi', id: y.phim != null ? String(y.phim) : '' };
    default: return { loai: y.loai, id: '' };
  }
}
// CHỒNG NGĂN TRÊN URL (anh 17/10/2026: "đóng thì không ảnh hưởng các drawer đang mở"; skill ngan-keo luật 1–4): ?nc=lien-mach:19~&nc=thu-vien:
// đúng thứ tự từ dưới lên → F5 mở lại đúng chồng. Trước đây cả nhóm ngăn chung dùng MỘT ô ?ngan= → mở sổ liền mạch là đóng mất thư viện đang xem.
// Link cũ ?ngan=<loai>&nganId=<id> vẫn đọc được (thành tầng dưới cùng), ghi lại theo dạng mới. Xem tệp (url dài) không lên URL.
const URL_CHONG = 'nc';
function docChong(): Lop[] {
  const sp = new URLSearchParams(window.location.search);
  const ds: Lop[] = sp.getAll(URL_CHONG).map((x) => { const i = x.indexOf(':'); return (i < 0 ? { loai: x, id: '' } : { loai: x.slice(0, i), id: x.slice(i + 1) }) as Lop; });
  const cu = sp.get('ngan'); if (cu) ds.unshift({ loai: cu as Lop['loai'], id: sp.get('nganId') ?? '' });
  return ds;
}
function ghiChong(ds: Lop[]): void {
  const u = new URL(window.location.href);
  u.searchParams.delete(URL_CHONG); u.searchParams.delete('ngan'); u.searchParams.delete('nganId');
  for (const l of ds) if (l.loai !== 'xem') u.searchParams.append(URL_CHONG, khoaLop(l));
  window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`);
}

function Host() {
  const [chong, setChong] = useState<Lop[]>([]);
  const datChong = (f: (ds: Lop[]) => Lop[]) => setChong((ds) => { const moi = f(ds); ghiChong(moi); return moi; });
  useEffect(() => { const ds = docChong(); setChong(ds); ghiChong(ds); }, []);
  useEffect(() => {
    // Mở = chồng lên trên cùng; khoá đã có trong chồng → kéo tầng đó lên (luật 3), không dựng bản thứ hai.
    const h = (e: Event) => { const l = lopCua((e as CustomEvent<YeuCauNgan>).detail); datChong((ds) => [...ds.filter((x) => khoaLop(x) !== khoaLop(l)), l]); };
    window.addEventListener(SU_KIEN, h); return () => window.removeEventListener(SU_KIEN, h);
  }, []);
  // Đóng một tầng = bỏ tầng đó + các tầng TRÊN nó (luật 2); tầng dưới giữ nguyên.
  const dong = (k: string) => datChong((ds) => { const i = ds.findIndex((x) => khoaLop(x) === k); return i < 0 ? ds : ds.slice(0, i); });
  return <>{chong.map((l) => <TangNgan key={khoaLop(l)} l={l} onClose={() => dong(khoaLop(l))} />)}</>;
}

function TangNgan({ l, onClose }: { l: Lop; onClose: () => void }) {
  const n = Number(l.id);
  switch (l.loai) {
    case 'thu-vien': return <Ngan onClose={onClose} tieuDe="🎬 Thư viện điện ảnh"><ThuVienNoiDung tlDau={l.id} /></Ngan>;
    case 'kho': return <Ngan onClose={onClose} tieuDe="📦 Kho tài sản"><KhoNoiDung dich={docDich(l.id || null)} /></Ngan>;
    case 'noi-khung': return <Ngan onClose={onClose} tieuDe="⛓ Nối khung cả tập"><NoiKhungTap tapId={n} /></Ngan>;
    case 'bo-set': return <Ngan onClose={onClose} tieuDe="🧊 Bộ set 3D"><BoSetXem tapId={Number(l.id.split('.')[0])} canhId={Number(l.id.split('.')[1]) || null} /></Ngan>;
    case 'lien-mach': { const [t, c] = l.id.split('~'); const canh = decodeURIComponent(c ?? '');
      return <Ngan onClose={onClose} tieuDe={`📒 Sổ liền mạch${canh ? ` · ${canh}` : ''}`}><SoLienMachXem tapId={Number(t)} canh={canh || undefined} /></Ngan>; }
    case 'ky-thuat': return <Ngan nho onClose={onClose} tieuDe="🎬 Kỹ thuật điện ảnh"><ChiTietKyThuatNgan ma={l.id} /></Ngan>;
    case 'nguon': return <Ngan onClose={onClose} tieuDe="🔗 Nguồn của shot"><NguonShotNoiDung canhId={n} /></Ngan>;
    case 'nguon-ai': return <Ngan onClose={onClose} tieuDe="🔌 Sổ nguồn AI"><SoNguonAi /></Ngan>;
    case 'so-chi-phi': return <Ngan onClose={onClose} tieuDe="💰 Sổ chi phí"><SoChiPhi phimDau={l.id ? n : undefined} /></Ngan>;
    case 'xem': {
      const laVideo = /\.(mp4|webm|mov)(\?|$)/i.test(l.id), laAm = /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(l.id);
      return <Ngan nho onClose={onClose} tieuDe={l.ten || (laVideo ? 'Clip' : laAm ? 'Âm thanh' : 'Ảnh')}
        nut={<a href={linkTai(l.id)} download className="xv-btn chinh" style={{ textDecoration: 'none' }}>⬇ Tải về</a>}>
        {laVideo ? <video src={l.id} controls autoPlay playsInline style={{ width: '100%', maxHeight: '80vh', borderRadius: 8, background: '#000' }} />
          : laAm ? <audio src={l.id} controls autoPlay style={{ width: '100%' }} />
          : <img src={l.id} alt="" data-khong-phong-to="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }} />}
      </Ngan>;
    }
    default: return null;
  }
}
export function NganChung() { return <Suspense fallback={null}><Host /></Suspense>; }

/** Nút mở drawer chung — dùng ở chỗ là server component (header). */
export function NutNgan({ y, children, className = 'xv-mono' }: { y: YeuCauNgan; children: React.ReactNode; className?: string }) {
  return <button type="button" className={`xv-lienket ${className}`} onClick={() => moNgan(y)}>{children}</button>;
}
