// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-vat.test.mts
import assert from 'node:assert';
import { trangThai, cauVat, dongVat, loiSoVat, vatTrongKhung, type SoVat } from './so-vat';

const so: SoVat = {
  'Thùng': [{ tu: 1, ai: 'Hạ', cach: 'hugged against her chest with both arms', vi: 'Hạ ôm trước ngực' }],
  'Thẻ': [{ tu: 1, ai: 'Hạ', cach: 'on a dark blue lanyard around her neck', vi: 'đeo trên cổ Hạ' },
    { tu: 7, ai: 'Vivian', cach: "held by its snapped lanyard in Vivian's right fist, the card dangling below", vi: 'Vivian nắm dây đứt, thẻ lủng lẳng', su_kien: 'Vivian giật đứt dây' }],
};
assert.strictEqual(trangThai(so, 6)['Thẻ']!.ai, 'Hạ'); assert.strictEqual(trangThai(so, 9)['Thẻ']!.ai, 'Vivian');
// #8 cận Hạ (người trong khung: Hạ) → phải có thùng (bản cũ vẽ Hạ tay không), không có thẻ (đã sang Vivian)
assert.deepStrictEqual(vatTrongKhung(so, 8, ['Hạ']).map(([t]) => t), ['Thùng']);
assert.ok(cauVat(so, 10, ['Vivian']).includes('snapped lanyard') && !cauVat(so, 10, ['Vivian']).includes('hugged'));
assert.ok(dongVat(so, 7).some((x) => x.startsWith('⚡ Vivian giật đứt dây → Thẻ')));
// khung ĐẦU của mảnh có sự kiện: thẻ còn trên cổ Hạ; khung CUỐI: Vivian cầm
assert.strictEqual(trangThai(so, 7, 'dau')['Thẻ']!.ai, 'Hạ'); assert.strictEqual(trangThai(so, 7, 'ket')['Thẻ']!.ai, 'Vivian');
// đổi trạng thái thiếu sự kiện → lỗi; sự kiện ở khung không có người liên quan → lỗi
assert.ok(loiSoVat({ 'Thùng': [{ tu: 1, ai: 'Hạ', cach: 'a', vi: 'a' }, { tu: 9, ai: null, cach: 'on the floor', vi: 'trên sàn' }] }, () => ['Hạ'])[0]!.includes('không khai sự kiện'));
assert.ok(loiSoVat(so, (n) => (n === 7 ? ['Lục Thần'] : ['Hạ']))[0]!.includes('phải diễn ra trên hình'));
assert.deepStrictEqual(loiSoVat(so, () => ['Hạ', 'Vivian']), []);
console.log('so-vat.test: ok');
// VẮNG MẶT: món đã sang tay người khác → câu "không còn trên người" cho người giữ cũ còn trong khung
{ const so = { 'Thẻ': [{ tu: 1, ai: 'Hạ', cach: 'badge on lanyard around her neck', vi: 'đeo cổ' }, { tu: 7, ai: 'Vivian', cach: 'snapped lanyard in her fist', vi: 'nắm tay', su_kien: 'giật' }] };
  const c13 = cauVat(so, 13, ['Hạ'], (t) => t === 'Thẻ' ? 'the staff badge' : t);
  assert.ok(c13.includes('Hạ no longer has the staff badge'), c13);
  assert.ok(!cauVat(so, 3, ['Hạ'], (t) => t).includes('no longer'), 'chưa giật thì không có câu vắng');
  assert.ok(!cauVat(so, 7, ['Hạ', 'Vivian'], (t) => t, [], 'dau').includes('no longer'), 'khung đầu #7: sự kiện chưa xảy ra — cả Hạ lẫn Vivian không có câu vắng');
  assert.ok(cauVat(so, 7, ['Hạ', 'Vivian'], (t) => t, [], 'ket').includes('Hạ no longer has'), 'khung cuối #7: đã giật'); }
console.log('so-vat.test: ok (vắng mặt)');
