// BÁO VIỆC ĐANG LÀM lên Telegram (anh 27/10/2026: "1 tiếng hãy báo cáo tele 1 lần về công việc thực hiện"): một tin HTML vào chủ đề của phòng
// (tg-phong.mjs — mặc định 📂 Social Traffic), bot cty, không gọi mô hình. Phiên Claude đang làm việc soạn tin rồi gọi lệnh này mỗi giờ (CronCreate trong phiên).
//   node worker/bao-viec.mjs --tin "<b>…</b>"            gửi chữ (HTML, ≤ 4096 ký tự)
//   node worker/bao-viec.mjs --tep /tmp/tin.html           gửi nội dung tệp
//   node worker/bao-viec.mjs --phong social-traffic --ten "📂 Social Traffic" …   chủ đề khác (slug + tên phòng như nhip-chinh.json)
//   node worker/bao-viec.mjs --in …                        chỉ in, không gửi
import fs from 'node:fs';

const a = process.argv.slice(2), lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const phong = lay('--phong') ?? 'social-traffic', ten = lay('--ten') ?? '📂 Social Traffic';
let tin = lay('--tin') ?? (lay('--tep') ? fs.readFileSync(lay('--tep'), 'utf8') : '');
if (!tin.trim()) { console.error('cần --tin "<html>" hoặc --tep <tệp>'); process.exit(1); }
if (tin.length > 4000) tin = tin.slice(0, 3990) + '…';
if (a.includes('--in')) { console.log(tin); process.exit(0); }
const { tgNoiDung } = await import('./kiem-bai.mjs'), { topicPhong } = await import('./tg-phong.mjs');
const { tg } = await tgNoiDung(), topic = await topicPhong(phong, ten, tg);
if (!topic) { console.error(`phòng ${phong} chưa có chủ đề Telegram`); process.exit(1); }
const j = await tg('sendMessage', { message_thread_id: topic, text: tin, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
if (!j?.ok) { console.error(`Telegram: ${JSON.stringify(j).slice(0, 200)}`); process.exit(1); }
console.log(`đã gửi tin #${j.result?.message_id} vào ${ten}`);
