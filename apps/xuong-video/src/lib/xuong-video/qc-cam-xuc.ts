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
import { cauVideo, type Canh, type KinhThanh, type NhanVat } from './kieu';

/** BẬT KẾ HOẠCH CẢM XÚC (biểu cảm đầu → cuối, soát keyframe / clip): quảng cáo có cờ cam_xuc_qc, HOẶC phim ngắn dọc (tổng tài — sống nhờ nét mặt,
 *  anh 17/10/2026). MỘT chỗ quyết — trước đây 3 nơi tự viết `loai === 'quang_cao' && cam_xuc_qc`. */
export const batCamXuc = (loai: string, kt: Pick<KinhThanh, 'cam_xuc_qc' | 'the_loai'> | null | undefined): boolean => (loai === 'quang_cao' && !!kt?.cam_xuc_qc) || kt?.the_loai === 'phim_doc';

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
  // Nét KỊCH (phim ngắn dọc / tổng tài, 17/10/2026): bất công → nhẫn nhịn → đánh mặt cần các nét này, bộ QC không có.
  { key: 'lanh_lung', ten: 'Lạnh lùng', en: 'cold and expressionless, piercing stare, jaw set', am: false },
  { key: 'khinh_bi', ten: 'Khinh bỉ', en: 'contemptuous: a thin cold smirk with one corner of the mouth raised, relaxed brows, chin raised, looking down the nose — never frowning, worried or upset', am: true },   // 19/10/2026 #1: chỉ 'contemptuous, chin raised' → Veo vẽ Vivian cau mày lo âu
  { key: 'dac_y', ten: 'Đắc ý', en: 'smug and triumphant, a self-satisfied half smile', am: false },
  { key: 'nhuc_nha', ten: 'Nhục nhã', en: 'humiliated, cheeks flushed, eyes glistening but holding back tears', am: true },
  { key: 'nhan_nhin', ten: 'Nhẫn nhịn', en: 'composed restraint, calm face hiding anger, steady breathing', am: false },
  { key: 'gian', ten: 'Giận', en: 'angry, brows lowered, lips pressed thin', am: true },
  { key: 'soc', ten: 'Sốc', en: 'stunned, eyes wide, mouth slightly open, frozen', am: true },
  { key: 'quyet_tam', ten: 'Quyết tâm', en: 'resolute and fearless, steady eye contact', am: false },
  { key: 'nhech_moi', ten: 'Nhếch môi', en: 'a subtle knowing smirk at one corner of the mouth', am: false },
  // CẢM XÚC MẠNH (anh 18/10/2026: "phải diễn được khóc thảm thiết, cười trong đau đớn tột cùng mới đi vào cảm xúc người xem") — mặt 3D MPFB diễn
  // đúng nét (mesh/nguoi.py › BIEU_CAM_ARKIT), chữ tả cơ mặt + nước mắt cụ thể (FLUX ra cau mày khi chỉ ghi "crying")
  { key: 'khoc_tham', ten: 'Khóc thảm thiết', en: 'sobbing uncontrollably, face crumpled, mouth open in a wail, tears streaming down both cheeks, red swollen eyes', am: true },
  { key: 'cuoi_dau', ten: 'Cười trong đau', en: 'a broken laugh through tears, eyes squeezed shut, brows knitted in pain, tears running down', am: true },
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

/** LƯỢT NƯỚC MẮT (anh 18/10/2026 duyệt): FLUX độ sâu + LoRA diễn được nét mặt khóc nhưng KHÔNG vẽ nước mắt (đo 18/10: 10/10 ảnh khóc khô) — ngành thêm
 *  nước mắt ở hậu kỳ, không trông vào cảnh quay gốc. Nét nào cần nước mắt → câu sửa ảnh (Nano Banana) cho keyframe; rỗng = không cần lượt này. */
export const NUOC_MAT: Partial<Record<MaBieuCam, string>> = {
  khoc_tham: 'heavy tears streaming down both cheeks, wet shining tear tracks to the chin, red swollen eyelids, wet lashes',
  cuoi_dau: 'tears running down both cheeks from the squeezed-shut eyes, wet shining tear tracks, reddened eyes',
  nhuc_nha: 'eyes brimming with welled-up tears that have not fallen yet, glistening wet lower lids, slightly reddened eyes',
};
export function cauNuocMat(ds: BieuCamNv[] | null | undefined): string {
  const co = (ds ?? []).filter((b) => NUOC_MAT[b.dau]);
  return co.length ? `ADD TEARS: ${co.map((b) => `${b.nv}: ${NUOC_MAT[b.dau]}`).join('; ')}. Photoreal liquid tears with natural highlights.` : '';
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

/** Câu hành động TRÁI kế hoạch biểu cảm: kế hoạch cấm cười (đang đau / mệt) mà prompt vẫn bảo "smile / laugh / grin" — hai lệnh ngược nhau
 *  trong cùng một prompt thì model nghe câu hành động (Jett #61 #2: "a small apologetic smile" + EXPRESSION "never a smile" → Frank cười 2 lượt Kling).
 *  Câu có tên một người được phép cười thì không xét (cười là của người đó). null = sạch. */
export const TU_CUOI = /\b(smil(e|es|ed|ing)|grin(s|ned|ning)?|laugh(s|ed|ing|ter)?|beam(s|ed|ing)|chuckl(e|es|ed|ing)|giggl(e|es|ed|ing))\b/i;
export function loiCauTraiBieuCam(cau: string, ds: BieuCamNv[] | undefined): string | null {
  const plan = (ds ?? []).filter((b) => bieuCam(b.dau) && bieuCam(b.cuoi));
  const cam = plan.filter((b) => camThuc(b).some((k) => k === 'vui' || k === 'cuoi_lon')).map((b) => b.nv);
  if (!cam.length) return null;
  const duoc = plan.filter((b) => !cam.includes(b.nv)).map((b) => b.nv.toLowerCase());
  const sai = cau.split(/(?<=[.;!?])\s+/).filter((x) => TU_CUOI.test(x) && !new RegExp(`\\b(no|never|not|without|nor)\\b(\\s+\\w+){0,3}\\s+${TU_CUOI.source}`, 'i').test(x) && !duoc.some((t) => x.toLowerCase().includes(t)));
  return sai.length ? `câu hành động bảo cười ("${sai[0]!.match(TU_CUOI)![0]}") mà kế hoạch biểu cảm cấm cười (${cam.join(', ')}) — model nghe câu hành động, sửa câu (hoặc ghi rõ tên người được cười)` : null;
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
const HAU_CANH = /\b(behind|background|in the distance|blur(s|red|ry)?|guests?|crowd|others|people around|out of focus)\b/i;
export function loiCanCanhDongLon(c: Pick<Canh, 'hanh_dong'> & { prompt_video?: string; ky_thuat?: { co_canh?: string } | null }): string | null {
  const co = c.ky_thuat?.co_canh ?? '';
  const hd = cauVideo(c);
  if (!CO_CAN.has(co)) return null;
  // Vế câu tả HẬU CẢNH / người khác ("the dancing blurs behind") không phải động tác của chủ thể cận cảnh — Jett #61 #4 bị chặn nhầm 16/10/2026.
  const m = hd.split(/[.;,]|\bwhile\b|\bas\b/i).filter((v) => !HAU_CANH.test(v)).join(' ').match(DONG_LON);
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
  { key: 'vat_ly', ten: 'Vật lý thật: chất lỏng / đồ rơi theo trọng lực, không bay ngược (clip)' },   // 19/10/2026 #1 cà phê vọt lên trời
  { key: 'noi_canh', ten: 'Trạng thái cuối nối shot sau: vết, đồ cầm, chỗ đứng (clip)' },
] as const;
export type KqSoat = { url: string; luc: string; nguoi: string; dat: boolean; loi: string[]; /** có = kết quả của MÁY (soatClip đổi từ soat.may) — mức đạt / cần mắt / trượt */ may?: KqMay['ket']; /** nét đo được (clip): đầu / cuối */ do?: { dau?: string; cuoi?: string } };
/** may = MÁY TỰ CHẤM clip (cham-may.ts, 0đ) — người soát (clip) luôn thắng máy; máy "cần mắt" = chưa đạt cho tới khi người soát. */
export type KqMay = { url: string; luc: string; ket: 'dat' | 'can_mat' | 'truot'; loi: string[] };
export type SoatShot = { keyframe?: KqSoat; clip?: KqSoat; may?: KqMay };
/** Soát còn hiệu lực cho đúng ảnh / clip đang dùng. */
export const soatKeyframe = (c: Pick<Canh, 'keyframe_url'> & { soat?: SoatShot | null }): KqSoat | null => (c.keyframe_url && c.soat?.keyframe?.url === c.keyframe_url ? c.soat.keyframe : null);
export const soatClip = (c: Pick<Canh, 'video_url' | 'video_cuoi_url'> & { soat?: SoatShot | null }): KqSoat | null => {
  const u = c.video_cuoi_url || c.video_url;
  if (!u) return null;
  if (c.soat?.clip?.url === u) return c.soat.clip;
  const m = c.soat?.may;
  return m?.url === u ? { url: u, luc: m.luc, nguoi: 'máy (HSEmotion)', may: m.ket, dat: m.ket === 'dat', loi: m.ket === 'can_mat' ? m.loi.map((x) => `cần mắt — ${x}`) : m.loi } : null;
};

/** Kết quả MÁY cho đúng clip đang dùng — hiện RIÊNG (chip 🤖), kể cả khi người đã soát: người thắng máy ở cổng, nhưng anh vẫn phải thấy máy nói gì. */
export const mayClip = (c: Pick<Canh, 'video_url' | 'video_cuoi_url'> & { soat?: SoatShot | null }): KqMay | null => { const u = c.video_cuoi_url || c.video_url; return u && c.soat?.may?.url === u ? c.soat.may : null; };
export const KY_MAY: Record<KqMay['ket'], { ky: string; mau: string; ten: string }> = {
  dat: { ky: '✓', mau: '#4ade80', ten: 'đạt' }, can_mat: { ky: '◐', mau: '#fbbf24', ten: 'cần mắt' }, truot: { ky: '✗', mau: '#f87171', ten: 'trượt' },
};

// ── MÁY TỰ CHẤM CLIP (0đ) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Số đo từ scripts/do-cam-xuc.py (mặt YuNet → người SFace theo ảnh mẫu → valence HSEmotion). Đo thật trên Jett #61 (16/10/2026): xác suất
// từng lớp cảm xúc dàn đều (cao nhất ~0.38) nên KHÔNG xét theo lớp; VALENCE (âm −1 ↔ dương +1) mới tách rõ: nhăn đau −0.6…−0.9, cười +0.6…+0.9.
// Grok #2 cũ (Frank cười khi đang đau) +0.68 ở khung đầu, khung đầu lệch cuối #1 tới 54.8; Kling #2 đạt lệch 2.8.
export type MatDo = { ten: string | null; sim: number; sims?: Record<string, number>; w: number; val: number };
export type DoClip = { dai: number; khung: { t: number; mat: MatDo[] }[]; noi?: { lech: number } };
const DUONG = new Set<string>(['hao_huc', 'vui', 'cuoi_lon', 'am_ap', 'nhe_nhom', 'tu_tin']);
export const NGUONG_MAY = { nguoiChac: 0.3, nguoiDoan: 0.15, matDoan: 80, cuoi: 0.5, am: -0.4, noiTruot: 20, noiMat: 10 } as const;
const trungVi = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]!; };
const dau2 = (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(2)}`;

/** Gán mặt → nhân vật theo khung: nhận chắc (sim ≥ 0.3) trước; nhân vật chưa có mặt thì đoán mặt to (≥ 80px) giống nhất (sim ≥ 0.15) — đoán = "chưa chắc". */
function chuoiNv(d: DoClip, ten: string[]): Record<string, { t: number; val: number; chac: boolean }[]> {
  const out: Record<string, { t: number; val: number; chac: boolean }[]> = Object.fromEntries(ten.map((t) => [t, []]));
  for (const k of d.khung) {
    const dung = new Set<number>();
    for (const t of ten) { const i = k.mat.findIndex((m, j) => !dung.has(j) && m.ten === t && m.sim >= NGUONG_MAY.nguoiChac); if (i >= 0) { dung.add(i); out[t]!.push({ t: k.t, val: k.mat[i]!.val, chac: true }); } }
    for (const t of ten) {
      if (out[t]!.some((x) => x.t === k.t)) continue;
      let tot = -1, sim: number = NGUONG_MAY.nguoiDoan;
      k.mat.forEach((m, j) => { const s = m.sims?.[t] ?? (m.ten === t ? m.sim : -1); if (!dung.has(j) && m.w >= NGUONG_MAY.matDoan && s >= sim) { tot = j; sim = s; } });
      if (tot >= 0) { dung.add(tot); out[t]!.push({ t: k.t, val: k.mat[tot]!.val, chac: false }); }
    }
  }
  return out;
}

/** Xét số đo với kế hoạch biểu cảm: cấm cười mà đo ra cười · nét đầu / cuối ngược dấu kế hoạch · shot nối liền mà khung đầu lệch cuối shot trước.
 *  Bằng chứng từ mặt nhận CHẮC → trượt; từ mặt đoán → cần mắt (người xem quyết). Nét trung tính (bất ngờ, ngờ vực, bình thường) không xét dấu. */
export function chamMay(d: DoClip, ds: BieuCamNv[] | undefined, o: { phat?: number | null; noiLien?: boolean }): { ket: KqMay['ket']; loi: string[] } {
  const plan = (ds ?? []).filter((b) => bieuCam(b.dau) && bieuCam(b.cuoi));
  const phat = o.phat || d.dai || 4;
  const truot: string[] = [], mat: string[] = [];
  const ghi = (chac: boolean, x: string) => (chac ? truot : mat).push(chac ? x : `${x} (máy chưa chắc mặt là ai)`);
  const chuoi = chuoiNv(d, plan.map((b) => b.nv));
  const dau = (k: string) => (bieuCam(k)?.am ? -1 : DUONG.has(k) ? 1 : 0);
  for (const b of plan) {
    const ch = chuoi[b.nv] ?? [];
    if (!ch.length) continue;
    if (camThuc(b).some((k) => k === 'vui' || k === 'cuoi_lon')) {
      const c = ch.filter((x) => x.val >= NGUONG_MAY.cuoi);
      if (c.filter((x) => x.chac).length >= 2) truot.push(`nét mặt: ${b.nv} cười (${dau2(Math.max(...c.map((x) => x.val)))}) ở ${c[0]!.t}s–${c[c.length - 1]!.t}s mà kế hoạch cấm cười`);
      else if (c.length) mat.push(`${b.nv} có vẻ cười (${dau2(Math.max(...c.map((x) => x.val)))}) ở ${c[0]!.t}s–${c[c.length - 1]!.t}s`);
    }
    for (const [ma, cua, nhan] of [[b.dau, ch.filter((x) => x.t <= Math.max(0.6, phat * 0.25)), 'đầu'], [b.cuoi, ch.filter((x) => x.t >= phat * 0.6), 'cuối']] as const) {
      const s = dau(ma); if (!s || !cua.length) continue;
      const v = trungVi(cua.map((x) => x.val));
      if (s < 0 ? v >= NGUONG_MAY.cuoi : v <= NGUONG_MAY.am) ghi(cua.some((x) => x.chac), `nét mặt: ${b.nv} ${nhan} shot đo ${dau2(v)} mà kế hoạch là ${bieuCam(ma)!.ten}`);
    }
  }
  if (o.noiLien && d.noi) {
    if (d.noi.lech > NGUONG_MAY.noiTruot) truot.push(`liền mạch: khung đầu lệch khung cuối shot trước ${d.noi.lech} (nối liền phải gần 0)`);
    else if (d.noi.lech > NGUONG_MAY.noiMat) mat.push(`khung đầu hơi lệch cuối shot trước (${d.noi.lech})`);
  }
  const trung = (a: string[]) => [...new Set(a)];
  return truot.length ? { ket: 'truot', loi: trung([...truot, ...mat]) } : mat.length ? { ket: 'can_mat', loi: trung(mat) } : { ket: 'dat', loi: [] };
}
/** Điểm cảm xúc ĐO ĐƯỢC (0…1) cho Murch: clip đã soát thì theo clip, không thì theo keyframe; chưa soát → null (Murch giữ ước lượng). */
export function camXucDo(c: Pick<Canh, 'keyframe_url' | 'video_url' | 'video_cuoi_url'> & { soat?: SoatShot | null }): { diem: number; ly_do: string } | null {
  const k = soatClip(c) ?? soatKeyframe(c);
  if (!k) return null;
  const lech = k.loi.filter((x) => /nét mặt|biểu cảm|expression/i.test(x));
  return k.dat && !lech.length ? { diem: 1, ly_do: '' } : { diem: lech.length ? 0 : 0.5, ly_do: `soát ${soatClip(c) ? 'clip' : 'keyframe'}: ${k.loi.join(' · ') || 'chưa đạt'}` };
}
