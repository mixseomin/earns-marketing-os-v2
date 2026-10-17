// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/tu-sua-clip-do.test.mts
import assert from 'node:assert';
import { lintPrompt, loiDanSuaPrompt, laLoiTam, chonGiongDan } from './tu-sua-clip-do';
const k = (p: string) => lintPrompt(p).map((l) => l.key);
// ca thật đã hỏng
assert.deepStrictEqual(k('he squats down low, picks up a small object off the floor with one hand and stays in the deep squat'), ['cam_vat']);
assert.deepStrictEqual(k('he squats down low, picks a rolled-up gray sock off the rug with one hand'), ['cam_vat']);
assert.deepStrictEqual(k('from the deep squat he picks something up off the floor and stands back up in one smooth move'), ['cam_vat', 'dung_day']);
assert.deepStrictEqual(k('two hands grab the waistband of the light blue jeans and stretch it wide, then let go'), ['cap_khoa']);
assert.deepStrictEqual(k('the button and zip stay fully closed the whole time, nothing under the jeans is shown'), ['tu_nhay_cam']);
// prompt sạch không bị bắt
assert.deepStrictEqual(k('he hooks his thumbs in the belt loops of his light blue jeans, smiles at the camera and gives a small confident nod'), []);
assert.deepStrictEqual(k('he holds the deep squat, both hands resting on his knees, and smiles'), []);
assert.deepStrictEqual(k('his hand slides along the light blue jeans at the thigh and he gives a small happy laugh'), []);
const d = loiDanSuaPrompt({ prompt: 'p0', chu: 'He squats', loi: ['sock floats'], daThu: ['p-1'] });
assert.ok(d.includes('sock floats') && d.includes('"p-1"') && d.includes('He squats') && d.includes('button and zip'));
assert.ok(laLoiTam('lượt sinh bị từ chối: Kie.ai báo hỏng: Internal Error, Please try again later.'));
assert.ok(!laLoiTam('Request blocked: The generation was halted during Google safety review'), 'chặn an toàn là lỗi do prompt, phải viết lại');
assert.ok(!laLoiTam('cơ thể méo từ giây 1.7: hands distorted'));
assert.strictEqual(chonGiongDan('American man, 35, relaxed'), 'Chris');
assert.strictEqual(chonGiongDan('American man, 62, natural'), 'Bill');
assert.strictEqual(chonGiongDan('American man, 24'), 'Liam');
assert.strictEqual(chonGiongDan('American non-binary person, 33'), 'River');
assert.strictEqual(chonGiongDan('American woman, 48'), 'Sarah');
assert.strictEqual(chonGiongDan('nữ Mỹ 70 tuổi, ấm'), 'Matilda');
assert.strictEqual(chonGiongDan('American woman, 40s'), 'Sarah');
console.log('tu-sua-clip-do.test: ok');
