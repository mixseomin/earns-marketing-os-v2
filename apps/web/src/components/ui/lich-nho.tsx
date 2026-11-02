'use client';
// LỊCH NHỎ DÙNG CHUNG (anh 02/11/2026: "component lịch đó để dùng cho nhiều nơi") — lịch tháng mini có SỐ ở góc ô + rê chuột ra chi tiết từng loại.
// Đưa vào danh sách ô { ngay, loai, so, chiTiet } + bảng loại { [loai]: { ten, mau, ic? } } → tự gộp theo ngày, tự lật tháng, chú thích dưới lịch.
// Dùng ở: Tài sản › Kênh nội dung (menu ⋯ — lịch làm tập / làm xong / hẹn đăng / đã đăng). Nền: ui/month-calendar MiniMonth (soTrenO).
import { useState } from 'react';
import { MiniMonth, type CalItem } from './month-calendar';

export type OLichNho = { ngay: string; loai: string; so: number; chiTiet?: string[] };
export type LoaiLichNho = Record<string, { ten: string; mau: string; ic?: string }>;

export function LichNho({ o, loai, chan, itemNoun = 'mục', rong = 236 }: {
  o: OLichNho[]; loai: LoaiLichNho;
  /** dòng chữ nhỏ dưới chú thích (vd "làm tập Thứ Hai · Thứ Tư · Thứ Sáu · 09:30") */ chan?: React.ReactNode;
  itemNoun?: string; rong?: number;
}) {
  const [thang, datThang] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDate = new Map<string, CalItem[]>(), soCua = new Map<string, number>();
  for (const x of o) { const l = loai[x.loai] ?? { ten: x.loai, mau: 'var(--accent)' }, id = `${x.ngay}-${x.loai}`;
    soCua.set(id, x.so);
    byDate.set(x.ngay, [...(byDate.get(x.ngay) ?? []), { id, date: x.ngay, label: `${l.ic ? `${l.ic} ` : ''}${x.so} ${l.ten}`, title: x.chiTiet?.join('\n'), color: l.mau }]); }
  return (
    <div style={{ width: rong, fontFamily: 'var(--font-sans)' }}>
      <MiniMonth month={thang} sel={new Set()} byDate={byDate} onPick={() => {}} onNavMonth={(d) => datThang((m) => new Date(m.getFullYear(), m.getMonth() + d, 1))}
        itemNoun={itemNoun} soTrenO={(it) => soCua.get(String(it.id)) ?? 0} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 4, fontSize: 10, color: 'var(--fg-3)' }}>
        {Object.entries(loai).map(([k, l]) => <span key={k} style={{ whiteSpace: 'nowrap' }}><span style={{ color: l.mau }}>●</span> {l.ic ? `${l.ic} ` : ''}{l.ten}</span>)}
      </div>
      {chan && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>{chan}</div>}
    </div>
  );
}
