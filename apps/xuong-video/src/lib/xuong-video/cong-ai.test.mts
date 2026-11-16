import assert from 'node:assert';
import { TOI_DA_REF, coCong, laHetTien, chuoiAnh, chuoiVideo, taNguon, taThu, tachKhoa, taNguonNgan } from './cong-ai';

// hết tiền: đúng câu lỗi thật của từng cổng (Google 14/10/2026), không nhầm lỗi máy chủ
assert.strictEqual(laHetTien('google', 'gemini-nano-banana-2.1: RESOURCE_EXHAUSTED: Your prepayment credits are depleted.'), true);
assert.strictEqual(laHetTien('ckey', 'HTTP 502: The upstream AI gateway is unavailable.'), false);
assert.strictEqual(laHetTien('shopaikey', 'HTTP 403: user quota is not enough'), true);
assert.strictEqual(laHetTien('ckey', 'x', 402), true);
// chuỗi: chỉ model ảnh Google, ckey trước ShopAIKey. Khoá nằm ở CỔNG AI CHUNG (16/11/2026) → chuỗi không còn đổi theo khoá trong tiến trình studio.
assert.deepStrictEqual(chuoiAnh('gemini-nano-banana-2.1').map((x) => x.cong), ['ckey', 'ckey', 'ckey', 'plenxai', 'shopaikey'], 'PlenX 200₫ sau ckey 110₫, trước ShopAIKey 683₫ (21/10/2026)');
assert.deepStrictEqual(chuoiAnh('fal:bytedance/seedream'), []);
process.env.CKEY_API_KEY = ''; assert.ok(coCong('ckey'), 'khoá ckey ở studio không còn quyết định gì — cổng giữ khoá');
assert.ok(!coCong('wavespeed'), 'WaveSpeed chưa có tuyến ở cổng → ẩn');
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

// Bộ chọn người bán ckey (dự phòng lẫn nhau, bỏ người lờ tham chiếu / bản Pro) + đọc số dư ShopAIKey: nằm ở cổng (spy-on-tc/server/cong-anh.mjs › chonNguoiBan) từ 16/11/2026.

assert.strictEqual(TOI_DA_REF.ckey, 3, 'ckey nhận tối đa 3 ảnh tham chiếu (đo 15/10/2026)');

// Chuỗi video (16/10/2026): Kie.ai đứng đầu Veo khi có khoá; phim QC bỏ Grok; không khoá Kie thì như cũ.
assert.deepStrictEqual(chuoiVideo('veo-3.1-lite-generate-preview', true).map((x) => `${x.cong}:${x.model}`), ['plenxai:veo3-lite', 'kie:veo3_lite', 'shopaikey:grok-video-3-10s', 'shopaikey:grok-imagine-video-1.5'], 'PlenX đầu chuỗi (21/10/2026), Kie dự phòng');
assert.deepStrictEqual(chuoiVideo('veo-3.1-fast-generate-preview', false).map((x) => `${x.cong}:${x.model}`), ['plenxai:veo3-fast', 'kie:veo3_fast', 'shopaikey:grok-video-3-10s', 'shopaikey:grok-imagine-video-1.5']);
assert.deepStrictEqual(chuoiVideo('veo-3.1-generate-preview', true).map((x) => x.cong), ['shopaikey', 'shopaikey'], 'Veo Quality: Kie / PlenX chưa vào chuỗi');
assert.deepStrictEqual(tachKhoa('plenxai:veo3-lite'), { kieu: 'cong', cong: 'plenxai', model: 'veo3-lite' });
assert.deepStrictEqual(tachKhoa('wavespeed:kwaivgi/kling-v3.0-std/image-to-video'), { kieu: 'cong', cong: 'wavespeed', model: 'kwaivgi/kling-v3.0-std/image-to-video' });
console.log('cong-ai: chuỗi video đạt');

