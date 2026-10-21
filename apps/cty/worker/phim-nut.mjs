// NÚT DƯỚI TIN "Phim #N dừng: vượt ngân sách" (anh 21/10/2026: "phải cho trả lời trên tele luôn"). tu-lam-phim.mts dừng vì ngân sách thì ghi lệnh của
// lượt đó vào <DATA>/phim-cho/<tap>.json và gửi hai nút: ph:tiep:<tap> = chạy lại ĐÚNG lệnh đó MỘT lượt (cùng trần ngân sách) · ph:dung:<tap> = bỏ.
// Mỗi lần bấm = anh duyệt đúng một lượt tiêu tiền; tệp chờ bị xoá ngay khi nhận nên không bấm lần hai được. Lượt chạy tách khỏi dịch vụ nghe bằng
// systemd-run (khởi động lại dịch vụ không giết phim); tu-lam-phim tự báo kết quả dưới tin khi xong (XV_BAO_TIN). Gọi từ tg-nghe.mjs ngay sau gom tin.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { moHop } from './tg-phong.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const GOC = process.env.MOS2_GOC || '/opt/earns-marketing-os-v2';
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const THAM_SO = /^[\w=:.,-]+$/;   // tham số lệnh phim chỉ gồm chữ / số / = : . , - — không gì khác lọt vào dòng lệnh

/** Lệnh systemd-run cho một lượt phim chờ: [] khi tệp chờ có tham số lạ. */
export const lenhChay = (cho, tap, tin) => (cho.argv?.every((a) => THAM_SO.test(a)) ? ['--collect', `--unit=phim-tap${tap}-${Date.now()}`,
  `-p`, `WorkingDirectory=${GOC}/apps/xuong-video`, `-p`, `EnvironmentFile=${GOC}/.env.production`,
  '-E', 'DUYET_SINH_1_LAN=1', '-E', 'NODE_OPTIONS=--conditions=react-server', '-E', `XV_BAO_TIN=${tin}`,
  `${GOC}/node_modules/.bin/tsx`, 'scripts/tu-lam-phim.mts', ...cho.argv] : []);

export async function xuNutPhim(tg, { chay = (a) => new Promise((ok, loi) => execFile('systemd-run', a, (e, out, err) => (e ? loi(new Error(err || e.message)) : ok(out)))) } = {}) {
  let n = 0;
  for (const x of moHop('phim')) {
    const c = x.callback_query; x.xong(); if (!c) continue;
    const [, lenh, tap] = String(c.data).split(':'), m = c.message, ai = esc(c.from?.first_name || 'Anh');
    const bao = (text) => tg('sendMessage', { message_thread_id: m?.message_thread_id, text, parse_mode: 'HTML', ...(m ? { reply_parameters: { message_id: m.message_id } } : {}) });
    const tep = path.join(DATA(), 'phim-cho', `${Number(tap)}.json`);
    let cho; try { cho = JSON.parse(fs.readFileSync(tep, 'utf8')); fs.rmSync(tep); } catch { await bao(`⚠️ Tập #${esc(tap)} không còn lượt chờ (đã xử hoặc đã chạy lại).`); n++; continue; }
    if (lenh !== 'tiep') { await bao(`⏹ ${ai} dừng phim #${esc(cho.phim)} — không chạy thêm.`); n++; continue; }
    const a = lenhChay(cho, Number(tap), m?.message_id ?? '');
    try { if (!a.length) throw new Error('lệnh chờ có tham số lạ'); await chay(a); await bao(`▶ ${ai} duyệt chạy tiếp phim #${esc(cho.phim)} — một lượt, trần ${esc(cho.tran)}. Xong máy báo ngay dưới tin này.`); }
    catch (e) { await bao(`⚠️ Phim #${esc(cho.phim)} chưa chạy được: ${esc(e.message.slice(0, 300))}`); }
    n++;
  }
  return n;
}

if (process.argv[1]?.endsWith('phim-nut.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert'); const os = await import('node:os');
  process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'phim-nut-'));
  const cho = (tap, argv) => { fs.mkdirSync(path.join(DATA(), 'phim-cho'), { recursive: true }); fs.writeFileSync(path.join(DATA(), 'phim-cho', `${tap}.json`), JSON.stringify({ phim: 222, tran: '$0.10', argv })); };
  const hop = (id, data) => { fs.mkdirSync(path.join(DATA(), 'tg-hop', 'phim'), { recursive: true }); fs.writeFileSync(path.join(DATA(), 'tg-hop', 'phim', `${id}.json`), JSON.stringify({ update_id: id, callback_query: { data, from: { first_name: 'Tuấn' }, message: { message_id: 50, message_thread_id: 2285 } } })); };
  const gui = [], chayDs = []; const tg = async (_m, b) => { gui.push(b.text); return { ok: true }; }; const chay = async (a) => { chayDs.push(a); };
  cho(301, ['301', '--toi-da=3', '--ngan-sach=0.1']); hop(1, 'ph:tiep:301');
  t.equal(await xuNutPhim(tg, { chay }), 1); t.equal(chayDs.length, 1); t.ok(chayDs[0].includes('DUYET_SINH_1_LAN=1') && chayDs[0].includes('XV_BAO_TIN=50') && chayDs[0].at(-1) === '--ngan-sach=0.1', 'chạy lại đúng lệnh lượt trước');
  t.match(gui[0], /chạy tiếp phim #222/);
  hop(2, 'ph:tiep:301'); await xuNutPhim(tg, { chay }); t.equal(chayDs.length, 1, 'bấm lần hai không chạy thêm lượt'); t.match(gui[1], /không còn lượt chờ/);
  cho(302, ['302']); hop(3, 'ph:dung:302'); await xuNutPhim(tg, { chay }); t.equal(chayDs.length, 1); t.match(gui[2], /dừng phim/); t.ok(!fs.existsSync(path.join(DATA(), 'phim-cho', '302.json')));
  cho(303, ['303; rm -rf /']); hop(4, 'ph:tiep:303'); await xuNutPhim(tg, { chay }); t.equal(chayDs.length, 1, 'tham số lạ không chạy'); t.match(gui[3], /chưa chạy được/);
  console.log('phim-nut: tự kiểm đạt');
}
