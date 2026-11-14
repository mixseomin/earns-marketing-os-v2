// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/can-giong.test.mts
import assert from 'node:assert';
import { doLech, vaoSauCanh, duongAmLuong, DIEM_GIAY } from './can-giong';

// tiếng giả: câu = cụm năng lượng có nhịp (3 âm tiết), clip có câu đó TRỄ 0,8 s so với chỗ đặt (1,1 s) + tiếng nền nhỏ
const cau = new Float32Array(90).map((_, i) => (Math.floor(i / 15) % 2 ? 900 : 200) + (i % 7) * 20);
const clip = new Float32Array(4 * DIEM_GIAY).map((_, i) => 60 + (i % 11));
clip.set(cau, Math.round(1.9 * DIEM_GIAY));
const d = doLech(clip, cau, 1.1);
assert.ok(Math.abs(d.lech - 0.8) < 0.02 && d.tq > 0.9, JSON.stringify(d));
// dời điểm vào: 1,0 + 0,8 = 1,8 nhưng clip 4,1 s, phát 2 s → kẹp 1,65 (lệch kẹp 0,15 ≤ 0,25 → nhận)
assert.deepStrictEqual(vaoSauCanh(1.0, [d], 4.1, 2), { vao: 1.65, lech: 0.8, loi: null });
// phá thử: clip quá ngắn để bù → lỗi; không tương quan → lỗi
assert.ok(vaoSauCanh(1.0, [{ lech: 1.4, tq: 0.9 }], 4.1, 2).loi!.includes('không đủ dài'));
assert.ok(vaoSauCanh(1.0, [{ lech: 0.5, tq: 0.1 }], 4.1, 2).loi!.includes('không đo được'));
// đường âm lượng: 1 s tiếng 8 kHz → 100 điểm
assert.strictEqual(duongAmLuong(new Int16Array(8000).fill(100), 8000).length, 100);
console.log('✓ can-giong');
