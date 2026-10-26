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
// CẮT GIỮA ĐỘNG TÁC: shot 5 nối động tác (noi = dong_tac); shot 6 Hạ quay sang nhìn trái → khung CUỐI shot 5: đầu bắt đầu quay sang trái
const c5 = { ...c(5, 'cu'), phan_doan: 'A', dan_dung: { noi: 'dong_tac' } } as unknown as Canh;
const c6 = { ...c(6, 'cu'), phan_doan: 'A', ky_thuat: { co_canh: 'cu', sd: { may: 'm', o: { 'Hạ': 'ha', 'Vivian': 'vi' }, nhin: { 'Hạ': [-5, 3] } } } } as unknown as Canh;
const k5 = veShotTuCanh(c5, kg, [], { luc: 'ket', sau: c6 })!; const h5 = k5.nguoi.find((n) => n.ten === 'Hạ')!;
assert.equal(h5.bat_dau_quay, -1, 'cuối shot 5: Hạ bắt đầu quay sang trái'); assert.ok(h5.quay! < 40 && h5.quay! > -40, `đầu mới quay một phần (${h5.quay})`);
assert.ok(svgSoDoShot(k5).includes('bắt đầu quay ←') && svgSoDoShot(k5).includes('CUỐI shot'));
assert.equal(veShotTuCanh({ ...c5, dan_dung: {} } as unknown as Canh, kg, [], { luc: 'ket', sau: c6 })!.nguoi.find((n) => n.ten === 'Hạ')!.bat_dau_quay, undefined, 'không nối động tác → không vẽ');
assert.ok(!svgSoDoShot(k5, { sach: true }).includes('bắt đầu quay'), 'khung trơn: đầu đã quay nhưng không mũi tên / chữ');
console.log('so-do-shot.test: ok');
