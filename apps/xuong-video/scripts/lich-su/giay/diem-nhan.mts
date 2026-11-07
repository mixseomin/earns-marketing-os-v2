// ĐIỂM NHẤN NHÂN VẬT (07/11/2026, anh: "thêm các đoạn biểu cảm của nhân vật… có thể cả những câu nói nổi tiếng liên quan"). Chạy trên box3, một lượt chữ cho cả tập:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giay/diem-nhan.mts <vao.json> <ra.json>
//   vao = { chu_de, nhan_vat, cau: [{ i, chu, nguoi, nhip, cang }], ung_vien: [{ k, nv, cau, muc }] } → ra = { bieu_cam: [{ i, nv, cam }], cau_noi: [{ i, k, nam, cam }] }
// Câu nói CHỈ được chọn trong ung_vien — danh sách lam-dai.mjs chép nguyên văn từ trang Wikiquote của từng nhân vật (đã bỏ mục Misattributed / Disputed / About).
// Lượt đầu 07/11/2026 để mô hình tự nhớ câu nói: 3/3 câu không có nguyên văn trên Wikiquote — nên mô hình không bao giờ tự viết chữ câu nói.
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { sinhJson } from '../../../src/lib/xuong-video/claude';

const [vao, ra] = process.argv.slice(2);
if (!vao || !ra) { console.error('tsx diem-nhan.mts <vao.json> <ra.json>'); process.exit(2); }
const V = JSON.parse(readFileSync(vao, 'utf8')) as { chu_de: string; nhan_vat: { id: string; ten: string; chan_dung?: string }[]; cau: { i: number; chu: string; nguoi: string[]; nhip: string; cang: number }[]; ung_vien: { k: number; nv: string; cau: string; muc: string }[] };
const CAM = ['mat_gian', 'mat_kinh', 'mat_dau', 'mat_dac', 'mat_lo', 'mat_lanh'] as const, ids = V.nhan_vat.map((v) => v.id) as [string, ...string[]];
const Kq = z.object({
  bieu_cam: z.array(z.object({ i: z.number().int(), nv: z.enum(ids), cam: z.enum(CAM) })),
  cau_noi: z.array(z.object({ i: z.number().int().describe('thẻ hiện ngay TRƯỚC câu i'), k: z.number().int().describe('số k của câu trong ỨNG VIÊN'), nam: z.number().int().nullable().describe('năm người đó nói câu này; không biết chắc thì null'), cam: z.enum(CAM) })) });
const r = await sinhJson({ schema: Kq, model: 'claude-sonnet-5-5', max_tokens: 6000, ten: 'điểm nhấn nhân vật',
  system: `Bạn là đạo diễn dựng phim tài liệu lịch sử. Chọn hai loại điểm nhấn:
1) bieu_cam: cú cắt cận mặt phản ứng của một nhân vật, như phim điện ảnh. 8–12 lần cả phim, rải đều theo hồi, đặt ở câu căng (cang ≥ 6 hoặc nhip dinh) hay câu có một khoảnh khắc cảm xúc rõ (tức giận, bàng hoàng, tuyệt vọng, đắc thắng, lo âu, lạnh lùng). nv phải đang có mặt trong câu đó (trong nguoi) hoặc được câu đó nhắc tên. Không hai lần liền nhau cách dưới 4 câu. Một nhân vật tối đa 4 lần; ưu tiên nhân vật chính nhưng cho đối thủ có tiếng nói. Cảm xúc phải đúng điều câu nói, không phải đoán.
2) cau_noi: 2–4 câu nói của nhân vật, CHỈ chọn trong danh sách ỨNG VIÊN (trả số k), chỉ câu nói thẳng về chính sự kiện của phim hoặc khoảnh khắc đang kể (cuộc chiến này, nước Nga, Moskva, cuộc rút lui…), đặt ngay trước câu kể đúng khoảnh khắc đó, cam = cảm xúc lúc nói. nam = năm thật người đó nói câu này: câu nói ở thời điểm khác (trước hay sau sự kiện) dù hay cũng KHÔNG chọn, vì đặt vào đây là gán sai bối cảnh; câu nói ngay tại sự kiện (vd lúc rút lui khỏi Nga) là quý nhất. Câu chung chung về chiến tranh/đời người không khớp khoảnh khắc thì KHÔNG chọn; không có câu nào khớp thì trả rỗng. Hai câu nói cách nhau ít nhất 15 câu; không đặt ở câu 0.`,
  user: `CHỦ ĐỀ: ${V.chu_de}\nNHÂN VẬT: ${V.nhan_vat.map((v) => `${v.id} = ${v.ten}`).join('; ')}\nCÂU (${V.cau.length}):\n${V.cau.map((c) => `${c.i} [${c.nhip} ${c.cang}${c.nguoi.length ? ` · ${c.nguoi.join(',')}` : ''}] ${c.chu}`).join('\n')}\n\nỨNG VIÊN CÂU NÓI (${V.ung_vien.length}, nguyên văn Wikiquote):\n${V.ung_vien.map((u) => `k${u.k} [${u.nv} · ${u.muc}] ${u.cau}`).join('\n') || '(không có)'}`,
  kiem: (d) => { const n = V.cau.length; if (d.bieu_cam.length < 5) return `chỉ ${d.bieu_cam.length} cú cận mặt`; if (d.bieu_cam.some((b) => b.i < 0 || b.i >= n) || d.cau_noi.some((q) => q.i < 1 || q.i >= n)) return 'chỉ số câu ngoài tập'; if (d.cau_noi.some((q) => !V.ung_vien.some((u) => u.k === q.k))) return 'câu nói ngoài danh sách ứng viên'; return null; } });
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
writeFileSync(ra, JSON.stringify(r.data));
console.log(`${r.data.bieu_cam.length} cận mặt · ${r.data.cau_noi.length} câu nói chọn · ${r.model} ~${Math.round(r.tokens.vnd ?? 0)}₫`);
