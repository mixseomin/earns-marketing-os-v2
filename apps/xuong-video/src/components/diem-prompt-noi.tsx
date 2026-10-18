'use client';
// Chip ĐIỂM PROMPT trên khối clip timeline (anh 17/10/2026: "trên timeline cũng show điểm của prompt") + thẻ nổi từng lỗi kèm mức trừ. Điểm đọc từ
// xv_canh.diem_prompt (diem-prompt.ts — ghi mỗi lượt cổng / dựng 3D); lỗi trừ ≥ 20 là lỗi CHẶN sinh (kiem-prompt.ts › NGUONG_CHAN).
import { useRef, useState } from 'react';
import { useViTriNoi } from './vi-tri-noi';
import { mauDiem } from '@/lib/xuong-video/diem-murch';
import type { DiemPrompt } from '@/lib/xuong-video/kieu';

const CHAN = 20;
export function ChipPrompt({ d, soShot, viTri: vt }: { d: DiemPrompt | null | undefined; soShot: number; viTri?: { left?: number; right?: number; top?: number; bottom?: number } | 'dong' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mo, setMo] = useState(false);
  const viTri = useViTriNoi(ref, mo, { rong: 380, caoToiDa: 440 });
  if (!d) return null;
  const chan = d.loi.filter((l) => l.phat >= CHAN).length;
  const mau = chan ? 'var(--red)' : mauDiem(d.diem);
  // Thân thẻ nổi (bấm chip = bấm khối clip → ngăn chi tiết SHOT, tap.tsx › xemShot).
  const than = (<>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Điểm prompt · shot #{soShot}</span>
          <b style={{ fontSize: 16, color: mau }}>{d.diem}<span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400 }}>/100</span></b>
        </div>
        <div className="xv-mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>keyframe <b style={{ color: mauDiem(d.diem_keyframe) }}>{d.diem_keyframe}</b> · video <b style={{ color: mauDiem(d.diem_video) }}>{d.diem_video}</b>{chan ? <> · <b style={{ color: 'var(--red)' }}>chặn sinh</b></> : null}</div>
        {d.loi.length ? (
          <div style={{ display: 'grid', gap: 5 }}>
            {d.loi.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 6, fontSize: 11.5 }}>
                <b className="xv-mono" style={{ color: l.phat >= CHAN ? 'var(--red)' : 'var(--amber)' }}>−{l.phat}</b>
                <span style={{ color: 'var(--fg-1)' }}>{l.chu}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ color: 'var(--fg-2)' }}>Sạch — mọi đường sinh (một bước, hai bước, khung kết, video).</div>}
        <div className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>chấm lúc {new Date(d.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · lỗi trừ ≥ {CHAN} chặn sinh ảnh / video</div>
  </>);
  return (<>
    <span ref={ref} className="xv-mono" onMouseEnter={() => setMo(true)} onMouseLeave={() => setMo(false)} title=""
      style={{ ...(vt === 'dong' ? { position: 'relative' as const, flexShrink: 0, whiteSpace: 'nowrap' as const } : { position: 'absolute' as const, ...(vt ?? { right: 4, top: 4 }) }), fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.72)', color: mau, cursor: 'help', fontWeight: 700, zIndex: 2 }}>
      P {d.diem}{chan ? ' ⛔' : ''}
    </span>
    {mo && (
      <div role="tooltip" style={{ ...viTri, pointerEvents: 'none', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: '10px 12px', display: 'grid', gap: 8, fontSize: 12, zIndex: 60, textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}>
        {than}
      </div>
    )}
  </>);
}
