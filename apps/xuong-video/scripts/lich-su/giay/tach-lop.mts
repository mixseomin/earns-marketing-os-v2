// TÁCH LỚP BỐI CẢNH (07/11/2026, anh: núi, mây, đồ vật tách ra, vào theo nhịp cho cảm giác 3D). Chạy trên box3, một lượt chữ cho cả tập, chỉ tả lớp; lam-dai.mjs vẽ + xếp nhịp:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/giay/tach-lop.mts <vao.json> <ra.json>     vao = [{ id, mo_ta_en, co_vat, nam }], ra = { <id>: { trong_nha, troi, xa, khoi, giua, gan } }
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { sinhJson } from '../../../src/lib/xuong-video/claude';

const [vao, ra] = process.argv.slice(2);
if (!vao || !ra) { console.error('tsx tach-lop.mts <vao.json> <ra.json>'); process.exit(2); }
const ds = JSON.parse(readFileSync(vao, 'utf8')) as { id: string; mo_ta_en: string; co_vat: number; nam: string }[];
const Lop = z.object({ ds: z.array(z.object({ id: z.string(), trong_nha: z.boolean(),
  troi: z.string().describe('chỉ phông xa nhất: trời (ngoài trời) hoặc tường sau (trong nhà); không người, không nhà, không đất'),
  xa: z.string().describe('một dải dài chạy suốt bề ngang, đáy phẳng: núi / đồi / hàng cây / đường chân trời thành phố (ngoài trời); đồ đạc xa sát tường (trong nhà)'),
  khoi: z.string().nullable().describe('ngoài trời: MỘT cụm mây hoặc khói đúng thời tiết cảnh này; trong nhà: null'),
  giua: z.array(z.string()).describe('vật rời thêm; đúng số yêu cầu, mảng rỗng nếu yêu cầu 0'),
  gan: z.string().describe('một dải dài sát đất chạy suốt bề ngang, đáy phẳng, chỉ cao 1/3 ảnh: cỏ, tuyết, đá, đổ nát (ngoài trời); sàn, thảm, đồ thấp (trong nhà)') })) });
const r = await sinhJson({ schema: Lop, model: 'claude-haiku-4-5', max_tokens: 12000, ten: 'tách lớp bối cảnh',
  system: 'Bạn tách mỗi bối cảnh tranh ghép giấy thành các lớp sân khấu vẽ riêng. Viết mô tả ngắn bằng TIẾNG ANH, đúng thời đại, không người, không chữ. Không tả ánh sáng chung vào lớp vật. Lớp xa và lớp gần phải nối đúng cảnh gốc, cùng mùa, cùng thời tiết. Không có gì hiện đại.',
  user: ds.map((b) => `id ${b.id} · năm ${b.nam} · cảnh: ${b.mo_ta_en} · cần giua: ${b.co_vat >= 1 ? 0 : 1}`).join('\n') });
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
const thieu = ds.filter((b) => !r.data.ds.some((x) => x.id === b.id)); if (thieu.length) { console.error(`✗ thiếu lớp: ${thieu.map((b) => b.id).join(', ')}`); process.exit(1); }
writeFileSync(ra, JSON.stringify(Object.fromEntries(r.data.ds.map(({ id, ...x }) => [id, x]))));
console.log(`${r.data.ds.length} bối cảnh ${r.model} ${JSON.stringify(r.tokens)}`);
