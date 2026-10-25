// NÚT "🚀 Máy đăng <nền>" dưới tin "📤 tới ngày cần đăng" (anh 22/10/2026: "trên tele cho phép mày bấm tự Publish lên cho sp cụ thể").
// scripts/bao-sp-telegram.mjs gửi nút sp:<nền>:<UUID sổ products>. Bấm = ghi lệnh máy (lenh-may.mjs taoLenh, tham = UUID) → máy theo LENH_MAY (nhan-lenh.mjs,
// mỗi 60 giây) chạy đúng một sản phẩm → baoKetLenh báo kết quả ngay dưới tin (xong / lỗi / máy chưa nhận sau 5 phút), lỗi thì kèm nút thử lại.
// Gọi từ tg-nghe.mjs mỗi vòng. Mỗi lần bấm = một lượt; bấm khi lượt trước còn chờ / đang chạy thì taoLenh từ chối.
import fs from 'node:fs';
import path from 'node:path';
import { moHop } from './tg-phong.mjs';
import { taoLenh, dsLenh, trangLenh, LENH_MAY } from './lenh-may.mjs';

export const NEN_LENH = { gum: { lenh: 'sach:gumroad', ten: 'Gumroad' } };
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const THU = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'may', 'lenh');
export const nutDang = (nen, id) => ({ inline_keyboard: [[{ text: `🚀 Máy đăng ${NEN_LENH[nen].ten}`, callback_data: `sp:${nen}:${id}` }]] });
const tra = (tg, bao, text, extra = {}) => tg('sendMessage', { message_thread_id: bao?.topic ?? undefined, text, parse_mode: 'HTML', ...(bao?.tin ? { reply_parameters: { message_id: bao.tin, allow_sending_without_reply: true } } : {}), ...extra });

export async function xuNutSp(tg, dir = THU()) {
  let n = 0;
  for (const x of moHop('sp')) {
    const c = x.callback_query; x.xong(); if (!c) continue;
    const [, nen, id] = String(c.data).split(':'), N = NEN_LENH[nen], m = c.message, bao = { tin: m?.message_id ?? null, topic: m?.message_thread_id ?? null };
    const ten = esc((m?.text ?? '').split('\n')[0].replace(/^\S+\s*/, '') || id), ai = esc(c.from?.first_name || 'Anh');
    const r = N ? taoLenh(N.lenh, `tg:${c.from?.id ?? '?'}`, dir, Date.now(), { tham: id, bao }) : { loi: `nút lạ "${esc(c.data)}"` };
    await tra(tg, bao, r.loi ? `⚠️ Chưa giao được: ${esc(r.loi)}` : `▶ ${ai} giao máy đăng ${N.ten}: <b>${ten}</b>. ${LENH_MAY[N.lenh]?.may ?? 'Máy'} nhận trong ~1 phút, xong báo ngay dưới tin này.`);
    n++;
  }
  return n;
}

/** Lệnh có `bao` (giao từ Telegram) đã xong / lỗi / máy chưa nhận quá 5 phút → báo một lần dưới tin, đánh dấu da_bao. */
export async function baoKetLenh(tg, dir = THU(), gio = Date.now()) {
  let n = 0;
  for (const x of dsLenh(dir)) {
    if (!x.bao || x.da_bao) continue;
    const h = trangLenh(x, gio); if (!['xong', 'loi', 'ngu', 'chet'].includes(h)) continue;
    const nen = Object.keys(NEN_LENH).find((k) => NEN_LENH[k].lenh === x.lenh), lai = nen && x.tham ? { reply_markup: nutDang(nen, x.tham) } : {};
    const text = { xong: `✅ Máy chạy xong: ${esc(x.ket ?? '')}`, loi: `✗ Máy đăng lỗi: ${esc(x.ket ?? '')}`, ngu: `⚠️ ${LENH_MAY[x.lenh]?.may ?? 'Máy'} chưa nhận lệnh sau 5 phút (máy đang ngủ / tắt?). Máy mở lại thì bấm nút dưới.`, chet: '⚠️ Máy nhận lệnh nhưng quá 30 phút không báo về (máy tắt giữa chừng?).' }[h];
    await tra(tg, x.bao, text.slice(0, 3500), h === 'xong' ? {} : lai);
    const f = path.join(dir, `${x.id}.json`), tam = path.join(dir, `.${x.id}.tam`);
    fs.writeFileSync(tam, JSON.stringify({ ...x, ...(h === 'ngu' ? { trang: 'loi', ket: 'máy chưa nhận sau 5 phút — bỏ lệnh' } : {}), da_bao: new Date(gio).toISOString() })); fs.renameSync(tam, f);
    n++;
  }
  return n;
}

if (process.argv[1]?.endsWith('sp-nut.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'); const os = await import('node:os');
  process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-nut-'));
  const U = 'a89b36bf-2ff0-40ec-909e-f1fa924ae372';
  const hop = (uid, data) => { fs.mkdirSync(path.join(process.env.CTY_DATA_DIR, 'tg-hop', 'sp'), { recursive: true }); fs.writeFileSync(path.join(process.env.CTY_DATA_DIR, 'tg-hop', 'sp', `${uid}.json`), JSON.stringify({ update_id: uid, callback_query: { data, from: { id: 1, first_name: 'Tuấn' }, message: { message_id: 2613, message_thread_id: 2182, text: '📤 Large Print Bingo\nđăng 22/10' } } })); };
  const gui = []; const tg = async (_m, b) => { gui.push(b); return { ok: true }; };
  t.equal(nutDang('gum', U).inline_keyboard[0][0].callback_data.length <= 64, true, 'callback_data ≤ 64 byte (giới hạn Telegram)');
  hop(1, `sp:gum:${U}`); t.equal(await xuNutSp(tg), 1);
  const [l] = dsLenh(THU()); t.ok(l.lenh === 'sach:gumroad' && l.tham === U && l.bao.tin === 2613 && l.trang === 'cho', 'bấm → một lệnh một sản phẩm, nhớ tin để báo');
  t.match(gui[0].text, /giao máy đăng Gumroad: <b>Large Print Bingo<\/b>/); t.equal(gui[0].reply_parameters.message_id, 2613);
  hop(2, `sp:gum:${U}`); await xuNutSp(tg); t.equal(dsLenh(THU()).length, 1, 'bấm lần hai khi lệnh còn chờ → không thêm lượt'); t.match(gui[1].text, /Chưa giao được/);
  hop(3, 'sp:gum:x; rm -rf /'); await xuNutSp(tg); t.equal(dsLenh(THU()).length, 1, 'id lạ không thành lệnh'); t.match(gui[2].text, /Chưa giao được/);
  t.equal(await baoKetLenh(tg), 0, 'còn chờ (chưa quá 5 phút) → im');
  const f = path.join(THU(), `${l.id}.json`); fs.writeFileSync(f, JSON.stringify({ ...l, trang: 'loi', ket: 'tab Product chưa đạt' }));
  t.equal(await baoKetLenh(tg), 1); t.match(gui[3].text, /lỗi: tab Product/); t.equal(gui[3].reply_markup.inline_keyboard[0][0].callback_data, `sp:gum:${U}`, 'lỗi → kèm nút thử lại');
  t.equal(await baoKetLenh(tg), 0, 'báo một lần thôi');
  const l2 = taoLenh('sach:gumroad', 'tg', THU(), Date.now() - 6 * 60_000, { tham: U, bao: { tin: 9 } });
  t.equal(await baoKetLenh(tg), 1); t.match(gui[4].text, /chưa nhận lệnh sau 5 phút/); t.equal(JSON.parse(fs.readFileSync(path.join(THU(), `${l2.id}.json`), 'utf8')).trang, 'loi', 'máy ngủ → bỏ lệnh (máy thức dậy không chạy lệnh cũ)');
  console.log('sp-nut: 13 ca đạt');
}
