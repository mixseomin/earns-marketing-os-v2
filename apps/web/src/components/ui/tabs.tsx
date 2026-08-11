'use client';

// Tabs — thanh tab CẤP TRANG (dưới page-head), 1-of-N.
//
// Trước đây mỗi trang tự vẽ: /environments + /library dựng <button className="btn">
// với inline style nền/border-bottom riêng, /platforms mượn CSS .tabs của topbar rồi
// ép lại height/marginLeft. Ba kiểu khác nhau cho cùng một thứ → gộp về đây.
// (Segmented là control NHỎ trong card/modal — không dùng cho tab cấp trang.)
//
// Badge = số đếm; giữ cố định, không đổi theo tab đang chọn, để bấm không xô layout.

import type { ReactNode } from 'react';

export interface TabItem<T extends string> {
  key: T;
  label: ReactNode;
  badge?: ReactNode;      // số đếm / cảnh báo nhỏ bên phải nhãn
  title?: string;
}

export function Tabs<T extends string>({ items, value, onChange, right }: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  right?: ReactNode;      // nội dung ghim mép phải cùng hàng (nút, đếm…)
}) {
  return (
    <div data-comp="ui.Tabs"
         style={{ display: 'flex', alignItems: 'stretch', gap: 2, marginBottom: 12,
                  borderBottom: '1px solid var(--line)', overflowX: 'auto' }}>
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button key={t.key} type="button" title={t.title}
                  onClick={() => onChange(t.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', background: 'transparent', border: 0,
                    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    color: active ? 'var(--fg-0)' : 'var(--fg-2)',
                    fontSize: 12.5, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
            {t.label}
            {t.badge != null && t.badge !== '' && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: active ? 'var(--accent)' : 'var(--bg-3)',
                color: active ? 'var(--bg-0)' : 'var(--fg-1)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
      {right && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>{right}</span>}
    </div>
  );
}
