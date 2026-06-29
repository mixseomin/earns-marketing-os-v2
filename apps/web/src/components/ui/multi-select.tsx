'use client';

// MultiSelect — primitive multi-select dropdown standard.
// Pattern: button summary + popup checkbox list với inline search + count.
//
// Reusable cho mọi filter trong MOS2:
//   - seeding-cockpit: platform / account / habitat filters (variant='default')
//   - all-posts-tab: habitat / account / brief / content-type (variant='chip')
//   - tương lai: tribe / phase / status… filters
//
// Generic theo T (string platformKey hoặc number accountId/habitatId).
// 2 variants:
//   - 'default': button bordered (filter bar, vd seeding-cockpit toolbar)
//   - 'chip': pill rounded với label inline prefix (table header filter,
//             vd all-posts-tab advanced filter row)

import { useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IconChevron } from './icons';

export interface MultiSelectOption<T> {
  value: T;
  label: string;
  count?: number;     // optional — hiển thị bên phải nếu có
}

export interface MultiSelectProps<T extends string | number> {
  label: string;                          // Default label khi không có selection
  options: Array<MultiSelectOption<T>>;
  selected: T[];
  onChange: (v: T[]) => void;
  /** Customize placeholder cho inline search */
  searchPlaceholder?: string;
  /** Custom width khi mở popup */
  popupWidth?: number;
  /** Compact mode: trigger nhỏ hơn (default variant only) */
  compact?: boolean;
  /** Force disable search input (mặc định chỉ show khi options >= 8) */
  hideSearch?: boolean;
  /** Visual variant. 'default' button bordered, 'chip' pill rounded. */
  variant?: 'default' | 'chip';
  /** Render popup qua portal (position:fixed) — cho table cell overflow:hidden. */
  portal?: boolean;
}

export function MultiSelect<T extends string | number>({
  label, options, selected, onChange,
  searchPlaceholder, popupWidth, compact = false, hideSearch = false,
  variant = 'default', portal = false,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; minW: number } | null>(null);
  const toggle = () => {
    if (!open && portal) {
      const r = triggerWrapRef.current?.getBoundingClientRect();
      if (r) setCoords({ left: r.left, top: r.bottom + 4, minW: r.width });
    }
    setOpen((v) => !v);
  };
  const selectedSet = new Set(selected);
  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const summary = selected.length === 0
    ? label
    : selected.length === 1
    ? options.find((o) => o.value === selected[0])?.label ?? label
    : `${label} (${selected.length})`;

  const showSearch = !hideSearch && options.length >= 8;

  const trigger = variant === 'chip' ? (
    <button type="button" onClick={toggle}
            title={selected.length > 0
              ? `${selected.length} ${label.toLowerCase()} selected · click toggle`
              : `Lọc theo ${label.toLowerCase()}`}
            style={{
              padding: '2px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
              fontWeight: 700, borderRadius: 999, cursor: 'pointer',
              background: selected.length > 0 ? 'var(--accent)' : 'var(--bg-2)',
              color: selected.length > 0 ? '#fff' : 'var(--fg-2)',
              border: `1px solid ${selected.length > 0 ? 'var(--accent)' : 'var(--line)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
      {selected.length === 0 ? `Tất cả (${options.length})` : `${selected.length} đã chọn`}
      <IconChevron dir={open ? 'down' : 'right'} size={9} />
    </button>
  ) : (
    <button type="button" onClick={toggle}
            title={selected.length > 0
              ? `${selected.length} ${label.toLowerCase()} selected · click toggle`
              : `Lọc theo ${label.toLowerCase()}`}
            style={{
              padding: compact ? '3px 8px' : '6px 10px',
              borderRadius: 6, cursor: 'pointer',
              background: selected.length > 0 ? 'var(--accent-soft)' : 'var(--bg-2)',
              border: `1px solid ${selected.length > 0 ? 'var(--accent-line)' : 'var(--line)'}`,
              color: selected.length > 0 ? 'var(--accent)' : 'var(--fg-1)',
              fontSize: compact ? 11 : 11.5,
              fontWeight: selected.length > 0 ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
      {summary}
      <IconChevron dir={open ? 'down' : 'right'} size={9} />
    </button>
  );

  const boxStyle: CSSProperties = {
    maxHeight: 360, overflowY: 'auto', background: 'var(--bg-1)',
    border: '1px solid var(--line-2)', borderRadius: 6,
    boxShadow: '0 12px 32px rgba(0,0,0,.5)', padding: 6,
  };
  const popupBody = (
    <>
      {showSearch && (
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder={searchPlaceholder ?? `Tìm ${label.toLowerCase()}…`}
                 autoComplete="off"
                 data-1p-ignore="true"
                 data-lpignore="true"
                 style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-2)',
                          border: '1px solid var(--line)', borderRadius: 4,
                          color: 'var(--fg-0)', fontSize: 11.5, marginBottom: 4,
                          outline: 'none', boxSizing: 'border-box' }} />
        )}
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])}
                  style={{ width: '100%', padding: '4px 8px', background: 'none',
                           border: 'none', textAlign: 'left', cursor: 'pointer',
                           color: 'var(--fg-3)', fontSize: 11, fontStyle: 'italic' }}>
            ✕ Bỏ chọn tất cả ({selected.length})
          </button>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: '8px 6px', color: 'var(--fg-4)', fontSize: 11,
                        textAlign: 'center', fontStyle: 'italic' }}>
            Không tìm thấy
          </div>
        )}
        {filtered.map((o) => {
          const isSelected = selectedSet.has(o.value);
          return (
            <label key={String(o.value)}
                   style={{ display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                            background: isSelected ? 'var(--accent-soft)' : 'transparent',
                            fontSize: 11.5 }}
                   onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-2)'; }}
                   onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
              <input type="checkbox" checked={isSelected}
                     onChange={() => {
                       if (isSelected) onChange(selected.filter((v) => v !== o.value));
                       else onChange([...selected, o.value]);
                     }}
                     style={{ accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ flex: 1, color: isSelected ? 'var(--accent)' : 'var(--fg-1)',
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                             fontWeight: isSelected ? 600 : 400 }}>
                {o.label}
              </span>
              {o.count != null && (
                <span style={{ fontSize: 10, color: 'var(--fg-4)',
                               fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {o.count}
                </span>
              )}
            </label>
          );
        })}
    </>
  );

  const overlay = <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />;
  const popup = portal ? createPortal(
    <>
      {overlay}
      <div style={{ position: 'fixed', left: coords?.left ?? 0, top: coords?.top ?? 0, zIndex: 41,
                    minWidth: Math.max(popupWidth ?? 220, coords?.minW ?? 0), maxWidth: popupWidth ?? 340, ...boxStyle }}>
        {popupBody}
      </div>
    </>, document.body,
  ) : (
    <>
      {overlay}
      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 41,
                    minWidth: popupWidth ?? 240, maxWidth: popupWidth ?? 320, ...boxStyle }}>
        {popupBody}
      </div>
    </>
  );

  // chip variant có label prefix inline TRƯỚC trigger
  if (variant === 'chip') {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {label}:
        </span>
        <div ref={triggerWrapRef} style={{ position: 'relative' }}>
          {trigger}
          {open && popup}
        </div>
      </div>
    );
  }

  return (
    <div ref={triggerWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {open && popup}
    </div>
  );
}
