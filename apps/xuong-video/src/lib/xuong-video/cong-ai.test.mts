import assert from 'node:assert';
import { laHetTien, chuoiAnh, taNguon, taThu } from './cong-ai';

// hết tiền: đúng câu lỗi thật của từng cổng (Google 14/10/2026), không nhầm lỗi máy chủ
assert.strictEqual(laHetTien('google', 'gemini-nano-banana-2.1: RESOURCE_EXHAUSTED: Your prepayment credits are depleted.'), true);
assert.strictEqual(laHetTien('ckey', 'HTTP 502: The upstream AI gateway is unavailable.'), false);
assert.strictEqual(laHetTien('shopaikey', 'HTTP 403: user quota is not enough'), true);
assert.strictEqual(laHetTien('ckey', 'x', 402), true);
// chuỗi: chỉ model ảnh Google, chỉ cổng có khoá, ckey trước ShopAIKey
process.env.CKEY_API_KEY = 'k'; process.env.SHOPAIKEY_API_KEY = 'k';
assert.deepStrictEqual(chuoiAnh('gemini-nano-banana-2.1').map((x) => x.cong), ['ckey', 'ckey', 'shopaikey']);
assert.deepStrictEqual(chuoiAnh('fal:bytedance/seedream'), []);
delete process.env.CKEY_API_KEY;
assert.deepStrictEqual(chuoiAnh('gemini-nano-banana-2.1').map((x) => x.cong), ['shopaikey']);
// dòng nguồn
const n = { cong: 'ckey' as const, model: 'wowztools/nano-banana-2', model_that: 'gemini-3.1-flash-image-portrait', vnd: 110.5, giay: 39, thu: [{ cong: 'ckey' as const, model: 'wowztools/nano-banana-2', ok: true }] };
assert.strictEqual(taNguon(n), 'ckey.vn · wowztools/nano-banana-2 → gemini-3.1-flash-image-portrait · 110,5₫ · 39s');
assert.match(taThu({ ...n, thu: [{ cong: 'ckey', model: 'a', ok: false, loi: 'HTTP 502', het_tien: false }, { cong: 'shopaikey', model: 'b', ok: true }] }), /ckey.vn a ✗ HTTP 502 → ShopAIKey b ✓/);
console.log('cong-ai.ts: ok');
