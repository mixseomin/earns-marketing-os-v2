// ĐIỂM NHẤN NHÂN VẬT (07/11/2026, anh: "thêm các đoạn biểu cảm của nhân vật… có thể cả những câu nói nổi tiếng liên quan"). Chạy trên box3, một lượt chữ cho cả tập:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giay/diem-nhan.mts <vao.json> <ra.json>
//   vao = { chu_de, nhan_vat: [{ id, ten, chan_dung }], cau: [{ i, chu, nguoi: [id], nhip, cang }] } → ra = { bieu_cam: [{ i, nv, cam }], cau_noi: [{ i, nv, cau, wikiquote, nam, cam }] }
// Câu nói ở đây chỉ là ĐỀ XUẤT: lam-dai.mjs tra nguyên văn trên Wikiquote, không thấy hoặc nằm ở mục Misattributed / Disputed thì bỏ, không bao giờ lên phim.
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { sinhJson } from '../../../src/lib/xuong-video/claude';

const [vao, ra] = process.argv.slice(2);
if (!vao || !ra) { console.error('tsx diem-nhan.mts <vao.json> <ra.json>'); process.exit(2); }
const V = JSON.parse(readFileSync(vao, 'utf8')) as { chu_de: string; nhan_vat: { id: string; ten: string; chan_dung?: string }[]; cau: { i: number; chu: string; nguoi: string[]; nhip: string; cang: number }[] };
const CAM = ['mat_gian', 'mat_kinh', 'mat_dau', 'mat_dac', 'mat_lo', 'mat_lanh'] as const, ids = V.nhan_vat.map((v) => v.id) as [string, ...string[]];
const Kq = z.object({
  bieu_cam: z.array(z.object({ i: z.number().int(), nv: z.enum(ids), cam: z.enum(CAM) })),
  cau_noi: z.array(z.object({ i: z.number().int().describe('thẻ hiện ngay TRƯỚC câu i'), nv: z.enum(ids), cau: z.string().describe('nguyên văn tiếng Anh đúng như trên Wikiquote'), wikiquote: z.string().describe('tựa trang Wikiquote tiếng Anh của người nói'), nam: z.number().int().nullable(), cam: z.enum(CAM) })) });
const r = await sinhJson({ schema: Kq, model: 'claude-sonnet-5-5', max_tokens: 6000, ten: 'điểm nhấn nhân vật',
  system: `Bạn là đạo diễn dựng phim tài liệu lịch sử. Chọn hai loại điểm nhấn:
1) bieu_cam: cú cắt cận mặt phản ứng của một nhân vật, như phim điện ảnh. 8–12 lần cả phim, rải đều theo hồi, đặt ở câu căng (cang ≥ 6 hoặc nhip dinh) hay câu có một khoảnh khắc cảm xúc rõ (tức giận, bàng hoàng, tuyệt vọng, đắc thắng, lo âu, lạnh lùng). nv phải đang có mặt trong câu đó (trong nguoi) hoặc được câu đó nhắc tên. Không hai lần liền nhau cách dưới 4 câu. Một nhân vật tối đa 4 lần; ưu tiên nhân vật chính nhưng cho đối thủ có tiếng nói. Cảm xúc phải đúng điều câu nói, không phải đoán.
2) cau_noi: 2–4 câu nói NỔI TIẾNG CÓ THẬT của chính nhân vật trong danh sách, liên quan trực tiếp tới sự kiện của phim, đặt ngay trước câu kể đúng khoảnh khắc đó. Chỉ chọn câu bạn chắc chắn có trên trang Wikiquote tiếng Anh của người đó, ghi nguyên văn đúng từng chữ như Wikiquote (bản dịch tiếng Anh nếu gốc tiếng Pháp/Nga), ngắn dưới 30 từ. Không chọn câu chỉ là "được gán cho", câu từ tiểu thuyết (vd Chiến tranh và Hòa bình) hay câu người khác nói VỀ họ. Không chắc thì bỏ, thà 0 câu còn hơn câu bịa. Hai câu nói cách nhau ít nhất 15 câu; không đặt ở câu 0.`,
  user: `CHỦ ĐỀ: ${V.chu_de}\nNHÂN VẬT: ${V.nhan_vat.map((v) => `${v.id} = ${v.ten}`).join('; ')}\nCÂU (${V.cau.length}):\n${V.cau.map((c) => `${c.i} [${c.nhip} ${c.cang}${c.nguoi.length ? ` · ${c.nguoi.join(',')}` : ''}] ${c.chu}`).join('\n')}`,
  kiem: (d) => { const n = V.cau.length; if (d.bieu_cam.length < 5) return `chỉ ${d.bieu_cam.length} cú cận mặt`; if (d.bieu_cam.some((b) => b.i < 0 || b.i >= n) || d.cau_noi.some((q) => q.i < 1 || q.i >= n)) return 'chỉ số câu ngoài tập'; if (d.cau_noi.some((q) => q.cau.split(/\s+/).length > 34)) return 'câu nói quá dài'; return null; } });
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
writeFileSync(ra, JSON.stringify(r.data));
console.log(`${r.data.bieu_cam.length} cận mặt · ${r.data.cau_noi.length} câu nói đề xuất · ${r.model} ~${Math.round(r.tokens.vnd ?? 0)}₫`);
