import assert from 'node:assert';
import { chonNguoiBanCkey, laHetTien, chuoiAnh, taNguon, taThu, tachKhoa, taNguonNgan } from './cong-ai';

// hết tiền: đúng câu lỗi thật của từng cổng (Google 14/10/2026), không nhầm lỗi máy chủ
assert.strictEqual(laHetTien('google', 'gemini-nano-banana-2.1: RESOURCE_EXHAUSTED: Your prepayment credits are depleted.'), true);
assert.strictEqual(laHetTien('ckey', 'HTTP 502: The upstream AI gateway is unavailable.'), false);
assert.strictEqual(laHetTien('shopaikey', 'HTTP 403: user quota is not enough'), true);
assert.strictEqual(laHetTien('ckey', 'x', 402), true);
// chuỗi: chỉ model ảnh Google, chỉ cổng có khoá, ckey trước ShopAIKey
process.env.CKEY_API_KEY = 'k'; process.env.SHOPAIKEY_API_KEY = 'k';
assert.deepStrictEqual(chuoiAnh('gemini-nano-banana-2.1').map((x) => x.cong), ['ckey', 'ckey', 'ckey', 'shopaikey']);
assert.deepStrictEqual(chuoiAnh('fal:bytedance/seedream'), []);
delete process.env.CKEY_API_KEY;
assert.deepStrictEqual(chuoiAnh('gemini-nano-banana-2.1').map((x) => x.cong), ['shopaikey']);
// dòng nguồn
const n = { cong: 'ckey' as const, model: 'wowztools/nano-banana-2', model_that: 'gemini-3.1-flash-image-portrait', vnd: 110.5, giay: 39, thu: [{ cong: 'ckey' as const, model: 'wowztools/nano-banana-2', ok: true }] };
assert.strictEqual(taNguon(n), 'ckey.vn · wowztools/nano-banana-2 → gemini-3.1-flash-image-portrait · 110,5₫ · 39s');
assert.match(taThu({ ...n, thu: [{ cong: 'ckey', model: 'a', ok: false, loi: 'HTTP 502', het_tien: false }, { cong: 'shopaikey', model: 'b', ok: true }] }), /ckey.vn a ✗ HTTP 502 → ShopAIKey b ✓/);
// khoá model: đích danh cổng / Google trực tiếp / tự chọn
assert.deepStrictEqual(tachKhoa('ckey:wowztools/nano-banana-pro'), { kieu: 'cong', cong: 'ckey', model: 'wowztools/nano-banana-pro' });
assert.deepStrictEqual(tachKhoa('google:veo-3.1-lite-generate-preview'), { kieu: 'google', model: 'veo-3.1-lite-generate-preview' });
assert.deepStrictEqual(tachKhoa('gemini-nano-banana-2.1'), { kieu: 'tu_chon', model: 'gemini-nano-banana-2.1' });
// nhãn ngắn: job có nguồn / job cũ chỉ có provider + model
assert.strictEqual(taNguonNgan(n), 'ckey.vn · nano-banana-2');
assert.strictEqual(taNguonNgan(null, 'shopaikey', 'grok-imagine-video-1.5'), 'ShopAIKey · grok-imagine-video-1.5');
assert.strictEqual(taNguonNgan(null, 'google', 'gemini-nano-banana-2.1'), 'Google · gemini-nano-banana-2.1');
console.log('cong-ai.ts: ok');

// Người bán ckey dự phòng cho nhau: đúng dòng Nano Banana, rẻ hơn trần, NB2 trước Pro, bỏ người đang nghỉ (danh mục thật 15/10/2026).
{ const dm = [{ id: 'dungcsnd113/gemini-3.1-flash-image', vnd: 65 }, { id: 'wowztools/nano-banana-pro', vnd: 110.5 }, { id: 'wowztools/Nano-Banana-2', vnd: 110.5 },
    { id: 'wowztools/Nano-Banana-2-Lite', vnd: 110.5 }, { id: 'phuocanh421994/Qwen_Image_3.0_Pro', vnd: 120 }, { id: 'danielnguyenkarate/nano-banana-2', vnd: 480 }, { id: 'danielnguyenkarate/nano-banana-pro', vnd: 960 }];
  assert.deepStrictEqual(chonNguoiBanCkey(dm, new Set()).map((x) => x.model), ['dungcsnd113/gemini-3.1-flash-image', 'wowztools/Nano-Banana-2', 'danielnguyenkarate/nano-banana-2', 'wowztools/nano-banana-pro']);
  assert.deepStrictEqual(chonNguoiBanCkey(dm, new Set(['wowztools/Nano-Banana-2', 'dungcsnd113/gemini-3.1-flash-image'])).map((x) => x.model)[0], 'danielnguyenkarate/nano-banana-2');
  assert.strictEqual(chonNguoiBanCkey(dm, new Set(), 683, new Set(['wowztools/Nano-Banana-2']))[0]!.model, 'wowztools/Nano-Banana-2', 'người vừa đạt lên đầu');
  console.log('cong-ai.test: người bán ckey ok'); }
