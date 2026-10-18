'use client';
// STORYBOARD ĐẦU → KẾT (anh 18/10/2026: "khi sinh bản 3D có đầu và kết thì nhìn sẽ rõ ràng từng shot hơn"): khung màu Blender ở chỗ MỞ và chỗ KẾT của
// shot đặt cạnh nhau — người đi đâu, máy đẩy tới đâu, nét mặt đổi thế nào thấy ngay không cần mở bộ xem. Dùng chung cho lưới kịch bản + thẻ shot.
// Từ BAN_DUNG 82 mọi shot có khung kết; khung dựng trước đó chỉ có khung mở thì hiện một ảnh. Bấm = mở bộ xem 3D đúng máy shot.
import type { ReactNode } from 'react';
import type { KhungXam } from '@/lib/xuong-video/kieu';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { mono } from './ui';

const nhan = (chu: string, title: string) => (
  <span title={title} style={{ ...mono, position: 'absolute', left: 3, top: 3, fontSize: 8.5, lineHeight: 1, padding: '2px 4px', borderRadius: 3, background: 'rgba(0,0,0,.65)', color: '#e5e7eb', letterSpacing: '.04em' }}>{chu}</span>
);

/** true = có ảnh dựng để hiện (khung mở); người gọi dùng ô vẽ sống khi false. */
export const coKhungDung = (kx: KhungXam | null | undefined): boolean => !!(kx?.mau || kx?.xam);

export function KhungDauKet({ kx, doc, onMo, children, rong = 320 }: { kx: KhungXam; doc: boolean; onMo: () => void; children?: ReactNode; rong?: 160 | 320 | 640 }) {
  const dau = kx.mau || kx.xam; const ket = kx.mau_ket;
  // khung dọc: hai ảnh 9:16 cạnh nhau (ô 18:16); khung ngang: chồng trên dưới (ô 16:18)
  const o = ket ? (doc ? '18 / 16' : '16 / 18') : (doc ? '9 / 16' : '16 / 9');
  const anh = (url: string, chu: string, title: string) => (
    <div style={{ position: 'relative', minWidth: 0, minHeight: 0, background: `center / cover no-repeat url(${anhNho(url, rong)}), #000` }}>{nhan(chu, title)}</div>
  );
  return (
    <div role="button" tabIndex={0} title="Khung 3D đầu → kết của shot (Blender) — bấm mở bộ xem đúng máy shot" onClick={(e) => { e.stopPropagation(); onMo(); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onMo(); } }}
      style={{ position: 'relative', aspectRatio: o, cursor: 'pointer', display: 'grid', gap: 1, background: 'var(--line)', gridTemplateColumns: ket && doc ? '1fr 1fr' : '1fr', gridTemplateRows: ket && !doc ? '1fr 1fr' : '1fr' }}>
      {anh(dau, ket ? 'ĐẦU' : '3D', 'Khung mở của shot')}
      {ket && anh(ket, kx.ket_dong === false ? 'KẾT · tĩnh' : 'KẾT', kx.ket_dong === false ? 'Khung kết — shot không đổi khung nhiều (không ai đi, máy không đi cú liền mạch): chỉ để xem, không cần keyframe kết' : 'Khung kết — shot đổi khung trong clip: video cần keyframe kết')}
      {children}
    </div>
  );
}
