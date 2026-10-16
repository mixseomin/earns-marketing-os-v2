'use client';
// Chip điểm Murch trên ô shot + thẻ nổi sáu tiêu chí (anh 15/10/2026: "bộ tính điểm dựa vào luật của Murch cho mỗi shot dựa vào cảnh trước, cảnh sau,
// cảnh hiện tại và toàn cảnh"). Số là ƯỚC LƯỢNG để so shot trong tập (diem-murch.ts), không phải điểm tuyệt đối — thẻ nói rõ.
import { useEffect, useRef, useState } from 'react';
import { useViTriNoi } from './vi-tri-noi';
import { TRONG_SO, TEN_TIEU_CHI, mauDiem, diemMurchTap, diemMurchCanh, type DiemMurch, type TieuChi } from '@/lib/xuong-video/diem-murch';
import { boSetCuaTap } from '@/lib/actions';
import type { BoSet, Canh, NhanVat, Tap } from '@/lib/xuong-video/kieu';

/** MỘT chỗ tính điểm Murch cho mọi nơi hiện chip (Lưới, Timeline) — cùng bộ set 3D, cùng cờ QC → cùng số ở mọi màn. */
export function useDiemMurch(canh: Canh[], nhanVat: NhanVat[], tap: Pick<Tap, 'id' | 'phan_canh'>, laQc?: boolean) {
  const [sets, setSets] = useState<Pick<BoSet, 'id' | 'du_lieu'>[]>([]);
  useEffect(() => { void boSetCuaTap(tap.id).then((r) => { if (r.ok) setSets(r.data); }); }, [tap.id]);
  const diemM = diemMurchTap(canh, nhanVat, sets, { phanCanh: tap.phan_canh ?? [], laQc });
  return { sets, diemM, tbM: diemMurchCanh(canh, diemM) };
}

export function ChipMurch({ d, canh, tap, soShot, viTri: vt }: { d: DiemMurch | undefined; canh: number | undefined; tap: number; soShot: number; /** chỗ đặt chip trong ô (mặc định góc phải trên) */ viTri?: { left?: number; right?: number; top?: number; bottom?: number } }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mo, setMo] = useState(false);
  const viTri = useViTriNoi(ref, mo, { rong: 340, caoToiDa: 420 });
  if (!d) return null;
  const mau = mauDiem(d.tong);
  return (<>
    <span ref={ref} className="xv-mono" onMouseEnter={() => setMo(true)} onMouseLeave={() => setMo(false)} title=""
      style={{ position: 'absolute', ...(vt ?? { right: 4, top: 4 }), fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.72)', color: mau, cursor: 'help', fontWeight: 700 }}>
      M {d.tong}
    </span>
    {mo && (
      <div role="tooltip" style={{ ...viTri, pointerEvents: 'none', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: '10px 12px', display: 'grid', gap: 8, fontSize: 12, zIndex: 60, textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Điểm Murch · shot #{soShot}</span>
          <b style={{ fontSize: 16, color: mau }}>{d.tong}<span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>/100</span></b>
        </div>
        <div className="xv-mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>cảnh này trung bình <b style={{ color: canh != null ? mauDiem(canh) : 'var(--fg-2)' }}>{canh ?? '—'}</b> · cả tập <b style={{ color: mauDiem(tap) }}>{tap}</b></div>
        <div style={{ display: 'grid', gap: 5 }}>
          {(Object.keys(TRONG_SO) as TieuChi[]).map((k) => {
            const v = d.phan[k]; const w = TRONG_SO[k]; const ly = d.ly_do[k];
            return (
              <div key={k} style={{ display: 'grid', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: 'var(--fg-1)' }}>{TEN_TIEU_CHI[k]} <span className="xv-mono" style={{ color: 'var(--fg-4)', fontSize: 10 }}>×{w}</span></span>
                  <b className="xv-mono" style={{ color: mauDiem(v * 100) }}>{Math.round(v * w)}<span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>/{w}</span></b>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-2)', overflow: 'hidden' }}><div style={{ width: `${Math.round(v * 100)}%`, height: '100%', background: mauDiem(v * 100) }} /></div>
                {ly && <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{ly}</div>}
              </div>
            );
          })}
        </div>
        <div className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-4)', borderTop: '1px dashed var(--line)', paddingTop: 5 }}>Rule of Six (Murch): ước lượng từ thẻ shot + 3D để so shot với nhau — cảm xúc thật chỉ người xem biết</div>
      </div>
    )}
  </>);
}
