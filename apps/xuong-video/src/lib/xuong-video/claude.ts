// Adapter Claude cho xưởng video: viết kịch bản + tách kịch bản thành cảnh (storyboard) dạng JSON có cấu trúc.
// Nhân vật/bối cảnh của bộ phim (anchor) được đưa vào prompt để mọi cảnh, mọi tập tả cùng một người, cùng bộ đồ, cùng bối cảnh.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';   // helper zodOutputFormat của SDK cần zod v4 (zod 3.25 kèm sẵn ở 'zod/v4'); import 'zod' gốc → TypeError 'def'
import { THU_VIEN, THE_LOAI, CAU_TRUC, giayBeat, hopTheLoai, NHOM_KY_THUAT, type NhomKyThuat } from './dien-anh';
import type { BienThe, DoiChieu, KinhThanh, LoaiNhanVat, LoaiPhim, NhanVat } from './kieu';
import { docKinhThanh, lamTronClip, LOAI_PHIM, CAM_XUC_KHAN_GIA, LOAI_SHOT_MAU, giayMau, coMau, type BaiDang, type ShotMau } from './kieu';

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
  trang_phuc: z.string().describe('Trang phục của người trong shot NẾU khác bộ đồ trong mô tả anchor, ghi rõ và đủ (tiếng Anh hoặc Việt), vd "chỉ mặc áo bra không gọng màu be và quần jean, KHÔNG áo ngoài, lộ vai". Quảng cáo đồ mặc (áo lót, đồ bơi, áo…): shot khoe/demo sản phẩm phải ghi rõ người CHỈ mặc sản phẩm ở phần đó, không áo khoác ngoài. Rỗng nếu giữ bộ đồ mặc định.'),
  thoai: z.array(DongThoaiSchema).describe('Thoại của shot theo dòng kiểu kịch bản phim chuyên nghiệp (mỗi lượt nói một dòng); rỗng nếu shot không có thoại. Trường loi_thoai để rỗng.'),
  cam_xuc: z.number().int().describe(`Cảm xúc KHÁN GIẢ ở CUỐI shot theo thang: ${Object.entries(CAM_XUC_KHAN_GIA).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k} ${v}`).join(', ')}`),
  ky_thuat: KyThuatSchema.describe('Ngôn ngữ điện ảnh của shot, chọn từ thư viện cho hợp thể loại + cảm xúc'),
  phat_s: z.number().describe('Số giây shot THỰC PHÁT trong bản dựng (1.5–8, bước 0.5). Clip sinh 4/6/8s rồi cắt lấy phat_s giây đầu. Quảng cáo: hook, insert, demo 1.5–3s; thoại dài hơn thì 4–6s. Tổng phat_s của cả tập phải bằng thời lượng mục tiêu ±10%.'),
  chu_man: z.string().describe('Chữ hiện trên màn trong shot (đúng ngôn ngữ phim, ≤ 8 từ): câu hook, số liệu, tên tính năng, ưu đãi, CTA. Quảng cáo: BẮT BUỘC ở shot hook và shot CTA, nên có ở bằng chứng/ưu đãi; phim/short: rỗng trừ khi cần.'),
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
  hook_bien_the: z.array(z.object({
    ten: z.string().describe('Tên ngắn góc tiếp cận, vd "tò mò", "so sánh trước/sau", "bằng chứng"'),
    shots: z.array(ShotSchema).describe('1–2 shot THAY THẾ cho các shot của beat đầu (Hook); tổng phat_s bằng hook chính ±1s; vẫn dùng đúng anchor'),
  })).describe('Quảng cáo / short: 2 phương án hook KHÁC góc tiếp cận với hook chính (vd hook chính = nỗi đau → phương án: câu hỏi tò mò, so sánh trước/sau, số liệu sốc). Để A/B trên Meta/TikTok với cùng một thân. Phim nhiều tập: mảng rỗng.'),
});
export type CanhSinh = z.infer<typeof ShotSchema> & { phan_doan: string; nhanh: string };
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
- CẢM XÚC vào hình: prompt_anh tả biểu cảm mặt + tư thế khớp diễn xuất (dien_xuat) của câu đầu và không khí khớp cam_xuc khán giả cuối shot; prompt_video tả diễn xuất theo từng câu thoại (nét mặt, cử chỉ, nhịp) — viết bằng tiếng Anh.
- QUẢNG CÁO: sản phẩm là nhân vật chính thứ hai — mọi shot có người mặc/cầm/dùng/nhắc tới sản phẩm PHẢI có tên anchor sản phẩm trong trường nhan_vat (để keyframe tham chiếu đúng ảnh sản phẩm thật), và prompt_anh tả sản phẩm hiện rõ trong khung; ít nhất 2/3 số shot thấy sản phẩm.`;

/** Luật riêng quảng cáo — thứ ads thật đo được, bộ kiểm kiem-qc.ts chấm lại đúng các mục này sau khi tách. */
const HUONG_DAN_QC = `LUẬT QUẢNG CÁO (bắt buộc, máy sẽ chấm lại):
- 85% người xem TẮT TIẾNG: mọi ý chính phải THẤY bằng hình + chu_man, không chỉ bằng lời. Hook và CTA bắt buộc có chu_man (≤ 8 từ).
- Hook (shot đầu, phat_s ≤ 3): giây đầu tiên phải có HÌNH gây dừng tay — chuyển động mạnh, cận bất thường, so sánh, kết quả, mặt biểu cảm — không mở bằng người ngồi nói. Câu hook gọi đúng người xem (nỗi đau / mong muốn / câu hỏi).
- Sản phẩm xuất hiện trong khung TRƯỚC giây thứ 5. Demo = cận chi tiết thật + trước/sau + dùng thử trong đời thường, mỗi shot một ý.
- Bằng chứng: CHỈ dùng số liệu, đánh giá, chính sách CÓ TRONG mục SẢN PHẨM (số đánh giá, số khách, giá, ngày đổi trả). Không có số thì dùng lời người dùng thật, KHÔNG bịa con số hay tính năng.
- Trước CTA: một câu/chữ trấn an (đổi trả, size, bảo hành, ship) nếu mục sản phẩm có. Shot CTA: chu_man = ưu đãi + hành động cụ thể (giá, giảm bao nhiêu, bấm đâu).
- Thoại ngắn: ≤ 2,5 từ cho mỗi giây phát của shot. Shot không thoại cũng được — hình + chữ.
- Cắt nhanh: phần lớn shot phat_s 1,5–3s; chỉ shot có thoại dài mới 4–6s. Tổng phat_s = thời lượng mục tiêu ±10%.
- hook_bien_the: 2 phương án hook khác góc (tò mò · trước/sau · số liệu/bằng chứng · nỗi đau khác), mỗi phương án 1–2 shot, thay thế đúng các shot của beat Hook.`;

/** Bám QC mẫu 1:1 — thứ làm bản clone "gần giống nhất" (anh 09/10/2026): cùng nhịp cắt, cùng chỗ đặt chữ, chỉ đổi sản phẩm. */
const HUONG_DAN_MAU = (so: number) => `BÁM QC MẪU 1:1 (bắt buộc, máy chấm lại):
- Đúng ${so} shot, theo đúng THỨ TỰ và đúng GIÂY (phat_s) của từng shot mẫu; không gộp, không thêm, không đảo.
- Shot i của bản mới cùng LOẠI với shot i của mẫu (hook/ưu đãi/tính năng/so sánh/bằng chứng/CTA/end card) và cùng kiểu hình (cận chi tiết ↔ cận chi tiết, người mặc thử ↔ người mặc thử, so sánh ↔ so sánh).
- chu_man: shot mẫu có chữ thì shot mới PHẢI có chữ cùng ý, cùng độ dài (≤ 8 từ), viết lại cho ĐÚNG sản phẩm của mình — không chép nguyên câu, không bịa số/tính năng ngoài mục SẢN PHẨM.
- Mẫu dùng NHIỀU người khác nhau (kiểu UGC ghép) thì luân phiên các anchor nhân vật có sẵn; mẫu có bình luận/ảnh ghép thì tả thành một khung hình tương đương (ảnh chụp màn hình bình luận, lưới 4 người mặc) trong prompt_anh.
- Mẫu ưu đãi gì thì bản mới dùng ưu đãi trong mục SẢN PHẨM; thiếu thì dùng câu kêu gọi không số.
- hook_bien_the: vẫn đưa 2 phương án hook khác góc, cùng số giây với shot hook mẫu.`;

/** Tách kịch bản thành cảnh. `soCanh` = số cảnh mong muốn (0 = để Claude tự chia). Phim có QC mẫu → bám mẫu, bỏ qua soCanh/thoiLuongS. */
export async function tachCanh(opts: {
  loai: LoaiPhim; kinhThanh: KinhThanh; nhanVat: NhanVat[]; kichBan: string; soCanh?: number; tapTruoc?: string[]; thoiLuongS?: number;
  /** Đoạn THƯ VIỆN KHUÔN SHOT (khuon-shot.taKhuon) — hình đã dùng ở QC trước để Claude dùng lại. */ khuon?: string;
}): Promise<{ ok: true; tomTat: string; canh: CanhSinh[]; beats: { ten: string; mo_ta: string; cam_xuc: number }[]; phanCanh: PhanCanhSinh[]; model: string; tokens: { in: number; out: number } } | { ok: false; loi: string }> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(opts.kinhThanh);
  const laQc = opts.loai === 'quang_cao';
  const khung = CAU_TRUC[opts.loai] ?? CAU_TRUC.phim!;
  // Có QC MẪU → khuôn của mẫu thắng mọi thứ: số shot = số shot mẫu, thời lượng = tổng giây mẫu, beat chỉ để tham khảo.
  const mau = laQc && coMau(kt.qc) ? kt.qc.mau! : null;
  if (mau) { opts = { ...opts, soCanh: mau.shots.length, thoiLuongS: giayMau(mau) }; }
  // Thời lượng mục tiêu chia cho từng beat (quảng cáo có tỉ lệ sẵn) → Claude biết hook được mấy giây, không tự kéo 24s thành 64s.
  const giayTheoBeat = opts.thoiLuongS && !mau ? giayBeat(opts.loai, opts.thoiLuongS) : null;
  const user = [
    `DANH SÁCH ANCHOR (dùng đúng tên trong trường nhan_vat):\n${taAnchor(opts.nhanVat)}`,
    opts.tapTruoc?.length ? `TÓM TẮT CÁC TẬP TRƯỚC (nối mạch, không kể lại):\n${opts.tapTruoc.map((t, i) => `Tập ${i + 1}: ${t}`).join('\n')}` : '',
    `KỊCH BẢN:\n${opts.kichBan.trim()}`,
    `KHUNG BEAT (${khung.ten}):\n${khung.beats.map((b, i) => `- ${b.ten}: ${b.mo_ta}${giayTheoBeat ? ` → giây ${giayTheoBeat[i]!.tu}–${giayTheoBeat[i]!.den}` : ''}`).join('\n')}`,
    `THƯ VIỆN ĐIỆN ẢNH (chọn key cho từng shot):\n${taThuVien(kt.the_loai)}`,
    opts.khuon ?? '',
    opts.thoiLuongS ? `THỜI LƯỢNG MỤC TIÊU: ${opts.thoiLuongS} giây — tổng phat_s của mọi shot (trừ hook_bien_the) phải trong khoảng ${Math.round(opts.thoiLuongS * 0.9)}–${Math.round(opts.thoiLuongS * 1.1)} giây.` : '',
    mau ? HUONG_DAN_MAU(mau.shots.length) : opts.soCanh ? `Tổng khoảng ${opts.soCanh} shot.` : laQc ? 'Số shot theo nhịp quảng cáo: phần lớn shot phát 1,5–3 giây.' : 'Số shot vừa đủ kể hết kịch bản, mỗi shot 4-8 giây.',
  ].filter(Boolean).join('\n\n');
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu,
      max_tokens: 16000,
      system: `${heThong(opts.loai, kt)}\n\n${HUONG_DAN_DAO_DIEN}${laQc ? `\n\n${HUONG_DAN_QC}` : ''}`,
      messages: [{ role: 'user', content: user }],
      // Kiểu của helper khai theo zod v3 nhưng runtime cần v4 (đã thử: v3 → TypeError 'def', v4 chạy) → ép kiểu ở ranh này.
      output_config: { format: zodOutputFormat(StoryboardSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof StoryboardSchema> | null;
    if (!p) return { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
    const kep = (v: number) => Math.max(-5, Math.min(5, Math.round(v)));
    // phat_s = giây thực phát (1–8, bước 0,5); clip sinh = làm tròn lên 4/6/8. Claude quên phat_s thì lấy thoi_luong_s.
    const phat = (x: z.infer<typeof ShotSchema>) => { const g = Number.isFinite(x.phat_s) && x.phat_s > 0 ? x.phat_s : x.thoi_luong_s; return Math.max(1, Math.min(8, Math.round(g * 2) / 2)); };
    const chuan = (x: z.infer<typeof ShotSchema>, phan_doan: string, nhanh: string): CanhSinh => ({ ...x, phan_doan, nhanh, cam_xuc: kep(x.cam_xuc), phat_s: phat(x), thoi_luong_s: lamTronClip(phat(x)), chu_man: (x.chu_man ?? '').trim() });
    // Hook chính = shot của phân cảnh thuộc beat đầu; có phương án thay thế thì hook chính mang nhánh 'A', phương án 'B', 'C'…
    const beatDau = khung.beats[0]?.ten ?? '';
    const bienThe = (p.hook_bien_the ?? []).filter((h) => h.shots.length);
    const laHook = (pc: { beat: string }) => bienThe.length > 0 && pc.beat.trim().toLowerCase() === beatDau.toLowerCase();
    const canh: CanhSinh[] = p.phan_canh.flatMap((pc) => pc.shots.map((x) => chuan(x, pc.ten, laHook(pc) ? 'A' : '')));
    const pcHook = p.phan_canh.find(laHook);
    if (pcHook) bienThe.forEach((h, i) => { const nhanh = String.fromCharCode(66 + i); canh.push(...h.shots.map((x) => chuan(x, `${pcHook.ten} · ${h.ten}`, nhanh))); });
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
  ].filter(Boolean).join('\n')}${taMau(kt)}`;
}
/** QC MẪU làm khuôn: xương sống theo thời gian + bài đăng của mẫu. Rỗng nếu phim không có mẫu. */
export function taMau(kt: Required<KinhThanh>): string {
  const m = kt.qc?.mau;
  if (!m || !coMau(kt.qc)) return '';
  const ten = (k: string) => LOAI_SHOT_MAU.find((x) => x.key === k)?.ten ?? k;
  let t = 0;
  const dong = m.shots.map((s, i) => { const tu = t; t += Number(s.giay) || 0; return `${i + 1}. [${tu}s–${Math.round(t * 10) / 10}s · ${s.giay}s · ${ten(s.loai)}] chữ màn mẫu: "${s.chu_man || '—'}" · hình: ${s.hinh || '—'}`; });
  return `\n\nQC MẪU LÀM KHUÔN (một quảng cáo đang bán tốt — bám cấu trúc của nó, KHÔNG chép nguyên chữ):${m.nguon ? `\n- Nguồn: ${m.nguon}` : ''}${m.ghi_chu ? `\n- Ghi chú: ${m.ghi_chu}` : ''}
- ${m.shots.length} shot, tổng ${giayMau(m)} giây:\n${dong.join('\n')}${m.chu_bai ? `\n- Văn bản chính của bài đăng mẫu:\n${m.chu_bai}` : ''}${m.tieu_de ? `\n- Tiêu đề mẫu: ${m.tieu_de}` : ''}${m.cta ? `\n- Nút mẫu: ${m.cta}` : ''}`;
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

// ── Đối chiếu ảnh gốc của anchor với mô tả (review 09/10/2026) ───────────────────────────────────────────────────
// Ảnh sản phẩm có ren, chữ thương hiệu, màu hồng — mô tả ghi "be nude, không ren, khoá 3 nấc" → mọi keyframe/kịch bản khoe một chiếc
// áo không tồn tại. Claude NHÌN ảnh rồi liệt kê chỗ lệch + viết lại mô tả theo ảnh; người bấm "dùng mô tả đề xuất" là xong.
const DoiChieuSchema = z.object({
  khop: z.boolean().describe('true nếu mô tả tả đúng thứ trong ảnh (màu, chất liệu, chi tiết, chữ/logo, dáng) — lệch nhỏ về tính cách/giọng không tính'),
  lech: z.array(z.string()).describe('Từng chỗ lệch, tiếng Việt, mỗi dòng "mô tả nói X — ảnh cho thấy Y"; rỗng nếu khớp'),
  mo_ta_de_xuat: z.string().describe('Mô tả cố định viết lại THEO ẢNH (3-5 câu, cùng ngôn ngữ mô tả cũ), giữ các ý đúng của mô tả cũ, bỏ thứ ảnh không có; sản phẩm: ghi rõ màu, chất liệu, chi tiết nhìn thấy, chữ/logo in trên sản phẩm (nếu có)'),
});
export async function doiChieuAnchor(a: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta' | 'anh_ref'>, kt: Required<KinhThanh>): Promise<GoiYKq<Omit<DoiChieu, 'luc'>>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const anh = a.anh_ref.filter((u) => /^https?:\/\//.test(u)).slice(0, 4);
  if (!anh.length) return { ok: false, loi: 'anchor chưa có ảnh gốc' };
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu, max_tokens: 2000,
      system: 'Bạn kiểm tra ảnh tham chiếu của xưởng video AI: mô tả cố định của một anchor có tả ĐÚNG thứ trong ảnh không. Chỉ nói điều nhìn thấy trong ảnh, không suy đoán. Trả lời tiếng Việt.',
      messages: [{ role: 'user', content: [
        ...anh.map((url) => ({ type: 'image' as const, source: { type: 'url' as const, url } })),
        { type: 'text', text: `Anchor [${a.loai}] "${a.ten}".\nMÔ TẢ HIỆN TẠI:\n${a.mo_ta || '(trống)'}\n\nSo mô tả với ${anh.length} ảnh trên (ảnh đầu là ảnh chính). Liệt kê chỗ lệch và viết lại mô tả theo ảnh.` },
      ] }],
      output_config: { format: zodOutputFormat(DoiChieuSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof DoiChieuSchema> | null;
    return p ? { ok: true, data: p, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
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


// ── Bài đăng kèm video (văn bản chính · tiêu đề · mô tả · nút) theo QC mẫu ───────────────────────────────────────
const BaiDangSchema = z.object({
  chu_bai: z.string().describe('Văn bản chính của bài đăng (primary text): cùng cấu trúc, cùng độ dài, cùng kiểu xuống dòng/emoji/✅ với bài mẫu; đổi sang sản phẩm của mình; chỉ dùng số liệu/ưu đãi có trong mục SẢN PHẨM; ngôn ngữ theo thị trường'),
  tieu_de: z.string().describe('Tiêu đề (headline) ≤ 40 ký tự, cùng kiểu với mẫu'),
  mo_ta: z.string().describe('Mô tả ngắn dưới tiêu đề ≤ 30 ký tự (ưu đãi / trấn an); rỗng nếu mẫu không có'),
  cta: z.string().describe('Nhãn nút: Shop now / Mua ngay / Learn more…'),
});
export async function vietBaiDang(opts: { kinhThanh: KinhThanh; kichBan: string; chuMan: string[] }): Promise<GoiYKq<Omit<BaiDang, 'luc'>>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(opts.kinhThanh);
  if (!kt.qc?.ten && !kt.qc?.diem_noi_bat) return { ok: false, loi: 'chưa khai sản phẩm ở mục 0' };
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu, max_tokens: 2500,
      system: `Bạn viết bài đăng quảng cáo (Meta/TikTok) đi kèm video. ${taQc(kt)}\nLuật: không bịa số liệu/tính năng ngoài mục SẢN PHẨM; có bài mẫu thì giữ nguyên CẤU TRÚC (số dòng, emoji, ✅, nhịp câu) và chỉ đổi nội dung cho đúng sản phẩm, không chép nguyên câu; không có mẫu thì viết theo khuôn: móc 1 dòng → 3 lợi ích ✅ → trấn an → ưu đãi + kêu gọi. Ngôn ngữ: ${kt.qc?.thi_truong || (kt.ngon_ngu === 'vi' ? 'tiếng Việt' : kt.ngon_ngu)}.`,
      messages: [{ role: 'user', content: `KỊCH BẢN VIDEO ĐI KÈM:\n${opts.kichBan.slice(0, 6000)}\n\nCHỮ TRÊN MÀN CỦA VIDEO (để bài đăng không lặp y chang): ${opts.chuMan.filter(Boolean).join(' · ') || '(chưa có)'}` }],
      output_config: { format: zodOutputFormat(BaiDangSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof BaiDangSchema> | null;
    return p ? { ok: true, data: p, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
}

// ── Phân tích video mẫu → xương sống shot (Claude nhìn khung hình lấy mỗi 2 giây) ───────────────────────────────
const MauSchema = z.object({
  shots: z.array(z.object({
    giay: z.number().describe('Số giây shot này phát (0,5–8; khung hình liên tiếp giống nhau = cùng một shot)'),
    loai: z.enum(['hook', 'uu_dai', 'noi_dau', 'giai_phap', 'tinh_nang', 'demo', 'so_sanh', 'bang_chung', 'tran_an', 'cta', 'end_card', 'khac']),
    chu_man: z.string().describe('Chữ đọc được trên màn của shot (đúng nguyên văn, kể cả tiếng Anh); rỗng nếu không có'),
    hinh: z.string().describe('Hình trong shot: ai/cái gì, cỡ cảnh, hành động, bối cảnh — 1 câu tiếng Việt, đủ để dựng lại một khung tương đương'),
  })).describe('Toàn bộ shot của video theo thứ tự thời gian; tổng giây = thời lượng video'),
  ghi_chu: z.string().describe('Nhận xét 2–3 câu: công thức của mẫu (nhịp cắt, kiểu hình, chỗ đặt chữ, cách mở, cách chốt)'),
});
export async function phanTichMau(khung: { giay: number; b64: string }[], tongGiay: number, kt: Required<KinhThanh>): Promise<GoiYKq<{ shots: ShotMau[]; ghi_chu: string }>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  if (!khung.length) return { ok: false, loi: 'không có khung hình' };
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu, max_tokens: 8000,
      system: 'Bạn là người dựng quảng cáo, đọc video mẫu từ các khung hình lấy cách đều nhau để ghi lại XƯƠNG SỐNG của nó: từng shot kéo dài mấy giây, loại shot, chữ trên màn, hình gì. Chỉ ghi thứ nhìn thấy. Khung hình giống nhau liên tiếp = một shot dài. Trả lời tiếng Việt (chữ trên màn giữ nguyên văn).',
      messages: [{ role: 'user', content: [
        ...khung.flatMap((k) => [{ type: 'text' as const, text: `giây ${k.giay}:` }, { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: k.b64 } }]),
        { type: 'text', text: `Video dài ${tongGiay} giây, ${khung.length} khung hình ở trên (mỗi khung ghi giây). Liệt kê toàn bộ shot theo thứ tự; tổng giây các shot phải ≈ ${tongGiay}.` },
      ] }],
      output_config: { format: zodOutputFormat(MauSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof MauSchema> | null;
    if (!p) return { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
    const shots: ShotMau[] = p.shots.map((s) => ({ giay: Math.max(0.5, Math.min(8, Math.round(s.giay * 2) / 2)), loai: s.loai, chu_man: s.chu_man.trim(), hinh: s.hinh.trim() }));
    return { ok: true, data: { shots, ghi_chu: p.ghi_chu }, model: r.model, tokens: { in: r.usage.input_tokens, out: r.usage.output_tokens } };
  } catch (e) {
    return { ok: false, loi: e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}` : String(e) };
  }
}
