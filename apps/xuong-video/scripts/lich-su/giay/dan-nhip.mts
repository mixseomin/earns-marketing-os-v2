// DÀN NHỊP CẢ PHIM (07/11/2026, anh: "cần cao trào, nhấn nhá, khoảng lặng như film… nhịp từng đoạn, từng hồi rất quan trọng"). Chạy trên box3, một lượt chữ cho cả tập:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giay/dan-nhip.mts <vao.json> <ra.json>     vao = { chu_de, cau: [{ i, chuong, boi_canh, chu }] }, ra = { hoi, cau }
// Bảng nhịp là nguồn chung: lam-dai.mjs đọc nó để dựng khoảng lặng thật, hình, tiếng động, nhạc. Tên tiếng động + nền + nhạc nằm trong am-kho.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { sinhJson } from '../../../src/lib/xuong-video/claude';
import { AM_NEN, AM_NHAC, AM_VAT } from './am-kho.mjs';

const [vao, ra] = process.argv.slice(2);
if (!vao || !ra) { console.error('tsx dan-nhip.mts <vao.json> <ra.json>'); process.exit(2); }
const V = JSON.parse(readFileSync(vao, 'utf8')) as { chu_de: string; cau: { i: number; chuong: number; boi_canh: string | null; chu: string }[] };
const Nhip = z.object({
  hoi: z.array(z.object({ ten: z.string().describe('tên hồi tiếng Việt ngắn'), tu: z.number().int(), den: z.number().int(), vai: z.enum(['mo_man', 'dang_len', 'cao_trao', 'lang', 'ket']), nhac: z.enum(Object.keys(AM_NHAC) as [string, ...string[]]), y: z.string().describe('người xem phải cảm thấy gì, một câu tiếng Việt') })),
  cau: z.array(z.object({ i: z.number().int(), cang: z.number().int().describe('độ căng 1–10'), nhip: z.enum(['binh', 'dang', 'dinh', 'lang']), nghi_truoc: z.number().describe('giây lặng trước câu: 0, 0.6, 1.5 hoặc 3'), nen: z.enum(Object.keys(AM_NEN) as [string, ...string[]]), vat: z.array(z.enum(Object.keys(AM_VAT) as [string, ...string[]])).describe('tối đa 2 tiếng đúng điều câu này nói hoặc cảnh này có; không có thì rỗng') })) });
const r = await sinhJson({ schema: Nhip, model: 'claude-sonnet-5-5', max_tokens: 16000, ten: 'dàn nhịp phim dài',
  system: `Bạn là đạo diễn dựng phim tài liệu chiến tranh. Video dài hơn 12 phút mà đều đều thì người xem bỏ đi. Hãy dàn nhịp cả phim theo hồi, như phim điện ảnh.
Luật: 1) 8–14 hồi nối liền, phủ đủ mọi câu; đường căng có sóng, mỗi hồi cao trào sau cao hơn hồi trước, đỉnh lớn nhất ở khoảng 2/3 đến 3/4 phim. 2) Không quá 4 câu liền cùng độ căng. 3) Ngay sau mỗi đỉnh phải có một khoảng lặng thật: nhip lang, nghi_truoc 1.5 hoặc 3, nen nhẹ, không vat. 4) Một câu dinh thường đứng sau một nhịp nín: nghi_truoc 0.6 hoặc 1.5. 5) nghi_truoc 3 tối đa 5 lần cả phim; tổng nghi_truoc từ 35 đến 70 giây. 6) nhip dinh chiếm 10–18% số câu, nhip lang 8–15%. 7) vat chỉ dùng tiếng có thật trong điều câu nói hoặc cảnh đang diễn; đừng rắc đều, câu lặng không có vat. 8) nen đổi theo bối cảnh.`,
  user: `CHỦ ĐỀ: ${V.chu_de}\nCÂU (${V.cau.length}):\n${V.cau.map((c) => `${c.i} [c${c.chuong} ${c.boi_canh ?? 'bản đồ/ảnh'}] ${c.chu}`).join('\n')}`,
  kiem: (d) => { const n = V.cau.length, thieu = V.cau.filter((c) => !d.cau.some((x) => x.i === c.i)).length, tong = d.cau.reduce((a, c) => a + c.nghi_truoc, 0), ba = d.cau.filter((c) => c.nghi_truoc === 3).length, phu = d.hoi.reduce((a, h) => a + h.den - h.tu + 1, 0); if (thieu) return `thiếu ${thieu} câu`; if (phu !== n) return `hồi phủ ${phu}/${n} câu`; if (tong > 80) return `tổng nghỉ ${tong}s quá dài`; if (ba > 6) return `${ba} lần nghỉ 3s`; return null; } });
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
writeFileSync(ra, JSON.stringify(r.data));
console.log(`${r.data.hoi.length} hồi · ${r.model} ${JSON.stringify(r.tokens)}`);
