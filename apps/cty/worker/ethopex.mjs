// PHÒNG ETHOPEX — theo dõi luật camp FB phim ngắn + báo Telegram 📂 Ethopex, anh duyệt bằng NÚT ngay trong tin (anh 21/10/2026: "cần 1 con chuyên theo dõi và
// báo qua telegram để ko phải đợi tao nhắc… tạo 1 phòng mới là Ethopex" + "tao có thể duyệt trên đó luôn").
// Mỗi nhịp (box3, worker/nhip.mjs → Phát): (1) xử nút anh bấm trong hộp phòng (tg-phong.mjs) → lam-ethopex.py tăng / tắt qua API + đọc lại → sửa tin;
// (2) chấm luật một lần (apps/xuong-video/scripts/ethopex/luat-ethopex.py --json) → mục MỚI (chưa báo hôm nay) gửi một tin / nhóm, kèm nút.
// Máy KHÔNG tự tăng / tắt: chỉ làm khi anh bấm. Nút chỉ nhận từ người trong nhóm chat của bot (tin gửi vào nhóm riêng của anh).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const REPO = process.env.MOS2_DIR || '/opt/earns-marketing-os-v2';
const LUAT = path.join(REPO, 'apps/xuong-video/scripts/ethopex/luat-ethopex.py');
const LAM = path.join(REPO, 'apps/xuong-video/scripts/ethopex/lam-ethopex.py');
const TEP = () => path.join(DATA(), 'ethopex-da-bao.json');
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const chay = (tep, args, giay = 240) => new Promise((ok, hong) => execFile('python3', [tep, ...args], { timeout: giay * 1000, maxBuffer: 8 << 20, env: process.env }, (e, out, err) => (e ? hong(new Error((err || e.message).slice(-300))) : ok(out))));
const docJ = (f, mac) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return mac; } };

/** Nhóm báo: tiêu đề · nút cho mỗi mục (null = chỉ báo). dich = ngân sách đích lấy từ chữ "→ $X". */
const NHOM = [
  ['tat', '⏹ <b>CẦN TẮT</b> — tiêu > $10 từ trước tới nay, ROI < −50%', (m) => [{ text: `⏹ Tắt #${m.id}`, callback_data: `et:tat:${m.id}` }, { text: 'Giữ', callback_data: `et:bo:${m.id}` }]],
  ['tu_choi', '⛔ <b>AD BỊ META TỪ CHỐI</b> — Edit camp, thay creative sạch đã duyệt cùng phim', null],
  ['dau_phien', '⇑ <b>LÃI ĐẦU PHIÊN</b> — ROI hôm nay > 50%, tăng luôn $2/$3', (m) => (m.dich ? [{ text: `✅ #${m.id} lên $${m.dich}`, callback_data: `et:tang:${m.id}:${m.dich}` }, { text: 'Bỏ qua', callback_data: `et:bo:${m.id}` }] : null)],
  ['tang', '↑ <b>ĐỦ ĐIỀU KIỆN TĂNG BẬC</b> — ROI tháng ≥ 20%, Spending > 50%', (m) => (m.dich ? [{ text: `✅ #${m.id} lên $${m.dich}`, callback_data: `et:tang:${m.id}:${m.dich}` }, { text: 'Bỏ qua', callback_data: `et:bo:${m.id}` }] : null)],
  ['giam', '↓ <b>ROI TỤT</b> — phim down trend / creative bão hoà, xem giảm hoặc tắt', (m) => [{ text: `⏹ Tắt #${m.id}`, callback_data: `et:tat:${m.id}` }, { text: 'Giữ', callback_data: `et:bo:${m.id}` }]],
  ['moc30', '★ <b>CHẠM MỐC $30 MÀ VẪN LÃI</b> — hỏi Support cách scale bài viết cũ + bid ROAS', null],
  ['dong', '⏸ <b>CAMP ĐÃ BỊ ĐÓNG</b> — Ethopex dừng (chạm rule hoặc tắt tay); báo MỘT lần mỗi lần dừng', null],
];

const TEN = Object.fromEntries(NHOM.map(([k, t]) => [k, (t.match(/<b>(.*?)<\/b>/) || [, k])[1].toLowerCase()]));
/** [[nhóm, nutCho, mục mới]] → Map nhóm → mục; camp lặp ở nhóm sau gộp vào mục đầu: cung[] = {k, dich}, nut = nút mọi nhóm, trùng callback_data giữ một. */
export function gopCamp(ds) {
  const ra = new Map(), cua = new Map();
  for (const [k, nutCho, moi] of ds) for (const m of moi) {
    const nut = (nutCho && nutCho(m)) || [], dau = cua.get(String(m.id));
    if (!dau) { const x = { ...m, cung: [], nut: [...nut] }; cua.set(String(m.id), x); ra.set(k, [...(ra.get(k) ?? []), x]); continue; }
    dau.cung.push({ k, dich: m.dich }); for (const b of nut) if (!dau.nut.some((c) => c.callback_data === b.callback_data)) dau.nut.splice(dau.nut.length - 1, 0, b);   // nút mới chèn trước nút Bỏ qua / Giữ
  }
  return ra;
}

/** Nút anh bấm: et:tang:<id>:<$> · et:tat:<id> · et:bo:<id>. */
async function xuNut(tg, x) {
  const c = x.callback_query; x.xong(); if (!c || !/^et:/.test(c.data || '')) return null;
  const [, lenh, id, ns] = c.data.split(':'), ai = esc(c.from?.first_name || c.from?.username || 'Anh');
  if (lenh === 'bo') { await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đã bỏ qua' }); await tg('sendMessage', { message_thread_id: c.message.message_thread_id, text: `↩️ ${ai} bỏ qua #${esc(id)}`, reply_parameters: { message_id: c.message.message_id } }); return 'bo'; }
  await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đang làm…' });
  let kq; try { kq = JSON.parse((await chay(LAM, lenh === 'tang' ? ['tang', id, ns] : ['tat', id], 90)).trim().split('\n').pop()); } catch (e) { kq = { ok: false, loi: e.message }; }
  const tin = kq.ok ? (lenh === 'tang' ? `✅ ${ai} duyệt: #${esc(id)} $${esc(kq.truoc?.ns)} → <b>$${esc(kq.sau?.ns)}</b> (đã đọc lại)` : `⏹ ${ai} duyệt: #${esc(id)} đã <b>tắt</b> (đã đọc lại: ${esc(kq.sau?.tt)})`)
    : `⚠️ #${esc(id)} chưa làm được: ${esc(kq.loi || 'không rõ')}`;
  await tg('sendMessage', { message_thread_id: c.message.message_thread_id, text: tin, parse_mode: 'HTML', reply_parameters: { message_id: c.message.message_id } });
  return kq.ok ? lenh : 'loi';
}

export async function nhipEthopex(nguoi, { ten = nguoi } = {}) {
  const { tgNoiDung } = await import('./kiem-bai.mjs'); const { gomTin, moHop, topicPhong } = await import('./tg-phong.mjs');
  const { tg } = await tgNoiDung();
  const topic = await topicPhong('ethopex', '📂 Ethopex', tg, { duocTao: true });   // anh lập phòng 21/10/2026 = cho tạo chủ đề
  await gomTin(tg); let nut = 0;
  for (const x of moHop('ethopex')) if (await xuNut(tg, x)) nut++;
  const kq = JSON.parse((await chay(LUAT, ['--json'])).trim().split('\n').pop());
  const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const st = docJ(TEP(), {}); const da = st.ngay === homNay ? new Set(st.da) : new Set();
  // camp ĐÃ ĐÓNG báo một lần mỗi lần dừng (không theo ngày): nhớ tập đang dừng; camp chạy lại thì rời tập, dừng lần sau báo lại
  const dongTruoc = new Set(st.dong ?? []), dongNay = new Set((kq.dong || []).map((m) => String(m.id)));
  for (const id of dongTruoc) if (dongNay.has(id)) da.add(`dong:${id}`);
  let gui = 0;
  // MỘT CAMP MỘT MỤC (anh 21/10/2026: "cùng 1 camp thì gộp được không"): camp chạm nhiều luật trong lượt này chỉ hiện ở nhóm ĐẦU TIÊN nó chạm,
  // kèm dòng "cũng: <luật khác>" và gộp nút của mọi luật (trùng nút thì giữ một) — vd lãi đầu phiên $2 + đủ bậc $3 thành một mục, hai nút lên $2 / $3.
  const gom = gopCamp(NHOM.map(([k, , nutCho]) => [k, nutCho, (kq[k] || []).filter((m) => !da.has(`${k}:${m.id}`)).map((m) => ({ ...m, dich: (String(m.chu).match(/→ \$(\d+)/) || [])[1] }))]));
  for (const [k, tieu] of NHOM) {
    const moi = gom.get(k) ?? [];
    if (!moi.length) continue;
    const dong = moi.slice(0, 15).map((m) => `• ${esc(m.chu)}${m.cung.map((c) => `\n   ↳ cũng: ${esc(TEN[c.k])}${c.dich ? ` → $${c.dich}` : ''}`).join('')}`).join('\n');
    const bang = moi.slice(0, 15).map((m) => m.nut).filter((h) => h.length);
    await tg('sendMessage', { message_thread_id: topic, text: `${tieu}\n${dong}${moi.length > 15 ? `\n… và ${moi.length - 15} camp nữa (xem tab Ethopex mos2)` : ''}\n<i>${esc(ten)} · ${esc(kq.luc)} giờ VN</i>`, parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }, ...(bang.length ? { reply_markup: { inline_keyboard: bang } } : {}) });
    for (const m of moi) for (const kk of [k, ...m.cung.map((c) => c.k)]) da.add(`${kk}:${m.id}`); gui++;
  }
  fs.writeFileSync(TEP(), JSON.stringify({ ngay: homNay, da: [...da], dong: [...dongNay] }));
  return { gui, nut };
}

if (process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'); const nut = Object.fromEntries(NHOM.map(([k, , n]) => [k, n]));
  const g = gopCamp([['dau_phien', nut.dau_phien, [{ id: 65735, chu: 'a', dich: '2' }]], ['tang', nut.tang, [{ id: 65735, chu: 'b', dich: '3' }, { id: 1, chu: 'c', dich: '3' }]]]);
  t.equal(g.get('dau_phien').length, 1); t.equal(g.get('tang').length, 1, 'camp trùng không hiện lần hai'); const m = g.get('dau_phien')[0];
  t.deepEqual(m.nut.map((b) => b.callback_data), ['et:tang:65735:2', 'et:tang:65735:3', 'et:bo:65735'], 'gộp nút $2 + $3, một nút Bỏ qua ở cuối'); t.deepEqual(m.cung, [{ k: 'tang', dich: '3' }]);
  t.equal(TEN.tang, 'đủ điều kiện tăng bậc');
  console.log('ethopex: tự kiểm đạt');
}

if (process.argv.includes('--in')) {   // xem tại chỗ, không gửi: node worker/ethopex.mjs --in
  chay(LUAT, ['--json']).then((o) => console.log(o)).catch((e) => { console.error(e.message); process.exit(1); });
}
