// SỔ LIỀN MẠCH (script supervisor's continuity log, anh 16/10/2026: "các phần theo dõi này phải show chi tiết trong drawer của nhân vật, của từng
// cảnh" · "film này để demo và học hỏi để sau này làm film thật, người thật"). Mỗi nhân vật × mỗi shot một dòng: ngày truyện, cảnh, chỗ mở → kết,
// dáng, hướng, trạng thái cơ thể (ướt / xù / bẩn / quần áo), đồ đang cầm, động tác — và lỗi đứt mạch. Lỗi lấy THẲNG từ cổng lienMachTap (một
// nguồn với cổng keyframe + dấu ⚠ trên lưới), sổ không tự tính lại luật. Thuần, không đọc DB.
import { canhCuaShot, khoiCua, lienMachTap } from './bo-set-3d';
import type { May3d, NhanVat, PhanCanh } from './kieu';

type ViTri = May3d['vi_tri'][number];
export type DongSo = {
  canhId: number; thu_tu: number; canh: string; ngay: string | null;
  /** shot mở một LUỒNG mới cho sổ (khác ngày truyện / cảnh khai thời gian nhảy / shot khai nhay) */ luong_moi: '' | 'ngay' | 'canh' | 'nhay';
  tam: number[]; den: number[] | null; huong: number | null; huong_den: number | null; nam: boolean; nam_den: boolean;
  trang: string; trang_den: string; cam: string | null; chia: number | null; dien: string[]; an: boolean;
  loi: string[];
};
export type SoLienMach = { nhanVat: Record<string, DongSo[]>; canh: { ten: string; ngay: string | null; lien_truoc: boolean; shot: number[] }[] };

type ShotSo = { id: number; thu_tu: number; canh: string; may_3d?: May3d | null };

/** ds: shot của MỘT nhánh dựng, theo thứ tự phát. */
export function soLienMach(ds: ShotSo[], phanCanh: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[] | undefined, nhanVat: Pick<NhanVat, 'ten' | 'khoi_3d'>[]): SoLienMach {
  const loiShot = lienMachTap(ds, (t) => khoiCua(t, nhanVat), phanCanh);
  const out: SoLienMach = { nhanVat: {}, canh: [] };
  let canhTruoc: string | undefined; let ngayTruoc: string | null = null;
  for (const c of ds) {
    const pc = canhCuaShot(c.canh, phanCanh);
    let luong: DongSo['luong_moi'] = '';
    const tenCanh = pc?.ten ?? c.canh;
    if (tenCanh !== canhTruoc) {
      const ngay: string | null = pc?.ngay?.trim() || ngayTruoc;
      if (canhTruoc !== undefined) luong = ngay !== ngayTruoc ? 'ngay' : pc?.lien_truoc === false ? 'canh' : '';
      out.canh.push({ ten: tenCanh, ngay: ngay ?? null, lien_truoc: pc?.lien_truoc !== false, shot: [] });
      canhTruoc = tenCanh; ngayTruoc = ngay ?? null;
    }
    out.canh[out.canh.length - 1]!.shot.push(c.thu_tu);
    const m = c.may_3d; if (!m) continue;
    if (!luong && m.nhay) luong = 'nhay';
    const loi = loiShot[c.id] ?? [];
    for (const v of m.vi_tri as (ViTri & Record<string, unknown>)[]) {
      (out.nhanVat[v.ten] ??= []).push({
        canhId: c.id, thu_tu: c.thu_tu, canh: tenCanh, ngay: ngayTruoc, luong_moi: luong,
        tam: v.tam, den: v.den ?? null, huong: v.huong ?? null, huong_den: v.huong_den ?? v.huong ?? null,
        nam: !!v.nam, nam_den: !!(v.nam_den ?? v.nam), trang: (v.trang ?? '').trim(), trang_den: (v.trang_den ?? v.trang ?? '').trim(),
        cam: v.cam ?? null, chia: v.chia ?? null, dien: v.dien ?? [], an: !!v.an,
        // lỗi của shot NÓI VỀ nhân vật này (câu cổng mở bằng tên, hoặc nhắc người cầm / món đang cầm)
        loi: loi.filter((x) => x.startsWith(`${v.ten} `) || x.includes(` ${v.ten} `) || x.includes(`${v.ten} (`)),
      });
    }
  }
  return out;
}

/** Chữ ngắn cho một ô sổ. */
export const chuCho = (p: number[] | null) => (p ? `(${p.map((x) => Math.round(x * 10) / 10).join(', ')})` : '');
export const chuDang = (d: Pick<DongSo, 'nam' | 'nam_den'>) => (d.nam === d.nam_den ? (d.nam ? 'nằm' : 'đứng') : d.nam ? 'nằm → đứng dậy' : 'đứng → ngã');
