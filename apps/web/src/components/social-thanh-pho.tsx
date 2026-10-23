'use client';
// Tab Social › 🏙 Thành phố (anh 22/10/2026): thành phố 3D dựng từ số thật (mô hình: lib/social-thanh-pho.ts, cảnh: social-thanh-pho-canh.ts).
// Số làm mới mỗi phút khi tab đang hiện (/api/social/thanh-pho) — dựng lại tại chỗ, giữ góc nhìn và bộ lọc.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SocialLive } from '@/lib/social-traffic';
import { tinhThanhPho, type PhoMoHinh } from '@/lib/social-thanh-pho';
import { dungThanhPho, napThree, type XuongEtp } from './social-thanh-pho-canh';

const LAM_MOI_MS = 60_000;

/** live = số thô (tab Social, tự tính mô hình) · mh + luc = mô hình dựng sẵn (city.on.tc, từ bản lưu) · toanTrang = chiếm trọn khung nhìn ·
 *  lamMoiNgay = mô hình là bản lưu → gọi số mới ngay khi dựng xong, không đợi một phút */
export function SocialThanhPho({ live, mh, luc: luc0, toanTrang = false, lamMoiNgay = false }: { live?: SocialLive; mh?: PhoMoHinh; luc?: string; toanTrang?: boolean; lamMoiNgay?: boolean }) {
  const mh0 = useMemo(() => mh ?? tinhThanhPho(live!), [mh, live]);
  const ref = useRef<HTMLDivElement>(null);
  const [loi, setLoi] = useState('');
  const [luc, setLuc] = useState(luc0 ?? live?.luc ?? '');
  useEffect(() => {
    let canh: { don: () => void; capNhat: (mh: PhoMoHinh) => void; capNhatXuong: (x: XuongEtp) => void } | null = null, song = true;
    napThree().then((T) => { if (song && ref.current) canh = dungThanhPho(ref.current, mh0, T); }).catch((e: Error) => song && setLoi(e.message));
    const lamMoi = () => {
      if (document.visibilityState !== 'visible' || !canh) return;
      fetch('/api/social/thanh-pho', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((x: { luc: string; mh: PhoMoHinh } | null) => { if (song && x && canh) { canh.capNhat(x.mh); setLuc(x.luc); } }).catch(() => { /* mạng chập chờn: giữ số cũ, lượt sau gọi lại */ });
    };
    const id = setInterval(lamMoi, LAM_MOI_MS);
    // XƯỞNG PHIM MỚI ETHOPEX: số sản xuất 5 giây/lần (anh 23/10/2026 "nhìn được realtime trên city") — đường nhẹ, không dựng lại cả cảnh
    const xuong = () => { if (document.visibilityState !== 'visible' || !canh) return; fetch('/api/social/thanh-pho/xuong', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((x: XuongEtp | null) => { if (song && x && canh) canh.capNhatXuong(x); }).catch(() => {}); };
    const idX = setInterval(xuong, 5_000); setTimeout(xuong, 1500);
    if (lamMoiNgay) { const cho = setInterval(() => { if (canh) { clearInterval(cho); lamMoi(); } }, 300); setTimeout(() => clearInterval(cho), 20_000); }
    return () => { song = false; clearInterval(id); clearInterval(idX); canh?.don(); };
  }, [mh0, lamMoiNgay]);
  if (loi) return <div style={{ padding: 16, color: 'var(--bad)' }}>Không dựng được thành phố: {loi}</div>;
  return <div style={{ position: 'relative' }}>
    <div ref={ref} aria-label="Thành phố 3D social traffic" style={toanTrang ? { height: '100dvh' } : { height: 'calc(100dvh - 210px)', minHeight: 460, borderRadius: 12, border: '1px solid var(--border)' }} />
    <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 10, zIndex: 8, fontSize: 10, color: '#8e9abd', background: '#111830cc', border: '1px solid #252f4e', borderRadius: 999, padding: '3px 9px', pointerEvents: 'none' }}>
      số lúc {new Date(Date.parse(luc) + 7 * 3600e3).toISOString().slice(11, 16)} · tự làm mới mỗi phút</span>
  </div>;
}
