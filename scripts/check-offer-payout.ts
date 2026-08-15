// Chạy: node scripts/check-offer-payout.ts
// Kiểm phép quy tỉ lệ hoa hồng → tiền thật. Đây là phép tính RA TIỀN và nó đã từng sai 60 lần,
// nên mọi ca dưới đây là chuỗi THẬT lấy từ affiliate_programs.
import assert from 'node:assert';
import { payoutUsdOf, pctOf, payoutFromAov, amountsIn, currencyOf, derivePubRate, pubCut, PUB_SHARE } from '../apps/web/src/lib/offer-payout.ts';

// ── Sự cố 2026-08-15: bóc trụi ký tự phân cách làm hai số dính lại ──────────
// "Fixed reward €5–12" từng ra $552.96 (bóc thành "512" rồi × 1.08). Đúng phải là trung điểm 8.5.
assert.equal(payoutUsdOf('Fixed reward €5–12', null), 9.18);     // (5+12)/2 × 1.08
assert.equal(payoutUsdOf('$20-25', null), 22.5);                 // từng ra 2025
assert.equal(payoutUsdOf('$20 - 25', null), 22.5);
assert.equal(payoutUsdOf('€10–20', null), 16.2);
// Gạch en, gạch em, gạch thường, dấu ngã — người ta viết kiểu nào cũng phải ra như nhau.
for (const dash of ['-', '–', '—', '~', ' to ']) {
  assert.equal(payoutUsdOf(`$20${dash}25`, null), 22.5, dash);
}

// ── Khoản phẳng một số ──────────────────────────────────────────────────────
assert.equal(payoutUsdOf('USD 349.00', null), 349);              // '.' là thập phân, KHÔNG phải hàng nghìn
assert.equal(payoutUsdOf('$1', null), 1);
assert.equal(payoutUsdOf('USD 300.00', null), 300);
assert.equal(payoutUsdOf('€10', null), 10.8);
assert.equal(payoutUsdOf('CZK 100', null), 4.3);
// VN: cả '.' lẫn ',' là hàng nghìn.
assert.equal(payoutUsdOf('50.000đ', null), 2.04);
assert.equal(payoutUsdOf('105,000 VND', null), 4.29);
// Anh-Mỹ: phẩy là hàng nghìn.
assert.equal(payoutUsdOf('$1,250', null), 1250);
// Châu Âu: phẩy là thập phân.
assert.equal(payoutUsdOf('€4,90', null), 5.29);

// ── Không nói được thì để TRỐNG, đừng đoán ──────────────────────────────────
assert.equal(payoutUsdOf('30%', null), null);                    // % cần giá đơn hàng
assert.equal(payoutUsdOf('20–62,25%', null), null);
assert.equal(payoutUsdOf('3-10% + $20', null), null);            // có % → nhường pctOf
assert.equal(payoutUsdOf('100 XYZ', null), null);                // đơn vị lạ → KHÔNG bịa USD
assert.equal(payoutUsdOf('Liên hệ', null), null);
assert.equal(payoutUsdOf('', null), null);
assert.equal(payoutUsdOf(null, null), null);
assert.equal(payoutUsdOf('$0', null), null);                     // 0 = chưa có số, không phải "trả 0"

// ── Đoán đơn vị ─────────────────────────────────────────────────────────────
assert.equal(currencyOf('€5', null), 'EUR');
assert.equal(currencyOf('100', 'GBP'), 'GBP');                   // rơi về cột currency
assert.equal(currencyOf('CZK 100', null), 'CZK');
assert.equal(currencyOf('50.000đ', 'USD'), 'VND');               // ký hiệu THẮNG cột

// ── Tách số ─────────────────────────────────────────────────────────────────
assert.deepEqual(amountsIn('5–12', false), [5, 12]);
assert.deepEqual(amountsIn('349.00', false), [349]);
assert.deepEqual(amountsIn('50.000', true), [50000]);
assert.deepEqual(amountsIn('không có số', false), []);

// ── Phần trăm + AOV ─────────────────────────────────────────────────────────
assert.equal(pctOf('15-20%'), 17.5);
assert.equal(pctOf('5%'), 5);
assert.equal(pctOf('3-10% + $20'), 6.5);
assert.equal(pctOf('$30'), null);
assert.equal(payoutFromAov('10%', 200), 20);
assert.equal(payoutFromAov('10%', null), null);                  // chưa biết AOV → trống
assert.equal(payoutFromAov('$30', 200), null);


// ── Mức phát cho publisher ───────────────────────────────────────────────────
// Publisher KHÔNG được thấy mức nhà. Chuỗi mức nhà còn kèm ghi chú nội bộ, nên phải TÍNH LẠI chứ
// không cắt chữ: "2.5% (CJ link 15534820)" mà lọt xuống portal là lộ cả biên lẫn mã link.
assert.equal(derivePubRate('2.5% (CJ link 15534820)'), `${2.5 * PUB_SHARE}%`);
assert.equal(derivePubRate('$30'), `$${30 * PUB_SHARE}`);
assert.equal(derivePubRate('€5-12'), '€3.5-8.4');
assert.equal(derivePubRate('15-20%'), `${17.5 * PUB_SHARE}%`);   // khoảng → trung điểm, cùng luật pctOf
assert.equal(derivePubRate(null), null);
assert.equal(derivePubRate('theo thoả thuận'), null);            // không đọc được → ô trống
// Không bao giờ rơi về chuỗi gốc: đó đúng là lỗi cũ (portal fallback ?? upstreamRate).
for (const r of ['2.5% (CJ link 15534820)', '$30', 'theo thoả thuận'])
  assert.notEqual(derivePubRate(r), r, `derivePubRate không được trả nguyên mức nhà: ${r}`);
// Mức phát ra luôn NHỎ HƠN mức nhà — sai dấu ở đây là mình trả nhiều hơn số nhận được.
assert.ok(pubCut(19.75) < 19.75 && pubCut(19.75) > 0);
assert.equal(pubCut(19.75), 13.83);
assert.equal(pubCut(0), 0);


console.log('offer-payout.ts OK — khoảng không còn dính số, đơn vị lạ vẫn để trống');
