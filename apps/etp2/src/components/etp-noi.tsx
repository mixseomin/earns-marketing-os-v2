'use client';
// THẺ NỔI CHUNG CỦA etp (useNoi + KhungNoi + DongMoc + ReThe) — một tệp cho mọi màn etp: Cây / Bảng / ROAS (etp-view) và tab Sản xuất (etp-dong).
// Trước nằm riêng trong etp-view nên tab Sản xuất phải dùng hover chữ thô của trình duyệt (anh 05/11/2026 #1541 "Format ngay. Đọc đéo hiểu gì. Mọi hover").
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TRE_MO } from '@/lib/etp-tre';
// DÒNG THỜI GIAN MỐC — MỘT KHUÔN cho mọi thẻ nổi của camp (anh 03/11/2026 "format kiểu này… component để dùng cho nhiều nơi"): chấm màu + tên đậm + số + giờ, dòng chữ dưới.
// Dùng ở: lịch sử bậc (DongBac), lý do dừng (TheDung). Mốc mới nhất trên.
export type Moc = { ten: string; mau: string; so?: string; luc?: string; chu?: string | null; t?: string | null };
// gon (#1551 anh 09/11/2026 "Chữ này đừng có show ngay ra"): chữ dưới mốc ẨN, bấm "lý do ▸" ở dòng mốc mới mở — dùng cho dòng thời gian bậc (chữ luật dài)
export function DongMoc({ ds, rong = 'Chưa có mốc nào.', gon = false }: { ds: Moc[]; rong?: string; gon?: boolean }) {
  const [mo, setMo] = useState<Set<number>>(() => new Set());
  const bat = (i: number) => setMo((v) => { const n = new Set(v); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return ds.length ? <div style={{ position: 'relative', paddingLeft: 16 }}>
    <span style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 2, background: 'var(--line)' }} />
    {ds.map((x, i) => <div key={i} title={x.t ?? undefined} style={{ position: 'relative', paddingBottom: 8, cursor: x.t ? 'help' : undefined }}>
      <span style={{ position: 'absolute', left: -16, top: 3, width: 10, height: 10, borderRadius: 5, background: x.mau, boxShadow: '0 0 0 2px var(--bg-1, #111)' }} />
      <div><b style={{ color: x.mau }}>{x.ten}</b>{x.so ? <> <b style={{ fontVariantNumeric: 'tabular-nums' }}>{x.so}</b></> : null}{x.luc ? <span style={{ color: 'var(--fg-3, #777)', marginLeft: 6 }}>{x.luc}</span> : null}
        {gon && x.chu ? <button type="button" onClick={() => bat(i)} style={{ marginLeft: 6, padding: 0, border: 0, background: 'none', color: 'var(--fg-3, #777)', fontSize: 11, cursor: 'pointer' }}>{mo.has(i) ? 'lý do ▾' : 'lý do ▸'}</button> : null}</div>
      {x.chu && (!gon || mo.has(i)) ? <div style={{ color: 'var(--fg-2)', lineHeight: 1.35, marginTop: 1, whiteSpace: 'pre-line' }}>{x.chu}</div> : null}
    </div>)}
  </div> : <div style={{ color: 'var(--fg-2)' }}>{rong}</div>;
}
// THẺ NỔI CHUNG CHO MỌI HOVER MỚI (anh 04/11/2026 "tất cả hover đều phải dùng loại này"): cùng khung thẻ bậc — đầu thẻ (mã · tên), dòng lớn có màu, các mốc DongMoc
export type TheNoi = { ma?: string; ten?: string | null; tieu: string; mau: string; moc: Moc[] };
export function TheChung({ t }: { t: TheNoi }) {
  return <div style={{ width: 380, maxWidth: '92vw', maxHeight: 440, overflowY: 'auto', padding: '10px 30px 10px 12px', fontSize: 12, whiteSpace: 'normal', color: 'var(--fg-1)' }}>
    {t.ma || t.ten ? <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
      {t.ma ? <b style={{ fontSize: 13, flex: 'none' }}>{t.ma}</b> : null}<span style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ten ?? ''}</span></div> : null}
    <div style={{ marginBottom: 8 }}><b style={{ fontSize: 13, color: t.mau }}>{t.tieu}</b></div>
    <DongMoc ds={t.moc} /></div>;
}
export function ReThe({ the, children, rong = 380, cao = 320 }: { the: () => TheNoi; children: React.ReactNode; rong?: number; cao?: number }) {
  const noi = useNoi<{ id: 0 }>();
  return <span onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} style={{ display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minWidth: 0 }}>
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={rong} cao={cao} noi={noi}><TheChung t={the()} /></KhungNoi> : null}{children}</span>;
}
// THẺ NỔI DÙNG CHUNG (anh 25/10/2026: "preview hiện xong đéo có nút tắt"): mọi thẻ xem trên trang — nút ✕, Esc tắt, rê chuột vào thẻ thì giữ
// (xem video, đọc lý do), rời cả ô lẫn thẻ 0,3 giây thì tắt. Ô mở thẻ là HÀM dựng, không phải component khai bên trong component cha:
// trang tự làm mới 5–60 giây, component khai bên trong bị dựng lại mỗi lần → mất sự kiện rời chuột → thẻ treo không tắt được.
// TRỄ MỞ (anh 25/10/2026: "không cho hiện ngay, phải để một lúc mới hiện tránh hover nhầm"): dừng chuột TRE_MO ms mới mở; lướt qua thì không mở;
// đang có thẻ mở mà rê sang ô khác thì đổi ngay. Luật chung: ~/.claude/skills/design/ydni/SKILL.md (THẺ NỔI KHI RÊ CHUỘT).
// TRE_MO: lib/etp-tre.ts (dùng chung với khung xem trước tab Sản xuất)
// VỊ TRÍ CHUỘT MỚI NHẤT (góp ý #1483 anh 29/10/2026 "Hover ở đâu thì bản phải ở đó để còn kéo chuột sang"): thẻ mở sau TRE_MO ms → đặt theo chỗ con trỏ LÚC MỞ,
// không phải lúc vừa rê vào ô (chuột đã đi tiếp trong ô). Một bộ nghe cho cả trang, không gắn theo từng ô.
const CHUOT = { x: 0, y: 0 };
if (typeof window !== 'undefined') window.addEventListener('mousemove', (e) => { CHUOT.x = e.clientX; CHUOT.y = e.clientY; }, { passive: true });
export function useNoi<T>() {
  const [v, setV] = useState<(T & { x: number; y: number }) | null>(null);
  const hen = useRef<number | undefined>(undefined);
  const dangMo = useRef(false); dangMo.current = !!v;
  // TÔ DÒNG ĐANG MỞ THẺ (anh 28/10/2026 "highlight dòng khi đang hover của nó"): rời chuột sang thẻ nổi thì :hover của dòng mất — giữ lớp .dang-noi trên dòng chứa ô đã rê
  // (dòng Cây .dong / dòng phim summary / dòng Bảng tr) suốt lúc thẻ mở; một chỗ cho mọi thẻ nổi dùng useNoi
  const hang = useRef<Element | null>(null);
  useEffect(() => { const el = hang.current; if (!v || !el) return; el.classList.add('dang-noi'); return () => el.classList.remove('dang-noi'); }, [v]);
  const giu = useCallback(() => { if (hen.current) window.clearTimeout(hen.current); }, []);
  const dongTre = useCallback(() => { giu(); hen.current = window.setTimeout(() => setV(null), 300); }, [giu]);
  const dong = useCallback(() => { giu(); setV(null); }, [giu]);
  const mo = useCallback((x: T, e: React.MouseEvent) => {
    giu(); const toaDo = { x: e.clientX, y: e.clientY }; hang.current = (e.currentTarget as Element | null)?.closest?.('.dong, summary, tr') ?? null;
    hen.current = window.setTimeout(() => setV({ ...x, ...(CHUOT.x || CHUOT.y ? { x: CHUOT.x, y: CHUOT.y } : toaDo) }), TRE_MO);   // #1514: đang mở thẻ khác cũng chờ đủ trễ (trước đổi ngay)
  }, [giu]);
  // BẤM LÀ MỞ NGAY (anh 08/11/2026 "bấm vào thì hiện hover lên để cả mobile cũng nhìn thấy"): điện thoại không có rê chuột — onClick gọi moNgay, không chờ TRE_MO
  const moNgay = useCallback((x: T, e: React.MouseEvent) => {
    giu(); hang.current = (e.currentTarget as Element | null)?.closest?.('.dong, summary, tr') ?? null; setV({ ...x, x: e.clientX, y: e.clientY });
  }, [giu]);
  useEffect(() => { if (!v) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [v, dong]);
  return { v, mo, moNgay, giu, dongTre, dong };
}
export type Noi = { giu: () => void; dongTre: () => void; dong: () => void };
export function KhungNoi({ x, y, rong, cao, noi, children, style }: { x: number; y: number; rong: number; cao: number; noi: Noi; children: React.ReactNode; style?: React.CSSProperties }) {
  const W = typeof window !== 'undefined' ? window.innerWidth : 1400, H = typeof window !== 'undefined' ? window.innerHeight : 900;
  // PORTAL ra <body> (anh 28/10/2026: thẻ xét luật trong Bảng không hiện): position:fixed nằm trong khung cuộn / có transform của DataTable bị neo + cắt theo khung đó
  // ĐẶT SÁT CON TRỎ (góp ý #1460 anh 28/10/2026 "hover vào đâu thì phải để ở gần đó"): đo chiều cao THẬT của thẻ (trước dùng `cao` ước 520px → thẻ ngắn
  // ở nửa dưới màn bị đẩy lên xa) — đủ chỗ thì nằm ngay dưới con trỏ, không đủ thì lật lên trên con trỏ, chỉ kẹp mép khi cao hơn cả hai phía
  const ref = useRef<HTMLDivElement>(null); const [h, setH] = useState(cao);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const f = () => setH(el.offsetHeight); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, []);
  // ĐẶT BÊN CẠNH CON TRỎ (góp ý #1531 anh 04/11/2026 "hover box phải nằm ngoài vị trí con chuột … đéo ai bấm bên dưới được"): trước thẻ đè lên con trỏ rồi tràn
  // xuống (#1483) → che mọi dòng phía dưới. Nay mép trái thẻ cách con trỏ CHONG px về bên PHẢI, đầu thẻ ngang dòng đang rê — kéo chuột sang thẻ chỉ đi ngang trong
  // cùng dòng, không băng qua dòng khác (giữ ý #1483); cột dưới con trỏ để trống bấm được. Không đủ chỗ bên phải thì lật sang trái con trỏ.
  const CHONG = 4;
  // MÀN HẸP (anh 05/11/2026 "pop khung thời gian trên mobile bị tràn"): bề rộng thẻ kẹp theo màn (W − 16) — mọi thẻ nổi, không vá từng thẻ
  const r = Math.min(rong, W - 16);
  const left = x + CHONG + r <= W - 8 ? x + CHONG : Math.max(8, Math.min(x - CHONG - r, W - 8 - r));
  const top = Math.max(8, Math.min(y - 24, H - h - 8));
  if (typeof document === 'undefined') return null;
  return createPortal((<>
    {/* lớp tô dòng đang mở thẻ (useNoi) — đặt cùng thẻ nên có ở mọi màn (Cây, Bảng, ROAS) */}
    <style>{/* lặp lớp .dang-noi để thắng luật nền dòng nhóm .etp-cay tr.dt-nhom>td (dòng phim, #1547) */ '.dang-noi.dang-noi.dang-noi,.dang-noi.dang-noi.dang-noi>td{background:var(--hover,rgba(255,255,255,.09))!important}.dang-noi:not(tr),.dang-noi>td:first-child{box-shadow:inset 2px 0 0 #60a5fa}'}</style>
    <div ref={ref} onMouseEnter={noi.giu} onMouseLeave={noi.dongTre} style={{ position: 'fixed', zIndex: 60, left, top, maxWidth: W - 16, maxHeight: H - 16, overflow: 'auto',
      background: 'var(--bg-1, #111)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.55)', ...style }}>
      <button type="button" onClick={noi.dong} aria-label="Đóng" title="Đóng (Esc)" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 24, height: 24, borderRadius: 12, border: '1px solid var(--line)',
        background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: '20px' }}>✕</button>
      {children}
    </div>
  </>), document.body);
}
