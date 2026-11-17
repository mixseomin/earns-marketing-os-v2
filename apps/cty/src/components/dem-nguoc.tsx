'use client';
// ĐẾM NGƯỢC tới lần kiểm kế của một việc (anh 17/11/2026: "tao cần show count down đến lần check tiếp theo của chúng nó đấy").
// tiep = giờ chạy kế bộ điều phối Mac đẩy kèm dòng nhật ký nhịp; tu = lần đang chạy mở lúc nào. Đếm từng giây ở trình duyệt.
// Quá giờ kế > 2 phút mà chưa thấy "▶ bắt đầu" mới → đỏ "trễ X phút" (bộ điều phối / máy kẹt).
import { useEffect, useState } from 'react';

const TRE_GIAY = 120;
const gioVN = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(11, 19);
const mmss = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), g = s % 60; return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(g).padStart(2, '0')}`; };

export function DemNguoc({ tiep, tu }: { tiep?: string; tu?: string }) {
  const [bay, setBay] = useState<number | null>(null);
  useEffect(() => { setBay(Date.now()); const t = setInterval(() => setBay(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (bay === null) return <span className="cty-nho cty-muted">…</span>;
  if (tu) { const p = Math.max(0, Math.floor((bay - Date.parse(tu)) / 60000)); return <span className="cty-nho cty-tt-lam" title={`Lần này mở lúc ${gioVN(Date.parse(tu))} (giờ VN)`}>đang chạy · {p} phút</span>; }
  if (!tiep) return <span />;
  const t = Date.parse(tiep), con = Math.round((t - bay) / 1000), title = `Lần kiểm kế: ${gioVN(t)} (giờ VN)`;
  if (con > 0) return <span className="cty-nho" title={title}>kiểm lại sau {mmss(con)}</span>;
  if (-con > TRE_GIAY) return <span className="cty-nho cty-thu-loi" title={`${title} — quá giờ mà chưa thấy lượt mới bắt đầu: bộ điều phối hoặc máy có thể đang kẹt`}>trễ {Math.floor(-con / 60)} phút</span>;
  return <span className="cty-nho cty-muted" title={title}>sắp chạy</span>;
}
