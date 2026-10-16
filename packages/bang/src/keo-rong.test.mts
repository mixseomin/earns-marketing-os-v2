// node_modules/.bin/tsx packages/bang/src/keo-rong.test.mts
import assert from 'node:assert';
import { rongMoi, docRongCot, ghiRongCot } from './keo-rong';

assert.strictEqual(rongMoi(100, 30, 40, 500), 130);
assert.strictEqual(rongMoi(100, -90, 40, 500), 40, 'kẹp sàn');
assert.strictEqual(rongMoi(100, 900, 40, 500), 500, 'kẹp trần');
assert.strictEqual(rongMoi(100, 10, 60, 30), 60, 'trần < sàn → lấy sàn');
// không có localStorage (máy chủ / node) → {} và không ném
assert.deepStrictEqual(docRongCot('x'), {});
ghiRongCot('x', { a: 1 });
// có kho: ghi → đọc lại; giá trị hỏng bị lọc; rỗng → xoá khoá
const m = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
ghiRongCot('t', { hook: 320, so: 52 });
assert.deepStrictEqual(docRongCot('t'), { hook: 320, so: 52 });
m.set('t', JSON.stringify({ hook: 'x', so: -1, ok: 90 }));
assert.deepStrictEqual(docRongCot('t'), { ok: 90 });
m.set('t', '{hỏng'); assert.deepStrictEqual(docRongCot('t'), {});
ghiRongCot('t', {}); assert.strictEqual(m.has('t'), false);
console.log('keo-rong.test: ok');
