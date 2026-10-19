import assert from 'node:assert';
import { canNhin, dichNhin } from './bo-set-3d';
import { loiNhin, chanKhung, NGUONG_NHIN, nguoiSoiMat, canTheoCap, giuCanCap, canSuaMat, keHoachSuaMat, nhanSuaMat } from './khung';
import type { SoiMat } from './kieu';

// Hai người đối mặt: Vivian (300,640) nhìn về −y (huong 0) tới Hạ (300,540). Máy ở bên trái (x nhỏ) nhìn sang +x → phải màn = −y.
const m = { dat: [100, 590, 160], nhin: [300, 590, 160], ong_kinh: 50, vi_tri: [{ ten: 'Vivian', tam: [300, 640, 0], huong: 0 }, { ten: 'Hạ', tam: [300, 540, 0], huong: 180 }] };
const la = () => true;
assert.equal(dichNhin(m.vi_tri[0]!, m.vi_tri)?.ten, 'Hạ');
assert.equal(canNhin(m, 'Vivian', la), 1, 'Vivian nhìn về Hạ = phải màn');
assert.equal(canNhin(m, 'Hạ', la), -1);
assert.equal(canNhin({ ...m, vi_tri: [m.vi_tri[0]!] }, 'Vivian', la), 0, 'không có người để nhìn');
// Đo trên ảnh (số thật tập 122): #3 Vivian +10° (ống kính) → lỗi; #4 Hạ −48° cần trái → đạt.
const sm = (ket: SoiMat['ket']): SoiMat => ({ url: 'k', luc: '', mat: 1, ket, dat: true });
assert.match(loiNhin(sm([{ ten: 'Vivian', giong: 0.6, dat: true, nhin: { g: 10.2, dau: 10.8, mat: -0.01, doc: 3, can: 1 } }]))[0]!, /ống kính/);
assert.deepEqual(loiNhin(sm([{ ten: 'Hạ', giong: 0.6, dat: true, nhin: { g: -48, dau: -37, mat: -0.18, doc: 3, can: -1 } }])), []);
assert.match(loiNhin(sm([{ ten: 'Hạ', giong: 0.6, dat: true, nhin: { g: 30, dau: 25, mat: 0.1, doc: 0, can: -1 } }]))[0]!, /sai phía/);
assert.deepEqual(loiNhin(sm([{ ten: 'Hạ', giong: 0.6, dat: true, nhin: { g: 2, dau: 2, mat: 0, doc: 0 } }])), [], 'không có phía cần nhìn (vd nói với máy): không xét');
assert.equal(NGUONG_NHIN, 15);
// Cổng: nhìn ống kính chặn; nhận tay thì qua.
const c = { keyframe_url: 'k', kiem_khung: null, soi_mat: sm([{ ten: 'Vivian', giong: 0.6, dat: true, nhin: { g: 10, dau: 10, mat: 0, doc: 0, can: 1 } }]) };
assert.match(chanKhung(c as never) ?? '', /ánh mắt/);
assert.doesNotMatch(chanKhung({ ...c, soi_mat: { ...c.soi_mat, duyet_tay: 'anh' } } as never) ?? '', /ánh mắt/);

// ── CẶP SHOT (canTheoCap): #1 Vivian nhìn phải màn (3D biết, +40°); #2 cận Hạ — 3D không khai Vivian nên không có phía cần nhìn
const mat = (ten: string, g: number, can?: 1 | -1) => ({ ten, giong: 0.6, dat: true, o: { x: 0.5, y: 0.3 }, nhin: { g, dau: g, mat: 0, doc: 0, ...(can ? { can } : {}) } });
const shot = (id: number, ket: SoiMat['ket'], vi: string[], pd = 'P1') => ({ id, thu_tu: id, phan_doan: pd, keyframe_url: `k${id}`, soi_mat: { url: `k${id}`, luc: '', mat: 1, ket, dat: true }, may_3d: { vi_tri: vi.map((ten) => ({ ten, tam: [0, 0, 0] })) } }) as never;
{
  const r = canTheoCap([shot(1, [mat('Vivian', 40, 1)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', 3)], ['Hạ'])]);
  const h = r.get(2)!.find((k) => k.ten === 'Hạ')!.nhin!;
  assert.deepEqual([h.can, h.tu], [-1, 1], 'Hạ phải nhìn TRÁI màn — ngược Vivian ở #1');
  assert.match(loiNhin({ url: 'k2', luc: '', mat: 1, ket: r.get(2)!, dat: true })[0]!, /ống kính.*#1/, 'Hạ nhìn ống kính (+3°) → lỗi, nêu shot đối đáp');
  // cùng phía: Hạ +30° (nhìn phải giống Vivian) → sai phía
  const r2 = canTheoCap([shot(1, [mat('Vivian', 40, 1)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', 30)], ['Hạ'])]);
  assert.match(loiNhin({ url: 'k2', luc: '', mat: 1, ket: r2.get(2)!, dat: true })[0]!, /sai phía/);
  // nhìn ngược đúng (−35°) → không lỗi
  const r3 = canTheoCap([shot(1, [mat('Vivian', 40, 1)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', -35)], ['Hạ'])]);
  assert.deepEqual(loiNhin({ url: 'k2', luc: '', mat: 1, ket: r3.get(2)!, dat: true }), []);
  // KHÔNG suy: khác phân cảnh · bên kia không đáng tin (Vivian nhìn ống kính) · không liên hệ 3D · hai mặt trong một shot · 3D đã có phía
  assert.equal(canTheoCap([shot(1, [mat('Vivian', 40, 1)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', 3)], ['Hạ'], 'P2')]).size, 0, 'khác phân cảnh');
  assert.equal(canTheoCap([shot(1, [mat('Vivian', 5, 1)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', 3)], ['Hạ'])]).size, 0, 'Vivian tự sai thì không làm mốc');
  assert.equal(canTheoCap([shot(1, [mat('Vivian', 40, 1)], ['Vivian']), shot(2, [mat('Hạ', 3)], ['Hạ'])]).size, 0, 'không có gì nói hai người đối đáp');
  assert.equal(canTheoCap([shot(1, [mat('Vivian', 40, 1), mat('Thần', 20)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', 3)], ['Hạ'])]).size, 0, 'shot hai mặt: không biết ai là người đối đáp');
  assert.equal(canTheoCap([shot(1, [mat('Vivian', 40, 1)], ['Vivian', 'Hạ']), shot(2, [mat('Hạ', -30, -1)], ['Hạ', 'Vivian'])]).size, 0, '3D đã có phía: giữ');
  // chiều ngược: shot trước thiếu phía, shot sau đáng tin
  const r4 = canTheoCap([shot(1, [mat('Hạ', 2)], ['Hạ']), shot(2, [mat('Vivian', -40, -1)], ['Vivian', 'Hạ'])]);
  assert.equal(r4.get(1)!.find((k) => k.ten === 'Hạ')!.nhin!.can, 1);
  // đo lại một shot (sửa mặt) giữ phía theo cặp
  assert.deepEqual(giuCanCap([mat('Hạ', -20)], r.get(2)!)[0]!.nhin!.can, -1);
}
// ── 🩹 SỬA: ánh mắt sai cũng được sửa; kế hoạch chọn đúng chế độ + ảnh mẫu quay đúng phía; nhận khi đúng phía
{
  const smN: SoiMat = { url: 'k', luc: '', mat: 1, ket: [mat('Hạ', 4, -1)], dat: true };
  assert.ok(canSuaMat({ keyframe_url: 'k', soi_mat: smN }), 'mặt giống mà nhìn ống kính → được 🩹');
  assert.ok(!canSuaMat({ keyframe_url: 'k', soi_mat: { ...smN, duyet_tay: 'anh' } }), 'đã nhận tay → thôi');
  const nv = [{ ten: 'Hạ', anh_mat: { url: ['thang', 'trai', 'phai'], dau: [2, -28, 31] } }];
  const k = keHoachSuaMat(smN, nv, () => 'Vivian');
  assert.ok(!('loi' in k) && k.che_do === 'nhin' && k.mau === 'trai', 'cần nhìn trái → ảnh mẫu quay trái');
  assert.ok(!('loi' in k) && /viewer's LEFT/.test(k.prompt) && /at Vivian/.test(k.prompt) && /NOT on the camera/.test(k.prompt));
  const smM: SoiMat = { url: 'k', luc: '', mat: 1, ket: [{ ...mat('Hạ', 30, 1), dat: false, giong: 0.2 }], dat: false };
  const k2 = keHoachSuaMat(smM, nv);
  assert.ok(!('loi' in k2) && k2.che_do === 'mat' && k2.mau === 'phai' && /GAZE: .*RIGHT/.test(k2.prompt), 'sửa mặt cũng nói phía nhìn + ảnh mẫu quay phải');
  assert.ok(!('loi' in keHoachSuaMat({ ...smM, ket: [{ ...mat('Hạ', 0), dat: false, giong: 0.2 }] }, [{ ten: 'Hạ', anh_mat: { url: ['thang'] } }])) , 'không biết phía: vẫn sửa mặt bằng ảnh điển hình');
  assert.ok('loi' in keHoachSuaMat({ url: 'k', luc: '', mat: 1, ket: [mat('Hạ', -30, -1)], dat: true }, nv), 'không có gì để sửa');
  assert.ok(!nhanSuaMat({ url: 'k', luc: '', mat: 1, ket: [mat('Hạ', 5, -1)], dat: true }, 'Hạ'), 'ảnh sửa giống mặt mà còn nhìn ống kính → KHÔNG nhận');
  assert.ok(nhanSuaMat({ url: 'k', luc: '', mat: 1, ket: [mat('Hạ', -25, -1)], dat: true }, 'Hạ'));
}
// ── tập 122 #2 (thử thật 19/10/2026): Hạ cúi nhìn vết cà phê — ngang +1,2°, cúi 29° → KHÔNG phải nhìn ống kính
assert.deepEqual(loiNhin(sm([{ ten: 'Hạ', giong: 0.6, dat: true, nhin: { g: 1.2, dau: 1, mat: 0, doc: 29, can: 1 } }])), [], 'cúi nhìn xuống ≠ nhìn máy');
assert.match(loiNhin(sm([{ ten: 'Hạ', giong: 0.6, dat: true, nhin: { g: -30, dau: -25, mat: -0.1, doc: 29, can: 1 } }]))[0]!, /sai phía/, 'cúi mà quay hẳn sai phía vẫn lỗi');
// gán mặt chỉ cho người 3D thấy trong khung (#2: chỉ Hạ trong khung, mặt từng bị gán cho Vivian)
assert.deepEqual(nguoiSoiMat({ khung_xam: { kiem: [{ nhan_vat: 'Lâm Hạ', trong_khung: true }, { nhan_vat: 'Vivian', trong_khung: false }] } } as never, ['Lâm Hạ', 'Vivian']), ['Lâm Hạ']);
assert.deepEqual(nguoiSoiMat({}, ['Lâm Hạ', 'Vivian']), ['Lâm Hạ', 'Vivian'], 'không có khung 3D: mọi nhân vật của shot');
console.log('huong-nhin.test: ok');
