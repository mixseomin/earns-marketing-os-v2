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
/** Markdown của mô hình → HTML Telegram (anh 20/10/2026: "sao không format được" — Telegram không hiểu **, `, bảng nên hiện nguyên ký hiệu).
 *  Đậm / nghiêng / mã / tiêu đề → thẻ Telegram; bảng → mỗi hàng một dòng "• ô1 · ô2"; bỏ dòng kẻ. Thoát HTML trước rồi mới gắn thẻ. */
export function mdTele(md) {
  const ra = [];
  for (let l of String(md).replace(/\r/g, '').split('\n')) {
    if (/^\s*\|?\s*:?-{2,}/.test(l) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) continue;   // dòng kẻ bảng / kẻ ngang
    l = esc(l);
    if (/^\s*\|.*\|\s*$/.test(l)) { const o = l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim()).filter(Boolean); l = `• ${o.join(' · ')}`; }
    l = l.replace(/^\s*#{1,6}\s+(.+)$/, '<b>$1</b>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,:;!?]|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/^(\s*)[-*]\s+/, '$1• ');
    ra.push(l);
  }
  return ra.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Báo cáo của người phụ trách có hai phần: "BÁO ANH:" (lên Telegram) và "KỸ THUẬT:" (chỉ lưu hồ sơ việc). Không chia phần thì cả bài là phần báo. */
export function tachBao(chu) {
  const t = String(chu), i = t.search(/^\s*\**\s*KỸ THUẬT\s*:?\**\s*:?/mi);
  const bao = (i >= 0 ? t.slice(0, i) : t).replace(/^\s*\**\s*BÁO ANH\s*:?\**\s*:?/mi, '').trim();
  return { bao, kyThuat: i >= 0 ? t.slice(i).replace(/^\s*\**\s*KỸ THUẬT\s*:?\**\s*:?/mi, '').trim() : '' };
}
const tenNguoi = (id) => { try { const t = fs.readFileSync(path.join(GOC, 'cong-ty', 'nhan-su', id, 'SOUL.md'), 'utf8'); const ph = t.match(/^phong:\s*(\S+)/m)?.[1];
  const tp = ph ? fs.readFileSync(path.join(GOC, 'cong-ty', 'phong', `${ph}.md`), 'utf8').match(/^ten:\s*(.+)$/m)?.[1].replace(/^Phòng\s+/, '').replace(/\s*\(.*\)$/, '').trim() : '';
  return `${t.match(/^ten:\s*(.+)$/m)[1].trim()}${tp ? ` [${tp}]` : ''}`; } catch { return id; } };

/** Tin ANH gõ trong chủ đề phòng (hộp tg-hop/<phòng>) → việc 'tra-loi' trong hàng: gắn với thư / báo cáo anh trả lời ngay dưới (nếu có),
 *  không thì gắn với thư phòng xử gần nhất (anh 20/10/2026: "Vân báo cáo + hỏi thì trả lời luôn ở đó được không, rồi nó tự update làm theo"). */
export async function quetTraLoi(ph) {
  const { moHop } = await import('./tg-phong.mjs'); let n = 0;
  const daXu = () => { try { return fs.readdirSync(XONG(ph)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(XONG(ph), f), 'utf8'))).sort((a, b) => (b.xong_luc ?? '').localeCompare(a.xong_luc ?? '')); } catch { return []; } };
  for (const u of moHop(ph)) {
    const m = u.message; u.xong();
    if (!m || m.from?.is_bot || !String(m.text ?? m.caption ?? '').trim()) continue;
    const goc = m.reply_to_message?.message_id, ds = daXu();
    const truoc = (goc && ds.find((d) => (d.tin_bao ?? []).includes(goc) || d.tin === goc)) || ds[0] || null;
    fs.mkdirSync(HANG(ph), { recursive: true });
    fs.writeFileSync(path.join(HANG(ph), `tl-${u.update_id}.json`), JSON.stringify({ id: `tl-${u.update_id}`, loai: 'tra-loi', phong: ph, ai: truoc?.ai ?? null,
      tieuDe: truoc ? `Re: ${truoc.tieuDe}` : 'Anh nhắn phòng', loi_anh: String(m.text ?? m.caption), tu: m.from?.first_name || m.from?.username || 'Anh', tin: m.message_id,
      truoc: truoc ? { id: truoc.id, tieuDe: truoc.tieuDe, gui: truoc.gui, mien: truoc.mien, chu: truoc.chu, viec: truoc.viec, than: truoc.than ?? '', bao_cao: truoc.bao_cao ?? '', loi_anh: truoc.loi_anh ?? null } : null,
      luc: new Date().toISOString() }, null, 1)); n++;
  }
  return n;
}
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
  const ids = [];
  for (const [i, p] of phan.entries()) { const j = await goi('sendMessage', { message_thread_id: tp, parse_mode: 'HTML', text: p, ...(i === 0 && x.tin ? { reply_parameters: { message_id: x.tin, allow_sending_without_reply: true } } : {}) }); if (j.ok) ids.push(j.result.message_id); }
  return ids;
}
export async function nhan(ph, id, ai) {
  const [f, x] = doc(ph, id); x.nhan_luc = new Date().toISOString(); x.nhan_boi = ai; fs.writeFileSync(f, JSON.stringify(x, null, 1));
  await bao(ph, x, x.loai === 'tra-loi' ? `🛠 <b>${esc(tenNguoi(ai))}</b> đã nhận tin anh — đang đọc và cập nhật kế hoạch` : `🛠 <b>${esc(tenNguoi(ai))}</b> nhận thư <i>${esc(x.tieuDe)}</i> (${esc(x.mien)}) — đang đọc và lập việc tiếp theo`);
}
export async function xong(ph, id, ai, baoCao) {
  const [f, x] = doc(ph, id); fs.mkdirSync(XONG(ph), { recursive: true });
  const { bao: phanBao, kyThuat } = tachBao(baoCao);
  const tinBao = await bao(ph, x, `${x.loai === 'tra-loi' ? '💬' : '✅'} <b>${esc(tenNguoi(ai))}</b> — ${x.loai === 'tra-loi' ? 'trả lời anh' : 'thư'} <i>${esc(x.tieuDe)}</i>\n\n${mdTele(phanBao)}${kyThuat ? '\n\n<i>(chi tiết kỹ thuật đã lưu vào hồ sơ việc trên cty)</i>' : ''}`);
  // giữ thân thư gốc trong bản đã xử: anh trả lời dưới báo cáo thì người phụ trách còn đọc lại được thư
  fs.writeFileSync(path.join(XONG(ph), `${id}.json`), JSON.stringify({ ...x, xong_luc: new Date().toISOString(), xong_boi: ai, bao_cao: phanBao, ky_thuat: kyThuat, tin_bao: tinBao }, null, 1)); fs.rmSync(f);
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
    t.equal(mdTele('**Trial** đọc `pins:read`'), '<b>Trial</b> đọc <code>pins:read</code>');
    t.equal(mdTele('| Số liệu | Có |\n|---|---|\n| Impressions | Có |'), '• Số liệu · Có\n• Impressions · Có', 'bảng thành dòng');
    t.equal(mdTele('a < b & c'), 'a &lt; b &amp; c'); t.equal(mdTele('## Việc tiếp\n- bước 1'), '<b>Việc tiếp</b>\n• bước 1');
    { const r = tachBao('BÁO ANH:\nđã duyệt\n\nKỸ THUẬT:\nGET /v5/pins'); t.equal(r.bao, 'đã duyệt'); t.equal(r.kyThuat, 'GET /v5/pins'); t.equal(tachBao('chỉ báo').bao, 'chỉ báo'); }
    fs.mkdirSync(XONG('x'), { recursive: true }); fs.writeFileSync(path.join(XONG('x'), 'm1.json'), JSON.stringify({ id: 'm1', tieuDe: 'Pinterest API', xong_luc: '2026-10-20T02:00:00Z', tin_bao: [70, 71], bao_cao: 'cần App ID', ai: 'van' }));
    const hop = path.join(DATA(), 'tg-hop', 'x'); fs.mkdirSync(hop, { recursive: true });
    fs.writeFileSync(path.join(hop, '5.json'), JSON.stringify({ update_id: 5, message: { message_id: 90, text: 'App ID đã có trong vault #503', reply_to_message: { message_id: 71 }, from: { first_name: 'Tuấn' } } }));
    fs.writeFileSync(path.join(hop, '6.json'), JSON.stringify({ update_id: 6, message: { message_id: 91, text: 'tin bot', from: { is_bot: true } } }));
    t.equal(await quetTraLoi('x'), 1, 'chỉ tin người, bỏ tin bot'); const tl = choXu('x').find((v) => v.loai === 'tra-loi');
    t.equal(tl.truoc.id, 'm1', 'trả lời dưới báo cáo → gắn đúng thư'); t.equal(tl.loi_anh, 'App ID đã có trong vault #503'); t.equal(tl.tin, 90);
    console.log('phong-thu: tự kiểm đạt'); process.exit(0);
  }
  const ph = lay('--cho') ?? lay('--nhan') ?? lay('--xong') ?? lay('--dung'), id = ph ? a[a.indexOf(ph) + 1] : null, ai = lay('--ai') ?? '';
  if (lay('--cho')) { await quetTraLoi(ph); } if (lay('--cho')) console.log(a.includes('--json') ? JSON.stringify(choXu(ph)) : choXu(ph).map((x) => `${x.id} · ${x.mien} · ${x.tieuDe}`).join('\n') || 'không có thư chờ');
  else if (lay('--nhan')) { await nhan(ph, id, ai); console.log(`đã nhận ${id}`); }
  else if (lay('--xong')) { await xong(ph, id, ai, lay('--bao') === '-' ? fs.readFileSync(0, 'utf8') : (lay('--bao') ?? '')); console.log(`đã báo xong ${id}`); }
  else if (lay('--dung')) { await dung(ph, id, ai, lay('--ly-do')); console.log(`đã báo dừng ${id}`); }
}
