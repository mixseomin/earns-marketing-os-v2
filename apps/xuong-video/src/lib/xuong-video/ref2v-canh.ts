// THỬ "NHIỀU SHOT TRONG MỘT CLIP" (anh 18/10/2026 "làm 4 xem" — học Movie Maker của Digen, tham-khao/digen.md): thay vì keyframe → clip từng shot rồi ghép,
// MỘT lượt reference-to-video cho cả một phân cảnh: model nhận danh sách prompt từng shot (mỗi shot một số giây, tổng ≤ 15s) + ảnh tham chiếu nhân vật
// (element: ảnh chính diện + 1–3 ảnh phụ) + ảnh bối cảnh / đồ vật → một clip có cắt bên trong. Model: Kling O3 Standard reference-to-video trên fal
// (multi_prompt có sẵn; giá danh mục fal 18/10/2026: $0,084/s không tiếng, $0,112/s có tiếng). Đây là THỬ NGHIỆM: kết quả chỉ nằm ở sổ job, không
// thay clip của shot nào. Phần thuần (dungRef2v) có tự kiểm: ref2v-canh.test.mts.
import type { Canh, NhanVat } from './kieu';
import { promptKyThuatVideo } from './dien-anh';

export const MODEL_REF2V = 'fal-ai/kling-video/o3/standard/reference-to-video';
/** Giá (cents / giây) theo danh mục fal — ghi ở đây để nút báo đúng giá trước khi anh bấm. */
export const GIA_REF2V = { khong_tieng: 8.4, co_tieng: 11.2 } as const;
const TOI_DA_S = 15;
/** Tổng element + ảnh tham chiếu — tài liệu fal ghi tối đa 4 khi có video; giữ 4 cho chắc. */
const TOI_DA_THAM_CHIEU = 4;
/** Giới hạn MỖI prompt shot của model là 512 (422 từ fal, job #3088) — nhưng model gốc đo SAU khi xử lý: prompt 479 ký tự vẫn bị trả "size must be
 *  between 0 and 512" (job #3098, 19/10/2026; có thể đếm byte UTF-8 và / hoặc mở rộng @Element). Đo theo BYTE và chừa khoảng an toàn. */
export const TOI_DA_PROMPT = 380;
const doDai = (x: string) => Buffer.byteLength(x, 'utf8');
const DUOI = 'Photorealistic, same faces and wardrobe, no on-screen text.';
/** Ghép các phần theo thứ tự ưu tiên vào tối đa `max` ký tự: phần vừa thì lấy cả, không vừa thì lấy các CÂU đầu còn vừa; phần đầu tiên dài quá
 *  một câu thì cắt ở ranh giới từ (luôn có nội dung). */
export function gonPrompt(phan: string[], max: number): string {
  let out = '';
  for (const p of phan.filter(Boolean)) {
    const them = (x: string) => (out ? `${out} ${x}` : x);
    if (doDai(them(p)) <= max) { out = them(p); continue; }
    for (const cau of p.split(/(?<=[.!?])\s+/)) { if (doDai(them(cau)) <= max) out = them(cau); else break; }
    if (!out) { let c = p; while (doDai(c) > max) c = c.slice(0, -10); out = c.replace(/\s+\S*$/, ''); }
  }
  return out;
}

type ShotR = Pick<Canh, 'id' | 'thu_tu' | 'phan_doan' | 'nhan_vat' | 'phat_s' | 'thoi_luong_s' | 'hanh_dong' | 'prompt_video' | 'ky_thuat'> & { dan_dung?: Canh['dan_dung']; nhanh?: string; keyframe_url?: string | null };
type NvR = Pick<NhanVat, 'id' | 'ten' | 'loai' | 'anh_ref'> & { anh_mat?: NhanVat['anh_mat'] };
export type ThamChieu = { ten: string; loai: string; vai: 'element' | 'anh'; ma: string; anh: string[] };
export type GoiRef2v = { input: Record<string, unknown>; giay: number; cents: number; shots: { id: number; thu_tu: number; giay: number; prompt: string }[]; tham_chieu: ThamChieu[]; bo: string[]; loi: string[] };

/** Dựng yêu cầu thử cho các shot của MỘT phân cảnh (đã lọc nhánh chính, theo thứ tự). Không gọi mạng. */
export function dungRef2v(shots: ShotR[], nhanVat: NvR[], o: { tiLe: string; tieng?: boolean }): GoiRef2v {
  const loi: string[] = []; const bo: string[] = [];
  // Shot theo thứ tự tới khi chạm 15 giây; mỗi shot ≥ 1 giây, làm tròn.
  const chon: { s: ShotR; giay: number }[] = []; let tong = 0;
  for (const s of shots) {
    const g = Math.max(1, Math.round(s.phat_s || s.thoi_luong_s || 3));
    if (tong + g > TOI_DA_S) { bo.push(`#${s.thu_tu}`); continue; }
    chon.push({ s, giay: g }); tong += g;
  }
  if (!chon.length) loi.push('phân cảnh không có shot nào');
  if (tong < 3) loi.push('tổng dưới 3 giây — model cần ít nhất 3 giây');
  // Tham chiếu: người (element) trước, rồi bối cảnh, rồi đồ vật — theo số lần xuất hiện; cắt ở 4.
  const dem = new Map<number, number>();
  for (const { s } of chon) for (const id of s.nhan_vat) dem.set(id, (dem.get(id) ?? 0) + 1);
  const thu = (l: string) => (l === 'nhan_vat' ? 0 : l === 'boi_canh' ? 1 : 2);
  // Ảnh của từng anchor: người = ảnh SÁT MẶT (soi-mat.ts › anh_mat) làm ảnh chính diện, ảnh mẫu (thường là bảng nhiều góc) làm ảnh phụ; bối cảnh dựng bằng
  // bộ set 3D (không có ảnh mẫu) = keyframe đầu tiên của cảnh có nơi đó — keyframe chính là hình bối cảnh đã duyệt.
  const anhCua = (v: NvR): string[] => {
    if (v.loai === 'nhan_vat') return [...new Set([...(v.anh_mat?.url ?? []).slice(0, 1), ...v.anh_ref])].slice(0, 4);
    if (v.anh_ref.length) return v.anh_ref.slice(0, 1);
    const kf = v.loai === 'boi_canh' ? chon.find(({ s }) => s.nhan_vat.includes(v.id) && s.keyframe_url)?.s.keyframe_url : null;
    return kf ? [kf] : [];
  };
  const coAnh = nhanVat.filter((v) => dem.has(v.id)).map((v) => ({ v, anh: anhCua(v) }));
  const ung = coAnh.filter((x) => x.anh.length).sort((a, b) => thu(a.v.loai) - thu(b.v.loai) || (dem.get(b.v.id)! - dem.get(a.v.id)!));
  const thieuAnh = coAnh.filter((x) => !x.anh.length).map((x) => x.v.ten);
  if (thieuAnh.length) loi.push(`chưa có ảnh mẫu: ${thieuAnh.join(', ')}`);
  let ne = 0, na = 0;
  const tc: ThamChieu[] = ung.slice(0, TOI_DA_THAM_CHIEU).map(({ v, anh }) => v.loai === 'nhan_vat'
    ? { ten: v.ten, loai: v.loai, vai: 'element', ma: `@Element${++ne}`, anh }
    : { ten: v.ten, loai: v.loai, vai: 'anh', ma: `@Image${++na}`, anh });
  for (const { v } of ung.slice(TOI_DA_THAM_CHIEU)) bo.push(v.ten);
  // Tên → mã tham chiếu trong prompt ({Tên} của thẻ shot, tên đầy đủ, và TÊN GỌI — chữ cuối của tên người, "Hạ" của "Lâm Hạ" — khi chỉ một người mang nó).
  // Tên dài thay trước để "Lâm Hạ" không bị "Hạ" nuốt; tên gọi chỉ khớp nguyên từ (không ăn vào giữa chữ khác).
  const goi = tc.filter((c) => c.vai === 'element').map((c) => ({ c, g: c.ten.trim().split(/\s+/).pop()! }))
    .filter(({ c, g }) => g.length >= 2 && g !== c.ten && tc.filter((x) => x.vai === 'element' && x.ten.trim().split(/\s+/).pop() === g).length === 1);
  const doi = (t: string) => {
    let x = t.replace(/\{([^}]+)\}/g, (_m, ten: string) => tc.find((c) => c.ten === ten.trim())?.ma ?? ten.trim());
    for (const c of [...tc].sort((a, b) => b.ten.length - a.ten.length)) x = x.split(c.ten).join(c.ma);
    for (const { c, g } of goi) x = x.replace(new RegExp(`(?<![\\p{L}\\p{M}@])${g}(?![\\p{L}\\p{M}])`, 'gu'), c.ma);
    return x;
  };
  const tieng = !!o.tieng;
  // MỖI prompt shot ≤ TOI_DA_PROMPT ký tự (model trả 422 "Prompt must not exceed 512 characters" — job #3088, 19/10/2026). Ghép theo ƯU TIÊN, phần
  // không vừa thì bỏ NGUYÊN CÂU (không cắt giữa câu): bố cục → diễn (hành động) → máy → mở/kết. Không sinh tiếng thì bỏ phần "Sound:" của máy.
  const sp = chon.map(({ s, giay }) => {
    const d = s.dan_dung ?? {};
    const mayDu = promptKyThuatVideo(s.ky_thuat); const may = (tieng ? mayDu : mayDu.replace(/\s*Sound:[^.]*\.?/g, '')).trim();
    // Thứ tự (soát clip job #3104, 19/10/2026): để DIỄN đứng đầu thì model bỏ cỡ cảnh / góc qua vai và đẩy người phụ ra khỏi khung (Vivian mất ở shot 1, 3)
    // → BỐ CỤC (cỡ cảnh, ai ở đâu) trước, rồi diễn, rồi máy, cuối cùng mở / kết.
    const phan = s.prompt_video?.trim() ? [s.prompt_video.trim(), may] : [d.bo_cuc ? gonPrompt([d.bo_cuc], 170) : '', d.dien || s.hanh_dong, may, d.mo && d.ket ? `From: ${d.mo} — to: ${d.ket}.` : ''];   // bố cục ≤ 170 byte: chừa chỗ cho diễn
    return { id: s.id, thu_tu: s.thu_tu, giay, prompt: gonPrompt(phan.map((x) => { const t = doi(String(x ?? '').replace(/\s+/g, ' ').trim()); return t && !/[.!?]$/.test(t) ? `${t}.` : t; }), TOI_DA_PROMPT - doDai(DUOI) - 1) };
  });
  const input: Record<string, unknown> = {
    multi_prompt: sp.map((x) => ({ prompt: `${x.prompt} ${DUOI}`, duration: String(x.giay) })),
    shot_type: 'customize', duration: String(Math.max(3, Math.min(TOI_DA_S, tong))), aspect_ratio: o.tiLe === '16:9' ? '16:9' : o.tiLe === '1:1' ? '1:1' : '9:16', generate_audio: tieng,
    elements: tc.filter((c) => c.vai === 'element').map((c) => ({ frontal_image_url: c.anh[0], reference_image_urls: (c.anh.length > 1 ? c.anh.slice(1, 4) : [c.anh[0]]) })),
    image_urls: tc.filter((c) => c.vai === 'anh').map((c) => c.anh[0]),
  };
  return { input, giay: tong, cents: Math.round(tong * (tieng ? GIA_REF2V.co_tieng : GIA_REF2V.khong_tieng) * 10) / 10, shots: sp, tham_chieu: tc, bo, loi };
}
