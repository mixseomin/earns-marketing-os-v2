'use client';
// Nút của thanh lọc tự động trên DataTable (loc-tu-dong.ts): lọc CHỌN NHIỀU một cột danh mục · gom nhóm theo một cột.
// Nhãn nút chỉ ghi tên cột (số đang chọn hiện cạnh tên khi có lọc); số dòng của từng giá trị nằm trong danh sách mở ra.
import { useRef, useState, type CSSProperties } from 'react';
import { AnchoredPopover } from './anchored-popover';
import type { CotDanhMuc } from './loc-tu-dong';

export const nutThanh: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', whiteSpace: 'nowrap' };
const hop: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--line-2, var(--line))', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.5)', minWidth: 220, maxWidth: 360, display: 'flex', flexDirection: 'column' };
const dong: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)' };

function DanhSach({ ds, chon, nhieu, onChon, tim }: { ds: { v: string; n?: number; nhan?: string }[]; chon: string[]; nhieu: boolean; onChon: (v: string) => void; tim: boolean }) {
  const [q, setQ] = useState('');
  const loc = ds.filter((x) => !q || (x.nhan ?? x.v).toLowerCase().includes(q.toLowerCase()));
  return <>
    {tim && <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Tìm trong ${ds.length}…`}
      onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation(); if (e.key === 'Enter' && loc[0]) onChon(loc[0].v); }}
      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 8px', border: 0, borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-1)', outline: 'none' }} />}
    <div style={{ maxHeight: 300, overflowY: 'auto', padding: 4 }}>
      {loc.map((x) => { const on = chon.includes(x.v); return (
        <div key={x.v} role="option" aria-selected={on} onClick={() => onChon(x.v)} style={{ ...dong, background: on ? 'var(--bg-2)' : undefined, color: on ? 'var(--accent)' : 'var(--fg-1)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'var(--bg-2)' : ''; }}>
          {nhieu && <input type="checkbox" readOnly checked={on} style={{ margin: 0 }} />}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.nhan ?? x.v}</span>
          {x.n != null && <span style={{ color: 'var(--fg-3)', fontSize: 10.5 }}>{x.n}</span>}
        </div>); })}
      {!loc.length && <div style={{ ...dong, color: 'var(--fg-3)', cursor: 'default' }}>không có kết quả</div>}
    </div>
  </>;
}

/** Lọc chọn nhiều giá trị của một cột danh mục. */
export function LocChonNhieu({ cot, chon, onDoi }: { cot: CotDanhMuc; chon: string[]; onDoi: (ds: string[]) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mo, setMo] = useState(false);
  const co = chon.length > 0;
  return <>
    <button ref={ref} type="button" onClick={() => setMo(!mo)} title={co ? `${cot.nhan}: ${chon.join(', ')}` : `Lọc theo ${cot.nhan} (${cot.giaTri.length} giá trị)`}
      style={{ ...nutThanh, ...(co ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}) }}>
      {cot.nhan}{co ? `: ${chon.length === 1 ? chon[0] : chon.length}` : ''} ▾
    </button>
    {mo && <AnchoredPopover anchorRef={ref} open onClose={() => setMo(false)} zIndex={1100}>
      <div style={hop}>
        <DanhSach ds={cot.giaTri} chon={chon} nhieu tim={cot.giaTri.length > 8} onChon={(v) => onDoi(chon.includes(v) ? chon.filter((x) => x !== v) : [...chon, v])} />
        {co && <button type="button" onClick={() => { onDoi([]); setMo(false); }} style={{ ...nutThanh, border: 0, borderTop: '1px solid var(--line)', borderRadius: '0 0 8px 8px', background: 'transparent', color: 'var(--fg-3)' }}>✕ Bỏ lọc {cot.nhan}</button>}
      </div>
    </AnchoredPopover>}
  </>;
}

/** Gom dòng theo một cột danh mục (một lựa chọn; '' = không gom). */
export function ChonGomNhom({ ds, value, onDoi }: { ds: CotDanhMuc[]; value: string; onDoi: (k: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mo, setMo] = useState(false);
  const cur = ds.find((c) => c.key === value);
  return <>
    <button ref={ref} type="button" onClick={() => setMo(!mo)} title="Gom dòng theo một cột"
      style={{ ...nutThanh, ...(cur ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}) }}>
      ▤ {cur ? `Nhóm: ${cur.nhan}` : 'Nhóm theo'} ▾
    </button>
    {mo && <AnchoredPopover anchorRef={ref} open onClose={() => setMo(false)} zIndex={1100}>
      <div style={hop}>
        <DanhSach ds={[{ v: '', nhan: '— không gom —' }, ...ds.map((c) => ({ v: c.key, nhan: c.nhan, n: c.giaTri.length }))]} chon={[value]} nhieu={false} tim={false} onChon={(v) => { onDoi(v); setMo(false); }} />
      </div>
    </AnchoredPopover>}
  </>;
}
