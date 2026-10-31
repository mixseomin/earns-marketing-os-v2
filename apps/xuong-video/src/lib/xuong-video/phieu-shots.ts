// 🎬 PHIẾU SHOT của một tập (tab con "Shots" dưới mỗi tập — anh 31/10/2026: "ko đc sửa chắp vá. Phải đến từ mô phỏng 1 nguồn duy nhất trước! Các shot
// trước khi sinh phải có đủ thông tin từng shot, mô tả yêu cầu trước… dạng cây, link đến các thành phần, show cả 3D nếu cần hoặc 2D tuỳ shot").
// MỘT NGUỒN: chữ của mọi lá lấy từ thanhPhanDuKien (doi-chieu-khung.ts) — đúng danh mục cổng đối chiếu / vòng tự-sửa so với ảnh; look của shot lấy từ
// lookMang (sổ trang phục carry — cùng nguồn prompt keyframe); vị trí / hướng / cấu kiện lấy từ sơ đồ cảnh (xv_tap.khong_gian). Không có chữ tả nào
// viết riêng cho phiếu này: sửa nguồn thì phiếu, prompt và cổng đổi cùng nhau. Chỉ đọc, 0đ.
import 'server-only';
import { sql } from 'drizzle-orm';
import { kemBienThe, mapCanh, mapNhanVat, n, type Db, type Row } from './doc-db';
import { thanhPhanDuKien, type MucDuKien } from './doi-chieu-khung';
import { kgCua, sdLuc, type KhongGianTap } from './khong-gian';
import { svgPhac } from './so-do-canh';
import { lookMang, KHOA_LOOK } from './bo-set-3d';
import { locNhanh, nhanNhom, type NhanVat, type PhanCanh } from './kieu';

/** Một nút trên cây thành phần của shot. link = khoá nút trên cây phim ('nv-<id>' anchor · 'bt-<id>' look) để bấm mở đúng thành phần. */
export type NutPhieu = { nhan: string; loai: 'boi_canh' | 'cau_kien' | 'nhan_vat' | 'look' | 'dao_cu' | 'khac'; chi_tiet: string[]; link?: string; anh?: string | null; con?: NutPhieu[] };
export type PhieuShot = {
  id: number; thu_tu: number; nhanh: string; co_canh: string; goc_may: string; hanh_dong: string; mo: string; ket: string; thoai: string;
  /** dòng chung của shot (khung hình, ai có mặt…) — lá dự kiến không thuộc riêng thành phần nào */ chung: MucDuKien[];
  cay: NutPhieu[];
  /** 2D: khung phác bố trí chiếu từ sơ đồ cảnh theo máy của shot (svgPhac) — null khi shot chưa có sơ đồ */ svg: string | null;
  /** 3D: khung màu / xám Blender của shot (xv_canh.khung_xam) — null khi shot chưa dựng 3D */ anh3d: string | null;
  keyframe: string | null;
  /** lệch của keyframe HIỆN TẠI so với phiếu (bóc tách + đối chiếu đã lưu, chỉ khi đúng ảnh đang chọn) */ lech: string[];
  /** thiếu thông tin để sinh: lá "không khai" / "không tả" — phải điền trước khi sinh */ thieu: string[];
};

const MAU = ['#e35d6a', '#4f8fe6', '#e3a33b', '#46b37b', '#a46be0', '#3bb8c4'];

export async function phieuShotsTapDb(db: Db, tapId: number): Promise<PhieuShot[] | null> {
  const t = ((await db.execute(sql`SELECT id, phim_id, so, phan_canh, khong_gian FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0];
  if (!t) return null;
  const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${n(t.phim_id)} ORDER BY loai, id`)) as unknown as Row[]).map(mapNhanVat));
  const tatCa = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY coalesce(nhanh, ''), thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const kgt = (t.khong_gian ?? null) as KhongGianTap | null;
  // sổ trang phục carry: mọi shot nhánh chính (cùng cách lookTap / vong-sua dựng) → look từng nhân vật của từng shot
  const chinh = locNhanh(tatCa, 'A');
  const look = lookMang(chinh.map((c) => ({ id: c.id, canh: c.canh, nhan_vat: c.nhan_vat, bien_the: c.bien_the })), nhanVat, (t.phan_canh ?? []) as PhanCanh[], t.so == null ? undefined : n(t.so));
  const theoId = new Map(nhanVat.map((v) => [v.id, v]));
  const btTheoId = new Map(nhanVat.flatMap((v) => (v.bien_the ?? []).map((b) => [b.id, { b, v }] as const)));
  const cauKien = nhanVat.filter((v) => v.loai === 'cau_kien');

  return chinh.map((c): PhieuShot => {
    const kg = kgCua(kgt, c);
    const dk = thanhPhanDuKien(c, nhanVat, kg, 'dau', look.get(c.id));
    const dung = new Set<MucDuKien>();
    /** lá dự kiến của một thành phần: "<Thuộc tính> <tên>" — bỏ tên, giữ thuộc tính */
    const la = (ten: string) => dk.filter((r) => r.thanh_phan.endsWith(` ${ten}`) && !r.thanh_phan.startsWith('Đạo cụ ')).map((r) => { dung.add(r); return `${r.thanh_phan.slice(0, -ten.length - 1)}: ${r.du_kien}`; });
    const anchor = c.nhan_vat.map((id) => theoId.get(id)).filter((v): v is NhanVat => !!v);
    const cay: NutPhieu[] = [];
    // BỐI CẢNH + cấu kiện cố định lọt khung (vị trí theo máy của shot)
    for (const bc of anchor.filter((v) => v.loai === 'boi_canh')) {
      const ck = dk.filter((r) => r.thanh_phan.startsWith('Cấu kiện cố định · ')).map((r): NutPhieu => {
        dung.add(r); const ten = r.thanh_phan.slice('Cấu kiện cố định · '.length); const a = cauKien.find((v) => v.ten === ten);
        return { nhan: ten, loai: 'cau_kien', chi_tiet: [r.du_kien], link: a ? `nv-${a.id}` : undefined, anh: a?.anh_ref[0] ?? null };
      });
      cay.push({ nhan: bc.ten, loai: 'boi_canh', chi_tiet: [], link: `nv-${bc.id}`, anh: bc.anh_ref[0] ?? null, con: ck });
    }
    // NHÂN VẬT: vị trí / hướng / biểu cảm / dáng + từng món look của shot (node con, link sang look-book)
    for (const v of anchor.filter((x) => x.loai === 'nhan_vat')) {
      const lk = look.get(c.id)?.get(v.ten);
      const con: NutPhieu[] = KHOA_LOOK.flatMap((k) => (lk?.[k] ?? []).map((b): NutPhieu => ({ nhan: `${nhanNhom('nhan_vat', b.nhom)} · ${b.ten}`, loai: 'look', chi_tiet: [b.mo_ta], link: `bt-${b.id}`, anh: b.anh_url })));
      // biến thể KHÔNG phải look gắn ở shot (biểu cảm, tư thế) — vẫn là thành phần có ảnh riêng
      for (const id of c.bien_the) { const x = btTheoId.get(id); if (x && x.v.id === v.id && !con.some((y) => y.link === `bt-${id}`) && !(KHOA_LOOK as readonly string[]).includes(x.b.nhom)) con.push({ nhan: `${nhanNhom('nhan_vat', x.b.nhom)} · ${x.b.ten}`, loai: 'look', chi_tiet: [x.b.mo_ta], link: `bt-${id}`, anh: x.b.anh_url }); }
      cay.push({ nhan: v.ten, loai: 'nhan_vat', chi_tiet: la(v.ten), link: `nv-${v.id}`, anh: v.anh_ref[0] ?? null, con });
    }
    // ĐẠO CỤ / SẢN PHẨM: ai cầm / trạng thái
    for (const v of anchor.filter((x) => x.loai === 'dao_cu' || x.loai === 'san_pham')) {
      const ct = dk.filter((r) => r.thanh_phan.startsWith(`Đạo cụ ${v.ten} `)).map((r) => { dung.add(r); return `${r.thanh_phan.slice(`Đạo cụ ${v.ten} + `.length)}: ${r.du_kien}`; });
      cay.push({ nhan: v.ten, loai: 'dao_cu', chi_tiet: ct, link: `nv-${v.id}`, anh: v.anh_ref[0] ?? null });
    }
    const sd = sdLuc(c, 'dau');
    const nguoi = kg?.nguoi ?? [];
    const svg = kg?.so_do && sd ? svgPhac(kg.so_do, sd, nguoi, Object.fromEntries(nguoi.map((ten, i) => [ten, MAU[i % MAU.length]!]))) : null;
    const kx = c.khung_xam; const anh3d = kx && !kx.nguon ? kx.mau || kx.xam || null : null;
    const bt = c.boc_tach; const lech = bt?.tren?.dau && bt.tren.dau === c.keyframe_url ? (bt.doi_chieu?.dau ?? []).filter((r) => r.muc !== 'khớp' && r.muc !== 'gần').map((r) => `${r.thanh_phan}: cần "${r.du_kien}" — ảnh "${r.thuc_te}"`) : [];
    const thieu = dk.filter((r) => /^(không khai|không tả)$/.test(r.du_kien.trim())).map((r) => r.thanh_phan);
    return {
      id: c.id, thu_tu: c.thu_tu, nhanh: c.nhanh ?? '', co_canh: c.ky_thuat?.co_canh ?? '', goc_may: c.goc_may, hanh_dong: c.hanh_dong,
      mo: c.dan_dung?.mo ?? '', ket: c.dan_dung?.ket ?? '', thoai: (c.thoai ?? []).filter((d) => d.loi?.trim()).map((d) => `${d.nhan_vat}: "${d.loi}"`).join(' · ') || c.loi_thoai || '',
      chung: dk.filter((r) => !dung.has(r)), cay, svg, anh3d, keyframe: c.keyframe_url, lech, thieu,
    };
  });
}
