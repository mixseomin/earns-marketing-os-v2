// goiLaiKhiMang (claude.ts): lỗi mạng "fetch failed" thử lại, lỗi khác ném ngay (19/11/2026)
import assert from 'node:assert';
import { goiLaiKhiMang } from './claude';

let n = 0;
assert.equal(await goiLaiKhiMang(async () => { if (++n < 3) throw new TypeError('fetch failed'); return 'ok'; }, [1, 1, 1]), 'ok');
assert.equal(n, 3, 'thử lại tới khi được');
n = 0;
await assert.rejects(goiLaiKhiMang(async () => { n++; throw new Error('cổng AI: HTTP 500'); }, [1, 1]), /HTTP 500/);
assert.equal(n, 1, 'lỗi HTTP không thử lại');
n = 0;
await assert.rejects(goiLaiKhiMang(async () => { n++; throw new TypeError('fetch failed'); }, [1, 1]), /fetch failed/);
assert.equal(n, 3, 'hết lượt chờ thì ném');
console.log('goi-lai-mang: 6/6 đạt');
