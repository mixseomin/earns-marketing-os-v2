// Adapter Claude cho xưởng video: viết kịch bản + tách kịch bản thành cảnh (storyboard) dạng JSON có cấu trúc.
// Nhân vật/bối cảnh của bộ phim (anchor) được đưa vào prompt để mọi cảnh, mọi tập tả cùng một người, cùng bộ đồ, cùng bối cảnh.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { KinhThanh, LoaiPhim, NhanVat } from './kieu';
import { docKinhThanh, LOAI_PHIM } from './kieu';

const CanhSchema = z.object({
  canh: z.string().describe('Nhãn ngắn của cảnh, tiếng Việt, ví dụ "Cảnh 1 · Khu rừng buổi sáng"'),
  goc_may: z.string().describe('Góc máy + cỡ cảnh + chuyển động máy, tiếng Việt ngắn gọn'),
  hanh_dong: z.string().describe('Chuyện gì xảy ra trong cảnh, tiếng Việt, 1-2 câu'),
  loi_thoai: z.string().describe('Lời thoại hoặc lời dẫn trong cảnh (đúng ngôn ngữ của bộ phim); rỗng nếu không có'),
  am_thanh: z.string().describe('Âm thanh nền / hiệu ứng / nhạc; rỗng nếu không có'),
  thoi_luong_s: z.number().int().describe('Thời lượng clip: chỉ 4, 6 hoặc 8'),
  nhan_vat: z.array(z.string()).describe('Tên CHÍNH XÁC của các anchor (nhân vật, sản phẩm, bối cảnh) xuất hiện trong cảnh, lấy từ danh sách đã cho'),
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
  return nv.map((a) => `- [${a.loai}] ${a.ten}: ${a.mo_ta || '(chưa mô tả)'}${a.giong ? ` · giọng: ${a.giong}` : ''}`).join('\n');
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
      output_config: { format: zodOutputFormat(StoryboardSchema) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output;
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
}): Promise<{ ok: true; kichBan: string } | { ok: false; loi: string }> {
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
    return text ? { ok: true, kichBan: text } : { ok: false, loi: 'Claude không trả chữ' };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
}

/** Mô tả anchor → prompt tiếng Anh sinh "ảnh mẫu" (character sheet) để các cảnh sau tham chiếu. Không gọi LLM: ghép chuỗi là đủ. */
export function promptAnhMau(nv: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta'>, kt: KinhThanh): string {
  const k = docKinhThanh(kt);
  const loai = nv.loai === 'nhan_vat' ? 'Character reference sheet, full body, front view, neutral pose, plain light background'
    : nv.loai === 'san_pham' ? 'Product reference shot, centered, soft studio lighting, plain background, exact product details'
    : nv.loai === 'boi_canh' ? 'Establishing shot of the location, wide angle, no characters'
    : nv.loai === 'dao_cu' ? 'Prop reference shot, centered, plain background' : 'Style reference frame';
  return `${loai}. ${nv.mo_ta}. Visual style: ${k.phong_cach || 'consistent cinematic look'}.`;
}
