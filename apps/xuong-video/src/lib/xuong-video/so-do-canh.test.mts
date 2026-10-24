// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-do-canh.test.mts
import assert from 'node:assert';
import { keThuaNhin, loiChuSoDo, loiCanMat, svgPhac, thayHuong, viTriMan, huongMan, cauHuong, kyVong, loiTruc, loiDoHuong, type SoDo } from './so-do-canh';

// Sảnh: thang máy ở bắc (y=7), máy toàn cảnh ở nam (y=0) nhìn bắc → đông = phải màn. Hạ trước thang (giữa trái), Vivian đứng phía đông Hạ, lối vào phía đông.
const s: SoDo = { moc: { thang: [0, 7], loi_vao: [5, 3], ha: [-1.4, 5.8], vi: [1.2, 5.6] },
  may: { toan: { dat: [0, 0], nhin: [0, 7] }, can_ha: { dat: [0.6, 3.6], nhin: [-0.5, 5.6] }, can_vi: { dat: [-0.6, 3.4], nhin: [0.7, 5.5] }, nguoc: { dat: [0, 9], nhin: [0, 4] } } };
const toan = { may: 'toan', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, nhin: { 'Vivian': 'Hạ' } };
assert.ok(viTriMan(s, toan, 'Hạ')! < 0 && viTriMan(s, toan, 'Vivian')! > 0, 'toàn cảnh: Hạ trái, Vivian phải');
assert.strictEqual(huongMan(s, toan, 'Vivian', 'Hạ'), -1, 'Vivian nhìn sang trái màn về Hạ');
// cận Vivian (máy phía nam-tây nhìn sang đông-bắc): Vivian nhìn Hạ → sang trái màn; thang máy (sau lưng-trái Vivian) cũng phía trái
const cv = { may: 'can_vi', o: { 'Vivian': 'vi', 'Hạ': 'ha' }, nhin: { 'Vivian': 'Hạ' } };
assert.strictEqual(huongMan(s, cv, 'Vivian', 'Hạ'), -1);
// cận Hạ: Hạ nhìn Vivian → sang phải màn (khớp ánh mắt ngược phía với cận Vivian)
const ch = { may: 'can_ha', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, nhin: { 'Hạ': 'Vivian' } };
assert.strictEqual(huongMan(s, ch, 'Hạ', 'Vivian'), 1);
// đi vào từ lối vào phía đông → vào từ phải màn ở toàn cảnh
const vao = { may: 'toan', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, vao: { 'Vivian': 'loi_vao' } };
assert.ok(cauHuong(s, vao, ['Hạ', 'Vivian']).includes('Vivian enters from screen right, moving toward screen left'), cauHuong(s, vao, ['Hạ', 'Vivian']));
assert.ok(cauHuong(s, toan, ['Hạ', 'Vivian']).includes('Hạ at screen left') && cauHuong(s, toan, ['Hạ', 'Vivian']).includes('Vivian looks toward screen left at Hạ'));
assert.deepStrictEqual(kyVong(s, ch, ['Hạ', 'Vivian'])['Hạ']!.nhin, 1);
// trục: toan → can_ha → can_vi cùng phía nam đường Hạ–Vivian → không lỗi; máy "nguoc" phía bắc (sau thang máy) → vượt trục
const ds = [{ thu_tu: 1, ...toan }, { thu_tu: 2, ...ch }, { thu_tu: 3, ...cv }];
assert.deepStrictEqual(loiTruc(s, ds, ['Hạ', 'Vivian']), []);
assert.strictEqual(loiTruc(s, [...ds, { thu_tu: 4, may: 'nguoc', o: { 'Hạ': 'ha', 'Vivian': 'vi' } }], ['Hạ', 'Vivian']).length, 1);
// cổng đo: Vivian nhìn sang phải (+20°) trong khi sơ đồ cần trái → lỗi; nhìn thẳng ống kính → lỗi; đúng → rỗng
assert.ok(loiDoHuong({ Vivian: { ben: 0, nhin: -1 } }, [{ ten: 'Vivian', o: { x: 0.5 }, nhin: { g: 20 } }])[0]!.includes('cần TRÁI'));
assert.ok(loiDoHuong({ Vivian: { ben: 0, nhin: -1 } }, [{ ten: 'Vivian', o: { x: 0.5 }, nhin: { g: 3 } }])[0]!.includes('thẳng ống kính'));
assert.deepStrictEqual(loiDoHuong({ Vivian: { ben: 1, nhin: -1 } }, [{ ten: 'Vivian', o: { x: 0.7 }, nhin: { g: -15 } }]), []);
assert.strictEqual(thayHuong(s, cv, 'her eyes flick {Vivian→Hạ}'), 'her eyes flick toward screen left');
// người ngoài khung: vẫn dùng để tính hướng nhìn, không nằm trong kỳ vọng / câu chỗ đứng
const ngoai = { ...ch, khung: ['Hạ'] };
assert.deepStrictEqual(Object.keys(kyVong(s, ngoai, ['Hạ', 'Vivian'])), ['Hạ']); assert.ok(!cauHuong(s, ngoai, ['Hạ', 'Vivian']).includes('Vivian at')); assert.ok(cauHuong(s, ngoai, ['Hạ', 'Vivian']).includes('Vivian is OFF SCREEN'));
console.log('so-do-canh.test: ok');
// tờ phác: cửa nằm giữa khung toàn cảnh, người gần to hơn người xa, có mũi tên khi khai hướng nhìn; máy quay lưng lại cửa thì không vẽ cửa
{ const sp = { ...s, phong: [{ loai: 'cua' as const, tu: [-0.6, 7] as [number, number], den: [0.6, 7] as [number, number], z1: 2.3 }] };
  const v = svgPhac(sp, { may: 'toan', o: { 'Hạ': 'ha' }, nhin: { 'Hạ': 'vi' } }, ['Hạ'], { 'Hạ': '#fff' });
  assert.ok(v.includes('#b9bec6') && v.includes('#e8212b'), 'có cửa + mũi tên');
  assert.ok(!svgPhac({ ...sp, may: { ...sp.may, lung: { dat: [0, 5], nhin: [0, 0] } } }, { may: 'lung', o: {} }, [], {}).includes('#b9bec6'), 'cửa sau lưng máy không vẽ'); }
// cận mặt quay lưng: máy đặt sau lưng người đang nhìn ra xa → lỗi; máy phía trước → không
{ const sl = { ...s, may: { ...s.may, sau_ha: { dat: [0, 4.0] as [number, number], nhin: [0, 5.8] as [number, number] }, truoc: { dat: [0, 6.6] as [number, number], nhin: [0, 5.8] as [number, number] } } };
  assert.strictEqual(loiCanMat(sl, [{ thu_tu: 2, co: 'cu', may: 'sau_ha', o: { 'Hạ': [0, 5.8] }, nhin: { 'Hạ': 'thang' } }]).length, 1);
  assert.deepStrictEqual(loiCanMat(sl, [{ thu_tu: 2, co: 'cu', may: 'truoc', o: { 'Hạ': [0, 5.8] }, nhin: { 'Hạ': 'thang' } }]), []);
  assert.deepStrictEqual(loiCanMat(sl, [{ thu_tu: 4, co: 'mcu', may: 'sau_ha', o: { 'Hạ': [0, 5.8], Vivian: [0, 6.6] }, khung: ['Hạ', 'Vivian'], nhin: { 'Hạ': 'Vivian' } }]), [], 'qua vai: vai Hạ tiền cảnh không phải lỗi');
  assert.ok(svgPhac(sl, { may: 'sau_ha', o: { 'Hạ': [0, 5.8] }, nhin: { 'Hạ': 'thang' } }, ['Hạ'], { 'Hạ': '#fff' }).includes('#1b1b1b'), 'quay lưng vẽ tóc'); }
console.log('so-do-canh.test: ok (tờ phác)');
// nửa lưng (phim #353 #2): máy trước-phải, Hạ nhìn cửa thang trong sâu ~48° → câu 3/4 lưng + cửa ở phía trước; chữ tay "door … behind her" bị chặn
{ const n = { ...s, ten: { thang: 'the elevator door' }, may: { ...s.may, can: { dat: [1.0, 4.2] as [number, number], nhin: [-0.4, 6.1] as [number, number], ong: 70 } } };
  const mm = { may: 'can', o: { 'Hạ': [-0.5, 6.0] as [number, number] }, nhin: { 'Hạ': 'thang' } }; n.moc = { ...n.moc, thang: [-0.3, 7.0] };
  const c = cauHuong(n, mm, ['Hạ'], (t) => t);
  assert.ok(c.includes('three-quarters away') && c.includes('never behind Hạ'), c);
  assert.strictEqual(loiChuSoDo(n, mm, 'Close-up of Hạ, the door softly blurred behind her.').length, 1);
  assert.deepStrictEqual(loiChuSoDo(n, mm, 'Close-up of Hạ, eyes on the floor indicator above the door in front of her.'), []);
  assert.deepStrictEqual(loiChuSoDo(n, mm, 'Close-up of Hạ from behind her right shoulder, three-quarter back view: her eyes on the indicator above the elevator door in front of her, the steel door filling the background beyond her.'), [], 'chỗ máy sau vai không phải lỗi');
  // máy phía trước cửa nhìn ngược ra: cửa ở phía máy → "in front of her" bị chặn
  const nguoc = { ...n, may: { ...n.may, truoc: { dat: [-0.4, 6.9] as [number, number], nhin: [-0.5, 4] as [number, number] } } };
  assert.strictEqual(loiChuSoDo(nguoc, { ...mm, may: 'truoc' }, 'the elevator door right in front of her').length, 1); }
console.log('so-do-canh.test: ok (nửa lưng + chữ trái sơ đồ)');
// kế thừa ánh nhìn: cuối #2 Hạ nhìn lối vào → #3 (Vivian vào từ lối vào, Hạ không khai) Hạ nhìn Vivian; đã khai thì giữ; đích người vắng thì bỏ
{ const k = { ...s, moc: { ...s.moc, loi_vao: [6, 3] as [number, number] } };
  const ds = keThuaNhin(k, [
    { sd: { may: 'toan', o: { 'Hạ': 'ha' }, nhin: { 'Hạ': 'thang' } }, sd_ket: { nhin: { 'Hạ': 'loi_vao' } } },
    { sd: { may: 'toan', o: { 'Hạ': 'ha', Vivian: 'vi' }, vao: { Vivian: 'loi_vao' }, nhin: { Vivian: 'Hạ' } } },
    { sd: { may: 'toan', o: { 'Hạ': 'ha' }, nhin: { 'Hạ': 'thang' } } },
    { sd: { may: 'toan', o: { 'Hạ': 'ha' } } }]);
  assert.strictEqual(ds[1]!.sd!.nhin!['Hạ'], 'Vivian'); assert.strictEqual(ds[2]!.sd!.nhin!['Hạ'], 'thang'); assert.strictEqual(ds[3]!.sd!.nhin!['Hạ'], 'thang');
  const vang = keThuaNhin(k, [{ sd: { may: 'toan', o: { 'Hạ': 'ha', Vivian: 'vi' }, nhin: { 'Hạ': 'Vivian' } } }, { sd: { may: 'toan', o: { 'Hạ': 'ha' } } }]);
  assert.strictEqual(vang[1]!.sd!.nhin!['Hạ'], undefined, 'đích người không có trong mảnh → bỏ');
  assert.ok(cauHuong(k, ds[1]!.sd!, ['Hạ', 'Vivian']).includes('Vivian at the very screen-right edge'), cauHuong(k, ds[1]!.sd!, ['Hạ', 'Vivian'])); }
console.log('so-do-canh.test: ok (kế thừa ánh nhìn + người đang vào ở mép)');
// giữ qua cận chèn, hết khi đổi chỗ
{ const k = { ...s, moc: { ...s.moc, loi_vao: [6, 3] as [number, number], trong: [0, 7.5] as [number, number] } };
  const ds = keThuaNhin(k, [{ sd: { may: 'toan', o: { 'Hạ': 'ha', Vivian: 'vi' }, nhin: { 'Hạ': 'Vivian' } } }, { sd: { may: 'toan', o: { 'Hạ': 'ha', Vivian: 'vi' }, khung: [] } },
    { sd: { may: 'toan', o: { 'Hạ': 'ha', Vivian: 'vi' } } }, { sd: { may: 'toan', o: { 'Hạ': 'trong' } } }]);
  assert.strictEqual(ds[2]!.sd!.nhin!['Hạ'], 'Vivian', 'qua cận chèn vẫn giữ'); assert.strictEqual(ds[3]!.sd!.nhin!['Hạ'], undefined, 'đổi chỗ → hết'); }
console.log('so-do-canh.test: ok (kế thừa qua cận chèn, hết khi đổi chỗ)');
