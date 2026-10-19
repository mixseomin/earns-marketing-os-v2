import assert from 'node:assert';
import { canNhin, dichNhin } from './bo-set-3d';
import { loiNhin, chanKhung, NGUONG_NHIN } from './khung';
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
console.log('huong-nhin.test: ok');
