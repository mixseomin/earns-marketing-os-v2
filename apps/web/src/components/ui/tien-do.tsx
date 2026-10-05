// THANH TIẾN ĐỘ — một cách vẽ "đã xong a trên b" để NHÌN là thấy, không phải đọc chữ (anh chốt #1112, 05/10/2026: "đang làm 2/5"
// đọc chữ không hiểu). tong ≤ 12 → từng ô một bước (rê chuột từng ô thấy tên bước nếu có `buoc`); nhiều hơn → một thanh liền.
// Không hook, không 'use client' — server component lẫn client component đều gọi được.
import type { CSSProperties } from 'react';

export function TienDo({ xong, tong, buoc, mau = 'var(--accent)', rong = 64, so = true, style }: {
  xong: number; tong: number;
  /** Tên từng bước (độ dài = tong) — hiện ở tooltip từng ô và tooltip chung. */
  buoc?: string[];
  mau?: string; rong?: number;
  /** Kèm số "a/b" bên phải thanh. */
  so?: boolean; style?: CSSProperties;
}) {
  const n = Math.max(0, Math.min(xong, tong));
  const het = tong > 0 && n >= tong;
  const m = het ? 'var(--ok)' : mau;
  const title = buoc?.length ? buoc.map((b, i) => `${i < n ? '●' : '○'} ${b}`).join('\n') : `${n}/${tong}`;
  return (
    <span data-comp="ui.TienDo" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={tong} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle', ...style }}>
      {tong > 0 && tong <= 12
        ? <span style={{ display: 'inline-flex', gap: 2, width: rong }}>
            {Array.from({ length: tong }, (_, i) => (
              <span key={i} title={buoc?.[i]} style={{ flex: 1, height: 6, borderRadius: 2, background: i < n ? m : 'var(--bg-3)' }} />))}
          </span>
        : <span style={{ position: 'relative', width: rong, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', inset: 0, width: `${tong ? (n / tong) * 100 : 0}%`, background: m }} />
          </span>}
      {so && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: het ? 'var(--ok)' : 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{n}/{tong}</span>}
    </span>
  );
}
