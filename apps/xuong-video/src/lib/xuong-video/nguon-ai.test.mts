// Tự kiểm nguon-ai.ts: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/nguon-ai.test.mts
import assert from 'node:assert';
import { coKhoa, mucOnDinh, tiLeDat, vndMoiLuot, fmtVnd, giaHien } from './nguon-ai';

// Khoá: đọc TÊN biến, nhiều tên ngăn bằng |; rỗng / chưa đặt = chưa có.
assert.strictEqual(coKhoa('GOOGLE_API_KEY|GEMINI_API_KEY', { GEMINI_API_KEY: 'x' }), true);
assert.strictEqual(coKhoa('ATLAS_API_KEY', { ATLAS_API_KEY: '' }), false);
assert.strictEqual(coKhoa('', { X: 'y' }), false, 'bên không có API (tài khoản web) → không có khoá');
// Ổn định: số thật 14 ngày đến 16/10/2026.
assert.strictEqual(mucOnDinh({ goi: 107, dat: 34, giay: 57, cents: 700, dat_gan: null, loi_gan: null }), 'do', 'Veo gọi thẳng Google 34/107');
assert.strictEqual(mucOnDinh({ goi: 618, dat: 576, giay: 62, cents: 1935, dat_gan: null, loi_gan: null }), 'vang', 'Nano Banana Google 576/618 = 93%');
assert.strictEqual(mucOnDinh({ goi: 92, dat: 92, giay: 188, cents: 1418, dat_gan: null, loi_gan: null }), 'tot');
assert.strictEqual(mucOnDinh(null), null);
assert.strictEqual(tiLeDat({ goi: 0, dat: 0, giay: null, cents: 0, dat_gan: null, loi_gan: null }), null, 'chưa có lượt không phải 0%');
// Tiền thật mỗi lượt: fal Veo Lite $14,18 / 92 clip ≈ 4.007₫.
assert.strictEqual(vndMoiLuot({ goi: 92, dat: 92, giay: 188, cents: 1418, dat_gan: null, loi_gan: null }), 4007);
assert.strictEqual(fmtVnd(null), '—');
// Giá không có link nguồn thì không hiện.
assert.strictEqual(giaHien({ gia_vnd: 3250, link: '' }), null);
assert.strictEqual(giaHien({ gia_vnd: 3250, link: 'https://shopaikey.com/models' }), 3250);
console.log('nguon-ai: đạt');
