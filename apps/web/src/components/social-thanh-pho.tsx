'use client';
// Tab Social › 🏙 Thành phố (anh 22/10/2026): thành phố 3D dựng từ số thật của tab Social (mô hình: lib/social-thanh-pho.ts, cảnh: social-thanh-pho-canh.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SocialLive } from '@/lib/social-traffic';
import { tinhThanhPho } from '@/lib/social-thanh-pho';
import { dungThanhPho, napThree } from './social-thanh-pho-canh';

export function SocialThanhPho({ live }: { live: SocialLive }) {
  const mh = useMemo(() => tinhThanhPho(live), [live]);
  const ref = useRef<HTMLDivElement>(null);
  const [loi, setLoi] = useState('');
  useEffect(() => {
    let don: (() => void) | null = null, song = true;
    napThree().then((T) => { if (song && ref.current) don = dungThanhPho(ref.current, mh, T); }).catch((e: Error) => song && setLoi(e.message));
    return () => { song = false; don?.(); };
  }, [mh]);
  if (loi) return <div style={{ padding: 16, color: 'var(--bad)' }}>Không dựng được thành phố: {loi}</div>;
  return <div ref={ref} aria-label="Thành phố 3D social traffic" style={{ height: 'calc(100dvh - 210px)', minHeight: 460, borderRadius: 12, border: '1px solid var(--border)' }} />;
}
