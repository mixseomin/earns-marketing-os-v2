#!/usr/bin/env node
// HÀ · GIÁM SÁT CLI — các TAY trên box3 (anh 16/11/2026: "thêm 1 con CLI độc lập để review, quản lý các con CLI kia về phình bộ nhớ, ngáo, học sai,
// học lệch hoặc bảo mật" → "ok. Làm thế đi"). Hà (may/giam-sat.mjs trên iMac) chỉ được làm qua các lệnh này, đều LÀM NGƯỢC LẠI ĐƯỢC:
//   --so-lieu                      JSON sổ kinh nghiệm mọi người (cỡ tệp + bài học) + đếm việc Hà đã làm 7 ngày — cho tầng máy đo
//   --tam-dung <id> <lý do…>       tắt "Tự làm" của một kỹ sư (cờ bat=false trong nhip-chinh.json, bật lại ở chấm xanh cột Tự làm)
//   --bo-bai <id> <mã> <lý do…>    bỏ một bài học sai — chép sổ cũ vào kinh-nghiem/.bo/ trước
//   --bao                          chữ ở stdin → chủ đề Telegram 🛡 Giám sát CLI
// Mỗi lệnh ghi một dòng <DATA>/giam-sat.jsonl (tầng máy đo đếm chính Hà: tạm dừng / bỏ bài bao nhiêu lần — người canh cũng bị canh).
import fs from 'node:fs';
import path from 'node:path';
import { topicPhong, ghiNut } from './tg-phong.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const NK = () => path.join(DATA(), 'giam-sat.jsonl');
export const ghiNk = (o) => fs.appendFileSync(NK(), JSON.stringify({ luc: new Date().toISOString(), ...o }) + '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function tg(phuong, body) {
  if (!process.env.TG_BOT_TOKEN) try { for (const l of fs.readFileSync('/root/.secrets/mine-tg.env', 'utf8').split('\n')) { const m = l.match(/^(?:export\s+)?(TG_BOT_TOKEN|TG_CHAT)=["']?([^"'\s]+)/); if (m) process.env[m[1]] = m[2]; } } catch { /* không có */ }
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  return ghiNut(async (m, b) => (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(15000) })).json())(phuong, body);
}
export async function bao(chu) {
  const topic = await topicPhong('giam-sat-cli', '🛡 Giám sát CLI', tg, { duocTao: true });
  const j = await tg('sendMessage', { message_thread_id: topic, parse_mode: 'HTML', text: `<b>🛡 Hà · giám sát CLI</b>\n${esc(chu).slice(0, 3800)}`, link_preview_options: { is_disabled: true } });
  return !!j?.ok;
}
/** Người Hà được động tới: kỹ sư CLI (may/tu-hoc.mjs NGUOI_CUA) + Thành. Không bao giờ chính Hà. */
export async function duocDong(id) { const { NGUOI_CUA } = await import('../may/tu-hoc.mjs'); return id !== 'ha' && [...Object.values(NGUOI_CUA), 'thanh'].includes(id); }
const nk7 = () => { let ds = []; try { ds = fs.readFileSync(NK(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* chưa có */ } const tu = Date.now() - 7 * 864e5; return ds.filter((x) => Date.parse(x.luc) >= tu); };

if (process.argv[1]?.endsWith('giam-sat-lam.mjs')) {
  const [, , lenh, id, ...con] = process.argv;
  if (lenh === '--so-lieu') {
    const d = path.join(DATA(), 'kinh-nghiem'), so = {};
    for (const f of fs.existsSync(d) ? fs.readdirSync(d).filter((x) => x.endsWith('.json')) : []) { const t = fs.readFileSync(path.join(d, f), 'utf8'); let ds = []; try { ds = JSON.parse(t).bai_hoc ?? []; } catch { /* hỏng */ } so[f.slice(0, -5)] = { byte: t.length, bai: ds.map((b) => ({ ma: b.ma, ts: b.ts, khoa: b.khoa, noi_dung: b.noi_dung, ap: b.lan_ap_dung, dat: b.lan_dat })) }; }
    const ha = nk7(); console.log(JSON.stringify({ so, ha: { tam_dung: ha.filter((x) => x.viec === 'tam-dung').length, bo_bai: ha.filter((x) => x.viec === 'bo-bai').length, bao: ha.filter((x) => x.viec === 'bao').length } }));
  } else if (lenh === '--tam-dung') {
    if (!(await duocDong(id))) { console.error(`không được động tới "${id}"`); process.exit(2); }
    const { datBat } = await import('./nhip.mjs'); datBat(id, false, 'Hà · giám sát CLI'); const ly = con.join(' ');
    ghiNk({ viec: 'tam-dung', id, ly }); await bao(`⏸ Tạm dừng ${id}: ${ly}\nBật lại: chấm xanh cột Tự làm trên cty.`); console.log('ok');
  } else if (lenh === '--bo-bai') {
    if (!(await duocDong(id))) { console.error(`không được động tới "${id}"`); process.exit(2); }
    const [ma, ...ly] = con, tep = path.join(DATA(), 'kinh-nghiem', `${id}.json`), kho = path.join(DATA(), 'kinh-nghiem', '.bo');
    fs.mkdirSync(kho, { recursive: true }); fs.copyFileSync(tep, path.join(kho, `${id}-${Date.now()}.json`));
    const { boBaiHoc } = await import('./kinh-nghiem.mjs'); if (!boBaiHoc(id, ma)) { console.error(`không có bài ${ma}`); process.exit(2); }
    ghiNk({ viec: 'bo-bai', id, ma, ly: ly.join(' ') }); await bao(`🧹 Bỏ bài học của ${id} (${ma}): ${ly.join(' ')}\nBản sổ cũ: ${kho}`); console.log('ok');
  } else if (lenh === '--bao') {
    const chu = fs.readFileSync(0, 'utf8').trim(); if (!chu) process.exit(0);
    const ok = await bao(chu); ghiNk({ viec: 'bao', ok }); console.log(ok ? 'gui' : 'loi');
  } else { console.error('dùng: --so-lieu | --tam-dung <id> <lý do> | --bo-bai <id> <mã> <lý do> | --bao (stdin)'); process.exit(2); }
}
