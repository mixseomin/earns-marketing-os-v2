'use client';
// MỘT TẦNG trong chồng ngăn (skill ngan-keo). Tầng i hẹp hơn tầng dưới 64px → mép ngăn dưới lộ ra; bấm vào ngăn dưới (mép
// lộ) = quay về nó, đóng các tầng trên (luật 1). ✕ đóng tầng này + mọi tầng trên; Esc / bấm nền chỉ đóng tầng trên cùng (luật 2).
// Đóng = ghi lại `?ngan=` bằng router.replace (không thêm lịch sử) → máy chủ dựng lại chồng từ URL, F5 mở lại y vậy (luật 4).
// Đóng NGAY ở máy (#1300, 11/10/2026): máy giữ CHỒNG MONG ĐỢI (kết quả của lần đóng/mở vừa bấm); tầng không có trong đó ẩn liền, máy chủ
// dựng lại trang sau (trước: ngăn đứng chờ máy chủ 1,35 giây trên trang phòng thử). Mốc chỉ xoá khi URL KHỚP ĐÚNG chồng mong đợi
// (NganLinks) → kết quả cũ về muộn (đóng hai lần liền) không làm tầng đã đóng hiện lại.
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { docChong, urlVoiChong, rongKeo, rongHopLe, NK_HUT, NK_KHOA } from '@/lib/ngan';

// Bề rộng gốc nằm ở biến CSS --nk-rong trên <html> (chưa kéo = 1360px): kéo chỉ đổi một biến, mọi tầng + tầng "Đang mở…" theo ngay,
// không bắt React vẽ lại mỗi nhịp chuột. Trần 98vw giữ ngăn trong màn khi cửa sổ thu nhỏ sau khi đã kéo rộng.
export const rongTang = (tang: number) => `calc(min(var(--nk-rong, 1360px), 98vw) - ${tang * NK_HUT}px)`;
const datRong = (px: number | null) => { const r = document.documentElement.style; if (px == null) r.removeProperty('--nk-rong'); else r.setProperty('--nk-rong', `${px}px`); };
/** Áp bề rộng đã nhớ (gọi một lần khi trang lên — NganLinks). */
export function apRongDaLuu() { try { datRong(rongHopLe(localStorage.getItem(NK_KHOA))); } catch { /* không có kho: mặc định */ } }

/** Tay nắm ở mép trái tầng trên cùng: kéo = đổi bề rộng (nhớ theo trình duyệt), bấm đúp = về mặc định.
 *  Pointer Events (chuột, cảm ứng, bút cùng một đường) và nghe trên CỬA SỔ, không bắt con trỏ vào tay nắm: React vẽ lại thẻ giữa lượt kéo thì
 *  mất quyền bắt, pointerup rơi chỗ khác, lượt kéo không bao giờ kết thúc (bài học adfond keo-rong.ts). Trong lúc kéo khoá iframe (văn phòng
 *  pixel trong ngăn phòng) — con trỏ đi qua iframe thì trang mẹ mất pointermove, ngăn đứng khựng. */
function KeoMep({ tang }: { tang: number }) {
  const bat = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const ngan = e.currentTarget.parentElement!; const lech = window.innerWidth - e.clientX - ngan.getBoundingClientRect().width;
    let cuoi: number | null = null;
    const buoc = (ev: PointerEvent) => { cuoi = rongKeo(window.innerWidth, ev.clientX, lech, tang); datRong(cuoi); };
    const tha = () => {
      window.removeEventListener('pointermove', buoc); window.removeEventListener('pointerup', tha); window.removeEventListener('pointercancel', tha);
      document.body.classList.remove('nk-dang-keo');
      if (cuoi != null) try { localStorage.setItem(NK_KHOA, String(cuoi)); } catch { /* chỉ giữ tới F5 */ }
    };
    document.body.classList.add('nk-dang-keo');
    window.addEventListener('pointermove', buoc); window.addEventListener('pointerup', tha); window.addEventListener('pointercancel', tha);
  };
  const veGoc = () => { datRong(null); try { localStorage.removeItem(NK_KHOA); } catch { /* không có kho */ } };
  return <div className="nk-keo" role="separator" aria-orientation="vertical" aria-label="Kéo để đổi bề rộng ngăn" title="Kéo để đổi bề rộng · bấm đúp: về mặc định" onPointerDown={bat} onDoubleClick={veGoc} />;
}

let mongDoi: string[] | null = null; const nghe = new Set<() => void>();
const bao = () => nghe.forEach((f) => f());
export const datMongDoi = (c: string[] | null) => { mongDoi = c && docChong(c); bao(); };   // chuẩn hoá như lúc đọc URL → so khớp được; null = bỏ mốc
export const layMongDoi = () => mongDoi;
/** URL vừa đổi: khớp đúng chồng đang chờ → máy chủ đã theo kịp, bỏ mốc. */
export const xetMongDoi = (urlChong: string[]) => { if (mongDoi && mongDoi.join('|') === urlChong.join('|')) { mongDoi = null; bao(); } };
const useMongDoi = () => useSyncExternalStore((f) => { nghe.add(f); return () => { nghe.delete(f); }; }, () => mongDoi, () => null);

export function useChong() {
  const router = useRouter(); const path = usePathname(); const sp = useSearchParams();
  const chong = docChong(sp.getAll('ngan'));
  const dat = (c: string[]) => { datMongDoi(c); router.replace(urlVoiChong(path, `?${sp.toString()}`, c), { scroll: false }); };
  return { chong, dat };
}

export function TangNgan({ khoa, tang, tong, tieuDe, children }: { khoa: string; tang: number; tong: number; tieuDe: React.ReactNode; children: React.ReactNode }) {
  const { chong, dat } = useChong(); const md = useMongDoi();
  const hien = (k: string) => !md || md.includes(k);
  const an = !hien(khoa);
  const tren = chong.reduce((t, k, i) => (hien(k) ? i : t), -1);   // tầng trên cùng ĐANG HIỆN (tầng đang đóng dở không tính)
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
        {laTren && <KeoMep tang={tang} />}
        <div className="nk-dau"><div className="nk-tieu">{tieuDe}</div><button type="button" className="nk-dong" onClick={() => dongTu(tang)} aria-label="Đóng ngăn">✕</button></div>
        <div className="nk-than">{children}</div>
      </aside>
    </>
  );
}
