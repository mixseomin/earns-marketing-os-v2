// HÀNG VIỆC THƯ CỦA PHÒNG (anh 20/10/2026: "Phòng Social chưa có ai phụ trách việc tiếp theo" → cho Vân chạy thật).
// Kiên chuyển thư vào phòng nào thì ghi <DATA>/phong-thu/<phòng>/<mail>.json (mail-bao-mat.mjs giaoPhuTrach). Người phụ trách có máy chạy
// (vd Vân: may/van-thu.mjs trên iMac) lấy thư ở đây, báo NHẬN / XONG / DỪNG lên đúng chủ đề Telegram của phòng, kết quả lưu da-xu/.
//   node worker/phong-thu.mjs --cho <phòng> --json            thư chờ xử (chưa nhận, chưa dừng)
//   node worker/phong-thu.mjs --nhan <phòng> <mail> --ai <id>  đánh dấu nhận + báo Telegram
//   node worker/phong-thu.mjs --xong <phòng> <mail> --ai <id> --bao "<báo cáo>"   (báo cáo đọc từ stdin khi --bao -)
//   node worker/phong-thu.mjs --dung <phòng> <mail> --ai <id> --ly-do "<lý do>"
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const HANG = (ph) => path.join(DATA(), 'phong-thu', ph), XONG = (ph) => path.join(DATA(), 'phong-thu', ph, 'da-xu');
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tenNguoi = (id) => { try { const t = fs.readFileSync(path.join(GOC, 'cong-ty', 'nhan-su', id, 'SOUL.md'), 'utf8'); const ph = t.match(/^phong:\s*(\S+)/m)?.[1];
  const tp = ph ? fs.readFileSync(path.join(GOC, 'cong-ty', 'phong', `${ph}.md`), 'utf8').match(/^ten:\s*(.+)$/m)?.[1].replace(/^Phòng\s+/, '').replace(/\s*\(.*\)$/, '').trim() : '';
  return `${t.match(/^ten:\s*(.+)$/m)[1].trim()}${tp ? ` [${tp}]` : ''}`; } catch { return id; } };

export const choXu = (ph) => { try { return fs.readdirSync(HANG(ph)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(HANG(ph), f), 'utf8'))).filter((x) => !x.nhan_luc && !x.dung).sort((a, b) => a.luc.localeCompare(b.luc)); } catch { return []; } };
const doc = (ph, id) => { const f = path.join(HANG(ph), `${id}.json`); if (!fs.existsSync(f)) throw new Error(`không có thư ${id} trong hàng ${ph}`); return [f, JSON.parse(fs.readFileSync(f, 'utf8'))]; };

async function tg() {
  if (!process.env.TG_BOT_TOKEN) try { for (const l of fs.readFileSync('/root/.secrets/mine-tg.env', 'utf8').split('\n')) { const m = l.match(/^(?:export\s+)?(TG_BOT_TOKEN|TG_CHAT)=["']?([^"'\s]+)/); if (m) process.env[m[1]] = m[2]; } } catch { /* không phải box */ }
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  return async (m, b) => { const j = await (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, link_preview_options: { is_disabled: true }, ...b }), signal: AbortSignal.timeout(15000) })).json(); if (!j.ok) console.error(`✗ telegram ${m}: ${j.description}`); return j; };
}
async function bao(ph, x, text) {
  const goi = await tg(); const { topicPhong } = await import('./tg-phong.mjs');
  // phòng chưa có chủ đề (anh chưa cho tạo) → báo ở 🔐 Bảo mật, không tự tạo chủ đề
  const tp = await topicPhong(ph, `📂 ${ph}`, goi) ?? (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA(), 'bao-mat-tg.json'), 'utf8')).topic; } catch { return null; } })();
  // Telegram giới hạn 4096 ký tự / tin: báo cáo dài thì cắt thành nhiều tin, tin đầu trả lời ngay dưới thư Kiên chuyển
  const phan = []; for (let i = 0; i < text.length; i += 3800) phan.push(text.slice(i, i + 3800));
  for (const [i, p] of phan.entries()) await goi('sendMessage', { message_thread_id: tp, parse_mode: 'HTML', text: p, ...(i === 0 && x.tin ? { reply_parameters: { message_id: x.tin, allow_sending_without_reply: true } } : {}) });
}
export async function nhan(ph, id, ai) {
  const [f, x] = doc(ph, id); x.nhan_luc = new Date().toISOString(); x.nhan_boi = ai; fs.writeFileSync(f, JSON.stringify(x, null, 1));
  await bao(ph, x, `🛠 <b>${esc(tenNguoi(ai))}</b> nhận thư <i>${esc(x.tieuDe)}</i> (${esc(x.mien)}) — đang đọc và lập việc tiếp theo`);
}
export async function xong(ph, id, ai, baoCao) {
  const [f, x] = doc(ph, id); fs.mkdirSync(XONG(ph), { recursive: true });
  fs.writeFileSync(path.join(XONG(ph), `${id}.json`), JSON.stringify({ ...x, than: undefined, xong_luc: new Date().toISOString(), xong_boi: ai, bao_cao: baoCao }, null, 1)); fs.rmSync(f);
  await bao(ph, x, `✅ <b>${esc(tenNguoi(ai))}</b> — thư <i>${esc(x.tieuDe)}</i>\n\n${esc(baoCao)}`);
}
export async function dung(ph, id, ai, lyDo) {
  const [f, x] = doc(ph, id); x.dung = String(lyDo || 'không rõ'); x.dung_luc = new Date().toISOString(); fs.writeFileSync(f, JSON.stringify(x, null, 1));
  await bao(ph, x, `⚠️ <b>${esc(tenNguoi(ai))}</b> dừng xử thư <i>${esc(x.tieuDe)}</i>\nLý do: ${esc(x.dung)}`);
}

if (process.argv[1]?.endsWith('phong-thu.mjs')) {
  const a = process.argv.slice(2), lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (a.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert'); const os = await import('node:os');
    process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'phong-thu-'));
    fs.mkdirSync(HANG('x'), { recursive: true }); fs.writeFileSync(path.join(HANG('x'), 'a.json'), JSON.stringify({ id: 'a', luc: '2026-10-20T01:00:00Z', tieuDe: 'A' }));
    fs.writeFileSync(path.join(HANG('x'), 'b.json'), JSON.stringify({ id: 'b', luc: '2026-10-20T00:00:00Z', tieuDe: 'B', nhan_luc: 'x' }));
    t.deepEqual(choXu('x').map((v) => v.id), ['a'], 'thư đã nhận không chờ nữa'); t.deepEqual(choXu('khong-co'), []);
    t.equal(tenNguoi('van'), 'Vân [Social Traffic]');
    console.log('phong-thu: tự kiểm đạt'); process.exit(0);
  }
  const ph = lay('--cho') ?? lay('--nhan') ?? lay('--xong') ?? lay('--dung'), id = ph ? a[a.indexOf(ph) + 1] : null, ai = lay('--ai') ?? '';
  if (lay('--cho')) console.log(a.includes('--json') ? JSON.stringify(choXu(ph)) : choXu(ph).map((x) => `${x.id} · ${x.mien} · ${x.tieuDe}`).join('\n') || 'không có thư chờ');
  else if (lay('--nhan')) { await nhan(ph, id, ai); console.log(`đã nhận ${id}`); }
  else if (lay('--xong')) { await xong(ph, id, ai, lay('--bao') === '-' ? fs.readFileSync(0, 'utf8') : (lay('--bao') ?? '')); console.log(`đã báo xong ${id}`); }
  else if (lay('--dung')) { await dung(ph, id, ai, lay('--ly-do')); console.log(`đã báo dừng ${id}`); }
}
