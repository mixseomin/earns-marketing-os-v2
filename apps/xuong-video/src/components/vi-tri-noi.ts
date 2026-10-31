'use client';

// Vị trí cho lớp nổi neo vào một nút (menu ⋯, ô chọn select2…): position FIXED theo toạ độ nút, kẹp trong khung nhìn, thiếu chỗ bên dưới thì
// lật lên trên. Trước đây dùng position:absolute trong ngăn phim (overflow:auto) → lớp nổi thò ra mép ngăn là bị cắt mất chữ (#1213).
// Neo là một phần tử (ref) hoặc một ĐIỂM trên màn (bảng ＋ mở tại chỗ bấm trên timeline) — cùng một luật kẹp/lật.
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export type DiemNeo = { x: number; y: number };
/** Tắt tạm `title` của các phần tử CHA khi lớp nổi đang mở: thẻ shot lưới là một <button title="…"> bọc nhãn, rê vào nhãn thì sau ~1s tooltip
 *  mặc định của trình duyệt (title của cha) hiện đè lên lớp nổi (#1392). Trả hàm khôi phục. Nằm trong hook để MỌI lớp nổi neo vào nút
 *  (nhãn kỹ thuật, điểm Murch, kiểm khung, ô chọn, menu ⋯) cùng được, không vá từng cái. */
/** Cất cả `data-goi-y` (thẻ gợi ý nhà, goi-y.tsx) của cha: chip điểm Murch nằm trong khối clip timeline có data-goi-y → hai thẻ đè nhau.
 *  Báo host ẩn thẻ đang hiện / đang chờ hiện (sự kiện GOI_Y_AN). */
export const GOI_Y_AN = 'xv-goi-y-an';
const THUOC_TINH_CHA = ['title', 'data-goi-y'] as const;
export function tamTatTitleCha(el: HTMLElement | null): () => void {
  const ds: [HTMLElement, string, string][] = [];
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) for (const a of THUOC_TINH_CHA) { const t = p.getAttribute(a); if (t != null) { ds.push([p, a, t]); p.removeAttribute(a); } }
  if (ds.some(([, a]) => a === 'data-goi-y') && typeof window !== 'undefined') window.dispatchEvent(new Event(GOI_Y_AN));
  return () => { for (const [p, a, t] of ds) if (!p.hasAttribute(a)) p.setAttribute(a, t); };
}
/** HƯỚNG MỞ (anh 31/10/2026): lớp nổi LUÔN mở sang PHẢI nút (mép trái lớp nổi = mép trái nút); chỉ khi bên phải không đủ chỗ (nút sát mép
 *  phải màn) mới lật sang trái (mép phải lớp nổi = mép phải nút); thiếu chỗ bên dưới thì lật lên trên. Không có tuỳ chọn ép hướng — cùng một
 *  luật cho mọi lớp nổi, nơi gọi không tự chọn được (luật cũng ở skill ydni § lớp nổi neo vào nút). */
export function useViTriNoi(neo: RefObject<HTMLElement | null> | DiemNeo, mo: boolean, o: { rong: number; caoToiDa?: number }): CSSProperties {
  const [st, setSt] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  useLayoutEffect(() => { if (!mo || !('current' in neo)) return; return tamTatTitleCha(neo.current); }, [mo, 'current' in neo ? neo : null]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!mo) return;
    const tinh = () => {
      const r = 'current' in neo ? neo.current?.getBoundingClientRect() : { left: neo.x, right: neo.x, top: neo.y, bottom: neo.y };
      if (!r) return;
      const vw = window.innerWidth, vh = window.innerHeight, le = 8;
      const rong = Math.min(o.rong, vw - 2 * le);
      let left = r.left + rong <= vw - le ? r.left : r.right - rong;   // phải trước, sát mép phải mới lật trái
      left = Math.max(le, Math.min(left, vw - rong - le));
      const duoi = vh - r.bottom - le, tren = r.top - le;
      const caoMuon = o.caoToiDa ?? 420;
      const lenTren = duoi < Math.min(caoMuon, 240) && tren > duoi;
      const cao = Math.min(caoMuon, lenTren ? tren : duoi);
      setSt({ position: 'fixed', left, width: rong, maxHeight: cao, overflow: 'auto', zIndex: 80, ...(lenTren ? { bottom: vh - r.top + 2 } : { top: r.bottom + 2 }) });
    };
    tinh();
    window.addEventListener('resize', tinh); window.addEventListener('scroll', tinh, true);
    return () => { window.removeEventListener('resize', tinh); window.removeEventListener('scroll', tinh, true); };
  }, [mo, 'current' in neo ? neo : `${neo.x},${neo.y}`, o.rong, o.caoToiDa]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
