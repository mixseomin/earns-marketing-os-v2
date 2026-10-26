// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/so-do-shot.test.mts
import assert from 'node:assert';
import { svgSoDoShot, veShotTuCanh } from './so-do-shot';
import type { KhongGian } from './khong-gian';
import type { Canh } from './kieu';

// sơ đồ 2D tối giản: máy nhìn về phía bắc, Hạ bên trái (tây), Vivian bên phải (đông), Hạ nhìn Vivian; thẻ trên cổ Hạ tới mảnh 7 rồi sang tay Vivian
const kg = { nguoi: ['Hạ', 'Vivian'], so_do: { moc: { ha: [-1, 3], vi: [1, 3] }, may: { m: { dat: [0, 0], nhin: [0, 3] } } },
  so_vat: { 'Thẻ': [{ tu: 1, ai: 'Hạ', cach: 'on her neck', vi: 'đeo cổ' }, { tu: 7, ai: 'Vivian', cach: "in Vivian's right hand", vi: 'tay phải Vivian', su_kien: 'giật' }] } } as unknown as KhongGian;
const c = (thu_tu: number, co: string) => ({ id: thu_tu, thu_tu, nhan_vat: [9], ky_thuat: { co_canh: co, sd: { may: 'm', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, nhin: { 'Hạ': 'Vivian', 'Vivian': 'Hạ' } } },
  bieu_cam: [{ nv: 'Hạ', dau: 'soc', cuoi: 'nhuc_nha' }] }) as unknown as Canh;
const v = veShotTuCanh(c(5, 'ms'), kg)!;
assert.ok(v, 'có sơ đồ cảnh → có hình');
const ha = v.nguoi.find((n) => n.ten === 'Hạ')!, vi = v.nguoi.find((n) => n.ten === 'Vivian')!;
assert.ok(ha.x < 0.5 && vi.x > 0.5, `Hạ trái màn, Vivian phải màn (${ha.x}, ${vi.x})`);
assert.equal(ha.nhin_huong, 1, 'Hạ nhìn sang phải màn'); assert.deepEqual(ha.mat, ['soc', 'nhuc_nha']);
assert.deepEqual(ha.do?.map((d) => d.mon), ['Thẻ'], 'mảnh 5: thẻ trên người Hạ');
assert.deepEqual(veShotTuCanh(c(8, 'ms'), kg)!.nguoi.find((n) => n.ten === 'Vivian')!.do?.map((d) => d.mon), ['Thẻ'], 'mảnh 8: thẻ đã sang Vivian');
assert.equal(veShotTuCanh(c(5, 'ms'), null), null, 'không sơ đồ cảnh → không vẽ');
const svg = svgSoDoShot(v); assert.ok(svg.startsWith('<svg') && svg.includes('cuối · Hạ') && svg.includes('stroke-dasharray'), 'có ô nét cuối + mũi tên ánh nhìn');
const tron = svgSoDoShot(v, { sach: true }); assert.ok(!tron.includes('<text') && !tron.includes('stroke-dasharray'), 'khung trơn cho model: không chữ, không mũi tên');
assert.ok(svgSoDoShot({ co: 'insert', nguoi: [], khai: ['Thẻ'] }).includes('Thẻ'), 'cận đồ vẽ món');
console.log('so-do-shot.test: ok');
