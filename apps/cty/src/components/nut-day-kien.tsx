'use client';
// Ba nút dạy Kiên trên một dòng thư (cùng ba nút dưới tin Telegram). Nhóm đang chọn tô đậm; lỗi hiện ngay dưới nút.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dayKien } from '@/lib/day-kien';

const NHOM: [string, string][] = [['nha', '🏠 Nhà mình'], ['quen', '✅ Thật, quen'], ['gia', '⛔ Giả']];
export function NutDayKien({ mien, dang }: { mien: string; dang?: string }) {
  const router = useRouter(); const [cho, chuyen] = useTransition(); const [loi, setLoi] = useState<string | null>(null);
  if (!mien) return null;
  return (
    <span className="cty-day-kien">
      {NHOM.map(([k, t]) => <button key={k} type="button" className={`cty-btn cty-nho${dang === k ? ' cty-day-dang' : ''}`} disabled={cho}
        title={`Dạy Kiên: ${mien} = ${t}`} onClick={() => chuyen(async () => { setLoi(null); const r = await dayKien(k, mien); if (!r.ok) setLoi(r.loi ?? 'Máy chủ từ chối.'); router.refresh(); })}>{t}</button>)}
      {loi && <span className="cty-bao-loi" data-loi>{loi}</span>}
    </span>
  );
}
