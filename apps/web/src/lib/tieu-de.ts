'use client';
// Tiêu đề tab trình duyệt theo MÀN đang mở — mọi tab mos2 từng mang chung "MOS — Mission Orchestration System"
// nên 6 tab mở cạnh nhau không phân biệt được (anh chửi 20/09/2026). Nhiều tầng cùng đặt (AppShell: tab + dự án;
// trang: view/bộ lọc; ngăn kéo: bản ghi) → tầng CỤ THỂ nhất thắng theo `uuTien`, không phụ thuộc thứ tự effect
// (React chạy effect con trước cha — nếu ghi document.title trực tiếp thì cha luôn đè con).
import { useEffect } from 'react';

const HAU_TO = 'MOS';
const claims = new Map<number, string>();
function apDung() {
  let best: [number, string] | null = null;
  for (const e of claims) if (!best || e[0] > best[0]) best = e;
  document.title = best ? `${best[1]} · ${HAU_TO}` : HAU_TO;
}

/** parts rỗng/false bị bỏ; uuTien: 1 = khung (AppShell), 2 = trang/view, 3 = ngăn kéo/bản ghi đang mở. */
export function useTieuDe(parts: Array<string | null | undefined | false>, uuTien = 2): void {
  const t = parts.filter((p): p is string => !!p && p.trim() !== '').join(' · ');
  useEffect(() => {
    if (t) claims.set(uuTien, t); else claims.delete(uuTien);
    apDung();
    return () => { claims.delete(uuTien); apDung(); };
  }, [t, uuTien]);
}
