// PHÒNG NỘI DUNG · KIỂM BÀI (anh 17/10/2026: "mọi bài viết mới phải qua phòng nội dung review… chạy tự động, báo cáo lên telegram:
// A gửi bài <url>. KQ là thiếu X, thừa Y… Kết luận = KHÔNG DUYỆT / SỬA LẠI").
// Hàng chờ: <DATA>/vp-noi-dung/hang-cho/<id>.json → nhịp 'kiem-bai' (Ngọc, nhip.mjs) lấy từng bài: máy đo (không AI: gạch dài, từ máy,
// số chữ, ví dụ, FAQ, phần "nếu đã lỡ", nút hành động) + Ngọc chấm theo cong-ty/quy-dinh/noi-dung/chuan-duyet-bai.md qua proxy công ty
// (ghi tiền, trần chi) → tin vào chủ đề "📝 Nội dung" trên Telegram → kết quả lưu <DATA>/vp-noi-dung/da-kiem/<id>.json.
//   node worker/kiem-bai.mjs --nop <url> [--tu "<người gửi>"] [--html <tệp nháp>]   nộp bài (bản nháp chưa lên trang: --html)
//   node worker/kiem-bai.mjs --tu-kiem                                                tự kiểm máy đo + khuôn tin
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const VP = () => path.join(DATA(), 'vp-noi-dung');
const CHO = () => path.join(VP(), 'hang-cho'), XONG = () => path.join(VP(), 'da-kiem');
const CTY = 'https://cty.on.tc';
const CTY_LINK = `<a href="${CTY}/phong/xuong-aff">↗ cty · Xưởng Aff</a>`;
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const KET = { DUYET: '✅ DUYỆT', SUA_LAI: '✏️ SỬA LẠI', KHONG_DUYET: '⛔ KHÔNG DUYỆT' };
const TU_MAY = ['delve', 'leverage', 'utilize', 'crucial', 'vital', 'comprehensive', 'robust', 'streamline', 'moreover', 'furthermore', 'seamless',
  'game-changer', 'cutting-edge', 'state-of-the-art', "in today's world", 'in the realm of', "it's worth noting", 'in conclusion', 'unlock the'];

// VÒNG SỬA (anh 17/10/2026: "bên xưởng aff phải có người phụ trách tiếp nhận và thực hiện sửa rồi lại gửi lại cho đội content. hãy đặt
// giới hạn để ko bị lặp vô hạn"): bài chưa DUYỆT → trả về người phụ trách site (tra-ve/<id>.json + tin Telegram) → họ sửa, nộp lại.
// Mỗi url tối đa TRAN_LUOT lượt chấm chưa DUYỆT; hết lượt thì hàng chờ từ chối nộp, chờ anh `--mo-khoa <url>`.
export const TRAN_LUOT = 3;
const PHU_TRACH = { 'ratesbyroom.com': 'long', 'staymarlow.com': 'long', 'ratesbycar.com': 'long', 'hotelrateguide.com': 'long', 'trafficbuyersguide.com': 'long' };   // host (cả subdomain) → người phụ trách
export const phuTrach = (url) => { const h = (() => { try { return new URL(url).hostname; } catch { return ''; } })(); const k = Object.keys(PHU_TRACH).find((d) => h === d || h.endsWith(`.${d}`)); return k ? PHU_TRACH[k] : null; };
const TRA = () => path.join(VP(), 'tra-ve');
// Tên người trong tin: "Long [Xưởng Aff]" (anh 17/10/2026) — tên + phòng (bỏ chữ "Phòng " đầu). Nhận id hoặc tên; không khớp ai thì giữ nguyên.
const fmTep = (t, k) => (t.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim();
export const tenNguoi = (ai) => {
  const NS = path.join(GOC, 'cong-ty', 'nhan-su');
  try {
    for (const id of fs.readdirSync(NS)) {
      let t; try { t = fs.readFileSync(path.join(NS, id, 'SOUL.md'), 'utf8'); } catch { continue; }
      const ten = fmTep(t, 'ten'); if (id !== ai && ten !== ai) continue;
      let ph = ''; try { ph = fmTep(fs.readFileSync(path.join(GOC, 'cong-ty', 'phong', `${fmTep(t, 'phong')}.md`), 'utf8'), 'ten').replace(/^Phòng\s+/, '').replace(/\s*\(.*\)$/, ''); } catch { /* chưa có phòng */ }
      return ph ? `${ten} [${ph}]` : ten;
    }
  } catch { /* không đọc được sổ nhân sự */ }
  return ai;
};
const docJson = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))) : []);
/** Số lượt chấm chưa DUYỆT của url kể từ lần DUYỆT / mở khoá gần nhất. */
export function soLuot(url, ds = docJson(XONG())) {
  let n = 0; for (const x of ds.filter((x) => x.url === url)) n = x.ket === 'DUYET' || x.ket === 'MO_KHOA' ? 0 : n + 1; return n;
}
/** Anh mở khoá một url đã hết lượt: ghi mốc MO_KHOA vào da-kiem để đếm lại từ 0. */
export function moKhoa(url) { fs.mkdirSync(XONG(), { recursive: true }); fs.writeFileSync(path.join(XONG(), `${Date.now()}-mo.json`), JSON.stringify({ url, ket: 'MO_KHOA', luc: new Date().toISOString() })); }

/** Nộp một bài vào hàng chờ. html = nội dung bản nháp (chưa lên trang) — có thì phòng chấm cái này, không tải url (url vẫn bắt buộc: vòng sửa đếm lượt theo url). */
export function nopBai({ url, tu = 'Không rõ', html = null, ban = null }) {
  if (!url) throw new Error('cần --nop <url> (bản nháp thì thêm --html <tệp>, url là trang đích)');
  const n = soLuot(url);
  if (n >= TRAN_LUOT) throw new Error(`${url} đã ${n}/${TRAN_LUOT} lượt chấm chưa DUYỆT — dừng vòng, chờ anh quyết (anh mở lại: --mo-khoa <url>)`);
  fs.mkdirSync(CHO(), { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(path.join(CHO(), `${id}.json`), JSON.stringify({ id, url, tu, html, ban, luc: new Date().toISOString() }));
  for (const x of docJson(TRA())) if (x.url === url) fs.rmSync(path.join(TRA(), `${x.id}.json`), { force: true });   // đã nộp lại = đã nhận việc sửa
  return id;
}

/** HTML → chữ người đọc thấy ở phần thân bài (ưu tiên <main> / .prose / <article>), giữ đánh dấu tiêu đề và trích dẫn để mô hình thấy cấu trúc. */
/** HTML phần THÂN BÀI (bỏ đầu trang / chân trang / thanh tìm kiếm): <div class="prose"> → <article> → <main> → cả trang. */
export function thanBai(html) {
  const h = String(html), m = h.match(/<div class="prose">([\s\S]*?)<\/div>\s*<\/main>/i) || h.match(/<article[\s\S]*?<\/article>/i) || h.match(/<main[\s\S]*?<\/main>/i);
  return m ? (m[1] ?? m[0]) : h;
}
export function chuBai(html) {
  const h = thanBai(html).replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, '');
  return h.replace(/<h1[^>]*>/gi, '\n# ').replace(/<h2[^>]*>/gi, '\n## ').replace(/<h3[^>]*>/gi, '\n### ').replace(/<blockquote[^>]*>/gi, '\n> ')
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<(p|br|tr|div|table|details|summary)[^>]*>/gi, '\n').replace(/<td[^>]*>/gi, ' | ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&').replace(/&euro;/g, '€').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/** Máy đo (không AI) — số khách quan để mô hình không phải đoán, và chặn cứng không cần mô hình. */
export function mayDo(html) {
  const chu = chuBai(html), thuong = chu.toLowerCase(), dong = chu.split('\n');
  const tuMay = TU_MAY.filter((w) => thuong.includes(w));
  const gachDai = (chu.match(/[—–]/g) || []).length, h = thanBai(html);   // hình đếm trong thân bài — icon logo / ô tìm kiếm ở đầu trang không phải hình của bài
  // HÌNH THỨC (17/10/2026: bài 1.835 chữ chấm 10/10 mà anh vẫn "không đạt" — mô hình chỉ đọc chữ nên mù phần hình): đếm khối nhìn được
  // CHUẨN SEO (anh 17/10/2026: "bài SEO phải có đủ hình ảnh, video, FAQ minh hoạ"): ảnh thật + video + FAQ là chặn cứng, khung ví dụ không thay được ảnh
  const anhThat = (h.match(/<img\b[^>]*\bsrc=|<picture\b/gi) || []).length, anh = anhThat + (h.match(/<svg\b/gi) || []).length;
  const video = (h.match(/<video\b|<iframe\b[^>]*src="[^"]*(youtube|youtu\.be|vimeo|tiktok)/gi) || []).length;
  const coFaq = /##\s.*(question|faq|people ask)/i.test(chu);
  const khungVd = (h.match(/class="[^"]*\b(tin|msg|bubble|mock|phone|chat)\b/gi) || []).length;
  const soHinh = anh + video + khungVd, soChu = chu.split(/\s+/).filter(Boolean).length;
  return {
    so_chu: soChu, so_anh: anh, so_anh_that: anhThat, so_video: video, so_khung_vi_du: khungVd, so_hinh: soHinh, chu_moi_hinh: soHinh ? Math.round(soChu / soHinh) : soChu,
    gach_dai: gachDai, tu_may: tuMay,
    so_muc: dong.filter((l) => l.startsWith('## ')).length,
    so_vi_du: (String(html).match(/<blockquote/gi) || []).length,
    co_faq: coFaq,
    co_neu_da_lo: /##\s.*(already|if you (clicked|paid)|what to do now)/i.test(chu),
    co_nut: /class="[^"]*\bcta\b|<a [^>]*class="[^"]*btn/i.test(String(html)),
    chan_cung: [...(gachDai ? [`${gachDai} gạch ngang dài`] : []), ...(tuMay.length ? [`từ máy: ${tuMay.join(', ')}`] : []),
      ...(!soHinh ? ['không có khối hình nào (ảnh / video / khung ví dụ) — tường chữ'] : soChu / soHinh > 300 ? [`${Math.round(soChu / soHinh)} chữ mỗi khối hình (tối đa ~300)`] : []),
      ...(!anhThat ? ['không có ảnh thật (<img>) — chuẩn SEO'] : []), ...(!video ? ['không có video nhúng — chuẩn SEO'] : []), ...(!coFaq ? ['không có mục FAQ — chuẩn SEO'] : [])],
    chu,
  };
}

/** Ngọc chấm qua proxy công ty. Trả { thieu[], thua[], giong[], diem, ket_luan, tom_tat } hoặc null khi mô hình hỏng. */
async function cham(nguoi, model, phong, url, d) {
  const chuan = fs.readFileSync(path.join(GOC, 'cong-ty', 'quy-dinh', 'noi-dung', 'chuan-duyet-bai.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const system = `Bạn là Ngọc, trưởng phòng Nội dung. Bạn duyệt bài trước khi lên trang, theo đúng CHUẨN dưới đây, khắt khe như biên tập viên.
Chỉ dựa vào chữ của bài và số máy đo; không bịa chi tiết bài không có. Viết nhận xét bằng tiếng Việt, ngắn, cụ thể (chỉ ra đoạn nào).
Kết luận: DUYET khi bài đạt mọi phần chính của chuẩn và không có chặn cứng; SUA_LAI khi khung đúng nhưng thiếu / thừa / giọng còn lỗi;
KHONG_DUYET khi bài sơ sài (không cảnh mở, không ví dụ cho các ý, không giữ được người đọc) hoặc sai hướng.
Trả DUY NHẤT một JSON: {"thieu":["…"],"thua":["…"],"giong":["…"],"diem":0-10,"ket_luan":"DUYET|SUA_LAI|KHONG_DUYET","tom_tat":"một câu"}.

CHUẨN:
${chuan}`;
  const may = { so_hinh: d.so_hinh, so_anh: d.so_anh, so_anh_that: d.so_anh_that, so_video: d.so_video, so_khung_vi_du: d.so_khung_vi_du, chu_moi_hinh: d.chu_moi_hinh, so_chu: d.so_chu, gach_dai: d.gach_dai, tu_may: d.tu_may, so_muc: d.so_muc, so_vi_du: d.so_vi_du, co_faq: d.co_faq, co_neu_da_lo: d.co_neu_da_lo, co_nut: d.co_nut };
  const body = { model, max_tokens: 900, temperature: 0.2, system, messages: [{ role: 'user', content: `Bài: ${url || '(bản nháp)'}\nMáy đo: ${JSON.stringify(may)}\n\n${d.chu.slice(0, 24000)}` }] };
  try {
    const r = await fetch(`${process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862'}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': nguoi, 'x-cty-luot': `kiem-bai-${Date.now()}`, ...(phong ? { 'x-cty-phong': phong } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const j = await r.json(); if (!r.ok) { console.error(`✗ ${model}: ${r.status} ${JSON.stringify(j).slice(0, 200)}`); return null; }
    const txt = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    return { thieu: [].concat(o.thieu || []), thua: [].concat(o.thua || []), giong: [].concat(o.giong || []), diem: Number(o.diem) || 0, ket_luan: KET[o.ket_luan] ? o.ket_luan : 'SUA_LAI', tom_tat: String(o.tom_tat || '') };
  } catch (e) { console.error(`✗ chấm: ${e.message}`); return null; }
}

/** Kết luận cuối: chặn cứng của máy đo (giọng văn + hình thức) kéo DUYỆT xuống SỬA LẠI — mô hình không được bỏ qua chặn cứng. */
export const ketCuoi = (kq, d) => (d.chan_cung.length && kq.ket_luan === 'DUYET' ? 'SUA_LAI' : kq.ket_luan);
/** Điểm cuối: còn chặn cứng thì trần 6/10 — tránh tin 'chấm 10/10' đi kèm SỬA LẠI. */
export const diemCuoi = (kq, d) => (d.chan_cung.length ? Math.min(kq.diem, 6) : kq.diem);

/** Tin Telegram theo khuôn anh đặt: "<người> gửi bài <url>. KQ: thiếu…, thừa… Kết luận: …". */
export function tinKiem({ tu, url, kq, d, ket, ten = 'Ngọc' }) {
  const ds = (nhan, xs) => (xs.length ? `\n<b>${nhan}:</b>\n${xs.slice(0, 6).map((x) => `• ${esc(x)}`).join('\n')}` : '');
  return `📝 <b>${esc(tenNguoi(tu))}</b> gửi bài ${url ? esc(url) : '(bản nháp)'}\n<b>KQ (${esc(tenNguoi(ten))} chấm ${kq.diem}/10):</b> ${esc(kq.tom_tat)}`
    + ds('Thiếu', kq.thieu) + ds('Thừa', kq.thua) + ds('Giọng văn', kq.giong)
    + `\n<b>Máy đo:</b> ${d.so_chu} chữ · ${d.so_hinh} khối hình (${d.so_anh_that} ảnh thật, ${d.so_video} video, ${d.so_khung_vi_du} khung ví dụ) · ${d.so_muc} mục · ${d.so_vi_du} ví dụ trích · FAQ ${d.co_faq ? 'có' : 'không'} · phần "nếu đã lỡ" ${d.co_neu_da_lo ? 'có' : 'không'} · nút ${d.co_nut ? 'có' : 'không'}${d.chan_cung.length ? ` · <b>chặn cứng:</b> ${esc(d.chan_cung.join('; '))}` : ''}`
    + `\n<b>Kết luận: ${KET[ket]}</b>\n<a href="${CTY}">↗ cty · Phòng Nội dung</a>`;
}

/** Telegram chủ đề "📝 Nội dung" — dùng chung cho nhịp chấm, lệnh nhận sửa, lệnh nộp lại. Chạy tay trên box thì tự đọc /root/.secrets/mine-tg.env. */
async function tgNoiDung() {
  if (!process.env.TG_BOT_TOKEN) try { for (const l of fs.readFileSync('/root/.secrets/mine-tg.env', 'utf8').split('\n')) { const m = l.match(/^(?:export\s+)?(TG_BOT_TOKEN|TG_CHAT)=["']?([^"'\s]+)/); if (m) process.env[m[1]] = m[2]; } } catch { /* không phải box */ }
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  const tg = async (m, b) => { const j = await (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...(m === 'sendMessage' ? { link_preview_options: { is_disabled: true } } : {}), ...b }), signal: AbortSignal.timeout(15000) })).json(); if (!j.ok) console.error(`✗ telegram ${m}: ${j.description}`); return j; };   // mọi tin của phòng tắt khung xem trước link (anh 17/10/2026)
  const tep = path.join(DATA(), 'noi-dung-tg.json'); let st = {}; try { st = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  if (!st.topic) { const j = await tg('createForumTopic', { name: '📝 Nội dung' }); if (j.ok) st.topic = j.result.message_thread_id; fs.writeFileSync(tep, JSON.stringify(st)); }
  const bao = (text, tin, nut) => tg('sendMessage', { message_thread_id: st.topic, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(tin ? { reply_parameters: { message_id: tin, allow_sending_without_reply: true } } : {}), ...(nut ? { reply_markup: nut } : {}) });
  return { tg, st, bao };
}

/** Người phụ trách bắt đầu sửa (anh 17/10/2026: "nhận sửa thì cũng báo lên tele để nhìn thấy nó bắt đầu làm"): đánh dấu nhận + tin trả lời ngay dưới tin chấm. */
export async function nhanSua(url, nguoi) {
  const x = docJson(TRA()).find((v) => v.url === url && (!nguoi || v.phu_trach === nguoi));
  if (!x) throw new Error(`không có bài chờ sửa ${url}${nguoi ? ` của ${nguoi}` : ''} (xem --tra-ve)`);
  x.nhan_luc = new Date().toISOString(); fs.writeFileSync(path.join(TRA(), `${x.id}.json`), JSON.stringify(x, null, 1));
  const { bao } = await tgNoiDung();
  await bao(`🛠 <b>${esc(tenNguoi(x.phu_trach))}</b> nhận sửa ${esc(url)} · lượt ${x.luot}/${TRAN_LUOT}\n${CTY_LINK}`, x.tin);
  return x;
}

// ĐƯA LÊN SAU KHI DUYỆT (anh 17/10/2026: "Long là con claude nội bộ — nhận bài, xử lý, lưu nội bộ. Trưởng phòng Nội dung là AI bên ngoài, cho phép
// commit (và cũng phải báo cáo)"): Long nộp BẢN NHÁP + mã commit nội bộ, không deploy. Ngọc DUYỆT bản đó → cho-dang/<id>.json; script cố định trên
// máy của site (không phải mô hình) đưa đúng commit đó lên rồi báo `--da-dang` → tin Telegram dưới tên Ngọc. Bản chưa DUYỆT không bao giờ lên trang.
const DANG = () => path.join(VP(), 'cho-dang');
export const choDang = () => docJson(DANG());
export async function daDang(id, ok, ghi = '') {
  const f = path.join(DANG(), `${id}.json`); if (!fs.existsSync(f)) throw new Error(`không có bài chờ đưa lên ${id}`);
  const x = JSON.parse(fs.readFileSync(f, 'utf8'));
  const { bao } = await tgNoiDung();
  await bao(ok ? `🚀 <b>${esc(tenNguoi('ngoc'))}</b> đã cho đưa lên ${esc(x.url)} · bản ${esc(String(x.ban).slice(0, 8))} (${esc(tenNguoi(x.tu))} sửa)${ghi ? `\n${esc(ghi)}` : ''}\n${CTY_LINK}`
    : `⚠️ <b>${esc(tenNguoi('ngoc'))}</b>: đưa ${esc(x.url)} lên KHÔNG được · bản ${esc(String(x.ban).slice(0, 8))}\nLý do: ${esc(ghi || 'không rõ')}\n${CTY_LINK}`, x.tin);
  if (ok) fs.rmSync(f); else { x.loi = ghi; x.loi_luc = new Date().toISOString(); fs.writeFileSync(f, JSON.stringify(x, null, 1)); }
  return x;
}

/** Người phụ trách chưa bắt đầu được (vd repo đang có việc dở chưa commit của phiên khác): báo MỘT lần lên Telegram, kèm nút cho anh chọn
 *  "nhận luôn việc dở" hay "đợi" (anh 17/10/2026: bấm rồi mà không thấy Long — Long đợi im lặng). */
export async function choSua(url, nguoi, lyDo, tep = []) {
  const x = docJson(TRA()).find((v) => v.url === url && (!nguoi || v.phu_trach === nguoi));
  if (!x) throw new Error(`không có bài chờ sửa ${url}`);
  if (x.cho_luc) return x;
  x.cho_luc = new Date().toISOString(); x.cho_tep = tep; fs.writeFileSync(path.join(TRA(), `${x.id}.json`), JSON.stringify(x, null, 1));   // cho_tep: đúng tệp anh thấy lúc bấm — Long chỉ nhận chừng đó
  const { bao } = await tgNoiDung();
  await bao(`⏳ <b>${esc(tenNguoi(x.phu_trach))}</b> chưa bắt đầu sửa ${esc(url)}\n${esc(lyDo)}`, x.tin,
    { inline_keyboard: [[{ text: `🧩 Cho ${tenNguoi(x.phu_trach).split(' ')[0]} nhận luôn việc dở`, callback_data: `nd:nhando:${x.id}` }, { text: '⏳ Đợi phiên kia', callback_data: `nd:doi:${x.id}` }]] });
  return x;
}

/** Người phụ trách không sửa trọn được (thiếu video thật, lỗi, quá giờ): đánh dấu dừng — máy không thử lại bài này — và báo Telegram. */
export async function dungSua(url, nguoi, lyDo) {
  const x = docJson(TRA()).find((v) => v.url === url && (!nguoi || v.phu_trach === nguoi));
  if (!x) throw new Error(`không có bài chờ sửa ${url}`);
  x.dung = String(lyDo || 'không rõ'); x.dung_luc = new Date().toISOString(); fs.writeFileSync(path.join(TRA(), `${x.id}.json`), JSON.stringify(x, null, 1));
  const { bao } = await tgNoiDung();
  await bao(`⚠️ <b>${esc(tenNguoi(x.phu_trach))}</b> dừng sửa ${esc(url)} · lượt ${x.luot}/${TRAN_LUOT}\nLý do: ${esc(x.dung)}\n${CTY_LINK}`, x.tin);
  return x;
}

/** Bài trả về người phụ trách (tra-ve/<id>.json). */
const traVe = (x) => { fs.mkdirSync(TRA(), { recursive: true }); fs.writeFileSync(path.join(TRA(), `${x.id}.json`), JSON.stringify({ ...x, luc: new Date().toISOString() }, null, 1)); };
/** Nút anh quyết dưới tin "Hết 3/3 lượt" (anh 17/10/2026: "tao quyết ở đây kiểu gì?"). id = bản chấm cuối (da-kiem/<id>.json). */
export const nutQuyet = (id) => ({ inline_keyboard: [[{ text: `🔓 Cho sửa thêm ${TRAN_LUOT} lượt`, callback_data: `nd:mo:${id}` }, { text: '✋ Dừng hẳn bài này', callback_data: `nd:dung:${id}` }]] });
/** Anh bấm nút quyết: mở → đếm lại từ 0 + trả về người phụ trách theo nhận xét lần chấm cuối; dừng → giữ khoá. Trả câu báo. */
export function quyetBai(lenh, id, ai = 'Anh') {
  if (lenh === 'nhando' || lenh === 'doi') {   // id = bài trả về (tra-ve/<id>.json)
    const ft = path.join(TRA(), `${id}.json`); if (!fs.existsSync(ft)) throw new Error('bài này không còn chờ sửa');
    const x = JSON.parse(fs.readFileSync(ft, 'utf8')), ten = tenNguoi(x.phu_trach);
    if (lenh === 'doi') return `⏳ ${esc(ai)} cho <b>${esc(ten)}</b> đợi phiên kia xong việc dở.`;
    x.nhan_do = true; fs.writeFileSync(ft, JSON.stringify(x, null, 1));
    return `🧩 ${esc(ai)} cho <b>${esc(ten)}</b> nhận luôn việc dở: commit phần đang dở rồi sửa tiếp ở lượt kế (≤ 5 phút).`;
  }
  const f = path.join(XONG(), `${id}.json`); if (!fs.existsSync(f)) throw new Error(`không thấy lần chấm ${id}`);
  const b = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (lenh === 'dung') return `✋ ${esc(ai)} dừng hẳn ${esc(b.url)} — giữ khoá, không sửa tiếp.`;
  if (soLuot(b.url) < TRAN_LUOT) return `${esc(b.url)} đã được mở rồi.`;
  moKhoa(b.url); const pt = phuTrach(b.url);
  if (pt) traVe({ id: `${Date.now()}-mo`, url: b.url, phu_trach: pt, luot: 0, ket: b.ket, kq: b.kq, tin: b.tin });
  return `🔓 ${esc(ai)} cho sửa thêm ${TRAN_LUOT} lượt ${esc(b.url)}${pt ? ` — giao <b>${esc(tenNguoi(pt))}</b> sửa theo lần chấm cuối` : ' — chưa có người phụ trách'}.`;
}

/** Link http(s) trong một tin Telegram: chữ trần + link ẩn sau chữ (text_link). Trùng thì một. */
export const linkTrong = (m) => [...new Set([...(String(m.text || m.caption || '').match(/https?:\/\/[^\s<>"']+/g) || []),
  ...(m.entities || m.caption_entities || []).filter((e) => e.type === 'text_link').map((e) => e.url)].map((u) => u.replace(/[).,;]+$/, '')))];

/** Nhịp (box3, Ngọc): xử mọi bài trong hàng chờ. env: TG_BOT_TOKEN, TG_CHAT (/root/.secrets/mine-tg.env). */
export async function nhipKiemBai(nguoi, { ten = nguoi, model = '', phong = 'noi-dung' } = {}) {
  const { tg, st, bao } = await tgNoiDung();
  // Anh gửi link vào chủ đề 📝 Nội dung (anh 17/10/2026: "tao gửi bài cần chấm vào tele … chỉ cần link") → nộp hàng chờ, chấm ngay lượt này
  const { gomTin, moHop } = await import('./tg-phong.mjs'); await gomTin(tg);
  for (const x of moHop(phong)) {
    const c = x.callback_query, m = x.message; x.xong();
    if (c && /^nd:(mo|dung|nhando|doi):/.test(c.data || '')) {
      const [, lenh, id] = c.data.split(':'), ai = c.from?.first_name || c.from?.username || 'Anh';
      try { const cau = quyetBai(lenh, id, ai); await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đã nhận' }); await tg('editMessageReplyMarkup', { message_id: c.message.message_id, reply_markup: { inline_keyboard: [] } }); await bao(cau, c.message.message_id); }
      catch (e) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: e.message, show_alert: true }); }
      continue;
    }
    if (!m || m.from?.is_bot) continue;
    for (const url of linkTrong(m)) {
      try { nopBai({ url, tu: m.from?.first_name || m.from?.username || 'Anh' }); await bao(`📥 <b>${esc(tenNguoi(nguoi))}</b> nhận bài ${esc(url)} — chấm ngay`, m.message_id); }
      catch (e) { await bao(`⛔ Không nhận ${esc(url)}: ${esc(e.message)}`, m.message_id); }
    }
  }
  const cho = fs.existsSync(CHO()) ? fs.readdirSync(CHO()).filter((f) => f.endsWith('.json')).sort() : [];
  if (!cho.length) return 'hàng chờ trống';
  if (!model) throw new Error(`${nguoi} chưa có model trong SOUL.md`);
  const { vpBao } = await import('./vp.mjs'); fs.mkdirSync(XONG(), { recursive: true });
  const ra = [];
  for (const f of cho) {
    const b = JSON.parse(fs.readFileSync(path.join(CHO(), f), 'utf8'));
    await vpBao(nguoi, 'lam', `kiểm bài ${b.url || 'nháp'}`);
    let html = b.html;
    if (!html) { const r = await fetch(`${b.url}${b.url.includes('?') ? '&' : '?'}kiem=${Date.now()}`, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'cty-noi-dung/1' } }).catch(() => null); html = r?.ok ? await r.text() : null; }
    if (!html) { ra.push(`${b.url}: không tải được`); continue; }   // để nguyên trong hàng chờ, lượt sau thử lại
    const d = mayDo(html), kq = await cham(nguoi, model, phong, b.url, d);
    if (!kq) { ra.push(`${b.url}: mô hình hỏng`); continue; }
    kq.diem = diemCuoi(kq, d); const ket = ketCuoi(kq, d), { chu, ...may } = d;
    const j = await tg('sendMessage', { message_thread_id: st.topic, text: tinKiem({ tu: b.tu, url: b.url, kq, d, ket, ten }), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    fs.writeFileSync(path.join(XONG(), f), JSON.stringify({ ...b, html: undefined, kq, may, ket, tin: j.ok ? j.result.message_id : null, xong: new Date().toISOString() }, null, 1));
    if (ket === 'DUYET' && b.ban) {
      fs.mkdirSync(DANG(), { recursive: true }); fs.writeFileSync(path.join(DANG(), `${b.id}.json`), JSON.stringify({ id: b.id, url: b.url, tu: b.tu, ban: b.ban, tin: j.ok ? j.result.message_id : null, luc: new Date().toISOString() }, null, 1));
      await tg('sendMessage', { message_thread_id: st.topic, parse_mode: 'HTML', reply_parameters: j.ok ? { message_id: j.result.message_id } : undefined, text: `✅ Duyệt bản ${esc(b.ban.slice(0, 8))} — máy đưa lên trang ở lượt kế (≤ 5 phút)` });
    }
    const pt = phuTrach(b.url), luot = soLuot(b.url);
    if (ket !== 'DUYET') {
      const het = luot >= TRAN_LUOT, tenPt = pt ? tenNguoi(pt) : null;
      if (!het && pt) traVe({ id: b.id, url: b.url, phu_trach: pt, luot, ket, kq, tin: j.ok ? j.result.message_id : null });
      await tg('sendMessage', { message_thread_id: st.topic, reply_parameters: j.ok ? { message_id: j.result.message_id } : undefined, parse_mode: 'HTML',
        ...(het ? { reply_markup: nutQuyet(b.id) } : {}),
        text: het ? `⛔ <b>Hết ${TRAN_LUOT}/${TRAN_LUOT} lượt</b> mà ${esc(b.url)} chưa DUYỆT — anh quyết bằng nút dưới đây.`
          : pt ? `↩️ Giao <b>${esc(tenPt)}</b> sửa theo nhận xét trên rồi nộp lại · lượt ${luot}/${TRAN_LUOT}` : `↩️ ${esc(b.url)} chưa có người phụ trách (PHU_TRACH trong kiem-bai.mjs) · lượt ${luot}/${TRAN_LUOT}` });
    }
    fs.unlinkSync(path.join(CHO(), f));
    ra.push(`${b.url || 'nháp'} → ${ket}`);
  }
  await vpBao(nguoi, 'xong', 'hết bài chờ');
  return ra.join(' · ');
}

if (process.argv[1]?.endsWith('kiem-bai.mjs')) {
  const a = process.argv.slice(2), lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (a.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    const nham = '<html><body><main><div class="prose"><h1>X</h1><p>We delve into it — fast.</p><h2>Questions people ask</h2></div></main></body></html>';
    const d = mayDo(nham); t.equal(d.gach_dai, 1); t.deepEqual(d.tu_may, ['delve']); t.ok(d.co_faq && !d.co_neu_da_lo && d.chan_cung.length === 5, 'gạch dài + từ máy + không hình + không ảnh + không video');
    t.equal(ketCuoi({ ket_luan: 'DUYET' }, d), 'SUA_LAI', 'chặn cứng kéo DUYỆT xuống SỬA LẠI');
    t.equal(ketCuoi({ ket_luan: 'DUYET' }, mayDo('<main><div class="prose"><p>Plain words.</p></div></main>')), 'SUA_LAI', 'tường chữ không hình không được DUYỆT');
    const du = '<main><div class="prose"><img src=a.png alt=x><p>Plain words.</p><div class="tin">Hi</div><iframe src="https://www.youtube.com/embed/x"></iframe><h2>Questions people ask</h2></div></main>';
    t.equal(ketCuoi({ ket_luan: 'DUYET' }, mayDo(du)), 'DUYET');
    t.equal(ketCuoi({ ket_luan: 'DUYET' }, mayDo(du.replace('<img src=a.png alt=x>', ''))), 'SUA_LAI', 'khung ví dụ không thay được ảnh thật');
    t.equal(ketCuoi({ ket_luan: 'DUYET' }, mayDo(du.replace(/<iframe[\s\S]*?<\/iframe>/, '<iframe src="https://maps.google.com/x"></iframe>'))), 'SUA_LAI', 'iframe bản đồ không tính là video');
    t.equal(ketCuoi({ ket_luan: 'DUYET' }, mayDo(du.replace('Questions people ask', 'Book now'))), 'SUA_LAI', 'thiếu FAQ');
    t.equal(diemCuoi({ diem: 10 }, mayDo(du.replace('<img src=a.png alt=x>', ''))), 6, 'chặn cứng thì không 10/10');
    const tin = tinKiem({ tu: 'A', url: 'https://x.com/a/', kq: { thieu: ['cảnh mở'], thua: [], giong: [], diem: 3, ket_luan: 'KHONG_DUYET', tom_tat: 'sơ sài' }, d, ket: 'KHONG_DUYET' });
    t.ok(tin.startsWith('📝 <b>A</b> gửi bài https://x.com/a/') && tin.includes('Thiếu') && tin.includes('⛔ KHÔNG DUYỆT') && tin.includes('chặn cứng'));
    const u = 'https://ratesbyroom.com/a/', ds = (...k) => k.map((ket) => ({ url: u, ket }));
    t.equal(soLuot(u, ds('SUA_LAI', 'KHONG_DUYET')), 2); t.equal(soLuot(u, ds('SUA_LAI', 'DUYET', 'SUA_LAI')), 1, 'DUYỆT đếm lại');
    t.equal(soLuot(u, ds('SUA_LAI', 'SUA_LAI', 'SUA_LAI', 'MO_KHOA')), 0, 'mở khoá đếm lại'); t.equal(soLuot(u, [{ url: 'https://x.com/', ket: 'SUA_LAI' }]), 0, 'url khác không tính');
    t.equal(phuTrach('https://bath.ratesbyroom.com/x'), 'long'); t.equal(phuTrach('https://evilratesbyroom.com/'), null); t.equal(tenNguoi('long'), 'Long [Xưởng Aff]'); t.equal(tenNguoi('Ngọc'), 'Ngọc [Nội dung]'); t.equal(tenNguoi('Claude (phiên X)'), 'Claude (phiên X)');
    t.deepEqual(linkTrong({ text: 'chấm giúp https://ratesbyroom.com/a/ và https://ratesbyroom.com/a/).' }), ['https://ratesbyroom.com/a/']);
    t.deepEqual(linkTrong({ text: 'bài này', entities: [{ type: 'text_link', url: 'https://x.com/b' }] }), ['https://x.com/b']); t.deepEqual(linkTrong({ text: 'không link' }), []);
    { const os = await import('node:os'); process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kiem-bai-'));
      fs.mkdirSync(XONG(), { recursive: true }); const u2 = 'https://ratesbyroom.com/q/';
      for (const i of [1, 2, 3]) fs.writeFileSync(path.join(XONG(), `${1700000000000 + i}-x.json`), JSON.stringify({ id: `${1700000000000 + i}-x`, url: u2, ket: 'SUA_LAI', kq: { thieu: ['ảnh'], thua: [], giong: [] }, tin: 9 }));
      const id3 = '1700000000003-x'; t.ok(quyetBai('dung', id3).startsWith('✋')); t.equal(soLuot(u2), 3, 'dừng hẳn giữ khoá');
      t.ok(quyetBai('mo', id3).includes('Long [Xưởng Aff]')); t.equal(soLuot(u2), 0, 'mở lại đếm từ 0'); t.equal(docJson(TRA()).length, 1, 'trả về Long theo lần chấm cuối');
      t.ok(quyetBai('mo', id3).includes('đã được mở'), 'bấm hai lần không mở hai lần');
      const tra = docJson(TRA())[0]; t.ok(quyetBai('doi', tra.id).startsWith('⏳')); t.ok(!docJson(TRA())[0].nhan_do, 'đợi thì không nhận việc dở');
      t.ok(quyetBai('nhando', tra.id).startsWith('🧩')); t.equal(docJson(TRA())[0].nhan_do, true, 'nhận việc dở ghi cờ cho Long');
      t.equal(nutQuyet(id3).inline_keyboard[0][0].callback_data.length <= 64, true); }
    console.log('kiem-bai: tự kiểm đạt'); process.exit(0);
  }
  if (lay('--mo-khoa')) { moKhoa(lay('--mo-khoa')); console.log(`đã mở khoá ${lay('--mo-khoa')} — được thêm ${TRAN_LUOT} lượt`); }
  if (lay('--nhan')) { const x = await nhanSua(lay('--nhan'), lay('--nguoi')); console.log(`đã nhận sửa ${x.url} (lượt ${x.luot}/${TRAN_LUOT}) — đã báo Telegram`); }
  if (a.includes('--cho-dang')) console.log(JSON.stringify(choDang().filter((x) => !x.loi)));
  if (lay('--da-dang')) { await daDang(lay('--da-dang'), lay('--ket') === 'ok', lay('--ghi') || ''); console.log(`đã báo ${lay('--da-dang')}`); }
  if (lay('--hoi-quyet')) {   // gửi lại tin quyết có nút cho một bài đã hết lượt (id = lần chấm cuối)
    const b = JSON.parse(fs.readFileSync(path.join(XONG(), `${lay('--hoi-quyet')}.json`), 'utf8')); const { tg, st } = await tgNoiDung();
    await tg('sendMessage', { message_thread_id: st.topic, parse_mode: 'HTML', reply_markup: nutQuyet(b.id), ...(b.tin ? { reply_parameters: { message_id: b.tin, allow_sending_without_reply: true } } : {}),
      text: `⛔ <b>Hết ${TRAN_LUOT}/${TRAN_LUOT} lượt</b> mà ${esc(b.url)} chưa DUYỆT — anh quyết bằng nút dưới đây.` }); console.log('đã gửi nút quyết');
  }
  if (lay('--cho')) { await choSua(lay('--cho'), lay('--nguoi'), lay('--ly-do') || '', JSON.parse(lay('--tep') || '[]')); console.log(`đã báo chờ ${lay('--cho')}`); }
  if (lay('--dung')) { await dungSua(lay('--dung'), lay('--nguoi'), lay('--ly-do')); console.log(`đã báo dừng ${lay('--dung')}`); }
  if (a.includes('--tra-ve')) {   // việc sửa đang chờ người phụ trách: node worker/kiem-bai.mjs --tra-ve [lan]
    const ai = lay('--tra-ve'), ds = docJson(TRA()).filter((x) => !ai || ai.startsWith('--') || x.phu_trach === ai);
    if (a.includes('--json')) console.log(JSON.stringify(ds)); else console.log(ds.length ? ds.map((x) => `${x.url} · ${x.phu_trach} · lượt ${x.luot}/${TRAN_LUOT} · ${x.ket}\n  thiếu: ${x.kq.thieu.join(' | ') || '-'}\n  thừa: ${x.kq.thua.join(' | ') || '-'}\n  giọng: ${x.kq.giong.join(' | ') || '-'}`).join('\n') : 'không có bài nào chờ sửa');
  }
  if (lay('--nop') != null || lay('--html') != null) {
    const html = lay('--html') ? fs.readFileSync(lay('--html') === '-' ? 0 : lay('--html'), 'utf8') : null;   // '-' = đọc từ stdin (máy Mac đẩy bản nháp qua ssh)
    const url = lay('--nop') || '', tu = lay('--tu') || 'Không rõ', luot = soLuot(url);
    console.log(`đã nộp ${nopBai({ url, tu, html, ban: lay('--ban') })} — Phòng Nội dung kiểm ở nhịp kế (≤ 1 phút)`);
    if (luot) { const { bao } = await tgNoiDung().catch(() => ({})); await bao?.(`📤 <b>${esc(tenNguoi(tu))}</b> nộp lại ${esc(url)} · lượt ${luot + 1}/${TRAN_LUOT}\n${CTY_LINK}`); }
  }
}
