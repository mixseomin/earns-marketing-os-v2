// MURCH CHO QUẢNG CÁO (16/10/2026 — anh: "video ad nặng về cảm xúc phải khớp mới đúng"; "làm sao video sau không phải sinh đi sinh lại").
// Phim Jett #61 sinh lại 6/14 shot vì những lỗi chặn được TRƯỚC khi tiêu tiền video. Bốn tầng, thuần (không DB / model):
//   1. KẾ HOẠCH BIỂU CẢM: mỗi shot ghi nét mặt từng nhân vật lúc ĐẦU → CUỐI (+ cấm). Hai shot liền nhau cùng nhân vật cùng nơi: đầu shot sau
//      = cuối shot trước, trừ shot khai là cú lật (`lat`) — #1 nhăn đau → #2 cười.
//   2. PROMPT: biểu cảm đi vào prompt keyframe (= nét ĐẦU) và video (đầu → cuối, "never …") — #2 chỉ ghi "smile" nên Kling cười sớm, cười to.
//   3. SOÁT THẬT (Claude trong phiên, 0đ): keyframe và clip được soát theo bảng cố định (số người, người lạ, mặt bị cắt, sản phẩm, hành động,
//      nét mặt đầu/cuối) — chưa soát / soát trượt thì chặn sinh video / chặn xuất. Điểm Murch phần cảm xúc dùng số đo này (diem-murch.ts).
//   4. MÁY CHỌN TRƯỚC: có trẻ em trong khung → không gửi Veo (Google từ chối ảnh có trẻ em thật) mà gửi Kling; cận cảnh + động tác lớn
//      (nhảy, xoay, chạy) → chặn (#12 chân biến dạng); shot nối liền → khung đầu lấy khung cuối clip shot trước (sinh-video.ts).
// Tự kiểm: qc-cam-xuc.test.mts
import type { Canh, NhanVat } from './kieu';

/** Bộ từ biểu cảm (đóng) — để máy so được đầu/cuối. en = câu đưa vào prompt; am = nét tiêu cực (tự cấm cười). */
export const BIEU_CAM = [
  { key: 'binh_thuong', ten: 'Bình thường', en: 'a neutral, relaxed face', am: false },
  { key: 'hao_huc', ten: 'Háo hức', en: 'an eager, bright, excited face', am: false },
  { key: 'vui', ten: 'Vui, cười', en: 'a warm, genuine smile', am: false },
  { key: 'cuoi_lon', ten: 'Cười to', en: 'laughing out loud, joyful', am: false },
  { key: 'am_ap', ten: 'Ấm áp', en: 'a soft, warm, loving look', am: false },
  { key: 'nhe_nhom', ten: 'Nhẹ nhõm', en: 'visible relief, shoulders dropping, a small relieved breath', am: false },
  { key: 'bat_ngo', ten: 'Bất ngờ', en: 'pleasantly surprised, eyebrows raised', am: false },
  { key: 'ngo_vuc', ten: 'Ngờ vực', en: 'skeptical, one eyebrow raised, unconvinced', am: false },
  { key: 'tu_tin', ten: 'Tự tin', en: 'confident and at ease', am: false },
  { key: 'lo_lang', ten: 'Lo lắng', en: 'worried, brows knitted', am: true },
  { key: 'dau', ten: 'Nhăn đau', en: 'wincing in discomfort, brows pinched, jaw tight', am: true },
  { key: 'met', ten: 'Mệt, gượng', en: 'tired and strained, a forced polite face with no real smile', am: true },
  { key: 'buon', ten: 'Buồn', en: 'quietly sad, eyes lowered', am: true },
  { key: 'that_vong', ten: 'Thất vọng', en: 'defeated, a heavy sigh', am: true },
] as const;
export type MaBieuCam = (typeof BIEU_CAM)[number]['key'];
export const bieuCam = (k: string) => BIEU_CAM.find((x) => x.key === k);
/** Một nhân vật trong một shot: nét đầu → cuối; cam = nét CẤM xuất hiện; lat = shot này là cú lật (được đổi so với shot trước). */
export type BieuCamNv = { nv: string; dau: MaBieuCam; cuoi: MaBieuCam; cam?: MaBieuCam[]; lat?: boolean };

/** Nét cấm thực dùng: khai tay + tự cấm cười khi cả đầu lẫn cuối là nét tiêu cực (một người đang đau không được cười giữa chừng). */
export function camThuc(b: BieuCamNv): MaBieuCam[] {
  const tu = bieuCam(b.dau)?.am && bieuCam(b.cuoi)?.am ? (['vui', 'cuoi_lon'] as MaBieuCam[]) : [];
  return [...new Set([...(b.cam ?? []), ...tu])].filter((k) => k !== b.dau && k !== b.cuoi);
}

/** Câu biểu cảm cho prompt. anh = keyframe (nét ĐẦU); video = đầu → cuối + cấm. */
export function promptBieuCam(ds: BieuCamNv[] | undefined, loai: 'anh' | 'video'): string {
  const ok = (ds ?? []).filter((b) => bieuCam(b.dau) && bieuCam(b.cuoi));
  if (!ok.length) return '';
  return ok.map((b) => {
    const cam = camThuc(b).map((k) => bieuCam(k)!.en);
    if (loai === 'anh') return `EXPRESSION of ${b.nv}: ${bieuCam(b.dau)!.en}.`;
    const doi = b.dau === b.cuoi ? `keeps ${bieuCam(b.dau)!.en} the whole shot` : `starts with ${bieuCam(b.dau)!.en} and only gradually ends with ${bieuCam(b.cuoi)!.en}`;
    return `EXPRESSION of ${b.nv}: ${doi}${cam.length ? `; never ${cam.join(', never ')}` : ''}.`;
  }).join(' ');
}

type ShotBc = Pick<Canh, 'id' | 'thu_tu' | 'nhan_vat'> & { bieu_cam?: BieuCamNv[] | null; nhanh?: string };
type Nv = Pick<NhanVat, 'id' | 'ten' | 'loai'>;
/** Lỗi liền mạch biểu cảm theo shot (id → câu). Hai shot LIỀN NHAU cùng bối cảnh: nhân vật có mặt ở cả hai thì nét đầu shot sau phải là nét
 *  cuối shot trước, trừ khi shot sau khai `lat`. Bối cảnh = anchor loai 'boi_canh' gắn vào shot. */
export function loiMachBieuCam(ds: ShotBc[], nhanVat: Nv[]): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  const bc = (c: ShotBc) => c.nhan_vat.filter((id) => nhanVat.find((v) => v.id === id)?.loai === 'boi_canh').sort().join(',');
  for (let i = 1; i < ds.length; i++) {
    const a = ds[i - 1]!, c = ds[i]!;
    if (!bc(a) || bc(a) !== bc(c)) continue;
    for (const b of c.bieu_cam ?? []) {
      const t = (a.bieu_cam ?? []).find((x) => x.nv === b.nv);
      if (!t || b.lat || t.cuoi === b.dau) continue;
      (out[c.id] ??= []).push(`LIỀN MẠCH BIỂU CẢM: ${b.nv} cuối shot #${a.thu_tu} là "${bieuCam(t.cuoi)?.ten ?? t.cuoi}" mà đầu shot #${c.thu_tu} là "${bieuCam(b.dau)?.ten ?? b.dau}" — cùng nơi, liền nhau: đổi nét đầu cho khớp, hoặc khai shot #${c.thu_tu} là cú lật`);
    }
  }
  return out;
}

/** Nhân vật trong shot cần kế hoạch biểu cảm: mọi anchor người gắn vào shot. Thiếu → tên còn thiếu. */
export function thieuBieuCam(c: ShotBc, nhanVat: Nv[]): string[] {
  const nguoi = nhanVat.filter((v) => v.loai === 'nhan_vat' && c.nhan_vat.includes(v.id)).map((v) => v.ten);
  return nguoi.filter((t) => !(c.bieu_cam ?? []).some((b) => b.nv === t && bieuCam(b.dau) && bieuCam(b.cuoi)));
}

/** Trẻ em theo mô tả anchor (tuổi < 13 hoặc từ chỉ trẻ em). */
export function laTreEm(moTa: string): boolean {
  if (/\b(girl|boy|child|kid|toddler|baby|infant|schoolgirl|schoolboy)\b/i.test(moTa)) return true;
  const m = /\b(\d{1,2})\s*(?:years?[- ]old|yrs? old|yo|y\/o)\b/i.exec(moTa) ?? /^[^,]{0,40}\b(?:man|woman|person|american|asian|european|african|latina?|latino),\s*(\d{1,2})\b/i.exec(moTa);
  return !!m && Number(m[1]) < 13;
}
/** Model video theo NỘI DUNG shot: Google Veo từ chối mọi ảnh đầu vào có trẻ em trông như thật (Jett #61 shot 1/2/11, 16/10/2026) → đổi sang
 *  Kling (fal) TRƯỚC khi gửi, không để job hỏng. Trả model mới + lý do, hoặc null nếu giữ nguyên. */
export const MODEL_CO_TRE_EM = 'fal:fal-ai/kling-video/v3/pro/image-to-video';
export function doiModelVideo(model: string, nguoiTrongShot: Pick<NhanVat, 'ten' | 'mo_ta'>[]): { model: string; ly_do: string } | null {
  const laGoogle = /^(google:)?veo/i.test(model) || /^shopaikey:veo/i.test(model);
  const tre = nguoiTrongShot.filter((v) => laTreEm(v.mo_ta));
  if (!laGoogle || !tre.length) return null;
  return { model: MODEL_CO_TRE_EM, ly_do: `shot có trẻ em (${tre.map((v) => v.ten).join(', ')}) — Veo từ chối ảnh có trẻ em, tự sang Kling` };
}

/** Cận cảnh + động tác lớn của thân người → model vẽ méo chân / tay / thân (#12: cận đầu gối khi đang nhảy → chân phình biến dạng). */
const CO_CAN = new Set(['ecu', 'cu', 'insert', 'mcu']);
export const DONG_LON = /\b(danc(e|es|ing)|jump(s|ing)?|spin(s|ning)?|twirl(s|ing)?|run(s|ning)?|kick(s|ing)?|leap(s|ing)?|swing(s|ing)?|squat(s|ting)? (down|deep)|lunge(s|ing)?)\b/i;
export function loiCanCanhDongLon(c: Pick<Canh, 'hanh_dong'> & { prompt_video?: string; ky_thuat?: { co_canh?: string } | null }): string | null {
  const co = c.ky_thuat?.co_canh ?? '';
  const hd = (c.prompt_video ?? '').trim() || c.hanh_dong;
  if (!CO_CAN.has(co)) return null;
  const m = hd.match(DONG_LON);
  return m ? `cận cảnh (${co}) mà động tác lớn ("${m[0]}") — model vẽ méo thân / chân (Jett #61 shot 12); cận thì động tác nhỏ (tay chạm, vải giãn, nét mặt), động tác lớn để ở cảnh trung / rộng` : null;
}

// ── SOÁT THẬT (Claude trong phiên, 0đ) ─────────────────────────────────────────────────────────────────────────────────────────
/** Bảng soát cố định. Keyframe: so_nguoi … hanh_dong + nét đầu. Clip: thêm nét đầu / cuối đo được, sản phẩm giữ, biến dạng. */
export const MUC_SOAT = [
  { key: 'so_nguoi', ten: 'Đúng số người, không người trùng' },
  { key: 'nguoi_la', ten: 'Không người lạ / tay lạ' },
  { key: 'mat', ten: 'Mặt không bị khung cắt, không méo' },
  { key: 'san_pham', ten: 'Sản phẩm đúng màu, dáng, chi tiết' },
  { key: 'hanh_dong', ten: 'Đúng hành động của shot' },
  { key: 'bieu_cam', ten: 'Nét mặt đúng kế hoạch' },
  { key: 'bien_dang', ten: 'Không biến dạng thân / vật (clip)' },
] as const;
export type KqSoat = { url: string; luc: string; nguoi: string; dat: boolean; loi: string[]; /** nét đo được (clip): đầu / cuối */ do?: { dau?: string; cuoi?: string } };
export type SoatShot = { keyframe?: KqSoat; clip?: KqSoat };
/** Soát còn hiệu lực cho đúng ảnh / clip đang dùng. */
export const soatKeyframe = (c: Pick<Canh, 'keyframe_url'> & { soat?: SoatShot | null }): KqSoat | null => (c.keyframe_url && c.soat?.keyframe?.url === c.keyframe_url ? c.soat.keyframe : null);
export const soatClip = (c: Pick<Canh, 'video_url' | 'video_cuoi_url'> & { soat?: SoatShot | null }): KqSoat | null => { const u = c.video_cuoi_url || c.video_url; return u && c.soat?.clip?.url === u ? c.soat.clip : null; };
/** Điểm cảm xúc ĐO ĐƯỢC (0…1) cho Murch: clip đã soát thì theo clip, không thì theo keyframe; chưa soát → null (Murch giữ ước lượng). */
export function camXucDo(c: Pick<Canh, 'keyframe_url' | 'video_url' | 'video_cuoi_url'> & { soat?: SoatShot | null }): { diem: number; ly_do: string } | null {
  const k = soatClip(c) ?? soatKeyframe(c);
  if (!k) return null;
  const lech = k.loi.filter((x) => /nét mặt|biểu cảm|expression/i.test(x));
  return k.dat && !lech.length ? { diem: 1, ly_do: '' } : { diem: lech.length ? 0 : 0.5, ly_do: `soát ${soatClip(c) ? 'clip' : 'keyframe'}: ${k.loi.join(' · ') || 'chưa đạt'}` };
}
