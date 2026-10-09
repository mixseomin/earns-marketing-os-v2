// Sinh ảnh gốc anchor + keyframe shot — lõi dùng chung cho server action (actions.ts, đã kiểm quyền) và script trên box.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dayViecAnh } from './hoan-tat';
import { promptAnhMau } from './claude';
import { promptCamXuc } from './am-thanh';
import { promptKyThuatAnh } from './dien-anh';
import { docKinhThanh, thanhPhanCanh, MO_HINH_ANH, type KinhThanh, type NhanVat } from './kieu';
import { boiCanhCanh, mapNhanVat, taoJob, type Db, type Row } from './doc-db';

export type KqSinh<T> = { ok: true; data: T } | { ok: false; loi: string };

/** Prompt ảnh cuối = phong cách bộ phim + prompt cảnh + nhắc giữ đúng anchor theo ảnh tham chiếu. */
export const KHONG_CHU = 'Absolutely NO text, letters, captions, subtitles, watermarks or logos anywhere in the image — the frame must be clean; on-screen text is added later in post.';
export function ghepPromptAnh(prompt: string, phongCach: string, nv: NhanVat[], kyThuatAnh = '', trangPhuc = ''): string {
  // Kỹ thuật điện ảnh của shot (cỡ cảnh, góc, ống kính, ánh sáng, màu — thư viện dien-anh.ts) đứng ngay sau phong cách.
  const dong = [phongCach ? `Visual style: ${phongCach}.` : '', kyThuatAnh ? `Cinematography: ${kyThuatAnh}.` : '', prompt.trim()];
  // DANH TÍNH ≠ TRANG PHỤC: người giữ y mặt/tóc/tuổi/dáng; quần áo theo shot nếu shot ghi trang phục. Trước đây "giữ ĐÚNG như mô tả"
  // khoá luôn bộ đồ trong mô tả anchor → shot khoe áo bra bị chồng lên áo thun (09/10/2026).
  const nguoi = nv.filter((v) => v.loai === 'nhan_vat');
  const vat = nv.filter((v) => v.loai !== 'nhan_vat');
  if (nguoi.length) {
    dong.push(trangPhuc.trim()
      ? `Keep the SAME person(s) as in the reference images — identical face, hair, age, skin and body type: ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. CLOTHING IN THIS SHOT overrides any clothing in that description: ${trangPhuc.trim()}. Do not add any other garment or outer layer that is not stated.`
      : `Keep these people EXACTLY as described (and as shown in the reference images): ${nguoi.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}. Do not redesign them.`);
  }
  if (vat.length) dong.push(`Keep these products / places / props EXACTLY as described and as in the reference images (same color, shape, details): ${vat.map((v) => `${v.ten} — ${v.mo_ta}`).join(' | ')}.`);
  // Chữ màn do xưởng tự vẽ lúc xuất (drawtext, đúng font) — model ảnh KHÔNG được tự vẽ phụ đề: Seedream bịa chữ giả "hử le œ hiút nốp dòos" lên keyframe (#1251).
  dong.push(KHONG_CHU);
  return dong.filter(Boolean).join(' ');
}

/** Sinh "ảnh mẫu" cho anchor từ mô tả (character sheet). Ảnh thêm vào anh_ref; các cảnh sau dùng nó làm tham chiếu. */
export async function sinhAnhGoc(db: Db, nhanVatId: number): Promise<KqSinh<number>> {
  const loi = (x: string): KqSinh<number> => ({ ok: false, loi: x });
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  if (!nv.mo_ta.trim()) return loi('anchor chưa có mô tả — tả ngoại hình/đặc tính trước rồi mới sinh ảnh mẫu');
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const job = await taoJob(db, { nhan: `Ảnh gốc · ${nv.ten}`, nhan_vat_id: nhanVatId, loai: 'anh', provider: 'google', model: kt.mo_hinh_anh, request: { prompt: promptAnhMau(nv, kt, nv.anh_ref.length) } });
  await dayViecAnh({ job, model: kt.mo_hinh_anh, prompt: promptAnhMau(nv, kt, nv.anh_ref.length), thamChieuUrl: nv.anh_ref.slice(0, 3), tiLe: nv.loai === 'boi_canh' ? kt.ti_le : '1:1', thuMuc: `anchor/${nhanVatId}` });
  return { ok: true, data: job };
}

/** Sinh keyframe: `so` ứng viên (1-3), nối vào keyframe_uv; cảnh chưa có ảnh chọn thì tự chọn ảnh đầu. */
export async function sinhKeyframeCanh(db: Db, canhId: number, so = 1, moHinh?: string): Promise<KqSinh<number[]>> {
  const loi = (x: string): KqSinh<number[]> => ({ ok: false, loi: x });
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  if (!bc.canh.prompt_anh.trim()) return loi('cảnh chưa có prompt ảnh');
  if (moHinh && (moHinh.startsWith('fal:') || MO_HINH_ANH.some((m) => m.key === moHinh))) bc.kt.mo_hinh_anh = moHinh as typeof bc.kt.mo_hinh_anh;
  await db.execute(sql`UPDATE xv_canh SET loi = '' WHERE id = ${canhId}`);
  const tp = thanhPhanCanh(bc.canh, bc.nhanVat);
  if (tp.thieu.length) return loi(`Chưa chuẩn bị đủ thành phần: ${tp.thieu.join('; ')}. Làm ở mục 2 (Tuyến nhân vật) rồi sinh lại.`);
  // Mỗi anchor: ảnh biến thể cảnh chọn (nếu đã sinh) đứng TRƯỚC, rồi ảnh gốc — model bám biến thể mà vẫn giữ danh tính.
  const btCanh = (v: NhanVat) => (v.bien_the ?? []).find((b) => bc.canh.bien_the.includes(b.id));
  const urlRef = bc.nhanVat.flatMap((v) => { const b = btCanh(v); return [...(b?.anh_url ? [b.anh_url] : []), ...v.anh_ref.slice(0, b?.anh_url ? 1 : 2)]; }).slice(0, 10);
  const ghiChuBt = bc.nhanVat.map((v) => { const b = btCanh(v); return b ? `${v.ten} in this shot: ${b.mo_ta || b.ten}.` : ''; }).filter(Boolean).join(' ');
  const prompt = [ghepPromptAnh(bc.canh.prompt_anh, bc.kt.phong_cach, bc.nhanVat, promptKyThuatAnh(bc.canh.ky_thuat), bc.canh.trang_phuc), ghiChuBt, promptCamXuc(bc.canh, bc.nhanVat, 'anh')].filter(Boolean).join(' ');
  const jobs: number[] = [];
  for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
    const job = await taoJob(db, { nhan: `Keyframe · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, thamChieu: urlRef.length } });
    jobs.push(job);
    await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${canhId}` });
  }
  return { ok: true, data: jobs };
}
