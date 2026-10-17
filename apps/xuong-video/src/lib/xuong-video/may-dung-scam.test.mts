// Tự kiểm mẫu "Scam or Real?" + cả tệp nguồn đề: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-scam.test.mts
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { assScam, boCuc, ngat, tuNguonScam, kichBanScam, nhipScam, CHU_KET_SCAM, type DeScam } from './may-dung-scam';
import { giayDoc } from './may-dung-ass';

assert.deepStrictEqual(ngat('one two three four', 9), ['one two', 'three', 'four']);
const ds = JSON.parse(readFileSync(new URL('../../../mau/may/scam-or-real.json', import.meta.url), 'utf8')) as (DeScam & { slug: string })[];
assert.strictEqual(new Set(ds.map((x) => x.slug)).size, ds.length, 'slug trùng');
for (const x of ds) {
  const co = x.dong.filter((d) => d.co).map((d) => d.co);
  if (x.ket === 'scam') { assert.deepStrictEqual(co, [1, 2, 3], `${x.slug}: tin lừa phải khoanh đúng 3 dòng 1-2-3`); assert.strictEqual(x.ly_do.length, 3, `${x.slug}: 3 lý do`); }
  else assert.strictEqual(co.length, 0, `${x.slug}: tin thật không khoanh dòng nào`);
  for (const l of x.ly_do) assert.ok(l.length <= 36, `${x.slug}: lý do dài quá 36 ký tự (tràn dòng): ${l}`);
  assert.ok(boCuc(x).cuoi < 1560, `${x.slug}: tin dài quá, đè lên phần lý do / đồng hồ (${boCuc(x).cuoi})`);
  const ass = assScam(x); assert.ok(ass.includes(x.ket === 'scam' ? 'SCAM' : 'REAL'));
  const n = tuNguonScam(x); assert.ok(n.dang.link.startsWith('https://ratesbyroom.com/') && n.dang.description.includes(n.dang.link) && !('slug' in n.de));
  const N = nhipScam(x);
  assert.strictEqual(kichBanScam(x).shots.at(-1)!.den, N.DAI);
  // luật đọc: lý do đứng ≥ thời gian đọc + đệm; màn kết cũng vậy
  assert.ok(N.T_KET - N.T_LO >= -1e-9 + giayDoc(...x.ly_do.slice(0, 3)), `${x.slug}: lý do không đủ thời gian đọc`);
  assert.ok(N.DAI - N.T_KET >= -1e-9 + giayDoc(...CHU_KET_SCAM), `${x.slug}: màn kết không đủ thời gian đọc`);
}
console.log(`may-dung-scam: ${ds.length} đề đạt`);
