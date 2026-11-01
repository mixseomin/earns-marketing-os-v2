// CÁCH DỰNG "NỀN CỐ ĐỊNH + LỚP NHÂN VẬT" — hoạt hình truyền thống (anh 01/11/2026: "mỗi gag là 1 khung có nền cố định. Nhân vật là độc lập và cử
// động khác"; phim mẫu Englishman in New York). Trước đây mọi shot là MỘT ảnh rồi mô hình video vẽ lại CẢ KHUNG mỗi giây: phố đổi góc, tàu lệch ray,
// nhân vật / đồ biến mất (#1156 #6, 6 lượt thử). Ở đây:
//   · NỀN: một tấm cho mỗi (anchor bối cảnh × góc máy), dựng một lần từ ảnh thật, không người — mọi shot cùng chỗ cùng góc dùng chung, đứng yên.
//   · LỚP: nhân vật + vật của shot trên nền xanh phẳng (keyframe lớp → clip lớp); mô hình chỉ lo người cử động.
//   · GHÉP: chromakey + bóng đổ (từ chính dáng lớp) + overlay lên nền — lúc ảnh / clip về (hoan-tat.ts, sinh-video.ts), nên lưới, timeline, bản xuất
//     dùng ảnh / clip đã ghép như mọi shot khác.
// Thuần (client lẫn server). Phần chạy ffmpeg / sinh ảnh: dung-lop-may.ts. Tự kiểm: dung-lop.test.mts
import type { Canh, KinhThanh, NhanVat } from './kieu';
import { goiTheoKey } from './goi-the-loai';

export const MAU_XANH = '#00FF00';
/** Phim dựng theo lớp không: kinh thánh chọn tay, trống thì theo gói thể loại. */
export const laDungLop = (kt: Pick<KinhThanh, 'dung' | 'goi'>): boolean => kt.dung === 'lop' || (!kt.dung && goiTheoKey(kt.goi)?.dung === 'lop');

/** Góc máy của tấm nền — cỡ cảnh + góc (máy đứng yên: nền là ảnh tĩnh). */
const CO: Record<string, string> = { ews: 'extreme wide shot', ws: 'wide shot', mws: 'medium wide shot', ms: 'medium shot', mcu: 'medium close-up', cu: 'close-up', ecu: 'extreme close-up' };
const GOC: Record<string, string> = { thap: 'low-angle camera looking slightly up', cao: 'high-angle camera looking down', sat_dat: 'camera at ground level', ngang_goi: 'knee-level camera' };
export const mayNen = (kt: Canh['ky_thuat'] | null | undefined) => `${CO[kt?.co_canh ?? ''] ?? 'medium wide shot'}, ${GOC[kt?.goc ?? ''] ?? 'eye-level camera'}, locked-off`;
/** Khoá tấm nền: anchor bối cảnh + cỡ cảnh + góc. */
export const khoaNen = (boiCanhId: number, kt: Canh['ky_thuat'] | null | undefined) => `${boiCanhId}:${kt?.co_canh || 'mws'}:${kt?.goc || 'ngang'}`;
/** Anchor bối cảnh của shot (đầu tiên trong danh sách anchor của shot). */
export const boiCanhCua = <T extends Pick<NhanVat, 'id' | 'loai'>>(canh: Pick<Canh, 'nhan_vat'>, nv: T[]): T | null => nv.find((v) => v.loai === 'boi_canh' && canh.nhan_vat.includes(v.id)) ?? null;
/** Người + vật đi vào lớp (không phải bối cảnh), theo thứ tự anchor của shot. */
export const thanhPhanLop = <T extends Pick<NhanVat, 'id' | 'loai'>>(canh: Pick<Canh, 'nhan_vat'>, nv: T[]): T[] => canh.nhan_vat.map((id) => nv.find((v) => v.id === id)).filter((v): v is T => !!v && v.loai !== 'boi_canh');

/** Câu ĐỒ LUÔN MANG THEO cho mọi prompt có người đó (ảnh lẫn video). */
export const cauDoMang = (nv: Pick<NhanVat, 'ten' | 'loai' | 'do_mang'>[]): string =>
  nv.filter((v) => v.loai === 'nhan_vat' && (v.do_mang ?? '').trim()).map((v) => `${v.ten} always carries ${v.do_mang!.trim().replace(/[.\s]+$/, '')} — they stay with ${v.ten} in every frame, never vanish, drop off or change.`).join(' ');

/** Prompt TẤM NỀN: nơi chốn trống người, góc máy của shot, chừa đất cho nhân vật đi. */
export const promptNen = (style: string, boiCanh: string, kt: Canh['ky_thuat'] | null | undefined) =>
  `Visual style: ${style}. A single still background plate for a hand-drawn animated film (${mayNen(kt)}): ${boiCanh.trim().replace(/[.\s]+$/, '')}. The place is completely EMPTY — no people, no animals, no vehicles, nothing moving. Keep open ground in the lower third where characters will walk. No text, no letters, no signs.`;

/** BƯỚC 1 keyframe lớp — VẼ LÊN TẤM NỀN THẬT (anh 01/11/2026: "bước chân phải khớp với vật lý nền chứ?"): vẽ lớp trên nền xanh trống thì cỡ người, phối
 *  cảnh và dòng chân là đoán. Image 1 = tấm nền: người đứng trên mặt đất nhìn thấy, cỡ theo cửa / ray, nền giữ nguyên. */
export const promptLopTrenNen = (moTa: string, doMang: string, soRef: number) =>
  `EDIT Image 1 (the background plate of this shot). Paint into it ONLY these characters and props: ${moTa.trim().replace(/[.\s]+$/, '')}. ${doMang} Every foot stands on the visible ground of Image 1 with correct perspective, at a scale that matches the doors, windows and ground of Image 1, with a soft contact shadow under each foot. Keep every part of the background exactly as in Image 1 — same place, framing, light and colours; add nothing else.${soRef ? ` Image${soRef > 1 ? `s 2–${soRef + 1} show` : ' 2 shows'} the characters / props — keep their exact designs.` : ''}`;
/** BƯỚC 2 keyframe lớp — TÁCH LỚP từ ảnh bước 1: mọi thứ trừ nhân vật + vật thành xanh phẳng, nhân vật giữ nguyên chỗ / cỡ / dáng. */
export const PROMPT_TACH_LOP = `EDIT Image 1: replace EVERYTHING except the characters and the props they hold or act on with a flat pure chroma green (${MAU_XANH}), edge to edge — the street, buildings, sky, ground and every shadow become green. Keep the characters and props exactly as they are: same position, size, pose, colours and outline, nothing redrawn or moved; nothing green on them.`;
/** Prompt ẢNH LỚP (một bước, không tấm nền — dự phòng): chỉ nhân vật + vật của shot trên nền xanh phẳng, cùng góc máy với tấm nền. */
export const promptLop = (style: string, moTa: string, kt: Canh['ky_thuat'] | null | undefined, doMang: string, soRef: number) =>
  `Visual style: ${style} — characters and props only, as one animation cel. ${moTa.trim().replace(/[.\s]+$/, '')}. ${doMang} Full bodies visible, feet on an invisible ground line in the lower third, ${mayNen(kt)}, at the scale they would have in that shot. The entire background is a flat pure chroma green (${MAU_XANH}): no floor, no scenery, no shadows, no gradient; nothing green on the characters or props.${soRef ? ` Reference image${soRef > 1 ? `s 1–${soRef} show` : ' 1 shows'} the characters / props — keep their exact designs.` : ''}`;

/** Câu VIDEO của shot dựng lớp: nền xanh suốt clip, máy đứng yên (nền là ảnh tĩnh ghép sau). */
export const CAU_NEN_VIDEO_LOP = 'The background stays a perfectly flat pure chroma green for the whole clip — no floor, no scenery, no shadows ever appear behind the characters.';
export const CAU_MAY_VIDEO_LOP = 'Camera: static locked-off camera, no zoom, no pan (the background is composited later).';
export const CAU_SONG_VIDEO_LOP = 'The characters perform with clear, readable whole-body movement and never freeze.';
/** VẬT LÝ BƯỚC CHÂN trên tấm nền ghép sau: mức chân không đổi, chân chạm đất đứng yên tới khi nhấc, bước dài khớp quãng đi (không trượt / moonwalk). */
export const CAU_CHAN_VIDEO_LOP = 'Feet physics: everyone stays on the same ground line as in the first frame for the whole clip (no floating up, no sinking, unless a character visibly jumps); a foot that touches the ground stays planted at that spot until it lifts — no sliding or moonwalking; stride length matches how far the body moves forward.';
/** ĐO MỨC CHÂN (0đ): hàng thấp nhất có lớp (không xanh) theo từng khung, tỉ lệ chiều cao. Lệch so với khung đầu quá NGUONG_CHAN → báo. */
export const NGUONG_CHAN = 0.04;
export function soatChan(day: number[], nguong = NGUONG_CHAN): { lech: number; khung: number } | null {
  const goc = day[0]; if (goc == null) return null;
  let lech = 0, khung = -1; day.forEach((y, i) => { const d = Math.abs(y - goc); if (d > lech) { lech = d; khung = i; } });
  return lech > nguong ? { lech, khung } : null;
}

/** Bộ lọc ffmpeg GHÉP: [0] nền · [1] lớp nền xanh → chromakey (cùng số với cat-nen.ts: expand 0 giữ áo trắng không hoá hồng) + bóng đổ mềm (dáng lớp tô đen, lệch xuống phải, làm mờ) → overlay. */
export function locGhep(w: number, h: number, video: boolean): string {
  return [`[1:v]scale=${w}:${h},setsar=1,chromakey=0x00FF00:0.22:0.10,despill=type=green:mix=0.5:expand=0,format=rgba,split[l][s]`,
    `[s]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.32,boxblur=8:1[b]`,
    `[0:v]scale=${w}:${h},setsar=1,format=rgba[n]`,
    `[n][b]overlay=${Math.round(w * 0.008)}:${Math.round(h * 0.012)}${video ? ':shortest=1' : ''}[n2]`,
    `[n2][l]overlay=0:0${video ? ':shortest=1' : ''},format=yuv420p[v]`].join(';');
}
/** Cỡ khung ghép theo tỉ lệ phim. */
export const coGhep = (tiLe: string | undefined) => (tiLe === '16:9' ? [1280, 720] : tiLe === '1:1' ? [1024, 1024] : [720, 1280]) as [number, number];
/** Ảnh lớp nền xanh ứng với keyframe đang chọn (video đi từ ảnh này, không đi từ ảnh ghép). */
export const anhLopCua = (canh: Pick<Canh, 'keyframe_url' | 'lop'>): string | null => (canh.keyframe_url && canh.lop?.anh?.[canh.keyframe_url]) || null;
