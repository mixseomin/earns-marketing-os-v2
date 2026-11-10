// THƯ KÝ TELEGRAM (anh 31/10/2026: "mọi câu hỏi trong tele thì phải có option để tao trả lời. Khi trả lời thì phải luôn có con nhận và xử lý + phản hồi").
// Nhận mọi thứ anh trả lời / nhắn mà KHÔNG có máy riêng của phòng xử (tg-phong.mjs gom: nút [✅ Đồng ý] [✖ Không] gắn tự động cho câu hỏi thiếu nút → hq:,
// tin chữ ở phòng chưa có máy đọc → bản sao). Mỗi tin: thả 👀 ngay (đã nhận) → trưởng phòng gốc (mô hình trong hồ sơ, phòng không có mô hình thì
// mô hình mặc định qua proxy công ty, ghi tiền) đọc câu hỏi gốc + câu anh, trả lời DƯỚI tin anh bằng tên mình → quyết định ghi <DATA>/quyet-dinh.jsonl →
// việc phải làm theo ý anh giao thợ máy (xem dưới).
// LỆNH PHẢI TỚI NGƯỜI CÓ TAY (anh 05/11/2026 "sao nó trả lời mõm… tao đã đồng ý, nó đã hiểu mà rồi lại hỏi lại"): hàng phong-thu của phòng không có máy nào lấy (Ngọc, Nguyên không có tay)
// → việc giờ vào hàng THỢ MÁY (anh:, may/tho-may.mjs — Claude Code iMac, nhận trước mọi việc, ≤ 5 phút), kết quả báo ngay dưới tin anh. Trả lời dưới tin của chính thợ máy = lệnh cho đúng việc đó, không qua mô hình.
// Không hứa việc máy chưa làm. Mua / gia hạn thợ máy không làm, báo lại giá + chỗ bấm. Gọi từ tg-nghe.mjs ngay sau gom tin.
//   node worker/thu-ky.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';
import { moHop, docNut, daTraLoi, phongCuaTopic } from './tg-phong.mjs';
import { giaoAnh, viecCuaTin, theoHang, HANG_HUY } from './tho-may-viec.mjs';
import { taskCuaTin, ghiPhanHoi } from './astrolas-tasks.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const MAC_DINH = 'fal:google/gemini-3.8-flash';
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fm = (loai, id) => { try { const f = loai === 'phong' ? `${id}.md` : `${id}/SOUL.md`; return parseFm(fs.readFileSync(path.join(GOC, 'cong-ty', loai, f), 'utf8')); } catch { return null; } };

/** Trưởng phòng: vai_truong_phong (id) → hoặc tên ở `truong:` khớp `ten:` hồ sơ cùng phòng. { id, ten, chuc, model, phongTen } | null. */
export function truongPhong(phong) {
  const p = fm('phong', phong); if (!p) return null;
  const ns = path.join(GOC, 'cong-ty', 'nhan-su'), ten0 = String(p.fm.truong ?? '').split(/[\s(·]/)[0];
  const id = p.fm.vai_truong_phong ? String(p.fm.vai_truong_phong) : fs.readdirSync(ns).find((d) => { const s = fm('nhan-su', d)?.fm; return s && String(s.phong) === phong && String(s.ten) === ten0; });
  const s = id && fm('nhan-su', id)?.fm; if (!s) return null;
  const model = String(s.model ?? '').trim(), dung = /^(fal|openrouter|anthropic|google|openai):|^claude-(?!code)/.test(model) ? model : MAC_DINH;   // claude-code / "không" → mô hình mặc định
  return { id, ten: String(s.ten), chuc: String(s.chuc_danh ?? ''), model: dung, phongTen: String(p.fm.ten ?? phong).replace(/\s*\(.*\)$/, ''), boi: p.body.slice(0, 1500) };
}

/** Một mục trong hộp thư ký → ngữ cảnh: { phong, mid (tin để trả lời dưới), topic, cau_hoi, anh, from }. null = bỏ (đã có phòng trả lời). */
export function nguCanh(x) {
  const c = x.callback_query, m = x.message;
  if (c) { const q = c.message ?? {}, so = docNut(q.message_id); return { phong: phongCuaTopic(q.message_thread_id ?? so?.topic) ?? x.phong_goc ?? null, mid: q.message_id, topic: q.message_thread_id ?? so?.topic, hoi_mid: q.message_id, cau_hoi: so?.chu ?? q.text ?? '', anh: c.data === 'hq:co' ? 'Đồng ý' : c.data === 'hq:khong' ? 'Không' : c.data, from: c.from }; }
  if (!m || daTraLoi(m.message_id)) return null;
  const goc = m.reply_to_message, so = goc && docNut(goc.message_id);
  // tệp anh gửi kèm (PDF tài liệu, ảnh): giữ mã tệp để tải khi tin đó là lệnh cho Thành
  const tep = m.document ? [{ id: m.document.file_id, ten: m.document.file_name || `tai-lieu-${m.message_id}` }] : m.photo?.length ? [{ id: m.photo.at(-1).file_id, ten: `anh-${m.message_id}.jpg` }] : [];
  return { phong: x.phong_goc && x.phong_goc !== '_khac' ? x.phong_goc : phongCuaTopic(m.message_thread_id), mid: m.message_id, topic: m.message_thread_id, hoi_mid: goc?.from?.is_bot ? goc.message_id : null, cau_hoi: goc?.from?.is_bot ? (so?.chu ?? goc.text ?? '') : '', anh: String(m.text ?? m.caption ?? ''), from: m.from, tep };
}

/** Tải tệp Telegram về box3 (bot tải được tới 20 MB). lay = fetch, tự kiểm thay bằng bản giả. Trả các đường dẫn đã lưu. */
export async function taiTep(tg, tep, dir, lay = fetch) {
  fs.mkdirSync(dir, { recursive: true });
  const ra = [];
  for (const t of tep) {
    const j = await tg('getFile', { file_id: t.id }); if (!j?.ok) throw new Error(`getFile ${t.ten}: ${j?.description ?? 'không rõ'}`);
    const r = await lay(`https://api.telegram.org/file/bot${process.env.TG_BOT_TOKEN}/${j.result.file_path}`); if (!r.ok) throw new Error(`tải ${t.ten}: http ${r.status}`);
    const f = path.join(dir, path.basename(t.ten).replace(/[^\p{L}\p{N}._ -]/gu, '_')); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); ra.push(f);
  }
  return ra;
}

async function hoiMoHinh(t, nc, goi = fetch) {
  const system = `Bạn là ${t.ten}, ${t.chuc} của ${t.phongTen} trong công ty AI của anh (Giám đốc). Anh vừa ${nc.cau_hoi ? 'trả lời câu hỏi của phòng bạn' : 'nhắn vào chủ đề phòng bạn'} trên Telegram.
Việc của bạn: hiểu anh muốn gì, trả lời anh NGẮN (1–3 câu, tiếng Việt, xưng "em", gọi "anh"), và nêu VIỆC phòng phải làm theo ý anh (nếu có).
Trung thực: bạn không có tay — việc anh giao sẽ chuyển thợ máy Mạnh làm ngay, đừng nói "đã làm", đừng hứa "phòng em sẽ làm". Mô tả VIỆC đủ rõ để Mạnh làm không cần hỏi lại (giữ nguyên ý anh). Câu anh chỉ là đồng ý suông không kèm việc gì phải làm thì viec = null.
Không hỏi lại trừ khi thật sự không hiểu; hỏi lại thì đặt câu hỏi có/không.
VỀ PHÒNG:\n${t.boi}
Trả DUY NHẤT JSON: {"tra_loi":"…","quyet":"co|khong|khac","viec":"… hoặc null"}`;
  const body = { model: t.model, max_tokens: 400, temperature: 0.2, system, messages: [{ role: 'user', content: `${nc.cau_hoi ? `CÂU HỎI CỦA PHÒNG:\n${nc.cau_hoi.replace(/<[^>]+>/g, '')}\n\n` : ''}ANH TRẢ LỜI: ${nc.anh}` }] };
  const r = await goi(`${process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862'}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': t.id, 'x-cty-luot': `thu-ky-${Date.now()}`, 'x-cty-phong': nc.phong }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const j = await r.json(); if (!r.ok) throw new Error(`${t.model}: ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  const txt = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  return { tra_loi: String(o.tra_loi || '').trim(), quyet: ['co', 'khong'].includes(o.quyet) ? o.quyet : 'khac', viec: o.viec && o.viec !== 'null' ? String(o.viec).trim() : null };
}

/** Xử mọi mục trong hộp thư ký. tg = Bot API (đã bọc ghiNut). Trả số mục đã xử. */
export async function xuThuKy(tg, { hoi = hoiMoHinh, lay = fetch } = {}) {
  let n = 0;
  for (const x of moHop('thu-ky')) {
    const nc = nguCanh(x); x.xong(); if (!nc) continue;
    try { await tg('setMessageReaction', { message_id: nc.from && x.message ? nc.mid : (x.callback_query?.message?.message_id ?? nc.mid), reaction: [{ type: 'emoji', emoji: '👀' }] }); } catch { /* cảm xúc hỏng không chặn */ }
    const tra0 = (text) => tg('sendMessage', { message_thread_id: nc.topic ?? undefined, parse_mode: 'HTML', text, reply_parameters: { message_id: nc.mid, allow_sending_without_reply: true } });
    // trả lời dưới tin của THỢ MÁY → lệnh cho đúng việc đó, về đúng người đang cầm (không qua trưởng phòng, không tốn lượt mô hình)
    // trả lời dưới tin báo của THÀNH (kỹ sư Astrolas) → làm lại đúng task đó ở lượt iMac kế tiếp
    const tk = taskCuaTin(nc.hoi_mid);
    if (tk) {
      if (/^(không|ko|k|no|thôi|bỏ qua|đừng)[\s.!]*$/i.test(nc.anh.trim())) { await tra0(`🛠 <b>Thành</b>: đã ghi anh không làm tiếp task #${tk}.`); n++; continue; }
      let tep = [];
      if (nc.tep.length) { try { tep = await taiTep(tg, nc.tep, path.join(DATA(), 'tep-anh', String(tk)), lay); } catch (e) { await tra0(`⚠️ <b>Thành</b>: chưa tải được tệp anh gửi (${esc(e.message)}), con chưa nhận lệnh này.`); n++; continue; } }
      const anh = nc.anh || (tep.length ? 'Anh gửi tài liệu kèm, đọc và làm tiếp.' : '');
      ghiPhanHoi(tk, anh, nc.mid, tep); await tra0(`🛠 <b>Thành</b> nhận: <i>${esc(anh.slice(0, 200))}</i>${tep.length ? ` + ${tep.length} tệp (${esc(tep.map((f) => path.basename(f)).join(', '))})` : ''} — làm lại task #${tk}, bắt đầu trong ≤ 2 phút, xong báo ngay dưới tin này.`); n++; continue;
    }
    // TRẢ LỜI DƯỚI TIN CỦA HUY (Kỹ sư Ethopex, hàng etp-sua.json — anh 10/11/2026: "câu đó chưa thành lệnh cho Huy … vẫn phải nhận và xử lý"): lệnh vào HÀNG HUY
    const vtHuy = theoHang(HANG_HUY, () => viecCuaTin(nc.hoi_mid));
    if (vtHuy) {
      const bo = /^(không|ko|k|no|thôi|bỏ qua|đừng)[\s.!]*$/i.test(nc.anh.trim());
      fs.appendFileSync(path.join(DATA(), 'quyet-dinh.jsonl'), `${JSON.stringify({ luc: new Date().toISOString(), phong: nc.phong, ai: 'huy', goc: vtHuy.khoa, cau_hoi: String(vtHuy.ket_qua ?? vtHuy.chu).slice(0, 500), anh: nc.anh, quyet: bo ? 'khong' : 'co' })}\n`);
      if (bo) { await tra0(`🔧 <b>Huy</b>: đã ghi anh không làm việc này (${esc(vtHuy.khoa)}).`); n++; continue; }
      const moi = theoHang(HANG_HUY, () => giaoAnh({ chu: `Anh trả lời về ${vtHuy.khoa}: ${nc.anh}`, cau_hoi: String(vtHuy.ket_qua ?? vtHuy.chu), anh: nc.anh, goc: vtHuy.goc ?? vtHuy.khoa, phong: nc.phong, tg: { topic: nc.topic ?? null, msg: nc.mid } }));
      await tra0(`🔧 <b>Huy</b> nhận lệnh anh: <i>${esc(nc.anh.slice(0, 200))}</i> — việc #${moi.id}, bắt đầu trong ≤ 5 phút, xong báo ngay dưới tin này.`); n++; continue;
    }
    const vt = viecCuaTin(nc.hoi_mid);
    if (vt) {
      const bo = /^(không|ko|k|no|thôi|bỏ qua|đừng)[\s.!]*$/i.test(nc.anh.trim());
      fs.appendFileSync(path.join(DATA(), 'quyet-dinh.jsonl'), `${JSON.stringify({ luc: new Date().toISOString(), phong: nc.phong, ai: 'manh', goc: vt.khoa, cau_hoi: String(vt.ket_qua ?? vt.chu).slice(0, 500), anh: nc.anh, quyet: bo ? 'khong' : 'co' })}\n`);
      if (bo) { await tra0(`🔧 <b>Mạnh</b>: đã ghi anh không làm việc này (${esc(vt.khoa)}).`); n++; continue; }
      const moi = giaoAnh({ chu: `Anh trả lời về ${vt.khoa}: ${nc.anh}`, cau_hoi: String(vt.ket_qua ?? vt.chu), anh: nc.anh, goc: vt.goc ?? vt.khoa, phong: nc.phong, tg: { topic: nc.topic ?? null, msg: nc.mid } });
      await tra0(`🔧 <b>Mạnh</b> nhận lệnh anh: <i>${esc(nc.anh.slice(0, 200))}</i> — việc #${moi.id}, bắt đầu trong ≤ 5 phút, xong báo ngay dưới tin này.`); n++; continue;
    }
    const t = nc.phong && truongPhong(nc.phong);
    const tra = (text) => tg('sendMessage', { message_thread_id: nc.topic ?? undefined, parse_mode: 'HTML', text, reply_parameters: { message_id: nc.mid, allow_sending_without_reply: true } });
    // KHÔNG PHÒNG NÀO NHẬN (chủ đề chung / tin script gửi thẳng không qua phòng) → giao THẲNG thợ máy Mạnh kèm câu hỏi gốc + câu anh, không trả lời "chưa có người xử"
    // (anh 08/11/2026: bảng tuần YNT hỏi "tăng 3 → 5 tập/tuần?", anh trả lời "Duyệt", thư ký đáp "chưa thuộc phòng nào" rồi bỏ đó — "không được hỏi mà không có ai nhận để xử lý")
    if (!t) {
      fs.appendFileSync(path.join(DATA(), 'quyet-dinh.jsonl'), `${JSON.stringify({ luc: new Date().toISOString(), phong: null, ai: 'manh', cau_hoi: nc.cau_hoi.replace(/<[^>]+>/g, '').slice(0, 500), anh: nc.anh, quyet: 'khac' })}\n`);
      const moi = giaoAnh({ chu: nc.cau_hoi ? `Anh trả lời tin máy gửi ở chủ đề chung: "${nc.anh}". Làm đúng ý anh với câu hỏi gốc (đọc câu hỏi để biết máy/script nào hỏi và việc cần đổi).` : `Anh nhắn ở chủ đề chung: ${nc.anh}`, cau_hoi: nc.cau_hoi.replace(/<[^>]+>/g, '').slice(0, 1500), anh: nc.anh, phong: null, tg: { topic: nc.topic ?? null, msg: nc.mid } });
      await tra(`🔧 <b>Mạnh</b> nhận: <i>${esc(nc.anh.slice(0, 200))}</i>${nc.cau_hoi ? ' (trả lời tin máy gửi)' : ''} — việc #${moi.id}, bắt đầu trong ≤ 5 phút, xong báo ngay dưới tin này.`); n++; continue;
    }
    let kq; try { kq = await hoi(t, nc); } catch (e) { await tra(`📥 <b>${esc(t.ten)} [${esc(t.phongTen.replace(/^Phòng /, ''))}]</b> đã nhận: <i>${esc(nc.anh.slice(0, 200))}</i> — nhưng chưa đọc được (${esc(e.message.slice(0, 120))}). Đã ghi vào hàng việc phòng.`); kq = { tra_loi: '', quyet: 'khac', viec: `Đọc và xử câu anh: ${nc.anh}` }; }
    const luc = new Date().toISOString();
    fs.appendFileSync(path.join(DATA(), 'quyet-dinh.jsonl'), `${JSON.stringify({ luc, phong: nc.phong, ai: t.id, cau_hoi: nc.cau_hoi.slice(0, 500), anh: nc.anh, ...kq })}\n`);
    // phòng Ethopex giao việc → Huy (kỹ sư riêng của phòng, anh 10/11/2026); phòng khác → Mạnh như cũ
    const laEtp = nc.phong === 'ethopex', nguoiSua = laEtp ? 'Huy' : 'Mạnh';
    const giaoX = { chu: kq.viec, cau_hoi: nc.cau_hoi.replace(/<[^>]+>/g, '').slice(0, 1500), anh: nc.anh, phong: nc.phong, tg: { topic: nc.topic ?? null, msg: nc.mid } };
    const giao = kq.viec ? (laEtp ? theoHang(HANG_HUY, () => giaoAnh(giaoX)) : giaoAnh(giaoX)) : null;
    if (kq.tra_loi || giao) await tra(`<b>${esc(t.ten)} [${esc(t.phongTen.replace(/^Phòng /, ''))}]</b>: ${esc(kq.tra_loi)}${giao ? `\n🔧 Đã giao <b>${nguoiSua}</b> (việc #${giao.id}, bắt đầu trong ≤ 5 phút, xong báo ngay dưới tin này): ${esc(kq.viec)}` : ''}`);
    n++;
  }
  return n;
}

if (process.argv[1]?.endsWith('thu-ky.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'); const os = await import('node:os');
  process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'thu-ky-')); fs.writeFileSync(path.join(DATA(), 'tai-nguyen-tg.json'), JSON.stringify({ topic: 2424 }));
  const tp = truongPhong('tai-nguyen'); t.equal(tp.id, 'nguyen'); t.equal(tp.model, MAC_DINH, 'Nguyên "model: không" → mô hình mặc định'); t.equal(truongPhong('sach').id, 'thao'); t.equal(truongPhong('khong-co'), null);
  const hop = path.join(DATA(), 'tg-hop', 'thu-ky'); fs.mkdirSync(hop, { recursive: true });
  fs.mkdirSync(path.join(DATA(), 'tg-hop'), { recursive: true }); fs.writeFileSync(path.join(DATA(), 'tg-hop', 'nut.json'), JSON.stringify({ 700: { kb: [[{ text: '✅ Đồng ý', callback_data: 'hq:co' }]], topic: 2424, chu: 'Khoá 2proxy …08wY còn 2 ngày — anh quyết gia hạn hay bỏ' } }));
  fs.writeFileSync(path.join(hop, '1.json'), JSON.stringify({ update_id: 1, callback_query: { id: null, data: 'hq:co', from: { first_name: 'D' }, message: { message_id: 700, message_thread_id: 2424 } } }));
  fs.writeFileSync(path.join(hop, '2.json'), JSON.stringify({ update_id: 2, phong_goc: 'tai-nguyen', message: { message_id: 80, message_thread_id: 2424, text: 'sao box3 quá tải vậy', from: { first_name: 'D' } } }));
  fs.writeFileSync(path.join(hop, '3.json'), JSON.stringify({ update_id: 3, phong_goc: '_khac', message: { message_id: 81, message_thread_id: 2127, text: 'https://youtu.be/x', from: { first_name: 'D' } } }));
  const gui = [], hoiDs = []; const tg = async (m, b) => { gui.push([m, b]); return { ok: true, result: { message_id: 900 } }; };
  const hoi = async (tt, nc) => { hoiDs.push(nc); return nc.anh === 'Đồng ý' ? { tra_loi: 'Em ghi anh duyệt gia hạn khoá …08wY.', quyet: 'co', viec: 'Gia hạn khoá 2proxy …08wY (anh duyệt 31/10)' } : { tra_loi: 'Postgres spy chạy song song nặng, em đang theo dõi.', quyet: 'khac', viec: null }; };
  t.equal(await xuThuKy(tg, { hoi }), 3);
  t.equal(hoiDs[0].cau_hoi.slice(0, 4), 'Khoá', 'thư ký đọc được câu hỏi gốc'); t.equal(hoiDs[0].phong, 'tai-nguyen');
  const tin = gui.filter(([m]) => m === 'sendMessage').map(([, b]) => b);
  t.ok(tin[0].text.startsWith('<b>Nguyên [Tài nguyên]</b>: Em ghi') && tin[0].text.includes('Đã giao <b>Mạnh</b>') && tin[0].reply_parameters.message_id === 700, 'trả lời dưới câu hỏi, giao thợ máy');
  const hang0 = JSON.parse(fs.readFileSync(path.join(DATA(), 'tho-may.json'), 'utf8')).hang; t.ok(hang0.some((v) => /^anh:/.test(v.khoa) && v.tt === 'cho' && v.anh === 'Đồng ý'), 'việc vào hàng thợ máy'); t.equal(fs.readFileSync(path.join(DATA(), 'quyet-dinh.jsonl'), 'utf8').trim().split('\n').length, 3, 'sổ quyết định: cả mục không phòng (giao Mạnh) cũng ghi');
  t.ok(tin[2].text.includes('Mạnh</b> nhận') && JSON.parse(fs.readFileSync(path.join(DATA(), 'tho-may.json'), 'utf8')).hang.some((v) => v.anh === 'https://youtu.be/x'), 'chủ đề không phòng: giao thẳng thợ máy, không bỏ lửng'); t.ok(gui.some(([m]) => m === 'setMessageReaction'), 'thả 👀 khi nhận');
  { // trả lời dưới báo cáo của thợ máy → lệnh cho đúng việc, không hỏi mô hình; việc cùng máy đang chờ gộp lại
    const f = path.join(DATA(), 'tho-may.json'), s0 = JSON.parse(fs.readFileSync(f, 'utf8')); s0.hang.push({ id: 50, khoa: 'dang:lo|mil|facebook', tt: 'ket', chu: 'lỡ', ket_qua: 'Hết video, cần anh quyết', tin_bao: 777, luc: '2026-11-04T17:00:00Z', tg: {} }, { id: 51, khoa: 'dang:lo|mil|fb_anh', tt: 'cho', chu: 'lỡ', luc: '2026-11-04T17:00:00Z', tg: {} }, { id: 52, khoa: 'dang:lo|mil|x', tt: 'ket', chu: 'lỡ', ket_qua: 'x', tin_bao: 778, luc: '2026-11-04T17:00:00Z', tg: {} }); fs.writeFileSync(f, JSON.stringify(s0));
    fs.writeFileSync(path.join(hop, '10.json'), JSON.stringify({ update_id: 10, phong_goc: 'noi-dung', message: { message_id: 90, message_thread_id: 2307, text: 'Sx thêm video cho', from: { first_name: 'D' }, reply_to_message: { message_id: 777, from: { is_bot: true }, text: '🔧 Máy đăng tự sửa' } } }));
    fs.writeFileSync(path.join(hop, '11.json'), JSON.stringify({ update_id: 11, phong_goc: 'noi-dung', message: { message_id: 91, message_thread_id: 2307, text: 'ko', from: { first_name: 'D' }, reply_to_message: { message_id: 778, from: { is_bot: true }, text: '🔧' } } }));
    const dem = hoiDs.length; gui.length = 0; t.equal(await xuThuKy(tg, { hoi }), 2); t.equal(hoiDs.length, dem, 'không qua mô hình');
    const s1 = JSON.parse(fs.readFileSync(f, 'utf8')).hang, le = s1.filter((v) => v.goc === 'dang:lo|mil|facebook'); t.equal(le.length, 1); t.equal(le[0].anh, 'Sx thêm video cho'); t.equal(le[0].tg.msg, 90, 'kết quả báo dưới tin anh'); t.equal(s1.find((v) => v.id === 51).tt, 'gop', 'việc cùng máy không chạy để hỏi lại');
    const m0 = gui.filter(([m]) => m === 'sendMessage').map(([, b]) => b.text); t.ok(m0[0].includes('Mạnh</b> nhận lệnh') && m0[1].includes('không làm')); }
  { // anh trả lời dưới tin của Thành bằng PDF không kèm chữ → tải về, lệnh làm lại có đường dẫn tệp
    fs.writeFileSync(path.join(DATA(), 'astrolas-tasks.json'), JSON.stringify({ tin: { 555: 4517 }, phan_hoi: [] }));
    fs.writeFileSync(path.join(hop, '12.json'), JSON.stringify({ update_id: 12, phong_goc: 'astrolas', message: { message_id: 95, message_thread_id: 4241, document: { file_id: 'F1', file_name: 'Brennan ch16.pdf' }, from: { first_name: 'D' }, reply_to_message: { message_id: 555, from: { is_bot: true } } } }));
    const tg2 = async (m, b) => (m === 'getFile' ? { ok: true, result: { file_path: 'documents/f.pdf' } } : tg(m, b)), lay = async () => new Response('%PDF-1.4 thu');
    gui.length = 0; t.equal(await xuThuKy(tg2, { hoi, lay }), 1);
    const ph = JSON.parse(fs.readFileSync(path.join(DATA(), 'astrolas-tasks.json'), 'utf8')).phan_hoi[0];
    t.equal(ph.task, 4517); t.equal(ph.tep.length, 1); t.equal(fs.readFileSync(ph.tep[0], 'utf8'), '%PDF-1.4 thu', 'PDF đã tải về'); t.ok(ph.anh.includes('tài liệu'), 'không có chữ vẫn thành lệnh');
    t.ok(gui.some(([m, b]) => m === 'sendMessage' && b.text.includes('1 tệp (Brennan ch16.pdf)')), 'báo đã nhận tệp'); }
  console.log('thu-ky: tự kiểm đạt'); process.exit(0);
}
