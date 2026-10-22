'use client';
// Tab Social › 🏙 Thành phố (anh 22/10/2026): thành phố 3D dựng từ số thật (mô hình: lib/social-thanh-pho.ts, cảnh: social-thanh-pho-canh.ts).
// Số làm mới mỗi phút khi tab đang hiện (/api/social/thanh-pho) — dựng lại tại chỗ, giữ góc nhìn và bộ lọc.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SocialLive } from '@/lib/social-traffic';
import { tinhThanhPho, type PhoMoHinh } from '@/lib/social-thanh-pho';
import { dungThanhPho, napThree } from './social-thanh-pho-canh';

const LAM_MOI_MS = 60_000;

/** toanTrang = trang riêng city.on.tc: chiếm trọn khung nhìn, không viền */
export function SocialThanhPho({ live, toanTrang = false }: { live: SocialLive; toanTrang?: boolean }) {
  const mh0 = useMemo(() => tinhThanhPho(live), [live]);
  const ref = useRef<HTMLDivElement>(null);
  const [loi, setLoi] = useState('');
  const [luc, setLuc] = useState(live.luc);
  useEffect(() => {
    let canh: { don: () => void; capNhat: (mh: PhoMoHinh) => void } | null = null, song = true;
    napThree().then((T) => { if (song && ref.current) canh = dungThanhPho(ref.current, mh0, T); }).catch((e: Error) => song && setLoi(e.message));
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || !canh) return;
      fetch('/api/social/thanh-pho', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((x: { luc: string; mh: PhoMoHinh } | null) => { if (song && x && canh) { canh.capNhat(x.mh); setLuc(x.luc); } }).catch(() => { /* mạng chập chờn: giữ số cũ, lượt sau gọi lại */ });
    }, LAM_MOI_MS);
    return () => { song = false; clearInterval(id); canh?.don(); };
  }, [mh0]);
  if (loi) return <div style={{ padding: 16, color: 'var(--bad)' }}>Không dựng được thành phố: {loi}</div>;
  return <div style={{ position: 'relative' }}>
    <div ref={ref} aria-label="Thành phố 3D social traffic" style={toanTrang ? { height: '100dvh' } : { height: 'calc(100dvh - 210px)', minHeight: 460, borderRadius: 12, border: '1px solid var(--border)' }} />
    <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 10, zIndex: 8, fontSize: 10, color: '#8e9abd', background: '#111830cc', border: '1px solid #252f4e', borderRadius: 999, padding: '3px 9px', pointerEvents: 'none' }}>
      số lúc {new Date(Date.parse(luc) + 7 * 3600e3).toISOString().slice(11, 16)} · tự làm mới mỗi phút</span>
  </div>;
}
