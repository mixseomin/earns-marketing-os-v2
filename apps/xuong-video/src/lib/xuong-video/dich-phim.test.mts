// Tự kiểm phần thuần của dịch phim: gom/thay chuỗi (cả khoá JSON), chia lô ngắn trước, thoại đổi lời thì bỏ file giọng, ước tiền theo số đo thật.
import assert from 'node:assert';
import { gomChuoi, thayChuoi, chiaLo, thoaiSauDich, uocDichCents } from './dich-phim';
const v = { a: 'Món hời của ổng', b: ['Hook', 'Bà Linda'], c: { 'Món hời của ổng': 'nhạc vui' }, d: 'https://x.y/z', e: 3 };
const s = new Set<string>(); gomChuoi(v, s);
assert.deepEqual([...s].sort(), ['Bà Linda', 'Món hời của ổng', 'nhạc vui'].sort());   // 'Hook', URL, số không gom; khoá có dấu được gom
const m = new Map([['Món hời của ổng', 'His Bargain'], ['Bà Linda', 'Linda'], ['nhạc vui', 'upbeat music']]);
assert.deepEqual(thayChuoi(v, m), { a: 'His Bargain', b: ['Hook', 'Linda'], c: { 'His Bargain': 'upbeat music' }, d: 'https://x.y/z', e: 3 });   // khoá đổi theo cùng bảng
const lo = chiaLo(['x'.repeat(50), 'ab', 'y'.repeat(7000), 'cd'], 60);
assert.deepEqual(lo.map((l) => l.map((x) => x.length)), [[2, 2, 50], [7000]]);   // ngắn trước, chuỗi dài quá trần đứng riêng
assert.deepEqual(chiaLo([]), []);
const t = thoaiSauDich([{ nhan_vat: 'Bà Linda', dien_xuat: 'thì thầm', loi: 'Grab two.', url: 'a.mp3' }, { nhan_vat: 'Bà Linda', dien_xuat: '', loi: 'Rẻ quá.', url: 'b.mp3' }],
  new Map([['Bà Linda', 'Linda'], ['thì thầm', 'whispering'], ['Rẻ quá.', 'So cheap.']]));
assert.deepEqual(t, [{ nhan_vat: 'Linda', dien_xuat: 'whispering', loi: 'Grab two.', url: 'a.mp3' }, { nhan_vat: 'Linda', dien_xuat: '', loi: 'So cheap.', url: null }]);
const u = uocDichCents('claude-opus-5-5', 14_023);   // đo thật một lô: $0,26 — ước phải nằm trong ±25%
assert.ok(u > 26 * 0.75 && u < 26 * 1.25, String(u));
console.log('dich-phim.test: ok');
