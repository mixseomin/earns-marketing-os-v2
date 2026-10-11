'use client';
// MỘT TẦNG trong chồng ngăn (skill ngan-keo). Tầng i hẹp hơn tầng dưới 64px → mép ngăn dưới lộ ra; bấm vào ngăn dưới (mép
// lộ) = quay về nó, đóng các tầng trên (luật 1). ✕ đóng tầng này + mọi tầng trên; Esc / bấm nền chỉ đóng tầng trên cùng (luật 2).
// Đóng = ghi lại `?ngan=` bằng router.replace (không thêm lịch sử) → máy chủ dựng lại chồng từ URL, F5 mở lại y vậy (luật 4).
// Đóng NGAY ở máy (#1300, 11/10/2026): các tầng sắp đóng ẩn liền, máy chủ dựng lại trang sau — trước đó ngăn đứng chờ máy chủ
// (trang phòng thử 1,7–1,9 giây mỗi lần đóng, đo trên box). Mở lại / URL đổi xong thì xoá mốc ẩn (NganLinks).
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { docChong, urlVoiChong } from '@/lib/ngan';

export const rongTang = (tang: number) => `calc(min(1360px, 98vw) - ${tang * 64}px)`;

let anTu = Infinity; const nghe = new Set<() => void>();   // tầng ≥ anTu đang đóng: ẩn trước khi máy chủ trả trang mới
const bao = () => nghe.forEach((f) => f());
export const datAnTu = (i: number) => { if (i < anTu) { anTu = i; bao(); } };   // chỉ LÙI xuống: đang chờ máy chủ thì không tầng nào được hiện lại
export const boAnTu = () => { if (anTu !== Infinity) { anTu = Infinity; bao(); } };   // URL đã đổi xong (NganLinks)
export const layAnTu = () => anTu;   // mở ngăn khi máy chủ chưa trả trang đóng: bỏ các tầng đang đóng dở khỏi URL mới
const useAnTu = () => useSyncExternalStore((f) => { nghe.add(f); return () => { nghe.delete(f); }; }, () => anTu, () => Infinity);

export function useChong() {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const chong = docChong(sp.getAll('ngan'));
  const dat = (c: string[]) => { if (c.length < chong.length) datAnTu(c.length); router.replace(urlVoiChong(path, `?${sp.toString()}`, c), { scroll: false }); };
  return { chong, dat };
}

export function TangNgan({ khoa, tang, tong, tieuDe, children }: { khoa: string; tang: number; tong: number; tieuDe: React.ReactNode; children: React.ReactNode }) {
  const { chong, dat } = useChong(); const anTuNay = useAnTu(); const an = anTuNay <= tang;
  const tren = Math.min(tong, anTuNay) - 1;   // tầng trên cùng ĐANG HIỆN (tầng đang đóng dở không tính)
  const laTren = tang === tren;
  const dongTu = (i: number) => dat(chong.slice(0, i));
  useEffect(() => {
    if (!laTren) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.cty-drawer-nen')) dongTu(tang); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });
  if (an) return null;
  return (
    <>
      {tang === 0 && <div className="nk-nen" onClick={() => dongTu(tren)} />}
      <aside className={`nk${laTren ? '' : ' nk-duoi'}`} data-khoa={khoa} data-tang={tang} role="dialog" aria-modal={laTren}
        style={{ width: rongTang(tang), zIndex: 60 + tang * 2 }}
        onClickCapture={laTren ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); dongTu(tang + 1); }}
        title={laTren ? undefined : 'Bấm để quay về ngăn này'}>
        <div className="nk-dau"><div className="nk-tieu">{tieuDe}</div><button type="button" className="nk-dong" onClick={() => dongTu(tang)} aria-label="Đóng ngăn">✕</button></div>
        <div className="nk-than">{children}</div>
      </aside>
    </>
  );
}
