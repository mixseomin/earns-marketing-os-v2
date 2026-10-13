// NHỊP — nhân sự đã bật tự làm việc, không đợi ai nhắc (anh 13/10/2026: "bản chất hệ thống là phải tự làm việc chứ không phải nhắc mới làm").
// Hồ sơ nhân sự khai `heartbeat: <việc>[, <việc>…]` — mỗi việc là một nhịp MÁY trong NHIP dưới đây (0 tiền mô hình). systemd cty-nhip.timer chạy
// tệp này mỗi phút trên box3; mỗi người một lượt, lỗi của người này không chặn người kia. tu-kiem chỉ cho bật heartbeat là việc có trong NHIP
// (nhịp gọi mô hình vẫn khoá tới khi anh bật riêng).
//   node worker/nhip.mjs            chạy một nhịp cho mọi người đã bật
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

export const NHIP = {
  'mail-bao-mat': async (id, ten) => (await import('./mail-bao-mat.mjs')).nhipBaoMat(id, { ten }),   // Phòng An toàn tài khoản: thư bảo mật → Telegram + pixel
};
/** Ai đang bật nhịp: [{ id, ten, viec[] }] — heartbeat khác 'off', tách dấu phẩy. */
export function dangBat() {
  const dir = path.join(GOC, 'cong-ty', 'nhan-su');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SOUL.md'))).map((d) => ({ id: d, fm: parseFm(fs.readFileSync(path.join(dir, d, 'SOUL.md'), 'utf8')).fm }))
    .filter((x) => x.fm.heartbeat && x.fm.heartbeat !== 'off').map((x) => ({ id: x.id, ten: String(x.fm.ten ?? x.id), viec: String(x.fm.heartbeat).split(',').map((v) => v.trim()).filter(Boolean) }));
}

if (process.argv[1]?.endsWith('nhip.mjs')) {
  for (const n of dangBat()) for (const v of n.viec) {
    if (!NHIP[v]) continue;   // heartbeat không phải nhịp máy (vd Phòng thử "khi bấm nút") → không thuộc bộ chạy này
    try { console.log(`${n.id} · ${v}: ${await NHIP[v](n.id, n.ten)}`); } catch (e) { console.error(`✗ ${n.id} · ${v}: ${e.message}`); process.exitCode = 1; }
  }
}
