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
  // BẤM Ô NẰM TRONG DÒNG BẤM ĐƯỢC (#1510 rà 19/11/2026: thẻ ô Luật của dòng phim / dòng camp chỉ mở khi rê — điện thoại không xem được; ô nằm trong <summary> dòng phim
  // nên bấm còn gập/mở cả dòng): chặn bấm lan lên dòng rồi mở ngay; bấm bên trong thẻ nổi (portal, không nằm trong ô) thì để nguyên
  const bam = useCallback((x: T, e: React.MouseEvent) => { if (!(e.currentTarget as Element).contains(e.target as Node)) return; e.preventDefault(); e.stopPropagation(); moNgay(x, e); }, [moNgay]);
  useEffect(() => { if (!v) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [v, dong]);
  useDongKhiCuon(!!v, dong);
  return { v, mo, moNgay, bam, giu, dongTre, dong };
}
// CUỘN LÀ ĐÓNG (góp ý #1460 anh 28/10/2026 "hover vào đâu thì phải để ở gần đó", đo 19/11/2026): lớp nổi neo position:fixed theo con trỏ lúc mở — cuộn trang / khung bảng
// thì dòng đã rê chạy đi còn thẻ đứng yên, nằm cạnh một dòng khác. Một hàm cho MỌI lớp nổi khi rê (useNoi, HoverChu, khung xem trước tab Sản xuất);
// bộ nghe capture bắt cả khung cuộn trong; cuộn bên trong chính thẻ ([data-khung-noi]) thì giữ.
export function useDongKhiCuon(mo: boolean, dong: () => void) {
  useEffect(() => { if (!mo) return; const c = (e: Event) => { const t = e.target; if (t instanceof Element && t.closest('[data-khung-noi]')) return; dong(); };
    window.addEventListener('scroll', c, { capture: true, passive: true }); return () => window.removeEventListener('scroll', c, { capture: true }); }, [mo, dong]);
}
export type Noi = { giu: () => void; dongTre: () => void; dong: () => void };
// CHIỀU CAO THẬT của lớp nổi (góp ý #1460 anh 28/10/2026 "hover vào đâu thì phải để ở gần đó"): đo offsetHeight + theo dõi đổi cỡ — trước dùng chiều cao ƯỚC
// (520 / 440px) → thẻ ngắn ở nửa dưới màn bị đẩy lên xa con trỏ. Mọi lớp nổi khi rê của etp2 (KhungNoi, khung xem trước tab Sản xuất) dùng chung hàm này.
export function useCaoThat(ref: React.RefObject<HTMLElement | null>, cao: number) {
  const [h, setH] = useState(cao);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const f = () => setH(el.offsetHeight); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, [ref]);
  return h;
}
// VỊ TRÍ LỚP NỔI CẠNH CON TRỎ — một hàm cho mọi lớp nổi khi rê.
// ĐẶT BÊN CẠNH CON TRỎ (góp ý #1531 anh 04/11/2026 "hover box phải nằm ngoài vị trí con chuột … đéo ai bấm bên dưới được"): trước thẻ đè lên con trỏ rồi tràn
// xuống (#1483) → che mọi dòng phía dưới. Nay mép trái thẻ cách con trỏ CHONG px về bên PHẢI, đầu thẻ ngang dòng đang rê — kéo chuột sang thẻ chỉ đi ngang trong
// cùng dòng, không băng qua dòng khác (giữ ý #1483); cột dưới con trỏ để trống bấm được. Không đủ chỗ bên phải thì lật sang trái con trỏ.
// Dọc: đầu thẻ ngang con trỏ; chỉ đẩy lên đúng phần thẻ (cao THẬT h) vượt đáy màn.
export function viTriNoi(x: number, y: number, r: number, h: number, W: number, H: number) {
  const CHONG = 4;
  const left = x + CHONG + r <= W - 8 ? x + CHONG : Math.max(8, Math.min(x - CHONG - r, W - 8 - r));
  const top = Math.max(8, Math.min(y - 24, H - h - 8));
  return { left, top };
}
// SỐ THẺ NỔI RIÊNG ĐANG MỞ (mọi KhungNoi trừ thẻ chữ của HoverChu) — HoverChu nhường: thẻ riêng đang mở thì không mở thẻ chữ; thẻ riêng vừa mở thì đóng thẻ chữ
let SO_THE_RIENG = 0;
const SU_KIEN_THE_RIENG = 'etp-the-rieng-mo';
export function KhungNoi({ x, y, rong, cao, noi, children, style, chu = false }: { x: number; y: number; rong: number; cao: number; noi: Noi; children: React.ReactNode; style?: React.CSSProperties; /** thẻ chữ của HoverChu */ chu?: boolean }) {
  useLayoutEffect(() => { if (chu) return; SO_THE_RIENG++; window.dispatchEvent(new Event(SU_KIEN_THE_RIENG)); return () => { SO_THE_RIENG--; }; }, [chu]);
  const W = typeof window !== 'undefined' ? window.innerWidth : 1400, H = typeof window !== 'undefined' ? window.innerHeight : 900;
  // PORTAL ra <body> (anh 28/10/2026: thẻ xét luật trong Bảng không hiện): position:fixed nằm trong khung cuộn / có transform của DataTable bị neo + cắt theo khung đó
  // ĐẶT SÁT CON TRỎ (góp ý #1460 anh 28/10/2026 "hover vào đâu thì phải để ở gần đó"): đo chiều cao THẬT của thẻ (trước dùng `cao` ước 520px → thẻ ngắn
  // ở nửa dưới màn bị đẩy lên xa) — đủ chỗ thì nằm ngay dưới con trỏ, không đủ thì lật lên trên con trỏ, chỉ kẹp mép khi cao hơn cả hai phía
  const ref = useRef<HTMLDivElement>(null); const h = useCaoThat(ref, cao);
  // MÀN HẸP (anh 05/11/2026 "pop khung thời gian trên mobile bị tràn"): bề rộng thẻ kẹp theo màn (W − 16) — mọi thẻ nổi, không vá từng thẻ
  const r = Math.min(rong, W - 16);
  const { left, top } = viTriNoi(x, y, r, h, W, H);
  if (typeof document === 'undefined') return null;
  return createPortal((<>
    {/* lớp tô dòng đang mở thẻ (useNoi) — đặt cùng thẻ nên có ở mọi màn (Cây, Bảng, ROAS) */}
    <style>{/* lặp lớp .dang-noi để thắng luật nền dòng nhóm .etp-cay tr.dt-nhom>td (dòng phim, #1547) */ '.dang-noi.dang-noi.dang-noi,.dang-noi.dang-noi.dang-noi>td{background:var(--hover,rgba(255,255,255,.09))!important}.dang-noi:not(tr),.dang-noi>td:first-child{box-shadow:inset 2px 0 0 #60a5fa}'}</style>
    <div ref={ref} data-khung-noi="" onMouseEnter={noi.giu} onMouseLeave={noi.dongTre} style={{ position: 'fixed', zIndex: 60, left, top, maxWidth: W - 16, maxHeight: H - 16, overflow: 'auto',
      background: 'var(--bg-1, #111)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.55)', ...style }}>
      <button type="button" onClick={noi.dong} aria-label="Đóng" title="Đóng (Esc)" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 24, height: 24, borderRadius: 12, border: '1px solid var(--line)',
        background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: '20px' }}>✕</button>
      {children}
    </div>
  </>), document.body);
}
// CHỮ RÊ → KHỐI THẺ: dòng đầu đậm (phần trước " — " / ": " đầu tiên), phần sau tách theo " · " / xuống dòng thành các dòng có chấm — cùng khung TheChung
// #1715 (anh 20/11/2026 "Tởm, ko đọc đc"): only a SHORT title is shown in bold. A long description with no separator
// (vd mô tả mẫu creative) used to be one bold 13px block → hard to read. Above TIEU_DAM characters it becomes a plain paragraph, regular weight, wider line height.
const TIEU_DAM = 60;
export function tachChuRe(t: string): { tieu: string; dong: string[] } {
  const s = t.trim(); const m = /\s+—\s+|\n/.exec(s);
  let tieu = s, sau = '';
  // #1715 lượt 2: " — " chỉ là dấu tách tiêu đề khi phần trước NGẮN (≤ TIEU_DAM). Câu dài có " — " giữa câu (mô tả mẫu) trước bị chặt đôi:
  // nửa đầu thành đoạn, nửa sau thành một chấm cụt → đọc như hai mẩu rời. Nay câu dài giữ nguyên một đoạn; chỉ xuống dòng thật mới tách.
  if (m && (m[0] === '\n' || m.index <= TIEU_DAM)) { tieu = s.slice(0, m.index); sau = s.slice(m.index + m[0].length); }
  else if (m) { const i = s.indexOf('\n'); if (i > 0) { tieu = s.slice(0, i); sau = s.slice(i + 1); } }
  else if (s.length > 70) { const i = s.indexOf(' · '); if (i > 0 && i <= TIEU_DAM) { tieu = s.slice(0, i); sau = s.slice(i + 3); } }
  const dong = sau.split(/\n|\s+·\s+/).map((x) => x.trim()).filter(Boolean);
  return { tieu, dong };
}
export function TheChu({ chu }: { chu: string }) {
  const { tieu, dong } = tachChuRe(chu);
  const dam = tieu.length <= TIEU_DAM;
  return <div style={{ width: 'max-content', maxWidth: 360, padding: '10px 30px 10px 12px', fontSize: 12, whiteSpace: 'normal', color: 'var(--fg-1)', lineHeight: 1.45 }}>
    {dam
      ? <b style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{tieu}</b>
      : <div style={{ fontSize: 12.5, fontWeight: 400, lineHeight: 1.55, color: 'var(--fg-0)' }}>{tieu}</div>}
    {dong.length ? <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)', display: 'grid', gap: 4 }}>
      {dong.map((x, i) => <div key={i} style={{ position: 'relative', paddingLeft: 12, color: 'var(--fg-2)' }}>
        <span style={{ position: 'absolute', left: 0, top: 6, width: 5, height: 5, borderRadius: 3, background: 'var(--fg-3, #777)' }} />{x}</div>)}
    </div> : null}
  </div>;
}
// MỌI HOVER CHỮ THÔ → THẺ NỔI CHUNG (anh 06/11/2026 #1546 "Thông tin chi tiết vào hover. Format hover theo chuẩn đẹp đang có !! Tất cả hover !!"):
// trước mỗi ô tự gắn title= → trình duyệt hiện hộp chữ xám thô, ~40 chỗ trên Cây / Bảng / tiêu đề cột DataTable. Nay MỘT bộ nghe trên khung trang: rê vào phần tử có title
// → cất chữ sang data-tip (trình duyệt không hiện hộp thô nữa), mở KhungNoi (trễ TRE_MO, ✕, Esc, giữ khi rê vào thẻ) với TheChu. Mọi title= mới tự theo, không phải sửa từng ô.
// Nhường thẻ riêng (bậc, xét luật, creative…): thẻ riêng đang mở → không mở; thẻ riêng mở sau → đóng thẻ chữ. Bỏ qua chữ của cả dòng (tr / .dong — rê đâu cũng bật là phiền)
// và chữ bên trong thẻ nổi.
export function HoverChu({ goc }: { goc: React.RefObject<HTMLElement | null> }) {
  const [v, setV] = useState<{ chu: string; x: number; y: number } | null>(null);
  const hen = useRef<number | undefined>(undefined);
  const dangEl = useRef<HTMLElement | null>(null);
  const hang = useRef<Element | null>(null);
  const giu = useCallback(() => { if (hen.current) window.clearTimeout(hen.current); }, []);
  const dongTre = useCallback(() => { giu(); hen.current = window.setTimeout(() => setV(null), 300); }, [giu]);
  const dong = useCallback(() => { giu(); dangEl.current = null; setV(null); }, [giu]);
  useEffect(() => { const el = hang.current; if (!v || !el) return; el.classList.add('dang-noi'); return () => el.classList.remove('dang-noi'); }, [v]);
  useEffect(() => {
    const khung = goc.current; if (!khung) return;
    const tim = (t: EventTarget | null): HTMLElement | null => {
      let el = t instanceof Element ? t : null;
      for (; el && el !== khung; el = el.parentElement) {
        if (el.hasAttribute('data-khung-noi')) return null;
        if (el.hasAttribute('title') || el.hasAttribute('data-tip')) return el.tagName === 'TR' || el.classList.contains('dong') ? null : el as HTMLElement;
      }
      return null;
    };
    const vao = (e: MouseEvent) => {
      const el = tim(e.target); if (!el) return;
      const t = el.getAttribute('title');
      if (t != null) { el.removeAttribute('title'); if (t.trim()) el.setAttribute('data-tip', t); else el.removeAttribute('data-tip'); }
      // chữ không có lấy một chữ cái (chỉ số / dấu, vd "0") → không mở thẻ: số trơn không nói gì với người đọc (#1693 "0 ✕")
      const chu = el.getAttribute('data-tip'); if (!chu || !/\p{L}/u.test(chu)) return;
      if (dangEl.current === el) { giu(); return; }
      giu(); dangEl.current = el;
      hen.current = window.setTimeout(() => {   // trễ hơn thẻ riêng một nhịp → thẻ riêng của cùng ô mở trước, thẻ chữ nhường
        if (SO_THE_RIENG > 0 || dangEl.current !== el) return;
        hang.current = el.closest('.dong, summary, tr'); setV({ chu, x: CHUOT.x || e.clientX, y: CHUOT.y || e.clientY });
      }, TRE_MO + 60);
    };
    const ra = (e: MouseEvent) => {
      const el = dangEl.current; if (!el) return;
      const toi = e.relatedTarget as Node | null; if (toi && el.contains(toi)) return;
      dangEl.current = null; dongTre();
    };
    const nhuong = () => { giu(); setV(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') nhuong(); };
    khung.addEventListener('mouseover', vao); khung.addEventListener('mouseout', ra);
    window.addEventListener(SU_KIEN_THE_RIENG, nhuong); window.addEventListener('keydown', esc);
    return () => { khung.removeEventListener('mouseover', vao); khung.removeEventListener('mouseout', ra); window.removeEventListener(SU_KIEN_THE_RIENG, nhuong); window.removeEventListener('keydown', esc); giu(); };
  }, [goc, giu, dongTre]);
  useDongKhiCuon(!!v, dong);
  return v ? <KhungNoi chu x={v.x} y={v.y} rong={360} cao={160} noi={{ giu, dongTre, dong }}><TheChu chu={v.chu} /></KhungNoi> : null;
}
