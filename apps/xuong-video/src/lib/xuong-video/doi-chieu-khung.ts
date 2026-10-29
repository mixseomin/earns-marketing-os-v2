// ⚖️ ĐỐI CHIẾU bóc tách ↔ dự kiến (anh 30/10/2026: "phần bóc từ ảnh phải có 1 cột so sánh với thành phần dự kiến tại thời điểm đó và so sánh mức
// độ khớp, liên quan. Những chi tiết quan trọng phải so sánh cụ thể rõ ràng"). duKienKhung dựng spec dự kiến của shot từ dữ liệu (ai có mặt, áo,
// tóc, biểu cảm, đạo cụ, khung, bối cảnh); doiChieuKhung nhờ Gemini so TỪNG thành phần quan trọng → mức khớp + ghi chú cụ thể. ~0,3¢/khung.
import 'server-only';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { ghiTienChu, type Db } from './doc-db';
import { bieuCam } from './qc-cam-xuc';
import { doCam, dang, nguoiKhung, viTri, nhinCan, type KhongGian } from './khong-gian';
import type { BocTachKhung, Canh, NhanVat, DongDoiChieu } from './kieu';

const tuToc = (s: string) => (s.match(/đuôi ngựa|ponytail|búi (thấp|cao)|low bun|high bun|bun|xõa|loose|tóc dài|long hair|tóc ngắn|short hair|straight|thẳng|tết|braid/i)?.[0] ?? '');

/** Một mục trong danh mục THÀNH PHẦN DỰ KIẾN (một thuộc tính của một đối tượng). thanh_phan theo quy ước để tách cây: "Áo <nv>", "Vị trí <nv>", "Đạo cụ <x> + vị trí"… */
export type MucDuKien = { thanh_phan: string; du_kien: string };

/** DANH MỤC THÀNH PHẦN DỰ KIẾN của một khung (đầu/cuối) — dựng thẳng từ dữ liệu, KHÔNG cần AI. Dùng cho cả hiển thị (mọi shot thấy dự kiến) lẫn đối chiếu. */
export function thanhPhanDuKien(c: Canh, nhanVat: NhanVat[], kg: KhongGian | null | undefined, luc: 'dau' | 'cuoi'): MucDuKien[] {
  const lucKg = luc === 'cuoi' ? 'ket' : 'dau';
  const nguoi = nhanVat.filter((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id));
  const doVat = nhanVat.filter((v) => (v.loai === 'dao_cu' || v.loai === 'san_pham') && c.nhan_vat.includes(v.id));
  const btShot = c.bien_the ?? [];
  const aoCua = (v: NhanVat) => { const bt = (v.bien_the ?? []).find((b) => btShot.includes(b.id)); return bt?.mo_ta || c.trang_phuc || v.mo_ta; };
  const viNguoi = (v: NhanVat) => { if (kg && nguoiKhung(kg, c, lucKg)?.includes(v.ten)) { const x = viTri(kg, c, v.ten); const h = nhinCan(kg, c, v.ten); return [x == null ? '' : x < -0.33 ? 'trái màn' : x > 0.33 ? 'phải màn' : 'giữa màn', h ? `nhìn ${h < 0 ? 'trái' : 'phải'}` : ''].filter(Boolean).join(', '); } return ''; };
  const L: MucDuKien[] = [];
  L.push({ thanh_phan: 'Khung hình', du_kien: c.ky_thuat?.co_canh ?? 'ms' });
  L.push({ thanh_phan: 'Bối cảnh', du_kien: c.phan_doan || c.canh || 'không khai' });
  if (nguoi.length) L.push({ thanh_phan: 'Nhân vật có mặt', du_kien: nguoi.map((v) => v.ten).join(', ') });
  for (const v of nguoi) {
    const bc = (c.bieu_cam ?? []).find((x) => x.nv === v.ten);
    const bcTxt = bc ? (luc === 'dau' ? bieuCam(bc.dau)?.ten ?? bc.dau : bieuCam(bc.cuoi)?.ten ?? bc.cuoi) : 'không khai';
    L.push({ thanh_phan: `Vị trí ${v.ten}`, du_kien: viNguoi(v) || 'không khai' });
    L.push({ thanh_phan: `Áo ${v.ten}`, du_kien: aoCua(v) || 'không tả' });
    L.push({ thanh_phan: `Tóc ${v.ten}`, du_kien: tuToc(v.mo_ta) || '(theo mô tả nhân vật)' });
    L.push({ thanh_phan: `Biểu cảm ${v.ten}`, du_kien: bcTxt });
    const dangTxt = kg ? (dang(kg, c.thu_tu, v.ten, lucKg)?.vi ?? '') : '';
    if (dangTxt) L.push({ thanh_phan: `Dáng ${v.ten}`, du_kien: dangTxt });
    const doTxt = kg ? doCam(kg, c.thu_tu, v.ten, lucKg).map((d) => `${d.mon}: ${d.vi}`).join('; ') : '';
    if (doTxt) L.push({ thanh_phan: `Đồ cầm ${v.ten}`, du_kien: doTxt });
  }
  for (const v of doVat) {
    // vị trí đạo cụ: ai đang cầm/đeo nó + vị trí người đó — để MỌI đối tượng (kể cả đạo cụ) đều có mục Vị trí tương quan
    const viDc = kg ? (nguoi.map((p) => { const d = doCam(kg, c.thu_tu, p.ten, lucKg).find((x) => x.mon === v.ten); return d ? `${d.vi} (${p.ten} cầm/đeo)` : ''; }).find(Boolean) ?? '') : '';
    L.push({ thanh_phan: `Đạo cụ ${v.ten} + vị trí`, du_kien: viDc || 'không khai' });
    L.push({ thanh_phan: `Đạo cụ ${v.ten} + trạng thái`, du_kien: v.mo_ta || 'không tả' });
  }
  return L;
}

/** SPEC DỰ KIẾN của một khung thành text từng dòng để nhờ model đối chiếu (một nguồn với thanhPhanDuKien). */
export function duKienKhung(c: Canh, nhanVat: NhanVat[], kg: KhongGian | null | undefined, luc: 'dau' | 'cuoi'): string {
  return thanhPhanDuKien(c, nhanVat, kg, luc).map((m) => `${m.thanh_phan}: ${m.du_kien}`).join('\n');
}

const SCHEMA = { type: 'OBJECT', properties: { doi_chieu: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  thanh_phan: { type: 'STRING' }, du_kien: { type: 'STRING' }, thuc_te: { type: 'STRING' },
  muc: { type: 'STRING', enum: ['khớp', 'gần', 'lệch', 'thiếu', 'thừa'] }, ghi_chu: { type: 'STRING' },
}, required: ['thanh_phan', 'du_kien', 'thuc_te', 'muc', 'ghi_chu'] } } }, required: ['doi_chieu'] };

/** So TỪNG thành phần quan trọng: dự kiến vs bóc-từ-ảnh → mức khớp (khớp/gần/lệch/thiếu/thừa) + ghi chú. 0,3¢. */
export async function doiChieuKhung(db: Db | null, phimId: number | null, duKien: string, k: BocTachKhung): Promise<DongDoiChieu[] | null> {
  const thuc = [
    `Khung: ${k.khung_hinh} · ${k.goc_may}`, `Bối cảnh: ${k.boi_canh} · ánh sáng ${k.anh_sang}`, `Bố cục: ${k.bo_cuc}`,
    ...k.nguoi.map((n) => `Người "${n.ai}" (${n.dac_diem}) — vị trí: ${n.vi_tri} · áo: ${n.ao} · tóc: ${n.toc} · trang sức: ${n.trang_suc} · biểu cảm: ${n.bieu_cam} · nhìn: ${n.huong_nhin} · dáng: ${n.dang} · cầm: ${n.do_cam}`),
    ...k.dao_cu.map((d) => `Đạo cụ "${d.ten}" (${d.dac_diem}): ${d.trang_thai} — ${d.vi_tri}`),
    k.chu_tren_hinh && k.chu_tren_hinh !== 'không' ? `Chữ trên hình: ${k.chu_tren_hinh}` : '',
  ].filter(Boolean).join('\n');
  const text = [
    'So sánh THÀNH PHẦN DỰ KIẾN của một khung phim với THÀNH PHẦN THỰC TẾ bóc ra từ ảnh đã sinh. Trả về bảng đối chiếu TỪNG thành phần quan trọng, bằng tiếng Việt.',
    'Dùng ĐÚNG các tên thanh_phan này (để ghép cây theo đối tượng): "Khung hình", "Bối cảnh", "Nhân vật có mặt"; mỗi nhân vật <tên>: "Vị trí <tên>", "Áo <tên>", "Tóc <tên>", "Biểu cảm <tên>", "Dáng <tên>", "Đồ cầm <tên>"; mỗi đạo cụ <tên>: "Đạo cụ <tên> + vị trí", "Đạo cụ <tên> + trạng thái". du_kien (giá trị dự kiến, hoặc "—"), thuc_te (giá trị bóc từ ảnh, hoặc "—"), muc (khớp = đúng ý; gần = gần đúng/khác nhỏ; lệch = khác rõ; thiếu = dự kiến có mà ảnh KHÔNG có; thừa = ảnh có mà dự kiến không nhắc), ghi_chu (nói RÕ khác chỗ nào, vd "dự kiến búi thấp nhưng ảnh xõa").',
    'BẮT BUỘC: MỖI nhân vật VÀ MỖI đạo cụ đều phải có dòng Vị trí ("Vị trí <nhân vật>" hoặc "Đạo cụ <đạo cụ> + vị trí") tả vị trí TƯƠNG QUAN so với các thành phần khác (trái/giữa/phải màn, trước/sau, cạnh ai, trong tay ai, gần vật nào) — kể cả thẻ, thùng đồ. Ngoài ra so đủ: đủ/thiếu/thừa nhân vật, áo + màu + vết đặc trưng, KIỂU TÓC, biểu cảm, dáng, đạo cụ + trạng thái (thẻ còn/đứt, ai cầm), khung hình, bối cảnh. Bỏ qua chi tiết nền vụn không ảnh hưởng truyện.',
    '', '=== DỰ KIẾN ===', duKien, '', '=== THỰC TẾ (bóc từ ảnh) ===', thuc,
  ].join('\n');
  const r = await goiGeminiJson<{ doi_chieu?: DongDoiChieu[] }>([{ text }], SCHEMA, undefined);
  if (!r) return null;
  if (db) await ghiTienChu(db, phimId, 'đối chiếu khung', MO_HINH_BD, r.tk, 'google');
  return r.data.doi_chieu ?? null;
}
