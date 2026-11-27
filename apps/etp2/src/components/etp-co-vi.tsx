'use client';
// RÊ CHỮ NGOẠI NGỮ = CÂU DỊCH (anh 27/11/2026, phiếu lên camp: "Các nội dung thêm icon cờ VN ở cuối. Hover vào thì sẽ hiện câu dịch").
// MỘT nguồn dịch cho cả etp2: dichChu (actions/etp-bai) → etp.dich (nhớ theo nguyên văn) → thiếu thì một lượt AI cổng chung (dòng Haiku).
// layDich gộp + nhớ lời hứa trong trang (thẻ creative etp-bai-qc.tsx dùng chung); ChuVi = rê vào chữ hiện bong bóng câu dịch (không cờ, không native title).
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

/** RÊ VÀO CHỮ = HIỆN CÂU DỊCH (anh 27/11/2026 "bỏ cờ đi, hover vào chữ thì hiện phần dịch tiếng Việt là xong"): không thêm ký hiệu nào cạnh chữ →
 *  chữ giữ nguyên chỗ, các lựa chọn thẳng cột. Bong bóng dùng chung lớp .info-hint / .info-hint__pop (CSS thuần, không native title).
 *  Đang dịch / câu không cần dịch → chữ trần; lỗi dịch → title nói lỗi. */
// them = khối hiện THÊM dưới câu dịch trong cùng bong bóng (phiếu lên camp: mẫu chữ đội đang thắng — anh 27/11/2026); có them thì bong bóng hiện cả khi câu không cần dịch
export function ChuVi({ goc, b, them }: { goc: string; b: BanVi; them?: React.ReactNode }) {
  const v0 = goc.trim() ? b.vi[goc] : undefined, v = v0 && !trungGoc(goc, v0) ? v0 : undefined;
  if (v || them) return <span data-chu-vi={v ? 'co' : 'them'} className="info-hint" tabIndex={0} role="note" aria-label={v ? `tiếng Việt: ${v}` : undefined}
    style={{ display: 'inline', color: 'inherit', cursor: 'help', verticalAlign: 'baseline' }}>{goc}<span className="info-hint__pop" style={{ fontWeight: 400, ...(them ? { maxWidth: 480 } : {}) }}>
      {v ? <>🇻🇳 {v}</> : null}{them ? <div style={{ marginTop: v ? 6 : 0, paddingTop: v ? 6 : 0, borderTop: v ? '1px solid var(--line-2)' : undefined }}>{them}</div> : null}</span></span>;
  const v1 = v0;
  return <span data-chu-vi={b.loi && !v1 ? 'loi' : b.cho && !v1 ? 'cho' : 'tran'} title={b.loi && !v1 ? `không dịch được: ${b.loi}` : undefined}>{goc}</span>;
}
