'use client';

// MonthCalendar — lịch dùng chung. Đưa vào các mục có ngày ({date:'YYYY-MM-DD'}), nó thả mỗi mục
// vào đúng ô. `dim` = mục mờ (vd đã hẹn lịch, chưa làm) so với đã xong. Tuần bắt đầu Thứ 2.
//
// BA CHẾ ĐỘ như Google Calendar: Tháng · Tuần · Ngày. Lưới tháng cho toàn cảnh; Tuần/Ngày zoom vào
// chi tiết. Ở Tuần/Ngày (view hẹp) kèm 1 MINI-MONTH bên trái — y hệt Google Calendar — để vừa NHẢY
// nhanh sang ngày khác vừa NẮM TOÀN CẢNH cả tháng (chấm dưới ngày = ngày đó có việc). Tuần/Ngày dùng
// chung đúng một hàm dựng danh sách ngày — chỉ khác số cột và bước nhảy ◀ ▶.
import { useState, type CSSProperties } from 'react';

export interface CalItem {
  id: number | string; date: string; label: string; title?: string;
  color?: string;          // màu TRẠNG THÁI: drives thanh-trái + nền tint + viền (green=done, amber=đang/hẹn, purple=chờ duyệt, grey=chờ, red=chặn)
  icon?: GlyphName;        // icon LOẠI/ngữ-cảnh (SVG, đồng nhất): pin=followup · link=backlink · sprout=seed · clock=chờ duyệt · calendar=hẹn lại
  done?: boolean;          // đã làm → thêm ✓ + thanh xanh
  dim?: boolean;           // mờ (mục tương lai/đã bỏ)
}
export type CalMode = 'month' | 'week' | 'day';

// SVG line-icon (không dùng native emoji — render đồng nhất mọi OS). stroke = currentColor truyền vào.
type GlyphName = 'pin' | 'link' | 'sprout' | 'check' | 'clock' | 'calendar' | 'alert' | 'dot';
const GLYPH: Record<GlyphName, React.ReactNode> = {
  pin: <><path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" /><circle cx="12" cy="11" r="2.4" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  sprout: <><path d="M12 20v-7" /><path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6z" /><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3.5v4M16 3.5v4" /></>,
  alert: <><path d="M12 4 3 19h18L12 4z" /><path d="M12 10v4M12 16.5h.01" /></>,
  dot: <circle cx="12" cy="12" r="4" />,
};
function CalGlyph({ name, color, size = 13 }: { name: GlyphName; color: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>{GLYPH[name]}</svg>;
}

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WD1 = ['2', '3', '4', '5', '6', '7', 'C'];   // mini-month header (1 ký tự)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const monthGrid = (monthDate: Date) => { const g = mondayOf(firstOfMonth(monthDate)); return Array.from({ length: 42 }, (_, i) => addDays(g, i)); };
const navBtn: CSSProperties = { fontSize: 12, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const miniNav: CSSProperties = { fontSize: 10, padding: '1px 6px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', lineHeight: 1.6 };

const MODES: { key: CalMode; label: string }[] = [
  { key: 'month', label: 'Tháng' }, { key: 'week', label: 'Tuần' }, { key: 'day', label: 'Ngày' },
];

// MINI-MONTH: lưới tháng thu nhỏ (như sidebar Google Calendar). Ngày hôm nay khoanh, ngày đang chọn
// tô nền accent, ngày có việc có 1 chấm nhỏ ở dưới → liếc là biết cả tháng chỗ nào có việc. Bấm ngày = nhảy.
function MiniMonth({ month, sel, byDate, onPick, onNavMonth }: {
  month: Date; sel: Set<string>; byDate: Map<string, CalItem[]>; onPick: (d: Date) => void; onNavMonth: (dir: 1 | -1) => void;
}) {
  const m = month.getMonth();
  const todayStr = ymd(new Date());
  const cells = monthGrid(month);
  return (
    <div style={{ width: 236, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, flex: 1, textTransform: 'capitalize' }}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button type="button" onClick={() => onNavMonth(-1)} style={miniNav} title="Tháng trước">◀</button>
        <button type="button" onClick={() => onNavMonth(1)} style={miniNav} title="Tháng sau">▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {WD1.map((w, i) => <div key={i} style={{ fontSize: 9, color: 'var(--fg-4)', textAlign: 'center', paddingBottom: 2 }}>{w}</div>)}
        {cells.map((d) => {
          const ds = ymd(d); const inM = d.getMonth() === m; const isToday = ds === todayStr; const isSel = sel.has(ds);
          const its = byDate.get(ds) || []; const dot = its[0]?.color || 'var(--accent)';
          return (
            <button key={ds} type="button" onClick={() => onPick(d)} title={its.length ? `${its.length} việc` : undefined}
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
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> ngày có việc
      </div>
    </div>
  );
}

export function MonthCalendar({ items, onItemClick, initialMonth, mode: modeProp, onModeChange }: {
  items: CalItem[];
  onItemClick?: (id: number | string) => void;
  initialMonth?: Date;
  /** Chế độ hiện tại. Bỏ trống = component tự giữ (dùng khi không cần đồng bộ URL). */
  mode?: CalMode;
  onModeChange?: (m: CalMode) => void;
}) {
  const [anchor, setAnchor] = useState(() => initialMonth ?? new Date());
  const [miniView, setMiniView] = useState(() => firstOfMonth(initialMonth ?? new Date()));   // tháng mini-month đang hiện
  const [modeSelf, setModeSelf] = useState<CalMode>('month');
  const mode = modeProp ?? modeSelf;
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
  const todayStr = ymd(new Date());
  const anchorStr = ymd(anchor);
  // Ngày "được chọn": Ngày = đúng anchor; Tuần = cả 7 ngày của tuần (band trong mini-month).
  const selSet = new Set(mode === 'week' ? days.map(ymd) : [anchorStr]);

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
  const showMini = mode !== 'month';   // giữ mini-month ở Tuần + Ngày (nắm toàn cảnh tháng + chọn/nhảy ngày)

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
              return (
                // Thanh-trái = màu TRẠNG THÁI · icon SVG = LOẠI · nền/viền tint theo màu · ✓ = đã làm. Chữ trung tính để dễ đọc.
                <button key={String(it.id) + it.date} type="button" title={it.title || it.label} onClick={() => onItemClick?.(it.id)}
                  style={{ position: 'relative', display: 'flex', alignItems: big ? 'center' : 'flex-start', gap: big ? 6 : 4,
                    textAlign: 'left', fontSize: big ? 12 : 9.5, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word',
                    padding: big ? '4px 8px 4px 10px' : '2px 4px 2px 8px', borderRadius: 5, cursor: 'pointer', overflow: 'hidden',
                    border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`,
                    background: `color-mix(in srgb, ${c} ${it.dim ? 8 : 15}%, transparent)`, opacity: it.dim ? 0.78 : 1 }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: big ? 4 : 3, background: c }} />
                  {it.icon && <CalGlyph name={it.icon} color={c} size={big ? 13 : 11} />}
                  <span style={{ flex: 1, minWidth: 0, color: it.dim ? 'var(--fg-3)' : 'var(--fg-1)',
                    ...(mode === 'month' ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}) }}>{it.label}</span>
                  {big && it.done && <CalGlyph name="check" color={c} size={13} />}
                </button>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => step(-1)} style={navBtn} title="Lùi">◀</button>
        <div style={{ fontSize: 13, fontWeight: 700, minWidth: 190, textAlign: 'center', textTransform: 'capitalize' }}>{label}</div>
        <button type="button" onClick={() => step(1)} style={navBtn} title="Tiến">▶</button>
        <button type="button" onClick={() => goAnchor(new Date())} style={{ ...navBtn, marginLeft: 4 }}>Hôm nay</button>
        {/* Đổi chế độ — luôn hiện, một cú bấm qua lại, không giấu trong menu. */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 7, padding: 2, background: 'var(--bg-2)' }}>
          {MODES.map((o) => (
            <button key={o.key} type="button" onClick={() => setMode(o.key)}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 12px', borderRadius: 5, cursor: 'pointer', border: 'none',
                background: mode === o.key ? 'var(--accent)' : 'transparent', color: mode === o.key ? 'var(--bg-0, #0b0d12)' : 'var(--fg-3)' }}>{o.label}</button>
          ))}
        </div>
      </div>
      {showMini ? (
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <MiniMonth month={miniView} sel={selSet} byDate={byDate} onPick={(d) => setAnchor(d)}
            onNavMonth={(dir) => setMiniView((mv) => new Date(mv.getFullYear(), mv.getMonth() + dir, 1))} />
          {grid}
        </div>
      ) : grid}
    </div>
  );
}
