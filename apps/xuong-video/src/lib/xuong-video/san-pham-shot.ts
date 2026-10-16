// SẢN PHẨM TRONG SHOT QUẢNG CÁO (16/10/2026 — #54 JettJeans shot 9: hành động chỉ "cười, gật đầu, slow push-in" → model tự bịa cử chỉ kéo cổ áo
// polo trong phim bán QUẦN, máy đẩy vào ngực cắt mất quần từ giây 4). Anh: "giải pháp kỹ thuật để không phải nhắc từng tí". Hai luật, thuần:
//   1. shot gắn sản phẩm thì câu hành động phải nhắc sản phẩm hoặc bộ phận của nó — cử chỉ dồn vào sản phẩm, không để model chọn món gần tay;
//   2. sản phẩm MẶC TRÊN NGƯỜI mà máy đẩy vào ở cỡ có người (mcu trở ra) thì khung siết về mặt, sản phẩm ra khỏi khung;
//   3. sản phẩm ĐỔI TRẠNG THÁI trong clip (giũ ra, mở gói, lấy ra, mặc vào) mà chưa có khung kết → model tự bịa phần chưa thấy (16/10/2026 Jett #61
//      shot 9: quần cobalt gấp trong keyframe, giũ ra thành jeans 5 túi bạc màu có mác).
// MỘT luật cho cổng sinh clip (quy-trinh.ts › chanVideo), máy chọn chuyển động (nhip-hinh.ts › daDangMay) và kiểm template (dung-template.mts).
// Tự kiểm: san-pham-shot.test.mts.
import type { Canh, NhanVat } from './kieu';
import type { KyThuatShot } from './dien-anh';

type Sp = Pick<NhanVat, 'ten' | 'mo_ta'>;
type LoaiSp = { ten: string; nhan: RegExp; phan: string[]; goiY: string };

/** Loại sản phẩm mặc trên người — xét THEO THỨ TỰ, khớp loại đầu (quần tả "dress trousers" không được rơi sang loại áo / váy). */
const LOAI_MAC: LoaiSp[] = [
  { ten: 'quần', nhan: /\b(jeans|pants|trousers|leggings|shorts|chinos|slacks)\b/i, goiY: 'hooks his thumbs in the belt loops and tugs the waistband to show the fit',
    phan: ['jeans', 'pants', 'trousers', 'leggings', 'shorts', 'chinos', 'slacks', 'denim', 'waist', 'waistband', 'belt', 'loop', 'pocket', 'leg', 'hem', 'cuff', 'seam', 'fly', 'zip', 'zipper', 'fabric', 'stretch', 'fit', 'hip', 'thigh', 'knee', 'seat'] },
  { ten: 'áo ngực', nhan: /\b(bra|bralette|bras)\b/i, goiY: 'adjusts the strap, smooths the band and turns to show the lift',
    phan: ['bra', 'bralette', 'strap', 'cup', 'band', 'underwire', 'wire', 'clasp', 'fabric', 'fit', 'lift', 'support'] },
  { ten: 'giày', nhan: /\b(shoes?|sneakers?|boots?|sandals?|loafers?)\b/i, goiY: 'taps the toe, bends the sole and walks a few steps toward the camera',
    phan: ['shoe', 'sneaker', 'boot', 'sandal', 'loafer', 'sole', 'heel', 'lace', 'toe', 'insole', 'fit'] },
  { ten: 'áo / váy', nhan: /\b(shirt|t-shirt|top|jacket|hoodie|dress|blouse|sweater|coat|skirt)\b/i, goiY: 'smooths the fabric with both hands and turns to show the cut',
    phan: ['shirt', 'top', 'jacket', 'hoodie', 'dress', 'blouse', 'sweater', 'coat', 'skirt', 'collar', 'sleeve', 'hem', 'button', 'zip', 'fabric', 'fit'] },
];
const loaiCua = (sp: Sp[]): LoaiSp | null => LOAI_MAC.find((l) => sp.some((x) => l.nhan.test(`${x.ten} ${x.mo_ta}`))) ?? null;

/** Chuyển động máy đẩy khung về chủ thể; ở cỡ có người (mcu trở ra) chủ thể là MẶT. */
export const MAY_DAY_VAO: readonly string[] = ['day_vao', 'zoom_cham', 'zoom_gat'];
const CO_CO_NGUOI: readonly string[] = ['mcu', 'ms', 'two', 'ws', 'ews'];
const DAY_TRONG_CHU = /\b(push(es|ing)?[- ]in|dolly(ing)?[- ]in|zoom(s|ing)?[- ]in|creep(s|ing)?[- ]in|moves? closer)\b/i;

/** Từ cho thấy câu hành động có nhắc sản phẩm: tên sản phẩm (từng chữ ≥3 ký tự), "product", ô {{san_pham}} của template, bộ phận theo loại. */
export function tuSanPham(sp: Sp[]): string[] {
  const ten = sp.flatMap((x) => x.ten.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length >= 3);
  return [...new Set([...ten, 'product', ...(loaiCua(sp)?.phan ?? [])])];
}
export function nhacSanPham(chu: string, sp: Sp[]): boolean {
  if (/\{\{\s*san_pham\s*\}\}/.test(chu)) return true;
  const c = chu.toLowerCase();
  return tuSanPham(sp).some((w) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?([^\\p{L}]|$)`, 'u').test(c));
}
/** Máy chọn chuyển động (daDangMay) tránh đẩy vào ở shot này: sản phẩm mặc trên người + cỡ có người. */
export const tranhDayVao = (coCanh: string | undefined, sp: Sp[]): boolean => !!loaiCua(sp) && CO_CO_NGUOI.includes(coCanh ?? 'ms');

/** Câu hành động làm sản phẩm ĐỔI TRẠNG THÁI (lộ phần keyframe không có): giũ / mở / lấy ra / mặc vào. */
export const DOI_TRANG_THAI = /\b(unfold(s|ed|ing)?|unwrap(s|ped|ping)?|unbox(es|ed|ing)?|unpack(s|ed|ing)?|shak(e|es|ing) (it|them|the [\w{}]+) out|(take|takes|taking|pull|pulls|pulling) (it|them|the [\w{}]+) (out|on)|(put|puts|putting|tr(y|ies|ying)) (it|them|the [\w{}]+) on|(open|opens|opening) the (box|package|bag|parcel))\b/i;
/** Lỗi sản phẩm của MỘT shot quảng cáo (rỗng = đạt). nhanVat = mọi anchor của phim; chỉ xét sản phẩm GẮN vào shot. */
export function loiSanPhamShot(c: Pick<Canh, 'nhan_vat' | 'hanh_dong'> & { prompt_video?: string; ky_thuat?: KyThuatShot | null; keyframe_ket?: string | null }, nhanVat: (Sp & Pick<NhanVat, 'id' | 'loai'>)[]): string[] {
  const sp = nhanVat.filter((v) => v.loai === 'san_pham' && c.nhan_vat.includes(v.id));
  if (!sp.length) return [];
  const out: string[] = [];
  const hd = (c.prompt_video ?? '').trim() || c.hanh_dong;
  const loai = loaiCua(sp);
  const ten = sp.map((x) => x.ten).join(', ');
  if (!nhacSanPham(hd, sp)) out.push(`hành động không nhắc sản phẩm (${ten}) — model sẽ tự bịa cử chỉ vào món khác (#54: kéo cổ áo polo trong phim bán quần); viết cử chỉ vào chính sản phẩm, vd "${loai?.goiY ?? 'holds the product up and turns it toward the camera'}"`);
  // Đặc tả (ecu / cu) đẩy vào chính sản phẩm thì được; cỡ có người mới tính — cả khi đẩy vào nằm trong chữ hành động ("slow push-in").
  if (loai && tranhDayVao(c.ky_thuat?.co_canh, sp) && (MAY_DAY_VAO.includes(c.ky_thuat?.chuyen_dong ?? '') || DAY_TRONG_CHU.test(hd))) out.push(`máy đẩy vào ở shot có ${loai.ten} mặc trên người — khung siết về mặt, sản phẩm ra khỏi khung; đổi chuyển động máy (đứng yên / trượt ngang / quay vòng) và bỏ "push-in" khỏi hành động`);
  if (DOI_TRANG_THAI.test(hd) && !c.keyframe_ket) out.push(`sản phẩm đổi trạng thái trong clip ("${hd.match(DOI_TRANG_THAI)![0]}") mà chưa có khung kết — model tự bịa phần keyframe không thấy (Jett #61 shot 9: quần gấp giũ ra thành jeans khác); sinh khung kết cho thấy ${ten} ở trạng thái cuối, hoặc để keyframe đã ở trạng thái cuối và hành động không đổi trạng thái`);
  return out;
}
