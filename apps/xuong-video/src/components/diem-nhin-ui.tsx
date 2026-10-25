'use client';
// 👁 Dấu ĐIỂM NHÌN ở mỗi cú cắt trên timeline (diem-nhin.ts — eye trace, đo trên clip thật lúc xuất): mắt người xem phải dời bao nhiêu phần khung từ
// chủ thể cuối shot trước sang chủ thể đầu shot sau. Xanh = đạt · lam = lệch nhưng bản dựng đã dựng lại khung (phóng + dịch) cho đạt · đỏ = vẫn lệch ·
// xám = người dựng tắt khung dựng lại ở shot này. Bấm = tắt / bật khung dựng lại của shot SAU cú cắt.
import { NGUONG_LECH } from '@/lib/xuong-video/diem-nhin';
import type { KyThuatShot } from '@/lib/xuong-video/dien-anh';

export function DauDiemNhin({ trai, kt, tieuDe, onDoi }: { trai: number; kt?: KyThuatShot | null; tieuDe: string; onDoi?: (tat: boolean) => void }) {
  const dn = kt?.diem_nhin; const tat = !!kt?.khung_lai_tat;
  if (!dn || dn.lech_goc == null) return null;
  const goc = dn.lech_goc, sau = dn.lech_sau ?? goc; const pt = (x: number) => `${Math.round(x * 100)}%`;
  const [mau, chu] = tat ? ['var(--fg-4)', `lệch ${pt(goc)} · đang GIỮ khung gốc (đã tắt dựng lại)`]
    : goc <= NGUONG_LECH ? ['#4ade80', `lệch ${pt(goc)} — đạt (≤ ${pt(NGUONG_LECH)})`]
    : sau <= NGUONG_LECH ? ['var(--cyan)', `lệch ${pt(goc)} → ${pt(sau)} sau khi dựng lại khung (phóng ${kt?.khung_lai?.s ?? '?'}×)`]
    : ['var(--red, #ef4444)', `lệch ${pt(goc)} → còn ${pt(sau)} — phóng tối đa không đủ: sinh lại khung đầu shot sau với chủ thể ở đúng chỗ mắt đang nhìn`];
  return (
    <button type="button" data-goi-y={`👁 Điểm nhìn ${tieuDe}\n${chu}\n${dn.ten_dau ? `chủ thể mở shot: ${dn.ten_dau}\n` : ''}Bấm để ${tat ? 'bật' : 'tắt'} khung dựng lại của shot sau`}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDoi?.(!tat); }} disabled={!onDoi}
      style={{ position: 'absolute', left: trai, top: 1, transform: 'translateX(-50%)', zIndex: 5, padding: '0 3px', height: 14, borderRadius: 4, fontSize: 9, lineHeight: '14px',
        cursor: onDoi ? 'pointer' : 'default', background: 'rgba(10,10,12,.85)', color: mau, border: `1px solid ${mau}`, textDecoration: tat ? 'line-through' : 'none' }}>👁</button>
  );
}
