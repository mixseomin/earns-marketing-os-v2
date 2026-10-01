'use client';
import { useEffect, useState } from 'react';

const hai = (n: number) => String(n).padStart(2, '0');
/** Đếm ngược tới một mốc CÓ THẬT (ngày hết đợt sale). Qua mốc thì ẩn. */
export function DemNguoc({ den, truoc = 'Clearance', giua = ' - Sale ends in ' }: { den: string; truoc?: string; giua?: string }) {
  const [con, setCon] = useState<number | null>(null);
  useEffect(() => {
    const t = Date.parse(den);
    const chay = () => setCon(Math.max(0, t - Date.now()));
    chay();
    const id = setInterval(chay, 1000);
    return () => clearInterval(id);
  }, [den]);
  if (con === null || con <= 0) return null;
  const s = Math.floor(con / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return <div className="dem-nguoc"><b>{truoc}</b>{giua}<b>{d ? `${d}d ` : ''}{hai(h)}h {hai(m)}m {hai(s % 60)}s</b></div>;
}
