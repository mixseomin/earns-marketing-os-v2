'use client';
// Kéo đổi kích thước (cột, panel, hàng) — MỘT cơ chế cho mọi tay kéo của studio. Widget sẵn: CotKeo (cột kéo rộng) · CotCay (cột cây dính + cuộn) · CayCon/CayNut (cây có đường nối): giá trị nhớ theo trình duyệt (lib/luu-tru),
// kẹp [min, max], nhấp đúp = về mặc định. Trước đây mỗi tay kéo viết tay một lần (cột nhãn timeline); #1276 cần thêm ba.
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type PointerEvent as PE } from 'react';
import { docLT, ghiLT } from '@/lib/luu-tru';

export function useKichThuoc(khoa: string, macDinh: number, min: number, max: number) {
  // lượt dựng ĐẦU = macDinh (khớp HTML máy chủ — cùng lý do useNho), đọc giá trị đã nhớ ngay sau, trước khi vẽ
  const [v, setV] = useState(macDinh);
  useLayoutEffect(() => { const x = Number(docLT(khoa)); if (x >= min && x <= max && x !== macDinh) setV(x); }, [khoa]); // eslint-disable-line react-hooks/exhaustive-deps
  /** truc: kéo theo trục nào; chieu -1 = kéo về phía âm thì TO ra (panel bên phải, kéo mép trái). */
  const keo = (truc: 'x' | 'y', chieu: 1 | -1 = 1) => (e: PE<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const p0 = truc === 'x' ? e.clientX : e.clientY; const v0 = v; let moi = v0;
    const di = (ev: PointerEvent) => { moi = Math.round(Math.max(min, Math.min(max, v0 + chieu * ((truc === 'x' ? ev.clientX : ev.clientY) - p0)))); setV(moi); };
    const xong = () => { el.removeEventListener('pointermove', di); el.removeEventListener('pointerup', xong); el.removeEventListener('pointercancel', xong); ghiLT(khoa, String(moi)); };
    el.addEventListener('pointermove', di); el.addEventListener('pointerup', xong); el.addEventListener('pointercancel', xong);
  };
  const veMacDinh = () => { setV(macDinh); ghiLT(khoa, null); };
  return { v, keo, veMacDinh };
}

/** Tay kéo: vạch mảnh, rê thấy, con trỏ đổi cỡ. */
export function TayKeo({ truc, onPointerDown, onDoubleClick, style, title = 'Kéo để đổi kích thước · nhấp đúp = mặc định' }: { truc: 'x' | 'y'; onPointerDown: (e: PE<HTMLDivElement>) => void; onDoubleClick: () => void; style?: CSSProperties; title?: string }) {
  return <div className="xv-tay-keo" onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} title={title}
    style={{ cursor: truc === 'x' ? 'col-resize' : 'row-resize', touchAction: 'none', background: 'var(--line)', ...(truc === 'x' ? { width: 4 } : { height: 4 }), ...style }} />;
}

/** CỘT KÉO ĐƯỢC BỀ RỘNG — widget chuẩn cho mọi cột cố định cạnh nội dung (cây, danh sách, panel) — anh 01/11/2026: "các nhóm cột tree phải cho resize!!
 *  Chuẩn hoá các widget kiểu này để dùng về sau". Tay kéo ở mép phải (.xv-keo-cot), bề rộng nhớ theo trình duyệt (khoa riêng mỗi cột), nhấp đúp = mặc định. */
export function CotKeo({ khoa, macDinh, min = 160, max = 640, style, children }: { khoa: string; macDinh: number; min?: number; max?: number; style?: CSSProperties; children: ReactNode }) {
  const { v, keo, veMacDinh } = useKichThuoc(`xv-cot:${khoa}`, macDinh, min, max);
  return (
    <div style={{ flex: `0 0 ${v}px`, width: v, minWidth: 0, position: 'relative', ...style }}>
      {children}
      <div className="xv-keo-cot" onPointerDown={keo('x')} onDoubleClick={veMacDinh} title="Kéo để đổi bề rộng cột · nhấp đúp = mặc định" />
    </div>
  );
}

/** CỘT CÂY — CotKeo + dính khi cuộn + cuộn riêng (master–detail, ui-conventions §8): cây phim, cây thành phần, danh sách shot… dùng MỘT widget này. */
export function CotCay({ khoa, macDinh = 250, min, max, children }: { khoa: string; macDinh?: number; min?: number; max?: number; children: ReactNode }) {
  return (
    <CotKeo khoa={khoa} macDinh={macDinh} min={min} max={max} style={{ position: 'sticky', top: 'calc(var(--dau-cao, var(--ngan-py, 0px)) - var(--ngan-py, 0px) + 8px)', alignSelf: 'flex-start' }}>
      <nav style={{ maxHeight: 'calc(100vh - var(--dau-cao, 0px) - 24px)', overflowY: 'auto', display: 'grid', gap: 1, alignContent: 'start', paddingRight: 6 }}>{children}</nav>
    </CotKeo>
  );
}

/** CÂY CÓ ĐƯỜNG NỐI — CayCon bọc các con, mỗi con một CayNut (lồng bao nhiêu tầng cũng được); nét dọc + nhánh vẽ bằng .xv-cay-con / .xv-cay-nut (xv.css). */
export const CayCon = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div className="xv-cay-con" style={style}>{children}</div>;
export const CayNut = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div className="xv-cay-nut" style={style}>{children}</div>;
