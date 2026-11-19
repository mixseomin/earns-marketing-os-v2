'use client';
// ChonTim — ô chọn MỘT giá trị có ô tìm (kiểu Select2), thay <select> gốc của trình duyệt trong các gói dùng chung.
// Nút hiện nhãn đang chọn ▾ → mở danh sách neo dưới nút (AnchoredPopover, portal ra body), gõ để lọc,
// ↑/↓ chọn dòng, Enter = chọn, Escape = đóng (stopPropagation để không đóng drawer/khung bên ngoài).
import { useRef, useState, type CSSProperties } from 'react';
import { AnchoredPopover } from './anchored-popover';

export interface ChonTimMuc { v: string; nhan?: string }

export function ChonTim({ value, ds, onChange, style, title, zIndex = 3000 }: {
  value: string;
  ds: ChonTimMuc[];
  onChange: (v: string) => void;
  style?: CSSProperties;
  title?: string;
  zIndex?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mo, setMo] = useState(false);
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const cur = ds.find((x) => x.v === value);
  const loc = ds.filter((x) => !q || (x.nhan ?? x.v).toLowerCase().includes(q.toLowerCase()));
  const dong = () => { setMo(false); setQ(''); ref.current?.focus(); };
  const chon = (v: string) => { onChange(v); dong(); };
  const moRa = () => { setQ(''); setHl(Math.max(0, ds.findIndex((x) => x.v === value))); setMo(true); };
  return <>
    <button ref={ref} type="button" title={title} onClick={() => (mo ? dong() : moRa())}
      onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); moRa(); } }}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, textAlign: 'left', ...style }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur ? (cur.nhan ?? cur.v) : value}</span>
      <span style={{ color: 'var(--fg-3)', fontSize: '0.85em' }}>▾</span>
    </button>
    {mo && <AnchoredPopover anchorRef={ref} open onClose={dong} zIndex={zIndex}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2, var(--line))', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.5)', minWidth: Math.max(160, ref.current?.offsetWidth ?? 0), maxWidth: 360, display: 'flex', flexDirection: 'column' }}>
        <input autoFocus value={q} placeholder={`Tìm trong ${ds.length}…`} autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setHl(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); dong(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(loc.length - 1, h + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const x = loc[hl] ?? loc[0]; if (x) chon(x.v); }
          }}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 8px', border: 0, borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-1)', outline: 'none' }} />
        <div role="listbox" style={{ maxHeight: 280, overflowY: 'auto', padding: 4 }}>
          {loc.map((x, i) => { const on = x.v === value; return (
            <div key={x.v} role="option" aria-selected={on} onClick={() => chon(x.v)} onMouseEnter={() => setHl(i)}
              style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                background: i === hl ? 'var(--bg-2)' : undefined, color: on ? 'var(--accent)' : 'var(--fg-1)' }}>
              {x.nhan ?? x.v}
            </div>); })}
          {!loc.length && <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--fg-3)' }}>không có kết quả</div>}
        </div>
      </div>
    </AnchoredPopover>}
  </>;
}
