'use client';
// Sơ đồ nối khung CẢ TẬP (12/10/2026): hàng trên = keyframe đang chọn của từng shot, hàng dưới = clip đang dùng.
//   dây thẳng  keyframe #n → clip #n  = khung đầu lúc sinh clip (đỏ: clip sinh từ keyframe khác keyframe đang chọn)
//   dây chéo   keyframe #n+1 → clip #n = khung cuối lúc sinh (nối khung; đỏ: keyframe shot sau đã đổi / bật-tắt nối khung)
// Chỗ "nối không liền" nhìn một lần là thấy, khỏi mở từng shot. Bấm một shot → mở sơ đồ nguồn của shot đó. Lõi chung nguonShot, 0đ.
import { useEffect, useState } from 'react';
import { nguonCuaTap } from '@/lib/actions';
import type { NguonShot } from '@/lib/xuong-video/phu-thuoc';
import { moNgan } from './ngan-chung';
import { mono } from './ui';

type TT = 'ok' | 'doi' | 'mo';
const MAU: Record<TT, string> = { ok: 'var(--lime)', doi: 'var(--red)', mo: 'var(--fg-3)' };

/** Trạng thái hai dây của một shot — dùng chung cho vẽ và cho dòng tóm tắt. */
function dayShot(s: NguonShot): { dau: TT | null; cuoi: TT | null; vi: string[] } {
  const v = s.video; const vi: string[] = [];
  if (!v) return { dau: null, cuoi: null, vi };
  const dau: TT = !v.khungDau ? 'mo' : v.khungDau !== s.keyframe_url ? 'doi' : 'ok';
  if (dau === 'doi') vi.push('clip sinh từ keyframe khác keyframe đang chọn');
  const coCuoi = !!(v.khungCuoi || s.khungCuoiNay);
  const cuoi: TT | null = !coCuoi ? null : (v.khungCuoi ?? null) === s.khungCuoiNay ? 'ok' : 'doi';
  if (cuoi === 'doi') vi.push(s.khungCuoiNay ? (v.khungCuoi ? 'keyframe shot sau đã đổi sau khi sinh clip' : 'sinh clip lúc chưa nối khung') : 'lúc sinh có khung cuối, giờ không còn');
  return { dau, cuoi, vi };
}

export function NoiKhungTap({ tapId }: { tapId: number }) {
  const [ds, setDs] = useState<NguonShot[] | null>(null);
  useEffect(() => { setDs(null); void nguonCuaTap(tapId).then(setDs); }, [tapId]);
  if (!ds) return <div style={mono}>đang đọc {''}các shot…</div>;
  if (!ds.length) return <div style={mono}>Tập chưa có shot.</div>;
  const ngang = ds[0]!.ti_le === '16:9';
  const TW = ngang ? 96 : 46, TH = ngang ? 54 : 82, G = 34, P = 14, Y_KF = 26, Y_CLIP = Y_KF + TH + 56;
  const x = (i: number) => P + i * (TW + G);
  const W = x(ds.length) - G + P, H = Y_CLIP + TH + 18;
  const day = ds.map(dayShot);
  const lech = ds.map((s, i) => ({ s, vi: day[i]!.vi })).filter((x) => x.vi.length);
  const anh = (url: string | null, tieuDe: string, la: 'anh' | 'clip') => url
    ? (la === 'clip'
      ? <video src={url} muted loop playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} style={{ width: TW, height: TH, objectFit: 'cover', borderRadius: 4, background: '#000', display: 'block' }} />
      : <img src={url} alt="" title={tieuDe} draggable={false} style={{ width: TW, height: TH, objectFit: 'cover', borderRadius: 4, display: 'block', background: '#000' }} />)
    : <div title={tieuDe} style={{ width: TW, height: TH, border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 9, color: 'var(--fg-3)' }}>{la === 'clip' ? 'chưa clip' : 'chưa ảnh'}</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12 }}>{ds.length} shot · {lech.length ? <span style={{ color: 'var(--red)' }}>{lech.length} chỗ nối lệch</span> : <span style={{ color: 'var(--lime)' }}>mọi chỗ nối khớp</span>}</b>
        <span style={{ flex: 1 }} />
        <span style={mono}>│ khung đầu · ╱ khung cuối (nối khung) · xanh khớp · đỏ đã đổi · bấm shot = mở nguồn</span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8, background: 'radial-gradient(circle, rgba(255,255,255,.07) 1px, transparent 1px) 0 0 / 16px 16px, var(--bg-0, #0b0b0d)' }}>
        <div style={{ position: 'relative', width: W, height: H }}>
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {ds.map((s, i) => {
              const d = day[i]!; const cx = x(i) + TW / 2;
              return <g key={s.id}>
                {d.dau && <line x1={cx} y1={Y_KF + TH} x2={cx} y2={Y_CLIP} stroke={MAU[d.dau]} strokeWidth={d.dau === 'doi' ? 2.5 : 1.6} strokeDasharray={d.dau === 'mo' ? '3 3' : undefined} />}
                {d.cuoi && i + 1 < ds.length && <path d={`M${x(i + 1) + 6},${Y_KF + TH} C${x(i + 1) + 6},${Y_KF + TH + 30} ${x(i) + TW - 6},${Y_CLIP - 30} ${x(i) + TW - 6},${Y_CLIP}`}
                  fill="none" stroke={MAU[d.cuoi]} strokeWidth={d.cuoi === 'doi' ? 2.5 : 1.6} />}
              </g>;
            })}
          </svg>
          {ds.map((s, i) => {
            const d = day[i]!; const loi = d.vi.length > 0;
            return (
              <div key={s.id} onClick={() => moNgan({ loai: 'nguon', canhId: s.id })} title={`#${s.thu_tu} ${s.canh}${loi ? `\n⚠ ${d.vi.join('\n⚠ ')}` : ''}\nBấm để mở sơ đồ nguồn của shot`}
                style={{ position: 'absolute', left: x(i) - 4, top: 4, width: TW + 8, height: H - 8, borderRadius: 6, cursor: 'pointer', outline: loi ? '1px solid var(--red)' : undefined }}>
                <div style={{ ...mono, textAlign: 'center', height: 18, lineHeight: '18px', color: loi ? 'var(--red)' : undefined }}>#{s.thu_tu}{loi ? ' ⚠' : ''}</div>
                <div style={{ position: 'absolute', left: 4, top: Y_KF - 4 }}>{anh(s.keyframe_url, `Keyframe #${s.thu_tu}`, 'anh')}</div>
                <div style={{ position: 'absolute', left: 4, top: Y_CLIP - 4 }}>{anh(s.video_url, `Clip #${s.thu_tu}`, 'clip')}</div>
              </div>
            );
          })}
        </div>
      </div>
      {lech.length > 0 && <div style={{ display: 'grid', gap: 2 }}>
        {lech.map(({ s, vi }) => <button key={s.id} type="button" className="xv-lienket" style={{ textAlign: 'left', fontSize: 11.5, color: 'var(--red)' }} onClick={() => moNgan({ loai: 'nguon', canhId: s.id })}>⚠ #{s.thu_tu} {s.canh}: {vi.join(' · ')}</button>)}
        <div style={mono}>Sửa: sinh lại clip của shot đó (☑ Sinh theo lựa chọn → Video nháp) để khung đầu/cuối khớp keyframe hiện tại.</div>
      </div>}
    </div>
  );
}
