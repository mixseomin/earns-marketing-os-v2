// DUYỆT CHI TRÊN TELEGRAM (anh 29/10/2026: "làm sao để tao có thể duyệt luôn trên telegram?"). Việc tốn tiền vượt ngưỡng tự chạy (luật ~/.claude/CLAUDE.md:
// mỗi lượt sinh AI ≥ 0,01$ phải anh duyệt đúng lượt đó) → một tin "💸 Xin duyệt chi" vào 📂 Social Traffic kèm nút ✅ Duyệt / ✖ Bỏ. Anh bấm Duyệt = duyệt
// ĐÚNG lượt đó: box3 chạy lệnh đã khai (DUYET_SINH_1_LAN=1 cho một tiến trình), xong báo kết quả + tiền thật ngay dưới tin. Một tin = một lượt; bấm lại sau khi
// đã chạy thì báo "đã xử". Chỉ chạy lệnh trong LENH_CHI (danh sách trắng, tham số kiểm khuôn) — không chạy lệnh tuỳ ý từ dữ liệu.
//   node worker/duyet-chi.mjs xin --viec "Sinh 20 đề video MilitaryCalc" --gia 800 --lenh sinh-kho --tham '{"may":"militarycalc","so":20}'
//   node worker/duyet-chi.mjs --tu-kiem
// Nút: callback_data dc:ok:<id> | dc:bo:<id> → hộp 'duyet-chi' (tg-phong NUT_CUA) → tg-nghe.mjs gọi xuNutDuyet mỗi vòng.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { moHop } from './tg-phong.mjs';

const DIR = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'duyet-chi');
const GOC = '/opt/earns-marketing-os-v2';
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MA = /^[a-z0-9][a-z0-9-]{1,60}$/;

/** Danh sách trắng lệnh tốn tiền: kiem(tham) → lỗi | null; lenh(tham) → [cmd, args] chạy trong repo trên box3. */
export const LENH_CHI = {
  'sinh-kho': { ten: 'Sinh kho video (chữ AI)', kiem: (t) => (!MA.test(String(t?.may ?? '')) ? 'tham.may sai khuôn' : !(Number.isInteger(t?.so) && t.so >= 1 && t.so <= 40) ? 'tham.so phải 1–40' : t?.dang != null && !MA.test(String(t.dang)) ? 'tham.dang sai khuôn' : null),
    lenh: (t) => ['bash', ['-lc', `cd ${GOC} && set -a && . ./.env.production && set +a && cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts --may ${t.may} --sinh-kho ${t.so}${t.dang ? ` --dang ${t.dang}` : ''}`]] },   // dang: chỉ sinh một dạng (thử mẫu mới — giai-thich-giong 31/10/2026)
};
export const nutDuyet = (id, gia) => ({ inline_keyboard: [[{ text: `✅ Duyệt chi ~${Number(gia).toLocaleString('vi-VN')}₫`, callback_data: `dc:ok:${id}` }, { text: '✖ Bỏ', callback_data: `dc:bo:${id}` }]] });
const doc = (id, dir = DIR()) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8')); } catch { return null; } };
const ghi = (x, dir = DIR()) => { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, `.${x.id}.tam`); fs.writeFileSync(t, JSON.stringify(x, null, 1)); fs.renameSync(t, path.join(dir, `${x.id}.json`)); };

/** Tạo một yêu cầu duyệt (chưa gửi). Trả bản ghi; lệnh / tham số sai thì ném. */
export function taoXin({ viec, gia, lenh, tham, tu = 'claude' }, dir = DIR(), bay = Date.now()) {
  const L = LENH_CHI[lenh]; if (!L) throw new Error(`lệnh "${lenh}" không nằm trong danh sách trắng (${Object.keys(LENH_CHI).join(', ')})`);
  const loi = L.kiem(tham); if (loi) throw new Error(loi);
  if (!String(viec ?? '').trim() || !(Number(gia) > 0)) throw new Error('cần --viec và --gia (₫, giá ước THẬT của đường sẽ đi)');
  const x = { id: `${bay}-${Math.random().toString(36).slice(2, 6)}`, viec: String(viec).slice(0, 300), gia: Math.round(Number(gia)), lenh, tham, tu, trang: 'cho', luc: new Date(bay).toISOString() };
  ghi(x, dir); return x;
}
export const tinXin = (x) => `💸 <b>Xin duyệt chi</b> · ${esc(x.viec)}\nƯớc ~<b>${x.gia.toLocaleString('vi-VN')}₫</b> · lệnh <code>${esc(x.lenh)}</code> ${esc(JSON.stringify(x.tham))}\n<i>Bấm Duyệt = chạy đúng một lượt này trên box3, xong báo kết quả + tiền thật dưới tin.</i>`;

/** Xử nút dc:* trong hộp 'duyet-chi'. chay(x) mặc định = chạy lệnh nền (không chặn vòng nghe); tự kiểm thay bằng hàm giả. */
export async function xuNutDuyet(tg, { dir = DIR(), chay = chayNen } = {}) {
  let n = 0;
  for (const h of moHop('duyet-chi')) {
    const c = h.callback_query; h.xong(); if (!c) continue;
    const [, hanh, id] = String(c.data).split(':'), x = doc(id, dir), m = c.message, tra = (text) => tg('sendMessage', { message_thread_id: m?.message_thread_id ?? undefined, text, parse_mode: 'HTML', ...(m?.message_id ? { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } } : {}) });
    if (!x) { await tra(`⚠️ Không có yêu cầu ${esc(id)}`); continue; }
    if (x.trang !== 'cho') { await tra(`· Yêu cầu này đã xử (${esc(x.trang)}) — mỗi tin chỉ một lượt`); continue; }
    const ai = c.from?.first_name || 'Anh';
    if (hanh === 'bo') { ghi({ ...x, trang: 'bo', xu: { ai, luc: new Date().toISOString() } }, dir); await tra(`✖ ${esc(ai)} bỏ: ${esc(x.viec)}`); n++; continue; }
    if (hanh !== 'ok') { await tra(`⚠️ Nút lạ ${esc(c.data)}`); continue; }
    ghi({ ...x, trang: 'chay', xu: { ai, luc: new Date().toISOString() } }, dir);
    await tra(`▶ ${esc(ai)} duyệt — đang chạy: ${esc(x.viec)}`);
    chay(x, async (ok, ra) => {
      const duoi = String(ra).trim().split('\n').filter((l) => l && !/^\[claude\]/.test(l)).slice(-6).join('\n');
      ghi({ ...doc(id, dir), trang: ok ? 'xong' : 'loi', ket: duoi.slice(-1500), xong_luc: new Date().toISOString() }, dir);
      await tra(`${ok ? '✅ Xong' : '✗ Lỗi'}: ${esc(x.viec)}\n<pre>${esc(duoi.slice(-1500))}</pre>`);
    });
    n++;
  }
  return n;
}
function chayNen(x, xong) {
  const [cmd, args] = LENH_CHI[x.lenh].lenh(x.tham); let ra = '';
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }), het = setTimeout(() => p.kill('SIGTERM'), 60 * 60_000);
  p.stdout.on('data', (d) => { ra += d; }); p.stderr.on('data', (d) => { ra += d; });
  p.on('close', (code) => { clearTimeout(het); xong(code === 0, ra).catch((e) => console.error(`✗ báo kết quả duyệt chi: ${e.message}`)); });
}

if (process.argv[1]?.endsWith('duyet-chi.mjs')) {
  const a = process.argv.slice(2), lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (a.includes('--tu-kiem')) {
    const t = (await import('node:assert')).strict, os = await import('node:os'), d = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-'));
    t.throws(() => taoXin({ viec: 'x', gia: 10, lenh: 'rm', tham: {} }, d), /danh sách trắng/);
    t.throws(() => taoXin({ viec: 'x', gia: 10, lenh: 'sinh-kho', tham: { may: 'a; rm -rf /', so: 2 } }, d), /khuôn/, 'tham số chèn lệnh bị chặn');
    t.throws(() => taoXin({ viec: 'x', gia: 10, lenh: 'sinh-kho', tham: { may: 'militarycalc', so: 99 } }, d), /1–40/);
    const x = taoXin({ viec: 'Sinh 20 đề', gia: 800, lenh: 'sinh-kho', tham: { may: 'militarycalc', so: 20 } }, d, 1);
    t.equal(doc(x.id, d).trang, 'cho'); t.ok(tinXin(x).includes('800₫'));
    t.ok(LENH_CHI['sinh-kho'].lenh(x.tham)[1][1].includes('--may militarycalc --sinh-kho 20') && LENH_CHI['sinh-kho'].lenh(x.tham)[1][1].includes('DUYET_SINH_1_LAN=1'));
    t.equal(nutDuyet(x.id, 800).inline_keyboard[0][0].callback_data, `dc:ok:${x.id}`);
    t.ok(LENH_CHI['sinh-kho'].lenh({ may: 'astrolas', so: 1, dang: 'giai-thich-giong' })[1][1].includes('--sinh-kho 1 --dang giai-thich-giong'), 'dang đi vào lệnh');
    t.throws(() => taoXin({ viec: 'x', gia: 10, lenh: 'sinh-kho', tham: { may: 'astrolas', so: 1, dang: 'x; rm -rf /' } }, d), /dang sai khuôn/, 'dang chèn lệnh bị chặn');
    fs.rmSync(d, { recursive: true, force: true }); console.log('duyet-chi: 9/9 ok'); process.exit(0);
  }
  if (a[0] === 'xin') {
    const x = taoXin({ viec: lay('--viec'), gia: lay('--gia'), lenh: lay('--lenh'), tham: JSON.parse(lay('--tham') ?? '{}'), tu: lay('--tu') ?? 'claude' });
    const { tgNoiDung } = await import('./kiem-bai.mjs'), { topicPhong } = await import('./tg-phong.mjs');
    const { tg } = await tgNoiDung(), topic = await topicPhong('social-traffic', '📂 Social Traffic', tg);
    const j = await tg('sendMessage', { message_thread_id: topic, text: tinXin(x), parse_mode: 'HTML', reply_markup: nutDuyet(x.id, x.gia) });
    if (!j?.ok) { console.error(`Telegram: ${JSON.stringify(j).slice(0, 200)}`); process.exit(1); }
    ghi({ ...x, tin: j.result.message_id }); console.log(`đã gửi xin duyệt ${x.id} (tin #${j.result.message_id})`); process.exit(0);
  }
  console.error('dùng: duyet-chi.mjs xin --viec "…" --gia <₫> --lenh sinh-kho --tham \'{"may":"…","so":N}\' | --tu-kiem'); process.exit(2);
}
