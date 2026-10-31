// CÂY BỘ BỐI CẢNH: nhóm anchor theo cha–con (thuoc_id — cấu kiện / đồ vật lồng dưới đạo cụ, bối cảnh). Một nguồn cho mọi cây hiện anchor:
// cây trong mục Thiết kế sản xuất (nhan-vat.tsx) và cây cả phim ở tab 📖 Phim (cay-phim.tsx).
import type { NhanVat } from './kieu';

/** `ds` = các anchor cần hiện (đã lọc); cha tra trong `tatCa` → con có cha bị lọc ra vẫn hiện dưới đầu nhóm là cha của nó. */
export function nhomCayAnchor(ds: NhanVat[], tatCa: NhanVat[] = ds): { cha: NhanVat; con: NhanVat[] }[] {
  const out: { cha: NhanVat; con: NhanVat[] }[] = []; const idx = new Map<number, number>();
  for (const v of ds) {
    const cha = v.thuoc_id ? tatCa.find((p) => p.id === v.thuoc_id) ?? null : null;
    if (cha) { let i = idx.get(cha.id); if (i == null) { i = out.length; idx.set(cha.id, i); out.push({ cha, con: [] }); } out[i]!.con.push(v); }
    else if (!idx.has(v.id)) { idx.set(v.id, out.length); out.push({ cha: v, con: [] }); }
  }
  return out;
}
