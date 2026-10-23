// NGỮ PHÁP MÁY THEO NHỊP KỊCH (anh 17/10/2026, tập mẫu tổng tài: "điện ảnh hiện đại dùng kỹ thuật chạy camera khiến phim kịch tính hơn — mình đã có
// thư viện hay luật gì chưa"): thư viện 24 chuyển động máy (dien-anh.ts) + số đường máy (dien-anh-nganh.ts › may_di) đã có, nhưng CHỌN chuyển động
// nào ở khoảnh khắc nào thì chỉ có lời khuyên cho người xem ảo (luật "máy chuyển có động cơ"). Phim ngắn dọc (tổng tài / micro-drama) dùng máy
// theo công thức: sỉ nhục → cầm tay + nhìn xuống; quyền lực bước vào → góc thấp, máy dẫn trước; phán quyết → đẩy chậm vào mặt; cú sốc → zoom gắt
// / đổi tốc; hé lộ thân phận → dolly zoom / quay vòng; đối đầu → quay vòng; móc cuối tập → đẩy sát vào mặt rồi cắt đen.
// Máy ĐỌC nhịp của từng shot từ dữ liệu sẵn có (kế hoạch biểu cảm, mục đích thẻ shot, người đi trong shot, shot cuối tập) — không đoán chữ tự do.
// MỘT nguồn cho: cổng tiền kỳ (quy-trinh.ts › chanTienKy) và nút 🎥 sửa 0đ (hau-ky.ts › daDangMayTapDb). Thuần — tự kiểm: ngu-phap-may.test.mts
import type { KyThuatShot } from './dien-anh';
import type { BieuCamNv } from './qc-cam-xuc';

export const TIEN_TO_NGU_PHAP = 'ngữ pháp máy: ';
export type NhipKich = 'moc' | 'soc' | 'he_lo' | 'nhuc' | 'quyen_luc' | 'doi_dau' | 'phan_quyet';
/** may = chuyển động hợp nhịp (ưu tiên trước → sau, key thư viện dien-anh.ts); goc = góc máy nên đi kèm (chỉ gợi ý, không chặn). */
export const NGU_PHAP_MAY: Record<NhipKich, { ten: string; may: string[]; goc?: string[]; vi_sao: string }> = {
  moc: { ten: 'móc cuối tập', may: ['day_vao', 'zoom_cham'], vi_sao: 'cliffhanger: máy dồn vào mặt tới câu cuối rồi cắt đen — người xem bị kéo sang tập sau' },
  soc: { ten: 'cú sốc', may: ['zoom_gat', 'speed_ramp', 'dolly_zoom', 'cung'], vi_sao: 'cú đánh mặt bằng hình: zoom gắt / chậm hẳn khoảnh khắc đỉnh / hậu cảnh giãn ra / máy đi cung quanh người đang chết lặng (anh 18/10/2026 giữ cung cho #23 tổng tài)' },
  he_lo: { ten: 'hé lộ thân phận', may: ['dolly_zoom', 'vong', 'day_vao', 'nghieng_len', 'doi_net'], vi_sao: 'thế giới của nhân vật đảo chiều — dolly zoom / vòng quanh khoảnh khắc lộ diện; cận chi tiết thì lia dọc hoặc đổi nét (reveal shot)' },
  nhuc: { ten: 'bị sỉ nhục', may: ['cam_tay', 'day_vao'], goc: ['cao'], vi_sao: 'máy rung nhẹ + nhìn xuống: người xem đứng giữa đám đông, nóng mặt thay nhân vật' },
  quyen_luc: { ten: 'quyền lực bước vào', may: ['dan_truoc', 'day_vao', 'zoom_cham', 'theo', 'truot_ngang', 'vuot_tien_canh'], goc: ['thap'], vi_sao: 'góc thấp, máy dẫn trước / đẩy theo bước chân (đẩy máy hoặc zoom chậm tại chỗ — zoom giữ ghép nền ảnh kết đúng tuyệt đối, 23/10/2026 #132 #20) / trượt qua vai người ngồi lộ nhân vật ở cửa (anh 18/10/2026 giữ cho #17 tổng tài) — nhân vật chiếm không gian' },
  doi_dau: { ten: 'đối đầu', may: ['vong', 'day_vao'], vi_sao: 'máy vòng quanh hai người khi thế lực đảo — căng thẳng không đứng yên' },
  phan_quyet: { ten: 'phán quyết / nhận ra', may: ['day_vao', 'zoom_cham'], vi_sao: 'đẩy chậm vào mặt khi câu then chốt rơi xuống — cảm xúc dâng' },
};

const SOC = new Set(['soc']);
const NHUC = new Set(['nhuc_nha']);
const UY = new Set(['lanh_lung', 'quyet_tam', 'tu_tin']);
const GAY = new Set(['gian', 'khinh_bi', 'dac_y']);
const CHOT = new Set(['lanh_lung', 'nhech_moi', 'quyet_tam']);
const HE_LO = /(thân phận|lộ ra|hé lộ|lộ diện|người thừa kế|reveal|identity)/i;

export type ShotNguPhap = { id?: number; thu_tu: number; ky_thuat?: KyThuatShot | null; bieu_cam?: BieuCamNv[] | null; dan_dung?: { muc_dich?: string } | null;
  hanh_dong?: string; /** quãng đi dài nhất của một nhân vật trong shot (cm, vi_tri.tam → den) */ di_cm?: number; /** shot cuối của tập (móc) */ cuoi?: boolean };
/** Quãng đi đủ dài để máy dẫn trước / bám / trượt theo — ngắn hơn (lùi một bước vào thang máy) thì đẩy vào. */
export const DI_DAI_CM = 150;
/** Quãng đi dài nhất trong chỗ đứng 3D của shot. */
export const diCm = (vt?: { tam: number[]; den?: number[] }[] | null): number => Math.max(0, ...(vt ?? []).map((v) => (v.den ? Math.hypot(v.den[0]! - v.tam[0]!, v.den[1]! - v.tam[1]!) : 0)));

/** Nhịp kịch của một shot (null = shot thường, máy tự do theo luật nhịp hình). Thứ tự ưu tiên: móc → sốc → hé lộ → nhục → quyền lực → đối đầu → phán quyết. */
export function nhipKich(c: ShotNguPhap): NhipKich | null {
  const bc = c.bieu_cam ?? []; const co = c.ky_thuat?.co_canh ?? '';
  const cuoi = new Set(bc.map((b) => b.cuoi)); const moi = new Set(bc.flatMap((b) => [b.dau, b.cuoi]));
  if (c.cuoi) return 'moc';
  if ([...cuoi].some((x) => SOC.has(x))) return 'soc';
  if (HE_LO.test(`${c.dan_dung?.muc_dich ?? ''} ${c.hanh_dong ?? ''}`)) return 'he_lo';
  if ([...moi].some((x) => NHUC.has(x))) return 'nhuc';
  if ((c.di_cm ?? 0) > 0 && bc.some((b) => UY.has(b.cuoi))) return 'quyen_luc';
  if (bc.length >= 2 && (co === 'two' || co === 'ots') && bc.some((b) => GAY.has(b.cuoi))) return 'doi_dau';
  if ((co === 'cu' || co === 'mcu' || co === 'ecu') && bc.some((b) => CHOT.has(b.cuoi))) return 'phan_quyet';
  return null;
}

/** Bộ chuyển động hợp nhịp của MỘT shot: quyền lực đi ngắn bỏ các kiểu chạy theo quãng đi; đối đầu trong khung qua vai (một người) ưu tiên đẩy vào. */
export function mayHop(c: ShotNguPhap, n: NhipKich): string[] {
  const m = NGU_PHAP_MAY[n].may;
  if (n === 'quyen_luc' && (c.di_cm ?? 0) < DI_DAI_CM) return m.filter((x) => !['dan_truoc', 'theo', 'truot_ngang', 'vuot_tien_canh'].includes(x));
  if (n === 'doi_dau' && c.ky_thuat?.co_canh === 'ots') return ['day_vao', 'vong'];
  return m;
}
/** Lỗi ngữ pháp máy (chỉ phim ngắn dọc): shot có nhịp kịch mà chuyển động máy không thuộc bộ hợp nhịp. */
export function kiemNguPhapMay(ds: ShotNguPhap[], theLoai?: string): string[] {
  if (theLoai !== 'phim_doc') return [];
  const out: string[] = [];
  for (const c of ds) {
    const n = nhipKich(c); if (!n) continue;
    const l = NGU_PHAP_MAY[n]; const cd = c.ky_thuat?.chuyen_dong || 'tinh'; const hop = mayHop(c, n);
    if (!hop.includes(cd)) out.push(`${TIEN_TO_NGU_PHAP}#${c.thu_tu} là nhịp "${l.ten}" mà máy "${cd}" — dùng ${hop.join(' / ')} (${l.vi_sao}); sửa 0đ bằng 🎥`);
  }
  return out;
}

/** Sửa 0đ: shot phạm ngữ pháp → chuyển động hợp nhịp đầu tiên KHÔNG trùng shot trước / sau (giữ luật nhịp hình), kèm góc gợi ý khi shot chưa
 *  khai góc riêng ('ngang' hoặc trống). Trả { id, ky_thuat mới } cần ghi. */
export function apNguPhapMay<T extends ShotNguPhap & { id: number }>(ds: T[], theLoai?: string): { id: number; ky_thuat: KyThuatShot }[] {
  if (theLoai !== 'phim_doc') return [];
  const kt = ds.map((c) => ({ ...(c.ky_thuat ?? {}) }));
  const out: { id: number; ky_thuat: KyThuatShot }[] = [];
  ds.forEach((c, i) => {
    const n = nhipKich(c); if (!n) return;
    const l = NGU_PHAP_MAY[n]; const hop = mayHop(c, n); if (hop.includes(kt[i]!.chuyen_dong || 'tinh')) return;
    const giong = (x: string, j: number) => kt[j] && kt[j]!.co_canh === kt[i]!.co_canh && (kt[j]!.chuyen_dong || 'tinh') === x;
    kt[i]!.chuyen_dong = hop.find((x) => !giong(x, i - 1) && !giong(x, i + 1)) ?? hop[0]!;
    if (l.goc && (!kt[i]!.goc || kt[i]!.goc === 'ngang')) kt[i]!.goc = l.goc[0]!;
    out.push({ id: c.id, ky_thuat: kt[i]! });
  });
  return out;
}
