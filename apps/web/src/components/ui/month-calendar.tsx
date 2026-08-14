'use client';

// MonthCalendar — lịch dùng chung. Đưa vào các mục có ngày ({date:'YYYY-MM-DD'}), nó thả mỗi mục
// vào đúng ô. `dim` = mục mờ (vd đã hẹn lịch, chưa làm) so với đã xong. Tuần bắt đầu Thứ 2.
//
// BA CHẾ ĐỘ như Google Calendar: Tháng · Tuần · Ngày. Lưới tháng cho toàn cảnh; Tuần/Ngày zoom vào
// chi tiết. Ở Tuần/Ngày (view hẹp) kèm 1 MINI-MONTH bên trái — y hệt Google Calendar — để vừa NHẢY
// nhanh sang ngày khác vừa NẮM TOÀN CẢNH cả tháng (chấm dưới ngày = ngày đó có việc). Tuần/Ngày dùng
// chung đúng một hàm dựng danh sách ngày — chỉ khác số cột và bước nhảy ◀ ▶.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { TypeGlyph as CalGlyph, type GlyphName } from './type-glyph';   // nguồn glyph DÙNG CHUNG toàn app

// BÀN GIAO (resume): đủ để 1 chat KHÁC nối tiếp card. Chỉ đính khi có nội dung → pill hiện glyph 📋 xám
// + rê chuột bung popover. Shape generic (không import lib app) — caller map từ TaskResume sang.
export interface CalBrief { inputs: { label: string; url: string }[]; doneWhen: string; dependsOn: number[] }
export interface CalItem {
  id: number | string; date: string; label: string; title?: string;
  color?: string;          // màu TRẠNG THÁI: drives thanh-trái + nền tint + viền (green=done, amber=đang/hẹn, purple=chờ duyệt, grey=chờ, red=chặn)
  icon?: GlyphName;        // icon LOẠI/ngữ-cảnh (SVG, đồng nhất): pin=followup · link=backlink · sprout=seed · clock=chờ duyệt · calendar=hẹn lại
  lead?: ReactNode;        // icon RIÊNG của mục (favicon nền tảng…) đứng trước nhãn — nhãn là chuỗi nên không nhét node vào được
  done?: boolean;          // đã làm → thêm ✓ + thanh xanh
  dim?: boolean;           // mờ (mục tương lai/đã bỏ)
  brief?: CalBrief;        // có bàn giao (input/done-when/depends) → glyph xám + hover popover. Chỉ set khi KHÔNG rỗng.
  /** Nội dung ĐẦY ĐỦ của mục, chỉ hiện ở chế độ Ngày/Tuần (tháng phải giữ mật độ). Caller dựng —
   *  vd bài đăng thì truyền khối xem trước (account · nơi đăng · caption · ảnh) để mở lịch ra là
   *  đọc được bài, không phải bấm từng pill. */
  detail?: ReactNode;
}
export type CalMode = 'month' | 'week' | 'day';

// Glyph + CalGlyph giờ import từ ./type-glyph (nguồn dùng chung). GlyphName = superset (thêm 16 icon type).
// 1 mục chú thích: icon (loại) HOẶC chip màu (trạng thái) — nhãn/màu do CALLER truyền (nguồn canonical,
// vd SITE_STATUS_META), calendar KHÔNG tự chế chữ → legend luôn khớp drawer/kanban.
export type LegendEntry = { icon?: GlyphName; color?: string; label?: string; sep?: boolean };

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WD1 = ['2', '3', '4', '5', '6', '7', 'C'];   // mini-month header (1 ký tự)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Ngày LOCAL: `new Date('2026-08-08')` parse theo UTC → ở GMT+7 vẫn ra 08/08 nhưng ở múi giờ âm lùi
// một ngày. Tách tay để ngày trong URL luôn là đúng ngày người dùng bấm.
const parseYmd = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const monthGrid = (monthDate: Date) => { const g = mondayOf(firstOfMonth(monthDate)); return Array.from({ length: 42 }, (_, i) => addDays(g, i)); };
const navBtn: CSSProperties = { fontSize: 12, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const miniNav: CSSProperties = { fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', lineHeight: 1.6 };
// Popover BÀN GIAO (hover pill có brief). Ẩn mặc định (display:none) → CSS `.cal-pill-wrap:hover` bung.
const briefCard: CSSProperties = { position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 60, width: 264, maxWidth: '82vw', background: 'var(--bg-0, #0b0d12)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.45)', padding: '9px 11px 10px', display: 'none', fontSize: 11.5, lineHeight: 1.45, cursor: 'default', whiteSpace: 'normal', fontWeight: 500 };
const briefSec: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fg-4)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 };
const briefLink: CSSProperties = { display: 'block', color: 'var(--neon-blue)', textDecoration: 'none', padding: '1px 0', wordBreak: 'break-word' };
const briefChip: CSSProperties = { fontSize: 10.5, padding: '1px 7px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--neon-blue)', cursor: 'pointer' };

const MODES: { key: CalMode; label: string }[] = [
  { key: 'month', label: 'Tháng' }, { key: 'week', label: 'Tuần' }, { key: 'day', label: 'Ngày' },
];

// MINI-MONTH: lưới tháng thu nhỏ (như sidebar Google Calendar). Ngày hôm nay khoanh, ngày đang chọn
// tô nền accent, ngày có việc có 1 chấm nhỏ ở dưới → liếc là biết cả tháng chỗ nào có việc. Bấm ngày = nhảy.
export function MiniMonth({ month, sel, byDate, onPick, onNavMonth, today, showNav = true, itemNoun = 'việc' }: {
  month: Date; sel: Set<string>; byDate: Map<string, CalItem[]>; onPick: (d: Date) => void; onNavMonth: (dir: 1 | -1) => void; today?: string;
  /** Mục trên lịch này gọi là gì — "việc" (mặc định), "doanh thu"… Dùng cho chú thích + tooltip. */
  itemNoun?: string;
  /** Ẩn khi thanh điều hướng CHÍNH đã là điều hướng tháng (chế độ Tháng) — nếu không thì màn hình
   *  có hai lần "August 2026" với hai cặp ◀ ▶ làm đúng một việc. Tuần/Ngày thì phải giữ: lúc đó
   *  ◀ ▶ ở trên nhảy tuần/ngày, không có cách nào khác để lật tháng. */
  showNav?: boolean;
}) {
  const m = month.getMonth();
  const todayStr = today || ymd(new Date());
  const cells = monthGrid(month);
  return (
    <div>
      {showNav && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, flex: 1, textTransform: 'capitalize' }}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button type="button" onClick={() => onNavMonth(-1)} style={miniNav} title="Tháng trước">◀</button>
          <button type="button" onClick={() => onNavMonth(1)} style={miniNav} title="Tháng sau">▶</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {WD1.map((w, i) => <div key={i} style={{ fontSize: 9, color: 'var(--fg-4)', textAlign: 'center', paddingBottom: 2 }}>{w}</div>)}
        {cells.map((d) => {
          const ds = ymd(d); const inM = d.getMonth() === m; const isToday = ds === todayStr; const isSel = sel.has(ds);
          const its = byDate.get(ds) || []; const dot = its[0]?.color || 'var(--accent)';
          return (
            <button key={ds} type="button" onClick={() => onPick(d)} title={its.length ? `${its.length} ${itemNoun}` : undefined}
              // Ngày/tuần đang chọn = tint NHẸ (không tô đặc chói), chỉ đủ để phân biệt; hôm nay = khoanh cyan.
              style={{ position: 'relative', height: 28, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${isToday ? 'var(--neon-cyan)' : isSel ? 'color-mix(in srgb, var(--accent) 34%, transparent)' : 'transparent'}`, borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: isToday ? 800 : isSel ? 700 : 500,
                background: isSel ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : isToday ? 'color-mix(in srgb, var(--neon-cyan) 13%, transparent)' : 'transparent',
                color: isToday ? 'var(--neon-cyan)' : isSel ? 'var(--fg-1)' : !inM ? 'var(--fg-4)' : 'var(--fg-2)', opacity: isSel ? 1 : inM ? 1 : 0.45 }}>
              {d.getDate()}
              {its.length > 0 && <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: dot }} />}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--fg-4)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> ngày có {itemNoun}
      </div>
    </div>
  );
}

export function MonthCalendar({ items, onItemClick, initialMonth, mode: modeProp, onModeChange, legend, sidebar, date, onDateChange, today, itemNoun = 'việc' }: {
  items: CalItem[];
  onItemClick?: (id: number | string) => void;
  initialMonth?: Date;
  /** Chế độ hiện tại. Bỏ trống = component tự giữ (dùng khi không cần đồng bộ URL). */
  mode?: CalMode;
  onModeChange?: (m: CalMode) => void;
  /** Chú thích (loại + trạng thái) — nhãn/màu do caller truyền để khớp nguồn canonical. */
  legend?: LegendEntry[];
  /** Nội dung phụ nằm DƯỚI mini-month trong cột trái (vd sản phẩm đang dựng). Cột này rộng cố định 236px. */
  sidebar?: React.ReactNode;
  /** 'YYYY-MM-DD' hôm nay theo múi giờ VẬN HÀNH, do server truyền xuống (lib/local-day: todayInAppTz).
   *  Có nó thì lịch vẽ được NGAY từ server — không còn khoảng rỗng chờ mount rồi nội dung nhảy vào. */
  today?: string;
  /** Mục trên lịch gọi là gì — mặc định "việc". Lịch doanh thu truyền "doanh thu". */
  itemNoun?: string;
  /** Ngày đang chọn 'YYYY-MM-DD'. Bỏ trống = component tự lấy hôm nay (theo giờ local, sau mount).
   *  Truyền vào + onDateChange = caller giữ ngày trong URL → F5 giữ nguyên ngày, không nhảy về hôm nay. */
  date?: string;
  onDateChange?: (d: string) => void;
}) {
  // anchor/miniView/"hôm nay" phụ thuộc GIỜ LOCAL của client. Nếu khởi tạo bằng new Date() ngay lúc SSR
  // (máy chủ chạy UTC) thì client hydrate xong sẽ tính lại theo giờ local → lệch ngày → calendar NHẢY sang
  // chỗ khác "sau 1 lúc". Khởi tạo null; SSR + lượt client ĐẦU đều null (khớp, không mismatch) → sau mount
  // client set 1 lần theo giờ local → render đúng ngay, không nhảy. (initialMonth truyền vào thì dùng luôn.)
  // `today` từ server = biết ngày ngay ở lần render ĐẦU (kể cả trên máy chủ) → không phải trả về
  // ô rỗng chờ mount. Thiếu nó mới rơi về cách cũ: null tới khi mount rồi mới lấy giờ local.
  const fromUrl = date ? parseYmd(date) : null;
  const seed = fromUrl ?? (today ? parseYmd(today) : null) ?? initialMonth ?? null;
  const [anchorSelf, setAnchorSelf] = useState<Date | null>(() => seed);
  const [miniView, setMiniView] = useState<Date | null>(() => (seed ? firstOfMonth(seed) : null));
  const [modeSelf, setModeSelf] = useState<CalMode>('month');
  useEffect(() => { setAnchorSelf((a) => a ?? new Date()); setMiniView((v) => v ?? firstOfMonth(new Date())); }, []);

  const mode = modeProp ?? modeSelf;
  // Có `date` = caller giữ ngày (trong URL) → nó là nguồn thật; không thì state nội bộ.
  const anchor = fromUrl ?? anchorSelf;
  const setAnchor = (d: Date) => { setAnchorSelf(d); onDateChange?.(ymd(d)); };
  if (!anchor || !miniView) return <div data-comp="ui.MonthCalendar" style={{ minHeight: 320 }} />;   // chờ mount → tránh mismatch giờ SSR/client

  const setMode = (m: CalMode) => { setModeSelf(m); onModeChange?.(m); setMiniView(firstOfMonth(anchor)); };   // đổi mode → mini bám tháng của ngày đang chọn

  // Một nguồn duy nhất dựng danh sách ngày cho cả ba chế độ.
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const days: Date[] = mode === 'month'
    ? monthGrid(anchor)
    : mode === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i))
      : [anchor];

  const byDate = new Map<string, CalItem[]>();
  for (const it of items) { (byDate.get(it.date) ?? byDate.set(it.date, []).get(it.date)!).push(it); }
  const todayStr = today || ymd(new Date());
  const anchorStr = ymd(anchor);
  // Ngày "được chọn": Ngày = đúng anchor; Tuần = cả 7 ngày của tuần (band trong mini-month).
  const selSet = new Set(mode === 'week' ? days.map(ymd) : [anchorStr]);

  // Ngày GẦN NHẤT còn việc CHƯA xong — ưu tiên sắp tới (≥ hôm nay), không có thì quá hạn gần nhất.
  // Nút "Việc gần nhất" nhảy thẳng tới đó thay vì bấm ▶ dò từng tuần qua vùng lịch trống.
  const hasTasks = items.some((i) => i.done !== undefined);
  const pendingDays = !hasTasks ? [] : [...byDate.entries()].filter(([, its]) => its.some((i) => !i.done)).map(([d]) => d).sort();
  const jumpDay = pendingDays.find((d) => d >= todayStr) ?? pendingDays.filter((d) => d < todayStr).at(-1) ?? null;

  // anchor đổi → mini-month bám theo tháng của anchor (trừ khi người dùng tự page mini bằng ◀ ▶).
  const goAnchor = (d: Date) => { setAnchor(d); setMiniView(firstOfMonth(d)); };
  // Nhảy theo đúng đơn vị đang xem — tháng nhảy tháng, tuần nhảy 7 ngày, ngày nhảy 1 ngày.
  const step = (dir: 1 | -1) => goAnchor(mode === 'month' ? new Date(y, m + dir, 1) : addDays(anchor, dir * (mode === 'week' ? 7 : 1)));
  const label = mode === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${mondayOf(anchor).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} – ${addDays(mondayOf(anchor), 6).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  // Tuần = THẺ-NGÀY dàn 2-3 cột (auto-fill) thay vì 7 cột kim → mỗi ngày rộng, task đọc thoải mái.
  // Tháng giữ 7 cột; Ngày 1 cột. minmax(240px) → tự co còn 2-3 cột tuỳ bề rộng còn lại (đã trừ mini).
  const gridCols = mode === 'month' ? 'repeat(7, 1fr)' : mode === 'week' ? 'repeat(auto-fill, minmax(240px, 1fr))' : '1fr';
  const minH = mode === 'month' ? 78 : mode === 'week' ? 150 : 420;

  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: mode === 'week' ? 8 : 4, flex: 1, minWidth: 260, alignContent: 'start' }}>
      {mode === 'month' && WD.map((w) => <div key={w} style={{ fontSize: 10, color: 'var(--fg-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em', paddingBottom: 2 }}>{w}</div>)}
      {days.map((d) => {
        const ds = ymd(d); const inMonth = mode !== 'month' || d.getMonth() === m; const its = byDate.get(ds) || []; const isToday = ds === todayStr;
        const isSel = mode !== 'month' && ds === anchorStr;   // ngày đang xem — nổi bật trong grid chính
        return (
          <div key={ds} style={{ minHeight: minH, padding: mode === 'week' ? 9 : 4, borderRadius: 8, border: `1px solid ${isToday ? 'var(--neon-cyan)' : isSel ? 'color-mix(in srgb, var(--accent) 45%, var(--line))' : 'var(--line)'}`, background: isSel ? 'color-mix(in srgb, var(--accent) 9%, var(--bg-1))' : inMonth ? 'var(--bg-1)' : 'transparent', opacity: inMonth ? 1 : 0.4, display: 'flex', flexDirection: 'column', gap: mode === 'month' ? 3 : 5 }}>
            {mode === 'week' ? (
              // Thẻ-ngày: header có thứ + ngày/tháng riêng (không dựa hàng weekday chung như lưới 7 cột).
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingBottom: 5, marginBottom: 1, borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--neon-cyan)' : 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{WD[(d.getDay() + 6) % 7]}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? 'var(--neon-cyan)' : 'var(--fg-1)' }}>{d.getDate()}/{d.getMonth() + 1}</span>
                {its.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-4)' }}>{its.length} việc</span>}
              </div>
            ) : (
              <div style={{ fontSize: 10.5, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--neon-cyan)' : 'var(--fg-3)', textAlign: mode === 'day' ? 'left' : 'right' }}>
                {mode === 'day' ? `${its.length} việc` : d.getDate()}
              </div>
            )}
            {its.map((it) => {
              const c = it.color || 'var(--accent)';
              const big = mode !== 'month';
              // Thanh-trái = màu TRẠNG THÁI · icon SVG = LOẠI · nền/viền tint theo màu · ✓ = đã làm. Chữ trung tính để dễ đọc.
              // 📋 xám (trung tính, KHÔNG màu status — "có bàn giao" là metadata) = card resumable → hover bung brief.
              const pill = (
                <button type="button" title={it.brief ? undefined : (it.title || it.label)} onClick={() => onItemClick?.(it.id)}
                  style={{ position: 'relative', display: 'flex', alignItems: big ? 'center' : 'flex-start', gap: big ? 6 : 4, width: '100%',
                    textAlign: 'left', fontSize: big ? 12 : 9.5, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word',
                    padding: big ? '4px 8px 4px 10px' : '2px 4px 2px 8px', borderRadius: 5, cursor: 'pointer', overflow: 'hidden',
                    border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`,
                    // xong (done) → LÙI VỀ SAU: nền nhạt + opacity thấp, NHƯNG chữ vẫn đọc được (fg-2, không fg-3 mờ tịt).
                    // dim (đã bỏ) recede vừa. Việc CHƯA làm (pending/scheduled) = full contrast — không mờ.
                    background: `color-mix(in srgb, ${c} ${it.done ? 7 : it.dim ? 10 : 15}%, transparent)`, opacity: it.done ? 0.62 : it.dim ? 0.9 : 1 }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: big ? 4 : 3, background: c }} />
                  {it.icon && <CalGlyph name={it.icon} color={c} size={big ? 13 : 11} />}
                  {it.lead}
                  <span style={{ flex: 1, minWidth: 0, color: it.done || it.dim ? 'var(--fg-2)' : 'var(--fg-1)',
                    ...(mode === 'month' ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>{it.label}</span>
                  {it.brief && <CalGlyph name="brief" color="var(--fg-4)" size={big ? 12 : 10} />}
                  {big && it.done && <CalGlyph name="check" color={c} size={13} />}
                </button>
              );
              // Chế độ Ngày/Tuần: pill + nội dung đầy đủ ngay dưới. Tháng thì bỏ qua detail (mật độ).
              const withDetail = it.detail && mode !== 'month'
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{pill}{it.detail}</div>
                : null;
              if (withDetail) return <div key={String(it.id) + it.date}>{withDetail}</div>;
              if (!it.brief) return <div key={String(it.id) + it.date}>{pill}</div>;
              const b = it.brief;
              // Có bàn giao → bọc wrapper `position:relative`; popover là con → hover wrapper (pill HOẶC popover)
              // giữ mở (pure CSS, không kẹt hover-bridge). Header lặp lại icon+màu của pill = "highlight phần liên quan".
              return (
                <div key={String(it.id) + it.date} className="cal-pill-wrap" style={{ position: 'relative' }}>
                  {pill}
                  <div className="cal-brief" style={briefCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, paddingBottom: 7, borderBottom: '1px solid var(--line)' }}>
                      {it.icon && <CalGlyph name={it.icon} color={c} size={13} />}
                      <span style={{ color: 'var(--fg-1)', fontWeight: 700, fontSize: 11.5 }}>{it.title || it.label}</span>
                    </div>
                    {b.inputs.length > 0 && (
                      <div style={{ marginBottom: b.doneWhen || b.dependsOn.length ? 7 : 0 }}>
                        <div style={briefSec}><CalGlyph name="link" color="var(--fg-4)" size={12} /> Đầu vào</div>
                        {b.inputs.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noreferrer" style={briefLink} onClick={(e) => e.stopPropagation()}>{x.label || x.url} ↗</a>)}
                      </div>
                    )}
                    {b.doneWhen && (
                      <div style={{ marginBottom: b.dependsOn.length ? 7 : 0 }}>
                        <div style={briefSec}><CalGlyph name="check" color="var(--fg-4)" size={12} /> Xong khi</div>
                        <div style={{ color: 'var(--fg-2)' }}>{b.doneWhen}</div>
                      </div>
                    )}
                    {b.dependsOn.length > 0 && (
                      <div>
                        <div style={briefSec}><CalGlyph name="alert" color="var(--fg-4)" size={12} /> Cần trước</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {b.dependsOn.map((d) => <button key={d} type="button" onClick={(e) => { e.stopPropagation(); onItemClick?.(d); }} style={briefChip}>#{d} ↗</button>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {mode !== 'month' && !its.length && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', padding: 4 }}>—</div>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div data-comp="ui.MonthCalendar">
      {/* Hover pill có bàn giao → bung popover (pure CSS; !important thắng inline display:none). Nâng z-index để không bị ô sau che. */}
      <style>{`.cal-pill-wrap:hover{z-index:40}.cal-pill-wrap:hover .cal-brief{display:block!important}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => step(-1)} style={navBtn} title="Lùi">◀</button>
        <div style={{ fontSize: 13, fontWeight: 700, minWidth: 190, textAlign: 'center', textTransform: 'capitalize' }}>{label}</div>
        <button type="button" onClick={() => step(1)} style={navBtn} title="Tiến">▶</button>
        <button type="button" onClick={() => goAnchor(new Date())} style={{ ...navBtn, marginLeft: 4 }}>Hôm nay</button>
        {jumpDay && jumpDay !== anchorStr && (
          <button type="button" onClick={() => { const d = parseYmd(jumpDay); if (d) goAnchor(d); }} style={navBtn}
            title={`Nhảy tới ngày gần nhất còn việc chưa xong (${jumpDay}${jumpDay < todayStr ? ' · quá hạn' : ''})`}>→ Việc gần nhất</button>
        )}
        {/* Đổi chế độ — luôn hiện, một cú bấm qua lại, không giấu trong menu. */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 7, padding: 2, background: 'var(--bg-2)' }}>
          {MODES.map((o) => (
            <button key={o.key} type="button" onClick={() => setMode(o.key)}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 12px', borderRadius: 5, cursor: 'pointer', border: 'none',
                background: mode === o.key ? 'var(--accent)' : 'transparent', color: mode === o.key ? 'var(--bg-0, #0b0d12)' : 'var(--fg-3)' }}>{o.label}</button>
          ))}
        </div>
      </div>
      {/* Cột trái CỐ ĐỊNH ở cả ba chế độ (trước đây Tháng giấu đi): mini-month là chỗ nhảy ngày +
          nắm toàn cảnh, mất nó ở Tháng thì thanh điều hướng đổi hình theo tab — và phần dưới cột
          là chỗ đặt nội dung thường trực (sản phẩm đang dựng). */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 236, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MiniMonth month={miniView} sel={selSet} byDate={byDate} today={today} onPick={(d) => setAnchor(d)} showNav={mode !== 'month'} itemNoun={itemNoun}
            onNavMonth={(dir) => setMiniView((mv) => { const d = mv ?? new Date(); return new Date(d.getFullYear(), d.getMonth() + dir, 1); })} />
          {sidebar}
        </div>
        {grid}
      </div>
      {legend && legend.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 13px', fontSize: 10.5, color: 'var(--fg-4)' }}>
          {legend.map((e, i) => e.sep
            ? <span key={i} style={{ width: 1, height: 12, background: 'var(--line)' }} />
            : (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: e.icon ? 4 : 5 }}>
                {e.icon ? <CalGlyph name={e.icon} color="var(--fg-2)" size={13} /> : <span style={{ width: 4, height: 12, borderRadius: 2, background: e.color }} />}
                {e.label}
              </span>
            ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalGlyph name="check" color="#22c55e" size={13} />đã làm</span>
        </div>
      )}
    </div>
  );
}
