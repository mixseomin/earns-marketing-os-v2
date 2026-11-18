'use client';
// Ô CHỌN CÓ TÌM (kiểu Select2) dùng chung — góp ý #1669 "Select2 hết": bấm mở thấy hết, gõ thì lọc (không dấu), ↑↓ Enter Esc.
import { useEffect, useRef, useState } from 'react';

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function ChonTim({ value, onChange, options, tatCa, nhan }: {
  value: string; onChange: (v: string) => void; options: { v: string; t: string }[]; tatCa: string; nhan: string;
}) {
  const [mo, setMo] = useState(false); const [q, setQ] = useState(''); const [i, setI] = useState(0);
  const goc = useRef<HTMLSpanElement>(null);
  const ds = [{ v: '', t: tatCa }, ...options].filter((o) => !q || boDau(o.t).includes(boDau(q)));
  const hien = options.find((o) => o.v === value)?.t ?? tatCa;
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => { if (goc.current && !goc.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', ngoai); return () => document.removeEventListener('mousedown', ngoai);
  }, [mo]);
  const chon = (v: string) => { setMo(false); setQ(''); if (v !== value) onChange(v); };
  return (
    <span className="cty-chon-tim cty-chon2" ref={goc}>
      <button type="button" className="cty-chon2-nut" aria-label={nhan} aria-haspopup="listbox" aria-expanded={mo}
        onClick={() => { setMo((x) => !x); setQ(''); setI(0); }}>{hien}<span className="cty-chon2-mui">▾</span></button>
      {mo && <div className="cty-chon-tim-ds cty-chon2-hop">
        <input autoFocus value={q} placeholder="Gõ để tìm…" aria-label={`Tìm ${nhan}`} onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMo(false);
            else if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, ds.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (ds[i]) chon(ds[i].v); }
          }} />
        <ul role="listbox">{ds.length ? ds.map((o, k) => <li key={o.v || '_'} role="option" aria-selected={o.v === value}
          className={k === i ? 'dang' : ''} onMouseEnter={() => setI(k)} onMouseDown={(e) => { e.preventDefault(); chon(o.v); }}>{o.v === value ? '✓ ' : ''}{o.t}</li>)
          : <li className="cty-muted">Không khớp</li>}</ul>
      </div>}
    </span>
  );
}
