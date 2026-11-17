// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/keyframe-qwen.test.mts
import assert from 'node:assert';
import { chonAnhQwen, doiSoAnh, promptQwen } from './keyframe-qwen';
const vai = [{ url: 'k3d', nhan: '🎨 ảnh GỐC 3D' }, { url: 'nhoc', nhan: '🧍 Nhóc' }, { url: 'chai', nhan: '🧸 Chai' }, { url: 'tien', nhan: '🧸 Tiền' }, { url: 'set', nhan: '🏠 ảnh chuẩn bối cảnh' }];
assert.deepStrictEqual(chonAnhQwen(vai), [0, 1, 2], '3D · người · đồ — không đưa khung shot khác (🏠)');
assert.deepStrictEqual(chonAnhQwen([vai[0]!, vai[4]!, vai[2]!, vai[1]!]), [0, 3, 2], 'người trước đồ, bỏ 🏠');
assert.strictEqual(doiSoAnh('Nhóc — looks exactly like Image 2: boy', [0, 1, 4]), 'Nhóc — looks exactly like image 2: boy');
assert.strictEqual(doiSoAnh('Chai — looks exactly like Image 3: bottle', [0, 1, 4]), 'Chai —: bottle', 'ảnh bỏ: bỏ phần trỏ, giữ mô tả');
assert.ok(!/Image 5/.test(doiSoAnh('see Image 5 for the set', [0, 1, 4])) && /image 3/.test(doiSoAnh('see Image 5 for the set', [0, 1, 4])), 'ảnh 5 → image 3');
const r = promptQwen({ vai, khoi: [{ ma: 'anh_dich', chu: 'EDIT Image 1 RE-TEXTURING' } as never, { ma: 'may', chu: 'CAMERA high angle' } as never, { ma: 'nguoi', chu: 'Nhóc — looks exactly like Image 2: boy; Chai — looks exactly like Image 3: bottle' } as never, { ma: 'phong_cach', chu: 'Photo look: anime. Keep Image 1\'s light direction and colours.' } as never] });
assert.ok(!r.prompt.includes('RE-TEXTURING') && r.prompt.startsWith('Image 1 is only a rough 3D LAYOUT') && r.prompt.includes('REPLACE every block'), r.prompt);
assert.ok(r.prompt.includes('COMPOSITION comes ONLY from image 1') && r.prompt.includes('image 2 = Nhóc') && !/Image [3-9]/.test(r.prompt), r.prompt);
assert.deepStrictEqual(r.anh, ['k3d', 'nhoc', 'chai']);
console.log('keyframe-qwen: ok');
