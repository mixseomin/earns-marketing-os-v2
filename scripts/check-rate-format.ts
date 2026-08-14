// Chạy: node scripts/check-rate-format.ts   (Node tự bóc type, không cần thêm dep/test runner)
// Kiểm normRate: phẩy thập phân phải đổi thành chấm, phẩy HÀNG NGHÌN phải giữ nguyên.
// Mọi ca dưới đây là chuỗi THẬT lấy từ affiliate_programs (23 dòng có phẩy, 2026-08-15) — không bịa.
import assert from 'node:assert';
import { normRate } from '../apps/web/src/lib/rate-format.ts';

// Thập phân → chấm (1-2 chữ số theo sau rồi hết).
for (const [raw, want] of [
  ['4,9%', '4.9%'],
  ['0,45%', '0.45%'],
  ['11,46%', '11.46%'],
  ['20–62,25%', '20–62.25%'],
  ['6,64% – 41,5%', '6.64% – 41.5%'],
  ['Up to 12,25%', 'Up to 12.25%'],
  ['0,4 USD', '0.4 USD'],
  ['2,8 %', '2.8%'],
] as const) assert.equal(normRate(raw), want, raw);

// HÀNG NGHÌN — giữ nguyên. Đổi thành chấm ở đây là sai giá trị 1000 lần.
for (const raw of ['105,000', '10,500 VND', '291,000', '54,000', '9,000 VND']) {
  assert.equal(normRate(raw), raw, raw);
}

// Bỏ khoảng trắng trước % (453 dòng), giữ nguyên dạng đã chuẩn (2.773 dòng).
assert.equal(normRate('70 %'), '70%');
assert.equal(normRate('10.5 %'), '10.5%');
assert.equal(normRate('30%'), '30%');
assert.equal(normRate('$1'), '$1');
assert.equal(normRate(null), null);
assert.equal(normRate('   '), null);

console.log('rate-format.ts OK — thập phân đổi, hàng nghìn giữ');
