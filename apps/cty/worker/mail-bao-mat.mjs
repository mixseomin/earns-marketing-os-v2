// THẨM ĐỊNH MAIL BẢO MẬT — Phòng Bảo mật (anh 13/10/2026: "mail từ amazon.in có thật không? thực tế không có contact nào cả").
// Thư "xác nhận liên hệ / đăng nhập mới / đổi mật khẩu / mã OTP / thanh toán" là chỗ kẻ gian ra tay theo HAI đường, máy tách hai đường:
//   (1) THƯ GIẢ: tên người gửi giả nền tảng, link dẫn sang tên miền khác → bắt bằng tên miền THẬT của từng link (gỡ cả link chuyển tiếp ?U=…).
//   (2) THƯ THẬT, YÊU CẦU GIẢ: kẻ gian gọi CSKH / đăng nhập mạo danh, nền tảng gửi thư thật xin chủ duyệt → link đúng mà KHÔNG được bấm Duyệt
//       nếu chủ không tự làm. Máy không biết anh có tự làm không → hỏi đúng câu đó, kèm việc cần làm.
// Nguồn: hòm claude@orit.app (Directus claude_inbox, anh chuyển tiếp thư nghi vấn vào). Thư chuyển tiếp mất header gốc (SPF/DKIM) → kết luận dựa
// trên link, ghi rõ điều đó. Thư đã đọc / lưu trữ trong hòm = việc đã xử (không còn là việc cần người).
//   node worker/mail-bao-mat.mjs            thư bảo mật 30 ngày qua + kết luận (cần DIRECTUS_URL + DIRECTUS_TOKEN — chạy trên box3)
//   node worker/mail-bao-mat.mjs --tu-kiem
const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);
/** Tên miền đăng ký: www.amazon.co.uk → amazon.co.uk · smile.amazon.in → amazon.in. */
export function mienGoc(host) {
  const p = String(host).toLowerCase().replace(/\.$/, '').split('.');
  return p.slice(p.length >= 3 && SLD.has(p.at(-2)) && p.at(-1).length === 2 ? -3 : -2).join('.');
}
/** Nhãn thương hiệu: amazon.co.uk / amazon.in → amazon (cùng một nhà ở nhiều nước). */
const nhan = (mien) => mien.split('.')[0];
/** Nhà thật anh đang có tài khoản — chỉ thư của những nhà này mới được gọi là "thư thật". ponytail: danh sách tay; dùng nền tảng mới thì thêm một
 *  dòng (không có tên ở đây → máy nói "tên miền lạ", không bao giờ nói "thật"). Tên nhái (paypa1, amaz0n) rơi vào nhánh lạ. */
export const NHA = new Set(['amazon', 'google', 'youtube', 'apple', 'icloud', 'paypal', 'etsy', 'gumroad', 'stripe', 'payoneer', 'wise', 'udemy', 'facebook',
  'facebookmail', 'meta', 'instagram', 'tiktok', 'pinterest', 'printables', 'cloudflare', 'hetzner', 'github', 'microsoft', 'mailjet', 'okx', 'telegram', 'x', 'twitter',
  'namecheap', 'examweight']);   // examweight = dự án nhà
/** HỌ TÊN MIỀN của một nhà: link sang miền trong họ không phải "lạ" (thư AdSense thật dùng c.gle — 14/10/2026 bị gắn THƯ GIẢ). */
const HO = { google: ['c.gle', 'goo.gl', 'g.co', 'gstatic.com', 'googleusercontent.com', 'youtube.com', 'withgoogle.com', 'google.com'], amazon: ['a.co', 'amzn.to', 'media-amazon.com', 'amazon.com'],
  facebookmail: ['facebook.com', 'fb.com', 'instagram.com'], facebook: ['fb.com', 'facebookmail.com'], microsoft: ['live.com', 'outlook.com', 'office.com', 'aka.ms'] };
const cungNha = (host, mien) => { const m = mienGoc(host); return nhan(m) === nhan(mien) || (HO[nhan(mien)] ?? []).includes(m); };
// ── SỔ DẠY (anh 14/10/2026 "làm sao trả lời cho Kiên biết site nào không giả, site nào là site nhà"): anh bấm nút dưới tin Telegram hoặc trên
// dòng thư ở cty → tên miền vào một trong ba nhóm. nha = site nhà (thư từ đó là thư thường) · quen = nhà thật có tài khoản (như NHA) · gia = giả,
// thư từ đó luôn là THƯ GIẢ. Một miền chỉ nằm một nhóm (dạy lại thì chuyển nhóm). Nằm ở dữ liệu box, không phải sửa mã.
export const NHOM_DAY = { nha: '🏠 Nhà mình', quen: '✅ Thật, quen', gia: '⛔ Giả' };
const tepDay = () => `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/mien-day.json`;
export async function docDay() { const fs = await import('node:fs'); try { return JSON.parse(fs.readFileSync(tepDay(), 'utf8')); } catch { return { nha: [], quen: [], gia: [] }; } }
/** Dạy một tên miền vào nhóm (nha | quen | gia). Trả sổ mới. */
export async function dayMien(nhom, mien, ai = '') {
  const fs = await import('node:fs'); const m = mienGoc(String(mien)); if (!NHOM_DAY[nhom] || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(m)) throw new Error(`không dạy được "${nhom}" cho "${mien}"`);
  const s = await docDay(); for (const k of Object.keys(NHOM_DAY)) s[k] = (s[k] ?? []).filter((x) => x !== m); s[nhom].push(m);
  (s.lich_su ??= []).push({ luc: new Date().toISOString(), nhom, mien: m, ai }); s.lich_su = s.lich_su.slice(-200);
  const tam = `${tepDay()}.tam`; fs.writeFileSync(tam, JSON.stringify(s, null, 1)); fs.renameSync(tam, tepDay()); return s;
}
/** Kiên chỉ BÁO thư đến từ lúc được bật — thư cũ hơn coi như anh đã thấy (14/10/2026: lần đầu đọc mọi thư lôi 3 thư tháng 9 ra báo). */
export const BAT_TU = '2026-10-13T00:00:00Z';
const LOAI = [
  ['xac-nhan-lien-he', /confirm (that )?you('|’)?re contacting|customer service wants to confirm|approve (or deny|this request)|xác nhận.*liên hệ/i, 'xác nhận liên hệ CSKH'],
  ['dang-nhap', /sign[- ]?in\b|log[- ]?in\b|new device|unrecognized|đăng nhập|thiết bị mới/i, 'đăng nhập'],
  ['mat-khau', /password|reset your|mật khẩu/i, 'mật khẩu'],
  ['otp', /one-time|\bOTP\b|verification code|security code|mã xác (minh|nhận)/i, 'mã xác minh'],
  ['thanh-toan', /payment|billing|card ending|refund|thanh toán/i, 'thanh toán'],
];
export const TEN_LOAI = Object.fromEntries(LOAI.map(([k, , t]) => [k, t]));
const chu = (html) => String(html).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
/** Mọi link (href) → host thật; link chuyển tiếp (tham số mang URL: U, url, u, q, target, redirect) gỡ thêm một lớp. */
export function tachLink(html) {
  const ra = [];
  for (const m of String(html).matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&')); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    ra.push(u.hostname);
    for (const [, v] of u.searchParams) if (/^https?:\/\//i.test(v)) { try { ra.push(new URL(v).hostname); } catch { /* không phải URL */ } }
  }
  return [...new Set(ra)];
}
/** Người gửi THẬT: thư chuyển tiếp → địa chỉ trong khối "From:" của thư gốc; không thì người gửi của thư. */
export function nguoiGui(from, html) {
  const t = chu(html), i = t.search(/Forwarded message|Begin forwarded message|Thư được chuyển tiếp|-----Original Message/i);
  const m = i >= 0 && t.slice(i).match(/(?:From|Từ):[^\n@]*?([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i);
  return { gui: (m ? m[1] : String(from)).toLowerCase(), chuyenTiep: i >= 0 };
}
/** Kết luận một thư: { gui, mien, loai[], links, la (host khác nhà người gửi), ket: 'gia'|'that'|'chua-ro', chu, viec }. */
export function thamDinh({ from, subject = '', html = '' }, day = { nha: [], quen: [], gia: [] }) {
  const { gui, chuyenTiep } = nguoiGui(from, html);
  const mien = gui.includes('@') ? mienGoc(gui.split('@')[1]) : '';
  const tinDuoc = (h) => [...(day.nha ?? []), ...(day.quen ?? [])].includes(mienGoc(h));
  const t = `${subject}\n${chu(html)}`, loai = LOAI.filter(([, re]) => re.test(t)).map(([k]) => k);
  const links = tachLink(html), la = mien ? links.filter((h) => !cungNha(h, mien) && !tinDuoc(h)) : [];
  const dkim = chuyenTiep ? ' (thư chuyển tiếp mất header gốc nên chưa đọc được chữ ký DKIM — kết luận theo link)' : '';
  if (!mien) return { gui, mien, loai, links, la, ket: 'chua-ro', chu: 'Không đọc được địa chỉ người gửi.', viec: 'Không bấm link nào; chuyển tiếp lại thư dạng tệp đính kèm (.eml) để đọc header.' };
  if ((day.gia ?? []).includes(mien)) return { gui, mien, loai, links, la, ket: 'gia', chu: `THƯ GIẢ: anh đã dạy Kiên ${mien} là tên miền giả.`, viec: 'Không bấm link, không nhập gì; xoá thư.' };
  if ((day.nha ?? []).includes(mien)) return { gui, mien, loai, links, la, ket: 'thuong', chu: `Thư từ site nhà (${mien}, anh đã dạy Kiên).`, viec: 'Không cần làm gì.' };
  if (la.length) return { gui, mien, loai, links, la, ket: 'gia', chu: `THƯ GIẢ: mang tên ${mien} nhưng link dẫn sang ${la.slice(0, 3).join(', ')}.`, viec: 'Không bấm link, không nhập gì; xoá thư. Đã lỡ bấm/nhập → đổi mật khẩu ngay trên trang thật (gõ tay địa chỉ) + bật xác minh 2 lớp.' };
  if (!loai.length) return { gui, mien, loai, links, la, ket: 'thuong', chu: 'Không có dấu hiệu bảo mật (không đòi xác nhận, đăng nhập, mật khẩu, mã, thanh toán; không link lạ).', viec: 'Không cần làm gì.' };   // Kiên đọc MỌI thư (anh 14/10/2026), thư thường chỉ ghi nhận
  if (!NHA.has(nhan(mien)) && !(day.quen ?? []).includes(mien)) return { gui, mien, loai, links, la, ket: 'chua-ro', chu: `Tên miền ${mien} không phải nhà anh có tài khoản (worker/mail-bao-mat.mjs NHA) — tên nhái hay gặp.`, viec: 'Coi như giả: không bấm link, không trả lời. Là site nhà / nhà quen thì bấm 🏠 hoặc ✅ để dạy Kiên.' };
  if (!links.length) return { gui, mien, loai, links, la, ket: 'chua-ro', chu: `Thư mang tên ${mien}, không có link để đối chiếu${dkim}.`, viec: 'Không trả lời thư; kiểm thẳng trên trang thật (gõ tay địa chỉ).' };
  const yeuCau = loai.some((k) => ['xac-nhan-lien-he', 'dang-nhap', 'mat-khau', 'otp'].includes(k));
  return { gui, mien, loai, links, la, ket: 'that', chu: `Thư thật của ${mien}: mọi link về ${[...new Set(links.map(mienGoc))].join(', ')}${dkim}.`,
    viec: yeuCau ? `Anh KHÔNG tự làm việc này (${loai.map((k) => TEN_LOAI[k]).join(', ')}) → có người mạo danh: KHÔNG bấm Approve/Duyệt (bấm Deny nếu có), đổi mật khẩu + bật xác minh 2 lớp trên ${mien} (gõ tay địa chỉ, không qua link thư), xem "thiết bị đã đăng nhập".`
      : 'Thư thông báo, không đòi duyệt gì — đọc rồi lưu trữ.' };
}

// Đọc hòm: MỌI thư 30 ngày → kết luận (thư thường = ket 'thuong'). Lỗi đọc trả null (trang hiện lỗi, không giấu thành "không có thư").
export async function docMailBaoMat({ ngay = 30, url = process.env.DIRECTUS_URL, token = process.env.DIRECTUS_TOKEN } = {}) {
  if (!url || !token) return null;
  const tu = new Date(Date.now() - ngay * 86_400_000).toISOString();
  const q = new URLSearchParams({ limit: '200', sort: '-captured_at', fields: 'id,from_addr,from_name,subject,body_html,captured_at,status',
    filter: JSON.stringify({ captured_at: { _gte: tu } }) });   // MỌI thư (anh 14/10/2026) — thư thường ra ket 'thuong'
  try {
    const day = await docDay();
    const r = await fetch(`${url}/items/claude_inbox?${q}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return (await r.json()).data.map((m) => ({ id: m.id, luc: m.captured_at, tieuDe: String(m.subject ?? '').replace(/^(fwd?|tr|chuyển tiếp):\s*/i, ''), xong: m.status !== 'new',
      ...thamDinh({ from: m.from_addr, subject: m.subject, html: m.body_html }, day) }));
  } catch { return null; }
}

// ── NHỊP CỦA NGƯỜI PHỤ TRÁCH (worker/nhip.mjs gọi mỗi phút, anh bật 13/10/2026 "hệ thống phải tự làm việc, không phải nhắc mới làm"):
// thư bảo mật chưa xử → MỘT tin vào nhóm Telegram MINE, topic "🔐 Bảo mật" (bot tự tạo topic lần đầu); thư đã xử (đọc / lưu trữ trong hòm)
// → thả ❤ rồi 1 phút sau xoá tin; còn thư chờ → người phụ trách "chờ người" trên văn phòng pixel. Câu báo theo khuôn: 0 tiền mô hình.
const CTY = 'https://cty.on.tc/?dc=mail&ngan=phong%3Aan-toan-tk';
const XOA_SAU = 60_000;
const NOM_CHU = { nha: 'site nhà', quen: 'nhà thật, quen', gia: 'giả' };
/** Ba nút dạy dưới mỗi tin báo (cùng ba nút trên dòng thư ở cty). */
export const nutDay = (mien) => (mien ? { inline_keyboard: [Object.entries(NHOM_DAY).map(([k, t]) => ({ text: `${t}: ${mien}`.slice(0, 60), callback_data: `km:${k}:${mien}`.slice(0, 64) }))] } : undefined);
const KET_CHU = { gia: '⛔ THƯ GIẢ', that: '⚠️ Thư thật — xem kỹ yêu cầu', 'chua-ro': '❓ Chưa rõ — coi như giả', thuong: '✅ Không có dấu hiệu bảo mật' };
/** Tin "đã đọc" cho thư GỌI TÊN người phụ trách mà không phải thư bảo mật (anh gửi "Kiên check mail" mà không thấy gì, 14/10/2026). */
export const tinDaDoc = (m, ten) => `📨 <b>${esc(ten)}</b> đã đọc thư <i>${esc(m.tieuDe)}</i> (${esc(m.gui)}) — ${esc(m.chu)} ${esc(m.viec)}\n<a href="${CTY}">↗ cty · Bảo mật › Mail bảo mật</a>`;
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Tin báo: lời của người phụ trách (mô hình viết, có thể rỗng) + kết luận và việc NGUYÊN VĂN của máy (mô hình không được sửa). */
export const tinBao = (m, ten, loi = '') => `🔐 <b>${esc(ten)} · ${esc(m.mien || m.gui)}</b> — ${KET_CHU[m.ket]}\n${loi ? `${esc(loi)}\n` : ''}<i>${esc(m.tieuDe)}</i>\n${esc(m.chu)}\n<b>Việc:</b> ${esc(m.viec)}\nXử xong thì lưu trữ thư trong hòm, tin tự gỡ.\n<a href="${CTY}">↗ cty · Bảo mật › Mail bảo mật</a>`;   // anh 13/10/2026: tin Telegram nào cũng kết bằng MỘT link nhỏ mở thẳng việc / phòng trên cty
/** Lời mở của người phụ trách qua proxy công ty (worker/proxy.mjs — ghi tiền, trần chi). Lỗi → '' (tin vẫn đi bằng khuôn). */
async function loiMo(nguoi, model, m, phong) {
  if (!model) return '';
  const body = { model, max_tokens: 160, temperature: 0.3, system: 'Bạn là Kiên, trưởng phòng Bảo mật. Viết cho Giám đốc (gọi là "anh") 1–2 câu tiếng Việt ngắn, bình tĩnh: chuyện gì đang xảy ra và câu cần anh trả lời. Không lặp lại danh sách việc, không bịa chi tiết ngoài dữ kiện.',
    messages: [{ role: 'user', content: `Thư: ${m.tieuDe}\nNgười gửi: ${m.gui}\nMáy kết luận: ${m.chu}\nViệc máy đề xuất: ${m.viec}` }] };
  try {
    const r = await fetch(`${process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862'}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': nguoi, 'x-cty-luot': `nhip-${Date.now()}`, ...(phong ? { 'x-cty-phong': phong } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const d = await r.json(); if (!r.ok) { console.error(`✗ ${model}: ${r.status} ${JSON.stringify(d).slice(0, 200)}`); return ''; }
    return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim().slice(0, 400);
  } catch (e) { console.error(`✗ ${model}: ${e.message}`); return ''; }
}
/** Một nhịp, thuần: st = { tin: { mailId: { id, xong? } } }, ds = thư (null = không đọc được → không đụng gì). Trả việc phải làm + st mới. */
export function buocTin(st, ds, gio, ten = '') {
  const tin = { ...(st.tin ?? {}) }, gui = [], tha = [], xoa = [], daDoc = [];
  if (!ds) return { gui, tha, xoa, daDoc, st };
  const goi = ten && new RegExp(ten.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'i');
  const da = new Set(st.da ?? []);
  for (const m of ds) {
    if (m.luc && m.luc < BAT_TU) continue;
    if (m.ket !== 'thuong') { if (!m.xong && !tin[m.id]) gui.push(m); }
    else if (goi && !da.has(m.id) && goi.test(String(m.tieuDe).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) daDoc.push(m);   // thư gọi tên → báo "đã đọc" một lần
  }
  for (const [mid, t] of Object.entries(tin)) {
    const m = ds.find((x) => x.id === mid);
    // hết là việc (đã xử / thẩm định lại thành thư thường / thư trước khi bật) → ❤ rồi gỡ
    if (!t.xong && (!m || m.xong || m.ket === 'thuong' || (m.luc && m.luc < BAT_TU))) { tha.push(t.id); tin[mid] = { ...t, xong: new Date(gio).toISOString() }; }
    else if (t.xong && gio - Date.parse(t.xong) >= XOA_SAU) { xoa.push(t.id); delete tin[mid]; }
  }
  return { gui, tha, xoa, daDoc, st: { ...st, tin, da: [...da, ...daDoc.map((m) => m.id)].slice(-300) }, cho: ds.filter((m) => !m.xong && m.ket !== 'thuong' && !(m.luc && m.luc < BAT_TU)).length };
}
/** Nhịp thật (box3): đọc hòm → Telegram + pixel. env: DIRECTUS_*, TG_BOT_TOKEN, TG_CHAT (/root/.secrets/mine-tg.env). */
export async function nhipBaoMat(nguoi, { ten = nguoi, model = '', phong = '', tep = `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/bao-mat-tg.json` } = {}) {
  const fs = await import('node:fs'); const { vpBao } = await import('./vp.mjs');
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  const tg = async (m, b) => { const j = await (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(15000) })).json(); if (!j.ok) console.error(`✗ telegram ${m}: ${j.description}`); return j; };
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  // nút anh bấm dưới tin (callback "km:<nhóm>:<miền>") → dạy sổ TRƯỚC khi đọc hòm, để nhịp này thẩm định lại theo điều vừa dạy
  let day = 0; const u = await tg('getUpdates', { offset: st.upd ?? 0, timeout: 0, allowed_updates: ['callback_query'] });
  for (const x of u.ok ? u.result : []) {
    st.upd = x.update_id + 1; const c = x.callback_query; const [, nhom, mien] = String(c?.data ?? '').split(':');
    if (!c || !String(c.data).startsWith('km:')) continue;
    try { await dayMien(nhom, mien, c.from?.username ?? String(c.from?.id ?? '')); day++; await tg('answerCallbackQuery', { callback_query_id: c.id, text: `${ten} đã nhớ: ${mien} = ${NOM_CHU[nhom] ?? nhom}` }); }
    catch (e) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: e.message, show_alert: true }); }
  }
  const ds = await docMailBaoMat(); if (!ds) console.error('✗ không đọc được hòm claude@orit.app');
  const b = buocTin(st, ds, Date.now(), ten); st = b.st;
  if ((b.gui.length || b.daDoc.length) && !st.topic) { const j = await tg('createForumTopic', { name: '🔐 Bảo mật' }); if (j.ok) st.topic = j.result.message_thread_id; }
  for (const m of b.gui) {
    await vpBao(nguoi, 'lam', `báo thư ${m.mien}`);
    const j = await tg('sendMessage', { message_thread_id: st.topic, text: tinBao(m, ten, await loiMo(nguoi, model, m, phong)), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: nutDay(m.mien) });
    if (j.ok) st.tin[m.id] = { id: j.result.message_id, nut: 1 }; st.vp = 'lam';
  }
  // tin gửi trước khi có nút (vd amazon.in 13/10) → gắn thêm ba nút dạy một lần
  for (const [mid, t] of Object.entries(st.tin ?? {})) { const m = ds?.find((x) => x.id === mid); if (m && !t.nut && !t.xong && (await tg('editMessageReplyMarkup', { message_id: t.id, reply_markup: nutDay(m.mien) })).ok) t.nut = 1; }
  for (const m of b.daDoc) await tg('sendMessage', { message_thread_id: st.topic, text: tinDaDoc(m, ten), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  for (const id of b.tha) await tg('setMessageReaction', { message_id: id, reaction: [{ type: 'emoji', emoji: '❤' }] });
  for (const id of b.xoa) await tg('deleteMessage', { message_id: id });
  const vp = b.cho ? 'cho' : 'xong';   // người phụ trách: còn thư chờ → "chờ người" trên pixel; hết → về ghế (chỉ báo khi đổi)
  if (ds && st.vp !== vp) { await vpBao(nguoi, vp, `${b.cho} thư bảo mật`); st.vp = vp; }
  fs.writeFileSync(`${tep}.tam`, JSON.stringify(st)); fs.renameSync(`${tep}.tam`, tep);
  return `${day ? `${day} lần anh dạy · ` : ''}${ds ? ds.length : '?'} thư đã đọc · ${b.gui.length} báo · ${b.daDoc.length} trả lời · ${b.tha.length} ❤ · ${b.xoa.length} gỡ · ${b.cho ?? '?'} thư chờ`;
}

if (process.argv[1]?.endsWith('mail-bao-mat.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  a.equal(mienGoc('www.amazon.co.uk'), 'amazon.co.uk'); a.equal(mienGoc('smile.amazon.in'), 'amazon.in'); a.equal(mienGoc('amazon-in.verify-acct.top'), 'verify-acct.top');
  // thư thật amazon.in 13/10/2026 (anh chuyển tiếp từ iPhone): link qua bộ chuyển tiếp gp/f.html, đích thật nằm ở tham số U
  const THAT = '<div>Begin forwarded message:</div><b>From:</b> "amazon.in" &lt;account-update@amazon.in&gt;<br>Subject: amazon.in: Account confirmation request<br>'
    + 'Amazon Customer Service wants to confirm you\'re contacting us. To confirm it\'s you, approve this request'
    + '<a href="https://www.amazon.in/gp/f.html?C=1&amp;U=https%3A%2F%2Fwww.amazon.in%2Fa%2Fc%2Fr%2F8Y%3Fref_%3Dpe">Approve</a><a href="https://www.amazon.in/gp/r.html?U=https%3A%2F%2Fwww.amazon.in">x</a>';
  const t = thamDinh({ from: 'htuan82@gmail.com', subject: 'Fwd: amazon.in: Account confirmation request', html: THAT });
  a.equal(t.gui, 'account-update@amazon.in'); a.equal(t.ket, 'that'); a.ok(t.loai.includes('xac-nhan-lien-he')); a.match(t.viec, /KHÔNG bấm Approve/); a.match(t.chu, /DKIM/);
  // thư giả: cùng tên, link gỡ ra dẫn sang tên miền lạ (kể cả giấu trong tham số chuyển tiếp)
  const GIA = THAT.replace('https%3A%2F%2Fwww.amazon.in%2Fa%2Fc', 'https%3A%2F%2Famazon-in.verify-acct.top%2Fa%2Fc');
  const g = thamDinh({ from: 'htuan82@gmail.com', subject: 'Fwd: amazon.in', html: GIA }); a.equal(g.ket, 'gia'); a.deepEqual(g.la, ['amazon-in.verify-acct.top']);
  a.equal(thamDinh({ from: 'no-reply@accounts.google.com', html: '<a href="https://accounts.google.com/x">Check activity</a> New sign-in on Mac' }).ket, 'that');   // thư gửi thẳng (không chuyển tiếp)
  a.equal(thamDinh({ from: 'security@paypa1-support.com', html: '<a href="https://paypa1-support.com/login">Confirm</a> unusual sign-in' }).ket, 'chua-ro');   // tên miền nhái, link cùng nhà nhái → không bao giờ "thật"
  a.equal(thamDinh({ from: 'x', html: '' }).ket, 'chua-ro');
  const m1 = { id: 'a', xong: false, mien: 'amazon.in', gui: 'x@amazon.in', ket: 'that', tieuDe: 'A <b>', chu: 'c', viec: 'v' };
  const th = { id: 't', xong: false, mien: 'gmail.com', gui: 'a@gmail.com', ket: 'thuong', tieuDe: 'Kiên check mail', chu: 'c', viec: 'v' };
  const bk = buocTin({}, [th, { ...th, id: 'u', tieuDe: 'GSC report' }], 0, 'Kiên'); a.deepEqual(bk.daDoc.map((m) => m.id), ['t'], 'thư gọi tên Kiên (kể cả không dấu) → trả lời; thư thường khác → im'); a.equal(bk.cho, 0);
  a.equal(buocTin(bk.st, [th], 1, 'Kiên').daDoc.length, 0, 'trả lời một lần');
  a.equal(thamDinh({ from: 'htuan82@gmail.com', subject: 'Kiên check mail', html: '<p>hi</p>' }).ket, 'thuong');
  a.notEqual(thamDinh({ from: 'adsense-noreply@google.com', subject: 'fix issues', html: '<a href="https://c.gle/abc">x</a>' }).ket, 'gia', 'link c.gle trong thư Google không phải lạ');
  a.equal(buocTin({}, [{ ...m1, luc: '2026-09-26T04:30:00Z' }], 0).gui.length, 0, 'thư trước khi bật không báo');
  const tep = { from: 'support@examweight.com', subject: 'login to continue', html: '<a href="https://examweight.com/x">x</a>' };
  a.equal(thamDinh(tep, { nha: ['examweight.com'] }).ket, 'thuong', 'site nhà → thư thường');
  a.equal(thamDinh({ from: 'a@shop-xyz.top', subject: 'sign in', html: '<a href="https://shop-xyz.top">x</a>' }, { quen: ['shop-xyz.top'] }).ket, 'that', 'nhà quen → thư thật');
  a.equal(thamDinh({ from: 'billing@amazon.in', subject: 'hi', html: '' }, { gia: ['amazon.in'] }).ket, 'gia', 'anh dạy giả → luôn giả');
  a.equal(nutDay('amazon.in').inline_keyboard[0].length, 3); a.ok(nutDay('amazon.in').inline_keyboard[0].every((b) => b.callback_data.length <= 64));
  const b1 = buocTin({}, [m1], 0); a.deepEqual(b1.gui.map((m) => m.id), ['a']); a.equal(b1.cho, 1);
  const s1 = { tin: { a: { id: 7 } } }; a.equal(buocTin(s1, [m1], 1).gui.length, 0, 'đã báo thì không báo lại');
  a.equal(buocTin(s1, null, 1).st, s1, 'không đọc được hòm → không đụng tin nào');
  const b2 = buocTin(s1, [{ ...m1, xong: true }], 1000); a.deepEqual(b2.tha, [7]); a.equal(b2.cho, 0);
  a.deepEqual(buocTin(b2.st, [{ ...m1, xong: true }], 1000 + 30_000).xoa, [], 'thả tim xong chưa đủ 1 phút → chưa xoá');
  const b3 = buocTin(b2.st, [{ ...m1, xong: true }], 1000 + 60_000); a.deepEqual(b3.xoa, [7]); a.deepEqual(b3.st.tin, {});
  a.match(tinBao(m1, 'Kiên'), /A &lt;b&gt;/, 'tiêu đề thư được thoát HTML'); a.match(tinBao(m1, 'Kiên'), /<a href="https:\/\/cty\.on\.tc\/[^"]+">[^<]+<\/a>$/, 'dòng cuối là link mở thẳng trên cty');
  console.log('✓ mail-bao-mat: 12 ca đạt (tên miền đăng ký, gỡ link chuyển tiếp, người gửi thư chuyển tiếp, thư thật yêu cầu giả, thư giả, tên miền nhái, không đọc được người gửi) + 8 ca nhịp báo (báo một lần, hòm lỗi không đụng, ❤ rồi gỡ sau 1 phút, thoát HTML)');
}
if (process.argv[1]?.endsWith('mail-bao-mat.mjs') && !process.argv.includes('--tu-kiem')) {
  const ds = await docMailBaoMat();
  if (!ds) { console.error('✗ không đọc được hòm (thiếu DIRECTUS_URL / DIRECTUS_TOKEN hoặc Directus lỗi)'); process.exit(1); }
  for (const m of ds) console.log(`${m.luc.slice(0, 16)} ${m.xong ? '✓ đã xử' : '● chờ'} [${m.ket}] ${m.tieuDe}\n   ${m.chu}\n   → ${m.viec}`);
  console.log(`${ds.length} thư đã đọc 30 ngày qua · ${ds.filter((m) => m.ket !== 'thuong').length} thư bảo mật`);
}
