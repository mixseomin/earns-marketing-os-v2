// HỘP TIN TELEGRAM THEO PHÒNG (anh 17/10/2026: "phòng nào thì tự mà theo dõi tele phòng đó").
// Telegram chỉ cho MỘT nơi đọc tin của bot: getUpdates đọc là xác nhận luôn, hai nơi cùng đọc thì nơi này nuốt tin của nơi kia (trước đây Bảo mật đọc
// với allowed_updates=['callback_query'] nên tin anh gõ vào chủ đề khác bị Telegram bỏ hẳn). Bộ nhận chung này đọc một lần, xếp từng tin vào hộp của
// PHÒNG SỞ HỮU CHỦ ĐỀ (topic) đó: <DATA>/tg-hop/<phòng>/<update_id>.json. Phòng nào tự mở hộp phòng mình (moHop). Nhịp nào chạy trước thì gom hộ cả công ty.
// Chủ đề → phòng: CHU_DE — mỗi phòng giữ mã topic bot đã tạo trong tệp trạng thái của nó. Thêm phòng có chủ đề riêng = thêm một dòng ở đây.
import fs from 'node:fs';
import path from 'node:path';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
export const CHU_DE = { 'an-toan-tk': 'bao-mat-tg.json', 'noi-dung': 'noi-dung-tg.json' };
const GOC_HOP = () => path.join(DATA(), 'tg-hop'), HOP = (p) => path.join(GOC_HOP(), p);
const KHAC_NUT = '_khac';   // nút đã nhận (x:cho) — không phòng nào xử
// Nút bấm về phòng SỞ HỮU nút, không theo chủ đề nơi bấm: "↪️ Sai phòng" (kc:) nằm dưới thư Kiên chuyển vào chủ đề phòng khác vẫn về Kiên.
export const NUT_CUA = { x: KHAC_NUT, km: 'an-toan-tk', kc: 'an-toan-tk', tp: 'an-toan-tk', nd: 'noi-dung', et: 'ethopex', el: 'ethopex', eb: 'ethopex-bang', ph: 'phim', sp: 'sp', dc: 'duyet-chi' };   // et: nút duyệt tăng / tắt camp của phòng Ethopex · eb: 🔄 bảng số Ethopex (xử ngay ở tg-nghe) · ph: chạy tiếp / dừng phim vượt ngân sách (phim-nut.mjs) · sp: 🚀 máy đăng một sản phẩm (sp-nut.mjs) · dc: ✅ duyệt chi một lượt việc tốn tiền (duyet-chi.mjs)
const KHAC = '_khac', GIU_KHAC_NGAY = 7;   // tin ở chủ đề không phòng nào nhận (chung, chủ đề tay) — giữ 7 ngày để tra rồi xoá

/** topic → phòng, đọc từ tệp trạng thái từng phòng (CHU_DE) + chủ đề phòng tạo qua topicPhong (tg-<phòng>.json). */
export function phongCuaTopic(topic) {
  if (topic == null) return null;
  let them = []; try { them = fs.readdirSync(DATA()).filter((f) => /^tg-[a-z0-9-]+\.json$/.test(f)).map((f) => [f.slice(3, -5), f]); } catch { /* chưa có */ }
  for (const [phong, tep] of [...Object.entries(CHU_DE), ...them]) { try { if (JSON.parse(fs.readFileSync(path.join(DATA(), tep), 'utf8')).topic === topic) return phong; } catch { /* phòng chưa tạo chủ đề */ } }
  return null;
}
/** Chủ đề Telegram của một phòng: có thì trả mã. CHƯA CÓ thì trả null — KHÔNG tự tạo (anh 20/10/2026: "cấm tự đẻ ra phòng, phải xin phép",
 *  sau khi Kiên tự tạo 📂 Dựng sản phẩm). Chỉ nút "✅ Tạo chủ đề" anh bấm mới gọi với { duocTao: true }. */
export async function topicPhong(phong, ten, tg, { duocTao = false } = {}) {
  const tep = CHU_DE[phong] ? path.join(DATA(), CHU_DE[phong]) : path.join(DATA(), `tg-${phong}.json`);
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  if (st.topic) return st.topic;
  if (!duocTao) return null;
  const j = await tg('createForumTopic', { name: ten }); if (!j.ok) return null;
  st.topic = j.result.message_thread_id; fs.writeFileSync(tep, JSON.stringify(st));
  try { await ghimNhanSu(phong, tg); } catch { /* bảng ghim hỏng không chặn việc chuyển thư */ }
  return st.topic;
}
// BẢNG NHÂN SỰ GHIM ở đầu chủ đề mỗi phòng (anh 20/10/2026: "ở mỗi phòng trên Tele hãy tạo 1 pin danh sách nhân sự"). Ghi rõ ai ĐANG
// CHẠY THẬT (có nhịp máy, đang bật) và ai MỚI CÓ HỒ SƠ — để thấy ngay phòng nào chưa có người làm việc tiếp theo.
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmV = (t, k) => t.match(new RegExp(`^${k}:\\s*(.+?)\\s*(#.*)?$`, 'm'))?.[1]?.trim() ?? '';
export async function bangNhanSu(phong) {
  const { GOC } = await import('./goc.mjs'); const goc = path.join(GOC, 'cong-ty');
  let tp = ''; try { tp = fs.readFileSync(path.join(goc, 'phong', `${phong}.md`), 'utf8'); } catch { return null; }
  let chinh = {}; try { chinh = JSON.parse(fs.readFileSync(path.join(DATA(), 'nhip-chinh.json'), 'utf8')); } catch { /* chưa chỉnh */ }
  const ns = fs.readdirSync(path.join(goc, 'nhan-su')).map((id) => { try { const t = fs.readFileSync(path.join(goc, 'nhan-su', id, 'SOUL.md'), 'utf8');
    return { id, ten: fmV(t, 'ten'), cd: fmV(t, 'chuc_danh'), phong: fmV(t, 'phong'), hb: fmV(t, 'heartbeat'), model: fmV(t, 'model') }; } catch { return null; } })
    .filter((x) => x?.phong === phong).sort((a, b) => /^Trưởng/i.test(b.cd) - /^Trưởng/i.test(a.cd));
  const tenPh = fmV(tp, 'ten');
  // việc MÁY của phòng (quy-trinh/<phòng>/danh-sach.json, có lịch chạy): chủ trì ghi theo mã người hoặc theo VAI → vai_<vai> trong tệp phòng, trưởng phòng mặc định
  let qt = []; try { qt = JSON.parse(fs.readFileSync(path.join(goc, 'quy-trinh', phong, 'danh-sach.json'), 'utf8')).quy_trinh ?? []; } catch { /* phòng chưa khai quy trình */ }
  const truong = ns.find((x) => /^Trưởng/i.test(x.cd))?.id;
  const nguoiCua = (ct) => (ns.some((x) => x.id === ct) ? ct : fmV(tp, `vai_${String(ct).replace(/-/g, '_')}`) || (ct === 'truong-phong' ? truong : null));
  const may = {}; for (const q of qt) if ((q.lam ?? []).includes('may') && (q.lich ?? []).length) { const ai = nguoiCua(q.chu_tri); if (ai) (may[ai] ??= []).push(q.ten); }
  const dong = ns.map((x) => { const nhip = x.hb && x.hb !== 'off' && chinh[x.id]?.bat !== false, vm = may[x.id] ?? [], chay = nhip || vm.length;
    const viec = [nhip ? `nhịp ${x.hb}` : '', vm.length ? `máy chạy ${vm.length} việc (${vm.slice(0, 3).join(', ')}${vm.length > 3 ? '…' : ''})` : ''].filter(Boolean).join(' · ');
    return `${chay ? '🟢' : '⚪️'} <b>${esc(x.ten)}</b> — ${esc(x.cd)}\n    ${chay ? esc(viec) : chinh[x.id]?.bat === false ? 'đang TẮT (cột Tự làm)' : 'mới có hồ sơ — chưa có máy chạy việc'}${x.model && x.model !== 'không' ? ` · não ${esc(x.model)}` : ''}`; });
  const cho = [...tp.matchAll(/^cho_thu:\s*(.+)$/gm)].map(([, v]) => `• ${esc(v.split(' | ').slice(1).join(' | ') || v)}`);
  return `📌 <b>Nhân sự · ${esc(tenPh)}</b>\n\n${dong.join('\n') || '(chưa có ai)'}${cho.length ? `\n\n<b>Đang chờ thư:</b>\n${cho.join('\n')}` : ''}\n\n🟢 đang chạy thật · ⚪️ chỉ có hồ sơ\n<a href="https://cty.on.tc/phong/${phong}">↗ cty · ${esc(tenPh)}</a>`;
}
/** Gửi + ghim bảng nhân sự lần đầu; các lần sau chỉ sửa khi chữ đổi. Nhớ mã tin ghim trong tệp chủ đề của phòng. */
export async function ghimNhanSu(phong, tg) {
  const tep = CHU_DE[phong] ? path.join(DATA(), CHU_DE[phong]) : path.join(DATA(), `tg-${phong}.json`);
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { return 'chưa có chủ đề'; }
  if (!st.topic) return 'chưa có chủ đề';
  const chu = await bangNhanSu(phong); if (!chu || chu === st.ghimChu) return 'không đổi';
  const opt = { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, text: chu };
  if (st.ghim && (await tg('editMessageText', { message_id: st.ghim, ...opt })).ok) { st.ghimChu = chu; fs.writeFileSync(tep, JSON.stringify(st)); return 'đã sửa'; }
  const j = await tg('sendMessage', { message_thread_id: st.topic, ...opt }); if (!j.ok) return 'gửi hỏng';
  await tg('pinChatMessage', { message_id: j.result.message_id, disable_notification: true });
  // đọc lại tệp trước khi ghi: phòng khác (Kiên, Ngọc) có thể vừa ghi khoá riêng của nó vào cùng tệp
  try { st = { ...JSON.parse(fs.readFileSync(tep, 'utf8')), ghim: j.result.message_id, ghimChu: chu }; } catch { st = { ...st, ghim: j.result.message_id, ghimChu: chu }; }
  fs.writeFileSync(tep, JSON.stringify(st)); return 'đã ghim';
}
/** Mọi phòng đang có chủ đề → ghim / cập nhật bảng nhân sự; tối đa mỗi giờ một lần (gomTin gọi). */
export async function capNhatGhim(tg, { ep = false } = {}) {
  const tLan = path.join(GOC_HOP(), 'ghim.json'); let lan = 0; try { lan = JSON.parse(fs.readFileSync(tLan, 'utf8')).luc; } catch { /* lần đầu */ }
  if (!ep && Date.now() - lan < 3600_000) return null;
  fs.mkdirSync(GOC_HOP(), { recursive: true }); fs.writeFileSync(tLan, JSON.stringify({ luc: Date.now() }));
  let them = []; try { them = fs.readdirSync(DATA()).filter((f) => /^tg-[a-z0-9-]+\.json$/.test(f)).map((f) => f.slice(3, -5)); } catch { /* không có */ }
  const ra = {}; for (const ph of [...Object.keys(CHU_DE), ...them]) { try { ra[ph] = await ghimNhanSu(ph, tg); } catch (e) { ra[ph] = `lỗi: ${e.message}`; } }
  return ra;
}
/** Nút vừa bấm → "⏳ <chữ nút> — đã nhận" (callback x:cho, không phòng nào xử), các nút khác giữ nguyên; trả lời callback "Đã nhận". */
export const banDaNhan = (markup, data) => ({ inline_keyboard: (markup?.inline_keyboard ?? []).map((hang) => hang.map((b) => (b.callback_data === data ? { text: `⏳ ${b.text} — đã nhận, đang xử`.slice(0, 64), callback_data: 'x:cho' } : b))) });
async function daNhanNut(tg, c, bang = new Map()) {
  if (!c.id) { /* bấm giả từ chữ / cảm xúc: không có lần bấm thật để trả lời */ } else if (String(c.data) === 'x:cho') return tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đã nhận rồi — đang xử, đợi báo kết quả' });
  else await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đã nhận — đang xử, kết quả báo ngay dưới tin' });
  // NHIỀU NÚT CÙNG TIN bấm trong một lượt gom: mỗi lần bấm mang ảnh chụp bàn phím lúc bấm → dùng bàn phím đã sửa của lần trước (bang), không thì
  // lần sau ghi đè lần trước và chỉ nút cuối hiện ⏳ (21/10/2026: anh bấm 7 nút, 6 nút không đổi gì)
  const mid = c.message?.message_id; if (!mid || !c.message.reply_markup) return;
  const moi = banDaNhan(bang.get(mid) ?? c.message.reply_markup, c.data); bang.set(mid, moi);
  await tg('editMessageReplyMarkup', { message_id: mid, reply_markup: moi });
}
// TRẢ LỜI BẰNG CHỮ / THẢ CẢM XÚC = BẤM NÚT (anh 22/10/2026: "tao muốn trả lời trên tele này và nó phải làm luôn. Nếu là reply thì hiểu là cho câu hỏi đó.
// Nếu hỏi có đồng ý mà tao thả like hoặc tim nó cũng phải hiểu"). Mọi bộ gửi tin của cty bọc ghiNut: tin bot gửi kèm nút được ghi vào sổ nut.json
// (mã tin → bàn phím + chủ đề), vì Telegram không cho bot đọc lại tin cũ khi chỉ nhận được cảm xúc. gomTin đổi "ok"/"không" (trả lời ngay dưới tin) hoặc
// 👍❤️👌🔥 / 👎 thành đúng lần bấm nút ĐỒNG Ý / TỪ CHỐI của tin đó — rồi xử như anh bấm (hiện ⏳, vào hộp phòng sở hữu nút). Câu khác (vd "Thật", "Giả",
// câu dặn dài) giữ nguyên là tin chữ để phòng tự đọc. Tin có NHIỀU nút đồng ý (vd lên $2 / lên $3) thì không đoán — bot hỏi lại.
const TEP_NUT = () => path.join(GOC_HOP(), 'nut.json'), GIU_NUT = 1500;
export function ghiNut(tg) {
  return async (m, b) => { const j = await tg(m, b);
    try { const mid = m === 'sendMessage' ? j?.result?.message_id : b?.message_id; const kb = b?.reply_markup?.inline_keyboard;
      if (mid && kb && ['sendMessage', 'editMessageReplyMarkup', 'editMessageText'].includes(m)) { fs.mkdirSync(GOC_HOP(), { recursive: true }); let so = {}; try { so = JSON.parse(fs.readFileSync(TEP_NUT(), 'utf8')); } catch { /* lần đầu */ }
        so[mid] = { kb, topic: j?.result?.message_thread_id ?? b?.message_thread_id ?? so[mid]?.topic ?? null }; const k = Object.keys(so); for (const x of k.slice(0, Math.max(0, k.length - GIU_NUT))) delete so[x];
        fs.writeFileSync(TEP_NUT(), JSON.stringify(so)); } } catch { /* sổ nút hỏng không chặn việc gửi */ }
    return j; };
}
const docNut = (mid) => { try { return JSON.parse(fs.readFileSync(TEP_NUT(), 'utf8'))[mid] ?? null; } catch { return null; } };
const CO = /^(ok(e|ay)?|oke+|ừ+|uh+|ờ|có|co|đồng ý|dong y|được|duoc|đc|dc|yes|y|làm đi|lam di|tạo đi|tao di|chạy đi|chay di|duyệt|duyet|chốt|chot|👍|❤️?|👌|✅)[\s.!]*$/i;
const KHONG = /^(không|khong|ko|k|no|thôi|thoi|bỏ qua|bo qua|đừng|dung|từ chối|tu choi|👎|❌|✖️?)[\s.!]*$/i;
const CAM_CO = new Set(['👍', '❤', '❤️', '👌', '🔥', '🥰', '👏', '⚡', '❤‍🔥', '💯', '🤝', '🫡']), CAM_KHONG = new Set(['👎']);
const laNutKhong = (b) => /^(✖|⏹|❌)|bỏ qua|^giữ\b|^không|^dừng|^thôi/i.test(String(b.text ?? '').trim());
/** Bàn phím + ý (co / khong) → nút tương ứng; null khi không chắc (nhiều nút đồng ý, không có nút từ chối…). */
export function nutTheoY(kb, y) {
  const nut = (kb ?? []).flat().filter((b) => b.callback_data && b.callback_data !== 'x:cho');
  const ds = y === 'khong' ? nut.filter(laNutKhong) : nut.filter((b) => !laNutKhong(b));
  return ds.length === 1 ? ds[0] : null;
}
/** Một update → lần bấm nút giả (callback_query không có id) khi anh trả lời chữ / thả cảm xúc lên tin có nút; null = để nguyên. */
export function doiThanhNut(x) {
  const tr = x.message, r = x.message_reaction;
  if (tr?.reply_to_message?.from?.is_bot && !tr.from?.is_bot) {
    const chu = String(tr.text ?? '').trim(), y = CO.test(chu) ? 'co' : KHONG.test(chu) ? 'khong' : null; if (!y) return null;
    const goc = tr.reply_to_message, so = docNut(goc.message_id), kb = so?.kb ?? goc.reply_markup?.inline_keyboard; if (!kb) return null;
    const b = nutTheoY(kb, y); return { nut: b, kb, mid: goc.message_id, topic: goc.message_thread_id ?? so?.topic ?? null, from: tr.from, hoi: tr.message_id };
  }
  if (r && !r.user?.is_bot) {
    const moi = (r.new_reaction ?? []).map((e) => e.emoji).filter(Boolean), y = moi.some((e) => CAM_CO.has(e)) ? 'co' : moi.some((e) => CAM_KHONG.has(e)) ? 'khong' : null; if (!y) return null;
    const so = docNut(r.message_id); if (!so) return null;
    return { nut: nutTheoY(so.kb, y), kb: so.kb, mid: r.message_id, topic: so.topic, from: r.user };
  }
  return null;
}
const topicCua = (x) => x.message?.message_thread_id ?? x.callback_query?.message?.message_thread_id ?? null;

/** Đọc mọi tin mới của bot một lần, xếp vào hộp phòng. tg(method, body) = hàm gọi Bot API của bên gọi. Có khoá: hai nhịp cùng lúc thì một bên bỏ qua. */
export async function gomTin(tg, { cho = 0 } = {}) {   // cho = giây chờ tin mới (long-poll) — dịch vụ nghe (tg-nghe.mjs) dùng; nhịp mỗi phút để 0
  fs.mkdirSync(GOC_HOP(), { recursive: true });
  const khoa = path.join(GOC_HOP(), '.khoa');
  // dịch vụ nghe đang sống (tim đập < 90 giây) thì nhịp mỗi phút KHÔNG gom: một nơi đọc bot thôi, nơi kia sẽ nuốt tin
  if (!cho) { try { if (Date.now() - fs.statSync(path.join(GOC_HOP(), 'nghe.tim')).mtimeMs < 90_000) return 0; } catch { /* không có dịch vụ nghe */ } }
  try { fs.mkdirSync(khoa); } catch { if (Date.now() - fs.statSync(khoa).mtimeMs < 120000) return 0; fs.rmSync(khoa, { recursive: true, force: true }); fs.mkdirSync(khoa); }   // khoá kẹt > 2 phút = nhịp trước chết giữa chừng
  try {
    const tOffset = path.join(GOC_HOP(), 'offset.json'); let offset = 0; try { offset = JSON.parse(fs.readFileSync(tOffset, 'utf8')).offset; } catch { /* lần đầu */ }
    const u = await tg('getUpdates', { offset, timeout: cho, allowed_updates: ['message', 'callback_query', 'message_reaction'] });
    let n = 0; const banPhim = new Map();   // bàn phím đã đánh dấu trong lượt này, theo mã tin
    for (let x of u.ok ? u.result : []) {
      const d = doiThanhNut(x);
      if (d && !d.nut) { try { await tg('sendMessage', { message_thread_id: d.topic ?? undefined, ...(d.hoi ? { reply_parameters: { message_id: d.hoi } } : { reply_parameters: { message_id: d.mid } }), text: 'Tin này có nhiều lựa chọn — anh bấm đúng nút giúp em nhé.' }); } catch { /* báo hỏng không chặn */ } offset = x.update_id + 1; n++; continue; }
      if (d?.hoi) tinNhanh(d.hoi);   // câu "ok"/"ko" anh gõ để duyệt — xong việc thì dọn như tin nhanh
      if (d) x = { update_id: x.update_id, callback_query: { id: null, data: d.nut.callback_data, from: d.from, tu_chu: true, message: { message_id: d.mid, message_thread_id: d.topic, reply_markup: { inline_keyboard: d.kb } } } };
      if (x.message_reaction) { offset = x.update_id + 1; continue; }   // cảm xúc không phải đồng ý / từ chối trên tin có nút → bỏ
      // NÚT CỐ ĐỊNH 📊 Report dưới ô nhập (bàn phím trả lời bền — anh 26/10/2026 "có thêm nút cố định ở đây đc ko"): bấm = gửi chữ "📊 Report"
      // → đổi thành nút eb:report vào hộp ethopex-bang (dịch vụ nghe xử ngay, cùng đường nút 📊 Report dưới tin báo cáo giờ); tin chữ đó dọn như tin nhanh
      if (x.message && !x.message.from?.is_bot && String(x.message.text ?? '').trim() === '📊 Report') {
        tinNhanh(x.message.message_id); x = { update_id: x.update_id, callback_query: { id: null, data: 'eb:report', ban_phim: true, from: x.message.from, message: { message_id: x.message.message_id, message_thread_id: x.message.message_thread_id } } }; }
      const phong = (x.callback_query && NUT_CUA[String(x.callback_query.data ?? '').split(':')[0]]) ?? phongCuaTopic(topicCua(x)) ?? KHAC;
      // ĐÃ NHẬN ngay khi gom (≤ 1 phút), không đợi nhịp của phòng (Ethopex 30 phút): nút anh bấm đổi thành "⏳ … — đã nhận, đang xử" và không bấm
      // lại được (tránh tăng ngân sách hai lần). Kết quả thành / bại do phòng sở hữu nút báo khi xử xong (anh 21/10/2026: "bấm không có tác dụng gì").
      if (x.callback_query && !x.callback_query.ban_phim) try { await daNhanNut(tg, x.callback_query, banPhim); } catch { /* đánh dấu hỏng không chặn việc xếp hộp */ }
      fs.mkdirSync(HOP(phong), { recursive: true }); fs.writeFileSync(path.join(HOP(phong), `${x.update_id}.json`), JSON.stringify(x));
      offset = x.update_id + 1; n++;
    }
    fs.writeFileSync(tOffset, JSON.stringify({ offset }));
    if ((u.ok ? u.result : []).some(laAnh)) fs.writeFileSync(TEP_DOC(), JSON.stringify({ luc: Date.now() }));
    try { await donTinNhanh(tg); } catch (e) { console.error(`✗ dọn tin nhanh: ${e.message}`); }
    try { await capNhatGhim(tg); } catch (e) { console.error(`✗ ghim nhân sự: ${e.message}`); }
    try { for (const f of fs.readdirSync(HOP(KHAC))) if (Date.now() - fs.statSync(path.join(HOP(KHAC), f)).mtimeMs > GIU_KHAC_NGAY * 864e5) fs.rmSync(path.join(HOP(KHAC), f)); } catch { /* chưa có hộp khác */ }
    return n;
  } finally { fs.rmSync(khoa, { recursive: true, force: true }); }
}

// DỌN TIN (anh 22/10/2026: "cái nào đã duyệt hoặc không liên quan trong tele thì xoá sau khi xong việc. Cái nào là thông báo nhanh thì tự xoá 15' sau khi đã được đọc").
// Bot Telegram KHÔNG đọc được trạng thái "đã xem" của người dùng → "đã đọc" = anh có hoạt động trong nhóm (gõ tin, bấm nút, thả cảm xúc) SAU lúc tin gửi;
// tính 15 phút từ lần hoạt động đầu tiên đó rồi xoá. Tin quá 47 giờ thì bỏ khỏi sổ (Telegram chỉ cho bot xoá tin < 48 giờ).
// Phòng gọi tinNhanh(mã tin) sau khi gửi; gomTin (mỗi vòng nghe ~30 giây) ghi lúc anh hoạt động + gọi donTinNhanh.
const TEP_TAM = () => path.join(GOC_HOP(), 'tin-nhanh.json'), TEP_DOC = () => path.join(GOC_HOP(), 'anh-doc.json');
export const XOA_SAU_DOC_PHUT = 15;
const laAnh = (x) => { const f = x.message?.from ?? x.callback_query?.from ?? x.message_reaction?.user; return !!f && !f.is_bot; };
const docTep = (f, mac) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return mac; } };
export function tinNhanh(mid, luc = Date.now()) {
  if (!mid) return; fs.mkdirSync(GOC_HOP(), { recursive: true }); const so = docTep(TEP_TAM(), {}); so[mid] = { luc }; fs.writeFileSync(TEP_TAM(), JSON.stringify(so));
}
/** → mã tin đã tới lúc xoá; cập nhật sổ (gắn mốc đọc). Thuần để tự kiểm. */
export function buocDon(so, anhLuc, now) {
  const xoa = [];
  for (const [mid, t] of Object.entries(so)) {
    if (!t.doc && anhLuc && anhLuc > t.luc) t.doc = anhLuc;
    if ((t.doc && now - t.doc >= XOA_SAU_DOC_PHUT * 60_000) || now - t.luc > 47 * 3600_000) { xoa.push(Number(mid)); delete so[mid]; }
  }
  return xoa;
}
export async function donTinNhanh(tg, now = Date.now()) {
  const so = docTep(TEP_TAM(), {}); if (!Object.keys(so).length) return 0;
  const xoa = buocDon(so, docTep(TEP_DOC(), {}).luc ?? 0, now);
  for (const mid of xoa) await tg('deleteMessage', { message_id: mid });
  fs.writeFileSync(TEP_TAM(), JSON.stringify(so)); return xoa.length;
}

/** Tin trong hộp một phòng, cũ trước. Mỗi tin có xong() — gọi sau khi xử xong thì tin rời hộp (xử hỏng thì lượt sau xử lại). */
export function moHop(phong) {
  let ds = []; try { ds = fs.readdirSync(HOP(phong)).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a) - parseInt(b)); } catch { return []; }
  return ds.map((f) => { const p = path.join(HOP(phong), f); return { ...JSON.parse(fs.readFileSync(p, 'utf8')), xong: () => fs.rmSync(p, { force: true }) }; });
}

if (process.argv[1]?.endsWith('tg-phong.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'); const os = await import('node:os');
  process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-phong-'));
  fs.writeFileSync(path.join(DATA(), 'noi-dung-tg.json'), JSON.stringify({ topic: 7 })); fs.writeFileSync(path.join(DATA(), 'bao-mat-tg.json'), JSON.stringify({ topic: 3 }));
  let goi = null; const tg = async (m, b) => { if (m === 'getUpdates') goi = b; return { ok: true, result: [
    { update_id: 10, message: { message_thread_id: 7, text: 'https://ratesbyroom.com/a/' } },
    { update_id: 11, callback_query: { data: 'km:x:y', message: { message_thread_id: 3 } } },
    { update_id: 12, message: { text: 'chủ đề chung' } },
    { update_id: 13, callback_query: { data: 'kc:?:abcd1234', message: { message_thread_id: 7 } } }] }; };
  t.equal(await gomTin(tg), 4); t.deepEqual(goi.allowed_updates, ['message', 'callback_query', 'message_reaction'], 'đọc tin, nút lẫn cảm xúc');
  t.equal(moHop('noi-dung').length, 1, 'nút kc: bấm trong chủ đề Nội dung KHÔNG vào hộp Nội dung'); t.equal(moHop('an-toan-tk').length, 2, 'nút kc: về hộp Bảo mật'); t.equal(moHop('an-toan-tk')[0].callback_query.data, 'km:x:y'); t.equal(moHop(KHAC).length, 1, 'chủ đề chung không lọt vào phòng nào');
  await gomTin(tg); t.equal(goi.offset, 14, 'lần sau đọc tiếp sau tin cuối');
  const [a] = moHop('noi-dung'); a.xong(); t.equal(moHop('noi-dung').length, 0, 'xong() rút tin khỏi hộp');
  fs.mkdirSync(path.join(GOC_HOP(), '.khoa')); t.equal(await gomTin(tg), 0, 'nhịp khác đang gom thì bỏ qua');
  let tao = 0; const tg2 = async () => ({ ok: true, result: { message_thread_id: 40 + ++tao } });
  t.equal(await topicPhong('sach', '📂 Sách', tg2), null, 'KHÔNG tự tạo chủ đề phòng khi chưa được anh cho'); t.equal(tao, 0);
  t.equal(await topicPhong('sach', '📂 Sách', tg2, { duocTao: true }), 41); t.equal(await topicPhong('sach', '📂 Sách', tg2), 41, 'chủ đề phòng tạo một lần'); t.equal(phongCuaTopic(41), 'sach', 'tin trong chủ đề phòng về hộp phòng đó');
  { const mk = { inline_keyboard: [[{ text: '✅ #65483 lên $3', callback_data: 'et:tang:65483:3' }, { text: 'Bỏ qua', callback_data: 'et:bo:65483' }]] };
    const b = banDaNhan(mk, 'et:tang:65483:3'); t.equal(b.inline_keyboard[0][0].callback_data, 'x:cho', 'nút đã bấm không bấm lại được'); t.match(b.inline_keyboard[0][0].text, /^⏳ .*đã nhận/); t.equal(b.inline_keyboard[0][1].callback_data, 'et:bo:65483', 'nút khác giữ nguyên'); }
  { const sua = []; const tg3 = async (m, b) => { if (m === 'editMessageReplyMarkup') sua.push(b.reply_markup); return { ok: true }; };
    const mk = { inline_keyboard: [[{ text: 'A', callback_data: 'et:tang:1:3' }, { text: 'Bỏ', callback_data: 'et:bo:1' }], [{ text: 'B', callback_data: 'et:tang:2:3' }, { text: 'Bỏ', callback_data: 'et:bo:2' }]] };
    const bp = new Map(); await daNhanNut(tg3, { id: 'a', data: 'et:tang:1:3', message: { message_id: 9, reply_markup: mk } }, bp); await daNhanNut(tg3, { id: 'b', data: 'et:tang:2:3', message: { message_id: 9, reply_markup: mk } }, bp);
    t.ok(sua.at(-1).inline_keyboard.every((h) => h[0].callback_data === 'x:cho'), 'hai nút bấm cùng lượt: cả hai đều hiện ⏳'); }
  { const kb = [[{ text: '✅ Tạo chủ đề Kinh doanh', callback_data: 'tp:kinh-doanh:ok' }, { text: '✖ Không, để ở Bảo mật', callback_data: 'tp:kinh-doanh:no' }]];
    t.equal(nutTheoY(kb, 'co').callback_data, 'tp:kinh-doanh:ok'); t.equal(nutTheoY(kb, 'khong').callback_data, 'tp:kinh-doanh:no');
    t.equal(nutTheoY([[{ text: '✅ #1 lên $2', callback_data: 'et:tang:1:2' }, { text: '✅ #1 lên $3', callback_data: 'et:tang:1:3' }, { text: 'Bỏ qua', callback_data: 'et:bo:1' }]], 'co'), null, 'hai nút đồng ý → không đoán');
    const sua = ghiNut(async () => ({ ok: true, result: { message_id: 500, message_thread_id: 3 } })); await sua('sendMessage', { text: 'hỏi', reply_markup: { inline_keyboard: kb } });
    const hoi = { message_id: 500, message_thread_id: 3, from: { is_bot: true } };
    t.equal(doiThanhNut({ message: { message_id: 9, text: 'ok', from: { first_name: 'Tuấn' }, reply_to_message: hoi } }).nut.callback_data, 'tp:kinh-doanh:ok', 'trả lời "ok" = bấm Tạo');
    t.equal(doiThanhNut({ message: { message_id: 9, text: 'ko', from: {}, reply_to_message: hoi } }).nut.callback_data, 'tp:kinh-doanh:no');
    t.equal(doiThanhNut({ message: { message_id: 9, text: 'Thật', from: {}, reply_to_message: hoi } }), null, 'chữ khác giữ là tin chữ');
    t.equal(doiThanhNut({ message_reaction: { message_id: 500, user: { first_name: 'Tuấn' }, new_reaction: [{ type: 'emoji', emoji: '❤' }] } }).nut.callback_data, 'tp:kinh-doanh:ok', 'thả tim = đồng ý');
    t.equal(doiThanhNut({ message_reaction: { message_id: 999, user: {}, new_reaction: [{ type: 'emoji', emoji: '👍' }] } }), null, 'tin không có nút → bỏ');
    let goi2 = []; const tg4 = async (m, b) => { goi2.push([m, b]); return m === 'getUpdates' ? { ok: true, result: [{ update_id: 50, message_reaction: { message_id: 500, user: { first_name: 'Tuấn' }, new_reaction: [{ type: 'emoji', emoji: '👍' }] } }] } : { ok: true }; };
    fs.rmSync(path.join(GOC_HOP(), '.khoa'), { recursive: true, force: true }); await gomTin(tg4); t.equal(moHop('an-toan-tk').at(-1).callback_query.data, 'tp:kinh-doanh:ok', 'thả 👍 vào hộp phòng sở hữu nút');
    t.ok(goi2.some(([m, b]) => m === 'editMessageReplyMarkup' && b.reply_markup.inline_keyboard[0][0].callback_data === 'x:cho'), 'nút hiện ⏳ như bấm'); t.ok(!goi2.some(([m]) => m === 'answerCallbackQuery'), 'không trả lời lần bấm giả'); }
  { const so = { 1: { luc: 1000 }, 2: { luc: 5000 } }, P = 60_000;
    t.deepEqual(buocDon(so, 0, 2000), [], 'anh chưa hoạt động → chưa xoá'); t.deepEqual(buocDon(so, 3000, 3000 + 14 * P), [], 'đọc chưa đủ 15 phút');
    t.equal(so[1].doc, 3000, 'mốc đọc = lần hoạt động đầu sau tin'); t.equal(so[2].doc, undefined, 'hoạt động TRƯỚC lúc tin gửi không tính là đọc');
    t.deepEqual(buocDon(so, 3000, 3000 + 15 * P), [1], 'đọc đủ 15 phút → xoá'); t.ok(!so[1] && so[2]);
    t.deepEqual(buocDon(so, 3000, 5000 + 48 * 3600_000), [2], 'quá 47 giờ thì bỏ khỏi sổ'); }
  console.log('tg-phong: tự kiểm đạt');
}
