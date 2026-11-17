// Tự kiểm cột Repo bảng Nhân sự: node_modules/.bin/tsx apps/cty/src/lib/repo-ky-su.test.mts
import assert from 'node:assert';
import { cayCua } from './repo-ky-su';

const thanh = cayCua('xu-task-astrolas');
assert.deepEqual(thanh.map((x) => x.dir), ['/Users/htuan/Me/GitHub/Astrolas.com'], 'Thành làm trong Astrolas.com');
const hieu = cayCua('xu-gop-y-spy');
assert.ok(hieu.some((x) => x.dir === '/Users/htuan/may-ky-su/hieu/earns-marketing-os-v2' && x.nhanh === 'ky-su/hieu' && x.may === 'iMac'), 'Hiếu có cây riêng mos2');
assert.ok(hieu.some((x) => x.repo === 'spy-on-tc'), 'Hiếu còn repo spy-on-tc (đọc từ mã spy-gop-y.mjs)');
assert.deepEqual(cayCua('xu-gop-y-cty').map((x) => x.nhanh), ['ky-su/khoi']);
assert.deepEqual(cayCua('off'), []);
for (const h of ['xu-task-astrolas', 'xu-gop-y-spy', 'sua-may', 'xu-gop-y-mos2']) console.log(h, JSON.stringify(cayCua(h)));
console.log('repo-ky-su: ok');
