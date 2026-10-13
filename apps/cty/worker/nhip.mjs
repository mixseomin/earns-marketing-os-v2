// NHỊP — nhân sự đã bật tự làm việc, không đợi ai nhắc (anh 13/10/2026: "bản chất hệ thống là phải tự làm việc chứ không phải nhắc mới làm").
// Hồ sơ nhân sự khai `heartbeat: <việc>[, <việc>…]` — mỗi việc là một nhịp MÁY trong NHIP dưới đây (máy làm; mô hình chỉ gọi khi có việc thật, vd viết lời báo). systemd cty-nhip.timer chạy
// tệp này mỗi phút trên box3; mỗi người một lượt, lỗi của người này không chặn người kia. tu-kiem chỉ cho bật heartbeat là việc có trong NHIP
// (nhịp gọi mô hình vẫn khoá tới khi anh bật riêng).
//   node worker/nhip.mjs            chạy một nhịp cho mọi người đã bật
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

export const NHIP = {
  'mail-bao-mat': async (n) => (await import('./mail-bao-mat.mjs')).nhipBaoMat(n.id, { ten: n.ten, model: n.model }),   // Phòng An toàn tài khoản: thư bảo mật → Telegram + pixel
};
/** CA LÀM của nhân sự: `ca: 08:00-24:00` (giờ VN) → chỉ làm trong khung đó; không khai = cả ngày. Anh 13/10/2026: Kiên 2 ca 16 tiếng từ 8h. */
export function trongCa(ca, gio = new Date()) {
  const m = String(ca ?? '').match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/); if (!m) return true;
  const vn = (gio.getUTCHours() + 7) % 24 * 60 + gio.getUTCMinutes(), tu = +m[1] * 60 + +m[2], den = +m[3] * 60 + +m[4];
  return tu <= den ? vn >= tu && vn < den : vn >= tu || vn < den;
}
/** Ai đang bật nhịp: [{ id, ten, viec[] }] — heartbeat khác 'off', tách dấu phẩy. */
export function dangBat() {
  const dir = path.join(GOC, 'cong-ty', 'nhan-su');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SOUL.md'))).map((d) => ({ id: d, fm: parseFm(fs.readFileSync(path.join(dir, d, 'SOUL.md'), 'utf8')).fm }))
    .filter((x) => x.fm.heartbeat && x.fm.heartbeat !== 'off').map((x) => ({ id: x.id, ten: String(x.fm.ten ?? x.id), model: String(x.fm.model ?? ''), ca: x.fm.ca, viec: String(x.fm.heartbeat).split(',').map((v) => v.trim()).filter(Boolean) }));
}

if (process.argv[1]?.endsWith('nhip.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert'); const g = (h, p = 0) => new Date(Date.UTC(2026, 9, 13, (h + 17) % 24, p));   // giờ VN h:p
  a.ok(trongCa('08:00-24:00', g(8)) && trongCa('08:00-24:00', g(23, 59)) && !trongCa('08:00-24:00', g(0)) && !trongCa('08:00-24:00', g(7, 59)));
  a.ok(trongCa('22:00-06:00', g(23)) && trongCa('22:00-06:00', g(5)) && !trongCa('22:00-06:00', g(12)) && trongCa(undefined, g(3)));
  console.log('✓ nhip: ca làm theo giờ VN (8h–24h, ca qua đêm, không khai = cả ngày)'); process.exit(0);
}
if (process.argv[1]?.endsWith('nhip.mjs')) {
  for (const n of dangBat()) for (const v of n.viec) {
    if (NHIP[v] && !trongCa(n.ca)) { console.log(`${n.id} · ${v}: ngoài ca ${n.ca} — để tới đầu ca`); continue; }
    if (!NHIP[v]) continue;   // heartbeat không phải nhịp máy (vd Phòng thử "khi bấm nút") → không thuộc bộ chạy này
    try { console.log(`${n.id} · ${v}: ${await NHIP[v](n)}`); } catch (e) { console.error(`✗ ${n.id} · ${v}: ${e.message}`); process.exitCode = 1; }
  }
}
