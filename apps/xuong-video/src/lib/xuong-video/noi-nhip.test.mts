// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/noi-nhip.test.mts
import assert from 'node:assert';
import { loiNoiNhip } from './noi-nhip';

// #322 trước khi sửa: hai mảnh chỉ có câu diễn, không đuôi / đầu / cớ → báo
assert.deepStrictEqual(loiNoiNhip([{ thu_tu: 8, dan_dung: { dien: 'Vivian smiles' } }, { thu_tu: 9, dan_dung: { dien: 'door opens' } }]).length, 1);
// đủ: Vivian liếc trái khi chuông vang (tiếng dẫn trước điểm cắt) → cửa thang mở
const tot = [{ thu_tu: 8, dan_dung: { mo: 'Vivian raises the badge', ket: 'the chime sounds; her eyes flick to screen left', noi: 'tieng' as const }, ky_thuat: { am_thanh: ['ding@-0.6'] } },
  { thu_tu: 9, dan_dung: { mo: 'the elevator door is already sliding open', ket: 'Lục Thần strides out' } }];
assert.deepStrictEqual(loiNoiNhip(tot), []);
// cắt theo tiếng mà tiếng không vang trước điểm cắt → báo
assert.ok(loiNoiNhip([{ ...tot[0]!, ky_thuat: { am_thanh: ['ding'] } }, tot[1]!])[0]!.includes('vang trước điểm cắt'));
// cắt theo ánh mắt mà đuôi không có cái nhìn → báo; đầu shot sau trống → báo
const l = loiNoiNhip([{ thu_tu: 2, dan_dung: { mo: 'x', ket: 'she smiles', noi: 'nhin' } }, { thu_tu: 3, dan_dung: {} }]);
assert.ok(l.some((x) => x.includes('không có cái nhìn')) && l.some((x) => x.includes('đầu #3 trống')), l.join(' | '));
// shot cuối không cần cớ
assert.deepStrictEqual(loiNoiNhip([tot[1]!]), []);
console.log('noi-nhip.test: ok');
