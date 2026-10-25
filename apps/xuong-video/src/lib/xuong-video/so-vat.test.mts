// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-vat.test.mts
import assert from 'node:assert';
import { trangThai, cauVat, dongVat, loiSoVat, vatTrongKhung, benTay, diChuyenKhongGhi, type SoVat } from './so-vat';

const so: SoVat = {
  'Thùng': [{ tu: 1, ai: 'Hạ', cach: 'hugged against her chest with both arms', vi: 'Hạ ôm trước ngực' }],
  'Thẻ': [{ tu: 1, ai: 'Hạ', cach: 'on a dark blue lanyard around her neck', vi: 'đeo trên cổ Hạ' },
    { tu: 7, ai: 'Vivian', cach: "held by its snapped lanyard in Vivian's right fist, the card dangling below", vi: 'Vivian nắm dây đứt bằng tay phải, thẻ lủng lẳng', su_kien: 'Vivian giật đứt dây' }],
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

// TAY CẦM: câu prompt nói tay nào → dòng tiếng Việt (câu kiểm khung đọc dòng này) phải nói đúng tay đó (phim #353: Vivian đổi tay qua cú cắt)
assert.strictEqual(benTay("held in Vivian's right hand"), 'phai'); assert.strictEqual(benTay('clenched in her left fist'), 'trai'); assert.strictEqual(benTay('held in both hands'), null);
{ const thieu: SoVat = { 'Thẻ': [{ tu: 1, ai: 'Hạ', cach: 'on her neck', vi: 'đeo cổ' }, { tu: 7, ai: 'Vivian', cach: "in Vivian's right hand", vi: 'Vivian cầm bằng dây đứt', su_kien: 'giật' }] };
  assert.ok(loiSoVat(thieu, () => null).some((l) => l.includes('TAY PHẢI')), 'vi thiếu tay → lỗi');
  thieu['Thẻ']![1]!.vi = 'Vivian cầm bằng tay phải'; assert.ok(!loiSoVat(thieu, () => null).some((l) => l.includes('TAY')), 'vi có đúng tay → không lỗi');
  thieu['Thẻ']![1]!.vi = 'Vivian cầm bằng TAY PHẢI'; assert.ok(!loiSoVat(thieu, () => null).some((l) => l.includes('TAY')), 'chữ hoa vẫn khớp');
  thieu['Thẻ']![1]!.vi = 'Vivian cầm bằng tay trái'; assert.ok(loiSoVat(thieu, () => null).some((l) => l.includes('TAY PHẢI')), 'vi sai tay → lỗi'); }
// ĐỔI CHỖ ĐỨNG không ghi sổ (phim #353 #17: Hạ bước vào thang mà vẫn đứng ngoài)
{ const so: SoVat = { 'Dáng Hạ': [{ tu: 1, ai: 'Hạ', cach: 'standing in the lobby', vi: 'đứng ở sảnh' }] };
  const shots = [{ thu_tu: 15, chu: 'Hạ turns toward the open elevator', nguoi: ['Hạ'] }, { thu_tu: 17, chu: 'Hạ steps into the elevator, doors close', nguoi: ['Hạ'] }];
  const l = diChuyenKhongGhi(shots, so); assert.strictEqual(l.length, 1); assert.ok(l[0]!.startsWith('#17'));
  so['Dáng Hạ']!.push({ tu: 17, ai: 'Hạ', cach: 'standing INSIDE the elevator cabin facing out', vi: 'đứng trong cabin thang', su_kien: 'Hạ bước vào thang' });
  assert.strictEqual(diChuyenKhongGhi(shots, so).length, 0, 'có mốc chỗ đứng → đạt');
  assert.strictEqual(diChuyenKhongGhi([{ thu_tu: 3, chu: 'Vivian strides in from the lobby opening', nguoi: ['Vivian'] }], {}).length, 0, '"strides in" không phải đi vào một nơi kín — không báo'); }
console.log('so-vat.test: ok (tay cầm · chỗ đứng)');
