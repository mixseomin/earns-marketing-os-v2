'use client';
// Segmented — small segmented control for picking 1-of-N short options
// (snippet variant 1/2/3/4, alt variants, view modes). Lower-density
// alternative to a tab strip; used inside cards/modals.
//
// CHỌN NHIỀU: truyền `values` + `onToggle` thay cho `value` + `onChange`. Vẫn đúng một đường render
// (chip active tô accent như cũ) — dropdown MultiSelect là để chọn trong danh sách DÀI; vài lựa chọn
// ngắn luôn-nhìn-thấy thì chip đúng hơn, và không đáng đẻ ra bộ chip thứ hai lệch style.

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { moTabNeuModifier } from '@/lib/url-mo-tab';

export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  title?: string;
  /** MENU CON khi rê chuột (etp 28/10/2026: "hover các tab chính thì show luôn dropdown với các option con; bấm ngay vẫn vào cái đầu tiên"):
   * rê vào lựa chọn → thả danh sách ngay dưới nó; bấm chính lựa chọn vẫn gọi onChange như cũ. */
  menu?: SegmentedMenuItem[];
}
export interface SegmentedMenuItem { key: string; label: ReactNode; title?: string; active?: boolean; onPick: () => void }

/** menu con thả dưới một nút: portal ra <body> (thanh công cụ cuộn ngang không cắt), trễ đóng 200ms để kịp rê chuột xuống */
function MenuCon({ menu, children }: { menu?: SegmentedMenuItem[]; children: (p: { ref: React.RefObject<HTMLButtonElement | null>; mo: () => void; dong: () => void }) => ReactNode }) {
  const ref = useRef<HTMLButtonElement | null>(null); const hen = useRef<number | undefined>(undefined);
  const [toaDo, setToaDo] = useState<{ x: number; y: number } | null>(null);
  const giu = () => { if (hen.current) window.clearTimeout(hen.current); };
  const mo = () => { if (!menu?.length) return; giu(); const b = ref.current?.getBoundingClientRect(); if (b) setToaDo({ x: b.left, y: b.bottom + 2 }); };
  const dong = () => { giu(); hen.current = window.setTimeout(() => setToaDo(null), 200); };
  return <>
    {children({ ref, mo, dong })}
    {toaDo && menu?.length && typeof document !== 'undefined' ? createPortal(
      <div data-comp="ui.Segmented.menu" onMouseEnter={giu} onMouseLeave={dong} style={{ position: 'fixed', left: toaDo.x, top: toaDo.y, zIndex: 80, minWidth: 150, padding: 4,
        background: 'var(--bg-1, #111)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {menu.map((m) => <button key={m.key} type="button" title={m.title} onClick={() => { setToaDo(null); m.onPick(); }}
          style={{ textAlign: 'left', padding: '5px 10px', fontSize: 12, borderRadius: 5, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: m.active ? 'var(--accent-soft)' : 'transparent', color: m.active ? 'var(--accent)' : 'var(--fg-1)', fontWeight: m.active ? 600 : 400 }}
          onMouseEnter={(e) => { if (!m.active) e.currentTarget.style.background = 'var(--hover, rgba(255,255,255,.07))'; }}
          onMouseLeave={(e) => { if (!m.active) e.currentTarget.style.background = 'transparent'; }}>{m.label}</button>)}
      </div>, document.body) : null}
  </>;
}

// Union chứ KHÔNG phải 4 prop optional: optional hết thì quên cả hai cặp vẫn compile, ra một dãy
// chip bấm không ăn. Kiểu này bắt caller chọn đúng một chế độ và đủ cặp.
type SegmentedMode<T> =
  | { value: T; onChange: (v: T) => void; values?: never; onToggle?: never }
  /** Chọn nhiều: mảng rỗng = không lọc gì (caller tự hiểu là "tất cả"). */
  | { values: T[]; onToggle: (v: T[]) => void; value?: never; onChange?: never };

export function Segmented<T extends string | number>({
  options, value, onChange, values, onToggle, size = 'sm', style, hrefFor,
}: {
  options: SegmentedOption<T>[];
  size?: 'xs' | 'sm';
  style?: CSSProperties;
  /** URL tương ứng khi chọn option này — ⌘/Ctrl-click hoặc chuột giữa mở TAB MỚI với URL đó, không đổi state. */
  hrefFor?: (value: T) => string | null | undefined;
} & SegmentedMode<T>) {
  const padding = size === 'xs' ? '1px 6px' : '2px 7px';
  const fontSize = size === 'xs' ? 9 : 10;
  return (
    <span data-comp="ui.Segmented" style={{ display: 'inline-flex', gap: 3, ...style }}>
      {options.map((opt) => {
        const active = values ? values.includes(opt.value) : opt.value === value;
        return (
          <MenuCon key={String(opt.value)} menu={opt.menu}>{({ ref, mo, dong }) => (
          <button
            ref={ref}
            onMouseEnter={mo}
            onMouseLeave={dong}
            type="button"
            title={opt.menu?.length ? undefined : opt.title}
            onClick={(e) => {
              if (hrefFor && moTabNeuModifier(e, hrefFor(opt.value))) return;
              if (values && onToggle) onToggle(active ? values.filter((v) => v !== opt.value) : [...values, opt.value]);
              else onChange?.(opt.value);
            }}
            onAuxClick={(e) => { if (hrefFor) moTabNeuModifier(e, hrefFor(opt.value)); }}
            style={{
              padding,
              fontSize,
              fontFamily: 'var(--font-mono)',
              fontWeight: active ? 700 : 500,
              background: active ? 'var(--accent-soft)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--fg-2)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'var(--line)'}`,
              borderRadius: 4,
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            {opt.label}
          </button>)}
          </MenuCon>
        );
      })}
    </span>
  );
}
