// ⚖️ ĐỐI CHIẾU bóc tách ↔ dự kiến (anh 30/10/2026: "phần bóc từ ảnh phải có 1 cột so sánh với thành phần dự kiến tại thời điểm đó và so sánh mức
// độ khớp, liên quan. Những chi tiết quan trọng phải so sánh cụ thể rõ ràng"). duKienKhung dựng spec dự kiến của shot từ dữ liệu (ai có mặt, áo,
// tóc, biểu cảm, đạo cụ, khung, bối cảnh); doiChieuKhung nhờ Gemini so TỪNG thành phần quan trọng → mức khớp + ghi chú cụ thể. ~0,3¢/khung.
import 'server-only';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { ghiTienChu, type Db } from './doc-db';
import { bieuCam } from './qc-cam-xuc';
import { doCam, dang, nguoiKhung, viTri, nhinCan, type KhongGian } from './khong-gian';
import { chuanEnum } from './thuoc-tinh';
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
  // tách mô tả áo thành TRANG PHỤC chính + VẾT/đặc điểm, cắt đuôi câu lệnh sinh-ảnh ("in every shot", "no drips"…) — để lá gọn, model không ngáo
  const tachAo = (moTa: string): { chinh: string; vet: string } => {
    const s = (moTa || '').replace(/\s+/g, ' ').trim();
    const m = s.match(/\b(?:one |a |the )?coffee[- ]?stain|vết\s*(?:cà\s*phê|ố)/i);
    if (!m || m.index == null) return { chinh: s.split(/;?\s*(?:no drips|the stain has exactly|in every shot)/i)[0]!.replace(/[;,\s]+$/, '').trim() || s, vet: '' };
    const chinh = s.slice(0, m.index).replace(/[;,\s]+$/, '').trim();
    const vet = s.slice(m.index).split(/;?\s*(?:no drips|no runs|the stain has exactly|in every shot)/i)[0]!.replace(/[;,\s]+$/, '').trim();
    return { chinh: chinh || s, vet };
  };
  const viNguoi = (v: NhanVat) => { if (kg && nguoiKhung(kg, c, lucKg)?.includes(v.ten)) { const x = viTri(kg, c, v.ten); const h = nhinCan(kg, c, v.ten); return [x == null ? '' : x < -0.33 ? 'trái màn' : x > 0.33 ? 'phải màn' : 'giữa màn', h ? `nhìn ${h < 0 ? 'trái' : 'phải'}` : ''].filter(Boolean).join(', '); } return ''; };
  const L: MucDuKien[] = [];
  L.push({ thanh_phan: 'Khung hình', du_kien: c.ky_thuat?.co_canh ?? 'ms' });
  L.push({ thanh_phan: 'Bối cảnh', du_kien: c.phan_doan || c.canh || 'không khai' });
  if (nguoi.length) L.push({ thanh_phan: 'Nhân vật có mặt', du_kien: nguoi.map((v) => v.ten).join(', ') });
  for (const v of nguoi) {
    const bc = (c.bieu_cam ?? []).find((x) => x.nv === v.ten);
    const bcTxt = bc ? (luc === 'dau' ? bieuCam(bc.dau)?.ten ?? bc.dau : bieuCam(bc.cuoi)?.ten ?? bc.cuoi) : 'không khai';
    const ao = tachAo(aoCua(v));
    L.push({ thanh_phan: `Vị trí ${v.ten}`, du_kien: viNguoi(v) || 'không khai' });
    L.push({ thanh_phan: `Áo ${v.ten}`, du_kien: ao.chinh || 'không tả' });
    if (ao.vet) L.push({ thanh_phan: `Vết áo ${v.ten}`, du_kien: ao.vet });   // vết/đặc điểm riêng — lá riêng để không bị gộp che (vụ vết cà phê)
    L.push({ thanh_phan: `Tóc ${v.ten}`, du_kien: tuToc(v.mo_ta) || '(theo mô tả nhân vật)' });
    L.push({ thanh_phan: `Biểu cảm ${v.ten}`, du_kien: bcTxt });
    const dangTxt = kg ? (dang(kg, c.thu_tu, v.ten, lucKg)?.vi ?? '') : '';
    if (dangTxt) L.push({ thanh_phan: `Dáng ${v.ten}`, du_kien: dangTxt });
    // "Đồ cầm" bỏ: trùng với các ĐẠO CỤ đã liệt kê riêng bên dưới → gây nhiễu/ngáo
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

/** Chấm TỪNG thành phần dự kiến (có cấu trúc) với ảnh thực tế → mức khớp + ghi chú. Chấm THEO KHÓA: máy phải trả đúng-đủ mỗi mục dự kiến, không tự bịa/bỏ dòng → giảm sai sót nhận định. 0,3¢. */
export async function doiChieuKhung(db: Db | null, phimId: number | null, duKien: MucDuKien[], k: BocTachKhung): Promise<DongDoiChieu[] | null> {
  const thuc = [
    `Khung hình: ${k.khung_hinh} · ${k.goc_may}`, `Bối cảnh: ${k.boi_canh} · ánh sáng ${k.anh_sang}`, `Bố cục: ${k.bo_cuc}`,
    ...k.nguoi.map((n) => `Người "${n.ai}" (${n.dac_diem}) — vị trí: ${n.vi_tri} · áo: ${n.ao} · tóc: ${n.toc} · trang sức: ${n.trang_suc} · biểu cảm: ${n.bieu_cam} · nhìn: ${n.huong_nhin} · dáng: ${n.dang} · cầm: ${n.do_cam}`),
    ...k.dao_cu.map((d) => `Đạo cụ "${d.ten}" (${d.dac_diem}): ${d.trang_thai} — ${d.vi_tri}`),
    k.chu_tren_hinh && k.chu_tren_hinh !== 'không' ? `Chữ trên hình: ${k.chu_tren_hinh}` : '',
  ].filter(Boolean).join('\n');
  const dkList = duKien.map((m, i) => `${i + 1}. "${m.thanh_phan}" — dự kiến: ${m.du_kien}`).join('\n');
  const text = [
    'Bạn CHẤM NGHIỆM THU một khung phim: với TỪNG thành phần trong DANH SÁCH DỰ KIẾN, đọc phần THỰC TẾ (bóc từ ảnh) rồi chấm mức khớp. Trả JSON { doi_chieu: [...] } bằng tiếng Việt.',
    'QUY TẮC OUTPUT (bắt buộc): trả về ĐÚNG và ĐỦ mỗi mục trong DANH SÁCH DỰ KIẾN, GIỮ NGUYÊN y hệt chuỗi thanh_phan và đúng thứ tự; mỗi dòng: thanh_phan (copy), du_kien (copy), thuc_te (giá trị đọc từ THỰC TẾ cho ĐÚNG đối tượng+thuộc tính đó, "—" nếu ảnh không có), muc, ghi_chu. KHÔNG gộp, KHÔNG bỏ sót, KHÔNG đổi tên mục. Sau cùng, nếu THỰC TẾ có đối tượng/đạo cụ QUAN TRỌNG không nằm trong danh sách, thêm dòng muc="thừa".',
    'ÁNH XẠ ĐÚNG NGƯỜI trước khi điền: THỰC TẾ gọi người theo ngoại hình (vd "người phụ nữ áo đỏ"); hãy ánh xạ về đúng TÊN nhân vật trong danh sách dự kiến (dựa áo/tóc/vai trò) — tuyệt đối không lẫn thuộc tính của người này sang người kia.',
    'RUBRIC NGHIÊM (gate cho phép ráp clip phụ thuộc kết quả này — cấm dễ dãi): muc="khớp" CHỈ khi trùng khít cả bản chất. SAI NGƯỜI GIỮ đạo cụ / SAI VỊ TRÍ = "lệch", KHÔNG phải khớp (vd dự kiến "Hạ đeo thẻ trên cổ" nhưng ảnh "Vivian cầm thẻ trên tay" = lệch). Khác bên màn / khác người / khác tầm tay = lệch. Biểu cảm khác mức rõ (sốc vs bối rối) = lệch. "gần" chỉ cho khác nhỏ KHÔNG đổi bản chất; "thiếu" = dự kiến có mà ảnh không có.',
    '', '=== DANH SÁCH THÀNH PHẦN DỰ KIẾN (chấm từng mục, giữ nguyên thanh_phan) ===', dkList, '', '=== THỰC TẾ (bóc từ ảnh) ===', thuc,
  ].join('\n');
  const r = await goiGeminiJson<{ doi_chieu?: DongDoiChieu[] }>([{ text }], SCHEMA, undefined);
  if (!r) return null;
  if (db) await ghiTienChu(db, phimId, 'đối chiếu khung', MO_HINH_BD, r.tk, 'google');
  return r.data.doi_chieu ?? null;
}

/** mô tả tóc (DB) → một trị TOC_KIEU để so bằng. */
function tocEnum(moTa: string): string {
  const t = (moTa || '').toLowerCase();
  if (/búi|bun|chignon/.test(t)) return 'búi thấp';
  if (/đuôi ngựa|ponytail|pigtail/.test(t)) return 'đuôi ngựa';
  if (/tết|braid/.test(t)) return 'tết';
  if (/\bngắn\b|short|bob|crop|buzz/.test(t)) return 'tóc ngắn';
  if (/dài|long|straight|thẳng|xõa|loose|wavy|flowing/.test(t)) return 'xõa dài';
  return '';
}

// ⚖️ B4: ĐÈ phán của model bằng SO BẰNG MÁY cho các lá ENUM sạch (vị trí màn · kiểu tóc · NGƯỜI GIỮ đạo cụ) — đây là chỗ model hay chấm ẩu nhất.
// Dự kiến (B3) lấy thẳng từ DB/sổ đồ vật; thực tế lấy lá enum bóc tách; khác trị = LỆCH dứt khoát, không cần model. Các lá còn lại giữ nguyên phán của model.
export function apDungSoBang(chieu: DongDoiChieu[], c: Canh, nhanVat: NhanVat[], kg: KhongGian | null | undefined, luc: 'dau' | 'cuoi', k: BocTachKhung): DongDoiChieu[] {
  const lucKg = luc === 'cuoi' ? 'ket' : 'dau';
  const khop = (a: string, b: string) => (b.includes(a) || a.includes(b));   // tên gần đúng (ai của ảnh đã map về tên nhân vật)
  const nguoiTT = (ten: string) => k.nguoi.find((n) => khop(ten, n.ai));
  const doTT = (ten: string) => k.dao_cu.find((d) => khop(ten, d.ten));
  const viTriMan = (ten: string) => { if (!kg) return ''; const x = viTri(kg, c, ten, lucKg); return x == null ? '' : x < -0.33 ? 'trái' : x > 0.33 ? 'phải' : 'giữa'; };
  const nguoiGiu = (prop: string) => kg ? (nhanVat.find((p) => p.loai === 'nhan_vat' && doCam(kg, c.thu_tu, p.ten, lucKg).some((x) => khop(prop, x.mon)))?.ten ?? '') : '';
  return chieu.map((row) => {
    let dk = '', tt = '', nhan = '';
    const mVi = row.thanh_phan.match(/^Vị trí (.+)$/);
    const mToc = row.thanh_phan.match(/^Tóc (.+)$/);
    const mGiu = row.thanh_phan.match(/^Đạo cụ (.+?) \+ vị trí$/i);
    if (mVi) { dk = viTriMan(mVi[1]!); tt = nguoiTT(mVi[1]!)?.vi_tri_man ?? ''; nhan = 'vị trí màn'; }
    else if (mToc) { dk = tocEnum(nhanVat.find((v) => v.ten === mToc[1])?.mo_ta ?? ''); tt = nguoiTT(mToc[1]!)?.toc_kieu ?? ''; nhan = 'kiểu tóc'; }
    else if (mGiu) { dk = nguoiGiu(mGiu[1]!); tt = doTT(mGiu[1]!)?.nguoi_giu ?? ''; nhan = 'người giữ'; }
    else return row;
    if (!dk || !tt) return row;   // thiếu một vế → để nguyên phán của model
    const m: DongDoiChieu['muc'] = chuanEnum(dk) === chuanEnum(tt) ? 'khớp' : 'lệch';
    return { ...row, muc: m, du_kien: dk, thuc_te: tt, ghi_chu: `[máy so bằng] ${nhan}: dự kiến "${dk}" ${m === 'khớp' ? '=' : '≠'} ảnh "${tt}"` };
  });
}
