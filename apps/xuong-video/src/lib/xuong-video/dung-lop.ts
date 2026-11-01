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
export const mayNen = (kt: Canh['ky_thuat']) => `${CO[kt?.co_canh ?? ''] ?? 'medium wide shot'}, ${GOC[kt?.goc ?? ''] ?? 'eye-level camera'}, locked-off`;
/** Khoá tấm nền: anchor bối cảnh + cỡ cảnh + góc. */
export const khoaNen = (boiCanhId: number, kt: Canh['ky_thuat']) => `${boiCanhId}:${kt?.co_canh || 'mws'}:${kt?.goc || 'ngang'}`;
/** Anchor bối cảnh của shot (đầu tiên trong danh sách anchor của shot). */
export const boiCanhCua = <T extends Pick<NhanVat, 'id' | 'loai'>>(canh: Pick<Canh, 'nhan_vat'>, nv: T[]): T | null => nv.find((v) => v.loai === 'boi_canh' && canh.nhan_vat.includes(v.id)) ?? null;
/** Người + vật đi vào lớp (không phải bối cảnh), theo thứ tự anchor của shot. */
export const thanhPhanLop = <T extends Pick<NhanVat, 'id' | 'loai'>>(canh: Pick<Canh, 'nhan_vat'>, nv: T[]): T[] => canh.nhan_vat.map((id) => nv.find((v) => v.id === id)).filter((v): v is T => !!v && v.loai !== 'boi_canh');

/** Câu ĐỒ LUÔN MANG THEO cho mọi prompt có người đó (ảnh lẫn video). */
export const cauDoMang = (nv: Pick<NhanVat, 'ten' | 'loai' | 'do_mang'>[]): string =>
  nv.filter((v) => v.loai === 'nhan_vat' && (v.do_mang ?? '').trim()).map((v) => `${v.ten} always carries ${v.do_mang!.trim().replace(/[.\s]+$/, '')} — they stay with ${v.ten} in every frame, never vanish, drop off or change.`).join(' ');

/** Prompt TẤM NỀN: nơi chốn trống người, góc máy của shot, chừa đất cho nhân vật đi. */
export const promptNen = (style: string, boiCanh: string, kt: Canh['ky_thuat']) =>
  `Visual style: ${style}. A single still background plate for a hand-drawn animated film (${mayNen(kt)}): ${boiCanh.trim().replace(/[.\s]+$/, '')}. The place is completely EMPTY — no people, no animals, no vehicles, nothing moving. Keep open ground in the lower third where characters will walk. No text, no letters, no signs.`;

/** Prompt ẢNH LỚP: chỉ nhân vật + vật của shot trên nền xanh phẳng, cùng góc máy với tấm nền. */
export const promptLop = (style: string, moTa: string, kt: Canh['ky_thuat'], doMang: string, soRef: number) =>
  `Visual style: ${style} — characters and props only, as one animation cel. ${moTa.trim().replace(/[.\s]+$/, '')}. ${doMang} Full bodies visible, feet on an invisible ground line in the lower third, ${mayNen(kt)}, at the scale they would have in that shot. The entire background is a flat pure chroma green (${MAU_XANH}): no floor, no scenery, no shadows, no gradient; nothing green on the characters or props.${soRef ? ` Reference image${soRef > 1 ? `s 1–${soRef} show` : ' 1 shows'} the characters / props — keep their exact designs.` : ''}`;

/** Câu VIDEO của shot dựng lớp: nền xanh suốt clip, máy đứng yên (nền là ảnh tĩnh ghép sau). */
export const CAU_NEN_VIDEO_LOP = 'The background stays a perfectly flat pure chroma green for the whole clip — no floor, no scenery, no shadows ever appear behind the characters.';
export const CAU_MAY_VIDEO_LOP = 'Camera: static locked-off camera, no zoom, no pan (the background is composited later).';
export const CAU_SONG_VIDEO_LOP = 'The characters perform with clear, readable whole-body movement and never freeze.';

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
