// SỔ LIỀN MẠCH (script supervisor's continuity log, anh 16/10/2026: "các phần theo dõi này phải show chi tiết trong drawer của nhân vật, của từng
// cảnh" · "film này để demo và học hỏi để sau này làm film thật, người thật"). Mỗi nhân vật × mỗi shot một dòng: ngày truyện, cảnh, chỗ mở → kết,
// dáng, hướng, trạng thái cơ thể (ướt / xù / bẩn / quần áo), đồ đang cầm, động tác — và lỗi đứt mạch. Lỗi lấy THẲNG từ cổng lienMachTap (một
// nguồn với cổng keyframe + dấu ⚠ trên lưới), sổ không tự tính lại luật. Thuần, không đọc DB.
import { boSetCuaShot, canhCuaShot, khoiCua, lienMachTap, luongShot, ngoaiKet, ngoaiMo, noiHookup, SO_NGUOI, thieuDongTac, thieuKhaiNguoi, type KhoaNguoi } from './bo-set-3d';
import type { May3d, NhanVat, PhanCanh } from './kieu';
import { coKhongGian, dang, doCam, kgCua, loiMachTap2d, nguoiKhung, type KhongGianTap, type ShotKg } from './khong-gian';

type ViTri = May3d['vi_tri'][number];
export type DongSo = {
  canhId: number; thu_tu: number; canh: string; ngay: string | null;
  /** shot mở một LUỒNG mới cho sổ (khác ngày truyện / cảnh khai thời gian nhảy / shot khai nhay) */ luong_moi: '' | 'ngay' | 'canh' | 'nhay';
  /** chỗ / dáng / trạng thái mở NỐI từ kết shot số này (hookup — noiHookup); null = shot tự khai (đầu luồng / nhay / đang được cầm) */ noi: number | null;
  tam: number[]; den: number[] | null; huong: number | null; huong_den: number | null; nam: boolean; nam_den: boolean;
  trang: string; trang_den: string;
  /** BỀ NGOÀI (SO_NGUOI trừ trạng thái): trang phục, tóc, trang điểm, đồ trên người, vết — chỉ thuộc tính đã khai / đã nối */ ngoai: { k: KhoaNguoi; ten: string; mo: string; ket: string }[];
  cam: string | null; chia: number | null; dien: string[]; an: boolean;
  loi: string[];
  /** ĐIỂM LIỀN MẠCH 0–100 của nhân vật ở shot này (chamLoi) + từng lỗi đã xếp mức */ diem: number; muc: { muc: MucLoi; chu: string; tru: number }[];
};
/** MỨC LỖI (cách script supervisor / IMDb goofs xếp): chặn = phá logic truyện hoặc vật lý (vị trí nhảy, dáng nhảy, nằm mà đi, vật tự lành, đồ cầm
 *  biến mất, trạng thái tự hết) · nặng = dễ thấy (quay ngoắt hướng) · thiếu = mô tả có động tác mà 3D chưa khai · nhẹ = phần còn lại. */
export type MucLoi = 'chan' | 'nang' | 'thieu' | 'nhe' | 'ghi';
/** ghi = ghi chú khai lệch đã được hookup nối lại (máy dựng đúng) — không trừ điểm, không tính đứt mạch */
export const TRU_MUC: Record<MucLoi, number> = { chan: 40, nang: 20, thieu: 15, nhe: 8, ghi: 0 };
export const mucLoi = (s: string): MucLoi => /^nối: /.test(s) ? 'ghi' : /thiếu động tác|thiếu khai/.test(s) ? 'thieu' : /đứt mạch|NẰM|ĐỨNG|đã chia|đang cầm|trạng thái/.test(s) ? 'chan' : /quay ngoắt/.test(s) ? 'nang' : 'nhe';
/** Độ dễ thấy: ngoài khung ×0,4; trong khung theo % khung nhân vật chiếm (0,6 → 1,0 khi ≥ 40 %); không có số đo → 1. */
export const doDeThay = (an: boolean, pt: number | null) => (an ? 0.4 : pt == null ? 1 : 0.6 + Math.min(pt, 40) / 100);
export function chamLoi(loi: string[], an: boolean, pt: number | null): { diem: number; muc: DongSo['muc'] } {
  const f = doDeThay(an, pt);
  const muc = loi.map((chu) => { const m = mucLoi(chu); return { muc: m, chu, tru: Math.round(TRU_MUC[m] * (m === 'chan' ? 1 : f)) }; })   // lỗi chặn trừ đủ dù khó thấy
    .sort((a, b) => b.tru - a.tru);
  return { diem: Math.max(0, 100 - muc.reduce((a, x) => a + x.tru, 0)), muc };
}
export type SoLienMach = { nhanVat: Record<string, DongSo[]>; canh: { ten: string; ngay: string | null; lien_truoc: boolean; shot: number[] }[] };

type ShotSo = { id: number; thu_tu: number; canh: string; nhan_vat?: number[]; may_3d?: May3d | null; hanh_dong?: string; khung_xam?: { thay?: { ten: string; pt: number }[] } | null; phan_doan?: string; ky_thuat?: ShotKg['ky_thuat'] };

/** ds: shot của MỘT nhánh dựng, theo thứ tự phát. */
export function soLienMach(ds: ShotSo[], phanCanh: Pick<PhanCanh, 'ten' | 'ngay' | 'lien_truoc'>[] | undefined, nhanVat: (Pick<NhanVat, 'ten' | 'khoi_3d'> & Partial<Pick<NhanVat, 'id' | 'loai' | 'bo_set_id'>>)[], /** sơ đồ 2D theo cảnh — shot không 3D ghi sổ từ sơ đồ + sổ dáng + sổ đồ vật (khong-gian.ts) */ kgt?: KhongGianTap | null): SoLienMach {
  // Theo TỪNG BỘ SET như Blender dựng (bo-set-3d-may.ts › mayDayDu theo set): hookup + cổng không nối chỗ đứng qua hai không gian khác nhau.
  const nhom = new Map<number, ShotSo[]>();
  for (const c of ds) { const k = c.nhan_vat ? (boSetCuaShot({ nhan_vat: c.nhan_vat }, nhanVat as Parameters<typeof boSetCuaShot>[1]) ?? -1) : -1; nhom.set(k, [...(nhom.get(k) ?? []), c]); }
  const loiShot: Record<number, string[]> = {}; const daNoi = new Map<number, May3d>();
  for (const g of nhom.values()) {
    Object.assign(loiShot, lienMachTap(g, (t) => khoiCua(t, nhanVat), phanCanh));
    const hk = noiHookup(g, phanCanh); for (const [k, m] of hk.may) daNoi.set(k, m);
    for (const [k, v] of Object.entries(hk.lech)) (loiShot[Number(k)] ??= []).push(...v);   // ghi chú khai lệch: chỉ sổ hiện, cổng không chặn
    for (const [k, v] of Object.entries(thieuKhaiNguoi(g, phanCanh))) (loiShot[Number(k)] ??= []).push(...v);   // thiếu khai bề ngoài của ngày
  }
  const luongCua = luongShot(ds, phanCanh); const loi2d = loiMachTap2d(kgt, ds as unknown as ShotKg[]);
  const out: SoLienMach = { nhanVat: {}, canh: [] };
  let canhTruoc: string | undefined; let ngayTruoc: string | null = null;
  for (const c of ds) {
    const pc = canhCuaShot(c.canh, phanCanh);
    let luong: DongSo['luong_moi'] = luongCua.get(c.id) ?? '';
    const tenCanh = pc?.ten ?? c.canh;
    if (tenCanh !== canhTruoc) {
      const ngay: string | null = pc?.ngay?.trim() || ngayTruoc;
      out.canh.push({ ten: tenCanh, ngay: ngay ?? null, lien_truoc: pc?.lien_truoc !== false, shot: [] });
      canhTruoc = tenCanh; ngayTruoc = ngay ?? null;
    }
    out.canh[out.canh.length - 1]!.shot.push(c.thu_tu);
    const m = daNoi.get(c.id) ?? c.may_3d;
    // KHÔNG 3D: dòng sổ từ sơ đồ cảnh — dáng đầu → cuối (sổ dáng), đồ trên người (sổ đồ vật), khuất = ngoài khung, lỗi mạch 2D nhắc tên người đó
    const k2 = !m ? kgCua(kgt, c) : null;
    if (!m && k2 && coKhongGian(k2, c)) {
      const trong = new Set([...(nguoiKhung(k2, c, 'dau') ?? []), ...(nguoiKhung(k2, c, 'ket') ?? [])]);
      for (const ten of k2.nguoi.filter((n) => c.ky_thuat?.sd?.o[n] != null)) {
        const dd = dang(k2, c.thu_tu, ten, 'dau'), dk = dang(k2, c.thu_tu, ten, 'ket'); const cam = doCam(k2, c.thu_tu, ten, 'ket').map((v) => `${v.mon} (${v.vi})`).join('; ');
        const d: DongSo = { canhId: c.id, thu_tu: c.thu_tu, canh: tenCanh, ngay: ngayTruoc, luong_moi: luong, noi: null, tam: [], den: null, huong: null, huong_den: null, nam: false, nam_den: false,
          trang: dd?.vi ?? '', trang_den: dk?.vi ?? dd?.vi ?? '', ngoai: [], cam: cam || null, chia: null, dien: [], an: !trong.has(ten), loi: (loi2d[c.id] ?? []).filter((x) => x.includes(ten)), diem: 100, muc: [] };
        Object.assign(d, chamLoi(d.loi, d.an, null)); (out.nhanVat[ten] ??= []).push(d);
      }
    }
    if (!m) continue;
    if (!luong && m.nhay) luong = 'nhay';
    const loi = loiShot[c.id] ?? []; const thieu = thieuDongTac(c);
    for (const v of m.vi_tri as (ViTri & Record<string, unknown>)[]) {
      (out.nhanVat[v.ten] ??= []).push({
        canhId: c.id, thu_tu: c.thu_tu, canh: tenCanh, ngay: ngayTruoc, luong_moi: luong, noi: v.noi_tu ?? null,
        tam: v.tam, den: v.den ?? null, huong: v.huong ?? null, huong_den: v.huong_den ?? v.huong ?? null,
        nam: !!v.nam, nam_den: !!(v.nam_den ?? v.nam), trang: (v.trang ?? '').trim(), trang_den: (v.trang_den ?? v.trang ?? '').trim(),
        ngoai: SO_NGUOI.filter((x) => x.k !== 'trang').flatMap((x) => { const mo = ngoaiMo(v, x.k), ket = ngoaiKet(v, x.k); return mo === undefined && ket === undefined ? [] : [{ k: x.k, ten: x.ten, mo: mo ?? '', ket: ket ?? '' }]; }),
        cam: v.cam ?? null, chia: v.chia ?? null, dien: v.dien ?? [], an: !!v.an,
        // lỗi của shot NÓI VỀ nhân vật này (câu cổng mở bằng tên, hoặc nhắc người cầm / món đang cầm)
        loi: [] as string[], diem: 100, muc: [],
      });
      const d = out.nhanVat[v.ten]!.at(-1)!;
      d.loi = [...loi.filter((x) => x.startsWith(`${v.ten} `) || x.includes(` ${v.ten} `) || x.includes(`${v.ten} (`)), ...(m.vi_tri[0]?.ten === v.ten ? thieu : [])];   // thiếu động tác: gắn vào nhân vật đầu của shot
      Object.assign(d, chamLoi(d.loi, d.an, c.khung_xam?.thay?.find((x) => x.ten === v.ten)?.pt ?? null));
    }
  }
  return out;
}

/** BẢNG BỀ NGOÀI THEO NGÀY (wardrobe plot của script supervisor): mỗi ngày truyện, mỗi thuộc tính, các giá trị nhân vật mang và shot dùng. */
export function bangNgoai(ds: DongSo[]): { ngay: string; muc: { ten: string; gia_tri: { t: string; shot: number[] }[] }[] }[] {
  const out: ReturnType<typeof bangNgoai> = [];
  for (const d of ds) {
    const ngay = d.ngay ?? '—'; let o = out.find((x) => x.ngay === ngay); if (!o) out.push((o = { ngay, muc: [] }));
    for (const g of d.ngoai) for (const t of new Set([g.mo, g.ket])) {
      let m = o.muc.find((x) => x.ten === g.ten); if (!m) o.muc.push((m = { ten: g.ten, gia_tri: [] }));
      const k = t || 'không'; let gv = m.gia_tri.find((x) => x.t === k); if (!gv) m.gia_tri.push((gv = { t: k, shot: [] }));
      if (!gv.shot.includes(d.thu_tu)) gv.shot.push(d.thu_tu);
    }
  }
  return out.filter((x) => x.muc.length);
}

/** Chữ ngắn cho một ô sổ. */
export const chuCho = (p: number[] | null) => (p?.length ? `(${p.map((x) => Math.round(x * 10) / 10).join(', ')})` : '');
export const chuDang = (d: Pick<DongSo, 'nam' | 'nam_den'>) => (d.nam === d.nam_den ? (d.nam ? 'nằm' : 'đứng') : d.nam ? 'nằm → đứng dậy' : 'đứng → ngã');
/** Điểm của nhân vật qua một tập: trung bình + thấp nhất + số lỗi chặn. */
export const diemNhanVat = (ds: DongSo[]) => ({ tb: ds.length ? Math.round(ds.reduce((a, d) => a + d.diem, 0) / ds.length) : 100, thap: Math.min(100, ...ds.map((d) => d.diem)), chan: ds.reduce((a, d) => a + d.muc.filter((m) => m.muc === 'chan').length, 0) });
