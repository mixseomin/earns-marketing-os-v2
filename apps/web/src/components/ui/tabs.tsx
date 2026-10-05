'use client';

// Tabs — thanh tab CẤP TRANG (dưới page-head), 1-of-N.
//
// Trước đây mỗi trang tự vẽ: /environments + /library dựng <button className="btn">
// với inline style nền/border-bottom riêng, /platforms mượn CSS .tabs của topbar rồi
// ép lại height/marginLeft. Ba kiểu khác nhau cho cùng một thứ → gộp về đây.
// (Segmented là control NHỎ trong card/modal — không dùng cho tab cấp trang.)
//
// Badge = số đếm; giữ cố định, không đổi theo tab đang chọn, để bấm không xô layout.
// onReorder: cho kéo-thả đổi thứ tự tab (HTML5 drag, không lib). Caller giữ thứ tự + lưu (cookie/URL);
// Tabs chỉ báo mảng key mới.

import { useState, type ReactNode } from 'react';
import { moTabNeuModifier } from '@/lib/url-mo-tab';

export interface TabItem<T extends string> {
  key: T;
  label: ReactNode;
  badge?: ReactNode;      // số đếm / cảnh báo nhỏ bên phải nhãn
  title?: string;
  nhom?: string;          // tab liền nhau cùng nhóm → một cụm có nhãn nhỏ phía trên, vạch ngăn giữa các cụm (sổ lib/tab-trang.ts)
}

/** Gom tab liền nhau cùng `nhom` thành cụm; không tab nào có nhóm = một cụm trần (vẽ như cũ). */
function cum<T extends string>(items: TabItem<T>[]): { nhom?: string; items: TabItem<T>[] }[] {
  const ra: { nhom?: string; items: TabItem<T>[] }[] = [];
  for (const t of items) {
    const cuoi = ra[ra.length - 1];
    if (cuoi && cuoi.nhom === t.nhom) cuoi.items.push(t); else ra.push({ nhom: t.nhom, items: [t] });
  }
  return ra;
}

export function Tabs<T extends string>({ items, value, onChange, right, onReorder, hrefFor, dinh = !!hrefFor }: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  right?: ReactNode;      // nội dung ghim mép phải cùng hàng (nút, đếm…)
  onReorder?: (keys: T[]) => void;
  // Tab NÀO map ra URL (?tab=) thì khai hàm này → ⌘/Ctrl-click (hoặc chuột giữa) MỞ TAB MỚI
  // như link bình thường, thay vì đổi tab tại chỗ. Optional: sub-tab dùng state cục bộ (không
  // có URL) bỏ trống là giữ nguyên hành vi cũ. Cùng khuôn Segmented/ViewToggle (url-mo-tab.ts).
  hrefFor?: (key: T) => string | null | undefined;
  // DÍNH mép trên khung cuộn (.main) khi cuộn xuống, để luôn biết đang ở tab nào (anh chốt 01/10/2026 ở /shop). Mặc định bật cho tab
  // cấp trang (có hrefFor = tab ghi URL, khai ở lib/tab-trang.ts); tab con trong drawer/card không dính. Tắt riêng: dinh={false}.
  dinh?: boolean;
}) {
  const [keo, setKeo] = useState<T | null>(null);
  const tha = (dich: T) => {
    if (!onReorder || keo == null || keo === dich) return;
    const keys = items.map((t) => t.key).filter((k) => k !== keo);
    keys.splice(keys.indexOf(dich), 0, keo);
    onReorder(keys);
  };
  return (
    <div data-comp="ui.Tabs" role="tablist"
         style={{ display: 'flex', alignItems: 'stretch', gap: 2, marginBottom: 12,
                  borderBottom: '1px solid var(--line)', overflowX: 'auto',
                  // boxShadow phủ dải lề trên của .main (var(--s-4)) để nội dung không lướt qua khe phía trên thanh khi đang dính
                  ...(dinh ? { position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-0)', boxShadow: '0 calc(-1 * var(--s-4)) 0 var(--bg-0)' } : {}) }}>
      {cum(items).map((c, ci) => (
        <div key={c.nhom ?? ci} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0,
          ...(ci ? { borderLeft: c.nhom ? '1px solid var(--line)' : undefined, paddingLeft: c.nhom ? 4 : 0, marginLeft: c.nhom ? 4 : 0 } : {}) }}>
          {c.nhom && <span style={{ padding: '2px 12px 0', fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{c.nhom}</span>}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
      {c.items.map((t) => {
        const active = t.key === value;
        return (
          <button key={t.key} type="button" title={t.title} role="tab" aria-selected={active}
                  onClick={(e) => { if (hrefFor && moTabNeuModifier(e, hrefFor(t.key))) return; onChange(t.key); }}
                  onAuxClick={hrefFor ? (e) => { moTabNeuModifier(e, hrefFor(t.key)); } : undefined}
                  draggable={!!onReorder}
                  onDragStart={onReorder ? () => setKeo(t.key) : undefined}
                  onDragOver={onReorder ? (e) => e.preventDefault() : undefined}
                  onDrop={onReorder ? () => { tha(t.key); setKeo(null); } : undefined}
                  onDragEnd={onReorder ? () => setKeo(null) : undefined}
                  style={{
                    opacity: keo === t.key ? 0.4 : 1,
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
          </div>
        </div>
      ))}
      {right && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>{right}</span>}
    </div>
  );
}
