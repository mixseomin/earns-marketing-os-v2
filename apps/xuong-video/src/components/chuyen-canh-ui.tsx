'use client';
// Chuyển cảnh ngay trên làn 🎬 Hình, kiểu CapCut: nút nhỏ nằm đúng điểm nối hai clip → bấm ra lưới ô xem trước (ảnh thật của hai shot,
// rê chuột là ô chạy thử kiểu đó). Đã chọn thì nút sáng + một dải phủ đầu clip sau dài đúng d giây mà bản xuất hoà hai hình.
import { useEffect, useRef, useState } from 'react';
import { THU_VIEN, NHOM_CHUYEN_CANH, chuyenCanhGiua, type KyThuat } from '@/lib/xuong-video/dien-anh';
import { xemChuyenCanh } from '@/lib/xuong-video/lop';
import { useViTriNoi } from './vi-tri-noi';
import { mono } from './ui';

const KIEU = THU_VIEN.filter((x) => x.nhom === 'chuyen_canh' && x.xfade);
const CHU_KY_MS = 1100;

/** Một ô: hình A (shot trước) biến đi theo kiểu để lộ hình B (shot sau). Đứng yên ở giữa chừng; rê chuột thì chạy lặp. */
function OXem({ xfade, a, b, chay }: { xfade?: string; a?: string | null; b?: string | null; chay: boolean }) {
  const [p, setP] = useState(0.45);
  useEffect(() => {
    if (!chay || !xfade) { setP(0.45); return; }
    let id = 0; const t0 = performance.now();
    const buoc = (n: number) => { const q = ((n - t0) % CHU_KY_MS) / CHU_KY_MS; setP(Math.min(1, q * 1.4)); id = requestAnimationFrame(buoc); };
    id = requestAnimationFrame(buoc); return () => cancelAnimationFrame(id);
  }, [chay, xfade]);
  const nen = (u: string | null | undefined, mau: string) => (u ? `url(${u}) center / cover, ${mau}` : mau);
  const x = xfade ? xemChuyenCanh(xfade, p) : null;
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', borderRadius: 5, overflow: 'hidden', background: nen(b, '#1e3a5f') }}>
      {x ? <div style={{ position: 'absolute', inset: 0, background: nen(a, '#7c2d12'), ...x.cu }} />
        : <div style={{ position: 'absolute', inset: '0 50% 0 0', background: nen(a, '#7c2d12'), borderRight: '2px solid #fff' }} />}
      {x?.loe && <div style={{ position: 'absolute', inset: 0, background: x.loe.mau, opacity: x.loe.mo }} />}
    </div>
  );
}

/** Nút điểm nối + bảng chọn. `trai` = toạ độ px của điểm nối trên làn; `pps` để vẽ dải d giây. */
export function NutChuyenCanh({ trai, pps, value, phatTruoc, phatSau, anhTruoc, anhSau, tieuDe, onChon }: {
  trai: number; pps: number; value?: string; phatTruoc: number; phatSau: number; anhTruoc?: string | null; anhSau?: string | null; tieuDe: string;
  onChon?: (key: string) => void;
}) {
  const [mo, setMo] = useState(false);
  const [re, setRe] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bangRef = useRef<HTMLDivElement>(null);
  const viTri = useViTriNoi(ref, mo, { rong: 420, caoToiDa: 460 });
  useEffect(() => {
    if (!mo) return;
    const h = (e: MouseEvent) => { const n = e.target as Node; if (!ref.current?.contains(n) && !bangRef.current?.contains(n)) setMo(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [mo]);
  const that = chuyenCanhGiua(value, phatTruoc, phatSau);
  const chon = (key: string) => { onChon?.(key); setMo(false); };
  const o = (k: KyThuat | null) => {
    const key = k?.key ?? ''; const dang = (that?.kt.key ?? '') === key;
    return (
      <button key={key || 'cat'} type="button" title={k ? `${k.ten} — ${k.mo_ta} (${k.giay_cc ?? 0.4}s)` : 'Cắt thẳng, không hiệu ứng'}
        onMouseEnter={() => setRe(key)} onMouseLeave={() => setRe(null)} onClick={() => chon(key)}
        style={{ display: 'grid', gap: 3, padding: 3, borderRadius: 7, cursor: 'pointer', textAlign: 'left', background: 'transparent', color: 'var(--fg-1)',
          border: `2px solid ${dang ? 'var(--cyan)' : 'transparent'}` }}>
        <OXem xfade={k?.xfade} a={anhTruoc} b={anhSau} chay={re === key} />
        <span style={{ fontSize: 10.5, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k?.ten.replace(/ \(.+\)$/, '') ?? 'Cắt thẳng'}</span>
      </button>
    );
  };
  return (
    <>
      {/* Dải d giây đầu clip sau: chỗ bản xuất hoà hai hình (shot trước mượn đuôi, shot sau vẫn vào đúng giây). */}
      {that && <div title={`${that.kt.ten} · ${that.d}s`} style={{ position: 'absolute', left: trai, width: Math.max(4, that.d * pps), top: 2, bottom: 2, zIndex: 2, pointerEvents: 'none', borderRadius: 3,
        background: 'repeating-linear-gradient(135deg, rgba(34,211,238,.55) 0 4px, rgba(34,211,238,.15) 4px 8px)', borderLeft: '2px solid var(--cyan)' }} />}
      <div ref={ref} style={{ position: 'absolute', left: trai, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 4 }}>
        <button type="button" data-goi-y={`${tieuDe}\n${that ? `${that.kt.ten} · ${that.d}s` : 'Cắt thẳng'}\nBấm để chọn chuyển cảnh`}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setMo(!mo); }}
          style={{ width: 20, height: 20, padding: 0, borderRadius: 5, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 11, lineHeight: 1,
            background: that ? 'var(--cyan)' : 'rgba(10,10,12,.85)', color: that ? '#06222a' : 'var(--fg-2)',
            border: `1px solid ${that || mo ? 'var(--cyan)' : 'rgba(255,255,255,.35)'}`, boxShadow: '0 1px 4px rgba(0,0,0,.6)' }}>⇄</button>
      </div>
      {mo && (
        <div ref={bangRef} onClick={(e) => e.stopPropagation()}
          style={{ ...viTri, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,.5)', padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <b style={{ fontSize: 12, flex: 1 }}>{tieuDe}</b>
            <span style={mono}>rê lên ô để xem chạy thử</span>
          </div>
          {NHOM_CHUYEN_CANH.map((n) => {
            const ds = n.key === 'cat' ? [null] : KIEU.filter((k) => k.nhom_cc === n.key);
            if (!ds.length) return null;
            return (
              <div key={n.key} style={{ marginBottom: 6 }}>
                <div style={{ ...mono, textTransform: 'uppercase', padding: '2px 2px 3px' }}>{n.ten}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 2 }}>{ds.map(o)}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
