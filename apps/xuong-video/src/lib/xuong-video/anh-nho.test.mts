// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/anh-nho.test.mts
import assert from 'node:assert';
import { anhNho, anhGoc, nacNho } from './anh-nho';
const u = 'https://img.on.tc/xuong-video/keyframe/268-abc.jpg';
const n = anhNho(u, 160);
assert.strictEqual(n, `/api/xv/nho?w=160&u=${encodeURIComponent(u)}`);
assert.strictEqual(anhGoc(n), u, 'ngược lại được url gốc');
assert.strictEqual(anhGoc('http://127.0.0.1:13840' + n), u, 'currentSrc tuyệt đối');
assert.strictEqual(anhGoc(u), u);
assert.strictEqual(anhNho(null), null);
assert.strictEqual(anhNho('https://img.on.tc/xuong-video/xuat/17-A.mp4'), 'https://img.on.tc/xuong-video/xuat/17-A.mp4', 'video không thu nhỏ');
assert.strictEqual(anhNho('https://example.com/a.jpg'), 'https://example.com/a.jpg', 'ảnh ngoài kho giữ nguyên');
assert.strictEqual(anhNho('https://img.on.tc/xuong-video/nho/w160/x.jpg'), 'https://img.on.tc/xuong-video/nho/w160/x.jpg', 'ảnh nhỏ không thu nhỏ lần hai');
assert.strictEqual(anhNho('https://img.on.tc/xuong-video/anh/1.PNG', 640).startsWith('/api/xv/nho?w=640'), true);
assert.strictEqual(nacNho(22), 160); assert.strictEqual(nacNho(80), 160); assert.strictEqual(nacNho(150), 320); assert.strictEqual(nacNho(300), 640); assert.strictEqual(nacNho(900), 640);
console.log('anh-nho.test: ok');
