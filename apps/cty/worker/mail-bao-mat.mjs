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
/** Chữ anh trả lời → nhóm dạy. "Thật" = thư thật từ nhà quen; "Giả"; "Nhà mình". */
export const nhomTuChu = (t) => { const x = String(t).trim().toLowerCase(); const het = '(?=$|[\\s,.!])';   // \\b của JS không coi chữ có dấu (ả, ậ) là chữ → 'Giả' trượt
  return new RegExp(`^(nh[aà] m[iì]nh|nha)${het}`).test(x) ? 'nha' : new RegExp(`^(th[aậ]t|real|that|đúng)${het}`).test(x) ? 'quen' : new RegExp(`^(gi[aả]|fake|gia)${het}`).test(x) ? 'gia' : null; };
// NGƯỜI PHỤ TRÁCH theo tên miền gửi (anh 19/10/2026: "mail Etsy yêu cầu rà soát policy quan trọng mày báo cho con nào phụ trách xử lý"):
// thư THẬT từ nền tảng có tài khoản của một phòng → giao đúng trưởng phòng đó, ngay dưới tin báo. Thêm nền tảng = thêm một dòng.
export const PHU_TRACH_MIEN = { 'etsy.com': 'thao', 'amazon.com': 'thao', 'kdp.amazon.com': 'thao', 'gumroad.com': 'thao', 'google.com': 'lan', 'ads.google.com': 'lan' };
export const phuTrachMien = (mien) => { const m = String(mien || '').toLowerCase(); const k = Object.keys(PHU_TRACH_MIEN).filter((d) => m === d || m.endsWith(`.${d}`)).sort((a, b) => b.length - a.length)[0]; return k ? PHU_TRACH_MIEN[k] : null; };
/** Chuyển thư thật vào PHÒNG phụ trách (anh 19/10/2026: "Kiên đọc mail xong phải biết forward vào phòng liên quan"): tin đầy đủ vào chủ đề Telegram
 *  của phòng đó (tạo nếu chưa có) + một dòng dưới tin báo ở 🔐 Bảo mật + nhật ký người phụ trách. Trả true khi đã chuyển. */
/** Trưởng phòng của một phòng (nhân sự cùng phòng, chức danh "Trưởng…"; không có thì người đầu tiên của phòng). */
export async function truongPhong(ph) {
  const fs = await import('node:fs'), path = await import('node:path'); const { GOC } = await import('./goc.mjs'); const d = path.join(GOC, 'cong-ty', 'nhan-su');
  const ds = fs.readdirSync(d).map((id) => { try { const t = fs.readFileSync(path.join(d, id, 'SOUL.md'), 'utf8'); return { id, phong: t.match(/^phong:\s*(\S+)/m)?.[1], cd: t.match(/^chuc_danh:\s*(.+)$/m)?.[1] ?? '' }; } catch { return null; } }).filter((x) => x?.phong === ph);
  return (ds.find((x) => /^Trưởng/i.test(x.cd)) ?? ds[0])?.id ?? null;
}
/** Người nhận thư: phòng não chọn → trưởng phòng; không có thì bảng PHU_TRACH_MIEN theo tên miền. */
export const nguoiNhanThu = async (mail) => (mail.phong && mail.phong !== 'an-toan-tk' ? await truongPhong(mail.phong) : null) ?? phuTrachMien(mail.mien);
/** Nút "↪️ Sai phòng" dưới thư Kiên chuyển (anh 19/10/2026: "fw sang sai phòng thì làm sao để thông tin về đúng vị trí"). */
export const nutSai = (id) => ({ inline_keyboard: [[{ text: '↪️ Sai phòng', callback_data: `kc:?:${String(id).slice(0, 8)}` }]] });
/** Bảng chọn phòng đúng (mọi phòng trong cong-ty/phong), 2 nút một hàng + Huỷ. */
export async function bangPhong(id8) {
  const path = await import('node:path'); const fs = await import('node:fs'); const { GOC } = await import('./goc.mjs'); const d = path.join(GOC, 'cong-ty', 'phong');
  const nut = fs.readdirSync(d).filter((f) => f.endsWith('.md')).map((f) => { const ten = (fs.readFileSync(path.join(d, f), 'utf8').match(/^ten:\s*(.+)$/m)?.[1] ?? f).replace(/^Phòng\s+/, '').replace(/\s*\(.*\)$/, '').trim();
    return { text: ten.slice(0, 28), callback_data: `kc:${f.slice(0, -3)}:${id8}`.slice(0, 64) }; });
  const hang = []; for (let i = 0; i < nut.length; i += 2) hang.push(nut.slice(i, i + 2));
  return { inline_keyboard: [...hang, [{ text: '✖ Huỷ', callback_data: `kc:x:${id8}` }]] };
}
/** Anh chỉ phòng đúng → ghi sổ học (mô hình đọc làm ví dụ; thư cùng người gửi + cùng tiêu đề đi thẳng phòng này). */
export function hocChuyen(mail, phong, ai = '', chiTiet = {}) {
  const h = docHoc(), dong = { luc: new Date().toISOString(), id: mail.id, mien: mail.mien, gui: mail.gui, tieuDe: mail.tieuDe, tu: mail.phong ?? null, phong, ai, ...chiTiet };
  h.push(dong);
  // nhật ký người phụ trách (ngăn Nhật ký trên cty) — dùng lại khi rà Kiên chia sai bao nhiêu, sai kiểu gì
  try { const d = `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/nhip`; _fs.mkdirSync(d, { recursive: true }); _fs.appendFileSync(`${d}/kien.jsonl`, JSON.stringify({ luc: dong.luc, viec: 'chuyen-lai', ket: `${ai} chuyển lại ${mail.mien} · ${mail.tieuDe}: ${dong.tu ?? '?'} → ${phong}${chiTiet.xoa_ok ? ' · đã xoá tin sai' : ''}` }) + '\n'); } catch { /* nhật ký hỏng: sổ học vẫn ghi */ }
  _fs.writeFileSync(`${tepHoc()}.tam`, JSON.stringify(h.slice(-200), null, 1)); _fs.renameSync(`${tepHoc()}.tam`, tepHoc());
}
/** Ghi một lần chuyển vào trạng thái nhịp: st.chuyen (đã chuyển) + st.chuyenTin (mã tin để sửa / xoá về sau). */
export const ghiChuyen = (st, id, kq) => { if (!kq) return; (st.chuyen ??= {})[id] = kq.luc; (st.chuyenTin ??= {})[id] = kq; };
export async function giaoPhuTrach(tg, topic, mail, ten, goc) {
  const ai = await nguoiNhanThu(mail); const fs = await import('node:fs'), path = await import('node:path'); const { GOC } = await import('./goc.mjs');
  if (!ai) { await tg('sendMessage', { message_thread_id: topic, ...(goc ? { reply_parameters: { message_id: goc, allow_sending_without_reply: true } } : {}), parse_mode: 'HTML', text: `📌 Thư thật từ <b>${esc(mail.mien)}</b> nhưng chưa có phòng phụ trách tên miền này (PHU_TRACH_MIEN trong mail-bao-mat.mjs) — anh chỉ định giúp em.` }); return false; }
  const doc = (...p) => fs.readFileSync(path.join(GOC, 'cong-ty', ...p), 'utf8'), fm = (t, k) => t.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim();
  const soul = doc('nhan-su', ai, 'SOUL.md'), ph = fm(soul, 'phong'), tenPh = fm(doc('phong', `${ph}.md`), 'ten').replace(/^Phòng\s+/, '').replace(/\s*\(.*\)$/, ''), tenAi = `${fm(soul, 'ten')} [${tenPh}]`;
  const { topicPhong } = await import('./tg-phong.mjs'); const tp = await topicPhong(ph, `📂 ${tenPh}`, tg);
  // phòng CHƯA có chủ đề: không tự tạo — thư hiện ngay ở 🔐 Bảo mật (không mất) + nút hỏi anh có tạo chủ đề cho phòng không
  const noi = tp ?? topic;
  const j = await tg('sendMessage', { message_thread_id: noi, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: nutSai(mail.id),
    text: `📨 <b>${esc(ten)} [Bảo mật]</b> chuyển thư cho <b>${esc(tenAi)}</b> xử lý\n<b>${esc(mail.tieuDe)}</b> — ${esc(mail.gui)}\n${esc(mail.chu)}\n<b>Việc:</b> ${esc(mail.viec)}\nThư gốc trong hòm claude@orit.app; xử xong thì lưu trữ thư.` });
  if (!tp) await tg('sendMessage', { message_thread_id: topic, parse_mode: 'HTML', text: `📂 Phòng <b>${esc(tenPh)}</b> chưa có chủ đề Telegram — em không tự tạo. Anh cho tạo không?`,
    reply_markup: { inline_keyboard: [[{ text: `✅ Tạo chủ đề ${tenPh}`.slice(0, 40), callback_data: `tp:${ph}:ok`.slice(0, 64) }, { text: '✖ Không, để ở Bảo mật', callback_data: `tp:${ph}:no`.slice(0, 64) }]] } });
  const b = !tp ? { ok: false } : await tg('sendMessage', { message_thread_id: topic, ...(goc ? { reply_parameters: { message_id: goc, allow_sending_without_reply: true } } : {}), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: nutSai(mail.id),
    text: j.ok ? `📌 Thư thật từ <b>${esc(mail.mien)}</b> — đã chuyển vào chủ đề 📂 ${esc(tenPh)}, giao <b>${esc(tenAi)}</b> xử lý.` : `⚠️ Thư thật từ <b>${esc(mail.mien)}</b> — chuyển vào phòng ${esc(tenPh)} KHÔNG được (Telegram lỗi), giao <b>${esc(tenAi)}</b>.` });
  try { const d = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'nhip'); fs.mkdirSync(d, { recursive: true }); fs.appendFileSync(path.join(d, `${ai}.jsonl`), JSON.stringify({ luc: new Date().toISOString(), viec: 'thu-giao', ket: `${ten} chuyển: ${mail.mien} · ${mail.tieuDe}` }) + '\n'); } catch { /* nhật ký hỏng: tin Telegram vẫn đi */ }
  // HÀNG VIỆC CỦA PHÒNG NHẬN (<DATA>/phong-thu/<phòng>/<mail>.json): người phụ trách có máy chạy (vd Vân, may/van-thu.mjs) lấy thư ở đây mà làm việc tiếp theo
  if (j.ok) try { const dq = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'phong-thu', ph); fs.mkdirSync(dq, { recursive: true });
    fs.writeFileSync(path.join(dq, `${mail.id}.json`), JSON.stringify({ id: mail.id, phong: ph, ai, mien: mail.mien, gui: mail.gui, tieuDe: mail.tieuDe, chu: mail.chu, viec: mail.viec, than: mail.than ?? '', tin: j.result.message_id, luc: new Date().toISOString() }, null, 1)); } catch { /* hàng việc hỏng: tin Telegram vẫn đi */ }
  // trả MÃ TIN để lần anh sửa phòng xoá đúng tin ở phòng sai + sửa dòng 📌 (anh 20/10/2026)
  return j.ok ? { phong: ph, ai, idPhong: j.result.message_id, idBm: b.ok ? b.result.message_id : null, luc: new Date().toISOString() } : false;
}
const tepDay = () => `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/mien-day.json`;
export async function docDay() { const fs = await import('node:fs'); try { return JSON.parse(fs.readFileSync(tepDay(), 'utf8')); } catch { return { nha: [], quen: [], gia: [] }; } }
/** Dạy một tên miền vào nhóm (nha | quen | gia). Trả sổ mới. */
export async function dayMien(nhom, mien, ai = '') {
  const fs = await import('node:fs'); const m = mienGoc(String(mien)); if (!NHOM_DAY[nhom] || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(m)) throw new Error(`không dạy được "${nhom}" cho "${mien}"`);
  const s = await docDay(); for (const k of Object.keys(NHOM_DAY)) s[k] = (s[k] ?? []).filter((x) => x !== m); s[nhom].push(m);
  (s.lich_su ??= []).push({ luc: new Date().toISOString(), nhom, mien: m, ai }); s.lich_su = s.lich_su.slice(-200);
  const tam = `${tepDay()}.tam`; fs.writeFileSync(tam, JSON.stringify(s, null, 1)); fs.renameSync(tam, tepDay());
  // điều được dạy = bài học của CHÍNH người phụ trách (hồ sơ › Kinh nghiệm), không chỉ một dòng trong sổ máy
  const { dangBat } = await import('./nhip.mjs'); const ng = dangBat().find((n) => n.viec.includes('mail-bao-mat'));
  if (ng) (await import('./kinh-nghiem.mjs')).ghiDuocDay(ng.id, 'an-toan-tk/tham-dinh-mail-bao-mat', m, `${m} = ${NOM_CHU[nhom]}: ${SAU_DAY[nhom]}`, ai);
  return s;
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
    // lớp bọc chuyển hướng của Google (google.com/url?q=…): Gmail bọc MỌI link khi anh chuyển tiếp thư → chỉ xét link thật bên trong, không tính
    // google.com là tên miền lạ (19/10/2026: thư Etsy Trust & Safety thật bị kết luận GIẢ vì "link dẫn sang www.google.com")
    // + Gmail tự biến địa chỉ bưu điện ở chân thư thành link Google Maps (…/maps/search/…?entry=gmail) — thư Etsy 19/10 bị gắn giả vì đúng cái này
    const gmailThem = /^(www\.)?google\.[a-z.]+$/i.test(u.hostname) && (u.pathname === '/url' || u.searchParams.get('entry') === 'gmail');
    if (!gmailThem) ra.push(u.hostname);
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

// ── NÃO CỦA KIÊN (anh 19/10/2026: "làm sao cho thằng này có sẵn não"): luật cứng ở thamDinh vỡ với thứ không lường trước (link Gmail tự gắn vào
// địa chỉ chân thư → thư Etsy thật bị gắn GIẢ). Giờ MÔ HÌNH đọc thư và kết luận thật/giả, phòng nào nhận, việc gì; máy chỉ giữ CHỐT AN TOÀN mô hình
// không được vượt: tên miền anh dạy giả → giả · anh dạy site nhà → thường · link NHÁI tên hãng (amazon-in.verify-acct.top) → giả.
// Mỗi thư gọi mô hình MỘT lần, lưu <DATA>/mail-nao.json; anh dạy thêm (lich_su dài ra) thì chấm lại. Chỉ chấm thư đang chờ (chưa xử, sau BAT_TU).
const tepNao = () => `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/mail-nao.json`;
function docNao(day) { try { const n = JSON.parse(require_fs().readFileSync(tepNao(), 'utf8')); const k = (day.lich_su ?? []).length; return Object.fromEntries(Object.entries(n).filter(([, v]) => v.day === k)); } catch { return {}; } }
let _fs = null, _goc = ''; const require_fs = () => _fs;   // fs nạp một lần ở đầu nhịp / docMailBaoMat (tệp ESM không có require)
/** Link nhái tên hãng: host chứa tên hãng của người gửi mà KHÔNG cùng nhà (amazon-in.verify-acct.top khi người gửi amazon.in). */
export const linkNhai = (x) => (x.mien ? (x.la ?? []).filter((h) => h.toLowerCase().includes(nhan(x.mien)) && !cungNha(h, x.mien)) : []);
// PHÒNG ĐANG CHỜ THƯ (anh 19/10/2026: "các phòng chờ thông tin thì phải có chỗ cho Kiên biết mà phân loại"): mỗi phòng tự khai trong
// cong-ty/phong/<phòng>.md, phần đầu tệp, một dòng một thứ: `cho_thu: <mẫu> | <lý do>`. + SỔ HỌC CHUYỂN PHÒNG (<DATA>/mail-hoc-phong.json, anh bấm "↪️ Sai phòng" là ghi):
// hai nguồn chỉ đường mà mô hình không được cãi — người đang chờ thư thì nhận thư; anh đã sửa một thư cùng người gửi + cùng tiêu đề thì đi đúng chỗ anh sửa.
/** Mọi dòng `cho_thu:` trong phần đầu các tệp phòng → [{ mau, ly_do, phong }]. */
export function docChoThu() {
  const d = `${_goc}/cong-ty/phong`; let ds = []; try { ds = _fs.readdirSync(d).filter((f) => f.endsWith('.md')); } catch { return []; }
  return ds.flatMap((f) => { const dau = (_fs.readFileSync(`${d}/${f}`, 'utf8').match(/^---\n([\s\S]*?)\n---/) ?? [, ''])[1];
    return [...dau.matchAll(/^cho_thu:\s*(.+)$/gm)].map(([, v]) => { const [mau, ...ly] = v.split(' | '); return { mau: mau.trim(), ly_do: ly.join(' | ').trim(), phong: f.slice(0, -3) }; }); });
}
export function choThu(x, ds = null) {
  ds ??= docChoThu();
  const t = `${x.gui ?? ''}\n${x.tieuDe ?? ''}\n${String(x.than ?? '').slice(0, 800)}`;
  return ds.find((c) => { try { return new RegExp(c.mau, 'i').test(t); } catch { return false; } }) ?? null;
}
const tepHoc = () => `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/mail-hoc-phong.json`;
export function docHoc() { try { return JSON.parse(_fs.readFileSync(tepHoc(), 'utf8')); } catch { return []; } }
const chuanTieuDe = (t) => String(t ?? '').toLowerCase().replace(/^(re|fwd?|tr):\s*/g, '').replace(/[0-9]+/g, '#').trim();
export const hocKhop = (x, hoc) => hoc.slice().reverse().find((h) => h.mien === x.mien && chuanTieuDe(h.tieuDe) === chuanTieuDe(x.tieuDe)) ?? null;
/** Áp kết luận của não lên kết luận máy, giữ chốt an toàn. */
export function apNao(x, n, day = {}, chiDuong = {}) {
  const { cho = null, hoc = null } = chiDuong;
  if (!x.mien) return x;
  if ((day.gia ?? []).includes(x.mien) || (day.nha ?? []).includes(x.mien) || linkNhai(x).length) return { ...x, phong: n?.phong ?? null };   // chốt máy thắng
  const y = n ? { ...x, ket: n.ket, chu: `${n.ly_do} (Kiên đọc thư)`, viec: n.viec || x.viec, phong: n.phong ?? null, nao: true } : { ...x };
  if (cho) return { ...y, ket: 'that', phong: cho.phong, viec: `${cho.ly_do || 'Phòng này đang chờ thư này'} — ${y.viec}`, chiDuong: 'cho-thu' };   // người đang chờ thì nhận
  if (hoc) return { ...y, ket: y.ket === 'thuong' ? 'that' : y.ket, phong: hoc.phong, chiDuong: 'hoc' };   // anh đã sửa thư cùng loại
  return y;
}
const NAO_KET = ['gia', 'that', 'thuong', 'chua-ro'];
/** Mô hình đọc một thư → { ket, ly_do, viec, phong } hoặc null khi lỗi (giữ kết luận máy). */
export async function nhanDinh(nguoi, model, x, phongDs, ph = '') {
  if (!model) return null;
  const system = `Bạn là Kiên, trưởng phòng Bảo mật của một công ty nhỏ (chủ là "anh"). Hòm claude@orit.app nhận thư anh chuyển tiếp từ Gmail. Việc của bạn: đọc MỘT thư, kết luận và giao đúng phòng.
- ket: "gia" (lừa đảo / mạo danh: người gửi giả, link dẫn sang tên miền lạ hay nhái, đòi mật khẩu/mã/tiền bất thường), "that" (thư thật của nền tảng/đối tác, CÓ việc cần người xử lý: cảnh báo vi phạm, yêu cầu xác nhận, thanh toán, khoá tài khoản, hạn chót), "thuong" (thư thật, chỉ thông báo, không cần làm gì), "chua-ro".
- Gmail khi chuyển tiếp tự thêm link (google.com/url, Google Maps cho địa chỉ ở chân thư): KHÔNG coi là dấu hiệu giả. Danh sách tên miền link bên dưới đã bỏ các link đó.
- phong: id phòng phải xử lý (chọn trong danh sách), null nếu không phòng nào. Thư về tài khoản bán hàng / sàn của phòng nào thì giao phòng đó.
- viec: một câu tiếng Việt, việc CỤ THỂ người phụ trách phải làm (thư giả: không bấm link, xoá thư).
- ly_do: một câu tiếng Việt, dựa trên bằng chứng trong thư.
Trả DUY NHẤT JSON: {"ket":"…","ly_do":"…","viec":"…","phong":"…"}.`;
  const vd = docHoc().slice(-15).map((h) => `- ${h.mien} · "${h.tieuDe}" → ${h.phong}`).join('\n');
  const cho = docChoThu().map((c) => `- ${c.phong}: ${c.ly_do} (mẫu: ${c.mau})`).join('\n');
  const user = `${cho ? `PHÒNG ĐANG CHỜ THƯ (thư khớp thì giao đúng phòng đó):\n${cho}\n\n` : ''}${vd ? `ANH ĐÃ SỬA (thư Kiên chuyển sai phòng → phòng đúng; theo đúng cách chia này):\n${vd}\n\n` : ''}Người gửi thật: ${x.gui}${x.chuyenTiep ? ' (thư anh chuyển tiếp)' : ''}\nTiêu đề: ${x.tieuDe}\nTên miền các link trong thư: ${[...new Set((x.links ?? []).map(mienGoc))].join(', ') || '(không có)'}\nMáy đo: ${x.ket} — ${x.chu}\n\nCÁC PHÒNG:\n${phongDs}\n\nNỘI DUNG THƯ:\n${x.than ?? ''}`;
  try {
    const r = await fetch(`${process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862'}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': nguoi, 'x-cty-luot': `nao-${Date.now()}`, ...(ph ? { 'x-cty-phong': ph } : {}) },
      body: JSON.stringify({ model, max_tokens: 400, temperature: 0.1, system, messages: [{ role: 'user', content: user }] }), signal: AbortSignal.timeout(60000) });
    const d = await r.json(); if (!r.ok) { console.error(`✗ não ${model}: ${r.status} ${JSON.stringify(d).slice(0, 200)}`); return null; }
    const t = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''); const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    if (!NAO_KET.includes(o.ket)) return null;
    return { ket: o.ket, ly_do: String(o.ly_do || '').slice(0, 300), viec: String(o.viec || '').slice(0, 300), phong: o.phong && /^[a-z0-9-]+$/.test(o.phong) ? o.phong : null };
  } catch (e) { console.error(`✗ não: ${e.message}`); return null; }
}
/** Danh sách phòng cho mô hình chọn: "id: tên — tóm tắt" (đọc cong-ty/phong/*.md). */
async function dsPhong() {
  const path = await import('node:path'); const { GOC } = await import('./goc.mjs'); const d = path.join(GOC, 'cong-ty', 'phong');
  return _fs.readdirSync(d).filter((f) => f.endsWith('.md')).map((f) => { const t = _fs.readFileSync(path.join(d, f), 'utf8'); const g = (k) => t.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
    return `${f.slice(0, -3)}: ${g('ten')} — ${g('tom_tat')}`; }).join('\n');
}
/** Nhịp: chấm bằng não các thư đang chờ chưa có kết luận não; tối đa `tran` thư mỗi nhịp (trần chi). Trả số thư vừa chấm. */
export async function chamNao(nguoi, model, ds, day, ph = '', tran = 5) {
  if (!model || !ds) return 0;
  let n = {}; try { n = JSON.parse(_fs.readFileSync(tepNao(), 'utf8')); } catch { /* lần đầu */ }
  const k = (day.lich_su ?? []).length, can = ds.filter((x) => !x.xong && x.luc >= BAT_TU && x.mien && n[x.id]?.day !== k).slice(0, tran);
  if (!can.length) return 0;
  const phongDs = await dsPhong(); let lam = 0;
  for (const x of can) { const o = await nhanDinh(nguoi, model, x, phongDs, ph); if (o) { n[x.id] = { ...o, day: k, luc: new Date().toISOString(), model }; lam++; } }
  _fs.writeFileSync(`${tepNao()}.tam`, JSON.stringify(n, null, 1)); _fs.renameSync(`${tepNao()}.tam`, tepNao());
  return lam;
}

// Đọc hòm: MỌI thư 30 ngày → kết luận (thư thường = ket 'thuong'). Lỗi đọc trả null (trang hiện lỗi, không giấu thành "không có thư").
export async function docMailBaoMat({ ngay = 30, url = process.env.DIRECTUS_URL, token = process.env.DIRECTUS_TOKEN } = {}) {
  if (!url || !token) return null;
  const tu = new Date(Date.now() - ngay * 86_400_000).toISOString();
  const q = new URLSearchParams({ limit: '200', sort: '-captured_at', fields: 'id,from_addr,from_name,subject,body_html,captured_at,status',
    filter: JSON.stringify({ captured_at: { _gte: tu } }) });   // MỌI thư (anh 14/10/2026) — thư thường ra ket 'thuong'
  _fs ??= await import('node:fs'); _goc ||= (await import('./goc.mjs')).GOC;
  try {
    const day = await docDay();
    const r = await fetch(`${url}/items/claude_inbox?${q}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const nao = docNao(day), hoc = docHoc();
    return (await r.json()).data.map((m) => { const x = { id: m.id, luc: m.captured_at, tieuDe: String(m.subject ?? '').replace(/^(fwd?|tr|chuyển tiếp):\s*/i, ''), xong: m.status !== 'new',
      ...thamDinh({ from: m.from_addr, subject: m.subject, html: m.body_html }, day), chuyenTiep: nguoiGui(m.from_addr, m.body_html ?? '').chuyenTiep, than: chu(m.body_html ?? '').replace(/\s+\n/g, '\n').slice(0, 3500) };
      return apNao(x, nao[m.id], day, { cho: choThu(x), hoc: hocKhop(x, hoc) }); });
  } catch { return null; }
}

// ── NHỊP CỦA NGƯỜI PHỤ TRÁCH (worker/nhip.mjs gọi mỗi phút, anh bật 13/10/2026 "hệ thống phải tự làm việc, không phải nhắc mới làm"):
// thư bảo mật chưa xử → MỘT tin vào nhóm Telegram MINE, topic "🔐 Bảo mật" (bot tự tạo topic lần đầu); thư đã xử (đọc / lưu trữ trong hòm)
// → thả ❤ rồi 1 phút sau xoá tin; còn thư chờ → người phụ trách "chờ người" trên văn phòng pixel. Mô hình: chấm mỗi thư chờ MỘT lần (não) + lời mở.
const CTY = 'https://cty.on.tc/?dc=mail&ngan=phong%3Aan-toan-tk';
const XOA_SAU = 60_000;
const NOM_CHU = { nha: 'site nhà', quen: 'nhà thật, quen', gia: 'giả' };
const SAU_DAY = { nha: 'thư từ đó là thư thường, em không báo nữa', quen: 'em tin tên miền này, link về đó không còn là lạ', gia: 'thư từ đó em luôn gắn THƯ GIẢ' };
export const tinDaNho = (x, ten) => `🧠 <b>${esc(ten)}</b> đã nhớ: <b>${esc(x.mien)}</b> = ${NOM_CHU[x.nhom] ?? x.nhom} — ${SAU_DAY[x.nhom] ?? ''}. <i>(${esc(x.ai || '?')})</i>\n<a href="${CTY}">↗ cty · Bảo mật › Mail bảo mật</a>`;
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
export function buocTin(st, ds, gio, ten = '', giu = () => false) {
  const tin = { ...(st.tin ?? {}) }, gui = [], tha = [], xoa = [], daDoc = [];
  if (!ds) return { gui, tha, xoa, daDoc, st };
  const goi = ten && new RegExp(ten.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'i');
  const da = new Set(st.da ?? []);
  for (const m of ds) {
    if (m.luc && m.luc < BAT_TU) continue;
    if (giu(m)) continue;   // thư đến NGOÀI GIỜ: giữ lại, báo dồn sau tin điểm danh 8h sáng (anh 14/10/2026)
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
// ── ĐIỂM DANH + BÁO CÁO CUỐI NGÀY (anh 14/10/2026: "đầu ngày phải báo điểm danh, cuối ngày báo cáo trong ngày; ngoài giờ thì báo dồn vào đầu
// ngày hôm sau 8h sáng"). Mốc điểm danh = `diem_danh` trong hồ sơ (Kiên 08:00); báo cáo = 5 phút trước khi hết ca. Mỗi ngày làm việc một lần.
const gioVN = (ms) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const dongThu = (m) => `• ${KET_CHU[m.ket]} — <i>${esc(m.tieuDe)}</i> (${esc(m.mien || m.gui)})`;
export function tinDiemDanh({ ten, ca, gio, ngoaiGio, cho }) {
  const bm = ngoaiGio.filter((m) => m.ket !== 'thuong');
  return `☀️ <b>${esc(ten)} điểm danh</b> ${gioVN(gio)} — ca ${esc(ca ?? 'cả ngày')}.\n`
    + `Ngoài giờ: ${ngoaiGio.length} thư đến${bm.length ? `, ${bm.length} thư bảo mật (báo từng thư ngay dưới):\n${bm.map(dongThu).join('\n')}` : ', không có thư bảo mật.'}\n`
    + `${cho.length ? `Đang chờ anh xử: ${cho.length} thư\n${cho.map(dongThu).join('\n')}` : 'Không có thư nào chờ anh.'}\n<a href="${CTY}">↗ cty · Bảo mật › Mail bảo mật</a>`;
}
export function tinBaoCao({ ten, ca, ngay, trongNgay, cho, hoc, goi, usd }) {
  const bm = trongNgay.filter((m) => m.ket !== 'thuong'), xu = bm.filter((m) => m.xong);
  return `🌙 <b>${esc(ten)} báo cáo ngày ${ngay.split('-').reverse().join('/')}</b> (ca ${esc(ca ?? 'cả ngày')})\n`
    + `• Đọc ${trongNgay.length} thư: ${bm.length} thư bảo mật (${bm.filter((m) => m.ket === 'gia').length} giả), ${xu.length} đã xử\n`
    + `• Còn chờ anh: ${cho.length} thư${cho.length ? ` — ${cho.map((m) => esc(m.mien || m.gui)).join(', ')}` : ''}\n`
    + `• Học được: ${hoc.length ? hoc.map((x) => `${esc(x.mien)} = ${NOM_CHU[x.nhom] ?? x.nhom}`).join(', ') : 'không có gì mới'}\n`
    + `• Mô hình: ${goi} lần gọi, $${usd.toFixed(5)}\n`
    + `Thư đến sau giờ này sẽ được báo dồn lúc điểm danh sáng mai.\n<a href="${CTY}">↗ cty · Bảo mật › Mail bảo mật</a>`;
}

/** Nhịp thật (box3): đọc hòm → Telegram + pixel. env: DIRECTUS_*, TG_BOT_TOKEN, TG_CHAT (/root/.secrets/mine-tg.env). */
export async function nhipBaoMat(nguoi, { ten = nguoi, model = '', phong = '', ca, diemDanh, tep = `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/bao-mat-tg.json` } = {}) {
  const fs = await import('node:fs'); const { vpBao } = await import('./vp.mjs');
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  const tg = async (m, b) => { const j = await (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(15000) })).json(); if (!j.ok) console.error(`✗ telegram ${m}: ${j.description}`); return j; };
  let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  // nút anh bấm dưới tin (callback "km:<nhóm>:<miền>") → dạy sổ TRƯỚC khi đọc hòm, để nhịp này thẩm định lại theo điều vừa dạy
  // tin Telegram đọc qua bộ nhận chung (tg-phong.mjs): Bảo mật chỉ mở hộp phòng mình — đọc thẳng getUpdates ở đây từng nuốt tin của phòng khác
  const { gomTin, moHop } = await import('./tg-phong.mjs'); await gomTin(tg);
  let day = 0;
  for (const x of moHop(phong || 'an-toan-tk')) {
    x.xong(); const c = x.callback_query; const [, nhom, mien] = String(c?.data ?? '').split(':');
    // anh TRẢ LỜI một tin báo bằng chữ ("Thật" / "Giả" / "Nhà mình") = bấm nút tương ứng (anh 19/10/2026: báo giả, anh trả lời "Thật" mà Kiên im)
    const tr = x.message, goc = tr?.reply_to_message?.message_id, chuTra = String(tr?.text ?? '');
    if (tr && !tr.from?.is_bot && goc) {
      const mid = Object.entries(st.tin ?? {}).find(([, t]) => t.id === goc)?.[0], nh = nhomTuChu(chuTra);
      const mail = mid ? (await docMailBaoMat())?.find((m) => m.id === mid) : null;
      if (!mail || !nh) { await tg('sendMessage', { message_thread_id: st.topic, reply_parameters: { message_id: tr.message_id }, text: !mail ? `${ten}: tin này không phải tin báo thư em còn giữ — anh trả lời ngay dưới tin báo thư nhé.` : `${ten}: em chưa hiểu — anh trả lời "Thật", "Giả" hoặc "Nhà mình".` }); continue; }
      try { await dayMien(nh, mail.mien, tr.from?.username ?? tr.from?.first_name ?? ''); day++; if (nh !== 'gia' && !st.chuyen?.[mail.id]) ghiChuyen(st, mail.id, await giaoPhuTrach(tg, st.topic, mail, ten, goc)); }
      catch (e) { await tg('sendMessage', { message_thread_id: st.topic, reply_parameters: { message_id: tr.message_id }, text: `${ten}: ${e.message}` }); }
      continue;
    }
    if (c && /^tp:/.test(String(c.data))) {   // anh trả lời câu "phòng X chưa có chủ đề — có tạo không?"
      const [, ph, y] = String(c.data).split(':'), ai = c.from?.first_name || c.from?.username || 'Anh';
      try {
        await tg('editMessageReplyMarkup', { message_id: c.message.message_id, reply_markup: { inline_keyboard: [] } });
        if (y === 'ok') { const { topicPhong, ghimNhanSu } = await import('./tg-phong.mjs'); const path = await import('node:path'); const { GOC } = await import('./goc.mjs');
          const tenPh = (_fs.readFileSync(path.join(GOC, 'cong-ty', 'phong', `${ph}.md`), 'utf8').match(/^ten:\s*(.+)$/m)?.[1] ?? ph).replace(/^Phòng\s+/, '').replace(/\s*\(.*\)$/, '').trim();
          const tp = await topicPhong(ph, `📂 ${tenPh}`, tg, { duocTao: true }); await ghimNhanSu(ph, tg).catch(() => {});
          await tg('answerCallbackQuery', { callback_query_id: c.id, text: tp ? `Đã tạo chủ đề 📂 ${tenPh}` : 'Tạo chủ đề hỏng' });
          await tg('sendMessage', { message_thread_id: st.topic, reply_parameters: { message_id: c.message.message_id, allow_sending_without_reply: true }, parse_mode: 'HTML', text: `✅ ${esc(ai)} cho tạo chủ đề 📂 ${esc(tenPh)} — thư phòng này từ giờ vào đó.` });
        } else await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Không tạo — thư phòng này tiếp tục hiện ở Bảo mật' });
      } catch (e) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: e.message.slice(0, 190), show_alert: true }); }
      continue;
    }
    if (c && /^kc:/.test(String(c.data))) {   // ↪️ Sai phòng: ? = mở bảng chọn · x = huỷ · <phòng> = chuyển lại + học
      const [, dich, id8] = String(c.data).split(':'), ai = c.from?.first_name || c.from?.username || 'Anh';
      try {
        if (dich === '?' || dich === 'x') { await tg('editMessageReplyMarkup', { message_id: c.message.message_id, reply_markup: dich === '?' ? await bangPhong(id8) : nutSai(id8) }); await tg('answerCallbackQuery', { callback_query_id: c.id, text: dich === '?' ? 'Chọn phòng đúng' : 'Đã huỷ' }); continue; }
        const mail = (await docMailBaoMat())?.find((m) => m.id.startsWith(id8)); if (!mail) throw new Error('không còn thấy thư này trong hòm (30 ngày)');
        // tin chuyển SAI: xoá tin ở chủ đề phòng sai, sửa dòng 📌 ở Bảo mật thành dòng ghi lại việc chuyển lại (anh 20/10/2026: "tin chuyển sai phải xoá,
        // update được, log lại để còn dùng"). Tin cũ trước khi có mã tin (st.chuyenTin) thì xử đúng tin anh vừa bấm.
        const cu = st.chuyenTin?.[mail.id] ?? null, bam = c.message, oBm = bam.message_thread_id === st.topic;
        const idXoa = cu?.idPhong ?? (oBm ? null : bam.message_id), idSua = cu?.idBm ?? (oBm ? bam.message_id : null);
        const daDung = cu?.phong === dich;
        const xoa = idXoa && !(daDung && idXoa === cu?.idPhong) ? (await tg('deleteMessage', { message_id: idXoa })).ok : null;
        if (daDung && bam.message_id !== cu?.idPhong && bam.message_id !== cu?.idBm) await tg('deleteMessage', { message_id: bam.message_id });   // tin trùng cũ ở phòng sai
        const sua = idSua ? (await tg('editMessageText', { message_id: idSua, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [] },
          text: `↪️ <b>${esc(ai)}</b> chuyển lại thư <b>${esc(mail.mien)}</b> (<i>${esc(mail.tieuDe)}</i>) từ ${esc(cu?.phong ?? mail.phong ?? '?')} sang <b>${esc(dich)}</b> — tin ở phòng sai đã xoá.` })).ok : null;
        if (!sua) await tg('editMessageReplyMarkup', { message_id: bam.message_id, reply_markup: { inline_keyboard: [] } });
        if (cu?.phong && cu.phong !== dich) try { _fs.rmSync(`${process.env.CTY_DATA_DIR || '/var/lib/cty'}/phong-thu/${cu.phong}/${mail.id}.json`, { force: true }); } catch { /* không có */ }
        hocChuyen(mail, dich, ai, { tu: cu?.phong ?? mail.phong ?? null, xoa_tin: idXoa, xoa_ok: xoa, sua_tin: idSua, sua_ok: sua, da_dung: daDung });
        await tg('answerCallbackQuery', { callback_query_id: c.id, text: daDung ? `Thư đã ở ${dich} — đã dọn tin trùng` : `Kiên chuyển lại sang ${dich}, xoá tin sai và nhớ cách chia này` });
        if (!daDung) ghiChuyen(st, mail.id, await giaoPhuTrach(tg, st.topic, { ...mail, phong: dich }, ten, st.tin?.[mail.id]?.id));
      } catch (e) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: e.message.slice(0, 190), show_alert: true }); }
      continue;
    }
    if (!c || !String(c.data).startsWith('km:')) continue;
    try { await dayMien(nhom, mien, c.from?.username ?? String(c.from?.id ?? '')); day++; await tg('answerCallbackQuery', { callback_query_id: c.id, text: `${ten} đã nhớ: ${mien} = ${NOM_CHU[nhom] ?? nhom}` }); }
    catch (e) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: e.message, show_alert: true }); }
  }
  // mỗi lần sổ dạy đổi (nút Telegram, nút cty, hay dạy hộ bằng lệnh) → Kiên báo một tin "đã nhớ" để anh THẤY Kiên đã học (anh 14/10/2026)
  const ls = ((await docDay()).lich_su ?? []); if (st.daNho === undefined) st.daNho = 0;
  for (const x of ls.slice(st.daNho)) await tg('sendMessage', { message_thread_id: st.topic, text: tinDaNho(x, ten), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  const moiNho = ls.length - st.daNho; st.daNho = ls.length;
  let ds = await docMailBaoMat(); if (!ds) console.error('✗ không đọc được hòm claude@orit.app');
  // não: thư đang chờ chưa có kết luận của mô hình → chấm (≤ 5 thư/nhịp), rồi đọc lại để ds mang kết luận não
  const nao = ds ? await chamNao(nguoi, model, ds, await docDay(), phong) : 0; if (nao) ds = await docMailBaoMat() ?? ds;
  const G = await import('./gio-lam.mjs'); const bay = Date.now(), ngay = G.ngayLam(bay, ca);
  if (!st.topic) { const j = await tg('createForumTopic', { name: '🔐 Bảo mật' }); if (j.ok) st.topic = j.result.message_thread_id; }
  const tuMoc = st.diemDanhLuc ?? BAT_TU;   // thư ngoài giờ đến SAU lần điểm danh trước = phải báo dồn ở lần điểm danh này
  const ngoaiGio = (ds ?? []).filter((m) => m.luc > tuMoc && !G.trongCa(ca, new Date(m.luc)));
  const choXu = () => (ds ?? []).filter((m) => !m.xong && m.ket !== 'thuong' && m.luc >= BAT_TU);
  let bc = '';
  if (ds && diemDanh && st.diemDanhNgay !== ngay && G.quaMoc(diemDanh, bay, ca)) {   // ☀️ điểm danh (một lần mỗi ngày làm việc), rồi thả thư giữ lại
    await vpBao(nguoi, 'lam', 'điểm danh'); const j = await tg('sendMessage', { message_thread_id: st.topic, text: tinDiemDanh({ ten, ca, gio: bay, ngoaiGio, cho: choXu() }), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    if (j.ok) { st.diemDanhNgay = ngay; st.diemDanhLuc = new Date(bay).toISOString(); bc += 'điểm danh · '; }
  }
  const giu = (m) => diemDanh && m.luc > (st.diemDanhLuc ?? BAT_TU) && !G.trongCa(ca, new Date(m.luc));
  const b = buocTin(st, ds, bay, ten, giu); st = b.st;
  for (const m of b.gui) {
    await vpBao(nguoi, 'lam', `báo thư ${m.mien}`);
    const j = await tg('sendMessage', { message_thread_id: st.topic, text: tinBao(m, ten, await loiMo(nguoi, model, m, phong)), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: nutDay(m.mien) });
    if (j.ok) st.tin[m.id] = { id: j.result.message_id, nut: 1 }; st.vp = 'lam';
  }
  // thư Kiên kết luận THẬT, tên miền có phòng phụ trách → tự chuyển vào phòng đó MỘT lần (không đợi anh)
  for (const m of (ds ?? []).filter((x) => x.ket === 'that' && !x.xong && x.luc >= BAT_TU && !st.chuyen?.[x.id] && ((x.phong && x.phong !== 'an-toan-tk') || phuTrachMien(x.mien)))) {
    await vpBao(nguoi, 'lam', `chuyển thư ${m.mien}`);
    ghiChuyen(st, m.id, await giaoPhuTrach(tg, st.topic, m, ten, st.tin?.[m.id]?.id));
  }
  // tin gửi trước khi có nút (vd amazon.in 13/10) → gắn thêm ba nút dạy một lần
  for (const [mid, t] of Object.entries(st.tin ?? {})) { const m = ds?.find((x) => x.id === mid); if (m && !t.nut && !t.xong && (await tg('editMessageReplyMarkup', { message_id: t.id, reply_markup: nutDay(m.mien) })).ok) t.nut = 1; }
  for (const m of b.daDoc) await tg('sendMessage', { message_thread_id: st.topic, text: tinDaDoc(m, ten), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  for (const id of b.tha) await tg('setMessageReaction', { message_id: id, reaction: [{ type: 'emoji', emoji: '❤' }] });
  for (const id of b.xoa) await tg('deleteMessage', { message_id: id });
  // SỔ CẢNH BÁO NỀN TẢNG (worker/canh-bao.mjs, anh 18/10/2026): mỗi thông báo rủi ro tài khoản (br tự soi · máy đăng · tay) → một tin chủ đề Bảo mật
  let nCanh = 0;
  if (process.env.DATABASE_URL && st.topic) {
    const C = await import('./canh-bao.mjs'); const sql = (await import('postgres')).default(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
    try {
      const ds2 = await C.chuaBao(sql), xong = [];
      for (const a of ds2) { if ((await tg('sendMessage', { message_thread_id: st.topic, text: C.tinCanhBao(a, ten), parse_mode: 'HTML', link_preview_options: { is_disabled: true } })).ok) xong.push(a.id); }
      await C.daBao(sql, xong); nCanh = xong.length;
      if (nCanh) await vpBao(nguoi, 'lam', `${nCanh} cảnh báo tài khoản`);
    } catch (e) { console.error(`✗ sổ cảnh báo: ${e.message}`); }
    finally { await sql.end({ timeout: 2 }).catch(() => {}); }
  }
  if (ds && st.baoCaoNgay !== ngay && G.quaMoc(G.mocCuoiCa(ca), bay, ca)) {   // 🌙 báo cáo cuối ngày (5 phút trước hết ca)
    const tu = G.dauCa(bay, ca), trong = (x) => Date.parse(x) >= tu;
    const { docLog } = await import('./log.mjs'); const goi = docLog({ n: 5000 }).filter((e) => e.tu === nguoi && e.loai === 'goi' && trong(e.ts));
    const j = await tg('sendMessage', { message_thread_id: st.topic, text: tinBaoCao({ ten, ca, ngay, trongNgay: ds.filter((m) => trong(m.luc)), cho: choXu(), hoc: ls.filter((x) => trong(x.luc)), goi: goi.length, usd: goi.reduce((t, e) => t + (Number(e.chi_tiet?.usd) || 0), 0) }), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    if (j.ok) { st.baoCaoNgay = ngay; bc += 'báo cáo cuối ngày · '; }
  }
  const vp = b.cho ? 'cho' : 'xong';   // người phụ trách: còn thư chờ → "chờ người" trên pixel; hết → về ghế (chỉ báo khi đổi)
  if (ds && st.vp !== vp) { await vpBao(nguoi, vp, `${b.cho} thư bảo mật`); st.vp = vp; }
  fs.writeFileSync(`${tep}.tam`, JSON.stringify(st)); fs.renameSync(`${tep}.tam`, tep);
  return `${bc}${nCanh ? `${nCanh} cảnh báo tài khoản · ` : ''}${moiNho ? `${moiNho} tin đã nhớ · ` : ''}${day ? `${day} lần anh dạy · ` : ''}${ds ? ds.length : '?'} thư đã đọc · ${b.gui.length} báo · ${b.daDoc.length} trả lời · ${b.tha.length} ❤ · ${b.xoa.length} gỡ · ${b.cho ?? '?'} thư chờ`;
}

if (process.argv[1]?.endsWith('mail-bao-mat.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  a.deepEqual(tachLink('<a href="https://www.google.com/url?q=https://help.etsy.com/hc/x&amp;source=gmail">x</a>'), ['help.etsy.com'], 'Gmail bọc link: chỉ xét link thật');
  a.equal(thamDinh({ from: 'htuan82@gmail.com', subject: 'Fwd: An important message from Etsy Trust & Safety', html: '---------- Forwarded message ---------<br>From: Etsy &lt;noreply@etsy.com&gt;<br>Please review our policy <a href="https://www.google.com/url?q=https://www.etsy.com/legal/policy/x">policy</a>' }).ket !== 'gia', true, 'thư Etsy chuyển tiếp qua Gmail không bị gắn giả');
  a.deepEqual(tachLink('<a href="https://www.google.com/search?q=x">x</a>'), ['www.google.com'], 'link google thường vẫn tính');
  a.deepEqual(tachLink('<a href="https://www.google.com/maps/search/117+Adams+Street,+Brooklyn?entry=gmail&amp;source=g">117 Adams</a>'), [], 'địa chỉ Gmail tự gắn Maps không tính');
  { const x = { mien: 'etsy.com', ket: 'gia', chu: 'máy', viec: 'xoá', la: ['www.google.com'] }, n = { ket: 'that', ly_do: 'cảnh báo chính sách thật', viec: 'rà listing', phong: 'sach' };
    a.equal(apNao(x, n).ket, 'that', 'não thắng luật cứng khi không có chốt'); a.equal(apNao(x, n).phong, 'sach');
    a.equal(apNao({ ...x, la: ['etsy-verify.top'] }, n).ket, 'gia', 'link nhái tên hãng: chốt máy thắng não');
    a.equal(apNao(x, n, { gia: ['etsy.com'] }).ket, 'gia', 'anh dạy giả: chốt máy thắng não'); a.equal(apNao(x, null).ket, 'gia', 'não lỗi: giữ kết luận máy');
    a.deepEqual(linkNhai({ mien: 'amazon.in', la: ['amazon-in.verify-acct.top', 'www.google.com'] }), ['amazon-in.verify-acct.top']); }
  { const x = { mien: 'pinterest.com', gui: 'pinbot@account.pinterest.com', tieuDe: 'Your Pinterest API trial access is approved', ket: 'thuong', chu: 'x', viec: 'ghi nhận', la: [] };
    const cho = choThu(x, [{ mau: 'pinterest.*(api|trial|standard) access', phong: 'xuong-st', ly_do: 'đang chờ cấp API' }]);
    a.equal(cho?.phong, 'xuong-st'); a.equal(apNao(x, { ket: 'thuong', ly_do: 'tb', viec: '', phong: 'sach' }, {}, { cho }).phong, 'xuong-st', 'người đang chờ thư thắng mô hình');
    a.equal(apNao(x, null, {}, { cho }).ket, 'that', 'thư được chờ = có việc → chuyển');
    const hoc = [{ mien: 'pinterest.com', tieuDe: 'Your Pinterest API trial access is approved', phong: 'marketing' }];
    a.equal(hocKhop({ ...x, tieuDe: 'Fwd: Your Pinterest API trial access is approved' }, hoc)?.phong, 'marketing', 'thư cùng người gửi + tiêu đề đi chỗ anh đã sửa');
    a.equal(hocKhop({ ...x, tieuDe: 'New follower' }, hoc), null);
    { const y = apNao({ ...x, la: ['pinterest-api.top'] }, null, {}, { cho }); a.notEqual(y.phong, 'xuong-st', 'link nhái: chốt máy thắng cả sổ chờ'); a.notEqual(y.ket, 'that'); } }
  _fs ??= await import('node:fs');
  // hồ sơ phòng GIẢ trong thư mục tạm — không đọc dữ liệu thật (phòng xoá dòng cho_thu khi hết chờ là đúng luật, bài kiểm không được đỏ theo)
  { const os = await import('node:os'), path = await import('node:path'); const goc0 = _goc; _goc = _fs.mkdtempSync(path.join(os.tmpdir(), 'cho-thu-'));
    _fs.mkdirSync(`${_goc}/cong-ty/phong`, { recursive: true }); _fs.writeFileSync(`${_goc}/cong-ty/phong/social-traffic.md`, '---\nten: Phòng Social Traffic\ncho_thu: pinterest.*(api|trial access) | đang chờ Pinterest cấp API\n---\nthân');
    _fs.writeFileSync(`${_goc}/cong-ty/phong/sach.md`, '---\nten: Phòng Sách\n---\ncho_thu: dòng trong thân không tính');
    a.equal(docChoThu().length, 1, 'chỉ đọc cho_thu ở phần đầu tệp');
    const c = choThu({ gui: 'pinbot@account.pinterest.com', tieuDe: 'Your Pinterest API trial access request was approved', than: '' });
    a.equal(c?.phong, 'social-traffic', 'phòng tự khai cho_thu trong phong/<id>.md → Kiên giao đúng phòng'); a.equal(choThu({ gui: 'x@etsy.com', tieuDe: 'order', than: '' }), null); _goc = goc0; }
  a.equal(nhomTuChu('Thật'), 'quen'); a.equal(nhomTuChu('thật đấy, của Etsy'), 'quen'); a.equal(nhomTuChu('Giả'), 'gia'); a.equal(nhomTuChu('Nhà mình'), 'nha'); a.equal(nhomTuChu('ok'), null);
  a.equal(phuTrachMien('etsy.com'), 'thao'); a.equal(phuTrachMien('mail.etsy.com'), 'thao'); a.equal(phuTrachMien('evil-etsy.com'), null); a.equal(phuTrachMien('kdp.amazon.com'), 'thao');
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
  const ngoai = { ...m1, id: 'n', luc: '2026-10-14T20:30:00Z' };   // 03:30 sáng VN 15/10 — ngoài ca 06–02
  a.equal(buocTin({}, [ngoai], 0, 'Kiên', () => true).gui.length, 0, 'thư ngoài giờ bị giữ tới điểm danh');
  a.match(tinDiemDanh({ ten: 'Kiên', ca: '06:00-02:00', gio: Date.parse('2026-10-15T01:00:00Z'), ngoaiGio: [ngoai], cho: [] }), /điểm danh.*\n.*1 thư bảo mật[\s\S]*<a href="https:\/\/cty[^"]+">[^<]+<\/a>$/);
  a.match(tinBaoCao({ ten: 'Kiên', ca: '06:00-02:00', ngay: '2026-10-14', trongNgay: [m1], cho: [m1], hoc: [{ mien: 'examweight.com', nhom: 'nha' }], goi: 1, usd: 0.0001 }), /báo cáo ngày 14\/10\/2026[\s\S]*Còn chờ anh: 1 thư[\s\S]*examweight\.com = site nhà[\s\S]*<\/a>$/);
  a.match(tinDaNho({ mien: 'examweight.com', nhom: 'nha', ai: 'anh' }, 'Kiên'), /đã nhớ: <b>examweight\.com<\/b> = site nhà.*\n<a href="https:\/\/cty/, 'tin đã nhớ kết bằng link cty');
  a.match(tinBao(m1, 'Kiên'), /A &lt;b&gt;/, 'tiêu đề thư được thoát HTML'); a.match(tinBao(m1, 'Kiên'), /<a href="https:\/\/cty\.on\.tc\/[^"]+">[^<]+<\/a>$/, 'dòng cuối là link mở thẳng trên cty');
  console.log('✓ mail-bao-mat: 12 ca đạt (tên miền đăng ký, gỡ link chuyển tiếp, người gửi thư chuyển tiếp, thư thật yêu cầu giả, thư giả, tên miền nhái, không đọc được người gửi) + 8 ca nhịp báo (báo một lần, hòm lỗi không đụng, ❤ rồi gỡ sau 1 phút, thoát HTML)');
}
if (process.argv[1]?.endsWith('mail-bao-mat.mjs') && !process.argv.includes('--tu-kiem')) {
  const ds = await docMailBaoMat();
  if (!ds) { console.error('✗ không đọc được hòm (thiếu DIRECTUS_URL / DIRECTUS_TOKEN hoặc Directus lỗi)'); process.exit(1); }
  for (const m of ds) console.log(`${m.luc.slice(0, 16)} ${m.xong ? '✓ đã xử' : '● chờ'} [${m.ket}] ${m.tieuDe}\n   ${m.chu}\n   → ${m.viec}`);
  console.log(`${ds.length} thư đã đọc 30 ngày qua · ${ds.filter((m) => m.ket !== 'thuong').length} thư bảo mật`);
}
