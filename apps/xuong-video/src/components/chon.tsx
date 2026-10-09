'use client';

// Ô chọn kiểu select2 dùng chung cho mọi màn của studio (tách khỏi trang.tsx để timeline / bảng sinh dùng được, #1202).
import { useEffect, useRef, useState } from 'react';
import { useViTriNoi } from './vi-tri-noi';
import { mono } from './ui';


export type LuaChon = { value: string; label: string; nhom?: string; phu?: string; title?: string };
export function Chon({ value, onChange, options, multi, values, onValues, placeholder, minWidth = 180, title, nho }: {
  value?: string; onChange?: (v: string) => void; options: LuaChon[]; multi?: boolean; values?: string[]; onValues?: (v: string[]) => void;
  placeholder?: string; minWidth?: number; title?: string; nho?: boolean;
}) {
  const [mo, setMo] = useState(false);
  const [re, setRe] = useState<LuaChon | null>(null);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLSpanElement>(null);
  const viTri = useViTriNoi(ref, mo, { rong: Math.min(460, Math.max(minWidth, 300)) });
  useEffect(() => {
    if (!mo) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [mo]);
  const chon = multi ? options.filter((o) => values?.includes(o.value)) : options.filter((o) => o.value === value);
  const loc = options.filter((o) => !q || `${o.label} ${o.nhom ?? ''} ${o.phu ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const nhom = [...new Set(loc.map((o) => o.nhom ?? ''))];
  const nhan = chon.length ? (multi ? chon.map((o) => o.label).join(', ') : chon[0]!.label) : (placeholder ?? 'Chọn…');
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth: nho ? undefined : `min(${minWidth}px, 100%)`, maxWidth: '100%' }} title={title}>
      <button type="button" className="xv-in" onClick={() => setMo(!mo)} style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, overflow: 'hidden', padding: nho ? '3px 8px' : undefined, fontSize: nho ? 11 : undefined }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nhan}</span>
        {!multi && chon[0]?.phu && <span style={{ ...mono, color: 'var(--amber)', whiteSpace: 'nowrap' }}>{chon[0].phu}</span>}
        <span style={{ color: 'var(--fg-3)' }}>▾</span>
      </button>
      {mo && (
        <div style={{ ...viTri, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
          <input autoFocus className="xv-in" placeholder={`Tìm trong ${options.length}…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, borderBottom: '1px solid var(--line)', borderRadius: '8px 8px 0 0' }}
            onKeyDown={(e) => { if (e.key === 'Escape') setMo(false); if (e.key === 'Enter' && loc[0] && !multi) { onChange?.(loc[0].value); setMo(false); } }} />
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: 4 }}>
            {nhom.map((g) => (
              <div key={g}>
                {g && <div style={{ ...mono, padding: '6px 8px 2px', textTransform: 'uppercase' }}>{g}</div>}
                {loc.filter((o) => (o.nhom ?? '') === g).map((o) => {
                  const on = multi ? values?.includes(o.value) : o.value === value;
                  return (
                    <div key={o.value} title={o.title} onClick={() => { if (multi) { const v = values ?? []; onValues?.(on ? v.filter((x) => x !== o.value) : [...v, o.value]); } else { onChange?.(o.value); setMo(false); } }}
                      style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', borderRadius: 5, cursor: 'pointer', background: on ? 'var(--bg-2)' : undefined }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-2)'; setRe(o); }} onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'var(--bg-2)' : ''; }}>
                      {multi && <input type="checkbox" readOnly checked={!!on} />}
                      <span style={{ flex: 1, fontSize: 12, color: on ? 'var(--cyan)' : 'var(--fg-1)' }}>{o.label}</span>
                      {o.phu && <span style={{ ...mono, color: 'var(--amber)', whiteSpace: 'nowrap' }}>{o.phu}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            {loc.length === 0 && <div style={{ ...mono, padding: 8 }}>không có kết quả</div>}
          </div>
          {/* Rê vào lựa chọn → mô tả chi tiết hiện ngay ở chân danh sách (#1223), không phải chờ tooltip trình duyệt. */}
          {options.some((o) => o.title) && (
            <div style={{ borderTop: '1px solid var(--line)', padding: '6px 10px', fontSize: 11.5, color: 'var(--fg-2)', minHeight: 44, lineHeight: 1.4 }}>
              {(re ?? chon[0])?.title ? <><b style={{ color: 'var(--fg-1)' }}>{(re ?? chon[0])!.label}</b> — {(re ?? chon[0])!.title}</> : <span style={mono}>rê chuột vào một lựa chọn để xem mô tả</span>}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
