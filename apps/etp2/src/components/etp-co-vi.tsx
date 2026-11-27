'use client';
// CỜ 🇻🇳 ĐẦU CÂU NGOẠI NGỮ (anh 27/11/2026, phiếu lên camp: "Các nội dung thêm icon cờ VN ở cuối. Hover vào thì sẽ hiện câu dịch").
// MỘT nguồn dịch cho cả etp2: dichChu (actions/etp-bai) → etp.dich (nhớ theo nguyên văn) → thiếu thì một lượt AI cổng chung (dòng Haiku).
// layDich gộp + nhớ lời hứa trong trang (thẻ creative etp-bai-qc.tsx dùng chung); CoVi = cờ + bong bóng InfoHint (rê là hiện, không native title).
import { useEffect, useState } from 'react';
import { dichChu } from '@/lib/actions/etp-bai';
import { InfoHint } from '@/components/ui';

const DICH = new Map<string, Promise<{ vi: Record<string, string> } | { loi: string }>>();
export const layDich = (ds: string[]) => {
  const k = [...ds].sort().join('\u0001'); let p = DICH.get(k);
  if (!p) { p = dichChu(ds); DICH.set(k, p); p.then((r) => { if ('loi' in r) DICH.delete(k); }, () => DICH.delete(k)); }
  return p;
};
// bản dịch y hệt chữ gốc (tên phim, tên riêng) = thừa, không hiện (anh #1778)
const chuanSo = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s\p{P}\p{S}]+/gu, '');
export const trungGoc = (g: string, v: string) => chuanSo(g) === chuanSo(v);

export type BanVi = { vi: Record<string, string>; loi: string | null; cho: boolean };
/** dịch một danh sách chữ (đổi danh sách → xin phần còn thiếu) */
export function useDichDs(ds: string[]): BanVi {
  const [vi, setVi] = useState<Record<string, string>>({}); const [loi, setLoi] = useState<string | null>(null); const [cho, setCho] = useState(false);
  const khoa = [...new Set(ds.filter((x) => x && x.trim()))].sort().join('\u0001');
  useEffect(() => {
    const xs = khoa ? khoa.split('\u0001') : []; const thieu = xs.filter((x) => !(x in vi));
    if (!thieu.length) return;
    let song = true; setCho(true); setLoi(null);
    layDich(thieu).then((r) => { if (!song) return; setCho(false); if ('loi' in r) setLoi(r.loi); else setVi((o) => ({ ...o, ...r.vi })); },
      (e) => { if (song) { setCho(false); setLoi(`không dịch được: ${String(e?.message ?? e)}`); } });
    return () => { song = false; };
  }, [khoa]); // eslint-disable-line react-hooks/exhaustive-deps
  return { vi, loi, cho };
}

/** cờ TREO lề trái (anh 27/11/2026 "chữ ở bên phải đường đỏ, cờ bên trái"): marginLeft -24 + 18 + 6 = chiếm 0 chỗ → chữ thẳng mép cột lựa chọn, cờ nằm trong lề;
 *  chỗ đặt cờ phải chừa ≥ 24px bên trái (cột nhãn Hang, columnGap chip). Gốc: cờ ĐẦU câu (anh 27/11/2026 "Cho cờ ở phía trước để ko ảnh hưởng đến bố cục"): ô cờ luôn giữ đúng một bề rộng cố định —
 *  đang dịch (cờ mờ) → dịch xong (cờ rê = câu dịch) → lỗi (⚠ đỏ) → không cần dịch (ô trống) đều không xô chữ; chữ các dòng thẳng một mép.
 *  Bong bóng mở sang PHẢI vì cờ đứng mép trái. */
const O: React.CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: 18, flex: 'none', marginLeft: -24, marginRight: 6, verticalAlign: 'middle', fontSize: 13, lineHeight: 1 };
export function CoVi({ goc, b }: { goc: string | null | undefined; b: BanVi }) {
  const v = goc && goc.trim() ? b.vi[goc] : undefined;
  if (goc && v && !trungGoc(goc, v)) return <span data-co-vi="co" onClick={(e) => e.stopPropagation()} style={O}>
    <InfoHint label="bản dịch tiếng Việt" icon={<span style={{ fontSize: 13, lineHeight: 1, cursor: 'help' }}>🇻🇳</span>}><span style={{ whiteSpace: 'normal', fontWeight: 400 }}>{v}</span></InfoHint></span>;
  if (goc && !v && b.loi) return <span data-co-vi="loi" title={b.loi} style={{ ...O, color: '#dc2626', fontSize: 11 }}>⚠</span>;
  if (goc && !v && b.cho) return <span data-co-vi="cho" title="đang dịch…" style={{ ...O, opacity: 0.35 }}>🇻🇳</span>;
  return <span data-co-vi="trong" aria-hidden style={O} />;
}
