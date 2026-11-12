// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/giong-cach-dien.test.mts — cách diễn → tốc độ + cảm xúc TTS (giong.ts › docCachDien)
import assert from 'node:assert';
import { docCachDien } from './giong';
assert.deepStrictEqual(docCachDien(''), { toc: null, cam: null });
assert.deepStrictEqual(docCachDien('vui vẻ, hào phóng'), { toc: 1.1, cam: 'happy' });
assert.deepStrictEqual(docCachDien('bực, hỏi dồn, gấp; câu cuối chậm lại, nghi'), { toc: 1.18, cam: 'angry' });
assert.deepStrictEqual(docCachDien('cúi mặt lí nhí, ngập ngừng'), { toc: 0.95, cam: 'sad' });
assert.strictEqual(docCachDien('gọi với theo, to, sốt ruột').toc, 1.18);
console.log('giong-cach-dien.test: ok');
