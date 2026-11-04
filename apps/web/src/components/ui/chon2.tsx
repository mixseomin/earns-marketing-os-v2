'use client';
// Ô CHỌN KIỂU SELECT2 (anh 27/10/2026, etp.on.tc: "Gộp lại theo nhóm. Tất cả dùng select2"): nút gọn "Nhãn: giá trị ▾" → bảng nổi có ô tìm,
// lựa chọn gom theo NHÓM (tiêu đề nhóm), số đếm bên phải, dấu ✓ ở mục đang chọn; phím ↑ ↓ Enter Esc. Thay cho <select> trần và hàng chip dài —
// mọi bộ lọc dùng chung một kiểu. Bảng nổi = AnchoredPopover (portal ra body, không lệch trong Drawer).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnchoredPopover } from './anchored-popover';

export interface Chon2Muc { value: string; label: ReactNode; nhom?: string; dem?: number; title?: string; tim?: string; /** nhãn gọn trên nút (danh sách vẫn hiện label đủ) */ ngan?: string }

export function Chon2({ value, onChange, options, nhan, rong = 'Tất cả', title, minWidth, align = 'left', anRong, href, chan, nhieu, tatCa = '' }: {
  value: string; onChange: (v: string) => void; options: Chon2Muc[];
  /** chữ đứng trước giá trị trên nút: "Luật", "Loại"… */ nhan?: string;
  /** nhãn khi value = '' (mục "tất cả" tự thêm đầu danh sách) */ rong?: string;
  title?: string; minWidth?: number; align?: 'left' | 'right';
  /** true = không tự thêm mục '' (danh sách đã có đủ lựa chọn) */ anRong?: boolean;
  /** ô lọc này đang ẨN thứ người dùng đang tìm → viền đỏ + câu giải thích ở hover (etp 02/11/2026 "filter nào gây ra phải highlight") */ chan?: string;
  /** đường dẫn của từng lựa chọn → mục là link thật: ⌘ / Ctrl / ⇧ / chuột giữa mở TAB MỚI, bấm thường vẫn onChange (anh 31/10/2026 etp #1496) */ href?: (v: string) => string;
  /** CHỌN NHIỀU (anh 05/11/2026 etp Lọc camp): value = các giá trị nối bằng ',' · bấm mục = bật / tắt, bảng không đóng · nút Chọn hết / Bỏ hết · chọn mục tatCa hoặc bỏ hết = tất cả */ nhieu?: boolean;
  /** giá trị nghĩa là "tất cả" ở chế độ chọn nhiều (vd 'all') — mặc định '' */ tatCa?: string;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  const [q, setQ] = useState('');
  const [tro, setTro] = useState(0);
  const ds = useMemo(() => (anRong ? options : [{ value: '', label: rong } as Chon2Muc, ...options]), [options, rong, anRong]);
  const chu = (m: Chon2Muc) => (m.tim ?? (typeof m.label === 'string' ? m.label : m.value)).toLowerCase();
  const loc = useMemo(() => { const k = q.trim().toLowerCase(); return k ? ds.filter((m) => chu(m).includes(k) || (m.nhom ?? '').toLowerCase().includes(k)) : ds; }, [ds, q]);
  useEffect(() => { if (mo) { setQ(''); setTro(Math.max(0, ds.findIndex((m) => (nhieu ? m.value !== tatCa && value.split(',').includes(m.value) : m.value === value)))); } }, [mo]);   // eslint-disable-line react-hooks/exhaustive-deps
  const daChon = useMemo(() => new Set(nhieu && value !== tatCa ? value.split(',').filter(Boolean) : []), [nhieu, value, tatCa]);
  const coChon = (v: string) => (nhieu ? (v === tatCa ? daChon.size === 0 : daChon.has(v)) : v === value);
  const datNhieu = (ds2: Set<string>) => onChange(ds2.size ? options.filter((m) => m.value !== tatCa && ds2.has(m.value)).map((m) => m.value).join(',') : tatCa);   // giữ thứ tự danh sách
  const dang = nhieu ? (daChon.size === 1 ? ds.find((m) => daChon.has(m.value)) : daChon.size ? { value: '_', label: `${daChon.size} mục` } as Chon2Muc : ds.find((m) => m.value === tatCa)) : ds.find((m) => m.value === value);
  const nhanNhieu = nhieu && daChon.size > 1 ? options.filter((m) => daChon.has(m.value)).map((m) => m.ngan ?? (typeof m.label === 'string' ? m.label : m.value)).join(' + ') : null;
  const chon = (v: string) => { if (!nhieu) { onChange(v); setMo(false); return; } if (v === tatCa) { onChange(tatCa); return; } const n = new Set(daChon); if (n.has(v)) n.delete(v); else n.add(v); datNhieu(n); };
  const phim = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setTro((i) => Math.min(loc.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setTro((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const m = loc[tro]; if (m) chon(m.value); }
    else if (e.key === 'Escape') setMo(false);
  };
  // SÁNG KHI KHÁC "TẤT CẢ" (anh 28/10/2026 góp ý #1457): mọi ô — kể cả ô có mục tất cả riêng (anRong, vd Lọc 'all') — đang chọn mục không phải "Tất cả" thì viền + nền nhấn
  const coLoc = nhieu ? daChon.size > 0 : !!dang && dang.value !== '' && (dang.ngan ?? dang.label) !== rong;
  return (
    <>
      <button ref={ref} type="button" data-comp="ui.Chon2" title={chan ? `${chan}${title ? `\n${title}` : ''}` : title} onClick={() => setMo((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', minWidth, maxWidth: '100%', flex: 'none',
          border: `1px solid ${chan ? '#f87171' : coLoc ? 'var(--accent, #60a5fa)' : 'var(--line)'}`, background: chan ? 'rgba(248,113,113,.15)' : coLoc ? 'var(--accent-soft, rgba(59,130,246,.15))' : 'var(--bg-1, #111)', color: 'inherit', boxShadow: chan ? '0 0 0 2px rgba(248,113,113,.35)' : undefined }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{nhan ? <span style={{ color: 'var(--fg-2)' }}>{nhan}: </span> : null}{nhanNhieu ?? dang?.ngan ?? dang?.label ?? rong}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>▾</span>
      </button>
      <AnchoredPopover anchorRef={ref} open={mo} onClose={() => setMo(false)} align={align}>
        <div onKeyDown={phim} style={{ width: 260, maxWidth: '92vw', background: 'var(--bg-0, #0b0d12)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.5)', color: 'var(--fg-1)', overflow: 'hidden' }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>
            {/* KHÔNG tự focus ô tìm trên màn cảm ứng (anh 01/11/2026 etp #1502: mở ô chọn trên điện thoại là bật bàn phím che danh sách) — chỉ máy có chuột (pointer: fine) mới focus để gõ / ↑ ↓ ngay */}
            <input autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches} value={q} onChange={(e) => { setQ(e.target.value); setTro(0); }} placeholder="Tìm…"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit' }} />
            {nhieu ? <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {([['Chọn hết', () => datNhieu(new Set([...daChon, ...loc.filter((m) => m.value !== tatCa).map((m) => m.value)]))], ['Bỏ hết', () => onChange(tatCa)]] as const).map(([chu2, lam]) => (
                <button key={chu2} type="button" onClick={lam} style={{ flex: 1, fontSize: 11.5, padding: '3px 0', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit', cursor: 'pointer' }}>{chu2}{chu2 === 'Chọn hết' && q.trim() ? ' (đang tìm)' : ''}</button>))}
              <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{daChon.size ? `${daChon.size} đã chọn` : 'tất cả'}</span>
            </div> : null}
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto', padding: '4px 0' }}>
            {loc.length ? loc.map((m, i) => (
              <div key={m.value || '_'}>
                {m.nhom && m.nhom !== loc[i - 1]?.nhom ? <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-3, #777)', padding: '8px 10px 3px' }}>{m.nhom}</div> : null}
                <a role="option" aria-selected={coChon(m.value)} title={m.title} href={href?.(m.value)} onMouseEnter={() => setTro(i)}
                  onClick={(e) => { if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return; e.preventDefault(); chon(m.value); }}   // phím phụ = để trình duyệt mở tab mới
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 10px', cursor: 'pointer', color: 'inherit', textDecoration: 'none', background: i === tro ? 'var(--hover, rgba(255,255,255,.07))' : undefined, fontWeight: coChon(m.value) ? 600 : 400 }}>
                  <span style={{ width: 12, color: 'var(--accent, #60a5fa)' }}>{nhieu && m.value !== tatCa ? (coChon(m.value) ? '☑' : '☐') : coChon(m.value) ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
                  {m.dem != null ? <span style={{ fontSize: 11, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{m.dem}</span> : null}
                </a>
              </div>)) : <div style={{ fontSize: 12, color: 'var(--fg-2)', padding: '8px 10px' }}>Không có mục khớp</div>}
          </div>
        </div>
      </AnchoredPopover>
    </>
  );
}
