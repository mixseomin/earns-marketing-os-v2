// Adapter Claude cho xưởng video: viết kịch bản + tách kịch bản thành cảnh (storyboard) dạng JSON có cấu trúc.
// Nhân vật/bối cảnh của bộ phim (anchor) được đưa vào prompt để mọi cảnh, mọi tập tả cùng một người, cùng bộ đồ, cùng bối cảnh.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';   // helper zodOutputFormat của SDK cần zod v4 (zod 3.25 kèm sẵn ở 'zod/v4'); import 'zod' gốc → TypeError 'def'
import type { BienThe, KinhThanh, LoaiNhanVat, LoaiPhim, NhanVat } from './kieu';
import { docKinhThanh, LOAI_PHIM } from './kieu';

const CanhSchema = z.object({
  canh: z.string().describe('Nhãn ngắn của cảnh, tiếng Việt, ví dụ "Cảnh 1 · Khu rừng buổi sáng"'),
  goc_may: z.string().describe('Góc máy + cỡ cảnh + chuyển động máy, tiếng Việt ngắn gọn'),
  hanh_dong: z.string().describe('Chuyện gì xảy ra trong cảnh, tiếng Việt, 1-2 câu'),
  loi_thoai: z.string().describe('Lời thoại hoặc lời dẫn trong cảnh (đúng ngôn ngữ của bộ phim); rỗng nếu không có'),
  am_thanh: z.string().describe('Âm thanh nền / hiệu ứng / nhạc; rỗng nếu không có'),
  thoi_luong_s: z.number().int().describe('Thời lượng clip: chỉ 4, 6 hoặc 8'),
  nhan_vat: z.array(z.string()).describe('Tên CHÍNH XÁC của các anchor (nhân vật, sản phẩm, bối cảnh) xuất hiện trong cảnh, lấy từ danh sách đã cho'),
  bien_the: z.array(z.string()).describe('Biến thể dùng trong cảnh, ghi đúng dạng "Tên anchor · tên biến thể" lấy từ danh sách biến thể đã cho (biểu cảm, trang phục, góc máy…); mỗi anchor tối đa 1 biến thể; rỗng nếu không có biến thể phù hợp'),
  prompt_anh: z.string().describe('Prompt tiếng Anh cho model sinh ảnh keyframe: tả khung hình tĩnh đầu cảnh — bố cục, ánh sáng, cỡ cảnh, nhân vật tả theo đặc tính cố định (KHÔNG dùng tên riêng), bối cảnh, phong cách. Không nhắc chuyển động.'),
  prompt_video: z.string().describe('Prompt tiếng Anh cho model sinh video từ keyframe: chuyển động nhân vật, chuyển động máy, nhịp, âm thanh/lời thoại (ghi dialogue trong ngoặc kép kèm ngôn ngữ). Giữ nhân vật đúng như khung đầu.'),
});
const StoryboardSchema = z.object({
  tom_tat: z.string().describe('Tóm tắt nội dung tập này trong 2-3 câu, tiếng Việt, để tập sau nối mạch'),
  canh: z.array(CanhSchema),
});
export type CanhSinh = z.infer<typeof CanhSchema>;

function client(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function taAnchor(nv: NhanVat[]): string {
  if (!nv.length) return '(chưa khai anchor nào — tự đặt tên nhân vật/bối cảnh và tả cố định, dùng cùng một mô tả ở mọi cảnh)';
  return nv.map((a) => `- [${a.loai}] ${a.ten}: ${a.mo_ta || '(chưa mô tả)'}${a.giong ? ` · giọng: ${a.giong}` : ''}${a.bien_the?.length ? `\n    biến thể: ${a.bien_the.map((b) => `"${a.ten} · ${b.ten}" (${b.nhom}: ${b.mo_ta.slice(0, 80)})`).join('; ')}` : ''}`).join('\n');
}

const heThong = (loai: LoaiPhim, kt: Required<KinhThanh>) => `Bạn là đạo diễn kiêm storyboard artist cho xưởng video AI. Loại sản phẩm: ${LOAI_PHIM.find((l) => l.key === loai)?.label ?? loai}.
Phong cách hình ảnh cố định của bộ phim: ${kt.phong_cach || '(chưa đặt, tự chọn một phong cách và giữ nhất quán)'}.
Khung hình ${kt.ti_le}, mỗi cảnh là MỘT clip video AI dài 4/6/8 giây sinh từ một ảnh keyframe, nên mỗi cảnh chỉ có một hành động chính, một góc máy.
Ngôn ngữ lời thoại/lời dẫn: ${kt.ngon_ngu === 'vi' ? 'tiếng Việt' : kt.ngon_ngu}.
QUY TẮC ĐỒNG NHẤT: nhân vật, sản phẩm, bối cảnh phải tả bằng đúng đặc tính cố định trong danh sách anchor ở mọi cảnh (cùng màu lông, cùng trang phục, cùng tỉ lệ cơ thể, cùng chất liệu). prompt_anh và prompt_video viết tiếng Anh, tả người/vật theo đặc tính chứ không dùng tên riêng (model ảnh không biết tên). Mỗi prompt tự đứng được một mình, không tham chiếu cảnh khác.`;

/** Tách kịch bản thành cảnh. `soCanh` = số cảnh mong muốn (0 = để Claude tự chia). */
export async function tachCanh(opts: {
  loai: LoaiPhim; kinhThanh: KinhThanh; nhanVat: NhanVat[]; kichBan: string; soCanh?: number; tapTruoc?: string[];
}): Promise<{ ok: true; tomTat: string; canh: CanhSinh[]; model: string; tokens: { in: number; out: number } } | { ok: false; loi: string }> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(opts.kinhThanh);
  const user = [
    `DANH SÁCH ANCHOR (dùng đúng tên trong trường nhan_vat):\n${taAnchor(opts.nhanVat)}`,
    opts.tapTruoc?.length ? `TÓM TẮT CÁC TẬP TRƯỚC (nối mạch, không kể lại):\n${opts.tapTruoc.map((t, i) => `Tập ${i + 1}: ${t}`).join('\n')}` : '',
    `KỊCH BẢN:\n${opts.kichBan.trim()}`,
    opts.soCanh ? `Chia thành khoảng ${opts.soCanh} cảnh.` : 'Chia số cảnh vừa đủ kể hết kịch bản, mỗi cảnh 4-8 giây.',
  ].filter(Boolean).join('\n\n');
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu,
      max_tokens: 16000,
      system: heThong(opts.loai, kt),
      messages: [{ role: 'user', content: user }],
      // Kiểu của helper khai theo zod v3 nhưng runtime cần v4 (đã thử: v3 → TypeError 'def', v4 chạy) → ép kiểu ở ranh này.
      output_config: { format: zodOutputFormat(StoryboardSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof StoryboardSchema> | null;
    if (!p) return { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
    const canh = p.canh.map((x) => ({ ...x, thoi_luong_s: x.thoi_luong_s <= 4 ? 4 : x.thoi_luong_s <= 6 ? 6 : 8 }));
    return { ok: true, tomTat: p.tom_tat, canh, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
}

/** Viết kịch bản từ brief (sản phẩm, ý tưởng, tập số N của bộ phim). Trả văn bản thuần để người sửa trước khi tách cảnh. */
export async function vietKichBan(opts: {
  loai: LoaiPhim; kinhThanh: KinhThanh; nhanVat: NhanVat[]; brief: string; tapSo?: number; tapTruoc?: string[]; thoiLuongS?: number;
}): Promise<({ ok: true; kichBan: string } & DungChu) | { ok: false; loi: string }> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(opts.kinhThanh);
  const user = [
    `DANH SÁCH ANCHOR:\n${taAnchor(opts.nhanVat)}`,
    opts.tapTruoc?.length ? `TÓM TẮT CÁC TẬP TRƯỚC:\n${opts.tapTruoc.map((t, i) => `Tập ${i + 1}: ${t}`).join('\n')}` : '',
    opts.tapSo ? `Viết kịch bản TẬP ${opts.tapSo}.` : '',
    `Tổng thời lượng mục tiêu: ${opts.thoiLuongS ?? 30} giây.`,
    `BRIEF:\n${opts.brief.trim()}`,
    'Viết kịch bản dạng văn xuôi có đánh số cảnh (Cảnh 1, Cảnh 2…), mỗi cảnh ghi: bối cảnh, hành động, lời thoại/lời dẫn. Không giải thích thêm, chỉ trả kịch bản.',
  ].filter(Boolean).join('\n\n');
  try {
    const r = await c.messages.create({
      model: kt.mo_hinh_chu, max_tokens: 16000, system: heThong(opts.loai, kt), messages: [{ role: 'user', content: user }],
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const text = r.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text ? { ok: true, kichBan: text, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } } : { ok: false, loi: 'Claude không trả chữ' };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
}

/** Mô tả anchor → prompt tiếng Anh sinh "ảnh mẫu" (character sheet) để các cảnh sau tham chiếu. Không gọi LLM: ghép chuỗi là đủ. */
export function promptAnhMau(nv: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta'>, kt: KinhThanh): string {
  const k = docKinhThanh(kt);
  const loai = nv.loai === 'nhan_vat' ? 'Character design reference sheet on a plain light background: full-body turnaround (front, three-quarter, side, back) in a neutral pose, plus a row of head close-ups showing neutral, happy, sad and surprised expressions; identical design in every view'
    : nv.loai === 'san_pham' ? 'Product reference shot, centered, soft studio lighting, plain background, exact product details'
    : nv.loai === 'boi_canh' ? 'Establishing shot of the location, wide angle, no characters'
    : nv.loai === 'dao_cu' ? 'Prop reference shot, centered, plain background' : 'Style reference frame';
  return `${loai}. ${nv.mo_ta}. Visual style: ${k.phong_cach || 'consistent cinematic look'}.`;
}

// ── Gợi ý AI cho MỌI form (anh yêu cầu 08/10/2026): mỗi lần sinh đều đọc ngữ cảnh của cả phim — kinh thánh, tuyến nhân vật,
// tóm tắt các tập, cảnh lân cận — để phần mới khớp với phần đã có, không tả nhân vật một kiểu khác. ──────────────────────

export type NguCanhPhim = {
  loai: LoaiPhim; ten: string; mo_ta: string; kinhThanh: KinhThanh; nhanVat: NhanVat[];
  tap: { so: number; ten: string; tom_tat: string; kich_ban: string }[];
};

const KinhThanhSchema = z.object({
  phong_cach: z.string().describe('Phong cách hình ảnh cố định cho CẢ bộ phim: chất liệu/kỹ thuật (3D Pixar, UGC quay thật, 2D anime…), bảng màu, ánh sáng, lens, không khí. 1-2 câu, dùng được làm tiền tố prompt tiếng Anh lẫn Việt.'),
  mo_ta: z.string().describe('Tiền đề / mô tả bộ phim 2-3 câu: kể về gì, cho ai xem, cảm xúc chủ đạo.'),
});
const AnchorSchema = z.object({
  mo_ta: z.string().describe('Đặc tính CỐ ĐỊNH để model ảnh tái tạo giống nhau ở mọi cảnh: loài/tuổi/giới, hình dáng, màu sắc cụ thể, trang phục/phụ kiện, chất liệu, tỉ lệ, tính cách thể hiện qua dáng. 3-5 câu.'),
  giong: z.string().describe('Mô tả giọng (nếu là nhân vật), rỗng nếu không phải nhân vật'),
});
const BoAnchorSchema = z.object({
  anchors: z.array(z.object({
    loai: z.enum(['nhan_vat', 'san_pham', 'boi_canh', 'dao_cu', 'phong_cach']),
    ten: z.string().describe('Tên ngắn, duy nhất'),
    mo_ta: z.string().describe('Đặc tính cố định 3-5 câu như trên'),
    giong: z.string(),
  })).describe('Tuyến nhân vật, sản phẩm, bối cảnh, đạo cụ cần đồng nhất xuyên suốt — chỉ những thứ xuất hiện ≥2 cảnh hoặc ≥2 tập'),
});
const BriefSchema = z.object({ brief: z.string().describe('Brief 4-8 dòng cho tập này: mục tiêu, hook, diễn biến chính, xung đột, kết/CTA; nối mạch các tập trước') });
const CanhLaiSchema = CanhSchema;

export type DungChu = { model: string; tokens: { in: number; out: number } };
type GoiYKq<T> = ({ ok: true; data: T } & DungChu) | { ok: false; loi: string };

function taNguCanh(nc: NguCanhPhim): string {
  const kt = docKinhThanh(nc.kinhThanh);
  return [
    `BỘ PHIM: ${nc.ten} (${LOAI_PHIM.find((l) => l.key === nc.loai)?.label ?? nc.loai})`,
    nc.mo_ta ? `TIỀN ĐỀ: ${nc.mo_ta}` : '',
    kt.phong_cach ? `PHONG CÁCH CỐ ĐỊNH: ${kt.phong_cach}` : '',
    `KHUNG HÌNH ${kt.ti_le} · ngôn ngữ ${kt.ngon_ngu}`,
    `TUYẾN NHÂN VẬT / SẢN PHẨM / BỐI CẢNH (phải giữ đúng):\n${taAnchor(nc.nhanVat)}`,
    nc.tap.length ? `CÁC TẬP:\n${nc.tap.map((t) => `- Tập ${t.so}${t.ten ? ` · ${t.ten}` : ''}: ${t.tom_tat || (t.kich_ban ? t.kich_ban.slice(0, 300) + '…' : '(chưa có kịch bản)')}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

async function hoi<T>(schema: z.ZodType<T>, kt: Required<KinhThanh>, system: string, user: string): Promise<GoiYKq<T>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu, max_tokens: 16000, system, messages: [{ role: 'user', content: user }],
      output_config: { format: zodOutputFormat(schema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as T | null;
    return p ? { ok: true, data: p, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
}

const HE_THONG_GOI_Y = 'Bạn là biên kịch kiêm đạo diễn hình ảnh của xưởng video AI. Mọi gợi ý phải KHỚP với ngữ cảnh đã cho (phong cách, tuyến nhân vật, các tập) — không đổi đặc tính đã có, chỉ bổ sung và làm rõ. Trả lời bằng tiếng Việt trừ khi trường yêu cầu tiếng Anh.';

export const goiYKinhThanh = (nc: NguCanhPhim) =>
  hoi(KinhThanhSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết PHONG CÁCH HÌNH ẢNH cố định và TIỀN ĐỀ cho bộ phim này. Nếu đã có thì giữ ý, viết rõ và cụ thể hơn (chất liệu, màu, ánh sáng, lens).`);

export const goiYAnchor = (nc: NguCanhPhim, a: { loai: LoaiNhanVat; ten: string; mo_ta: string }) =>
  hoi(AnchorSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết đặc tính CỐ ĐỊNH cho anchor mới: loại=${a.loai}, tên="${a.ten}"${a.mo_ta ? `, ý đã có: ${a.mo_ta}` : ''}. Phải hợp phong cách và không trùng/đụng với các anchor đã có.`);

export const goiYBoAnchor = (nc: NguCanhPhim) =>
  hoi(BoAnchorSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nĐề xuất tuyến nhân vật / sản phẩm / bối cảnh / đạo cụ còn THIẾU (không lặp lại anchor đã có) dựa trên tiền đề và kịch bản các tập. Phim ngắn nhiều tập: 2-4 nhân vật chính, 1-2 bối cảnh, đạo cụ then chốt. Quảng cáo: sản phẩm + 1 người dùng + 1 bối cảnh.`);

export const goiYBrief = (nc: NguCanhPhim, tapSo: number, thoiLuongS: number) =>
  hoi(BriefSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết BRIEF cho tập ${tapSo} (tổng ${thoiLuongS} giây) để sau đó viết kịch bản: nối mạch tập trước, có xung đột và kết mở (hoặc CTA nếu là quảng cáo/short).`);

export const goiYCanh = (nc: NguCanhPhim, c: { thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; nhan_vat: string[] }, truoc?: string, sau?: string) =>
  hoi(CanhLaiSchema, docKinhThanh(nc.kinhThanh), heThong(nc.loai, docKinhThanh(nc.kinhThanh)) + '\n' + HE_THONG_GOI_Y,
    `${taNguCanh(nc)}\n\n${truoc ? `CẢNH TRƯỚC: ${truoc}\n` : ''}${sau ? `CẢNH SAU: ${sau}\n` : ''}\nViết lại đầy đủ CẢNH #${c.thu_tu}: nhãn "${c.canh}", góc máy "${c.goc_may}", hành động "${c.hanh_dong}", lời thoại "${c.loi_thoai}", anchor trong cảnh: ${c.nhan_vat.join(', ') || '(tự chọn từ tuyến)'}. Giữ ý người đã viết, bổ sung chỗ trống, sinh prompt_anh + prompt_video tiếng Anh khớp cảnh trước/sau và đúng đặc tính anchor.`);

// ── Biến thể anchor ────────────────────────────────────────────────────────────────────────────────────────────────

const BoBienTheSchema = z.object({
  bien_the: z.array(z.object({
    nhom: z.string().describe('Mã nhóm, chọn trong danh sách nhóm đã cho'),
    ten: z.string().describe('Tên ngắn tiếng Việt, ví dụ "vui", "buồn", "đồ mùa đông", "góc cao", "hoàng hôn"'),
    mo_ta: z.string().describe('Mô tả tiếng Anh cho model ảnh: chỉ phần THAY ĐỔI so với ảnh gốc (nét mặt, quần áo, tư thế, góc máy, ánh sáng); không tả lại danh tính'),
  })).describe('Các biến thể CẦN cho kịch bản (đọc kịch bản các tập), cộng vài biến thể nền tảng; không lặp biến thể đã có'),
});

export const goiYBienThe = (nc: NguCanhPhim, a: NhanVat, nhom: { key: string; label: string }[]) =>
  hoi(BoBienTheSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y,
    `${taNguCanh(nc)}\n\nAnchor cần biến thể: [${a.loai}] ${a.ten}: ${a.mo_ta}\nBiến thể đã có: ${(a.bien_the ?? []).map((b) => `${b.nhom}/${b.ten}`).join(', ') || '(chưa có)'}\nNhóm hợp lệ: ${nhom.map((x) => `${x.key} (${x.label})`).join(', ')}\n\nĐề xuất 4-10 biến thể mà kịch bản các tập thật sự dùng tới (vd cảnh khóc → biểu cảm buồn; cảnh đêm → bối cảnh ban đêm), ưu tiên thứ xuất hiện nhiều.`);

export function promptBienThe(a: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta'>, b: Pick<BienThe, 'nhom' | 'mo_ta' | 'ten'>, kt: KinhThanh): string {
  const k = docKinhThanh(kt);
  const khung = a.loai === 'boi_canh' ? 'Establishing shot of the SAME location as the reference image' : a.loai === 'san_pham' ? 'Product shot of the EXACT same product as the reference image' : 'The SAME character as the reference image, single character, plain light background';
  return `${khung}. Identity (must not change): ${a.mo_ta}. Change only this (${b.nhom}): ${b.mo_ta || b.ten}. Visual style: ${k.phong_cach || 'consistent with reference'}. Keep proportions, colors, markings and outfit details identical unless the change says otherwise.`;
}
