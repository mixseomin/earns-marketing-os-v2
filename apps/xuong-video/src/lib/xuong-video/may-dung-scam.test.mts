// Tự kiểm mẫu "Scam or Real?" + cả tệp nguồn đề: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-scam.test.mts
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { anhScam, assScam, boCuc, ngat, tuNguonScam, kichBanScam, nhipScam, CHU_KET_SCAM, T_LO, type DeScam } from './may-dung-scam';
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
  // ảnh tĩnh: câu đố trước khi lộ, đáp án sau khi mọi dòng lý do đã hiện (0,15s/dòng) và trước màn kết; khung cắt nằm trong 1080x1920 và chứa hết tin
  const [q, d] = anhScam(x);
  assert.ok(q!.t < T_LO && d!.t > T_LO + 0.15 * 2 + 0.2 && d!.t < N.T_KET, `${x.slug}: mốc ảnh sai`);
  for (const k of [q!, d!]) assert.ok(k.cat[1] + k.cat[3] <= 1920 && k.cat[0] + k.cat[2] <= 1080);
  assert.ok(boCuc(x).cuoi < d!.cat[1] + d!.cat[3], `${x.slug}: ảnh đáp án cắt mất đuôi tin`);
}
console.log(`may-dung-scam: ${ds.length} đề đạt`);

// tiêu đề không trùng (chống spam, 18/10/2026), không lộ đáp án, đủ ngắn cho feed
{
  const { tuNguonScam, tieuDeScam } = await import('./may-dung-scam');
  const nguon = JSON.parse((await import('node:fs')).readFileSync(new URL('../../../mau/may/scam-or-real.json', import.meta.url), 'utf8')) as (Parameters<typeof tuNguonScam>[0])[];
  const ts = nguon.map((x) => tuNguonScam(x).dang.title);
  assert.strictEqual(new Set(ts).size, ts.length, 'mỗi video một tiêu đề');
  for (const [i, t] of ts.entries()) { assert.ok(t.length <= 100, `tiêu đề dài ${t.length}: ${t}`); assert.ok(!/fake|scam:|real:|[—–]/i.test(t.replace(/^Scam or real\?|Scam or real\?$/i, '').replace(/Scam or real\? /, '')), `tiêu đề lộ đáp án / gạch dài: ${t}`); void i; }
  assert.ok(tieuDeScam('a', { kenh: 'SMS', dong: [{ t: 'x'.repeat(80), co: 1 }] } as never).includes('...'), 'câu trích dài thì cắt');
  console.log(`tiêu đề scam: ${ts.length} tiêu đề khác nhau, ví dụ: ${ts.slice(0, 3).join(' | ')}`);
}
