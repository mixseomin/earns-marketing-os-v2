// CHỌN CẢNH 9 GIÂY KHỚP HƯỚNG NỘI DUNG cho Máy SX (anh 11/11/2026 "fix đi" — lượt đầu chọn theo độ to của tiếng cắt ra cảnh SAI HƯỚNG
// và dính thoại miệt thị). sx-bai.mjs trên iMac đã đọc phụ đề (Vision) + LOẠI mọi đoạn dính từ cấm, đưa sang đây các đoạn SẠCH kèm phụ đề;
// AI rẻ qua ckey (haiku trước) chọn đoạn khớp hướng nội dung + có cao trào nhất. Chạy ở box3 vì khoá ckey chỉ ở đó.
//   echo '{"huong":"…","ung_vien":[{"bat_dau":121,"chu":"…"}]}' | ../../node_modules/.bin/tsx scripts/sx-chon-canh.mts
// → {"bat_dau":121,"ly_do":"…","vnd":45}  ·  hỏng mọi tuyến → {"bat_dau":null,"loi":"…"} (sx-bai lùi về đoạn sạch to tiếng nhất)
import { readFileSync } from 'node:fs';

const KHOA = readFileSync('/root/.secrets/spy.env', 'utf8').match(/^CKEY_KEY=(.*)$/m)?.[1]?.trim();
const TUYEN = (() => { try { const j = JSON.parse(readFileSync('/var/lib/spy/ckey-tuyen.json', 'utf8')) as { dong: Record<string, string[]> }; return [...(j.dong.haiku ?? []), ...(j.dong.sonnet ?? [])]; }
  catch { return ['ckey:haiphu95pdp/claude-haiku-5-5']; } })().map((m) => m.replace(/^ckey:/, ''));
const vao = JSON.parse(readFileSync(0, 'utf8')) as { huong: string; ung_vien: { bat_dau: number; chu: string }[] };
if (!KHOA || !vao.ung_vien?.length) { console.log(JSON.stringify({ bat_dau: null, loi: KHOA ? 'không có đoạn sạch nào' : 'thiếu CKEY_KEY' })); process.exit(0); }

const LUAT = `Bạn chọn đoạn 9 giây cắt từ một tập phim ngắn để đăng Reel Facebook cho một Page persona (người thật xem phim, giọng tự nhiên).
Hướng nội dung đã lên kế hoạch (tiếng Việt): "${vao.huong || 'cao trào kịch tính'}".
Dưới đây là các đoạn ứng viên, mỗi đoạn là phụ đề tiếng Anh đọc được trong 9 giây đó (đã loại sẵn đoạn có từ tục / bạo lực / tình dục).
Chọn MỘT đoạn: ưu tiên khớp hướng nội dung, rồi tới có xung đột / cú lật rõ, người chưa xem phim vẫn hiểu và muốn xem tiếp.
KHÔNG chọn đoạn chế giễu người khuyết tật, người nghèo bị làm nhục kiểu thô, hay câu xúc phạm theo chủng tộc / giới tính.
Đoạn nào phụ đề gần như trống thì chỉ chọn khi không còn đoạn nào khác.`;
const DS = vao.ung_vien.map((u, i) => `#${i} (giây ${u.bat_dau}): ${u.chu || '(không có phụ đề)'}`).join('\n');
const SCHEMA = { type: 'object', properties: { so: { type: 'integer', description: 'số # của đoạn chọn' }, ly_do: { type: 'string', description: 'một câu tiếng Việt có dấu: vì sao chọn' } }, required: ['so', 'ly_do'] };

let chi = 0, loi = '';
for (const model of TUYEN.slice(0, 4)) {
  try {
    const r = await fetch('https://api.xah.io/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KHOA}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(120e3),
      body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: 'user', content: `${LUAT}\n\n${DS}` }],
        tools: [{ type: 'function', function: { name: 'chon', description: 'Ghi đoạn được chọn', parameters: SCHEMA } }], tool_choice: { type: 'function', function: { name: 'chon' } } }) });
    const j = await r.json() as { usage?: { x_ckey?: { cost?: number } }; error?: unknown; choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] };
    chi += Number(j.usage?.x_ckey?.cost ?? 0);
    const a = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const x = a ? JSON.parse(a) as { so: number; ly_do: string } : null;
    const u = x ? vao.ung_vien[x.so] : undefined;
    if (u) { console.log(JSON.stringify({ bat_dau: u.bat_dau, ly_do: x!.ly_do, vnd: Math.round(chi), model })); process.exit(0); }
    loi = `${model}: ${JSON.stringify(j.error ?? 'sai khuôn').slice(0, 160)}`;
  } catch (e) { loi = `${model}: ${(e as Error).message.slice(0, 160)}`; }
}
console.log(JSON.stringify({ bat_dau: null, loi, vnd: Math.round(chi) }));
