// TIN BÁO CỦA THÀNH — kỹ sư task Astrolas (anh 06/11/2026: "tạo 1 con CLI cho phòng Astrolas để chuyên nhận và xử lý các tasks"). Máy iMac (may/astrolas-tasks.mjs)
// gọi tệp này qua ssh để báo kết quả vào chủ đề Astrolas; thu-ky.mjs nhận câu anh trả lời dưới tin báo → hàng phan_hoi → lượt iMac kế tiếp làm lại đúng task đó. Sổ <DATA>/astrolas-tasks.json.
//   node worker/astrolas-tasks.mjs --bao <task> <ket> [--tin <mid>]   chữ báo qua stdin
//   node worker/astrolas-tasks.mjs --hang                             tin hiện trạng số lượng task, chữ qua stdin
//   node worker/astrolas-tasks.mjs --phan-hoi                         lấy (và xoá khỏi hàng) một câu anh trả lời, {} khi không có
import fs from 'node:fs';
import path from 'node:path';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const tep = () => path.join(DATA(), 'astrolas-tasks.json');
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const doc = () => { try { return JSON.parse(fs.readFileSync(tep(), 'utf8')); } catch { return { tin: {}, phan_hoi: [] }; } };
const ghi = (s) => fs.writeFileSync(tep(), JSON.stringify(s));
const NHAN = { da_sua: '✅ Xong, chờ duyệt', can_anh: '⚠️ Cần anh quyết', treo: '⏹ Dừng giữa chừng' };

/** Câu hẹn trong lời nhận: Thành nghỉ 23:00 → 07:00 giờ VN (may/astrolas-tasks.mjs). */
export const henBatDau = (ms = Date.now()) => { const h = new Date(ms + 7 * 36e5).getUTCHours(); return h >= 23 || h < 7 ? 'bắt đầu lúc 7:00 sáng' : 'bắt đầu trong ≤ 2 phút'; };
export const taskCuaTin = (mid) => (mid ? doc().tin[mid] ?? null : null);
export const ghiPhanHoi = (task, anh, tin) => { const s = doc(); s.phan_hoi.push({ task, anh, tin }); ghi(s); };
export const layPhanHoi = () => { const s = doc(), x = s.phan_hoi.shift(); if (x) ghi(s); return x ?? {}; };

/** Gửi tin báo vào chủ đề; nhớ tin → task để câu trả lời dưới tin tìm được đúng task. */
export async function baoTask(tg, topic, task, ket, than, tin) {
  const j = await tg('sendMessage', { message_thread_id: topic, parse_mode: 'HTML', text: `🛠 <b>Thành</b> · #${esc(task)} · ${NHAN[ket] ?? esc(ket)}\n${esc(than)}`, ...(tin ? { reply_parameters: { message_id: Number(tin), allow_sending_without_reply: true } } : {}) });
  if (j?.ok) { const s = doc(); s.tin[j.result.message_id] = Number(task); const k = Object.keys(s.tin); for (const m of k.slice(0, -300)) delete s.tin[m]; ghi(s); }
  return j;
}

const a = process.argv;
if (a[1]?.endsWith('astrolas-tasks.mjs') && a.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'), os = await import('node:os');
  process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'astrolas-tasks-'));
  const gui = []; const tg = async (_m, b) => { gui.push(b); return { ok: true, result: { message_id: 900 } }; };
  await baoTask(tg, 4241, 4467, 'da_sua', 'a<b', null); t.equal(gui[0].message_thread_id, 4241); t.match(gui[0].text, /#4467 · ✅.*\na&lt;b/s); t.equal(gui[0].reply_parameters, undefined);
  await baoTask(tg, 4241, 4467, 'can_anh', 'x', 55); t.equal(gui[1].reply_parameters.message_id, 55, 'trả lời dưới tin anh');
  t.equal(taskCuaTin(900), 4467); t.equal(taskCuaTin(901), null); t.equal(taskCuaTin(null), null);
  t.deepEqual(layPhanHoi(), {}); ghiPhanHoi(4467, 'sửa lại', 77); t.deepEqual(layPhanHoi(), { task: 4467, anh: 'sửa lại', tin: 77 }); t.deepEqual(layPhanHoi(), {}, 'lấy một lần');
  t.match(henBatDau(Date.UTC(2026, 10, 6, 3)), /≤ 2 phút/); t.match(henBatDau(Date.UTC(2026, 10, 6, 16)), /7:00/, '23:00 VN');
  console.log('astrolas-tasks: tự kiểm đạt');
} else if (a[1]?.endsWith('astrolas-tasks.mjs') && a.includes('--phan-hoi')) {
  console.log(JSON.stringify(layPhanHoi()));
} else if (a[1]?.endsWith('astrolas-tasks.mjs') && (a.includes('--bao') || a.includes('--hang'))) {
  const i = a.indexOf('--bao'), j = a.indexOf('--tin');
  const { tgNoiDung } = await import('./kiem-bai.mjs'), { topicPhong } = await import('./tg-phong.mjs');
  const { tg } = await tgNoiDung(), topic = await topicPhong('astrolas', 'Astrolas', tg);
  if (!topic) throw new Error('phòng Astrolas chưa có chủ đề Telegram');
  if (i < 0) await tg('sendMessage', { message_thread_id: topic, parse_mode: 'HTML', text: `🛠 <b>Thành</b>\n${esc(fs.readFileSync(0, 'utf8').trim().slice(0, 3500))}` });
  else await baoTask(tg, topic, a[i + 1], a[i + 2], fs.readFileSync(0, 'utf8').trim().slice(0, 3500), j > 0 ? a[j + 1] : null);
}
