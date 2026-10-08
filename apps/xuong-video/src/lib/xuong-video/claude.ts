// Adapter Claude cho xưởng video: viết kịch bản + tách kịch bản thành cảnh (storyboard) dạng JSON có cấu trúc.
// Nhân vật/bối cảnh của bộ phim (anchor) được đưa vào prompt để mọi cảnh, mọi tập tả cùng một người, cùng bộ đồ, cùng bối cảnh.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';   // helper zodOutputFormat của SDK cần zod v4 (zod 3.25 kèm sẵn ở 'zod/v4'); import 'zod' gốc → TypeError 'def'
import { THU_VIEN, THE_LOAI, CAU_TRUC, hopTheLoai, NHOM_KY_THUAT, type NhomKyThuat } from './dien-anh';
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
// Kỹ thuật điện ảnh: chuỗi kèm danh sách key hợp lệ trong mô tả. KHÔNG dùng z.enum: helper SDK chuyển enum thành mô tả rồi parse lại
// bằng zod — Claude lỡ một key lạ là cả lượt tách cảnh hỏng. Key lạ do máy chủ lọc bỏ (lamSachKyThuat), shot vẫn giữ.
const enumNhom = (n: NhomKyThuat) => z.string().describe(`Một key trong: ${THU_VIEN.filter((x) => x.nhom === n).map((x) => x.key).join(', ')}`);
const KyThuatSchema = z.object({
  co_canh: enumNhom('co_canh'), goc: enumNhom('goc'), chuyen_dong: enumNhom('chuyen_dong'), ong_kinh: enumNhom('ong_kinh'),
  anh_sang: enumNhom('anh_sang'), mau: enumNhom('mau'), chuyen_canh: enumNhom('chuyen_canh'),
  am_thanh: z.array(enumNhom('am_thanh')).describe('1-2 lớp âm thanh hiện trường của shot'), nhac: enumNhom('nhac'),
});
const DongThoaiSchema = z.object({
  nhan_vat: z.string().describe('Tên CHÍNH XÁC nhân vật nói (từ danh sách anchor); rỗng nếu là lời dẫn'),
  dien_xuat: z.string().describe('Diễn xuất trong ngoặc như kịch bản phim: hành động/biểu cảm khi nói, vd "nhìn lên, giơ tay", "thì thầm", "cười khẩy"; rỗng nếu không cần'),
  loi: z.string().describe('Lời nói, đúng giọng nhân vật, có ẩn ý khi hợp'),
});
const ShotSchema = CanhSchema.extend({
  thoai: z.array(DongThoaiSchema).describe('Thoại của shot theo dòng kiểu kịch bản phim chuyên nghiệp (mỗi lượt nói một dòng); rỗng nếu shot không có thoại. Trường loi_thoai để rỗng.'),
  cam_xuc: z.number().int().describe('Giá trị cảm xúc của khán giả ở CUỐI shot, từ -5 (đau/sợ/tuyệt vọng) tới +5 (vui/hy vọng/chiến thắng)'),
  ky_thuat: KyThuatSchema.describe('Ngôn ngữ điện ảnh của shot, chọn từ thư viện cho hợp thể loại + cảm xúc'),
});
const StoryboardSchema = z.object({
  tom_tat: z.string().describe('Tóm tắt nội dung tập này trong 2-3 câu, tiếng Việt, để tập sau nối mạch'),
  beats: z.array(z.object({ ten: z.string(), mo_ta: z.string().describe('Beat này xảy ra gì trong tập, 1 câu tiếng Việt'), cam_xuc: z.number().int().describe('-5..5') })).describe('Cấu trúc beat của tập theo khung đã cho'),
  phan_canh: z.array(z.object({
    ten: z.string().describe('Tên phân cảnh ngắn, tiếng Việt, duy nhất trong tập'),
    beat: z.string().describe('Thuộc beat nào (đúng tên beat)'),
    muc_tieu: z.string().describe('Nhân vật muốn đạt gì trong phân cảnh này'),
    xung_dot: z.string().describe('Cái gì cản trở / đối lập'),
    an_y: z.string().describe('Ẩn ý dưới lời thoại (điều nhân vật cảm mà không nói), rỗng nếu không có'),
    nhip: z.string().describe('cham | vua | nhanh'),
    cam_xuc_dau: z.number().int().describe('-5..5'), cam_xuc_cuoi: z.number().int().describe('-5..5, phải KHÁC đầu: phân cảnh nào cũng đổi giá trị'),
    shots: z.array(ShotSchema).describe('Các shot của phân cảnh, theo thứ tự'),
  })),
});
export type CanhSinh = z.infer<typeof ShotSchema> & { phan_doan: string };
export type PhanCanhSinh = Omit<z.infer<typeof StoryboardSchema>['phan_canh'][number], 'shots'>;

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
${kt.the_loai ? `Thể loại: ${THE_LOAI.find((t) => t.key === kt.the_loai)?.ten} (${THE_LOAI.find((t) => t.key === kt.the_loai)?.mo_ta}).` : ''}${kt.logline ? `\nLogline: ${kt.logline}` : ''}${kt.chu_de ? `\nChủ đề: ${kt.chu_de}` : ''}
${taQc(kt)}
QUY TẮC ĐỒNG NHẤT: nhân vật, sản phẩm, bối cảnh phải tả bằng đúng đặc tính cố định trong danh sách anchor ở mọi cảnh (cùng màu lông, cùng trang phục, cùng tỉ lệ cơ thể, cùng chất liệu). prompt_anh và prompt_video viết tiếng Anh, tả người/vật theo đặc tính chứ không dùng tên riêng (model ảnh không biết tên). Mỗi prompt tự đứng được một mình, không tham chiếu cảnh khác.`;

/** Thư viện điện ảnh rút gọn cho prompt: kỹ thuật hợp thể loại trước, mỗi dòng "key — tên: dùng khi nào". */
function taThuVien(tl: string): string {
  return NHOM_KY_THUAT.map((n) => {
    const ds = THU_VIEN.filter((x) => x.nhom === n.key);
    const hop = ds.filter((x) => hopTheLoai(x, (tl || undefined) as never));
    const khac = ds.filter((x) => !hop.includes(x));
    return `[${n.key}] ${n.ten}:\n${hop.map((x) => `  ${x.key} — ${x.ten}: ${x.mo_ta}`).join('\n')}${khac.length ? `\n  (ít hợp thể loại: ${khac.map((x) => x.key).join(', ')})` : ''}`;
  }).join('\n');
}
const HUONG_DAN_DAO_DIEN = `CÁCH DỰNG NHƯ PHIM ĐIỆN ẢNH (bắt buộc):
- Tầng truyện: chia tập theo khung beat đã cho; mỗi beat có giá trị cảm xúc (-5..5) để thành một đường cong lên xuống, không phẳng.
- Tầng phân cảnh (scene): mỗi phân cảnh có mục tiêu của nhân vật, xung đột cản trở, và cảm xúc ĐỔI giá trị từ đầu tới cuối (vd +2 → -3). Thoại có ẩn ý khi được — nhân vật hiếm khi nói thẳng điều mình cảm.
- Tầng shot: mỗi phân cảnh 2-5 shot. Mở bằng shot thiết lập (toàn cảnh) khi tới nơi mới; hội thoại dùng qua vai / cận trung luân phiên, giữ trục 180°; khoảnh khắc cảm xúc dùng cận mặt hoặc đặc tả phản ứng; chèn insert cho vật quan trọng. Nhịp nhanh = shot 4 giây, cắt nhiều; nhịp chậm = shot 6-8 giây, máy đẩy chậm.
- Ngôn ngữ điện ảnh: mỗi shot chọn cỡ cảnh, góc, chuyển động máy, ống kính, ánh sáng, màu, chuyển cảnh sang shot sau, 1-2 lớp âm thanh, nhạc — CHỈ dùng key trong THƯ VIỆN bên dưới, ưu tiên kỹ thuật hợp thể loại; ánh sáng/màu đổi theo cảm xúc (ấm khi hy vọng, lạnh/tối khi sợ hãi/mất mát) nhưng vẫn trong phong cách chung.
- prompt_anh phải tả đúng cỡ cảnh + góc + ánh sáng đã chọn; prompt_video tả đúng chuyển động máy + âm thanh đã chọn.
- QUẢNG CÁO: sản phẩm là nhân vật chính thứ hai — mọi shot có người mặc/cầm/dùng/nhắc tới sản phẩm PHẢI có tên anchor sản phẩm trong trường nhan_vat (để keyframe tham chiếu đúng ảnh sản phẩm thật), và prompt_anh tả sản phẩm hiện rõ trong khung; ít nhất 2/3 số shot thấy sản phẩm.`;

/** Tách kịch bản thành cảnh. `soCanh` = số cảnh mong muốn (0 = để Claude tự chia). */
export async function tachCanh(opts: {
  loai: LoaiPhim; kinhThanh: KinhThanh; nhanVat: NhanVat[]; kichBan: string; soCanh?: number; tapTruoc?: string[];
}): Promise<{ ok: true; tomTat: string; canh: CanhSinh[]; beats: { ten: string; mo_ta: string; cam_xuc: number }[]; phanCanh: PhanCanhSinh[]; model: string; tokens: { in: number; out: number } } | { ok: false; loi: string }> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(opts.kinhThanh);
  const user = [
    `DANH SÁCH ANCHOR (dùng đúng tên trong trường nhan_vat):\n${taAnchor(opts.nhanVat)}`,
    opts.tapTruoc?.length ? `TÓM TẮT CÁC TẬP TRƯỚC (nối mạch, không kể lại):\n${opts.tapTruoc.map((t, i) => `Tập ${i + 1}: ${t}`).join('\n')}` : '',
    `KỊCH BẢN:\n${opts.kichBan.trim()}`,
    `KHUNG BEAT (${CAU_TRUC[opts.loai]?.ten ?? CAU_TRUC.phim!.ten}):\n${(CAU_TRUC[opts.loai] ?? CAU_TRUC.phim!).beats.map((b) => `- ${b.ten}: ${b.mo_ta}`).join('\n')}`,
    `THƯ VIỆN ĐIỆN ẢNH (chọn key cho từng shot):\n${taThuVien(kt.the_loai)}`,
    opts.soCanh ? `Tổng khoảng ${opts.soCanh} shot.` : 'Số shot vừa đủ kể hết kịch bản, mỗi shot 4-8 giây.',
  ].filter(Boolean).join('\n\n');
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu,
      max_tokens: 16000,
      system: `${heThong(opts.loai, kt)}\n\n${HUONG_DAN_DAO_DIEN}`,
      messages: [{ role: 'user', content: user }],
      // Kiểu của helper khai theo zod v3 nhưng runtime cần v4 (đã thử: v3 → TypeError 'def', v4 chạy) → ép kiểu ở ranh này.
      output_config: { format: zodOutputFormat(StoryboardSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof StoryboardSchema> | null;
    if (!p) return { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
    const kep = (v: number) => Math.max(-5, Math.min(5, Math.round(v)));
    const canh: CanhSinh[] = p.phan_canh.flatMap((pc) => pc.shots.map((x) => ({ ...x, phan_doan: pc.ten, cam_xuc: kep(x.cam_xuc), thoi_luong_s: x.thoi_luong_s <= 4 ? 4 : x.thoi_luong_s <= 6 ? 6 : 8 })));
    const phanCanh: PhanCanhSinh[] = p.phan_canh.map(({ shots: _s, ...pc }) => ({ ...pc, cam_xuc_dau: kep(pc.cam_xuc_dau), cam_xuc_cuoi: kep(pc.cam_xuc_cuoi) }));
    const beats = p.beats.map((b) => ({ ...b, cam_xuc: kep(b.cam_xuc) }));
    return { ok: true, tomTat: p.tom_tat, canh, beats, phanCanh, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } };
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
    `KHUNG BEAT (${CAU_TRUC[opts.loai]?.ten ?? CAU_TRUC.phim!.ten}):\n${(CAU_TRUC[opts.loai] ?? CAU_TRUC.phim!).beats.map((b) => `- ${b.ten}: ${b.mo_ta}`).join('\n')}`,
    'Viết kịch bản đúng định dạng kịch bản phim chuyên nghiệp, đánh số cảnh (Cảnh 1, Cảnh 2…). Mỗi cảnh: dòng tiêu đề (NỘI/NGOẠI. ĐỊA ĐIỂM – THỜI ĐIỂM), đoạn hành động, rồi thoại theo khuôn:\nTÊN NHÂN VẬT\n  (diễn xuất: nhìn lên, giơ tay…)\n  Lời nói.\nĐi đúng khung beat trên. Mỗi cảnh ghi: bối cảnh, mục tiêu + xung đột của nhân vật, hành động, lời thoại (có ẩn ý, đúng giọng từng nhân vật), cảm xúc chuyển từ đâu tới đâu, không khí (ánh sáng, âm thanh). Cảm xúc của tập phải có lên có xuống. Không giải thích thêm, chỉ trả kịch bản.',
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
// "Sinh thêm" mà vẫn đưa ảnh cũ làm tham chiếu + đúng prompt cũ → model chép y lại ảnh cũ (08/10/2026: hai ảnh Đường mòn Rêu Phong
// giống hệt). Mỗi lần sinh thêm đổi sang một góc/khuôn hình khác theo lượt; ảnh cũ chỉ để giữ danh tính, không để sao chép.
const GOC_THEM: Record<string, string[]> = {
  nhan_vat: ['Full-body action pose sheet: walking, running, sitting, pointing, waving', 'Close-up expression sheet: laughing, angry, scared, thinking, crying, determined', 'Character shown in a natural three-quarter view standing in soft daylight, medium shot', 'Back and side detail sheet: outfit, accessories, hands and feet close-ups'],
  boi_canh: ['Same location seen from the OPPOSITE direction, reverse angle', 'Low ground-level angle looking up, close foreground details', 'High aerial bird-eye view of the whole place', 'Medium shot focusing on one landmark detail of the place', 'Wide shot from the far side, the place seen at a distance'],
  san_pham: ['Product from a 45-degree side angle', 'Macro close-up of material texture and stitching details', 'Flat lay top-down shot', 'Back view of the product'],
  dao_cu: ['Prop from a different angle, side view', 'Macro close-up detail of the prop', 'Prop held in a hand for scale'],
};
export function promptAnhMau(nv: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta'>, kt: KinhThanh, daCo = 0): string {
  if (daCo > 0) {
    const ds = GOC_THEM[nv.loai] ?? GOC_THEM.boi_canh!;
    const goc = ds[(daCo - 1) % ds.length]!;
    return `${goc}. Subject: ${nv.mo_ta}. Visual style: ${docKinhThanh(kt).phong_cach || 'consistent cinematic look'}. `
      + 'The reference images only define the identity/design of the subject — create a NEW image with a clearly DIFFERENT camera angle and composition; do NOT reproduce the reference image.';
  }
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
  the_loai: z.string().describe(`Thể loại hợp nhất — một key trong: ${THE_LOAI.map((t) => t.key).join(', ')}`),
  logline: z.string().describe('Một câu tiếng Việt: nhân vật chính · muốn gì · cái gì cản trở'),
  chu_de: z.string().describe('Chủ đề — điều bộ phim muốn nói, một câu ngắn tiếng Việt'),
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
const CanhLaiSchema = ShotSchema;   // viết lại một shot: kèm cảm xúc + kỹ thuật điện ảnh từ thư viện

export type DungChu = { model: string; tokens: { in: number; out: number } };
type GoiYKq<T> = ({ ok: true; data: T } & DungChu) | { ok: false; loi: string };

/** Sản phẩm / dịch vụ của phim quảng cáo — nằm trong MỌI ngữ cảnh gửi Claude (gợi ý, kịch bản, tách cảnh). */
export function taQc(kt: Required<KinhThanh>): string {
  const q = kt.qc;
  if (!q || !(q.ten || q.link || q.diem_noi_bat)) return '';
  return `SẢN PHẨM / DỊCH VỤ ĐƯỢC QUẢNG CÁO (bám đúng, không bịa tính năng):\n${[
    q.ten && `- Tên: ${q.ten}`, q.link && `- Trang: ${q.link}`, q.diem_noi_bat && `- Điểm nổi bật: ${q.diem_noi_bat}`,
    q.doi_tuong && `- Khách hàng mục tiêu: ${q.doi_tuong}`, q.uu_dai && `- Ưu đãi / CTA: ${q.uu_dai}`, q.thi_truong && `- Thị trường: ${q.thi_truong}`,
  ].filter(Boolean).join('\n')}`;
}
function taNguCanh(nc: NguCanhPhim): string {
  const kt = docKinhThanh(nc.kinhThanh);
  return [
    `BỘ PHIM: ${nc.ten} (${LOAI_PHIM.find((l) => l.key === nc.loai)?.label ?? nc.loai})`,
    nc.mo_ta ? `TIỀN ĐỀ: ${nc.mo_ta}` : '',
    kt.phong_cach ? `PHONG CÁCH CỐ ĐỊNH: ${kt.phong_cach}` : '',
    taQc(kt),
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
  hoi(KinhThanhSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết PHONG CÁCH HÌNH ẢNH cố định, TIỀN ĐỀ, THỂ LOẠI, LOGLINE và CHỦ ĐỀ cho bộ phim này. Nếu đã có thì giữ ý, viết rõ và cụ thể hơn (chất liệu, màu, ánh sáng, lens).`);

export const goiYAnchor = (nc: NguCanhPhim, a: { loai: LoaiNhanVat; ten: string; mo_ta: string }) =>
  hoi(AnchorSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết đặc tính CỐ ĐỊNH cho anchor mới: loại=${a.loai}, tên="${a.ten}"${a.mo_ta ? `, ý đã có: ${a.mo_ta}` : ''}. Phải hợp phong cách và không trùng/đụng với các anchor đã có.`);

export const goiYBoAnchor = (nc: NguCanhPhim) =>
  hoi(BoAnchorSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nĐề xuất tuyến nhân vật / sản phẩm / bối cảnh / đạo cụ còn THIẾU (không lặp lại anchor đã có) dựa trên tiền đề và kịch bản các tập. Phim ngắn nhiều tập: 2-4 nhân vật chính, 1-2 bối cảnh, đạo cụ then chốt. Quảng cáo: sản phẩm + 1 người dùng + 1 bối cảnh.`);

export const goiYBrief = (nc: NguCanhPhim, tapSo: number, thoiLuongS: number) =>
  hoi(BriefSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết BRIEF cho tập ${tapSo} (tổng ${thoiLuongS} giây) để sau đó viết kịch bản: nối mạch tập trước, có xung đột và kết mở (hoặc CTA nếu là quảng cáo/short).`);

export const goiYCanh = (nc: NguCanhPhim, c: { thu_tu: number; canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; nhan_vat: string[] }, truoc?: string, sau?: string) =>
  hoi(CanhLaiSchema, docKinhThanh(nc.kinhThanh), heThong(nc.loai, docKinhThanh(nc.kinhThanh)) + '\n' + HE_THONG_GOI_Y,
    `${taNguCanh(nc)}\n\n${truoc ? `CẢNH TRƯỚC: ${truoc}\n` : ''}${sau ? `CẢNH SAU: ${sau}\n` : ''}\nViết lại đầy đủ CẢNH #${c.thu_tu}: nhãn "${c.canh}", góc máy "${c.goc_may}", hành động "${c.hanh_dong}", lời thoại "${c.loi_thoai}", anchor trong cảnh: ${c.nhan_vat.join(', ') || '(tự chọn từ tuyến)'}. Giữ ý người đã viết, bổ sung chỗ trống, sinh prompt_anh + prompt_video tiếng Anh khớp cảnh trước/sau và đúng đặc tính anchor; chọn cảm xúc cuối shot và ngôn ngữ điện ảnh (key trong thư viện) hợp thể loại.\n\nTHƯ VIỆN ĐIỆN ẢNH:\n${taThuVien(docKinhThanh(nc.kinhThanh).the_loai)}`);

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

// ── Đọc trang sản phẩm → thông tin quảng cáo (#1201) ──────────────────────────────────────────────────────────
const QcSchema = z.object({
  ten: z.string().describe('Tên sản phẩm/dịch vụ ngắn gọn'),
  diem_noi_bat: z.string().describe('3-6 điểm nổi bật/lợi ích cụ thể có trên trang (chất liệu, công dụng, khác biệt), viết gọn, đúng ngôn ngữ của trang'),
  doi_tuong: z.string().describe('Khách hàng mục tiêu suy ra từ trang (tuổi, giới, nhu cầu)'),
  uu_dai: z.string().describe('Giá / giảm giá / quà / miễn phí ship… có trên trang; rỗng nếu không thấy'),
  thi_truong: z.string().describe('Thị trường + ngôn ngữ quảng cáo nên dùng (vd "Mỹ · tiếng Anh")'),
  anh: z.array(z.string()).describe('Tối đa 6 URL ảnh SẢN PHẨM rõ nhất lấy từ danh sách ảnh đã cho (bỏ logo, icon, banner)'),
});
export async function docTrangSanPham(link: string, trang: { tieuDe: string; moTa: string; chu: string; anh: string[] }, kt: Required<KinhThanh>) {
  return hoi(QcSchema, kt, 'Bạn đọc trang bán hàng và rút thông tin để làm video quảng cáo. Chỉ ghi điều có trên trang, không bịa.',
    `LINK: ${link}\nTIÊU ĐỀ: ${trang.tieuDe}\nMÔ TẢ: ${trang.moTa}\nẢNH TRÊN TRANG:\n${trang.anh.slice(0, 40).join('\n')}\nCHỮ TRÊN TRANG (rút gọn):\n${trang.chu.slice(0, 12000)}`);
}

