// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/giong-rieng.test.mts
import assert from 'node:assert';
import { chonGiongRieng, gioiTheoMoTa } from './giong-rieng';
const DS = 'Aria,Roger,Sarah,Laura,Charlie,George,Callum,River,Liam,Charlotte,Alice,Matilda,Will,Jessica,Eric,Chris,Brian,Daniel,Lily,Bill'.split(',');
assert.strictEqual(gioiTheoMoTa('huge broad-shouldered man in his 60s'), 'nam');
assert.strictEqual(gioiTheoMoTa('sharp middle-aged office manager, red lipstick; she never smiles'), 'nu');
assert.strictEqual(gioiTheoMoTa('slim young red fox'), '');
// không bao giờ trùng người dẫn / nhân vật khác
for (let id = 1; id < 60; id++) assert.ok(!['George', 'Roger'].includes(chonGiongRieng({ id, mo_ta: 'a fox' }, DS, ['George', 'Roger'])));
// đúng giới
assert.ok(['Roger', 'Charlie', 'Callum', 'Liam', 'Will', 'Eric', 'Chris', 'Brian', 'Daniel', 'Bill'].includes(chonGiongRieng({ id: 7, mo_ta: 'a tall man' }, DS, ['George'])));
assert.ok(['Aria', 'Sarah', 'Laura', 'Charlotte', 'Alice', 'Matilda', 'Jessica', 'Lily'].includes(chonGiongRieng({ id: 7, mo_ta: 'an old woman' }, DS, [])));
// ổn định + hết giọng trống thì vẫn trả một giọng
assert.strictEqual(chonGiongRieng({ id: 3, mo_ta: '' }, DS, ['George']), chonGiongRieng({ id: 3, mo_ta: '' }, DS, ['George']));
assert.ok(DS.includes(chonGiongRieng({ id: 3, mo_ta: '' }, DS, DS)));
assert.strictEqual(chonGiongRieng({ id: 3, mo_ta: '' }, [], []), '');
console.log('giong-rieng.test: ok');
