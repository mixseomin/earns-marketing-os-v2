// CHỌN CẢNH 9 GIÂY KHỚP HƯỚNG NỘI DUNG cho Máy SX (anh 11/11/2026 "fix đi" — lượt đầu chọn theo độ to của tiếng cắt ra cảnh SAI HƯỚNG
// và dính thoại miệt thị). sx-bai.mjs trên iMac đã đọc phụ đề (Vision) + LOẠI mọi đoạn dính từ cấm, đưa sang đây các đoạn SẠCH kèm phụ đề;
// AI qua CỔNG AI CHUNG spy (anh 16/11/2026 — một nguồn cho mọi model: donk → ckey sống → fal, không chính hãng) chọn đoạn khớp hướng nội dung + có cao trào nhất.
//   echo '{"huong":"…","ung_vien":[{"bat_dau":121,"chu":"…"}]}' | ../../node_modules/.bin/tsx scripts/sx-chon-canh.mts
// → {"bat_dau":121,"ly_do":"…","vnd":45}  ·  hỏng mọi tuyến → {"bat_dau":null,"loi":"…"} (sx-bai lùi về đoạn sạch to tiếng nhất)
import { readFileSync } from 'node:fs';
import { goiAi, MO_HINH } from '../../../packages/cong-ai/index.mjs';

const vao = JSON.parse(readFileSync(0, 'utf8')) as { huong: string; ung_vien: { bat_dau: number; nhan?: string; chu: string }[] };
if (!vao.ung_vien?.length) { console.log(JSON.stringify({ bat_dau: null, loi: 'không có đoạn sạch nào' })); process.exit(0); }

const LUAT = `Bạn chọn đoạn 9 giây cắt từ một tập phim ngắn để đăng Reel Facebook cho một Page persona (người thật xem phim, giọng tự nhiên).
Hướng nội dung đã lên kế hoạch (tiếng Việt): "${vao.huong || 'cao trào kịch tính'}".
Dưới đây là các đoạn ứng viên, mỗi đoạn là phụ đề tiếng Anh đọc được trong 9 giây đó (đã loại sẵn đoạn có từ tục / bạo lực / tình dục).
Chọn MỘT đoạn: ưu tiên khớp hướng nội dung, rồi tới có xung đột / cú lật rõ, người chưa xem phim vẫn hiểu và muốn xem tiếp.
KHÔNG chọn đoạn chế giễu người khuyết tật, người nghèo bị làm nhục kiểu thô, hay câu xúc phạm theo chủng tộc / giới tính.
Đoạn nào phụ đề gần như trống thì chỉ chọn khi không còn đoạn nào khác.`;
const DS = vao.ung_vien.map((u, i) => `#${i} (${u.nhan ?? `giây ${u.bat_dau}`}): ${u.chu || '(không có phụ đề)'}`).join('\n');
const SCHEMA = { type: 'object', properties: { so: { type: 'integer', description: 'số # của đoạn chọn' }, khop: { type: 'boolean', description: 'đoạn này có THẬT SỰ khớp hướng nội dung không' }, ly_do: { type: 'string', description: 'một câu tiếng Việt có dấu: vì sao chọn' } }, required: ['so', 'khop', 'ly_do'] };

try {
  const r = await goiAi<{ so: number; khop?: boolean; ly_do: string }>({ viec: 'xv-chon-canh', model: MO_HINH.haiku, max_tokens: 400, schema: SCHEMA, bo_chinh_hang: true, noi_dung: `${LUAT}\n\n${DS}` },
    { kiem: (x) => (vao.ung_vien[x?.so] ? null : 'số đoạn không có trong danh sách') });
  const u = vao.ung_vien[r.kq.so];
  console.log(JSON.stringify({ bat_dau: u.bat_dau, khop: r.kq.khop ?? null, ly_do: r.kq.ly_do, vnd: Math.round(r.chi_usd * 26000), model: r.model }));
} catch (e) { console.log(JSON.stringify({ bat_dau: null, loi: (e as Error).message.slice(0, 300), vnd: 0 })); }
