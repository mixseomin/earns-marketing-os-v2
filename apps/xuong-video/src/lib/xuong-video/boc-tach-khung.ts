// 🧩 CON BÓC TÁCH KHUNG (anh 30/10/2026: "mỗi lần sinh keyframe xong phải có 1 con bóc tách các thành phần chi tiết trong khung hình để còn khớp
// tiếp bước sau"; "phải là MỌI THỨ trong phân cảnh đó"). Đọc MỘT keyframe → JSON có cấu trúc liệt kê TẤT CẢ thấy được: bối cảnh + vật cố định +
// ánh sáng, khung hình, MỌI người (cả vai phụ) với vị trí/áo/tóc/trang sức/biểu cảm/hướng nhìn/dáng/đồ cầm, MỌI đạo cụ (trạng thái + vị trí).
// Dùng để (a) đối chiếu spec shot (lệch thì chặn + sinh lại) và (b) mang TRẠNG THÁI THẬT sang shot sau. Gemini Flash ~0,3¢/khung (ghi xv_job).
import 'server-only';
import { goiGeminiJson } from './soi-bien-dang';
import { ghiTienChu } from './doc-db';
import { readFile } from 'node:fs/promises';
import type { Db } from './doc-db';
import type { BocTachKhung } from './kieu';
import { VI_TRI_MAN, HUONG_NHIN, TOC_KIEU, CACH_GIU } from './thuoc-tinh';
export type { BocTachKhung, NguoiKhung, DoKhung } from './kieu';

const SCHEMA = { type: 'OBJECT', properties: {
  boi_canh: { type: 'STRING' }, vat_co_dinh: { type: 'ARRAY', items: { type: 'STRING' } }, anh_sang: { type: 'STRING' },
  khung_hinh: { type: 'STRING' }, goc_may: { type: 'STRING' }, bo_cuc: { type: 'STRING' },
  nguoi: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    ai: { type: 'STRING' }, dac_diem: { type: 'STRING' }, vi_tri: { type: 'STRING' }, ao: { type: 'STRING' }, toc: { type: 'STRING' }, trang_suc: { type: 'STRING' },
    bieu_cam: { type: 'STRING' }, huong_nhin: { type: 'STRING' }, dang: { type: 'STRING' }, do_cam: { type: 'STRING' },
    // 🧬 lá nguyên tử enum — điền theo đúng từ khóa chuẩn để chấm SO BẰNG
    vi_tri_man: { type: 'STRING', enum: [...VI_TRI_MAN] }, huong_man: { type: 'STRING', enum: [...HUONG_NHIN] }, toc_kieu: { type: 'STRING', enum: [...TOC_KIEU] },
  }, required: ['ai', 'dac_diem', 'vi_tri', 'ao', 'toc', 'bieu_cam', 'huong_nhin', 'dang', 'do_cam', 'trang_suc', 'vi_tri_man', 'huong_man', 'toc_kieu'] } },
  dao_cu: { type: 'ARRAY', items: { type: 'OBJECT', properties: { ten: { type: 'STRING' }, dac_diem: { type: 'STRING' }, trang_thai: { type: 'STRING' }, vi_tri: { type: 'STRING' },
    // 🧬 lá nguyên tử: ai giữ (tên nhân vật hoặc "không ai"), cách giữ, vị trí màn
    nguoi_giu: { type: 'STRING' }, cach_giu: { type: 'STRING', enum: [...CACH_GIU] }, vi_tri_man: { type: 'STRING', enum: [...VI_TRI_MAN] },
  }, required: ['ten', 'dac_diem', 'trang_thai', 'vi_tri', 'nguoi_giu', 'cach_giu', 'vi_tri_man'] } },
  chu_tren_hinh: { type: 'STRING' }, ghi_chu: { type: 'STRING' },
}, required: ['boi_canh', 'vat_co_dinh', 'anh_sang', 'khung_hinh', 'goc_may', 'bo_cuc', 'nguoi', 'dao_cu', 'chu_tren_hinh', 'ghi_chu'] };

const LENH = [
  'You are a continuity script supervisor. This is ONE frame of an AI-generated live-action film shot. List EVERYTHING visible in the frame as structured data, in Vietnamese. Describe only what is actually shown — do not invent what is hidden or out of frame; if unsure, say "không rõ".',
  'CRITICAL: every object and person must be described by its CHARACTERISTICS (dac_diem) AND its position RELATIVE to the things around it (vi_tri) — not just a screen coordinate. State what it is next to, on which side of whom/what, roughly how far, what it faces, touches or overlaps. Example vi_tri: "bên phải Hạ, cách ~0,5 m, mặt quay sang trái nhìn Hạ"; "trên ngực trái Hạ, tay phải Vivian đang chạm tới"; "sát cửa thang bên trái màn".',
  'For EVERY person visible (including background extras): ai (who/role if identifiable, else "vai phụ / người qua lại"), dac_diem (distinguishing traits: tuổi áng chừng, dáng, nét mặt riêng), vi_tri (RELATIVE position as above), ao (garment + colour + distinctive marks e.g. a coffee stain), toc (hairstyle: xõa/đuôi ngựa/búi thấp/ngắn…, and colour), trang_suc (jewellery/accessories, or "không"), bieu_cam (facial expression), huong_nhin (gaze direction + who/what they look at), dang (body pose / action), do_cam (what they hold or wear on the body).',
  'For EVERY prop/object of story importance (dao_cu): ten, dac_diem (màu, chất liệu, chữ in…), trang_thai (its state: lanyard intact / snapped, box closed…), vi_tri (RELATIVE position — who holds it, on whose body part, next to what).',
  'bo_cuc = one sentence giving the overall spatial layout (ai/vật ở đâu so với nhau, ai gần máy, ai xa). boi_canh = setting in one phrase; vat_co_dinh = fixed set pieces (elevator doors, marble wall, floor indicator, lamp…); anh_sang = lighting; khung_hinh = shot size (CU/MCU/MS/WS/insert); goc_may = camera angle; chu_tren_hinh = any text visible in frame (signs, badge text), or "không"; ghi_chu = anything else notable.',
  // 🧬 lá nguyên tử: điền ĐÚNG một từ khóa trong enum, để máy chấm bằng SO BẰNG (không để model phán khớp/lệch sau này)
  'ATOMIC ENUM LEAVES — fill from the image using EXACTLY one allowed keyword each: for each person vi_tri_man (vị trí ngang trên màn: trái/giữa/phải/ngoài khung), huong_man (hướng mặt so với màn), toc_kieu (kiểu tóc). For each prop nguoi_giu (TÊN người đang cầm/đeo nó — dùng đúng tên nhân vật nếu nhận ra, nếu không ai cầm ghi "không ai"), cach_giu (cách giữ), vi_tri_man. These must be consistent with the free-text vi_tri you wrote.',
].join('\n');

/** Bóc tách MỘT keyframe (url hoặc path). tenNhanVat: danh sách tên nhân vật để ánh xạ "ai" + "nguoi_giu". db+phimId để ghi tiền; null/null nếu chạy rời. */
export async function bocTachKhung(db: Db | null, phimId: number | null, anh: string, tenNhanVat?: string[]): Promise<BocTachKhung | null> {
  const b = /^https?:/.test(anh) ? Buffer.from(await (await fetch(anh)).arrayBuffer()) : await readFile(anh);
  const lenh = LENH + (tenNhanVat?.length ? `\nDANH SÁCH NHÂN VẬT trong phim (ánh xạ "ai" và "nguoi_giu" về đúng MỘT tên trong đây khi nhận ra, dựa áo/tóc/vai): ${tenNhanVat.join(', ')}.` : '');
  const r = await goiGeminiJson<BocTachKhung>([{ text: lenh }, { inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }], SCHEMA, 'MEDIA_RESOLUTION_HIGH');
  if (!r) return null;
  // Cổng rẻ đôi khi trả JSON ĐÚNG CÚ PHÁP nhưng KHUYẾT shape (thiếu mảng nguoi/dao_cu — người bán ckey trả prose/yaml, hoặc model 402 fallback nửa vời):
  // coi là bóc HỎNG → null, để đối chiếu báo "bóc hỏng" thay vì sập ở doiChieuKhung (k.nguoi.map / k.vat_co_dinh.join). Chuẩn hoá các mảng cho chắc.
  const k = r.data as Partial<BocTachKhung> | null;
  if (!k || !Array.isArray(k.nguoi) || !Array.isArray(k.dao_cu)) return null;
  if (!Array.isArray(k.vat_co_dinh)) k.vat_co_dinh = [];
  if (db) await ghiTienChu(db, phimId, 'bóc tách khung', r.model, r.tk, r.nguon);
  return k as BocTachKhung;
}
