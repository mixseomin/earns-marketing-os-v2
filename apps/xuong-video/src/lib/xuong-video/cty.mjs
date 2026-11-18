// ĐƯỜNG TỚI REPO cty — một chỗ cho mọi mã studio / web / etp gọi máy của cty (chấm bài cham-dang, hàng thợ máy tho-may-viec, nhịp ethopex).
// cty tách khỏi monorepo 18/11/2026 (github.com/mixseomin/cty, earns-strategy decisions/2026-11-17-tach-repo-theo-phong.md): không còn apps/cty —
// box3 chạy ở /opt/cty, Mac có bản ~/Me/GitHub/cty (bộ điều phối kéo mới mỗi phút). Import TĨNH '../../cty/worker/…' không còn đường; dùng nhapCty lúc chạy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CTY = [process.env.CTY_DIR, '/opt/cty', path.join(os.homedir(), 'Me', 'GitHub', 'cty'), path.join(os.homedir(), 'Me', 'Earns', 'cty')]
  .find((d) => d && fs.existsSync(path.join(d, 'worker', 'goc.mjs'))) ?? null;
/** tệp trong repo cty ('worker/cham-dang.mjs'); không thấy repo cty thì ném lỗi rõ, không chết im */
export const ctyTep = (rel) => { if (!CTY) throw new Error(`không thấy repo cty (/opt/cty hoặc ~/Me/GitHub/cty) để dùng ${rel} — đặt CTY_DIR`); return path.join(CTY, rel); };
/** import mã cty lúc chạy (webpackIgnore: next không gói cứng bản lúc dựng) */
export const nhapCty = (rel) => import(/* webpackIgnore: true */ pathToFileURL(ctyTep(rel)).href);

if (process.argv[1]?.endsWith('cty.mjs') && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.ok(CTY, 'tìm được repo cty');
  t.equal(typeof (await nhapCty('worker/goc.mjs')).monoTep, 'function', 'import được mã cty');
  await t.rejects(nhapCty('worker/khong-co-tep-nay.mjs'), 'tệp thiếu phải ném, không im lặng');
  console.log(`cty: tự kiểm đạt · CTY=${CTY}`);
}
