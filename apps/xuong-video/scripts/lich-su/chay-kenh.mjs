#!/usr/bin/env node
// LƯỢT HẰNG NGÀY CỦA CÁC KÊNH LỊCH SỬ (02/11/2026 — anh: "cần cơ chế sx liên tục và đăng lên định kỳ để duy trì kênh", duyệt 3 tập/tuần + tiến trình nền).
// Việc nền iMac:com.earns.lich-su-lam-tap (apps/cty/cong-ty/viec-nen.json) gọi mỗi ngày. Với mỗi kênh trong kenh.json có `may` (máy Studio) + `lich_tap`:
//   1. hôm nay là ngày làm tập (lich_tap: thứ trong tuần, 1 = Thứ Hai … 7 = Chủ nhật, giờ VN) và chưa có tập hôm nay → lam-tap.mjs --kenh <k> --id <mã máy>-<ngày>
//      (chủ đề + hook theo góc spy của máy, viết → kiểm → dựng → đẩy Studio → nạp máy đăng; Phòng Nội dung chấm, máy đăng tự đăng theo nhịp an toàn)
//   2. mọi ngày: may-dung.mts --so-kenh (lượt xem + người đăng ký → mos2 › Tài sản › Kênh sản phẩm)
//   3. báo Telegram (kênh cty): tập mới + tiền thật của lượt, hoặc lỗi nguyên văn.
//   node scripts/lich-su/chay-kenh.mjs [--kenh parody] [--ep]   (--ep: làm tập kể cả không phải ngày lịch)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), BOX = 'root@167.233.241.16', GOC_BOX = '/opt/earns-marketing-os-v2/apps/xuong-video';
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const KENH = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'));
const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const thu = ((d) => (d === 0 ? 7 : d))(new Date(`${hom}T12:00:00+07:00`).getUTCDay());
const box = (lenh) => execFileSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx ${lenh}`], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const tele = (chu) => { try { execFileSync('ssh', [BOX, 'set -a; . /root/.secrets/mine-tg.env; set +a; curl -s -o /dev/null https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage --data-urlencode chat_id=$TG_CHAT --data-urlencode text@-'], { input: chu }); } catch (e) { console.log(`⚠ Telegram: ${e.message}`); } };

const danhDau = (ma, dl) => { const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
  const cauSql = `UPDATE xv_may SET nguon = ${dl ? `jsonb_set(coalesce(nguon, '{}'::jsonb), '{dang_lam}', ${q1(JSON.stringify(dl))}::jsonb)` : "coalesce(nguon, '{}'::jsonb) - 'dang_lam'"} WHERE ma = ${q1(ma)};`;
  try { execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -qtA'], { input: cauSql }); } catch (e) { console.log(`⚠ dấu đang làm: ${e.message}`); } };

for (const [k, K] of Object.entries(KENH)) {
  if (k.startsWith('_') || !K.may || (arg('kenh') && arg('kenh') !== k)) continue;
  const bao = [];
  if ((K.lich_tap ?? []).includes(thu) || process.argv.includes('--ep')) {
    const id = `${K.may}-${hom.replace(/-/g, '')}`;
    if (existsSync(join(DIR, 'tap', `${id}.json`)) && !process.argv.includes('--ep')) bao.push(`tập ${id} đã có — bỏ qua`);
    else {
      // lam-tap tự dừng trước khi tốn tiền giọng / ảnh nếu máy viết 4 lượt vẫn lỗi; DUYET_SINH_1_LAN cho lượt có lịch anh đã duyệt (02/11/2026: 3 tập/tuần)
      // ĐANG SẢN XUẤT: dấu trên máy studio (xv_may.nguon.dang_lam) — mos2 › Tài sản › Kênh nội dung hiện tập đang làm; xong (đạt hay hỏng) thì gỡ
      danhDau(K.may, { id, luc: new Date().toISOString() });
      const r = spawnSync(process.execPath, [join(DIR, 'lam-tap.mjs'), '--id', id, '--nn', 'en', '--kenh', k], { encoding: 'utf8', env: { ...process.env, DUYET_SINH_1_LAN: '1' }, maxBuffer: 64 << 20 });
      const ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`; process.stdout.write(ra);
      danhDau(K.may, null);
      const tien = [...ra.matchAll(/~(\d+)₫/g)].reduce((t, m) => t + Number(m[1]), 0);
      const tap = existsSync(join(DIR, 'tap', `${id}.json`)) ? JSON.parse(readFileSync(join(DIR, 'tap', `${id}.json`), 'utf8')) : null;
      bao.push(r.status ? `✗ tập ${id} hỏng (mã ${r.status}): ${ra.trim().split('\n').slice(-3).join(' · ').slice(0, 500)}`
        : `✓ tập mới ${id}: ${tap?.tieu_de ?? '?'}\n  ${tap?.chu_de ?? ''}\n  ~${tien.toLocaleString('vi-VN')}₫ · Studio › Máy › ${K.may} · ${/✓ nạp máy/.test(ra) ? 'đã nạp máy đăng, chờ Phòng Nội dung chấm' : '⚠ chưa nạp máy đăng'}`);
    }
  }
  try { bao.push(box(`scripts/may-dung.mts --may ${K.may} --so-kenh`).split('\n').pop()); } catch (e) { bao.push(`⚠ đo số kênh hỏng: ${String(e.stderr || e.message).trim().split('\n').pop()}`); }
  const chu = `📺 ${K.ten} · ${hom}\n${bao.join('\n')}`; console.log(chu);
  if (bao.some((x) => /tập mới|hỏng/.test(x))) tele(chu);   // ngày chỉ đo số thì không làm ồn Telegram
}
