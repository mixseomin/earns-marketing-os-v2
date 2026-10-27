'use client';
// Ô CHỌN KIỂU SELECT2 (anh 27/10/2026, etp.on.tc: "Gộp lại theo nhóm. Tất cả dùng select2"): nút gọn "Nhãn: giá trị ▾" → bảng nổi có ô tìm,
// lựa chọn gom theo NHÓM (tiêu đề nhóm), số đếm bên phải, dấu ✓ ở mục đang chọn; phím ↑ ↓ Enter Esc. Thay cho <select> trần và hàng chip dài —
// mọi bộ lọc dùng chung một kiểu. Bảng nổi = AnchoredPopover (portal ra body, không lệch trong Drawer).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnchoredPopover } from './anchored-popover';

export interface Chon2Muc { value: string; label: ReactNode; nhom?: string; dem?: number; title?: string; tim?: string }

export function Chon2({ value, onChange, options, nhan, rong = 'tất cả', title, minWidth, align = 'left', anRong }: {
  value: string; onChange: (v: string) => void; options: Chon2Muc[];
  /** chữ đứng trước giá trị trên nút: "Luật", "Loại"… */ nhan?: string;
  /** nhãn khi value = '' (mục "tất cả" tự thêm đầu danh sách) */ rong?: string;
  title?: string; minWidth?: number; align?: 'left' | 'right';
  /** true = không tự thêm mục '' (danh sách đã có đủ lựa chọn) */ anRong?: boolean;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  const [q, setQ] = useState('');
  const [tro, setTro] = useState(0);
  const ds = useMemo(() => (anRong ? options : [{ value: '', label: rong } as Chon2Muc, ...options]), [options, rong, anRong]);
  const chu = (m: Chon2Muc) => (m.tim ?? (typeof m.label === 'string' ? m.label : m.value)).toLowerCase();
  const loc = useMemo(() => { const k = q.trim().toLowerCase(); return k ? ds.filter((m) => chu(m).includes(k) || (m.nhom ?? '').toLowerCase().includes(k)) : ds; }, [ds, q]);
  useEffect(() => { if (mo) { setQ(''); setTro(Math.max(0, ds.findIndex((m) => m.value === value))); } }, [mo]);   // eslint-disable-line react-hooks/exhaustive-deps
  const dang = ds.find((m) => m.value === value);
  const chon = (v: string) => { onChange(v); setMo(false); };
  const phim = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setTro((i) => Math.min(loc.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setTro((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const m = loc[tro]; if (m) chon(m.value); }
    else if (e.key === 'Escape') setMo(false);
  };
  const coLoc = value !== '' && !anRong;
  return (
    <>
      <button ref={ref} type="button" data-comp="ui.Chon2" title={title} onClick={() => setMo((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', minWidth, maxWidth: '100%',
          border: `1px solid ${coLoc ? 'var(--accent, #60a5fa)' : 'var(--line)'}`, background: coLoc ? 'var(--accent-soft, rgba(59,130,246,.15))' : 'var(--bg-1, #111)', color: 'inherit' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{nhan ? <span style={{ color: 'var(--fg-2)' }}>{nhan}: </span> : null}{dang?.label ?? rong}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>▾</span>
      </button>
      <AnchoredPopover anchorRef={ref} open={mo} onClose={() => setMo(false)} align={align}>
        <div onKeyDown={phim} style={{ width: 260, maxWidth: '92vw', background: 'var(--bg-0, #0b0d12)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.5)', color: 'var(--fg-1)', overflow: 'hidden' }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setTro(0); }} placeholder="Tìm…"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit' }} />
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: '4px 0' }}>
            {loc.length ? loc.map((m, i) => (
              <div key={m.value || '_'}>
                {m.nhom && m.nhom !== loc[i - 1]?.nhom ? <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-3, #777)', padding: '8px 10px 3px' }}>{m.nhom}</div> : null}
                <div role="option" aria-selected={m.value === value} title={m.title} onMouseEnter={() => setTro(i)} onClick={() => chon(m.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 10px', cursor: 'pointer', background: i === tro ? 'var(--hover, rgba(255,255,255,.07))' : undefined, fontWeight: m.value === value ? 600 : 400 }}>
                  <span style={{ width: 12, color: 'var(--accent, #60a5fa)' }}>{m.value === value ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                  {m.dem != null ? <span style={{ fontSize: 11, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{m.dem}</span> : null}
                </div>
              </div>)) : <div style={{ fontSize: 12, color: 'var(--fg-2)', padding: '8px 10px' }}>Không có mục khớp</div>}
          </div>
        </div>
      </AnchoredPopover>
    </>
  );
}
