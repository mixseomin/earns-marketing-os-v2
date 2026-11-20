'use client';
// CỠ Ô WIDGET + THANH LỌC GỌN (gói @mos2/bang — DataTable đọc useKhungO để tự gọn) — chuẩn bố cục BÊN TRONG mọi widget /home (anh 20/11/2026: "màn hình đã bé lại mà show hết ra thì xem được à";
// "trong widget, các bộ lọc… đều phải bố cục lại hết").
//   · KhungO: lưới (bang.tsx) bọc ruột mỗi ô, đo bề ngang thật của ô (ResizeObserver) → useKhungO() cho mọi khối bên trong biết ô rộng bao nhiêu.
//     Ngoài /home (trang cũ) không có KhungO → rong = 0 = "trang đủ rộng", khối giữ dáng cũ.
//   · ThanhO: MỘT hàng mỏng đầu ô — bộ lọc chính dạng chip (ô hẹp thì gập luôn vào nút Lọc), bộ lọc phụ gập trong nút "Lọc", ô tìm chỉ bung khi bấm 🔍,
//     số dòng đang xem / tổng ở cuối. Không bao giờ hai hàng lọc chồng nhau trong một ô.
//   · cotTheoRong: cột bảng khai mức ưu tiên (uu 1 luôn hiện · 2 từ ô 560 px · 3 từ ô 860 px) → ô nhỏ chỉ còn cột chính, chi tiết ở ngăn khi bấm dòng.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnchoredPopover } from "./anchored-popover";

const Ctx = createContext(0);
export function KhungO({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null); const [rong, setRong] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e!.contentRect.width); setRong((c) => (Math.abs(c - w) > 8 ? w : c)); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="hm-ko"><Ctx.Provider value={rong}>{children}</Ctx.Provider></div>;
}
/** ngăn kéo / lớp nổi mở TỪ trong ô: nội dung của nó không còn là ruột ô → đặt lại cỡ ô = 0 (bảng trong ngăn vẽ như trang thường) */
export const RaKhoiO = ({ children }: { children: ReactNode }) => <Ctx.Provider value={0}>{children}</Ctx.Provider>;
/** bề ngang ô đang chứa (px); 0 = không nằm trong ô widget (trang cũ, đủ rộng) */
export const useKhungO = () => useContext(Ctx);
export const MOC_COT = { 1: 0, 2: 560, 3: 860 } as const;
/** giữ cột theo bề ngang ô: uu 1 luôn có · 2 từ 560 px · 3 từ 860 px. rong 0 (ngoài ô) = giữ hết. */
export function cotTheoRong<C extends { uu?: 1 | 2 | 3 }>(cot: C[], rong: number): C[] {
  return rong ? cot.filter((c) => rong >= MOC_COT[c.uu ?? 1]) : cot;
}

export type ChipO = { v: string; nhan: string; so?: number; xau?: boolean };
export type LocO = { nhan: string; ds: ChipO[]; v: string; doi: (v: string) => void };
const chipCss = (on: boolean, xau?: boolean) => `hm-chip${on ? ' on' : ''}${xau ? ' xau' : ''}`;

function Chips({ l }: { l: LocO }) {
  return <span className="hm-chips" role="group" aria-label={l.nhan}>{l.ds.map((c) => (
    <button key={c.v} type="button" className={chipCss(l.v === c.v, c.xau && !!c.so)} aria-pressed={l.v === c.v} onClick={() => l.doi(c.v)}>
      {c.nhan}{c.so != null && <small>{c.so}</small>}
    </button>))}</span>;
}

/** chinh: bộ lọc chính (chip ngay trên hàng khi ô đủ rộng) · phu: bộ lọc phụ (luôn trong nút Lọc) · tim: ô tìm bung khi bấm 🔍 · dem: "12 / 51" · them: nút riêng của khối (cuối hàng) */
export function ThanhO({ chinh, phu = [], tim, setTim, dem, them, goiYTim = 'Tìm…' }: {
  chinh?: LocO; phu?: LocO[]; tim?: string; setTim?: (s: string) => void; dem?: ReactNode; them?: ReactNode; goiYTim?: string;
}) {
  const rong = useKhungO(); const hep = rong > 0 && rong < 440;
  const [moTim, setMoTim] = useState(!!tim); const [moLoc, setMoLoc] = useState(false); const nutLoc = useRef<HTMLButtonElement | null>(null);
  const trongLoc = [...(hep && chinh ? [chinh] : []), ...phu];
  const dangLoc = trongLoc.filter((l) => l.v !== (l.ds[0]?.v ?? '')).length;
  return (
    <div className="hm-thanh">
      {chinh && !hep && <Chips l={chinh} />}
      {trongLoc.length > 0 && <>
        <button ref={nutLoc} type="button" className={chipCss(dangLoc > 0)} onClick={() => setMoLoc((m) => !m)} aria-expanded={moLoc} title="Bộ lọc">
          Lọc{dangLoc > 0 && <small>{dangLoc}</small>} ▾
        </button>
        <AnchoredPopover anchorRef={nutLoc} open={moLoc} onClose={() => setMoLoc(false)}>
          <div className="hm-loc-pop">
            {trongLoc.map((l) => <div key={l.nhan}><div className="hm-loc-nhan">{l.nhan}</div><Chips l={l} /></div>)}
          </div>
        </AnchoredPopover>
      </>}
      <span className="hm-thanh-gian" />
      {setTim && (moTim || tim
        ? <input autoFocus={moTim && !tim} className="hm-tim" value={tim ?? ''} placeholder={goiYTim} onChange={(e) => setTim(e.target.value)} onBlur={() => { if (!tim) setMoTim(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setTim(''); setMoTim(false); } }} />
        : <button type="button" className="hm-chip" title={goiYTim} aria-label={goiYTim} onClick={() => setMoTim(true)}>🔍</button>)}
      {dem != null && <span className="hm-dem">{dem}</span>}
      {them}
    </div>
  );
}
