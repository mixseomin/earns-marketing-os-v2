import assert from 'node:assert';
import { ghepNext } from './login-next';
// cổng nginx gửi next không mã hoá: /login?next=https://worlds.on.tc/?kh=cong-trinh&buoc=6
assert.equal(ghepNext({ next: 'https://worlds.on.tc/?kh=cong-trinh', buoc: '6' }), 'https://worlds.on.tc/?kh=cong-trinh&buoc=6');
assert.equal(ghepNext({ next: 'https://worlds.on.tc/', buoc: '6', error: 'x' }), 'https://worlds.on.tc/?buoc=6');   // error là của /login
assert.equal(ghepNext({ next: '/p/adfond/plays?view=tiendo' }), '/p/adfond/plays?view=tiendo');                      // đã mã hoá: giữ nguyên
assert.equal(ghepNext({}), '/');
assert.equal(ghepNext({ next: 'https://a.on.tc/?x=1', t: ['1', '2'] }), 'https://a.on.tc/?x=1&t=1&t=2');
console.log('login-next: 5/5 đạt');
