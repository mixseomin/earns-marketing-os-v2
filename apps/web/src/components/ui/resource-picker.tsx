'use client';

// ResourcePicker — generic "select existing OR create new" modal.
// One canonical pattern instead of re-coding picker UIs every time.
//
// Usage:
//   <ResourcePicker<MyRow>
//     title="Chọn account"
//     items={accounts}
//     getKey={(a) => a.id}
//     renderItem={(a) => ({ title: '@'+a.handle, subtitle: a.platform })}
//     onPick={(a) => { ... }}
//     onClose={() => setOpen(false)}
//     // Optional inline create:
//     createLabel="+ New account"
//     onCreateNew={() => { setOpen(false); openAccountCreateModal(); }}
//     emptyMessage="No accounts match this platform yet."
//   />

import { useState, useMemo, type ReactNode } from 'react';

export interface PickerItem {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  searchText?: string;       // overrides default `${title} ${subtitle}` search corpus
}

export interface ResourcePickerProps<T> {
  title: string;
  hint?: ReactNode;
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T) => PickerItem;
  onPick: (item: T) => void;
  onClose: () => void;
  // Optional inline create
  createLabel?: string;
  onCreateNew?: () => void;
  // UX
  searchable?: boolean;       // default true if items.length > 5
  emptyMessage?: ReactNode;
  width?: number;             // default 520
}

export function ResourcePicker<T>({
  title, hint, items, getKey, renderItem, onPick, onClose,
  createLabel, onCreateNew, searchable, emptyMessage, width = 520,
}: ResourcePickerProps<T>) {
  const [q, setQ] = useState('');
  const showSearch = searchable ?? items.length > 5;

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const ql = q.toLowerCase();
    return items.filter((it) => {
      const r = renderItem(it);
      const corpus = (r.searchText
        ?? `${typeof r.title === 'string' ? r.title : ''} ${typeof r.subtitle === 'string' ? r.subtitle : ''}`).toLowerCase();
      return corpus.includes(ql);
    });
  }, [items, q, renderItem]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: `min(${width}px, 100%)`, maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
            {hint && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{hint}</div>}
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showSearch && (
            <input
              type="text"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              style={{
                padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none',
              }}
            />
          )}

          {filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, background: 'var(--bg-2)', borderRadius: 6, border: '1px dashed var(--line)' }}>
              {q.trim()
                ? <>Không match &ldquo;{q}&rdquo;.</>
                : (emptyMessage ?? 'Không có lựa chọn nào.')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '50vh', overflow: 'auto' }}>
              {filtered.map((it) => {
                const r = renderItem(it);
                return (
                  <button key={getKey(it)} type="button"
                          disabled={r.disabled}
                          onClick={() => onPick(it)}
                          className="btn ghost"
                          style={{
                            justifyContent: 'flex-start', textAlign: 'left',
                            padding: '8px 10px', fontSize: 12,
                            opacity: r.disabled ? 0.5 : 1,
                            cursor: r.disabled ? 'not-allowed' : 'pointer',
                          }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </div>
                        {r.subtitle != null && (
                          <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.subtitle}
                          </div>
                        )}
                      </div>
                      {r.badge != null && <span style={{ flexShrink: 0 }}>{r.badge}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {createLabel && onCreateNew && (
            <button type="button" onClick={onCreateNew}
                    className="btn primary"
                    style={{ marginTop: 4, justifyContent: 'center' }}>
              {createLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
