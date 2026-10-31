// Adapter Claude cho xưởng video: viết kịch bản + tách kịch bản thành cảnh (storyboard) dạng JSON có cấu trúc.
// Nhân vật/bối cảnh của bộ phim (anchor) được đưa vào prompt để mọi cảnh, mọi tập tả cùng một người, cùng bộ đồ, cùng bối cảnh.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { chotTien } from './chot-tien';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';   // helper zodOutputFormat của SDK cần zod v4 (zod 3.25 kèm sẵn ở 'zod/v4'); import 'zod' gốc → TypeError 'def'
import { THU_VIEN, THE_LOAI, CAU_TRUC, giayBeat, khoaKhung, hopTheLoai, NHOM_KY_THUAT, type NhomKyThuat } from './dien-anh';
import type { BienThe, DoiChieu, KinhThanh, LoaiNhanVat, LoaiPhim, NhanVat } from './kieu';
import { giayDoc } from './nhip-hinh';
import { vanLuatDung, LUAT_DUNG_CANH, luatDung } from './luat-dung';
import { vanKhuonChuoi } from './khuon-chuoi';
import { nguoiBanTuyen } from './ckey-tuyen';
import { vanKhanGia } from './khan-gia';
import { vanGoi, goiTheoKey } from './goi-the-loai';
import { congTk, giaChuCents, docKinhThanh, phongCachHinh, lamTronClip, LOAI_PHIM, CAM_XUC_KHAN_GIA, LOAI_SHOT_MAU, giayMau, coMau, tenNgonNgu, type BaiDang, type ShotMau } from './kieu';

const CanhSchema = z.object({
  canh: z.string().describe('Nhãn ngắn của cảnh, tiếng Việt, ví dụ "Cảnh 1 · Khu rừng buổi sáng"'),
  goc_may: z.string().describe('Góc máy + cỡ cảnh + chuyển động máy, tiếng Việt ngắn gọn'),
  hanh_dong: z.string().describe('Chuyện gì xảy ra trong cảnh, tiếng Việt, 1-2 câu'),
  loi_thoai: z.string().describe('Lời thoại hoặc lời dẫn trong cảnh (đúng ngôn ngữ của bộ phim); rỗng nếu không có'),
  am_thanh: z.string().describe('Âm thanh nền / hiệu ứng / nhạc — viết bằng NGÔN NGỮ PHIM (đi vào model sinh hiệu ứng âm thanh, như prompt); rỗng nếu không có'),
  thoi_luong_s: z.number().int().describe('Thời lượng clip: chỉ 4, 6 hoặc 8'),
  nhan_vat: z.array(z.string()).describe('Tên CHÍNH XÁC của các anchor (nhân vật, sản phẩm, bối cảnh) xuất hiện trong cảnh, lấy từ danh sách đã cho'),
  bien_the: z.array(z.string()).describe('Biến thể dùng trong cảnh, ghi đúng dạng "Tên anchor · tên biến thể" lấy từ danh sách biến thể đã cho (biểu cảm, trang phục, góc máy…); mỗi anchor tối đa 1 biến thể; rỗng nếu không có biến thể phù hợp'),
  prompt_anh: z.string().describe('Prompt tiếng Anh cho model sinh ảnh keyframe: tả khung hình tĩnh đầu cảnh — bố cục, ánh sáng, cỡ cảnh, nhân vật tả theo đặc tính cố định (KHÔNG dùng tên riêng), bối cảnh, phong cách. Không nhắc chuyển động. SẢN PHẨM chỉ gọi bằng tên chung + "the product from the reference images" (vd "holds up the jeans from the reference images"): KHÔNG tự tả màu, túi, cúc, chất vải — ảnh tham chiếu quyết định, chữ tả sai sẽ đè lên ảnh.'),
  prompt_video: z.string().describe('Prompt tiếng Anh cho model sinh video từ keyframe: chuyển động nhân vật, chuyển động máy, nhịp, âm thanh/lời thoại (ghi dialogue trong ngoặc kép kèm ngôn ngữ). Giữ nhân vật đúng như khung đầu; chủ thể KHÔNG rời khung trong clip ngắn. SẢN PHẨM chỉ gọi "the product as in the first frame", KHÔNG tự tả màu/chi tiết.'),
});
// Kỹ thuật điện ảnh: chuỗi kèm danh sách key hợp lệ trong mô tả. KHÔNG dùng z.enum: helper SDK chuyển enum thành mô tả rồi parse lại
// bằng zod — Claude lỡ một key lạ là cả lượt tách cảnh hỏng. Key lạ do máy chủ lọc bỏ (lamSachKyThuat), shot vẫn giữ.
const enumNhom = (n: NhomKyThuat) => z.string().describe(`Một key trong: ${THU_VIEN.filter((x) => x.nhom === n).map((x) => x.key).join(', ')}`);
const KyThuatSchema = z.object({
  luat: z.array(z.string()).describe(`Mã LUẬT DỰNG CẢNH (thư viện) mà shot này thực hiện — 1-3 mã, vd shot mở = ["dan_khong_gian","dan_thoi_gian"], shot phản ứng = ["du_diem_nhin"]. Một mã trong: ${LUAT_DUNG_CANH.map((l) => l.key).join(', ')}`),
  vai: enumNhom('vai').describe('VAI KỂ của shot — kể bằng mắt ai, để làm gì (luật 13–14). Một key trong: thiet_lap, thoi_gian, tong_the, hanh_trinh, hanh_dong, nguoi_thu_ba, chu_quan, phan_ung, chi_tiet, tam_trang'),
  co_canh: enumNhom('co_canh'), goc: enumNhom('goc'), chuyen_dong: enumNhom('chuyen_dong'), ong_kinh: enumNhom('ong_kinh'),
  dien_xuat: enumNhom('dien_xuat').describe(`NHỊP DIỄN cảm xúc chính của shot (mắt rưng rưng, nhìn lại hai lần, nhận ra…) — rỗng nếu shot không có nhịp diễn cảm xúc. Một key trong: ${THU_VIEN.filter((x) => x.nhom === 'dien_xuat').map((x) => x.key).join(', ')}`),
  anh_sang: enumNhom('anh_sang'), mau: enumNhom('mau'), chuyen_canh: enumNhom('chuyen_canh'),
  am_thanh: z.array(enumNhom('am_thanh')).describe('1-2 lớp âm thanh hiện trường của shot'), nhac: enumNhom('nhac'),
  hook: enumNhom('hook').describe(`MÓC CÂU — CHỈ 1–2 shot MỞ tập (người xem quyết ở lại trong 1–3 giây); shot khác để rỗng. Một key trong: ${THU_VIEN.filter((x) => x.nhom === 'hook').map((x) => `${x.key} (${x.ten})`).join(', ')}`),
});
const DongThoaiSchema = z.object({
  nhan_vat: z.string().describe('Tên CHÍNH XÁC nhân vật nói (từ danh sách anchor); rỗng nếu là lời dẫn'),
  dien_xuat: z.string().describe('Diễn xuất trong ngoặc như kịch bản phim: hành động/biểu cảm khi nói — viết bằng NGÔN NGỮ PHIM (đi vào model giọng / âm thanh), vd "looking up, raising a hand", "whispering"; rỗng nếu không cần'),
  loi: z.string().describe('Lời nói, đúng giọng nhân vật, có ẩn ý khi hợp'),
});
const DanDungSchema = z.object({
  bo_cuc: z.string().describe('Bố cục 3 lớp, TIẾNG ANH: foreground / midground / background, ai bên trái ai bên phải khung (đi vào prompt ảnh)'),
  mo: z.string().describe('Trạng thái MỞ shot, TIẾNG ANH: vị trí từng nhân vật, đồ đang cầm/mất, biến dạng — phải khớp trạng thái KẾT của shot trước (luật 11)'),
  ket: z.string().describe('Trạng thái KẾT shot, TIẾNG ANH — shot sau mở đúng từ đây'),
  huong: z.string().describe('Hướng nhìn + hướng di chuyển trên màn, TIẾNG ANH (screen-left/right) — giữ trục 180° trong phân cảnh'),
  muc_dich: z.string().describe('Tiếng Việt: khán giả cảm gì từ đầu → cuối shot, shot tồn tại để làm gì (luật 17)'),
  motif: z.string().describe('Tiếng Việt: motif / cái gài hoặc cái trả có trong khung; rỗng nếu không'),
  dien: z.string().describe('DIỄN XUẤT HOẠT HÌNH, TIẾNG ANH (vào prompt video): lấy đà (anticipation) → hành động → theo đà / phản ứng, nén–giãn (squash & stretch), khựng giữ phản ứng — cụ thể từng nhịp'),
  nhan: z.string().describe('Tiếng Việt: ĐIỂM NHẤN âm–hình nếu shot có cú bùng của gag (giây nào, tiếng gì đập đúng lúc nào, nhạc ngắt ở đâu); rỗng nếu không'),
});
const ShotSchema = CanhSchema.extend({
  khuon: z.string().describe('Mã KHUÔN CHUỖI (khối KHUÔN CHUỖI SHOT) mà đoạn chứa shot này thực hiện; rỗng nếu shot không thuộc khuôn nào'),
  buoc_khuon: z.number().int().describe('Số bước (1, 2, …) của shot trong khuôn đó; 0 nếu không thuộc khuôn'),
  khan_gia: z.array(z.string()).describe('0–2 mã HIỆU ỨNG KHÁN GIẢ (khối Ý ĐỒ KHÁN GIẢ) đạo diễn nhắm ở shot này — khán giả cảm, KHÔNG phải nhân vật cảm; rỗng nếu shot nối'),
  khan_gia_ghi: z.string().describe('Tiếng Việt, ngắn: vì sao khán giả cảm như vậy ở đây (chỉ ghi ở shot đầu đoạn; rỗng nếu không)'),
  danh_lua: z.string().describe('Chỉ ở shot ĐẦU đoạn đánh lừa: "A: <khán giả tin> | B: <sự thật>"; rỗng nếu không'),
  lat: z.boolean().describe('true nếu shot này LỘ sự thật B của đoạn đánh lừa trước nó'),
  dan_dung: DanDungSchema.describe('THẺ SHOT trước keyframe (khuôn shot list của ngành) — điền đủ, máy chặn keyframe khi thiếu'),
  trang_phuc: z.string().describe('Trang phục của người trong shot NẾU khác bộ đồ trong mô tả anchor, ghi rõ và đủ (tiếng Anh hoặc Việt), vd "chỉ mặc áo bra không gọng màu be và quần jean, KHÔNG áo ngoài, lộ vai". Quảng cáo đồ mặc (áo lót, đồ bơi, áo…): shot khoe/demo sản phẩm phải ghi rõ người CHỈ mặc sản phẩm ở phần đó, không áo khoác ngoài. Rỗng nếu giữ bộ đồ mặc định.'),
  thoai: z.array(DongThoaiSchema).describe('Thoại của shot theo dòng kiểu kịch bản phim chuyên nghiệp (mỗi lượt nói một dòng); rỗng nếu shot không có thoại. Trường loi_thoai để rỗng.'),
  cam_xuc: z.number().int().describe(`Cảm xúc KHÁN GIẢ ở CUỐI shot theo thang: ${Object.entries(CAM_XUC_KHAN_GIA).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k} ${v}`).join(', ')}`),
  ky_thuat: KyThuatSchema.describe('Ngôn ngữ điện ảnh của shot, chọn từ thư viện cho hợp thể loại + cảm xúc'),
  phat_s: z.number().describe('Số giây shot THỰC PHÁT trong bản dựng (1.5–8, bước 0.5). Clip sinh 4/6/8s rồi cắt lấy phat_s giây đầu. Quảng cáo: hook, insert, demo 1.5–3s; thoại dài hơn thì 4–6s. Phim truyện ≥ 3s, phim không lời ≥ 3.5s (máy kẹp lên mức này). Tổng phat_s của cả tập phải bằng thời lượng mục tiêu ±10%.'),
  chu_man: z.string().describe('Chữ hiện trên màn trong shot (đúng ngôn ngữ phim, ≤ 8 từ, KHÔNG dấu chấm cuối câu — máy cũng tự bỏ): câu hook, số liệu, tên tính năng, ưu đãi, CTA. Quảng cáo: BẮT BUỘC ở shot hook và shot CTA, nên có ở bằng chứng/ưu đãi; phim/short: rỗng trừ khi cần.'),
});
const StoryboardSchema = z.object({
  tom_tat: z.string().describe('Tóm tắt nội dung tập này trong 2-3 câu, tiếng Việt, để tập sau nối mạch'),
  ho_so: z.object({ thoi_gian: z.string().describe('Thời gian của cả tập và ánh sáng nói giờ thế nào, tiếng Việt'), duong_di: z.string().describe('Đường đi qua các nơi chốn (tên anchor Bối cảnh, theo bản đồ không gian)'), motif: z.string().describe('Các motif của tập và nghĩa của chúng'), cung: z.string().describe('Cung cảm xúc cả tập, vd "Thèm (+1) → mất (−1) → … → móc"') }).describe('Phần cấp TẬP của hồ sơ tiền kỳ chuẩn studio (ho-so.ts)'),
  beats: z.array(z.object({ ten: z.string(), mo_ta: z.string().describe('Beat này xảy ra gì trong tập, 1 câu tiếng Việt'), cam_xuc: z.number().int().describe('-5..5') })).describe('Cấu trúc beat của tập theo khung đã cho'),
  phan_canh: z.array(z.object({
    ten: z.string().describe('Tên phân cảnh ngắn, tiếng Việt, duy nhất trong tập'),
    beat: z.string().describe('Thuộc beat nào (đúng tên beat)'),
    muc_tieu: z.string().describe('Nhân vật muốn đạt gì trong phân cảnh này'),
    xung_dot: z.string().describe('Cái gì cản trở / đối lập'),
    an_y: z.string().describe('Ẩn ý dưới lời thoại (điều nhân vật cảm mà không nói), rỗng nếu không có'),
    nhip: z.string().describe('cham | vua | nhanh'),
    cam_xuc_dau: z.number().int().describe('-5..5'), cam_xuc_cuoi: z.number().int().describe('-5..5, phải KHÁC đầu: phân cảnh nào cũng đổi giá trị'),
    // Hồ sơ tiền kỳ chuẩn studio (kieu.ts › PhanCanh): phần đạo diễn + sản xuất + color script + nhạc của cảnh.
    intro: z.boolean().describe('true nếu là cảnh mở series từ thế giới ngoài (luật 12) — không tính vào độ dài chuẩn, không cần gag'),
    gag: z.array(z.object({ ten: z.string(), gai: z.string().describe('gài: khán giả thấy gì trước'), bung: z.string().describe('bùng: cú bất ngờ / cú ngã'), o_shot: z.number().int().describe('shot thứ mấy TRONG cảnh có cú bùng (1-based); shot đó phải ghi dan_dung.nhan') })).describe('Các gag của cảnh (phim hài/không lời bắt buộc ≥1, trừ cảnh intro), đủ mật độ theo THAM CHIẾU'),
    noi: z.string().describe('Nơi — đúng tên anchor Bối cảnh chính của cảnh'),
    luc: z.string().describe('Thời điểm cụ thể, tiếng Việt, vd "ĐÊM – 23:40, ngay sau khi đèn tắt" (luật 13)'),
    gia_tri_doi: z.string().describe('Tiếng Việt: trạng thái đầu → cuối của nhân vật, vd "có bạn, an toàn → thất bại, sắp mất bạn" (luật 17)'),
    diem_xoay: z.string().describe('Tiếng Việt: khoảnh khắc kết quả ngược với điều nhân vật chờ'),
    nhip_hd: z.array(z.string()).describe('Các nhịp hành động → phản ứng của cảnh, tiếng Việt, mỗi nhịp một câu'),
    hieu_ung: z.array(z.string()).describe('Hiệu ứng cần dựng (biến hình, ánh sáng đổi, tia điện…), tiếng Việt; rỗng nếu không'),
    anh_sang: enumNhom('anh_sang').describe('Ánh sáng chủ đạo của cảnh (color script, luật 20)'),
    mau: enumNhom('mau').describe('Màu chủ đạo của cảnh (color script)'),
    mau_mo_ta: z.string().describe('Tiếng Việt: ánh sáng + màu đổi thế nào trong cảnh và vì sao (theo cung cảm xúc)'),
    nhac: enumNhom('nhac').describe('Nhạc của cảnh'),
    kich_ban: z.array(z.object({ loai: z.string().describe('hd = hành động | am = âm | nv = nhân vật nói/âm hiệu | chuyen = chuyển cảnh'), chu: z.string().describe('chữ của dòng hd/am/chuyen (tiếng Việt); rỗng với nv'), ten: z.string().describe('nv: tên nhân vật; rỗng nếu không'), dien: z.string().describe('nv: diễn xuất; rỗng nếu không'), loi: z.string().describe('nv: lời / âm hiệu; rỗng nếu không') })).describe('Đoạn KỊCH BẢN (screenplay) của cảnh — chỉ truyện, KHÔNG máy'),
    shots: z.array(ShotSchema).describe('Các shot của phân cảnh, theo thứ tự'),
  })),
  hook_bien_the: z.array(z.object({
    ten: z.string().describe('Tên ngắn góc tiếp cận, vd "tò mò", "so sánh trước/sau", "bằng chứng"'),
    shots: z.array(ShotSchema).describe('1–2 shot THAY THẾ cho các shot của beat đầu (Hook); tổng phat_s bằng hook chính ±1s; vẫn dùng đúng anchor'),
  })).describe('Quảng cáo / short: 2 phương án hook KHÁC góc tiếp cận với hook chính (vd hook chính = nỗi đau → phương án: câu hỏi tò mò, so sánh trước/sau, số liệu sốc). Để A/B trên Meta/TikTok với cùng một thân. Phim nhiều tập: mảng rỗng.'),
});
export type CanhSinh = z.infer<typeof ShotSchema> & { phan_doan: string; nhanh: string };
export type PhanCanhSinh = Omit<z.infer<typeof StoryboardSchema>['phan_canh'][number], 'shots'>;

/** CHUỖI DỰ PHÒNG CHO MỌI LƯỢT CLAUDE (anh 20/10/2026: "cứ dùng kiểu fallback này với ckey là chính"): ckey.vn (người bán Claude trên chợ, đường
 *  /v1/messages chuẩn Anthropic, nhận cả khuôn JSON) → ShopAIKey (/v1/messages, KHÔNG nhận output_config → dặn khuôn trong system, máy tự đọc JSON)
 *  → Anthropic trực tiếp. Đo 19/10/2026 một lượt Opus điển hình (6,8k vào / 3,5k ra): ckey ≈ 30–125₫ · ShopAIKey ≈ 315₫ · Anthropic ≈ 2.500₫.
 *  Bước nào lỗi / từ chối / trả sai khuôn → bước sau. r.model trả về mang tiền tố đường đã đi ('ckey:…', 'shopaikey:…'; Anthropic = tên trơn);
 *  ckey báo tiền thật mỗi lượt (usage.x_ckey.cost, VNĐ) → tkCua(r).vnd → ghiTienChu ghi đúng tiền. */
type DuongChu = { ten: 'ckey' | 'shopaikey' | 'anthropic'; c: Anthropic; model: string; jsonTay: boolean };
/** NGƯỜI BÁN CKEY ĐANG CÓ cho một model Claude — đọc /v1/models (nhớ 10 phút): người bán trên chợ đổi tên / nghỉ liên tục (27/10/2026: cả hai người bán Haiku
 *  trong bảng gõ tay cũ đều 404 → lượt rơi thẳng về Anthropic giá gấp 30 lần). Chỉ còn là LƯỚI khi danh sách sống của Phòng Tài nguyên (ckey-tuyen.ts) chưa có dòng cho model; bảng người bán gõ tay đã bỏ 31/10/2026. Thuần phần khớp tên. */
export const khopTenCkey = (model: string, id: string): boolean => { const d = id.split('/')[1]; if (!d || !id.includes('/')) return false; const re = new RegExp('^' + model.replace(/[.-](?=\d)/g, '[.-]') + '$', 'i'); return re.test(d); };
let khoNguoiBan: { luc: number; ids: string[] } | null = null;
async function nguoiBanCkey(k: string, model: string): Promise<string[]> {
  if (!khoNguoiBan || Date.now() - khoNguoiBan.luc > 600_000) {
    try { const r = await fetch('https://api.xah.io/v1/models', { headers: { authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(15_000) }); const j = (await r.json()) as { data?: { id: string }[] }; khoNguoiBan = { luc: Date.now(), ids: (j.data ?? []).map((x) => x.id) }; }
    catch { khoNguoiBan = { luc: Date.now(), ids: [] }; }
  }
  return khoNguoiBan.ids.filter((id) => khopTenCkey(model, id));
}
const duongChu = async (model: string): Promise<DuongChu[]> => {
  const ds: DuongChu[] = [];
  const kc = process.env.CKEY_API_KEY, ks = process.env.SHOPAIKEY_API_KEY, ka = process.env.ANTHROPIC_API_KEY;
  const ke = (key: string, baseURL: string) => new Anthropic({ apiKey: key, baseURL, defaultHeaders: { authorization: `Bearer ${key}` }, maxRetries: 1 });
  // người bán: danh sách sống của Phòng Tài nguyên (ckey-tuyen.ts) trước; tự dò danh mục chỉ là lưới khi tệp chưa có dòng cho model này
  if (kc) { const co = nguoiBanTuyen(model), them = (await nguoiBanCkey(kc, model)).filter((m) => !co.includes(m)); for (const m of [...co, ...them]) ds.push({ ten: 'ckey', c: ke(kc, 'https://api.xah.io'), model: m, jsonTay: true }); }   // jsonTay: ckey trả JSON hỏng với output_config từ 28/10 ("Unterminated fractional number…") → mọi lượt rơi sang Anthropic ~7× giá; dặn khuôn trong system như ShopAIKey
  if (ks && /^claude-/.test(model)) ds.push({ ten: 'shopaikey', c: ke(ks, 'https://api.shopaikey.com'), model, jsonTay: true });
  if (ka) ds.push({ ten: 'anthropic', c: new Anthropic({ apiKey: ka }), model, jsonTay: false });
  return ds;
};
type DinhDang = { schema?: unknown; parse?: (s: string) => unknown };
type ThamSoChu = { model: string; system?: string | Anthropic.TextBlockParam[]; output_config?: { format?: DinhDang } } & Record<string, unknown>;
/** Khối JSON trong chữ trả về (bỏ ```json bọc ngoài, chữ thừa trước / sau). */
const layJson = (t: string): string => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); return a >= 0 && b > a ? t.slice(a, b + 1) : t; };
/** Đường không nhận output_config: bỏ nó, dặn khuôn JSON ở cuối system. */
const dangJsonTay = (p: ThamSoChu): ThamSoChu => {
  const f = p.output_config?.format; if (!f) return p;
  const { output_config: _o, ...con } = p;
  const dan = `\n\nTrả lời CHỈ bằng MỘT đối tượng JSON đúng JSON Schema dưới đây — không bọc \`\`\`, không một chữ nào khác ngoài JSON:\n${JSON.stringify(f.schema)}`;
  const system = typeof p.system === 'string' || p.system == null ? `${p.system ?? ''}${dan}` : [...p.system, { type: 'text' as const, text: dan }];
  return { ...con, system };
};
type TinChu = Anthropic.Message & { parsed_output?: unknown; vnd?: number };
async function quaChuoi(p: ThamSoChu, goi: (d: DuongChu, q: ThamSoChu) => Promise<TinChu>): Promise<TinChu> {
  // script thiếu duyệt → dừng (chot-tien.ts); giá ước = trường hợp xấu nhất (rơi tới Anthropic, viết hết max_tokens) — lượt nhỏ dưới ngưỡng tự chạy (5.000₫, chot-tien.ts) tự chạy
  chotTien('gọi Claude', { cents: giaChuCents(p.model, Math.ceil(JSON.stringify([p.system ?? '', p.messages ?? '']).length / 3), Number(p.max_tokens) || 0) });
  const ds = await duongChu(p.model); const loi: string[] = [];
  if (!ds.length) throw new Error('Thiếu khoá Claude trên máy chủ (CKEY_API_KEY / SHOPAIKEY_API_KEY / ANTHROPIC_API_KEY)');
  const f = p.output_config?.format;
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i]!; const cuoi = i === ds.length - 1;
    try {
      const r = await goi(d, { ...(d.jsonTay ? dangJsonTay(p) : p), model: d.model });
      if (r.stop_reason === 'refusal' && !cuoi) { loi.push(`${d.ten} ${d.model}: từ chối`); continue; }
      if (f) {   // có khuôn JSON: chuẩn hoá chữ về đúng khối JSON (bên bán lại hay bọc ```json) + tự đọc khi đường không đọc hộ
        for (const b of r.content) if (b.type === 'text') b.text = layJson(b.text);
        if (d.jsonTay && f.parse && r.stop_reason !== 'max_tokens') r.parsed_output = f.parse(r.content.map((b) => (b.type === 'text' ? b.text : '')).join(''));
      }
      const x = (r.usage as { x_ckey?: { cost?: number } }).x_ckey?.cost;
      if (loi.length) console.error('[claude] dự phòng:', loi.join(' · '), '→', d.ten);
      return Object.assign(r, { model: d.ten === 'anthropic' ? p.model : `${d.ten}:${p.model}`, ...(d.ten === 'ckey' && typeof x === 'number' ? { vnd: x } : {}) });
    } catch (e) {
      const m = e instanceof Anthropic.APIError ? `${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
      if (cuoi) throw Object.assign(e instanceof Error ? e : new Error(m), { message: [...loi, `${d.ten}: ${m}`].join(' · ') });
      loi.push(`${d.ten} ${d.model}: ${m.slice(0, 160)}`);
    }
  }
  throw new Error(loi.join(' · '));
}
/** Khách Claude của studio: cùng bộ hàm messages.create / parse / stream của SDK, đi qua chuỗi dự phòng. null khi không có khoá nào. */
type KhachChu = { messages: { create(p: ThamSoChu): Promise<TinChu>; parse(p: ThamSoChu): Promise<TinChu>; stream(p: ThamSoChu): { finalMessage(): Promise<TinChu> } } };
function client(): KhachChu | null {
  if (!process.env.CKEY_API_KEY && !process.env.SHOPAIKEY_API_KEY && !process.env.ANTHROPIC_API_KEY) return null;
  const tao = (d: DuongChu, q: ThamSoChu) => d.c.messages.create({ ...(q as unknown as Anthropic.MessageCreateParamsNonStreaming), stream: false }) as Promise<TinChu>;
  return { messages: {
    create: (p) => quaChuoi(p, tao),
    parse: (p) => quaChuoi(p, (d, q) => (d.jsonTay ? tao(d, q) : d.c.messages.parse(q as unknown as Parameters<Anthropic['messages']['parse']>[0]) as unknown as Promise<TinChu>)),
    stream: (p) => ({ finalMessage: () => quaChuoi(p, (d, q) => d.c.messages.stream(q as unknown as Anthropic.MessageStreamParams).finalMessage() as Promise<TinChu>) }),
  } };
}
/** LƯỢT CHỮ RA JSON THEO KHUÔN ZOD cho mọi máy ngoài phim (máy sinh đề theo góc — may-de.ts, 27/10/2026): cùng chuỗi dự phòng, cùng sổ tiền. Mặc định Haiku qua ckey
 *  (vài chục đồng một lượt). Trả dữ liệu đã parse + token/tiền; lỗi → ok:false với câu đọc được. */
export async function sinhJson<T>(o: { schema: z.ZodType<T>; system: string; user: string; model?: string; max_tokens?: number; ten?: string }): Promise<{ ok: true; data: T; model: string; tokens: { in: number; out: number; vnd?: number } } | { ok: false; loi: string }> {
  const c = client(); if (!c) return { ok: false, loi: 'thiếu khoá chữ (CKEY_API_KEY / SHOPAIKEY_API_KEY / ANTHROPIC_API_KEY)' };
  try {
    const r = await c.messages.parse({ model: o.model ?? 'claude-haiku-4-5', max_tokens: o.max_tokens ?? 2000, system: o.system, messages: [{ role: 'user', content: o.user }], output_config: { format: zodOutputFormat(o.schema as unknown as Parameters<typeof zodOutputFormat>[0]) } });
    const data = (r as { parsed_output?: T }).parsed_output; if (!data) return { ok: false, loi: 'mô hình không trả đúng khuôn JSON' };
    return { ok: true, data, model: r.model, tokens: tkCua(r) };
  } catch (e) { return { ok: false, loi: loiGoi(e) }; }
}
/** Token + tiền thật (ckey báo VNĐ) của một lượt — ghiTienChu dùng vnd khi có, không thì token × giá model. */
export const tkCua = (...rs: TinChu[]): { in: number; out: number; vnd?: number } => congTk(...rs.map((r) => ({ in: r.usage.input_tokens, out: r.usage.output_tokens, ...(typeof r.vnd === 'number' ? { vnd: r.vnd } : {}) })));

function taAnchor(nv: NhanVat[]): string {
  if (!nv.length) return '(chưa khai anchor nào — tự đặt tên nhân vật/bối cảnh và tả cố định, dùng cùng một mô tả ở mọi cảnh)';
  return nv.map((a) => `- [${a.loai}] ${a.ten}: ${a.mo_ta || '(chưa mô tả)'}${a.giong ? ` · giọng: ${a.giong}` : ''}${a.tieu_su?.trim() ? `\n    tiểu sử (tính cách, sức mạnh, điểm yếu, mong muốn — hành động trong cảnh phải đúng với nó): ${a.tieu_su.trim().replace(/\s*\n\s*/g, ' · ')}` : ''}${a.am_hieu?.length ? `\n    âm hiệu có sẵn (phim không lời — dùng đúng tên này trong dòng thoại): ${a.am_hieu.map((x) => x.ten).join(' · ')}` : ''}${a.bien_the?.length ? `\n    biến thể: ${a.bien_the.map((b) => `"${a.ten} · ${b.ten}" (${b.nhom}: ${b.mo_ta.slice(0, 80)})`).join('; ')}` : ''}`).join('\n');
}

/** Lỗi gọi Claude → câu đọc được, MỘT chỗ cho mọi lượt. messages.parse NÉM khi JSON không đọc được — thường vì chạm max_tokens nên câu trả
 *  lời bị cắt; kiểm stop_reason SAU parse không bao giờ chạy tới (13/10/2026: nút kiểm người xem chỉ báo "Unterminated string"). */
function loiGoi(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `Anthropic ${e.status}: ${e.message}`;
  const m = e instanceof Error ? e.message : String(e);
  return /Failed to parse structured output|Unterminated string|Unexpected end of JSON/i.test(m) ? 'Claude trả lời bị cắt giữa chừng (chạm trần token), không đọc được — báo con nâng trần' : m;
}

/** LUẬT KỂ CHUYỆN CHO NGƯỜI XEM LẦN ĐẦU — "skill làm video" của xưởng, nằm trong MỌI lượt viết kịch bản / tách cảnh (heThong).
 *  Rút từ ca Fox Tales tập 2 (13/10/2026: kịch bản 100/100 cấu trúc mà xem không hiểu) + luật dựng chuẩn (Murch: cảm xúc > câu chuyện > nhịp).
 *  Bước kiểm sau đó: nguoi-xem.ts (Claude xem mù, chặn keyframe/xuất khi chưa hiểu). Sửa luật ở đây là sửa cho mọi phim. */
export const LUAT_KE_CHUYEN = vanLuatDung();   // nguồn: luat-dung.ts (thư viện luật dựng cảnh)
/** Phim KHÔNG LỜI (kinh_thanh.khong_loi — Tango & Lint): thoại thay bằng âm hiệu của nhân vật, truyện kể bằng hành động. */
export const LUAT_KHONG_LOI = `PHIM KHÔNG LỜI (kiểu Larva / Shaun the Sheep): KHÔNG có một câu thoại hay lời dẫn nào bằng ngôn ngữ người. Trường thoại chỉ ghi ÂM HIỆU của nhân vật (tiếng kêu, bập bẹ, cười, thở, tiếng chất liệu của nó — theo dòng "Voice" / tính cách trong tiểu sử), ngắn ≤ 3 từ âm, vd Tango: "Hup!", Lint: "[gasps] pff…". Mọi ý truyện phải hiểu được chỉ bằng hành động + biểu cảm + âm thanh; chữ màn tối đa vài chữ ở đầu tập (tên tập) hoặc không có. Mỗi gag phải đọc được khi tắt tiếng.`;
const heThong = (loai: LoaiPhim, kt: Required<KinhThanh>) => `Bạn là đạo diễn kiêm storyboard artist cho xưởng video AI. Loại sản phẩm: ${LOAI_PHIM.find((l) => l.key === loai)?.label ?? loai}.
Phong cách hình ảnh cố định của bộ phim: ${kt.phong_cach || '(chưa đặt, tự chọn một phong cách và giữ nhất quán)'}.
Khung hình ${kt.ti_le}, mỗi cảnh là MỘT clip video AI dài 4/6/8 giây sinh từ một ảnh keyframe, nên mỗi cảnh chỉ có một hành động chính, một góc máy.
NGÔN NGỮ PHIM: ${tenNgonNgu(kt.ngon_ngu)}. ${kt.ngon_ngu === 'vi' ? '' : `MỌI chữ khán giả thấy hoặc nghe — lời thoại, lời dẫn, chữ trên màn (chu_man), tên/nhãn trong kịch bản, bài đăng — PHẢI viết bằng ${tenNgonNgu(kt.ngon_ngu)} như người bản ngữ viết quảng cáo; kịch bản cũng viết bằng ${tenNgonNgu(kt.ngon_ngu)}. Chỉ phần ghi chú kỹ thuật nội bộ (nhãn cảnh, góc máy, hành động) mới dùng tiếng Việt. Trả lời thoại/chữ màn bằng tiếng Việt khi phim không phải tiếng Việt = SAI.`}
${kt.the_loai ? `Thể loại: ${THE_LOAI.find((t) => t.key === kt.the_loai)?.ten} (${THE_LOAI.find((t) => t.key === kt.the_loai)?.mo_ta}).` : ''}${kt.logline ? `\nLogline: ${kt.logline}` : ''}${kt.chu_de ? `\nChủ đề: ${kt.chu_de}` : ''}
${taQc(kt)}
${LUAT_KE_CHUYEN}
${vanKhuonChuoi(kt.the_loai)}
${vanKhanGia()}
${kt.goi ? `${vanGoi(kt.goi)}\n` : ''}${kt.khong_loi ? LUAT_KHONG_LOI + '\n' : ''}${kt.ban_do?.trim() ? `BẢN ĐỒ KHÔNG GIAN (các nơi chốn nằm đâu, cạnh nhau thế nào, đường đi — dùng cho chuỗi dẫn và shot hành trình, luật 12):\n${kt.ban_do.trim()}\n` : ''}QUY TẮC ĐỒNG NHẤT: nhân vật, sản phẩm, bối cảnh phải tả bằng đúng đặc tính cố định trong danh sách anchor ở mọi cảnh (cùng màu lông, cùng trang phục, cùng tỉ lệ cơ thể, cùng chất liệu). prompt_anh và prompt_video viết tiếng Anh, tả người/vật theo đặc tính chứ không dùng tên riêng (model ảnh không biết tên). Mỗi prompt tự đứng được một mình (không viết "như shot trước" — model không thấy shot khác) NHƯNG phải tả lại bằng chữ trạng thái nối tiếp từ shot trước (luật 11: vị trí, đồ đang cầm, biến dạng, ánh sáng, hướng di chuyển). Hai shot liền nhau cùng nơi, cùng khoảnh khắc, máy cùng phía (shot sau tiếp đúng giây cuối shot trước) → ky_thuat.chuyen_canh của shot TRƯỚC = 'lien_may': clip shot trước sẽ kết đúng bằng keyframe shot sau, cắt không giật.`;

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
- QUY TRÌNH (máy chủ chặn nếu thiếu — quy-trinh.ts): mỗi shot BẮT BUỘC có ky_thuat.co_canh; nhan_vat của shot gồm ≥1 anchor loại Bối cảnh (nơi chốn) và mọi người/sản phẩm có tên trong prompt_anh; khung beat phải có beat âm (vấn đề/cao trào) và beat dương (giải quyết).
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
}): Promise<{ ok: true; tomTat: string; hoSo?: { thoi_gian: string; duong_di: string; motif: string; cung: string }; canh: CanhSinh[]; beats: { ten: string; mo_ta: string; cam_xuc: number }[]; phanCanh: PhanCanhSinh[]; model: string; tokens: { in: number; out: number; vnd?: number } } | { ok: false; loi: string }> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(opts.kinhThanh);
  const laQc = opts.loai === 'quang_cao';
  const kKhung = khoaKhung(opts.loai, kt.the_loai, goiTheoKey(kt.goi)?.khung); const khung = CAU_TRUC[kKhung]!;
  // Có QC MẪU → khuôn của mẫu thắng mọi thứ: số shot = số shot mẫu, thời lượng = tổng giây mẫu, beat chỉ để tham khảo.
  const mau = laQc && coMau(kt.qc) ? kt.qc.mau! : null;
  if (mau) { opts = { ...opts, soCanh: mau.shots.length, thoiLuongS: giayMau(mau) }; }
  // Thời lượng mục tiêu chia cho từng beat (quảng cáo có tỉ lệ sẵn) → Claude biết hook được mấy giây, không tự kéo 24s thành 64s.
  const giayTheoBeat = opts.thoiLuongS && !mau ? giayBeat(kKhung, opts.thoiLuongS) : null;
  const phimDoc = kt.the_loai === 'phim_doc';
  const toiGiay = giayDoc({ laQc, khong_loi: kt.khong_loi, phim_doc: phimDoc });
  const user = [
    `DANH SÁCH ANCHOR (dùng đúng tên trong trường nhan_vat):\n${taAnchor(opts.nhanVat)}`,
    opts.tapTruoc?.length ? `TÓM TẮT CÁC TẬP TRƯỚC (nối mạch, không kể lại):\n${opts.tapTruoc.map((t, i) => `Tập ${i + 1}: ${t}`).join('\n')}` : '',
    `KỊCH BẢN:\n${opts.kichBan.trim()}`,
    kt.series?.tham_chieu ? `THAM CHIẾU CỦA SERIES (tập phải đạt chuẩn này — máy đo lại): ${kt.series.tham_chieu.tac_pham}; độ dài ${kt.series.tham_chieu.do_dai_s}s/tập (không tính cảnh intro, ±25%); ${kt.series.tham_chieu.gag_moi_phut} gag/phút. Rút ra: ${kt.series.tham_chieu.rut_ra.join(' · ')}` : '',
    kt.series?.khuon ? `KHUÔN NHẬN DIỆN SERIES: intro ${kt.series.khuon.intro} · thẻ tựa ${kt.series.khuon.the_tua} · thẻ kết ${kt.series.khuon.the_ket} · nhạc chủ đề ${kt.series.khuon.nhac_chu_de}` : '',
    /Shot dự kiến/i.test(opts.kichBan) ? 'Kịch bản đã chia "Shot dự kiến" cho từng cảnh: tách ĐÚNG các shot đó theo thứ tự: vai → ky_thuat.vai, co_canh/goc/chuyen_dong/ong_kinh/chuyen_canh → ky_thuat cùng tên, luat → ky_thuat.luat, số giây → phat_s, bo_cuc/mo/ket/huong/muc_dich/motif → dan_dung, dòng Máy → goc_may; chỉ thêm shot khi luật bắt buộc.' : '',
    `KHUNG BEAT (${khung.ten}):\n${khung.beats.map((b, i) => `- ${b.ten}: ${b.mo_ta}${giayTheoBeat ? ` → giây ${giayTheoBeat[i]!.tu}–${giayTheoBeat[i]!.den}` : ''}`).join('\n')}`,
    `THƯ VIỆN ĐIỆN ẢNH (chọn key cho từng shot):\n${taThuVien(kt.the_loai)}`,
    opts.khuon ?? '',
    // Phim ngắn dọc: luật nhịp / eye trace / lời kể là luật THỢ (xem: false — không vào lời dặn người xem ảo) nên phải đưa riêng vào lúc tách shot.
    // Đọc thẳng từ thư viện luật (luat-dung.ts) — một nguồn, không chép câu.
    phimDoc ? `KHUÔN PHIM NGẮN DỌC (bắt buộc khi chia shot):\n${['nhip_phim_doc', 'nhip_cat_doc', 'eye_trace', 'loi_ke_noi_tam', 'vang_mat_do'].map((k) => luatDung(k)).filter(Boolean).map((l) => `- [${l!.key}] ${l!.ten}: ${l!.luat}`).join('\n')}` : '',
    opts.thoiLuongS ? `THỜI LƯỢNG MỤC TIÊU: ${opts.thoiLuongS} giây — tổng phat_s của mọi shot (trừ hook_bien_the) phải trong khoảng ${Math.round(opts.thoiLuongS * 0.9)}–${Math.round(opts.thoiLuongS * 1.1)} giây.` : '',
    mau ? HUONG_DAN_MAU(mau.shots.length) : opts.soCanh ? `Tổng khoảng ${opts.soCanh} shot${laQc ? '' : `, mỗi shot phát ≥ ${toiGiay} giây (luật 10 — nhịp đọc)`}.` : laQc ? 'Số shot theo nhịp quảng cáo: phần lớn shot phát 1,5–3 giây.' : phimDoc ? `Số shot vừa đủ kể hết kịch bản theo khuôn phim ngắn dọc: phần lớn shot phát ${toiGiay}–2,5 giây, shot thoại dài theo câu nói (≤ 5 giây).` : `Số shot vừa đủ kể hết kịch bản, mỗi shot ${toiGiay}–8 giây.`,
  ].filter(Boolean).join('\n\n');
  try {
    // Mỗi shot ≈ 700–900 token JSON (2 prompt tiếng Anh + kỹ thuật + thoại); 28 shot bám mẫu vượt trần 16k → JSON đứt giữa chừng (09/10/2026).
    const soShot = (opts.soCanh || 20) + 4;   // + hook_bien_the
    // Trần > ~21k token thì SDK bắt STREAM (lượt có thể quá 10 phút) → stream rồi tự parse JSON theo schema; cùng một đường cho mọi cỡ.
    const st = c.messages.stream({
      model: kt.mo_hinh_chu,
      max_tokens: Math.min(64000, Math.max(16000, 6000 + soShot * 1000)),
      system: `${heThong(opts.loai, kt)}\n\n${HUONG_DAN_DAO_DIEN}${laQc ? `\n\n${HUONG_DAN_QC}` : ''}`,
      messages: [{ role: 'user', content: user }],
      // Kiểu của helper khai theo zod v3 nhưng runtime cần v4 (đã thử: v3 → TypeError 'def', v4 chạy) → ép kiểu ở ranh này.
      output_config: { format: zodOutputFormat(StoryboardSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    const r = await st.finalMessage();
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    if (r.stop_reason === 'max_tokens') return { ok: false, loi: 'Claude viết chưa hết đã chạm trần token — giảm số shot hoặc tách làm hai' };
    const chu = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    let p: z.infer<typeof StoryboardSchema> | null = null;
    try { p = StoryboardSchema.parse(JSON.parse(chu)); } catch (e) { return { ok: false, loi: `Claude trả JSON không đúng khuôn: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}` }; }
    const kep = (v: number) => Math.max(-5, Math.min(5, Math.round(v)));
    // phat_s = giây thực phát (1–8, bước 0,5); clip sinh = làm tròn lên 4/6/8. Claude quên phat_s thì lấy thoi_luong_s.
    // Phim truyện (không bám mẫu): kẹp lên giây đọc tối thiểu (nhip-hinh.ts › giayDoc) — Claude vẫn hay chia đều thời lượng cho số shot.
    const phat = (x: z.infer<typeof ShotSchema>) => { const g = Number.isFinite(x.phat_s) && x.phat_s > 0 ? x.phat_s : x.thoi_luong_s; return Math.max(mau ? 1 : toiGiay, Math.min(8, Math.round(g * 2) / 2)); };
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
    return { ok: true, tomTat: p.tom_tat, hoSo: p.ho_so, canh, beats, phanCanh, model: r.model, tokens: tkCua(r) };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
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
    // Kinh thánh series (13/10/2026): động cơ + logline từng tập — tập mới đi đúng động cơ, đúng logline của nó, không lặp tình huống tập khác.
    kt.series?.dong_co?.trim() ? `KINH THÁNH SERIES:\nĐộng cơ (mỗi tập cùng kiểu xung đột, tình huống mới): ${kt.series.dong_co}${kt.series.khan_gia ? `\nKhán giả: ${kt.series.khan_gia}` : ''}${kt.series.dinh_dang ? `\nĐịnh dạng: ${kt.series.dinh_dang}` : ''}\nCác tập:\n${kt.series.tap.map((t) => `- Tập ${t.so}${t.ten ? ` "${t.ten}"` : ''}: ${t.logline || '(chưa có logline)'}`).join('\n')}\nViết đúng logline của tập được giao; KHÔNG lặp tình huống/quyền năng/cú lật của tập khác. Khung 5 nhịp bắt buộc: Hook ≤ 3 giây → Vấn đề → Leo thang (2–3 lần thử, mỗi lần tệ hơn) → Lật ngược (ở 55–90% thời lượng) → Kết; tập chưa phải tập cuối thì kết bằng MÓC (cliffhanger/teaser) sang tập sau.` : '',
    opts.tapSo ? `Viết kịch bản TẬP ${opts.tapSo}.` : '',
    `Tổng thời lượng mục tiêu: ${opts.thoiLuongS ?? 30} giây.`,
    `BRIEF:\n${opts.brief.trim()}`,
    `KHUNG BEAT (${CAU_TRUC[khoaKhung(opts.loai, kt.the_loai, goiTheoKey(kt.goi)?.khung)]!.ten}):\n${CAU_TRUC[khoaKhung(opts.loai, kt.the_loai, goiTheoKey(kt.goi)?.khung)]!.beats.map((b) => `- ${b.ten}: ${b.mo_ta}`).join('\n')}`,
    'Viết kịch bản đúng định dạng kịch bản phim chuyên nghiệp, đánh số cảnh (Cảnh 1, Cảnh 2…). Một CẢNH = một nơi + một quãng thời gian liền; tiêu đề cảnh ghi THỜI ĐIỂM cụ thể (vd ĐÊM – 23:40, ngay sau khi đèn tắt) và cảnh đầu tập tả bằng hình nơi chốn + giờ (luật 12–13). Đây là KỊCH BẢN của biên kịch: chỉ có truyện — KHÔNG ghi máy, cỡ cảnh, ống kính, số shot (đó là SHOT LIST của đạo diễn ở bước tách cảnh; ngành tách hai tài liệu, không gộp). Mỗi cảnh: dòng tiêu đề (NỘI/NGOẠI. ĐỊA ĐIỂM – THỜI ĐIỂM), đoạn hành động, rồi thoại theo khuôn:\nTÊN NHÂN VẬT\n  (diễn xuất: nhìn lên, giơ tay…)\n  Lời nói.\nĐi đúng khung beat trên. Mỗi cảnh ghi: bối cảnh, mục tiêu + xung đột của nhân vật, hành động, lời thoại (có ẩn ý, đúng giọng từng nhân vật), cảm xúc chuyển từ đâu tới đâu, không khí (ánh sáng, âm thanh). Cảm xúc của tập phải có lên có xuống. Không giải thích thêm, chỉ trả kịch bản.',
  ].filter(Boolean).join('\n\n');
  try {
    const r = await c.messages.create({
      model: kt.mo_hinh_chu, max_tokens: 16000, system: heThong(opts.loai, kt), messages: [{ role: 'user', content: user }],
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const text = r.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text ? { ok: true, kichBan: text, model: r.model, tokens: tkCua(r) } : { ok: false, loi: 'Claude không trả chữ' };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

/** Mô tả anchor → prompt tiếng Anh sinh "ảnh mẫu" (character sheet) để các cảnh sau tham chiếu. Không gọi LLM: ghép chuỗi là đủ. */
// "Sinh thêm" mà vẫn đưa ảnh cũ làm tham chiếu + đúng prompt cũ → model chép y lại ảnh cũ (08/10/2026: hai ảnh Đường mòn Rêu Phong
// giống hệt). Mỗi lần sinh thêm đổi sang một góc/khuôn hình khác theo lượt; ảnh cũ chỉ để giữ danh tính, không để sao chép.
const GOC_THEM: Record<string, string[]> = {
  nhan_vat: ['Full-body action pose sheet: walking, running, sitting, pointing, waving', 'Close-up expression sheet: laughing, angry, scared, thinking, crying, determined', 'Character shown in a natural three-quarter view standing in soft daylight, medium shot', 'Back and side detail sheet: outfit, accessories, hands and feet close-ups'],
  boi_canh: ['Same location seen from the OPPOSITE direction, reverse angle', 'Low ground-level angle looking up, close foreground details', 'High aerial bird-eye view of the whole place', 'Medium shot focusing on one landmark detail of the place', 'Wide shot from the far side, the place seen at a distance'],
  san_pham: ['Product from a 45-degree side angle', 'Macro close-up of material texture and stitching details', 'Flat lay top-down shot', 'Back view of the product'],
  dao_cu: ['Prop from a different angle, side view', 'Macro close-up detail of the prop', 'Prop shown at true scale beside a plain ballpoint pen'],
  cau_kien: ['The fixture from a 45-degree angle', 'Macro close-up of its material, colour and finish', 'Straight front-on view of the whole fixture', 'Side profile view of the fixture'],
};
/** ẢNH MẪU = ĐÚNG MÔ TẢ, KHÔNG HƠN (anh 22/10/2026 "không được thiếu thì cũng không được thừa"; phim #132: cửa kính tự in "总裁办公室 CEO OFFICE", cửa thang
 *  máy tự gắn bảng số "28", logo mọc thêm biểu tượng, thành viên HĐQT vest nâu thành vest đen, bàn nhân viên thành bàn giám đốc chạm trổ). Danh sách trắng:
 *  chỉ chi tiết mô tả nêu; chữ chỉ là chữ mô tả đặt trong ngoặc kép. */
export const cauDungMoTa = (moTa: string): string => {
  const chu = [...new Set([...moTa.matchAll(/["“]([^"”]{1,60})["”]/g)].map((m) => m[1]!.trim()).filter(Boolean))];
  return `WHITELIST: the subject has EXACTLY the features, colours, materials and style the description names — nothing added, nothing upgraded or restyled. ${chu.length ? `The only lettering is ${chu.map((c) => `"${c}"`).join(', ')}, spelled exactly; no other text, numbers or symbols.` : 'No text, numbers, labels or symbols on it.'}`;
};
export function promptAnhMau(nv: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta'>, kt: KinhThanh, daCo = 0): string {
  if (daCo > 0) {
    const ds = GOC_THEM[nv.loai] ?? GOC_THEM.boi_canh!;
    const goc = ds[(daCo - 1) % ds.length]!;
    return `${goc}. Subject: ${nv.mo_ta}. Visual style: ${phongCachHinh(docKinhThanh(kt).phong_cach) || 'consistent cinematic look'}. `
      + 'The reference images only define the identity/design of the subject — create a NEW image with a clearly DIFFERENT camera angle and composition; do NOT reproduce the reference image.'
      + (nv.loai === 'dao_cu' || nv.loai === 'san_pham' || nv.loai === 'cau_kien' ? ' ' + CO_LAP_VAT : '') + ' ' + cauDungMoTa(nv.mo_ta);
  }
  const k = docKinhThanh(kt);
  const loai = nv.loai === 'nhan_vat' ? 'Character design reference sheet on a plain light background: full-body turnaround (front, three-quarter, side, back) in a neutral pose, plus a row of head close-ups showing neutral, happy, sad and surprised expressions; identical design in every view'
    : nv.loai === 'san_pham' ? 'Product reference shot, centered, soft studio lighting, plain background, exact product details'
    : nv.loai === 'boi_canh' ? 'Establishing shot of the location, wide angle, no characters'
    : nv.loai === 'dao_cu' ? 'Prop reference shot, centered, plain background'
    : nv.loai === 'cau_kien' ? 'Single architectural fixture reference shot on a plain neutral background — only this one fixture, no room or people around it, centered, even lighting, exact material and finish'
    : 'Style reference frame';
  // Đạo cụ / sản phẩm: câu CÔ LẬP đứng SAU phong cách phim — phong cách kiểu "luxury corporate drama" kéo cả văn phòng + người vào ảnh mẫu
  // (tổng tài 17/10/2026: điện thoại cầm trong tay một người đàn ông, thẻ nhân viên in ảnh + tên một cô gái khác) → keyframe nhận người lạ làm tham chiếu.
  const coLap = nv.loai === 'dao_cu' || nv.loai === 'san_pham' || nv.loai === 'cau_kien' ? ' ' + CO_LAP_VAT : '';
  return `${loai}. ${nv.mo_ta}. Visual style: ${phongCachHinh(k.phong_cach) || 'consistent cinematic look'}.${coLap} ${cauDungMoTa(nv.mo_ta)}`;
}
export const CO_LAP_VAT = 'ISOLATED object only, on a plain seamless light-grey studio background: no people, no hands, no faces, no room, no scenery, no other objects. Only if the object itself carries an ID photo or a printed name (badge, card), leave that area blank — never add grey patches, stickers or labels to any other object.';

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

export type DungChu = { model: string; tokens: { in: number; out: number; vnd?: number } };
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
    return p ? { ok: true, data: p, model: r.model, tokens: tkCua(r) } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

const HE_THONG_GOI_Y = 'Bạn là biên kịch kiêm đạo diễn hình ảnh của xưởng video AI. Mọi gợi ý phải KHỚP với ngữ cảnh đã cho (phong cách, tuyến nhân vật, các tập) — không đổi đặc tính đã có, chỉ bổ sung và làm rõ. Trả lời bằng tiếng Việt trừ khi trường yêu cầu tiếng Anh.';

/** MÙA PHIM (series, 14/10/2026 — Tango & Lint): động cơ series, luật thế giới, khuôn tập + bản đồ N tập (phiêu lưu xen nguồn gốc nhân vật,
 *  gài → trả qua các tập, tập cuối là đỉnh điểm). Đọc trọn ngữ cảnh phim (tiền đề, phong cách, nhân vật + tiểu sử, bối cảnh, đạo cụ). */
const MuaPhimSchema = z.object({
  dong_co: z.string().describe('Động cơ series một đoạn (tiếng Việt): mỗi tập cùng kiểu xung đột gì, ai muốn gì, ai cản — để tập nào cũng đúng chất'),
  luat_the_gioi: z.array(z.string()).describe('5-8 luật của thế giới (tiếng Việt), vd khi nào đồ vật sống, Gã khổng lồ chỉ lộ bàn tay, đèn bàn là mặt trời…'),
  khuon_tap: z.string().describe('Khuôn một tập (tiếng Việt): các nhịp + số giây, gag mở, gag kết'),
  tap: z.array(z.object({
    so: z.number(), ten: z.string().describe('Tên tập tiếng Anh, ngắn, gây tò mò (khán giả thấy)'),
    logline: z.string().describe('Logline tiếng Anh một câu: ai muốn gì, vướng gì, lật ngược gì'),
    loai: z.enum(['phieu_luu', 'nguon_goc', 'ket_mua']).describe('phieu_luu = tập phiêu lưu thường; nguon_goc = tập kể nguồn gốc / vết sẹo / bí mật của một nhân vật; ket_mua = tập cuối mùa'),
    nhan_vat: z.array(z.string()).describe('Tên nhân vật chính của tập (đúng tên anchor)'),
    boi_canh: z.array(z.string()).describe('Tên bối cảnh / đạo cụ dùng (đúng tên anchor)'),
    gai_tra: z.string().describe('Gài / trả của tập (tiếng Việt): chi tiết gài cho tập sau hoặc trả cho tập trước'),
  })),
});
export const vietMuaPhim = (nc: NguCanhPhim, soTap: number, yeuCau = '') =>
  hoi(MuaPhimSchema, docKinhThanh(nc.kinhThanh), HE_THONG_GOI_Y, `${taNguCanh(nc)}\n\nViết KINH THÁNH MÙA 1 cho series này: động cơ series, luật thế giới, khuôn một tập, và bản đồ ĐÚNG ${soTap} tập. Xen tập phiêu lưu với tập NGUỒN GỐC của từng nhân vật (dựa đúng tiểu sử: nguồn gốc, vết sẹo, bí mật, món yêu/ghét); mỗi tập một xung đột rõ dựa trên món yêu/ghét/nỗi sợ; mỗi bối cảnh / đạo cụ đặc trưng được dùng làm sân chơi; tập cuối là đỉnh điểm của mùa. Mọi gag phải hiểu được khi tắt tiếng.${yeuCau ? `\nYÊU CẦU CỦA ĐẠO DIỄN (bắt buộc): ${yeuCau}` : ''}`);

/** TUYẾN TRUYỆN + SỔ GÀI / TRẢ rút từ bản đồ series (tuyen-truyen.ts): chỉ đọc động cơ + bản đồ tập (gọn, không kéo kịch bản) → rẻ.
 *  Người bấm trộn vào sổ bằng tronAi (chỉ điền chỗ trống). */
const TuyenTruyenSchema = z.object({
  tuyen: z.array(z.object({ ma: z.string().describe('Mã tuyến: A, B, C…'), ten: z.string().describe('Tên tuyến tiếng Việt ngắn, vd "Tango tìm đường về nhà"') }))
    .describe('2-4 tuyến: A = tuyến chính cả series, B/C = tuyến phụ (quan hệ, bí ẩn, nguồn gốc nhân vật). Giữ đúng mã + tên các tuyến đã có.'),
  su_kien: z.array(z.object({ so: z.number().describe('số tập'), ma: z.string().describe('mã tuyến'), viec: z.string().describe('sự kiện của tuyến trong tập, tiếng Việt, tối đa 12 từ') }))
    .describe('Chỉ ghi ô mà tuyến thật sự có chuyện trong tập đó; tập không có chuyện của tuyến thì bỏ, không bịa'),
  gai_tra: z.array(z.object({ chi_tiet: z.string().describe('chi tiết được gài, tiếng Việt, tối đa 10 từ'), gieo: z.number().describe('tập gieo'), tra: z.number().nullable().describe('tập trả; null nếu bản đồ chưa có tập trả') }))
    .describe('Mọi chi tiết gài → trả đọc được từ ô "gài/trả" và logline các tập'),
});
export function goiYTuyenTruyen(kt0: KinhThanh, tenPhim: string): Promise<GoiYKq<z.infer<typeof TuyenTruyenSchema>>> {
  const kt = docKinhThanh(kt0); const s = kt.series;
  const tap = [...(s?.tap ?? [])].sort((a, b) => a.so - b.so).map((t) => `Tập ${t.so} (mùa ${t.mua ?? 1}${t.loai ? `, ${t.loai}` : ''}) "${t.ten}": ${t.logline}${t.nhan_vat?.length ? ` | nhân vật: ${t.nhan_vat.join(', ')}` : ''}${t.gai_tra ? ` | gài/trả: ${t.gai_tra}` : ''}`).join('\n');
  const co = (s?.tuyen ?? []).map((t) => `${t.ma} = ${t.ten}`).join('; ');
  return hoi(TuyenTruyenSchema, kt, HE_THONG_GOI_Y, `PHIM: ${tenPhim}\nLogline: ${kt.logline}\nĐộng cơ series: ${s?.dong_co ?? ''}\n${co ? `Tuyến đã có: ${co}\n` : ''}\nBẢN ĐỒ TẬP:\n${tap}\n\nLập BẢNG TUYẾN TRUYỆN (tuyến A/B/C + sự kiện của từng tuyến trong từng tập) và SỔ GÀI / TRẢ (chi tiết gieo ở tập nào, trả ở tập nào) cho series này — chỉ dựa trên bản đồ trên.`);
}

/** VIẾT TIẾP N TẬP trên bản đồ series (anh 31/10/2026: "mở rộng thêm vài tập để xem tuyến truyện sẽ thế nào"): đọc bản đồ + bảng tuyến +
 *  sổ gài/trả hiện có → viết các tập kế tiếp nối mạch, ghi sự kiện từng tuyến, gieo chi tiết mới, TRẢ chi tiết đang treo. Gọn (không kéo kịch bản). */
const ThemTapSchema = z.object({
  tap: z.array(z.object({
    so: z.number(), ten: z.string().describe('Tên tập, cùng ngôn ngữ các tập đã có, ngắn, gây tò mò'),
    logline: z.string().describe('Logline một câu, cùng ngôn ngữ các tập đã có: ai muốn gì, vướng gì, lật ngược gì'),
    loai: z.enum(['phieu_luu', 'nguon_goc', 'ket_mua']).describe('ket_mua chỉ cho tập cuối cùng nếu được yêu cầu kết mùa'),
    nhan_vat: z.array(z.string()).describe('nhân vật chính của tập (đúng tên đã có)'),
    boi_canh: z.array(z.string()).describe('bối cảnh / đạo cụ (đúng tên đã có nếu dùng lại)'),
    gai_tra: z.string().describe('gài / trả của tập (tiếng Việt)'),
  })).describe('Các tập MỚI, số nối tiếp tập cuối'),
  su_kien: z.array(z.object({ so: z.number(), ma: z.string(), viec: z.string().describe('sự kiện của tuyến trong tập, tiếng Việt, tối đa 14 từ') }))
    .describe('Sự kiện của từng tuyến trong các tập MỚI; tuyến chính A có mặt gần như mọi tập, tuyến phụ không bỏ quá 2 tập liền'),
  gai_tra_moi: z.array(z.object({ chi_tiet: z.string(), gieo: z.number(), tra: z.number().nullable() })).describe('Chi tiết MỚI gieo trong các tập mới'),
  tra_cu: z.array(z.object({ chi_tiet: z.string().describe('đúng nguyên văn chi tiết đang treo trong sổ'), tra: z.number() })).describe('Chi tiết ĐANG TREO được trả ở tập mới nào'),
});
export function vietThemTap(kt0: KinhThanh, tenPhim: string, n: number, tenAnchor: string[], khung = ''): Promise<GoiYKq<z.infer<typeof ThemTapSchema>>> {
  const kt = docKinhThanh(kt0); const s = kt.series;
  const tuyen = s?.tuyen ?? [];
  const tap = [...(s?.tap ?? [])].sort((a, b) => a.so - b.so).map((t) => `Tập ${t.so} "${t.ten}": ${t.logline}${tuyen.map((x) => (t.su_kien?.[x.ma] ? `\n   ${x.ma}: ${t.su_kien[x.ma]}` : '')).join('')}`).join('\n');
  const so = (s?.so_gai_tra ?? []).map((g) => `- ${g.chi_tiet} (gieo tập ${g.gieo}, ${g.tra == null ? 'CÒN TREO' : `trả tập ${g.tra}`})`).join('\n');
  const cuoi = Math.max(0, ...(s?.tap ?? []).map((t) => t.so));
  return hoi(ThemTapSchema, kt, HE_THONG_GOI_Y, `PHIM: ${tenPhim}\nLogline: ${kt.logline}\nĐộng cơ series: ${s?.dong_co ?? ''}\nNhân vật / bối cảnh đã có: ${tenAnchor.join(', ')}\n${khung ? `${khung}\n` : ''}TUYẾN: ${tuyen.map((t) => `${t.ma} = ${t.ten}`).join('; ')}\n\nBẢN ĐỒ HIỆN CÓ:\n${tap}\n\nSỔ GÀI / TRẢ:\n${so || '(trống)'}\n\nViết tiếp ĐÚNG ${n} tập (tập ${cuoi + 1}–${cuoi + n}) nối mạch: mỗi tập leo thang xung đột, có cú lật, kết bằng móc. Ghi sự kiện từng tuyến cho các tập mới, gieo chi tiết mới và trả dần các chi tiết đang treo (đừng trả hết một lúc).`);
}

/** SẮP TUYẾN THEO KHUNG NGÀNH (khung-tuyen.ts): xếp lại các làn của bản đồ theo vai ngành của dạng phim (vd phim ngắn dọc A quan hệ · B thân phận ·
 *  C phản diện · D quá khứ · E phụ), chia lại sự kiện từng tập vào đúng làn, và nêu các chi tiết CỐ Ý để mở sang tập / mùa sau. Gọn — không kéo kịch bản. */
const SapKhungSchema = z.object({
  tuyen: z.array(z.object({ ma: z.string(), ten: z.string().describe('tên tuyến tiếng Việt, cụ thể theo phim này'), vai: z.string().describe('vai ngành, đúng khoá trong khung') }))
    .describe('Chỉ những tuyến bản đồ THẬT SỰ có chuyện (vai ngành chưa có chuyện thì bỏ, đừng bịa); giữ mã A/B/C… đúng như khung'),
  su_kien: z.array(z.object({ so: z.number(), ma: z.string(), viec: z.string().describe('tiếng Việt, tối đa 14 từ') }))
    .describe('Sự kiện của MỌI tập trên bản đồ, chia vào đúng làn mới — mỗi tập 1–3 làn'),
  mo: z.array(z.object({ chi_tiet: z.string().describe('chi tiết / câu hỏi còn bỏ ngỏ (tiếng Việt, tối đa 12 từ) — giữ NGUYÊN VĂN nếu là chi tiết đang treo trong sổ'),
    gieo: z.number(), mo: z.enum(['tap_sau', 'mua_sau']) })).describe('3–6 điều CỐ Ý để mở cuối bản đồ: câu hỏi kéo người xem sang tập sau / mùa sau'),
});
export function sapKhungTuyen(kt0: KinhThanh, tenPhim: string, khung: string): Promise<GoiYKq<z.infer<typeof SapKhungSchema>>> {
  const kt = docKinhThanh(kt0); const s = kt.series; const tuyen = s?.tuyen ?? [];
  const tap = [...(s?.tap ?? [])].sort((a, b) => a.so - b.so).map((t) => `Tập ${t.so} "${t.ten}": ${t.logline}${tuyen.map((x) => (t.su_kien?.[x.ma] ? `\n   ${x.ma}: ${t.su_kien[x.ma]}` : '')).join('')}`).join('\n');
  const so = (s?.so_gai_tra ?? []).map((g) => `- ${g.chi_tiet} (gieo tập ${g.gieo}, ${g.tra == null ? 'CÒN TREO' : `trả tập ${g.tra}`})`).join('\n');
  return hoi(SapKhungSchema, kt, HE_THONG_GOI_Y, `PHIM: ${tenPhim}\nLogline: ${kt.logline}\nĐộng cơ series: ${s?.dong_co ?? ''}\n\n${khung}\n\nTUYẾN HIỆN CÓ: ${tuyen.map((t) => `${t.ma} = ${t.ten}`).join('; ')}\nBẢN ĐỒ:\n${tap}\n\nSỔ GÀI / TRẢ:\n${so || '(trống)'}\n\nSắp lại các tuyến của bản đồ theo KHUNG TUYẾN NGÀNH ở trên: tách sự kiện đang bị nhét chung (vd bí mật quá khứ nằm trong tuyến quan hệ) ra đúng làn, chia lại sự kiện mọi tập, rồi nêu các điều cố ý để mở cuối bản đồ.`);
}

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

/** Khung ảnh mẫu cho từng nhóm LOOK của nhân vật — như đoàn phim chụp tham chiếu: ảnh fitting phục trang toàn thân THẤY GIÀY, ảnh tóc, ảnh trang điểm,
 *  ảnh liền mạch cận đúng món (cổ tay đeo đồng hồ, chỗ có vết). Trước 31/10/2026 mọi nhóm chung một khung "nhân vật nền trơn" → bộ đồ không thấy giày,
 *  đồng hồ nhỏ xíu không dùng làm tham chiếu được. */
const KHUNG_LOOK: Record<string, string> = {
  trang_phuc: 'Full-body costume fitting photo, head to toe with the shoes clearly visible, standing straight, front view',
  toc: 'Head-and-shoulders hair reference, the whole hairstyle clearly visible',
  trang_diem: 'Beauty close-up of the face, the makeup clearly visible',
  do_deo: 'Close-up continuity photo of the accessory as worn on the body (on the wrist / ear / neck / face it belongs to), the item sharp and fully visible',
  vet: 'Continuity photo framed on the mark — the exact spot on the body or clothing, the mark sharp, at true size and fully visible',
  trang: 'Medium shot showing the body state clearly',
};
export function promptBienThe(a: Pick<NhanVat, 'loai' | 'ten' | 'mo_ta'>, b: Pick<BienThe, 'nhom' | 'mo_ta' | 'ten'>, kt: KinhThanh): string {
  const k = docKinhThanh(kt);
  const khung = a.loai === 'boi_canh' ? 'Establishing shot of the SAME location as the reference image' : a.loai === 'san_pham' ? 'Product shot of the EXACT same product as the reference image'
    : `The SAME character as the reference image, single character, plain light background${KHUNG_LOOK[b.nhom] ? `. ${KHUNG_LOOK[b.nhom]}` : ''}`;
  return `${khung}. Identity (must not change): ${a.mo_ta}. Change only this (${b.nhom}): ${b.mo_ta || b.ten}. Visual style: ${phongCachHinh(k.phong_cach) || 'consistent with reference'}. Keep proportions, colors, markings and outfit details identical unless the change says otherwise.`;
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
    return p ? { ok: true, data: p, model: r.model, tokens: tkCua(r) } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

// ── KIỂM KHUNG (khung.ts / kiem-khung.ts): máy NHÌN mọi keyframe của một cảnh, so với thẻ shot + với nhau ─────────────────────
// 14/10/2026: #9 → #10 Tango nhảy từ trước bàn phím ra sau bàn phím, góc giấy "trơn" có mắt — anh phải soi bằng mắt mới thấy. Bước này thay mắt.
export const KiemKhungSchema = z.object({
  bo_tri: z.string().describe('Bố trí bộ set của cảnh theo các khung (1–2 câu): đồ vật nào ở đâu, trước/sau cái gì, máy thường đứng phía nào'),
  shot: z.array(z.object({
    shot: z.number().describe('Số shot (#) đúng như nhãn ảnh'),
    loi: z.array(z.object({
      loai: z.enum(['chuyen_canh', 'bo_tri', 'vi_tri', 'vuot_truc', 'thieu', 'thua', 'trang_thai', 'anh_sang', 'nhan_dang']),
      mo_ta: z.string().describe('Lỗi NHÌN THẤY trong ảnh, cụ thể, tiếng Việt (vd "Tango ở sau bàn phím, các khung trước Tango ở trước bàn phím cạnh chuột")'),
      sua: z.string().describe('Câu bố cục / trạng thái mở viết lại (tiếng Anh) để lần sinh sau đúng'),
    })).describe('Rỗng nếu khung đúng'),
  })).describe('MỌI shot được đưa, đúng thứ tự'),
});
/** LỜI DẶN kiểm khung — MỘT nguồn cho lượt Claude API (kiemKhungCanh) và lượt tự chấm trong phiên (kiem-khung.mts --in): hai bên chấm trên cùng chữ. */
export const heKiemKhung = (phongCach: string, banDo: string): string => `Bạn là script supervisor (thư ký trường quay) kiểm tính liên tục cho phim ${phongCach ? `phong cách: ${phongCach}` : 'hoạt hình'}. Ảnh là keyframe (khung ĐẦU) của từng shot trong CÙNG một cảnh, theo thứ tự dựng. Mỗi ảnh kèm THẺ SHOT: bố cục, trạng thái mở, hướng nhìn, ai/cái gì có mặt.
Soi từng khung, chỉ báo lỗi NHÌN THẤY được. CHUYỂN CẢNH là chỗ hay hỏng nhất — soi KỸ NHẤT từng cặp khung liền nhau (kể cả từ khung cuối của cảnh trước, nếu có) theo kiểu chuyển ghi trên thẻ:
- chuyen_canh: cú chuyển từ khung trước sang khung này không nối. Liền máy = phải là giây kế tiếp của cùng khoảnh khắc (cùng chỗ, cùng phía máy, mọi thứ y nguyên). Cắt trong cùng cảnh = cùng bộ set, cùng phía trục, nhân vật mang theo trạng thái (đang cầm gì, bẹp hay tròn, đứng đâu) trừ khi thẻ nói khác. Sang cảnh mới / hoà tan = hướng ra–vào khung khớp nhau (ra mép phải thì vào từ mép trái), trạng thái mang sang khớp hành động. Khung cuối của cảnh trước chỉ để so cú chuyển — KHÔNG báo lỗi cho nó.
- bo_tri: đồ vật trong bộ set đổi chỗ, đổi trước/sau, đổi số lượng so với các khung khác của cảnh (máy đổi góc là bình thường; set thì phải đứng yên như stop-motion thật).
- vi_tri: nhân vật ở sai phía / sai chỗ trong set so với khung trước và hành động (vd khung trước ở trước vật X, khung sau ở sau vật X mà không có hành động di chuyển).
- vuot_truc: máy sang phía bên kia trục hành động, hướng màn hình của nhân vật / chuyển động đảo so với khung trước mà thẻ không yêu cầu.
- thieu: nhân vật / đạo cụ thẻ shot ghi có mặt mà không thấy.
- thua: thứ thẻ không có — nhân vật nhân đôi, tay/ngón tay người (trừ khi thẻ có), MẶT/MẮT trên vật thẻ bảo là trơn, chữ/logo lạ. PHIM AI hay tự BỊA: soi kỹ mặt bàn / kệ / sàn — vật nào (cốc, sổ, giấy, bút, điện thoại, cây, đồ trang trí, người phụ) KHÔNG có khối tương ứng trong khung xám 3D là thừa.
- trang_thai: khung không phải trạng thái MỞ của thẻ (vd thẻ mở là "đang nằm úp" mà ảnh đứng thẳng).
- anh_sang: ánh sáng / giờ không nối với cảnh (vd cảnh đã tắt đèn mà khung sáng đèn vàng ấm).
- nhan_dang: nhân vật / đạo cụ khác hẳn tạo hình ở các khung khác; trang phục / vết trên người khác biến thể chuẩn; TRANH, thư pháp, màn chiếu, đồng hồ, bảng chỉ dẫn hiện nội dung KHÁC khung xám 3D hoặc khác khung khác của cùng cảnh (bức A thành bức B).
Không chấm đẹp xấu, không bắt lỗi nhỏ không ai thấy khi xem. Một khung đúng thì loi rỗng.${banDo ? `\n\nBẢN ĐỒ KHÔNG GIAN của phim:\n${banDo}` : ''}`;
export async function kiemKhungCanh(o: { canh: string; banDo: string; phongCach: string; truoc?: { so: number; the: string; b64: string } | null; shot: { so: number; the: string; b64: string; xam?: string | null }[]; kt: Required<KinhThanh> }): Promise<GoiYKq<z.infer<typeof KiemKhungSchema>>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  try {
    const r = await c.messages.parse({
      model: o.kt.mo_hinh_chu, max_tokens: 6000,
      system: heKiemKhung(o.phongCach, o.banDo),
      messages: [{ role: 'user', content: [
        { type: 'text' as const, text: `CẢNH: ${o.canh}` },
        ...(o.truoc ? [{ type: 'text' as const, text: `── KHUNG CUỐI CẢNH TRƯỚC (shot #${o.truoc.so}, chỉ để so cú chuyển sang shot đầu cảnh này — không chấm)\n${o.truoc.the}` }, { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: o.truoc.b64 } }] : []),
        ...o.shot.flatMap((x) => [{ type: 'text' as const, text: `── SHOT #${x.so}\n${x.the}` }, { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: x.b64 } },
          ...(x.xam ? [{ type: 'text' as const, text: `↳ KHUNG XÁM 3D của shot #${x.so} (bố trí ĐÚNG từ bộ set thật, cùng máy): so vị trí mọi đồ vật / nhân vật trong keyframe trên với khối tương ứng ở đây — lệch chỗ, lệch trước/sau, thiếu, thừa là lỗi bo_tri / vi_tri.` }, { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: x.xam } }] : [])]),
        { type: 'text' as const, text: 'Kiểm từng shot theo thứ tự, so với thẻ của nó và với các khung khác của cảnh.' },
      ] }],
      output_config: { format: zodOutputFormat(KiemKhungSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof KiemKhungSchema> | null;
    return p ? { ok: true, data: p, model: r.model, tokens: tkCua(r) } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
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
      system: `Bạn viết bài đăng quảng cáo (Meta/TikTok) đi kèm video. ${taQc(kt)}\nLuật: không bịa số liệu/tính năng ngoài mục SẢN PHẨM; có bài mẫu thì giữ nguyên CẤU TRÚC (số dòng, emoji, ✅, nhịp câu) và chỉ đổi nội dung cho đúng sản phẩm, không chép nguyên câu; không có mẫu thì viết theo khuôn: móc 1 dòng → 3 lợi ích ✅ → trấn an → ưu đãi + kêu gọi. Ngôn ngữ: ${tenNgonNgu(kt.ngon_ngu)}${kt.qc?.thi_truong ? ` (thị trường ${kt.qc.thi_truong})` : ''}.`,
      messages: [{ role: 'user', content: `KỊCH BẢN VIDEO ĐI KÈM:\n${opts.kichBan.slice(0, 6000)}\n\nCHỮ TRÊN MÀN CỦA VIDEO (để bài đăng không lặp y chang): ${opts.chuMan.filter(Boolean).join(' · ') || '(chưa có)'}` }],
      output_config: { format: zodOutputFormat(BaiDangSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof BaiDangSchema> | null;
    return p ? { ok: true, data: p, model: r.model, tokens: tkCua(r) } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
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
    return { ok: true, data: { shots, ghi_chu: p.ghi_chu }, model: r.model, tokens: tkCua(r) };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

// ── Dịch một lô chuỗi của phim (dich-phim.ts gom + chia lô + thay lại) ──────────────────────────────────────────
const DichChuoiSchema = z.object({ ban_dich: z.array(z.object({ i: z.number().int().describe('chỉ số chuỗi gốc, chép đúng'), v: z.string().describe('bản dịch') })).describe('Đủ MỌI chuỗi đầu vào, mỗi i đúng một lần') });
export async function dichChuoi(o: { kinhThanh: KinhThanh; sang: string; ds: string[]; thuatNgu: [string, string][] }): Promise<GoiYKq<string[]>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  const kt = docKinhThanh(o.kinhThanh);
  const tong = o.ds.reduce((a, x) => a + x.length, 0);
  try {
    const r = await c.messages.parse({
      model: kt.mo_hinh_chu, max_tokens: Math.min(16000, 2000 + tong),
      system: `Bạn dịch TOÀN BỘ nội dung một phim quảng cáo sang ${tenNgonNgu(o.sang)}${kt.qc?.thi_truong ? ` (thị trường ${kt.qc.thi_truong})` : ''}. Mỗi chuỗi là một mảnh của phim: chữ trên màn, lời thoại, ghi chú diễn xuất, nhãn shot, góc máy, hành động, mô tả nhân vật/bối cảnh/sản phẩm, prompt cho model ảnh/video, kịch bản, bài đăng.
Luật:
- Chữ khán giả thấy/nghe (chữ màn, thoại, bài đăng): như người bản ngữ viết quảng cáo — tự nhiên, ngắn, mạnh; chữ màn ngắn tương đương gốc.
- Lời thoại sẽ được đọc lại (lồng tiếng) trong đúng thời lượng của câu gốc: độ dài đọc lên tương đương câu gốc, không thêm ý; xưng hô hợp quan hệ nhân vật.
- Ghi chú kỹ thuật (góc máy, hành động, diễn xuất, mô tả, prompt): tiếng ${tenNgonNgu(o.sang)} rõ ràng, đủ ý, đúng thuật ngữ quay phim.
- Tên người kiểu "Ông X"/"Bà X" → chỉ "X" (vd "Bà Linda" → "Linda"); tên bối cảnh/đạo cụ dịch thành cụm danh từ ngắn.
- Giữ nguyên: số, giá, %, tên sản phẩm/thương hiệu, emoji, xuống dòng, markdown, khoá snake_case, URL, phần đã là ${tenNgonNgu(o.sang)}.
- KHÔNG còn một chữ tiếng Việt nào trong bản dịch.${o.thuatNgu.length ? `\n- BẮT BUỘC dùng đúng bảng thuật ngữ đã chốt (gốc → dịch), kể cả khi chúng nằm trong câu dài:\n${o.thuatNgu.map(([a, b]) => `  ${a} → ${b}`).join('\n')}` : ''}`,
      messages: [{ role: 'user', content: `Dịch từng chuỗi, trả về đủ chỉ số:\n${JSON.stringify(o.ds.map((v, i) => ({ i, v })))}` }],
      output_config: { format: zodOutputFormat(DichChuoiSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof DichChuoiSchema> | null;
    if (!p) return { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
    const out = o.ds.map((g, i) => p.ban_dich.find((x) => x.i === i)?.v?.trim() || g);
    return { ok: true, data: out, model: r.model, tokens: tkCua(r) };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

// ── DỊCH NHANH MÔ TẢ SHOT SANG TIẾNG VIỆT (#1397): người duyệt bật 🇻🇳 trên lưới → shot chưa có bản dịch dịch bằng model chữ RẺ NHẤT, lưu
// vào xv_canh.hanh_dong_vi (lần sau không gọi lại). Không theo mo_hinh_chu của phim — việc này chỉ cần hiểu, không cần văn hay.
export const MO_HINH_DICH_NHANH = 'claude-haiku-4-5';
export async function dichMoTaVi(ds: string[]): Promise<GoiYKq<string[]>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  try {
    const r = await c.messages.parse({
      model: MO_HINH_DICH_NHANH, max_tokens: Math.min(8000, 1000 + ds.reduce((a, x) => a + x.length, 0)),
      system: 'Dịch mô tả hành động của từng shot phim quảng cáo sang tiếng Việt cho người duyệt đọc: một câu rõ, đủ ý, tự nhiên. Giữ nguyên tên người, tên sản phẩm, số, ô dạng {{...}}. Thuật ngữ quay phim dịch theo cách đoàn phim Việt hay nói (máy đứng yên, đẩy máy, cận cảnh…).',
      messages: [{ role: 'user', content: `Dịch từng chuỗi, trả về đủ chỉ số:\n${JSON.stringify(ds.map((v, i) => ({ i, v })))}` }],
      output_config: { format: zodOutputFormat(DichChuoiSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof DichChuoiSchema> | null;
    if (!p) return { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
    return { ok: true, data: ds.map((_, i) => p.ban_dich.find((x) => x.i === i)?.v?.trim() ?? ''), model: r.model, tokens: tkCua(r) };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

// ── THỬ NGƯỜI XEM LẦN ĐẦU (nguoi-xem.ts): lượt 1 MÙ — chỉ bảng shot người xem thấy/nghe; lượt 2 đối chiếu với ý tác giả ─────────
export const NguoiXemSchema = z.object({
  ke_lai: z.string().describe('Kể lại câu chuyện vừa xem trong 3–5 câu ngắn, đúng như một người xem bình thường hiểu — không thêm điều phim không cho thấy'),
  ai: z.string().describe('Nhân vật chính là ai (theo những gì thấy/nghe)'),
  muon: z.string().describe('Nhân vật chính muốn gì — nếu phim không làm rõ thì ghi "không rõ"'),
  can: z.string().describe('Cái gì cản trở — "không rõ" nếu không rõ'),
  lat: z.string().describe('Bất ngờ / cú lật là gì và VÌ SAO nó bất ngờ với người xem — "không thấy" nếu không có'),
  ket: z.string().describe('Kết thúc / bài học / lời hẹn tập sau mà người xem nhận được'),
  diem: z.number().describe('Mức hiểu câu chuyện 0–10 (10 = hiểu trọn, kể lại được không vấp; 5 = hiểu đại khái nhưng có chỗ không hiểu vì sao)'),
  cho_kho: z.array(z.object({
    shot: z.number().describe('Số shot (#) gây khó hiểu'),
    van_de: z.string().describe('Người xem bị vấp ở đâu: thiếu thông tin gì, câu/hình nào không hiểu, chỗ nào quá nhanh, chỗ nào im mà cần lời/tiếng'),
    sua: z.string().describe('Sửa cụ thể, ngắn: thêm/đổi câu nào (viết luôn câu mới, đúng ngôn ngữ phim), hình nào, kéo dài bao lâu'),
  })).describe('Những chỗ làm người xem vấp, theo thứ tự shot, TỐI ĐA 8 mục (gộp các shot cùng lỗi); mỗi trường ≤ 2 câu ngắn; rỗng nếu không có'),
  cat: z.array(z.object({
    shot: z.number().describe('Số shot (#) rút / gộp / bỏ được'),
    bot_s: z.number().describe('Số giây bớt được (bỏ hẳn shot = toàn bộ giây của nó)'),
    ly_do: z.string().describe('Vì sao bớt mà người xem không mất ý: lặp thông tin shot nào, gộp với shot nào, rút còn bao nhiêu giây (1 câu)'),
  })).describe('Chỗ THU NHỎ: shot thừa, lặp ý, giữ lâu hơn cần, gộp được với shot kề — để tập về độ dài chuẩn; rỗng nếu tập không dài'),
});
/** Người xem của phim QUẢNG CÁO (anh 15/10/2026: "nếu là kiểm cho mục đích QC thì ok"): cùng khoá với NguoiXemSchema (lưu chung ThuNguoiXem,
 *  cổng chung) nhưng chấm theo QC — dừng lướt, nhận ra sản phẩm, vấn đề ↔ lợi ích, ưu đãi + việc làm tiếp — không đòi cốt truyện / cú lật. */
export const NguoiXemQcSchema = z.object({
  ke_lai: z.string().describe('Kể lại QC vừa xem trong 2–4 câu ngắn đúng như người lướt bình thường hiểu: bán cái gì, cho ai, giải quyết chuyện gì, ưu đãi gì — không thêm điều video không cho thấy'),
  ai: z.string().describe('Sản phẩm là gì (theo những gì thấy/nghe) — "không rõ" nếu không nhận ra'),
  muon: z.string().describe('Vấn đề / nỗi đau mà QC nói tới — "không rõ" nếu không rõ'),
  can: z.string().describe('Lợi ích chính người xem nhớ được sau khi xem — "không rõ" nếu không rõ'),
  lat: z.string().describe('Cái gì trong 2 giây đầu làm bạn dừng lướt và VÌ SAO — "không thấy" nếu 2 giây đầu không giữ được bạn'),
  ket: z.string().describe('Ưu đãi + việc cần làm tiếp (mua ở đâu / bấm gì) mà người xem nhận được — "không rõ" nếu không rõ'),
  diem: z.number().describe('Mức hiểu + muốn bấm 0–10 (10 = hiểu trọn sản phẩm, lợi ích, ưu đãi và muốn bấm xem; 5 = hiểu đại khái nhưng không rõ lợi ích hoặc ưu đãi)'),
  cho_kho: NguoiXemSchema.shape.cho_kho,
  cat: NguoiXemSchema.shape.cat,
});
export const DoiChieuYSchema = z.object({
  khop: z.boolean().describe('Người xem có nhận được ĐÚNG điều tác giả định không (phim: câu chuyện + cú lật + kết; QC: sản phẩm + vấn đề + lợi ích chính + ưu đãi)'),
  lech: z.string().describe('Điều tác giả muốn mà người xem KHÔNG nhận được (1–2 câu); rỗng nếu khớp'),
});
/** Người xem ảo của phim KHÔNG LỜI: không lời là chủ ý — đánh giá câu chuyện qua hình + âm, góp ý bằng hành động chứ không bằng chữ. */
const XEM_KHONG_LOI = 'PHIM NÀY KHÔNG LỜI (chủ ý, kiểu Larva / Shaun the Sheep): nhân vật chỉ phát âm hiệu (tiếng kêu, bập bẹ), không có câu nói, gần như không có chữ màn. Đừng coi việc không có lời là lỗi. Câu sửa đề xuất TUYỆT ĐỐI không được là "thêm câu nói / thêm chữ màn / thêm lời dẫn" — chỉ đề xuất bằng hành động, biểu cảm, góc máy (cận vào chi tiết), tách shot, âm thanh (tiếng động, nhạc) hoặc nhịp.';
/** Luật soát của người xem QC: thay LUAT_KE_CHUYEN (luật dựng truyện) — QC không cần cú lật / nhân vật phát triển. Creative tự nhiên: không bắt lỗi
 *  đúng sai của ưu đãi / số liệu / review (anh 14/10/2026). */
const LUAT_XEM_QC = `LUẬT SOÁT QC (mỗi luật bị vi phạm là một chỗ vấp, ghi shot):
1. 2 giây đầu phải có lý do dừng lướt: một vấn đề thấy ngay bằng hình, một câu/chữ chạm đúng người xem, hoặc ưu đãi. Mở bằng cảnh chung chung là vấp.
2. Nhận ra sản phẩm là gì khi nó xuất hiện; nỗi đau và sản phẩm phải nối với nhau (thấy sản phẩm giải đúng vấn đề vừa nêu).
3. Tắt tiếng vẫn hiểu: ý chính phải nằm trên hình hoặc chữ màn. Chữ màn chỉ vài từ mỗi khung, đọc kịp trong số giây của shot.
4. Lợi ích nói bằng hình (thấy được), không chỉ bằng lời.
5. Cuối video phải rõ ưu đãi và việc làm tiếp (mua / bấm xem).
6. KHÔNG bắt lỗi đúng sai của ưu đãi, số liệu, lời review — đó là việc của người bán. KHÔNG đòi cốt truyện, cú lật hay nhân vật phát triển.`;
/** Lời dặn + đầu vào của lượt NGƯỜI XEM — MỘT nguồn cho lượt gọi Claude và cho người tự chấm (scripts/kiem-nguoi-xem.mts --in): ai chấm cũng
 *  nhận đúng cùng một chữ. Phim QC (qc = đối tượng của QC) → người xem là người lướt mạng xã hội thuộc đối tượng đó, soát theo LUAT_XEM_QC. */
export const heNguoiXem = (kt: Pick<KinhThanh, 'khong_loi'>, doDai?: string, qc?: { doi_tuong: string } | null): string => qc ? heNguoiXemQc(qc.doi_tuong, doDai) : 'Bạn là một người xem BÌNH THƯỜNG, xem video ngắn này lần đầu trên điện thoại. Bạn CHỈ biết đúng những gì có trong bảng shot: THẤY = hình trên màn, CHỮ TRÊN MÀN = chữ đọc được, NGHE = lời nghe được (ai nói). Bạn KHÔNG đọc kịch bản, không biết ý đồ tác giả, và giả sử bạn KHÔNG biết truyện gốc / bối cảnh / nhân vật nào ngoài những gì phim tự cho thấy. Mỗi shot chỉ lướt qua đúng số giây ghi trong ngoặc — chữ dài trong shot ngắn là không kịp đọc. Thành thật: chỗ nào không hiểu thì nói không hiểu. Khi liệt kê chỗ vấp, soát thêm theo luật dưới (mỗi luật bị vi phạm là một chỗ vấp, ghi shot). Trả lời tiếng Việt; câu sửa đề xuất viết đúng ngôn ngữ của phim.\n\n' + LUAT_KE_CHUYEN + (kt.khong_loi ? `\n\n${XEM_KHONG_LOI}` : '') + (doDai ? `\n\nĐỘ DÀI: ${doDai} Góp ý không chỉ được THÊM: mỗi chỗ đề xuất tách / chèn shot làm tập dài ra thì phải tìm chỗ bớt tương ứng; liệt kê ở "cat" mọi shot rút / gộp / bỏ được mà người xem không mất ý (lặp thông tin, giữ quá lâu, hai shot nói cùng một điều). Một chỗ vấp sửa được bằng cách GỘP / BỎ shot rối thì đề xuất thế, đừng tách thêm.` : '');
const heNguoiXemQc = (doiTuong: string, doDai?: string): string => `Bạn là một người đang lướt Facebook / Instagram Reels trên điện thoại, thuộc đúng nhóm khách này: ${doiTuong || 'người lớn bình thường'}. Video dưới đây là một QUẢNG CÁO bạn lướt trúng lần đầu. Bạn CHỈ biết đúng những gì có trong bảng shot: THẤY = hình trên màn, CHỮ TRÊN MÀN = chữ đọc được, NGHE = lời nghe được. Mỗi shot chỉ lướt qua đúng số giây ghi trong ngoặc — chữ dài trong shot ngắn là không kịp đọc. Thành thật như một người lướt thật: chỗ nào chán thì nói chán, chỗ nào không hiểu thì nói không hiểu. Trả lời tiếng Việt; câu sửa đề xuất viết đúng ngôn ngữ của video.\n\n${LUAT_XEM_QC}${doDai ? `\n\nĐỘ DÀI: ${doDai} QC càng gọn càng tốt: liệt kê ở "cat" mọi shot rút / gộp / bỏ được mà người xem không mất ý; một chỗ vấp sửa được bằng cách GỘP / BỎ shot thì đề xuất thế, đừng tách thêm.` : ''}`;
export const vaoNguoiXem = (o: { ban: string; nhanVat: string }): string => `NHÂN VẬT / BỐI CẢNH XUẤT HIỆN TRÊN MÀN (để biết tên gọi khi nhìn thấy):\n${o.nhanVat || '(không khai)'}\n\nBẢNG SHOT (theo thời gian):\n${o.ban}`;
export async function thuNguoiXem(o: { ban: string; nhanVat: string; logline: string; brief: string; kt: Required<KinhThanh>; doDai?: string; qc?: { doi_tuong: string } | null }): Promise<GoiYKq<{ xem: z.infer<typeof NguoiXemSchema>; doi: z.infer<typeof DoiChieuYSchema> }>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  try {
    // Trần rộng: tiếng Việt tốn token, 11 shot × chỗ vấp kèm câu sửa vượt 3k → JSON đứt "Unterminated string" (13/10/2026, nút báo lỗi).
    const r1 = await c.messages.parse({
      model: o.kt.mo_hinh_chu, max_tokens: 12000,
      system: heNguoiXem(o.kt, o.doDai, o.qc),
      messages: [{ role: 'user', content: vaoNguoiXem(o) }],
      output_config: { format: zodOutputFormat((o.qc ? NguoiXemQcSchema : NguoiXemSchema) as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r1.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const xem = r1.parsed_output as z.infer<typeof NguoiXemSchema> | null;
    if (!xem) return { ok: false, loi: 'Claude trả JSON không đúng khuôn (lượt người xem)' };
    const r2 = await c.messages.parse({
      model: o.kt.mo_hinh_chu, max_tokens: 800,
      system: o.qc ? 'Bạn so điều MỘT NGƯỜI XEM nhận được từ một quảng cáo với ý đồ của người làm QC. Chỉ đánh giá người xem có nhận đúng sản phẩm, vấn đề, lợi ích chính và ưu đãi không — không chấm văn, không xét đúng sai của ưu đãi / số liệu.'
        : 'Bạn so câu chuyện MỘT NGƯỜI XEM kể lại với ý đồ của tác giả. Chỉ đánh giá người xem có nhận được đúng câu chuyện, cú lật và kết không — không chấm văn.',
      messages: [{ role: 'user', content: o.qc
        ? `Ý ĐỒ QC\n${o.logline || '(không có)'}\nBrief: ${o.brief || '(không có)'}\n\nNGƯỜI XEM NHẬN ĐƯỢC\n${xem.ke_lai}\nSản phẩm: ${xem.ai}\nVấn đề: ${xem.muon}\nLợi ích: ${xem.can}\nƯu đãi / việc làm tiếp: ${xem.ket}`
        : `Ý ĐỒ TÁC GIẢ\nLogline: ${o.logline || '(không có)'}\nBrief: ${o.brief || '(không có)'}\n\nNGƯỜI XEM KỂ LẠI\n${xem.ke_lai}\nCú lật người xem thấy: ${xem.lat}\nKết người xem nhận: ${xem.ket}` }],
      output_config: { format: zodOutputFormat(DoiChieuYSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    const doi = r2.parsed_output as z.infer<typeof DoiChieuYSchema> | null;
    if (!doi) return { ok: false, loi: 'Claude trả JSON không đúng khuôn (lượt đối chiếu)' };
    return { ok: true, data: { xem, doi }, model: r1.model, tokens: tkCua(r1, r2) };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

// ── SỬA KỊCH BẢN THEO NGƯỜI XEM: nhận chỗ vấp của bước kiểm → sửa đúng các shot đó (+ chèn shot khi cần cho THẤY), giữ phần còn lại ────
const DongSua = z.object({ nhan_vat: z.string().describe('Tên nhân vật nói, đúng tên anchor; rỗng = người dẫn ngoài khung'), dien_xuat: z.string().describe('Ghi chú diễn xuất ngắn (tiếng Anh)'), loi: z.string().describe('Lời nói, đúng ngôn ngữ phim') });
const SuaKbSchema = z.object({
  sua: z.array(z.object({
    shot: z.number().describe('Số shot (#) đang có cần sửa'),
    hanh_dong: z.string().describe('Hành động người xem THẤY trong shot (1 câu, tiếng Anh)'),
    hanh_dong_vi: z.string().describe('Câu hành động đó dịch sang tiếng Việt cho người duyệt đọc (1 câu)'),
    chu_man: z.string().describe('Chữ trên màn ≤ 5 từ, không dấu chấm cuối; rỗng nếu không cần'),
    thoai: z.array(DongSua).describe('TOÀN BỘ dòng thoại / lời dẫn của shot sau khi sửa (giữ nguyên dòng không cần đổi)'),
    prompt_anh: z.string().describe('Prompt ảnh keyframe tiếng Anh sau khi sửa (giữ nguyên nếu hình không đổi)'),
    doi_hinh: z.boolean().describe('true nếu hình shot phải khác bản cũ (cần sinh lại keyframe)'),
    phat_s: z.number().describe('Số giây shot phát (≥ 2; đủ đọc hết lời ~2,5 từ/giây + 0,5 giây thở)'),
    nhan_vat: z.array(z.string()).describe('Tên MỌI anchor (nhân vật / bối cảnh / đạo cụ) xuất hiện trong shot sau khi sửa — đúng tên trong danh sách; ai có trong prompt_anh thì phải có ở đây'),
  })).describe('Chỉ những shot cần sửa để người xem hiểu'),
  them: z.array(z.object({
    sau_shot: z.number().describe('Chèn ngay SAU shot số này (theo số shot hiện tại)'),
    canh: z.string().describe('Tên shot ngắn (tiếng Anh)'),
    hanh_dong: z.string(), hanh_dong_vi: z.string().describe('Câu hành động dịch sang tiếng Việt cho người duyệt đọc'), chu_man: z.string(), thoai: z.array(DongSua),
    prompt_anh: z.string().describe('Prompt ảnh keyframe tiếng Anh, cùng phong cách phim'),
    nhan_vat: z.array(z.string()).describe('Tên anchor (nhân vật / bối cảnh / đạo cụ) có trong shot, đúng tên trong danh sách'),
    phat_s: z.number(),
  })).describe('Shot mới chỉ khi cần cho người xem THẤY một chi tiết mà shot cũ không có (vd cận cảnh làm nên cú lật); tối đa 3'),
  ghi_chu: z.string().describe('2–3 câu tiếng Việt: đã sửa gì để người xem hiểu'),
});
export async function suaKichBanTheoNguoiXem(o: { bang: string; anchor: string; vap: string; lech: string; brief: string; kt: Required<KinhThanh> }): Promise<GoiYKq<z.infer<typeof SuaKbSchema>>> {
  const c = client();
  if (!c) return { ok: false, loi: 'Thiếu ANTHROPIC_API_KEY trên máy chủ' };
  try {
    const r = await c.messages.parse({
      model: o.kt.mo_hinh_chu, max_tokens: 16000,
      system: `Bạn là biên kịch sửa kịch bản phim ngắn sau buổi chiếu thử: người xem chưa hiểu ở các chỗ được báo. Sửa ĐÚNG các chỗ đó cho người xem hiểu, giữ nguyên câu chuyện, nhân vật, phong cách và mọi shot không liên quan. Lời và chữ màn viết bằng ${tenNgonNgu(o.kt.ngon_ngu)}; hanh_dong, prompt_anh tiếng Anh, không chữ/phụ đề trong prompt. Phong cách hình của phim: ${o.kt.phong_cach || '(giữ như prompt cũ)'}.\n\n${LUAT_KE_CHUYEN}${o.kt.khong_loi ? `\n\n${LUAT_KHONG_LOI}\nSỬA KHÔNG LỜI: chỉ sửa bằng hành động, biểu cảm, góc máy, nhịp (tách/thêm shot) và âm hiệu; CẤM thêm từ ngôn ngữ người vào dòng thoại và CẤM thêm chữ màn giải thích. Dòng thoại nào đang có từ ngôn ngữ người (vd "Gummy!", "Come back!", "Dust!") → đổi về âm hiệu của nhân vật; chữ màn nào ngoài TÊN TẬP (một lần, đầu phim) → bỏ (để rỗng).` : ''}`,
      messages: [{ role: 'user', content: `Ý TÁC GIẢ (brief): ${o.brief || '(không có)'}\n\nNHÂN VẬT / BỐI CẢNH (dùng đúng tên):\n${o.anchor}\n\nKỊCH BẢN HIỆN TẠI (từng shot):\n${o.bang}\n\nNGƯỜI XEM VẤP Ở:\n${o.vap}\n${o.lech ? `\nNGƯỜI XEM HIỂU LỆCH Ý TÁC GIẢ: ${o.lech}` : ''}` }],
      output_config: { format: zodOutputFormat(SuaKbSchema as unknown as Parameters<typeof zodOutputFormat>[0]) },
    });
    if (r.stop_reason === 'refusal') return { ok: false, loi: 'Claude từ chối yêu cầu này' };
    const p = r.parsed_output as z.infer<typeof SuaKbSchema> | null;
    return p ? { ok: true, data: p, model: r.model, tokens: tkCua(r) } : { ok: false, loi: 'Claude trả JSON không đúng khuôn' };
  } catch (e) {
    return { ok: false, loi: loiGoi(e) };
  }
}

// ── PHƯƠNG ÁN CHỮ cho một cặp concept × template (concept.ts, anh 16/10/2026: "đổi text, câu chữ sẽ ra creative khác nhau") ─────────────────
// Mỗi ô câu chuyện của template ({{noi_dau}}, {{review}}…) nhiều cách nói — viết từ CÂU THẬT của khách trong sub-avatar spy, đúng mức nhận biết,
// vừa số giây của shot. Các phương án của một ô phải hợp với CÙNG một hình (không tả hành động khác) — để sau này dùng lại được clip của bộ hình.
const PhuongAnSchema = z.object({
  o: z.array(z.object({
    k: z.string().describe('Khoá ô, đúng như danh sách ô đã cho'),
    phuong_an: z.array(z.object({
      chu: z.string().describe('Chữ của ô (chữ màn + lời đọc) — đúng NGÔN NGỮ QC, vừa số giây của shot'),
      nguon: z.string().describe('Một cụm tiếng Việt ≤ 8 từ: lấy từ đâu / khác các phương án kia ở chỗ nào (vd "câu khách nguyên văn", "mở bằng cảm xúc")'),
    })),
  })),
});
export type PhuongAnViet = z.infer<typeof PhuongAnSchema>;
export async function vietPhuongAnCap(kinhThanh: KinhThanh, user: string): Promise<GoiYKq<PhuongAnViet>> {
  const kt = docKinhThanh(kinhThanh);
  return hoi(PhuongAnSchema, kt, `Bạn là copywriter quảng cáo video ngắn (Meta / TikTok). Viết nhiều PHƯƠNG ÁN chữ cho từng ô của một template quảng cáo.
${taQc(kt)}
Luật:
- Chỉ dùng sự thật có trong mục SẢN PHẨM; không bịa số liệu, ưu đãi, chứng nhận.
- Ưu tiên chữ của CHÍNH khách (câu nguyên văn trong hồ sơ người mua) — giữ giọng và từ của họ, chỉ cắt gọn.
- Mỗi phương án vừa số giây của shot: khoảng 2,5 từ mỗi giây, chừa 0,5 giây thở.
- Các phương án của cùng một ô phải KHÁC nhau thật (góc nói, cảm xúc, chi tiết) nhưng vẫn hợp với CÙNG một hình của shot đó.
- Đúng mức nhận biết của người xem: UA kể gián tiếp, chưa nhắc sản phẩm; PA chạm thẳng vấn đề; SA vì sao giải pháp này tốt nhất; PrA gỡ phản đối bằng bằng chứng; MA chỉ cần deal.
- Ngôn ngữ chữ: ${tenNgonNgu(kt.ngon_ngu)}.`, user);
}

/** Lượt Claude tự động của máy (xác nhận lỗi clip, kiểm người xem…): nội dung ảnh + chữ, đi CÙNG chuỗi dự phòng ckey → ShopAIKey → Anthropic
 *  của client(). `nguon` = đường đã đi, `model` trơn; tiền thật (ckey) ở tokens.vnd. */
export type KqClaude = { ok: true; text: string; tokens: { in: number; out: number; vnd?: number }; nguon: 'ckey' | 'shopaikey' | 'anthropic'; model: string } | { ok: false; loi: string };
export async function goiClaude(o: { noiDung: ({ anh: string } | { text: string })[]; maxTokens: number; model?: string; he?: string }): Promise<KqClaude> {
  const model = o.model ?? 'claude-sonnet-5-5';
  const c = client(); if (!c) return { ok: false, loi: 'Thiếu khoá Claude trên máy chủ' };
  try {
    const r = await c.messages.create({ model, max_tokens: o.maxTokens, ...(o.he ? { system: o.he } : {}),
      messages: [{ role: 'user', content: o.noiDung.map((x) => ('anh' in x ? { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: x.anh } } : { type: 'text' as const, text: x.text })) }] });
    const nguon = (r.model.split(':')[0] === 'ckey' || r.model.split(':')[0] === 'shopaikey' ? r.model.split(':')[0] : 'anthropic') as 'ckey' | 'shopaikey' | 'anthropic';
    return { ok: true, text: r.content.map((b) => (b.type === 'text' ? b.text : '')).join(''), tokens: tkCua(r), nguon, model };
  } catch (e) { return { ok: false, loi: loiGoi(e) }; }
}
/** Khoá ghi sổ tiền của một lượt goiClaude: đi đại lý thì 'shopaikey:<model>' (bảng GIA_CHU tính theo tiền thật), trực tiếp thì đúng tên model. */
export const modelSoTien = (k: { nguon: 'ckey' | 'shopaikey' | 'anthropic'; model: string }): string => (k.nguon === 'anthropic' ? k.model : `${k.nguon}:${k.model}`);
/** Lấy khối JSON đầu tiên trong chữ Claude trả (có thể bọc ```json). */
export const tachJson = <T>(t: string): T | null => { const m = t.match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]) as T; } catch { return null; } };

/** XÁC NHẬN LỖI CLIP bằng Claude nhìn ảnh (máy soi bản 3, soi-bien-dang.ts): Gemini quét rộng khoanh lỗi, Claude xem các khung nét cao quanh đúng giây
 *  và quyết có / không + mức nặng / nhẹ. Đo 17/10/2026 trên bộ mẫu: bắt 8/8, báo nhầm 3/8 (Gemini Pro 4–6/8). */
export const MO_HINH_XAC_NHAN_CLAUDE = 'claude-sonnet-5-5';
export async function xacNhanLoiClaude(o: { anh: string[]; cauHoi: string }): Promise<{ ok: true; data: { co: boolean; muc: 'nang' | 'nhe'; ly_do: string }; tokens: { in: number; out: number; vnd?: number }; model: string } | { ok: false; loi: string }> {
  const r = await goiClaude({ noiDung: [...o.anh.map((anh) => ({ anh })), { text: `${o.cauHoi}\nReply with ONLY a JSON object: {"co": true|false, "muc": "nang"|"nhe", "ly_do": "<frame number and exactly what is wrong, or why it is fine>"}` }], maxTokens: 400, model: MO_HINH_XAC_NHAN_CLAUDE });
  if (!r.ok) return r;
  const d = tachJson<{ co: boolean; muc: string; ly_do: string }>(r.text);
  if (!d) return { ok: false, loi: `Claude không trả JSON: ${r.text.slice(0, 120)}` };
  return { ok: true, data: { co: !!d.co, muc: d.muc === 'nhe' ? 'nhe' : 'nang', ly_do: String(d.ly_do ?? '') }, tokens: r.tokens, model: modelSoTien(r) };
}

/** Một lượt THỬ chuỗi Claude (scripts/thu-chuoi-claude.mts): messages.parse có khuôn JSON, trần 450 token (Anthropic trực tiếp viết dài hơn — 200 chạm trần) — kiểm đường đi + đọc khuôn + tiền. */
export async function goiYThu(): Promise<GoiYKq<{ diem: number; ly_do: string }>> {
  const c = client(); if (!c) return { ok: false, loi: 'Thiếu khoá Claude' };
  const S = z.object({ diem: z.number().describe('0–10'), ly_do: z.string().describe('một câu') });
  try {
    const r = await c.messages.parse({ model: 'claude-opus-5-5', max_tokens: 450, system: 'Bạn chấm shot phim ngắn.', messages: [{ role: 'user', content: 'Chấm 0–10 một shot: người phụ nữ cúi nhặt tờ giấy cuối cùng rồi đứng dậy, ngẩng đầu. Một câu lý do.' }],
      output_config: { format: zodOutputFormat(S as unknown as Parameters<typeof zodOutputFormat>[0]) } });
    const p = r.parsed_output as { diem: number; ly_do: string } | null;
    return p ? { ok: true, data: p, model: r.model, tokens: tkCua(r) } : { ok: false, loi: `không đọc được khuôn: ${r.content.map((b) => (b.type === 'text' ? b.text : '')).join('').slice(0, 120)}` };
  } catch (e) { return { ok: false, loi: loiGoi(e) }; }
}
