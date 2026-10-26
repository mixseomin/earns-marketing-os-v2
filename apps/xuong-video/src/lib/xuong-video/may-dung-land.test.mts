// Tự kiểm mẫu "Before you land": mọi đề nguồn dựng được ASS, chữ đăng không có số giá / gạch dài, tên dài vẫn vừa khung.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { anhLand, assLand, coTen, kichBanLand, nhipLand, tenGon, tpGon, tuNguonLand, BUOC, CHU_CANH, CHU_KET } from './may-dung-land';
import { giayDoc } from './may-dung-ass';

const ds = JSON.parse(readFileSync(new URL('../../../mau/may/before-you-land.json', import.meta.url), 'utf8'));
assert.ok(ds.length >= 25, `nguồn đề ${ds.length} nước`);
for (const x of ds) {
  const a = assLand(x), n = tuNguonLand(x);
  assert.ok(a.includes('[Events]') && a.includes(x.nuoc.toUpperCase()), `${x.nuoc}: ASS thiếu tên nước`);
  for (const s of x.san_bay) assert.ok(a.includes(s.iata), `${x.nuoc}: ASS thiếu ${s.iata}`);
  assert.ok(!/[–—]/.test(n.dang.title + n.dang.description), `${x.nuoc}: chữ đăng có gạch dài`);
  assert.ok(!/[$€£]\s?\d|\d+\s?(GB|USD|EUR)\b/i.test(n.dang.description), `${x.nuoc}: chữ đăng có giá / dung lượng`);
  assert.ok(n.dang.link === `https://esimfares.com/${x.iso}/` && n.dang.description.endsWith(n.dang.link), `${x.nuoc}: link đích`);
  const N = nhipLand(x);
  // ảnh tĩnh: ảnh 1 lúc cảnh báo đã hiện mà chưa sang 3 bước; ảnh 2 lúc bước cuối đã hiện, trước màn kết; khung nằm trong 1080x1920
  const [a1, a2] = anhLand(x);
  assert.ok(a1!.t > N.T_CANH && a1!.t < N.T_BUOC && a2!.t > N.buocTu.at(-1)! + 0.3 && a2!.t < N.T_KET, `${x.nuoc}: mốc ảnh sai`);
  for (const k of [a1!, a2!]) assert.ok(k.cat[1] + k.cat[3] <= 1920 && k.cat[0] + k.cat[2] <= 1080, `${x.nuoc}: khung cắt tràn`);
  assert.strictEqual(kichBanLand(x).shots.at(-1)!.den, N.DAI);
  // luật đọc: cảnh báo, bước cuối, màn kết đều đứng ≥ thời gian đọc + đệm; các bước hiện tăng dần
  assert.ok(N.T_BUOC - N.T_CANH >= -1e-9 + giayDoc(CHU_CANH), `${x.nuoc}: cảnh báo không đủ thời gian đọc`);
  assert.ok(N.T_KET - N.buocTu.at(-1)! >= -1e-9 + giayDoc(BUOC(x.nuoc).at(-1)!), `${x.nuoc}: bước cuối không đủ thời gian đọc`);
  assert.ok(N.DAI - N.T_KET >= -1e-9 + giayDoc(...CHU_KET(x.nuoc)), `${x.nuoc}: màn kết không đủ thời gian đọc`);
  assert.ok(N.buocTu.every((t, i) => i === 0 || t > N.buocTu[i - 1]! + 1), `${x.nuoc}: các bước dồn nhau`);
}
assert.strictEqual(coTen('Japan'), 150); assert.strictEqual(coTen('United Arab Emirates'), 76);
assert.strictEqual(tenGon('Narita International Airport'), 'Narita');
assert.strictEqual(tenGon('Rome–Fiumicino Leonardo da Vinci International Airport'), 'Rome Fiumicino');   // tên thường gọi
assert.strictEqual(tenGon('Some Very Long Regional Name Field Airport'), 'Some Very Long Regional');   // dự phòng: giữ trọn từ, ≤24 ký tự, không "…"
assert.ok(BUOC('Italy')[0]!.startsWith('Install an Italy') && BUOC('Japan')[0]!.startsWith('Install a Japan'), 'mạo từ a/an');
assert.strictEqual(tpGon("Paris (Roissy-en-France, Val-d'Oise)"), 'Paris'); assert.strictEqual(tpGon('Manchester, Greater Manchester'), 'Manchester');
console.log(`may-dung-land: ${ds.length} đề đạt`);

// câu móc theo góc (26/10/2026): có moc thì thay dòng chung ở cảnh mở, vừa ≤ 3 dòng, cảnh mở dài đủ đọc; đề góc thật đều qua
{
  const { assLand, chuMo, nhipLand, CHU_MO } = await import('./may-dung-land');
  const { ngat } = await import('./may-dung-ass');
  const goc = (JSON.parse((await import('node:fs')).readFileSync(new URL('../../../../../scripts/ke-hoach-goc/byl-goc.json', import.meta.url), 'utf8')) as { slug: string; de: Parameters<typeof assLand>[0] }[]);
  for (const { slug, de } of goc) {
    assert.ok(de.moc && chuMo(de) === de.moc && assLand(de).includes(ngat(de.moc, 22)[0]!), `${slug}: câu móc không lên khung`);
    assert.ok(!assLand(de).includes(CHU_MO) || de.moc!.includes(CHU_MO), `${slug}: còn dòng chung`);
    assert.ok(ngat(de.moc!, 22).length <= 3, `${slug}: câu móc quá 3 dòng`);
    assert.ok(!/^landing in/i.test(de.moc!), `${slug}: câu móc lặp "Landing in" (tên nước đã to giữa màn)`);
  }
  const g = goc[0]!.de, khong = { ...g, moc: undefined };
  assert.strictEqual(chuMo(khong), CHU_MO, 'không có moc thì giữ câu chung');
  assert.ok(nhipLand(g).T_CUA !== nhipLand(khong).T_CUA, 'cảnh mở tính giờ đọc theo câu móc');
  console.log(`may-dung-land: ${goc.length} đề góc có câu móc trên khung`);
}
