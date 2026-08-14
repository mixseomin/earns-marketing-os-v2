// Segmented — small segmented control for picking 1-of-N short options
// (snippet variant 1/2/3/4, alt variants, view modes). Lower-density
// alternative to a tab strip; used inside cards/modals.
//
// CHỌN NHIỀU: truyền `values` + `onToggle` thay cho `value` + `onChange`. Vẫn đúng một đường render
// (chip active tô accent như cũ) — dropdown MultiSelect là để chọn trong danh sách DÀI; vài lựa chọn
// ngắn luôn-nhìn-thấy thì chip đúng hơn, và không đáng đẻ ra bộ chip thứ hai lệch style.

import type { CSSProperties, ReactNode } from 'react';

export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string | number>({
  options, value, onChange, values, onToggle, size = 'sm', style,
}: {
  options: SegmentedOption<T>[];
  value?: T;
  onChange?: (v: T) => void;
  /** Chế độ chọn nhiều: giá trị đang bật. Mảng rỗng = không lọc gì (caller tự hiểu là "tất cả"). */
  values?: T[];
  onToggle?: (v: T[]) => void;
  size?: 'xs' | 'sm';
  style?: CSSProperties;
}) {
  const multi = !!values && !!onToggle;
  const padding = size === 'xs' ? '1px 6px' : '2px 7px';
  const fontSize = size === 'xs' ? 9 : 10;
  return (
    <span data-comp="ui.Segmented" style={{ display: 'inline-flex', gap: 3, ...style }}>
      {options.map((opt) => {
        const active = multi ? values!.includes(opt.value) : opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            title={opt.title}
            onClick={() => (multi
              ? onToggle!(active ? values!.filter((v) => v !== opt.value) : [...values!, opt.value])
              : onChange?.(opt.value))}
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
          </button>
        );
      })}
    </span>
  );
}
