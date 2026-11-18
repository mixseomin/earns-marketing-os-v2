'use client';
// BỘ LỌC BẢNG NHÂN SỰ (anh 17/11/2026: "Thêm bộ lọc, có thể bộ chia group theo từng phòng nếu muốn"): tìm tên · phòng · loại · trạng thái · chia nhóm theo phòng.
// Lựa chọn nằm trên URL (?q= &phong= &loai= &tt= &nhom=phong) → F5 / gửi link giữ nguyên; máy chủ lọc. Bảng tự làm mới mỗi 30 giây (trạng thái thật).
import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLamMoiKhi } from './lam-moi';
import { ChonTim } from './chon-tim';

export type LocNS = { q: string; phong: string; loai: string; tt: string; nhom: boolean };
export const LOAI_NS = { cli: 'Kỹ sư CLI', cong: 'Qua cổng AI', api: 'Gọi API', nguoi: 'Người thật' } as const;
export const TT_NS = { lam: 'Đang làm', ranh: 'Rảnh', ket: 'Kẹt', tat: 'Tắt' } as const;

export function LocNhanSu({ loc, phongs, so, tong }: { loc: LocNS; phongs: { id: string; ten: string }[]; so: number; tong: number }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams(); const [, chuyen] = useTransition();
  const [q, setQ] = useState(loc.q);
  useLamMoiKhi(true, 30_000);
  const dat = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString()); if (v) p.set(k, v); else p.delete(k);
    const s = p.toString(); chuyen(() => router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false }));
  };
  useEffect(() => { if (q === loc.q) return; const t = setTimeout(() => dat('q', q.trim()), 300); return () => clearTimeout(t); }, [q]);   // eslint-disable-line react-hooks/exhaustive-deps
  const coLoc = !!(loc.q || loc.phong || loc.loai || loc.tt);
  return (
    <div className="cty-loc-ns">
      <input type="search" placeholder="Tìm tên…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm tên" />
      {/* góp ý #1669 "Select2 hết": ô chọn có tìm thay select gốc */}
      <ChonTim value={loc.phong} onChange={(v) => dat('phong', v)} nhan="Lọc phòng" tatCa="Mọi phòng" options={phongs.map((p) => ({ v: p.id, t: p.ten }))} />
      <ChonTim value={loc.loai} onChange={(v) => dat('loai', v)} nhan="Lọc loại" tatCa="Mọi loại" options={Object.entries(LOAI_NS).map(([v, t]) => ({ v, t }))} />
      <ChonTim value={loc.tt} onChange={(v) => dat('tt', v)} nhan="Lọc trạng thái" tatCa="Mọi trạng thái" options={Object.entries(TT_NS).map(([v, t]) => ({ v, t }))} />
      <label className="cty-loc-nhom"><input type="checkbox" checked={loc.nhom} onChange={(e) => dat('nhom', e.target.checked ? 'phong' : '')} /> Chia nhóm theo phòng</label>
      <span className="cty-muted cty-nho">{so === tong ? `${tong} người` : `${so} / ${tong} người`}{coLoc && <> · <button type="button" className="cty-link-nut" onClick={() => { setQ(''); const p = new URLSearchParams(sp.toString()); ['q', 'phong', 'loai', 'tt'].forEach((k) => p.delete(k)); const s = p.toString(); chuyen(() => router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false })); }}>bỏ lọc</button></>}</span>
    </div>
  );
}
