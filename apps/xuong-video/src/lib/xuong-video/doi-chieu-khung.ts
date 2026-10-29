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

/** SPEC DỰ KIẾN của một khung (đầu/cuối) từ dữ liệu shot — text từng dòng để nhờ model đối chiếu. */
export function duKienKhung(c: Canh, nhanVat: NhanVat[], kg: KhongGian | null | undefined, luc: 'dau' | 'cuoi'): string {
  const lucKg = luc === 'cuoi' ? 'ket' : 'dau';
  const nguoi = nhanVat.filter((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id));
  const doVat = nhanVat.filter((v) => (v.loai === 'dao_cu' || v.loai === 'san_pham') && c.nhan_vat.includes(v.id));
  const btShot = c.bien_the ?? [];
  const aoCua = (v: NhanVat) => { const bt = (v.bien_the ?? []).find((b) => btShot.includes(b.id)); return bt?.mo_ta || c.trang_phuc || v.mo_ta; };
  const L: string[] = [];
  L.push(`Khung hình dự kiến: ${c.ky_thuat?.co_canh ?? 'ms'}`);
  L.push(`Bối cảnh dự kiến: ${c.phan_doan || c.canh || 'không khai'}`);
  for (const v of nguoi) {
    const bc = (c.bieu_cam ?? []).find((x) => x.nv === v.ten);
    const bcTxt = bc ? (luc === 'dau' ? bieuCam(bc.dau)?.ten ?? bc.dau : bieuCam(bc.cuoi)?.ten ?? bc.cuoi) : 'không khai';
    const toc = tuToc(v.mo_ta) || '(theo mô tả nhân vật)';
    let viTriTxt = '';
    if (kg && nguoiKhung(kg, c, lucKg)?.includes(v.ten)) { const x = viTri(kg, c, v.ten); const h = nhinCan(kg, c, v.ten); viTriTxt = [x == null ? '' : x < -0.33 ? 'trái màn' : x > 0.33 ? 'phải màn' : 'giữa màn', h ? `nhìn ${h < 0 ? 'trái' : 'phải'}` : ''].filter(Boolean).join(', '); }
    const doTxt = kg ? doCam(kg, c.thu_tu, v.ten, lucKg).map((d) => `${d.mon}: ${d.vi}`).join('; ') : '';
    const dangTxt = kg ? (dang(kg, c.thu_tu, v.ten, lucKg)?.vi ?? '') : '';
    L.push(`Nhân vật ${v.ten} — áo: ${aoCua(v)} · tóc: ${toc} · biểu cảm: ${bcTxt}${viTriTxt ? ` · vị trí: ${viTriTxt}` : ''}${dangTxt ? ` · dáng: ${dangTxt}` : ''}${doTxt ? ` · đồ: ${doTxt}` : ''}`);
  }
  for (const v of doVat) L.push(`Đạo cụ ${v.ten}: ${v.mo_ta || 'không tả'}`);
  return L.join('\n');
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
    'Mỗi dòng: thanh_phan (tên: "Nhân vật có mặt", "Áo <tên>", "Tóc <tên>", "Biểu cảm <tên>", "Vị trí <tên>", "Đạo cụ <tên> + trạng thái", "Khung hình", "Bối cảnh"…), du_kien (giá trị dự kiến, hoặc "—"), thuc_te (giá trị bóc từ ảnh, hoặc "—"), muc (khớp = đúng ý; gần = gần đúng/khác nhỏ; lệch = khác rõ; thiếu = dự kiến có mà ảnh KHÔNG có; thừa = ảnh có mà dự kiến không nhắc), ghi_chu (nói RÕ khác chỗ nào, vd "dự kiến búi thấp nhưng ảnh xõa").',
    'BẮT BUỘC so các chi tiết quan trọng: đủ/thiếu/thừa nhân vật, áo + màu + vết đặc trưng, KIỂU TÓC, biểu cảm, đạo cụ chính + trạng thái (thẻ còn/đứt, ai cầm), vị trí tương đối, khung hình. Bỏ qua chi tiết nền vụn không ảnh hưởng truyện.',
    '', '=== DỰ KIẾN ===', duKien, '', '=== THỰC TẾ (bóc từ ảnh) ===', thuc,
  ].join('\n');
  const r = await goiGeminiJson<{ doi_chieu?: DongDoiChieu[] }>([{ text }], SCHEMA, undefined);
  if (!r) return null;
  if (db) await ghiTienChu(db, phimId, 'đối chiếu khung', MO_HINH_BD, r.tk, 'google');
  return r.data.doi_chieu ?? null;
}
