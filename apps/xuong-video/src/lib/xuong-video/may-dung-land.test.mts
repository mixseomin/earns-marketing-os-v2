// Tự kiểm mẫu "Before you land": mọi đề nguồn dựng được ASS, chữ đăng không có số giá / gạch dài, tên dài vẫn vừa khung.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { assLand, coTen, kichBanLand, tenGon, tpGon, tuNguonLand, DAI } from './may-dung-land';

const ds = JSON.parse(readFileSync(new URL('../../../mau/may/before-you-land.json', import.meta.url), 'utf8'));
assert.ok(ds.length >= 25, `nguồn đề ${ds.length} nước`);
for (const x of ds) {
  const a = assLand(x), n = tuNguonLand(x);
  assert.ok(a.includes('[Events]') && a.includes(x.nuoc.toUpperCase()), `${x.nuoc}: ASS thiếu tên nước`);
  for (const s of x.san_bay) assert.ok(a.includes(s.iata), `${x.nuoc}: ASS thiếu ${s.iata}`);
  assert.ok(!/[–—]/.test(n.dang.title + n.dang.description), `${x.nuoc}: chữ đăng có gạch dài`);
  assert.ok(!/[$€£]\s?\d|\d+\s?(GB|USD|EUR)\b/i.test(n.dang.description), `${x.nuoc}: chữ đăng có giá / dung lượng`);
  assert.ok(n.dang.link === `https://esimfares.com/${x.iso}/` && n.dang.description.endsWith(n.dang.link), `${x.nuoc}: link đích`);
  assert.strictEqual(kichBanLand(x).shots.at(-1)!.den, DAI);
}
assert.strictEqual(coTen('Japan'), 150); assert.strictEqual(coTen('United Arab Emirates'), 76);
assert.strictEqual(tenGon('Narita International Airport'), 'Narita');
assert.strictEqual(tpGon("Paris (Roissy-en-France, Val-d'Oise)"), 'Paris'); assert.strictEqual(tpGon('Manchester, Greater Manchester'), 'Manchester');
console.log(`may-dung-land: ${ds.length} đề đạt`);
