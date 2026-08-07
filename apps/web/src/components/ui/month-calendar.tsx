'use client';

// MonthCalendar — lịch dùng chung. Đưa vào các mục có ngày ({date:'YYYY-MM-DD'}), nó thả mỗi mục
// vào đúng ô. `dim` = mục mờ (vd đã hẹn lịch, chưa làm) so với đã xong. Tuần bắt đầu Thứ 2.
//
// BA CHẾ ĐỘ như Google Calendar: Tháng · Tuần · Ngày (2026-08-07).
// Lưới tháng nhìn được toàn cảnh nhưng mỗi ô chỉ nhét được 2-3 việc; ngày dồn việc thì vừa chật vừa
// đọc không ra. Tuần/Ngày dùng chung đúng một hàm dựng danh sách ngày — chỉ khác số cột và bước
// nhảy của nút ◀ ▶ — nên không đẻ thêm component thứ hai để rồi lệch nhau.
import { useState, type CSSProperties } from 'react';

export interface CalItem { id: number | string; date: string; label: string; dim?: boolean; color?: string; title?: string; }
export type CalMode = 'month' | 'week' | 'day';

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const navBtn: CSSProperties = { fontSize: 12, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };

const MODES: { key: CalMode; label: string }[] = [
  { key: 'month', label: 'Tháng' }, { key: 'week', label: 'Tuần' }, { key: 'day', label: 'Ngày' },
];

export function MonthCalendar({ items, onItemClick, initialMonth, mode: modeProp, onModeChange }: {
  items: CalItem[];
  onItemClick?: (id: number | string) => void;
  initialMonth?: Date;
  /** Chế độ hiện tại. Bỏ trống = component tự giữ (dùng khi không cần đồng bộ URL). */
  mode?: CalMode;
  onModeChange?: (m: CalMode) => void;
}) {
  const [anchor, setAnchor] = useState(() => initialMonth ?? new Date());
  const [modeSelf, setModeSelf] = useState<CalMode>('month');
  const mode = modeProp ?? modeSelf;
  const setMode = (m: CalMode) => { setModeSelf(m); onModeChange?.(m); };

  // Một nguồn duy nhất dựng danh sách ngày cho cả ba chế độ.
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const cols = mode === 'day' ? 1 : 7;
  const days: Date[] = mode === 'month'
    ? (() => { const g = addDays(new Date(y, m, 1), -((new Date(y, m, 1).getDay() + 6) % 7)); return Array.from({ length: 42 }, (_, i) => addDays(g, i)); })()
    : mode === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i))
      : [anchor];

  const byDate = new Map<string, CalItem[]>();
  for (const it of items) { (byDate.get(it.date) ?? byDate.set(it.date, []).get(it.date)!).push(it); }
  const todayStr = ymd(new Date());

  // Nhảy theo đúng đơn vị đang xem — tháng nhảy tháng, tuần nhảy 7 ngày, ngày nhảy 1 ngày.
  const step = (dir: 1 | -1) => setAnchor(mode === 'month' ? new Date(y, m + dir, 1) : addDays(anchor, dir * (mode === 'week' ? 7 : 1)));
  const label = mode === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${mondayOf(anchor).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} – ${addDays(mondayOf(anchor), 6).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  // Ô cao hơn khi ít cột: tuần/ngày có chỗ nên hiện được nhiều việc thay vì cắt.
  const minH = mode === 'month' ? 78 : mode === 'week' ? 300 : 420;

  return (
    <div data-comp="ui.MonthCalendar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => step(-1)} style={navBtn} title="Lùi">◀</button>
        <div style={{ fontSize: 13, fontWeight: 700, minWidth: 190, textAlign: 'center', textTransform: 'capitalize' }}>{label}</div>
        <button type="button" onClick={() => step(1)} style={navBtn} title="Tiến">▶</button>
        <button type="button" onClick={() => setAnchor(new Date())} style={{ ...navBtn, marginLeft: 4 }}>Hôm nay</button>
        {/* Đổi chế độ — luôn hiện, một cú bấm qua lại, không giấu trong menu. */}
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', border: '1px solid var(--line)', borderRadius: 7, padding: 2, background: 'var(--bg-2)' }}>
          {MODES.map((o) => (
            <button key={o.key} type="button" onClick={() => setMode(o.key)}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 12px', borderRadius: 5, cursor: 'pointer', border: 'none',
                background: mode === o.key ? 'var(--accent)' : 'transparent', color: mode === o.key ? 'var(--bg-0, #0b0d12)' : 'var(--fg-3)' }}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
        {mode !== 'day' && WD.map((w) => <div key={w} style={{ fontSize: 10, color: 'var(--fg-4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em', paddingBottom: 2 }}>{w}</div>)}
        {days.map((d) => {
          const ds = ymd(d); const inMonth = mode !== 'month' || d.getMonth() === m; const its = byDate.get(ds) || []; const isToday = ds === todayStr;
          return (
            <div key={ds} style={{ minHeight: minH, padding: 4, borderRadius: 6, border: `1px solid ${isToday ? 'var(--neon-cyan)' : 'var(--line)'}`, background: inMonth ? 'var(--bg-1)' : 'transparent', opacity: inMonth ? 1 : 0.4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 10.5, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--neon-cyan)' : 'var(--fg-3)', textAlign: mode === 'day' ? 'left' : 'right' }}>
                {mode === 'day' ? `${its.length} việc` : d.getDate()}
              </div>
              {its.map((it) => {
                const c = it.color || 'var(--accent)';
                return (
                  <button key={String(it.id) + it.date} type="button" title={it.title || it.label} onClick={() => onItemClick?.(it.id)}
                    // Tháng: 2 dòng (ô hẹp). Tuần/Ngày: hiện đủ — nhãn là tiêu đề việc, cắt sau 3 chữ thì vô nghĩa.
                    style={{ textAlign: 'left', fontSize: mode === 'day' ? 12 : 9.5, fontWeight: 600, padding: mode === 'day' ? '4px 8px' : '1px 5px', borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
                      ...(mode === 'month' ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const } : {}),
                      lineHeight: 1.3, wordBreak: 'break-word',
                      border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} ${it.dim ? 8 : 20}%, transparent)`, color: c, opacity: it.dim ? 0.6 : 1 }}>
                    {it.dim ? '🗓 ' : ''}{it.label}
                  </button>
                );
              })}
              {mode !== 'month' && !its.length && <div style={{ fontSize: 10.5, color: 'var(--fg-4)', padding: 4 }}>—</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
