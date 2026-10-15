'use client';
// 🎯 Chọn kiểu CTA (thư viện CTA — cta.ts, mau/cta.json) ở panel shot ưu đãi / CTA / end card: mỗi kiểu kèm mẫu thắng nó học theo.
import { THU_VIEN_CTA, ctaTheoKey } from '@/lib/xuong-video/cta';

const mono = { fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--fg-3)' } as const;

export function ChonCta({ hienTai, onDoi }: { hienTai?: string; onDoi: (key: string) => void }) {
  const c = ctaTheoKey(hienTai);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ ...mono, letterSpacing: 0.5, marginTop: 6 }}>KIỂU CTA (thư viện)</div>
      <select className="xv-in" value={c?.key ?? ''} onChange={(e) => onDoi(e.target.value)}>
        {!c && <option value="">— chưa chọn —</option>}
        {THU_VIEN_CTA.map((x) => <option key={x.key} value={x.key}>{x.ten}</option>)}
      </select>
      {c && (
        <>
          <span style={{ alignSelf: 'start', justifySelf: 'start', background: c.kieu.nen, color: c.kieu.mau, padding: '1px 8px', borderRadius: 4, fontWeight: 800, fontSize: 12,
            WebkitTextStroke: c.kieu.nen ? undefined : `1px ${c.kieu.vien ?? '#000'}` }}>Buy 1 Get 1 Free</span>
          <span style={mono}>{c.mo_ta}</span>
          {c.nguon.map((n, i) => <span key={i} style={mono}>🏆 {n.ghi} · {n.link ? <a className="xv-lienket" href={`https://href.li/?${n.link}`} target="_blank" rel="noreferrer">“{n.trich}”</a> : `“${n.trich}”`}</span>)}
        </>
      )}
    </div>
  );
}
