'use client';
// LỊCH NHỎ DÙNG CHUNG (anh 02/11/2026: "component lịch đó để dùng cho nhiều nơi") — lịch tháng mini có SỐ ở góc ô + rê chuột ra chi tiết từng loại.
// Đưa vào danh sách ô { ngay, loai, so, chiTiet } + bảng loại { [loai]: { ten, mau, ic? } } → tự gộp theo ngày, tự lật tháng, chú thích dưới lịch.
// Dùng ở: Tài sản › Kênh nội dung (menu ⋯ — lịch làm tập / làm xong / hẹn đăng / đã đăng). Nền: ui/month-calendar MiniMonth (soTrenO).
import { useState } from 'react';
import { MiniMonth, type CalItem } from './month-calendar';
import { extLinkProps } from '@/lib/external-url';

/** muc = từng việc của ô (chữ + link mở ra xem, vd bài trên nền) — có thì bấm ngày hiện danh sách bấm được dưới lịch (anh 02/11/2026 #1511). */
export type OLichNho = { ngay: string; loai: string; so: number; chiTiet?: string[]; muc?: { chu: string; url?: string | null }[] };
export type LoaiLichNho = Record<string, { ten: string; mau: string; ic?: string }>;

export function LichNho({ o, loai, chan, itemNoun = 'mục', rong = 236 }: {
  o: OLichNho[]; loai: LoaiLichNho;
  /** dòng chữ nhỏ dưới chú thích (vd "làm tập Thứ Hai · Thứ Tư · Thứ Sáu · 09:30") */ chan?: React.ReactNode;
  itemNoun?: string; rong?: number;
}) {
  const [thang, datThang] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [chon, datChon] = useState<string | null>(null);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cuaNgay = chon ? o.filter((x) => x.ngay === chon && x.muc?.length) : [];
  const byDate = new Map<string, CalItem[]>(), soCua = new Map<string, number>();
  for (const x of o) { const l = loai[x.loai] ?? { ten: x.loai, mau: 'var(--accent)' }, id = `${x.ngay}-${x.loai}`;
    soCua.set(id, x.so);
    byDate.set(x.ngay, [...(byDate.get(x.ngay) ?? []), { id, date: x.ngay, label: `${l.ic ? `${l.ic} ` : ''}${x.so} ${l.ten}`, title: x.chiTiet?.join('\n'), color: l.mau }]); }
  return (
    <div style={{ width: rong, fontFamily: 'var(--font-sans)' }}>
      <MiniMonth month={thang} sel={new Set(chon ? [chon] : [])} byDate={byDate} onPick={(d) => datChon((c) => (c === ymd(d) ? null : ymd(d)))} onNavMonth={(d) => datThang((m) => new Date(m.getFullYear(), m.getMonth() + d, 1))}
        itemNoun={itemNoun} soTrenO={(it) => soCua.get(String(it.id)) ?? 0} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 4, fontSize: 10, color: 'var(--fg-3)' }}>
        {Object.entries(loai).map(([k, l]) => <span key={k} style={{ whiteSpace: 'nowrap' }}><span style={{ color: l.mau }}>●</span> {l.ic ? `${l.ic} ` : ''}{l.ten}</span>)}
      </div>
      {cuaNgay.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--line)', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
          {cuaNgay.flatMap((x) => (x.muc ?? []).map((m, i) => { const l = loai[x.loai]; return (
            <div key={`${x.loai}-${i}`} title={m.chu} style={{ display: 'flex', gap: 4, alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ color: l?.mau, flex: 'none' }}>{l?.ic ?? '●'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, color: 'var(--fg-2)' }}>{m.chu}</span>
              {m.url && <a {...extLinkProps(m.url)} style={{ flex: 'none', color: 'var(--accent)' }} title="mở bài trên nền">↗</a>}
            </div>); }))}
        </div>
      )}
      {chan && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>{chan}</div>}
    </div>
  );
}
